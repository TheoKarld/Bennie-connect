import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * User-plane equipment error codes (EQP_xxx) per PRD 06 §7.
 */
export const EQUIPMENT_ERROR_CODES = {
  EQP_001: 'Equipment not found',
  EQP_002: 'Booking not found',
  EQP_003: 'Equipment not available for the requested window',
  EQP_004: 'Invalid booking status transition',
  EQP_005: 'Booking window conflict / lost at pay time',
  EQP_006: 'Invalid date range',
  EQP_007: 'Not authorized for this booking',
  EQP_008: 'Payment allowed only when APPROVED and UNPAID',
  EQP_009: 'Insufficient wallet balance',
  EQP_010: 'Wallet debit failed',
  EQP_011: 'Cannot cancel in current state',
  EQP_012: 'Rating allowed only after completion',
  EQP_013: 'Invalid / expired tracking token',
  EQP_014: 'GPS push rejected — booking not IN_USE/OVERDUE',
} as const;

export type EquipmentErrorCode = keyof typeof EQUIPMENT_ERROR_CODES;

export class EquipmentException extends HttpException {
  constructor(
    code: EquipmentErrorCode,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    details?: Record<string, any>,
    messageOverride?: string,
  ) {
    super(
      {
        success: false,
        error: {
          code,
          message: messageOverride || EQUIPMENT_ERROR_CODES[code],
          ...(details ? { details } : {}),
        },
      },
      status,
    );
  }
}

/**
 * Admin-plane equipment error codes (EQP_ADM_xxx) per the admin PRD §7.
 */
export const EQUIPMENT_ADMIN_ERROR_CODES = {
  EQP_ADM_001: 'Equipment not found',
  EQP_ADM_002: 'Booking not found',
  EQP_ADM_003: 'Invalid equipment status transition',
  EQP_ADM_004: 'Invalid booking status transition',
  EQP_ADM_005: 'Booking window conflicts with an existing booking',
  EQP_ADM_006: 'Maintenance window overlaps an active booking',
  EQP_ADM_007: 'Cannot retire/delete — active bookings exist',
  EQP_ADM_008: 'Deposit already settled',
  EQP_ADM_009: 'Damage estimate invalid',
  EQP_ADM_010: 'Handover blocked — booking not CONFIRMED (user has not paid)',
  EQP_ADM_011: 'GPS device inactive / no live position',
  EQP_ADM_012: 'Invalid geofence definition',
  EQP_ADM_013: 'Reason required for this action',
  EQP_ADM_014: 'Insufficient permission for action',
  EQP_ADM_015: 'Invalid booking action for current status',
  EQP_ADM_016: 'Invalid / expired / revoked tracking token',
} as const;

export type EquipmentAdminErrorCode = keyof typeof EQUIPMENT_ADMIN_ERROR_CODES;

export class EquipmentAdminException extends HttpException {
  constructor(
    code: EquipmentAdminErrorCode,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    details?: Record<string, any>,
    messageOverride?: string,
  ) {
    super(
      {
        success: false,
        error: {
          code,
          message: messageOverride || EQUIPMENT_ADMIN_ERROR_CODES[code],
          ...(details ? { details } : {}),
        },
      },
      status,
    );
  }
}
