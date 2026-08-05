import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/modules/auth/jwt-auth.guard';
import { PaymentsService } from './payments.service';



@UseGuards(JwtAuthGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly service: PaymentsService) {}

  // =====================================================
  // 1️⃣ COD PAYMENT (keep old – stable)
  // POST /payments/cod/:orderId
  // =====================================================
  @Post('cod/:orderId')
  cod(
    @Request() req: any,
    @Param('orderId') orderId: string,
  ) {
    return this.service.initiate(req.user, orderId, 'cod');
  }

  


  
  @Get(':paymentId/status')
  status(
    @Request() req: any,
    @Param('paymentId') paymentId: string,
  ) {
    return this.service.getPaymentStatus(
      req.user,
      paymentId,
    );
  }

  // =====================================================
  // 6️⃣ UNIFIED INITIATE (future-proof ⭐)
  // POST /payments/initiate
  // provider: cod | bkash_mock | bkash_real
  // =====================================================
 @Post('initiate')
initiateUnified(
  @Request() req: any,
  @Body()
  body: {
    orderId: string;
    provider: 'cod' | 'stripe';
  },
) {
  return this.service.initiate(
    req.user,
    body.orderId,
    body.provider,
  );
}
@Post('stripe/checkout-session/:orderId')
createStripeCheckoutSession(
  @Request() req: any,
  @Param('orderId') orderId: string,
) {
  return this.service.createStripeCheckoutSession(
    req.user,
    orderId,
  );
}

@Post('stripe/mock/complete/:paymentId')
completeStripeMockPayment(
  @Request() req: any,
  @Param('paymentId') paymentId: string,
) {
  return this.service.completeStripeMockPayment(
    req.user,
    paymentId,
  );
}

@Post('stripe/mock/expire/:paymentId')
expireStripeMockPayment(
  @Request() req: any,
  @Param('paymentId') paymentId: string,
) {
  return this.service.expireStripeMockPayment(
    req.user,
    paymentId,
  );
}
   
}
