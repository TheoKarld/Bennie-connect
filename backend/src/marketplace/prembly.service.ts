import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { MerchantIdType } from './marketplace.constants';

export type PremblyStatus = 'VERIFIED' | 'NOT_VERIFIED' | 'ERROR' | 'SKIPPED';

/**
 * Advisory Prembly result snapshot stored on the merchant document
 * (data_structure.md §11.5). `checked: false` + `status: 'SKIPPED'` when the
 * service is unconfigured — the admin makes the final decision either way.
 */
export interface PremblyResult {
  checked: boolean;
  status: PremblyStatus;
  verified?: boolean;
  endpoint?: string;
  checkedAt?: Date;
  matchedName?: string;
  raw?: Record<string, any>;
}

interface CheckInput {
  idType: MerchantIdType;
  idNumber: string;
  firstName?: string;
  lastName?: string;
  state?: string;
}

/**
 * Prembly IdentityPass advisory ID verification. Graceful no-op without
 * creds (house pattern — MailService/FcmService/GcsService): missing env ⇒
 * every check resolves { checked: false, status: 'SKIPPED' } and merchant
 * submission proceeds. NEVER throws into the KYC submit path.
 *
 * Endpoints per PRD/admin_module/merchants/merchants.md §3 — relative to
 * `{PREMBLY_BASE_URL}/identitypass/verification`. The exact live paths must
 * be confirmed against docs.prembly.com before go-live (flagged there).
 */
@Injectable()
export class PremblyService {
  private readonly logger = new Logger(PremblyService.name);

  constructor(private readonly configService: ConfigService) {}

  private cfg(key: string): string {
    return this.configService.get<string>(`configuration.prembly.${key}`) || '';
  }

  isConfigured(): boolean {
    return Boolean(this.cfg('appId') && this.cfg('apiKey'));
  }

  /** Endpoint path (relative to the IdentityPass verification base) per idType. */
  private endpointFor(idType: MerchantIdType): {
    path: string;
    body: (input: CheckInput) => Record<string, any>;
  } {
    switch (idType) {
      case 'NIN':
        return {
          path: '/nin_wo_face',
          body: (i) => ({ number: i.idNumber, number_nin: i.idNumber }),
        };
      case 'BVN':
        return { path: '/bvn', body: (i) => ({ number: i.idNumber }) };
      case 'DRIVERS_LICENCE':
        return {
          path: '/drivers_license/basic',
          body: (i) => ({
            number: i.idNumber,
            ...(i.firstName ? { first_name: i.firstName } : {}),
            ...(i.lastName ? { last_name: i.lastName } : {}),
          }),
        };
      case 'VOTERS_CARD':
        return {
          path: '/voters_card',
          body: (i) => ({
            number: i.idNumber,
            ...(i.state ? { state: i.state } : {}),
            ...(i.lastName ? { last_name: i.lastName } : {}),
          }),
        };
      case 'INTL_PASSPORT':
        return {
          path: '/national_passport',
          body: (i) => ({
            number: i.idNumber,
            ...(i.lastName ? { last_name: i.lastName } : {}),
          }),
        };
    }
  }

  /** Strip base64/image-ish payloads so no ID images persist in Mongo. */
  private trimRaw(data: any): Record<string, any> {
    if (!data || typeof data !== 'object') {
      return {};
    }
    const out: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      const k = key.toLowerCase();
      if (
        k.includes('image') ||
        k.includes('photo') ||
        k.includes('picture') ||
        k.includes('base64') ||
        k.includes('signature')
      ) {
        continue;
      }
      if (typeof value === 'string' && value.length > 2000) {
        continue; // almost certainly an embedded binary blob
      }
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        out[key] = this.trimRaw(value);
      } else {
        out[key] = value;
      }
    }
    return out;
  }

  private extractName(data: any): string | undefined {
    if (!data || typeof data !== 'object') {
      return undefined;
    }
    const d = data.data && typeof data.data === 'object' ? data.data : data;
    const first = d.firstname || d.first_name || d.firstName || '';
    const last = d.surname || d.last_name || d.lastName || '';
    const middle = d.middlename || d.middle_name || '';
    const full =
      d.full_name ||
      d.name ||
      `${first} ${middle} ${last}`.replace(/\s+/g, ' ');
    const trimmed = (full || '').trim();
    return trimmed.length > 1 ? trimmed : undefined;
  }

  /**
   * Run the advisory identity check. Resolves a snapshot in every case —
   * SKIPPED (unconfigured), ERROR (timeout/5xx), NOT_VERIFIED, VERIFIED.
   */
  async verifyIdentity(input: CheckInput): Promise<PremblyResult> {
    if (!this.isConfigured()) {
      this.logger.warn(
        'Prembly not configured — KYC identity check skipped (advisory no-op).',
      );
      return { checked: false, status: 'SKIPPED' };
    }

    const { path, body } = this.endpointFor(input.idType);
    const base = this.cfg('baseUrl').replace(/\/+$/, '');
    const url = `${base}/identitypass/verification${path}`;

    try {
      const response = await axios.post(url, body(input), {
        headers: {
          'x-api-key': this.cfg('apiKey'),
          'app-id': this.cfg('appId'),
          accept: 'application/json',
          'content-type': 'application/json',
        },
        timeout: 20000,
        validateStatus: () => true,
      });

      const data = response.data || {};
      if (response.status >= 500) {
        this.logger.warn(
          `Prembly ${input.idType} check failed upstream (${response.status}).`,
        );
        return {
          checked: true,
          status: 'ERROR',
          endpoint: path,
          checkedAt: new Date(),
          raw: this.trimRaw(data),
        };
      }

      const verified =
        data.status === true &&
        (data.verification?.status === 'VERIFIED' ||
          data.verification_status === 'VERIFIED' ||
          data.verification?.status === true ||
          Boolean(data.data));

      return {
        checked: true,
        status: verified ? 'VERIFIED' : 'NOT_VERIFIED',
        verified,
        endpoint: path,
        checkedAt: new Date(),
        matchedName: this.extractName(data),
        raw: this.trimRaw(data),
      };
    } catch (error: any) {
      this.logger.warn(
        `Prembly ${input.idType} check errored: ${error?.message}`,
      );
      return {
        checked: true,
        status: 'ERROR',
        endpoint: path,
        checkedAt: new Date(),
      };
    }
  }

  /** Optional CAC check for registered businesses (advisory). */
  async verifyCac(rcNumber: string): Promise<PremblyResult> {
    if (!this.isConfigured()) {
      return { checked: false, status: 'SKIPPED' };
    }
    const base = this.cfg('baseUrl').replace(/\/+$/, '');
    const url = `${base}/identitypass/verification/cac`;
    try {
      const response = await axios.post(
        url,
        { rc_number: rcNumber, company_type: 'RC' },
        {
          headers: {
            'x-api-key': this.cfg('apiKey'),
            'app-id': this.cfg('appId'),
            accept: 'application/json',
            'content-type': 'application/json',
          },
          timeout: 20000,
          validateStatus: () => true,
        },
      );
      const data = response.data || {};
      const verified = response.status < 400 && data.status === true;
      return {
        checked: true,
        status: verified ? 'VERIFIED' : 'NOT_VERIFIED',
        verified,
        endpoint: '/cac',
        checkedAt: new Date(),
        matchedName: this.extractName(data),
        raw: this.trimRaw(data),
      };
    } catch (error: any) {
      this.logger.warn(`Prembly CAC check errored: ${error?.message}`);
      return {
        checked: true,
        status: 'ERROR',
        endpoint: '/cac',
        checkedAt: new Date(),
      };
    }
  }
}
