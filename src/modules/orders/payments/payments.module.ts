import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { PaymentsService } from "./payments.service";
import { PaymentsController } from "./payments.controller";
import { Order } from "../order.entity";
import { Payment } from "./payment.entity";
import { OrdersModule } from "../orders.module";
import { StripeWebhookController } from "./stripe-webhook.controller";
import { StripeClientService } from "./stripe-client.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment, Order]),

     OrdersModule,
  ],
  providers: [PaymentsService,  StripeClientService,],
  controllers: [PaymentsController ,StripeWebhookController,],
})
export class PaymentsModule {}
