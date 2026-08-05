import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CouriersService } from './couriers.service';
import { CreateCourierProviderDto } from './dto/create-courier-provider.dto';
import { UpdateCourierProviderDto } from './dto/update-courier-provider.dto';
import { AssignShipmentDto } from './dto/assign-shipment.dto';
import { UpdateShipmentStatusDto } from './dto/update-shipment-status.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin/couriers')
export class CouriersController {
  constructor(private readonly service: CouriersService) {}

  // Courier Providers
  @Get()
  getCourierProviders() {
    return this.service.getCourierProviders();
  }

  @Post()
  createCourierProvider(@Body() dto: CreateCourierProviderDto) {
    return this.service.createCourierProvider(dto);
  }

  @Patch(':id')
  updateCourierProvider(@Param('id') id: string, @Body() dto: UpdateCourierProviderDto) {
    return this.service.updateCourierProvider(id, dto);
  }

  // Shipment assignment (API-first with manual fallback)
  @Post('orders/:orderId/assign')
  assignShipment(@Param('orderId') orderId: string, @Body() dto: AssignShipmentDto) {
    return this.service.assignShipment(orderId, dto);
  }



  @Post('shipping-rates')
getShippingRates(
  @Body() orderData:any,
) {

  return this.service.getShippingRates(
    orderData,
  );

}

  @Post('orders/:orderId/create-label')
createLabel(
  @Param('orderId') orderId: string,
  @Body() dto: { rateId: string },
) {
  return this.service.createLabel(orderId, dto.rateId);
}


  // Manual shipment status update (only for non-API couriers)
  @Patch('shipments/:shipmentId/status')
  updateShipmentStatus(@Param('shipmentId') shipmentId: string, @Body() dto: UpdateShipmentStatusDto) {
    return this.service.updateShipmentStatus(shipmentId, dto);
  }


  @Patch('shipments/:shipmentId/rate')
updateShipmentRate(
  @Param('shipmentId') shipmentId: string,
  @Body() dto: { rateId: string },
) {
  return this.service.updateShipmentRate(
    shipmentId,
    dto.rateId,
  );
}
 
}