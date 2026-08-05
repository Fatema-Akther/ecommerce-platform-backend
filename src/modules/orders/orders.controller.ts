import { Body, Controller, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { OrdersService } from './orders.service';
import { CheckoutDto } from './dto/checkout.dto';
import { ReviewOrderDto } from './dto/review-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';

@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly service: OrdersService) {}

  // Customer Checkout
  @Post('checkout')
  checkout(@Request() req: any, @Body() dto: CheckoutDto) {
    const userIp = req.headers['x-forwarded-for']?.split(',')[0] || req.ip;
    const userAgent = req.headers['user-agent'] || '';
    return this.service.checkout(req.user, dto, userIp, userAgent);
  }

  // Customer Orders
  @Get('my')
  my(@Request() req: any) {
    return this.service.myOrders(req.user);
  }

 

  // =================== ADMIN ROUTES ===================
  @UseGuards(RolesGuard)
  @Roles('admin')
  @Get('admin/all')
  getAllForAdmin() {
    return this.service.getAllOrdersForAdmin();
  }

  @UseGuards(RolesGuard)
  @Roles('admin')
  @Get('admin/pending-verification')
  getPendingVerificationOrders() {
    return this.service.getPendingVerificationOrders();
  }

@UseGuards(RolesGuard)
@Roles('admin')
@Post('admin/:orderId/review')
reviewOrder(
  @Request() req: any,
  @Param('orderId') orderId: string,
  @Body() dto: ReviewOrderDto,
) {
  return this.service.reviewOrder(req.user, orderId, dto);
}


 @UseGuards(RolesGuard)
@Roles('admin')
@Post('admin/:orderId/status')
updateStatus(
  @Request() req: any,
  @Param('orderId') orderId: string,
  @Body() dto: UpdateOrderStatusDto,
) {
  return this.service.updateOrderStatus(
    req.user,
    orderId,
    dto,
  );
}




@UseGuards(RolesGuard)
@Roles('admin')
@Get('admin/:orderId') // ✅ এখানে :orderId path param
getOneForAdmin(@Param('orderId') orderId: string) {
  return this.service.getOneForAdmin(orderId);
}



@Get(':orderId')
one(
  @Request() req: any,
  @Param('orderId') orderId: string,
) {
  return this.service.getOneForUser(
    req.user,
    orderId,
  );
}







}