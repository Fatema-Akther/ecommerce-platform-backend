import { Injectable } from '@nestjs/common';
import Stripe from 'stripe';

@Injectable()
export class StripeClientService {
  readonly client: Stripe;
  readonly isMock: boolean;

  constructor() {
    this.isMock = process.env.STRIPE_USE_MOCK === 'true';

    const secretKey =
      process.env.STRIPE_SECRET_KEY ||
      (this.isMock ? 'sk_test_dummy' : '');

    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY is required');
    }

    const config: Stripe.StripeConfig = this.isMock
      ? {
          host: process.env.STRIPE_MOCK_HOST || '127.0.0.1',
          port: Number(process.env.STRIPE_MOCK_PORT || 12111),
          protocol: 'http',
        }
      : {};

    this.client = new Stripe(secretKey, config);
  }

  constructWebhookEvent(
    payload: Buffer,
    signature: string,
  ): Stripe.Event {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET is required');
    }

    return this.client.webhooks.constructEvent(
      payload,
      signature,
      webhookSecret,
    );
  }
}