import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface VerifyPaymentResult {
  /** True only when SeerBit reports the payment as approved/successful. */
  success: boolean;
  /**
   * The PRINCIPAL amount that should be credited (NGN), reconciled against the
   * DepositRequest. This is `paymentBreakdown.amount` when SeerBit splits out a
   * customer-borne fee; otherwise falls back to the raw `payments.amount`.
   */
  amount?: number;
  /** The gross amount SeerBit charged the card (principal + fee), NGN. */
  grossAmount?: number;
  /** Fee portion (NGN), when SeerBit reports a breakdown. */
  fee?: number;
  currency?: string;
  /** SeerBit gateway reference (gatewayref) — stored as externalReference. */
  gatewayRef?: string;
  paymentReference?: string;
  gatewayMessage?: string;
  /**
   * Normalized status string. SeerBit's query returns the outcome via the
   * top-level `status` ("SUCCESS") + `data.code` ("00") + the human-readable
   * `payments.gatewayMessage` — it does NOT populate `payments.status`. We
   * surface the most descriptive of these for logging/UX.
   */
  status?: string;
  /** Set when SeerBit is not configured or the query could not be completed. */
  notAvailable?: boolean;
  raw?: any;
}

export interface DisbursementResult {
  executed: boolean;
  transferRef?: string;
  status?: string;
  message: string;
}

/**
 * Thin SeerBit v2 client. Mirrors MailService: when SeerBit keys are absent it
 * is a logged no-op (never throws on missing config). Auth uses the encrypt/keys
 * endpoint; the Bearer token is cached in-memory with a short TTL and re-fetched
 * on 401.
 */
@Injectable()
export class SeerbitService {
  private readonly logger = new Logger(SeerbitService.name);

  private cachedToken: string | null = null;
  private tokenExpiresAt = 0;
  private static readonly TOKEN_TTL_MS = 55 * 60 * 1000; // 55 min

  constructor(private readonly configService: ConfigService) {}

  private get secretKey(): string {
    return (
      this.configService.get<string>('configuration.seerbit.secretKey') || ''
    );
  }

  private get publicKey(): string {
    return (
      this.configService.get<string>('configuration.seerbit.publicKey') || ''
    );
  }

  private get baseUrl(): string {
    return (
      this.configService.get<string>('configuration.seerbit.baseUrl') ||
      'https://seerbitapi.com/api/v2'
    );
  }

  private get livePayouts(): boolean {
    return !!this.configService.get<boolean>(
      'configuration.wallet.livePayouts',
    );
  }

  isConfigured(): boolean {
    return !!(this.secretKey && this.publicKey);
  }

  /**
   * Obtain (and cache) the encrypted Bearer token from POST /encrypt/keys.
   * Returns null (logged warning) when SeerBit is not configured or the encrypt
   * call fails — callers treat null as "cannot verify right now".
   */
  async getBearerToken(force = false): Promise<string | null> {
    if (!this.isConfigured()) {
      this.logger.warn(
        'SeerBit not configured — skipping bearer token acquisition',
      );
      return null;
    }

    if (!force && this.cachedToken && Date.now() < this.tokenExpiresAt) {
      return this.cachedToken;
    }

    try {
      const { data } = await axios.post(
        `${this.baseUrl}/encrypt/keys`,
        { key: `${this.secretKey}.${this.publicKey}` },
        { headers: { 'Content-Type': 'application/json' }, timeout: 15000 },
      );
      const encryptedKey: string | undefined =
        data?.data?.EncryptedSecKey?.encryptedKey;
      if (!encryptedKey) {
        this.logger.error(
          `SeerBit encrypt/keys returned no encryptedKey: ${JSON.stringify(
            data,
          )}`,
        );
        return null;
      }
      this.cachedToken = encryptedKey;
      this.tokenExpiresAt = Date.now() + SeerbitService.TOKEN_TTL_MS;
      return encryptedKey;
    } catch (error: any) {
      this.logger.error(
        `SeerBit encrypt/keys failed: ${
          error?.response?.data
            ? JSON.stringify(error.response.data)
            : error?.message
        }`,
      );
      return null;
    }
  }

  /**
   * Query a payment by reference (GET /payments/query/{ref}) — the SOLE source
   * of truth for crediting. Never throws on config/network issues; returns
   * { success:false, notAvailable:true } so the caller can decide.
   */
  async verifyPayment(reference: string): Promise<VerifyPaymentResult> {
    if (!this.isConfigured()) {
      this.logger.warn(
        `SeerBit not configured — cannot verify payment ${reference}`,
      );
      return { success: false, notAvailable: true };
    }

    const doQuery = async (token: string) =>
      axios.get(
        `${this.baseUrl}/payments/query/${encodeURIComponent(reference)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 15000,
        },
      );

    try {
      let token = await this.getBearerToken();
      if (!token) {
        return { success: false, notAvailable: true };
      }

      let response;
      try {
        response = await doQuery(token);
      } catch (error: any) {
        // Re-encrypt once on 401 and retry.
        if (error?.response?.status === 401) {
          token = await this.getBearerToken(true);
          if (!token) {
            return { success: false, notAvailable: true };
          }
          response = await doQuery(token);
        } else {
          throw error;
        }
      }

      const body = response.data;
      return this.parseVerifyResponse(body);
    } catch (error: any) {
      const status = error?.response?.status;
      // A 404 from the query endpoint means SeerBit has no record of it yet.
      this.logger.warn(
        `SeerBit query for ${reference} failed (${status || 'no-status'}): ${
          error?.response?.data
            ? JSON.stringify(error.response.data)
            : error?.message
        }`,
      );
      return { success: false, notAvailable: true };
    }
  }

  /** Coerce SeerBit's mixed number/string money fields to a number, else undefined. */
  private toAmount(v: unknown): number | undefined {
    if (v === undefined || v === null || v === '') return undefined;
    const n = typeof v === 'number' ? v : parseFloat(String(v));
    return Number.isFinite(n) ? n : undefined;
  }

  /**
   * Normalize a SeerBit query response into VerifyPaymentResult.
   *
   * REAL response shape (v2 & v3, observed):
   *   { status: "SUCCESS",
   *     data: { code: "00", message: "Successful",
   *             payments: { gatewayMessage: "Successful", gatewayCode: "00",
   *                         amount: 25375 (gross, fee-inclusive when
   *                         feeBearer=CUSTOMER), fee: "375.00", currency: "NGN",
   *                         gatewayref, paymentReference,
   *                         paymentBreakdown: { amount: 25000, fee: 375,
   *                                             total: 25375 } } } }
   *
   * Success is signalled by top-level status:"SUCCESS" + data.code:"00" +
   * payments.gatewayCode/gatewayMessage "Successful" — NOT payments.status
   * (which SeerBit does not populate on query). We treat any of these approval
   * signals as success and require none of the failure signals.
   *
   * The PRINCIPAL to credit is paymentBreakdown.amount when present (the fee is
   * customer-borne on top), falling back to payments.amount when SeerBit reports
   * no breakdown.
   */
  parseVerifyResponse(body: any): VerifyPaymentResult {
    const data = body?.data || {};
    const payments = data?.payments || {};
    const breakdown = payments?.paymentBreakdown || {};

    const topStatus: string | undefined = body?.status;
    const dataCode: string | undefined = data?.code;
    const gatewayCode: string | undefined = payments?.gatewayCode;
    const gatewayMessage: string | undefined = payments?.gatewayMessage;

    // Robust success detection: accept SeerBit's actual approval signals.
    const success =
      topStatus === 'SUCCESS' ||
      dataCode === '00' ||
      gatewayCode === '00' ||
      (typeof payments?.status === 'string' &&
        payments.status.toUpperCase() === 'SUCCESS');

    const grossAmount = this.toAmount(payments?.amount);
    const breakdownAmount = this.toAmount(breakdown?.amount);
    const fee = this.toAmount(breakdown?.fee) ?? this.toAmount(payments?.fee);

    // Credit the principal, not the fee-inclusive gross.
    const principal =
      breakdownAmount !== undefined ? breakdownAmount : grossAmount;

    return {
      success,
      amount: principal,
      grossAmount,
      fee,
      currency: payments?.currency,
      gatewayRef: payments?.gatewayref,
      paymentReference: payments?.paymentReference,
      gatewayMessage: gatewayMessage || data?.message,
      status: payments?.status || gatewayMessage || data?.message || topStatus,
      raw: body,
    };
  }

  /**
   * Single-transfer disbursement — STUB, gated behind WALLET_LIVE_PAYOUTS.
   * With the flag off (this phase) it returns a not-executed result; it never
   * moves money. When enabled, wire the verified merchant disbursement endpoint
   * here (path must be re-verified against the enabled product — see PRD §F).
   */
  async disburseToBank(_params: {
    reference: string;
    amount: number;
    accountNumber: string;
    bankCode: string;
    accountName?: string;
    narration?: string;
  }): Promise<DisbursementResult> {
    if (!this.livePayouts) {
      this.logger.warn(
        'disburseToBank called but WALLET_LIVE_PAYOUTS is off — not executed',
      );
      return {
        executed: false,
        message: 'Live payouts disabled (WALLET_LIVE_PAYOUTS=false)',
      };
    }
    // Live disbursement not implemented — the SeerBit disbursement product is
    // not enabled and its endpoint path is unverified (PRD §F).
    this.logger.warn(
      'disburseToBank: live disbursement not implemented (SeerBit product not enabled)',
    );
    return {
      executed: false,
      message: 'Live disbursement not implemented',
    };
  }
}
