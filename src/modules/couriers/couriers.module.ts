// src/modules/couriers/couriers.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CouriersController } from './couriers.controller';
import { CouriersService } from './couriers.service';
import { CourierProvider } from './courier-provider.entity';
import { OrderShipment } from './order-shipment.entity';
import { Order } from '../orders/order.entity';
import { Product } from '../products/product.entity';
import { ProductVariant } from '../products/product-variant.entity';

import { CourierFactory } from './strategies/courier.factory';

import { CourierWebhookController } from './webhook.controller';
import { ShippoService } from './strategies/shippo.service';
import { ShippingController } from './shipping.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CourierProvider,
      OrderShipment,
      Order,
      Product,
      ProductVariant,
    ]),
   
  ],
  controllers: [CouriersController,  ShippingController, CourierWebhookController],
  providers: [CouriersService, CourierFactory ,ShippoService],
  exports: [CouriersService],
})
export class CouriersModule {}