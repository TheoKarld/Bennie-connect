import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Wallet domain error codes (WALLET_xxx) per the PRD. Thrown as an HttpException
 * carrying the { success:false, error:{ code, message, details } } envelope so
 * the response shape stays consistent with the PRD error contract.
 */
export const WALLET_ERROR_CODES = {
  WALLET_001: 'Insufficient balance',
  WALLET_002: 'Wallet not found',
  WALLET_003: 'Wallet suspended',
  WALLET_004: 'Daily limit exceeded',
  WALLET_005: 'Monthly limit exceeded',
  WALLET_006: 'Invalid bank account',
  WALLET_007: 'Bank resolution failed',
  WALLET_008: 'Deposit failed',
  WALLET_009: 'Withdrawal failed',
  WALLET_010: 'Transaction not found',
  WALLET_011: 'Invalid webhook signature',
  WALLET_012: 'Duplicate transaction',
  WALLET_013: 'KYC required',
  WALLET_014: 'Minimum amount not met',
  WALLET_015: 'Maximum amount exceeded',
  WALLET_016: 'Recipient not found',
  WALLET_017: 'Self-transfer not allowed',
  WALLET_018: 'Live payouts disabled',
  WALLET_019: 'Deposit verification mismatch',
  WALLET_020: 'Deposit not confirmed by SeerBit',
} as const;

export type WalletErrorCode = keyof typeof WALLET_ERROR_CODES;

export class WalletException extends HttpException {
  constructor(
    code: WalletErrorCode,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    details?: Record<string, any>,
    messageOverride?: string,
  ) {
    super(
      {
        success: false,
        error: {
          code,
          message: messageOverride || WALLET_ERROR_CODES[code],
          ...(details ? { details } : {}),
        },
      },
      status,
    );
  }
}
