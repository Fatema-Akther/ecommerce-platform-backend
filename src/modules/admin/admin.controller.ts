// import { Controller, Get, Patch, Param, Body, BadRequestException, UseGuards } from '@nestjs/common';
// import { AdminService } from './admin.service';
// import { Roles } from '../auth/roles.decorator';
// import { RolesGuard } from '../auth/roles.guard';
// import { OrderStatus } from '../orders/order.entity';

// @Controller('admin')
// @UseGuards(RolesGuard)
// export class AdminController {
//   constructor(private readonly adminService: AdminService) {}

//   // Dashboard overview
//   @Roles('admin')
//   @Get('dashboard')
//   dashboard() {
//     return this.adminService.getDashboardOverview();
//   }

//   // Fraud flagged orders
//   @Roles('admin')
//   @Get('fraud-flagged')
//   fraudFlaggedOrders() {
//     return this.adminService.getFraudFlaggedOrders();
//   }

//   // Admin can update order status
//   @Roles('admin')
//   @Patch('admin/:orderId/status')
//   adminUpdate(
//     @Param('orderId') orderId: string,
//     @Body() body: { status: string },
//   ) {
//     const validStatuses: OrderStatus[] = ['pending', 'awaiting_payment', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'failed'];

//     // Ensure the status is valid
//     if (!validStatuses.includes(body.status as OrderStatus)) {
//       throw new BadRequestException('Invalid order status');
//     }

//     return this.adminService.adminUpdateStatus(orderId, body.status as OrderStatus);  // Call the service to update status
//   }
// }


import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Request,
  UseGuards,
} from '@nestjs/common';

import { AdminService } from './admin.service';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OrdersService } from '../orders/orders.service';
import { UpdateOrderStatusDto } from '../orders/dto/update-order-status.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly ordersService: OrdersService,
  ) {}

  @Roles('admin')
  @Get('dashboard')
  dashboard() {
    return this.adminService.getDashboardOverview();
  }

  @Roles('admin')
  @Get('fraud-flagged')
  fraudFlaggedOrders() {
    return this.adminService.getFraudFlaggedOrders();
  }

  @Roles('admin')
  @Patch('orders/:orderId/status')
  adminUpdate(
    @Request() req: any,
    @Param('orderId') orderId: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.ordersService.updateOrderStatus(
      req.user,
      orderId,
      dto,
    );
  }
}