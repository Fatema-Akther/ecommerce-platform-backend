import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  Post,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';

import { PaymentsService } from './payments.service';
import { StripeClientService } from './stripe-client.service';

@Controller('payments/stripe')
export class StripeWebhookController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly stripeClient: StripeClientService,
  ) {}

  @Post('webhook')
  @HttpCode(200)
  async webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature?: string,
  ) {
    if (!signature) {
      throw new BadRequestException(
        'Stripe signature is missing',
      );
    }

    if (!req.rawBody) {
      throw new BadRequestException(
        'Webhook raw body is missing',
      );
    }

    try {
      const event =
        this.stripeClient.constructWebhookEvent(
          req.rawBody,
          signature,
        );

      return await this.paymentsService
        .handleStripeEvent(event);
    } catch (error: any) {
      throw new BadRequestException(
        `Stripe webhook error: ${
          error?.message || 'Invalid webhook'
        }`,
      );
    }
  }
}