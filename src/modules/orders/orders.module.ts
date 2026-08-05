import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from './order.entity';
import { OrderItem } from './order-item.entity';

import { Cart } from '../cart/cart.entity';
import { CartItem } from '../cart/cart-item.entity';
import { Product } from '../products/product.entity';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { Payment } from './payments/payment.entity';
import { ProductVariant } from '../products/product-variant.entity';
import { CouriersModule } from '../couriers/couriers.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem, Cart, CartItem, Product,Payment, ProductVariant]),
        CouriersModule,
  ],
  providers: [OrdersService],
  controllers: [OrdersController],
  exports: [OrdersService],
})
export class OrdersModule {}
