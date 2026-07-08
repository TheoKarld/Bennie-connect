import { Body, Controller, Headers, Logger, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { randomBytes } from 'crypto';
import { Public } from '../auth/decorators/public.decorator';
import { WalletService } from './wallet.service';

/**
 * SeerBit V2 payment-notification webhook. PUBLIC (no auth). ⚠️ The body is
 * NEVER trusted for crediting — SeerBit V2 publishes no verifiable signature
 * scheme, so the handler extracts the payment reference and runs the SAME
 * server-side verify-and-credit path (GET /payments/query/{ref}) as the
 * authenticated verify endpoint. Must ACK within 5s.
 */
@ApiTags('webhooks')
@Controller('webhooks/seerbit')
export class SeerbitWebhookController {
  private readonly logger = new Logger(SeerbitWebhookController.name);

  constructor(private readonly walletService: WalletService) {}

  @Public()
  @Post('deposit')
  @ApiOperation({
    summary: 'SeerBit V2 deposit notification (public backstop)',
  })
  async handleDeposit(
    @Body() body: any,
    @Headers('x-expected-ack-reference') ackHeader?: string,
  ) {
    const ackReference =
      ackHeader || `ACK${Date.now()}${randomBytes(3).toString('hex')}`;

    // Extract the payment reference from the notification envelope, then credit
    // via the shared server-side path. Do this without blocking the 5s ack —
    // fire-and-forget so we always ACK promptly.
    const reference = this.extractReference(body);
    if (reference) {
      this.walletService
        .creditDeposit(reference)
        .then((r) =>
          this.logger.log(
            `Webhook credited deposit ${reference} (alreadyCredited=${r.alreadyCredited})`,
          ),
        )
        .catch((err) =>
          this.logger.warn(
            `Webhook credit for ${reference} failed: ${err?.message}`,
          ),
        );
    } else {
      this.logger.warn(
        'SeerBit webhook received with no extractable payment reference',
      );
    }

    return { ackReference, status: 'received' };
  }

  /** Pull the payment reference out of the V2 notificationItems envelope. */
  private extractReference(body: any): string | null {
    try {
      const items = body?.notificationItems;
      if (Array.isArray(items) && items.length > 0) {
        const data = items[0]?.notificationRequestItem?.data || {};
        return (
          data.paymentReference ||
          data.payments?.paymentReference ||
          data.reference ||
          data.merchantReference ||
          null
        );
      }
      // Fallback for flatter payloads.
      return body?.paymentReference || body?.data?.paymentReference || null;
    } catch {
      return null;
    }
  }
}
