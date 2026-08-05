import {
  Body,
  Controller,
  Post,
} from '@nestjs/common';

import { CouriersService } from './couriers.service';


@Controller('shipping')
export class ShippingController {

  constructor(
    private readonly couriersService: CouriersService,
  ) {}


  @Post('rates')
  getShippingRates(
    @Body() orderData: any,
  ) {
    return this.couriersService.getShippingRates(orderData);
  }

}