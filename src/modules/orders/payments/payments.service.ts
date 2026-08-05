import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import * as bcrypt from 'bcrypt';

import { Order } from '../order.entity';
import { Payment, PaymentProvider } from './payment.entity';
import { User } from '../../users/user.entity';
import { OrdersService } from '../orders.service';
import { StripeClientService } from './stripe-client.service';
import Stripe from 'stripe';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment) private payRepo: Repository<Payment>,
    @InjectRepository(Order) private orderRepo: Repository<Order>,
    private dataSource: DataSource,
      private ordersService: OrdersService,
       private stripeClient: StripeClientService,
  ) {}

  /* ================== helpers ================== */
private toStripeMinorUnit(amount: number | string) {
  const numericAmount = Number(amount);

  if (!Number.isFinite(numericAmount) || numericAmount < 0) {
    throw new BadRequestException('Invalid payment amount');
  }

  return Math.round(numericAmount * 100);
}

private getStripeFrontendUrl() {
  const frontendUrl = process.env.STRIPE_FRONTEND_URL?.trim();

  if (!frontendUrl) {
    throw new BadRequestException(
      'STRIPE_FRONTEND_URL is not configured',
    );
  }

  return frontendUrl.replace(/\/+$/, '');
}

private ensureStripeMockEnabled() {
  if (
    !this.stripeClient.isMock ||
    process.env.NODE_ENV === 'production'
  ) {
    throw new ForbiddenException(
      'Stripe mock endpoint is disabled',
    );
  }
}

private getStripePaymentIntentId(
  session: Stripe.Checkout.Session,
) {
  if (typeof session.payment_intent === 'string') {
    return session.payment_intent;
  }

  return session.payment_intent?.id || null;
}

private async markStripePaymentSuccessful(
  session: Stripe.Checkout.Session,
) {
  const paymentId = session.metadata?.paymentId;
  const orderId = session.metadata?.orderId;

  if (!paymentId || !orderId) {
    throw new BadRequestException(
      'Stripe payment metadata is missing',
    );
  }

  return this.dataSource.transaction(async (manager) => {
   const payment = await this.getLockedStripePayment(
  manager,
  paymentId,
);

    if (payment.provider !== 'stripe') {
      throw new BadRequestException(
        'Payment provider mismatch',
      );
    }

    if (payment.order.id !== orderId) {
      throw new BadRequestException(
        'Stripe order metadata mismatch',
      );
    }

    if (
      payment.providerPaymentId &&
      payment.providerPaymentId !== session.id
    ) {
      throw new BadRequestException(
        'Stripe session mismatch',
      );
    }

  if (payment.status === 'success') {
  return {
    received: true,
    duplicate: true,
    paymentId: payment.id,
    orderId: payment.order.id,
  };
}

if (
  payment.status === 'failed' ||
  payment.status === 'cancelled' ||
  payment.status === 'refunded'
) {
  return {
    received: true,
    ignored: true,
    reason: `Payment is already ${payment.status}`,
    paymentId: payment.id,
    orderId: payment.order.id,
    paymentStatus: payment.status,
    orderStatus: payment.order.status,
  };
}

if (
  payment.order.status === 'cancelled' ||
  payment.order.status === 'failed' ||
  payment.order.status === 'refunded'
) {
  return {
    received: true,
    ignored: true,
    reason: `Order is already ${payment.order.status}`,
    paymentId: payment.id,
    orderId: payment.order.id,
    paymentStatus: payment.status,
    orderStatus: payment.order.status,
  };
}


  if (session.payment_status !== 'paid') {
  return {
    received: true,
    pending: true,
  };
}

    const expectedAmount = this.toStripeMinorUnit(
      payment.amount,
    );

    if (
      session.amount_total !== null &&
      session.amount_total !== expectedAmount
    ) {
      throw new BadRequestException(
        'Stripe payment amount mismatch',
      );
    }

    const paymentIntentId =
      this.getStripePaymentIntentId(session);

    payment.status = 'success';
    payment.providerTrxId =
      paymentIntentId || session.id;

    payment.providerMeta = {
      ...(payment.providerMeta || {}),
      paymentStatus: session.payment_status,
      currency: session.currency,
      paidAt: new Date().toISOString(),
    };

    payment.order.status = 'paid';
    payment.order.paymentProvider = 'stripe';
    payment.order.paymentRef =
      paymentIntentId || session.id;

    await manager.save(Order, payment.order);
    await manager.save(Payment, payment);

    return {
      received: true,
      success: true,
      paymentId: payment.id,
      orderId: payment.order.id,
      orderStatus: payment.order.status,
      transactionId: payment.providerTrxId,
    };
  });
}


private async markStripePaymentFailed(
  session: Stripe.Checkout.Session,
  paymentStatus: 'failed' | 'cancelled',
) {
  const paymentId = session.metadata?.paymentId;

  if (!paymentId) {
    throw new BadRequestException(
      'Stripe payment metadata is missing',
    );
  }

  return this.dataSource.transaction(async (manager) => {
  const payment = await this.getLockedStripePayment(
  manager,
  paymentId,
);

    if (payment.status === 'success') {
      return {
        received: true,
        ignored: true,
        reason: 'Payment already succeeded',
      };
    }

    if (
      payment.status === 'failed' ||
      payment.status === 'cancelled'
    ) {
      return {
        received: true,
        duplicate: true,
      };
    }

    if (payment.order.status === 'awaiting_payment') {
      await this.ordersService.restoreStockForRefundedOrder(
        manager,
        payment.order,
      );

      payment.order.status =
        paymentStatus === 'cancelled'
          ? 'cancelled'
          : 'failed';

      await manager.save(Order, payment.order);
    }

    payment.status = paymentStatus;

    payment.providerMeta = {
      ...(payment.providerMeta || {}),
      closedAt: new Date().toISOString(),
      closeReason: paymentStatus,
    };

    await manager.save(Payment, payment);

    return {
      received: true,
      paymentId: payment.id,
      paymentStatus: payment.status,
      orderId: payment.order.id,
      orderStatus: payment.order.status,
    };
  });
}

  private async getLockedStripePayment(
  manager: EntityManager,
  paymentId: string,
) {
  const lockedPayment = await manager
    .getRepository(Payment)
    .createQueryBuilder('payment')
    .where('payment.id = :paymentId', { paymentId })
    .setLock('pessimistic_write')
    .getOne();

  if (!lockedPayment) {
    throw new NotFoundException('Payment not found');
  }

  const payment = await manager.findOne(Payment, {
    where: { id: paymentId },
    relations: {
      order: {
        items: true,
        user: true,
      },
      user: true,
    },
  });

  if (!payment) {
    throw new NotFoundException('Payment not found');
  }

  return payment;
}
// old
  // private maskPhone(phone: string) {
  //   if (!phone) return '';
  //   return phone.slice(0, 3) + '****' + phone.slice(-2);
  // }

  private buildIdempotencyKey(orderId: string, provider: PaymentProvider) {
    return `${orderId}:${provider}`;
  }

  // private generateOtp() {
  //   return Math.floor(100000 + Math.random() * 900000).toString();
  // }

  private async ensureOrderForUser(orderId: string, user: User) {
    const order = await this.orderRepo.findOne({
      where: { id: orderId },
      relations: { user: true },
    });

    if (!order) throw new NotFoundException('Order not found');
    if (user.role !== 'admin' && order.user.id !== user.id) {
      throw new ForbiddenException('Not your order');
    }
    return order;
  }

    private ensureAdmin(user: User) {
    if (user.role !== 'admin') {
      throw new ForbiddenException('Admin only');
    }
  }

  /* ================== INITIATE PAYMENT ================== */

//  async initiate(
//   user: User,
//   orderId: string,
//   provider: PaymentProvider,
//   phone?: string,
// ) {
//   if (provider === 'stripe') {
//     return this.createStripeCheckoutSession(
//       user,
//       orderId,
//     );
//   }
//     const order = await this.ensureOrderForUser(orderId, user);
//     if (order.status === 'paid') {
//       throw new BadRequestException('Order already paid');
//     }

//     const key = this.buildIdempotencyKey(orderId, provider);

//     // 🔁 idempotency
//     const existing = await this.payRepo.findOne({
//       where: { idempotencyKey: key },
//       relations: { user: true },
//     });

//     if (existing && !['failed', 'cancelled'].includes(existing.status)) {
//       return {
//         paymentId: existing.id,
//         provider: existing.provider,
//         status: existing.status,
//         maskedPhone: existing.phone
//           ? this.maskPhone(existing.phone)
//           : undefined,
//         expiresAt: existing.otpExpiresAt,
//         resendAt: existing.otpResendAt,
//         lockedUntil: existing.lockedUntil,
//         note: 'Existing payment returned (idempotent)',
//       };
//     }

//     /* ================== COD ================== */
//     if (provider === 'cod') {
//       return this.dataSource.transaction(async (manager) => {
//         order.status = 'processing';
//         order.paymentProvider = 'cod';
//         order.paymentRef = `COD-${Date.now()}`;
//         await manager.save(order);

//         const payment = manager.create(Payment, {
//           order,
//           user,
//           provider: 'cod',
//           status: 'success',
//           amount: Number(order.total),
//           currency: 'BDT',
//           providerTrxId: order.paymentRef,
//           idempotencyKey: key,
//         });

//         const saved = await manager.save(payment);
//         return { paymentId: saved.id, provider: saved.provider, status: saved.status };
//       });
//     }

//     /* ================== BKASH MOCK (OTP) ================== */
//     if (provider === 'bkash_mock') {
//       if (!phone) throw new BadRequestException('phone is required');
//       if (!/^01\d{9}$/.test(phone))
//         throw new BadRequestException('Invalid BD phone number');

//       return this.dataSource.transaction(async (manager) => {
//         order.status = 'awaiting_payment';
//         order.paymentProvider = 'bkash_mock';
//         await manager.save(order);

//         const otp = this.generateOtp();
//         const otpHash = await bcrypt.hash(otp, 10);

//         const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
//         const resendAt = new Date(Date.now() + 60 * 1000);

//         const payment = manager.create(Payment, {
//           order,
//           user,
//           provider: 'bkash_mock',
//           status: 'otp_sent',
//           amount: Number(order.total),
//           currency: 'BDT',
//           phone,
//           otpHash,
//           otpExpiresAt: expiresAt,
//           otpAttempts: 0,
//           otpResendAt: resendAt,
       
//           idempotencyKey: key,
//           providerMeta: { mock: true },
//         });

//         const saved = await manager.save(payment);

        

//         return {
//           paymentId: saved.id,
//           provider: saved.provider,
//           status: saved.status,
//           maskedPhone: this.maskPhone(phone),
//           expiresAt,
//           resendAt,
//         };
//       });
//     }

//     /* ================== FUTURE REAL BKASH ================== */
//     if (provider === 'bkash_real') {
//       order.status = 'awaiting_payment';
//       order.paymentProvider = 'bkash_real';
//       await this.orderRepo.save(order);

//       const payment = this.payRepo.create({
//         order,
//         user,
//         provider: 'bkash_real',
//         status: 'initiated',
//         amount: Number(order.total),
//         currency: 'BDT',
//         idempotencyKey: key,
//       });

//       const saved = await this.payRepo.save(payment);

//       // future: return bKash redirect URL
//       return {
//         paymentId: saved.id,
//         provider: saved.provider,
//         status: saved.status,
//         redirectUrl: null,
//       };
//     }

//     throw new BadRequestException('Unsupported provider');
//   }


async initiate(
  user: User,
  orderId: string,
  provider: PaymentProvider,
) {

  if (provider === 'stripe') {
    return this.createStripeCheckoutSession(
      user,
      orderId,
    );
  }


  const order = await this.ensureOrderForUser(
    orderId,
    user,
  );


  if (order.status === 'paid') {
    throw new BadRequestException(
      'Order already paid',
    );
  }


  const key = this.buildIdempotencyKey(
    orderId,
    provider,
  );


  const existing = await this.payRepo.findOne({
    where:{
      idempotencyKey:key,
    },
  });


  if (
    existing &&
    !['failed','cancelled'].includes(existing.status)
  ) {
    return {
      paymentId: existing.id,
      provider: existing.provider,
      status: existing.status,
    };
  }



  if(provider === 'cod') {

    return this.dataSource.transaction(
      async(manager)=>{

        order.status='processing';
        order.paymentProvider='cod';
        order.paymentRef=`COD-${Date.now()}`;


        await manager.save(
          Order,
          order,
        );


        const payment =
        manager.create(Payment,{
          order,
          user,

          provider:'cod',

          status:'success',

          amount:Number(order.total),

          currency:'USD',

          providerTrxId:
          order.paymentRef,

          idempotencyKey:key,
        });


        const saved =
        await manager.save(
          Payment,
          payment,
        );


        return {
          paymentId:saved.id,
          provider:saved.provider,
          status:saved.status,
        };

      }
    );
  }


  throw new BadRequestException(
    'Unsupported payment provider',
  );
}

  /* ================== RESEND OTP ================== */

  // async resendBkashMockOtp(user: User, paymentId: string) {
  //   const payment = await this.payRepo.findOne({
  //     where: { id: paymentId },
  //     relations: { user: true },
  //   });

  //   if (!payment) throw new NotFoundException('Payment not found');
  //   if (user.role !== 'admin' && payment.user.id !== user.id) {
  //     throw new ForbiddenException('Not your payment');
  //   }

  //   if (payment.provider !== 'bkash_mock')
  //     throw new BadRequestException('Not bkash_mock');

  //   if (payment.lockedUntil && payment.lockedUntil > new Date()) {
  //     throw new BadRequestException(`Locked until ${payment.lockedUntil.toISOString()}`);
  //   }

  //   if (payment.otpResendAt && payment.otpResendAt > new Date()) {
  //     throw new BadRequestException('Please wait before resend');
  //   }

  //   const otp = this.generateOtp();
  //   payment.otpHash = await bcrypt.hash(otp, 10);
  //   payment.otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000);
  //   payment.otpAttempts = 0;
  //   payment.otpResendAt = new Date(Date.now() + 60 * 1000);

  //   await this.payRepo.save(payment);
   

  //   return {
  //     paymentId: payment.id,
  //     maskedPhone: this.maskPhone(payment.phone || ''),
  //     expiresAt: payment.otpExpiresAt,
  //     resendAt: payment.otpResendAt,
  //   };
  // }

  /* ================== VERIFY OTP ================== */

  // async verifyBkashMockOtp(user: User, paymentId: string, otp: string) {
  //   const payment = await this.payRepo.findOne({
  //     where: { id: paymentId },
  //     relations: { order: { user: true }, user: true },
  //   });

  //   if (!payment) throw new NotFoundException('Payment not found');
  //   if (user.role !== 'admin' && payment.user.id !== user.id) {
  //     throw new ForbiddenException('Not your payment');
  //   }

  //   if (payment.provider !== 'bkash_mock')
  //     throw new BadRequestException('Not bkash_mock');

  //   if (payment.lockedUntil && payment.lockedUntil > new Date()) {
  //     throw new BadRequestException('Payment locked');
  //   }

  //   if (!payment.otpExpiresAt || payment.otpExpiresAt < new Date()) {
  //     payment.status = 'failed';
  //     await this.payRepo.save(payment);
  //     throw new BadRequestException('OTP expired');
  //   }

  //   if (payment.otpAttempts >= 3) {
  //     payment.status = 'failed';
  //     payment.lockedUntil = new Date(Date.now() + 10 * 60 * 1000);
  //     await this.payRepo.save(payment);
  //     throw new BadRequestException('Too many attempts');
  //   }

  //   payment.otpAttempts += 1;

  //   const ok = await bcrypt.compare(otp, payment.otpHash || '');
  //   if (!ok) {
  //     if (payment.otpAttempts >= 3) {
  //       payment.lockedUntil = new Date(Date.now() + 10 * 60 * 1000);
  //       payment.status = 'failed';
  //     }
  //     await this.payRepo.save(payment);
  //     throw new BadRequestException('Invalid OTP');
  //   }

  //   return this.dataSource.transaction(async (manager) => {
  //     payment.status = 'success';
  //     payment.providerTrxId = `MOCKTRX-${Date.now()}`;

  //     payment.order.status = 'paid';
  //     payment.order.paymentProvider = 'bkash_mock';
  //     payment.order.paymentRef = payment.providerTrxId;

  //     await manager.save(payment.order);
  //     await manager.save(payment);

  //     return {
  //       success: true,
  //       orderId: payment.order.id,
  //       trxId: payment.providerTrxId,
  //     };
  //   });
  // }

  /* ================== STATUS ================== */

  async getPaymentStatus(user: User, paymentId: string) {
    const p = await this.payRepo.findOne({
      where: { id: paymentId },
      relations: { user: true },
    });

    if (!p) throw new NotFoundException('Payment not found');
    if (user.role !== 'admin' && p.user.id !== user.id)
      throw new ForbiddenException('Not yours');

    return {
    paymentId: p.id,
    provider: p.provider,
    status: p.status,
    amount: Number(p.amount),
    currency: p.currency,
    createdAt: p.createdAt,
  };
  }



//     async getPendingManualBkashPayments(user: User) {
//     this.ensureAdmin(user);

//     const payments = await this.payRepo.find({
//       where: {
//         provider: 'bkash_manual',
//         status: 'initiated',
//       },
//       relations: {
//         order: { user: true },
//         user: true,
//       },
//       order: {
//         createdAt: 'DESC',
//       },
//     });

//     return payments.map((p) => ({
//       paymentId: p.id,
//       provider: p.provider,
//       status: p.status,
//       amount: Number(p.amount),
//       currency: p.currency,
//       senderPhone: p.phone,
//       trxId: p.providerTrxId,
//       createdAt: p.createdAt,
//       order: {
//         id: p.order?.id,
//         status: p.order?.status,
//         total: Number(p.order?.total || 0),
//         paymentMethod: p.order?.paymentMethod,
//         paymentProvider: p.order?.paymentProvider,
//        customer: {
//   id: p.order?.user?.id,
//   email: p.order?.user?.email,

//   fullName: p.order?.delivery?.fullName,
//   phone: p.order?.delivery?.phone,

//   address: p.order?.delivery?.address,
//   city: p.order?.delivery?.city,
//   state: p.order?.delivery?.state,
//   postalCode: p.order?.delivery?.postalCode,
//   country: p.order?.delivery?.country,
// },
//       },
//       meta: p.providerMeta || null,
//     }));
//   }



//     async verifyManualBkashPayment(
//     user: User,
//     paymentId: string,
//     action: 'approve' | 'reject',
//     note?: string,
//   ) {
//     this.ensureAdmin(user);

//     const payment = await this.payRepo.findOne({
//       where: { id: paymentId },
//       relations: {
//         order: { user: true },
//         user: true,
//       },
//     });

//     if (!payment) {
//       throw new NotFoundException('Payment not found');
//     }

//     if (payment.provider !== 'bkash_manual') {
//       throw new BadRequestException('Not a manual bKash payment');
//     }

//     if (!payment.order) {
//       throw new NotFoundException('Order not found for this payment');
//     }

//     if (payment.status !== 'initiated') {
//       throw new BadRequestException('This payment has already been reviewed');
//     }

//     return this.dataSource.transaction(async (manager) => {
//       const now = new Date();

//       payment.providerMeta = {
//         ...(payment.providerMeta || {}),
//         manual: true,
//         reviewedByAdminId: user.id,
//         reviewedAt: now.toISOString(),
//         adminAction: action,
//         adminNote: note?.trim() || null,
//       };

//       if (action === 'approve') {
//         payment.status = 'success';

//         payment.order.status = 'paid';
//         payment.order.paymentProvider = 'bkash_manual';
//         payment.order.paymentRef = payment.providerTrxId || `MANUAL-${Date.now()}`;
//       } else {

//   const order = await manager.findOne(Order, {
//     where: {
//       id: payment.order.id,
//     },
//     relations: {
//       items: true,
//     },
//   });

//   if (order) {
//     await this.ordersService.restoreStockForRefundedOrder(
//       manager,
//       order,
//     );
//   }

//   payment.status = 'failed';

//   payment.order.status = 'failed';
//   payment.order.paymentProvider = 'bkash_manual';

//   payment.order.adminReviewNote = note?.trim()
//     ? `${payment.order.adminReviewNote ? `${payment.order.adminReviewNote}\n` : ''}[BKASH_REJECTED] ${note.trim()}`
//     : payment.order.adminReviewNote;
// }

//       await manager.save(payment.order);
//       await manager.save(payment);

//       return {
//         success: true,
//         paymentId: payment.id,
//         action,
//         paymentStatus: payment.status,
//         orderId: payment.order.id,
//         orderStatus: payment.order.status,
//         trxId: payment.providerTrxId || null,
//         adminNote: note?.trim() || null,
//       };
//     });
//   }





  // stripe


async handleStripeEvent(event: Stripe.Event) {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session =
        event.data.object as Stripe.Checkout.Session;

      if (session.payment_status !== 'paid') {
        return {
          received: true,
          pending: true,
        };
      }

      return this.markStripePaymentSuccessful(session);
    }

    case 'checkout.session.async_payment_succeeded': {
      const session =
        event.data.object as Stripe.Checkout.Session;

      return this.markStripePaymentSuccessful(session);
    }

    case 'checkout.session.expired': {
      const session =
        event.data.object as Stripe.Checkout.Session;

      return this.markStripePaymentFailed(
        session,
        'cancelled',
      );
    }

    case 'checkout.session.async_payment_failed': {
      const session =
        event.data.object as Stripe.Checkout.Session;

      return this.markStripePaymentFailed(
        session,
        'failed',
      );
    }

    default:
      return {
        received: true,
        ignored: true,
        eventType: event.type,
      };
  }
}





  async createStripeCheckoutSession(
  user: User,
  orderId: string,
) {
  const order = await this.orderRepo.findOne({
    where: { id: orderId },
    relations: {
      user: true,
      items: true,
    },
  });

  if (!order) {
    throw new NotFoundException('Order not found');
  }

  if (user.role !== 'admin' && order.user.id !== user.id) {
    throw new ForbiddenException('Not your order');
  }

  if (order.paymentMethod !== 'stripe') {
    throw new BadRequestException(
      'Order payment method is not Stripe',
    );
  }

  if (order.status === 'pending_verification') {
    throw new BadRequestException(
      'Order requires admin verification before payment',
    );
  }

  if (order.status !== 'awaiting_payment') {
    throw new BadRequestException(
      `Stripe payment cannot start for order status '${order.status}'`,
    );
  }

  if (!order.items?.length) {
    throw new BadRequestException('Order has no items');
  }

  const databaseIdempotencyKey = this.buildIdempotencyKey(
    order.id,
    'stripe',
  );

  let payment = await this.payRepo.findOne({
    where: {
      idempotencyKey: databaseIdempotencyKey,
    },
    relations: {
      order: true,
      user: true,
    },
  });

  const existingCheckoutUrl =
    payment?.providerMeta?.checkoutUrl || null;

  if (
    payment?.status === 'initiated' &&
    payment.providerPaymentId &&
    (this.stripeClient.isMock || existingCheckoutUrl)
  ) {
    return {
      paymentId: payment.id,
      provider: payment.provider,
      status: payment.status,
      checkoutSessionId: payment.providerPaymentId,
      checkoutUrl: this.stripeClient.isMock
        ? null
        : existingCheckoutUrl,
      mock: this.stripeClient.isMock,
      note: 'Existing Stripe session returned',
    };
  }

  if (payment?.status === 'success') {
    throw new BadRequestException('Order already paid');
  }

  const attempt =
    Number(payment?.providerMeta?.attempt || 0) + 1;

  if (!payment) {
    payment = this.payRepo.create({
      order,
      user: order.user,
      provider: 'stripe',
      status: 'initiated',
      amount: Number(order.total),
      currency: 'BDT',
      idempotencyKey: databaseIdempotencyKey,
      providerMeta: {
        attempt,
      },
    });
  } else {
    payment.status = 'initiated';
    payment.amount = Number(order.total);
    payment.currency = 'BDT';
    payment.user = order.user;
    payment.providerMeta = {
      ...(payment.providerMeta || {}),
      attempt,
    };
  }

  payment = await this.payRepo.save(payment);

  const currency = (
    process.env.STRIPE_CURRENCY || 'bdt'
  ).toLowerCase();

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] =
    order.items.map((item) => ({
      quantity: Number(item.quantity),
      price_data: {
        currency,
        unit_amount: this.toStripeMinorUnit(item.price),
        product_data: {
          name: (
            item.nameSnapshot ||
            item.variantLabel ||
            'Product'
          ).slice(0, 200),
        },
      },
    }));

  if (Number(order.deliveryCharge) > 0) {
    lineItems.push({
      quantity: 1,
      price_data: {
        currency,
        unit_amount: this.toStripeMinorUnit(
          order.deliveryCharge,
        ),
        product_data: {
          name: 'Delivery charge',
        },
      },
    });
  }

  const frontendUrl = this.getStripeFrontendUrl();

  const session = await this.stripeClient.client
    .checkout.sessions.create(
      {
        mode: 'payment',

        client_reference_id: order.id,

        customer_email: order.user.email,

        line_items: lineItems,

        metadata: {
          orderId: order.id,
          paymentId: payment.id,
        },

        payment_intent_data: {
          metadata: {
            orderId: order.id,
            paymentId: payment.id,
          },
        },

        success_url:
          `${frontendUrl}/checkout/success` +
          '?session_id={CHECKOUT_SESSION_ID}',

        cancel_url:
          `${frontendUrl}/checkout/cancel` +
          `?orderId=${encodeURIComponent(order.id)}`,

        expires_at:
          Math.floor(Date.now() / 1000) + 30 * 60,
      },
      {
        idempotencyKey:
          `stripe-checkout:${payment.id}:attempt:${attempt}`,
      },
    );

  payment.providerPaymentId = session.id;

  payment.providerMeta = {
    ...(payment.providerMeta || {}),
    attempt,
    checkoutUrl: session.url,
    expiresAt: session.expires_at,
    mock: this.stripeClient.isMock,
  };

  await this.payRepo.save(payment);

  return {
    paymentId: payment.id,
    provider: payment.provider,
    status: payment.status,
    checkoutSessionId: session.id,

    // Stripe Mock-এর URL real Checkout URL নয়
    checkoutUrl: this.stripeClient.isMock
      ? null
      : session.url,

    mock: this.stripeClient.isMock,
  };
}





async completeStripeMockPayment(
  user: User,
  paymentId: string,
) {
  this.ensureStripeMockEnabled();

  const payment = await this.payRepo.findOne({
    where: { id: paymentId },
    relations: {
      user: true,
      order: {
        user: true,
      },
    },
  });

  if (!payment) {
    throw new NotFoundException('Payment not found');
  }

  if (
    user.role !== 'admin' &&
    payment.user.id !== user.id
  ) {
    throw new ForbiddenException('Not your payment');
  }

  if (!payment.providerPaymentId) {
    throw new BadRequestException(
      'Stripe Checkout Session was not created',
    );
  }

const mockSession = {
  id: payment.providerPaymentId,
  status: 'complete',
  payment_status: 'paid',
  payment_intent: `pi_mock_${Date.now()}`,
  amount_total: this.toStripeMinorUnit(payment.amount),
  currency: payment.currency.toLowerCase(),
  metadata: {
    paymentId: payment.id,
    orderId: payment.order.id,
  },
} as unknown as Stripe.Checkout.Session;

  return this.markStripePaymentSuccessful(mockSession);
}

async expireStripeMockPayment(
  user: User,
  paymentId: string,
) {
  this.ensureStripeMockEnabled();

  const payment = await this.payRepo.findOne({
    where: { id: paymentId },
    relations: {
      user: true,
      order: {
        user: true,
      },
    },
  });

  if (!payment) {
    throw new NotFoundException('Payment not found');
  }

  if (
    user.role !== 'admin' &&
    payment.user.id !== user.id
  ) {
    throw new ForbiddenException('Not your payment');
  }

  if (!payment.providerPaymentId) {
    throw new BadRequestException(
      'Stripe Checkout Session was not created',
    );
  }

const mockSession = {
  id: payment.providerPaymentId,
  status: 'expired',
  payment_status: 'unpaid',
  amount_total: this.toStripeMinorUnit(payment.amount),
  currency: payment.currency.toLowerCase(),
  metadata: {
    paymentId: payment.id,
    orderId: payment.order.id,
  },
} as unknown as Stripe.Checkout.Session;

  return this.markStripePaymentFailed(
    mockSession,
    'cancelled',
  );
}
}
