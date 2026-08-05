import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../orders/order.entity';


@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(Order) private orderRepo: Repository<Order>,
  ) {}

  // Get Dashboard Overview: total orders and fraud flagged orders
  async getDashboardOverview() {
    const totalOrders = await this.orderRepo.count();
    const fraudFlaggedOrders = await this.orderRepo.count({ where: { fraudFlag: true } });

    return {
      totalOrders,
      fraudFlaggedOrders,
    };
  }

  // Admin Only: Fraudulent Orders
  async getFraudFlaggedOrders() {
    return this.orderRepo.find({
      where: { fraudFlag: true },
      relations: ['user', 'items'],
      order: { createdAt: 'DESC' },
    });
  }

  // Admin Update Status: Update order status
  // async adminUpdateStatus(orderId: string, status: OrderStatus) {
  //   const order = await this.orderRepo.findOne({ where: { id: orderId } });

  //   if (!order) throw new NotFoundException('Order not found');

  //   // Ensure the status is a valid 'OrderStatus'
  //   const validStatuses: OrderStatus[] = [
  //     'pending', 'awaiting_payment', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'failed'
  //   ];

  //   if (!validStatuses.includes(status)) {
  //     throw new ForbiddenException('Invalid status');
  //   }

  //   order.status = status;  // Update the status
  //   return this.orderRepo.save(order);  // Save the updated order
  // }

  // Fraud Detection (same as you already have)
  // private async detectFraud(order: Order, userIp: string, userAgent: string) {
  //   if (order.fraudFlag) {
  //     throw new ForbiddenException('Order is flagged as fraudulent');
  //   }

  //   const similarOrders = await this.orderRepo.count({
  //     where: { ipAddress: userIp, status: 'pending' },
  //   });

  //   if (similarOrders > 5) {
  //     order.fraudFlag = true;
  //     await this.orderRepo.save(order);
  //     throw new ForbiddenException('Multiple orders detected from the same IP');
  //   }

  //   const recentOrders = await this.orderRepo
  //     .createQueryBuilder('order')
  //     .where('order.userId = :userId', { userId: order.user.id })
  //     .andWhere('order.createdAt > NOW() - INTERVAL \'10 minutes\'')
  //     .getCount();

  //   if (recentOrders > 3) {
  //     order.fraudFlag = true;
  //     await this.orderRepo.save(order);
  //     throw new ForbiddenException('Multiple orders detected in a short period');
  //   }

  //   const similarUserAgentOrders = await this.orderRepo.count({
  //     where: {
  //       ipAddress: userIp,
  //       userAgent: userAgent,
  //       status: 'pending',
  //     },
  //   });

  //   if (similarUserAgentOrders > 3) {
  //     order.fraudFlag = true;
  //     await this.orderRepo.save(order);
  //     throw new ForbiddenException('Suspicious user agent pattern detected');
  //   }

  //   order.ipAddress = userIp;
  //   order.userAgent = userAgent;
  //   await this.orderRepo.save(order);

  //   return false;
  // }
}