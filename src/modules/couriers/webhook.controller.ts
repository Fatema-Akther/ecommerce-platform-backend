import { Body, Controller, Headers, Post } from '@nestjs/common';
import { CouriersService } from './couriers.service';

@Controller('webhooks/couriers')
export class CourierWebhookController {
  constructor(private readonly service: CouriersService) {}

  @Post('steadfast')
  async steadfastWebhook(
    @Body() body: any,
    @Headers('authorization') authorization: string,
    @Headers('x-signature') signature: string,
  ) {
    return this.service.handleSteadfastWebhook(
      body,
      authorization || signature,
    );
  }
//shipp

@Post('shippo')
  async shippoWebhook(
    @Body() body: any,
    @Headers('shippo-signature') signature: string,
  ) {

     console.log(
    'SHIPPO WEBHOOK RECEIVED:',
    JSON.stringify(body, null, 2),
  );

  console.log(
    'SHIPPO SIGNATURE:',
    signature ?? 'not-provided',
  );

    return this.service.handleShippoWebhook(
      body,
      signature,
    );
  }
}