import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { Order } from 'src/modules/orders/order.entity';
import { User } from 'src/modules/users/user.entity';
import { OrderShipment } from 'src/modules/couriers/order-shipment.entity';
import { Product } from 'src/modules/products/product.entity';


@Module({
  imports: [TypeOrmModule.forFeature([Order, User, Product, OrderShipment])],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}