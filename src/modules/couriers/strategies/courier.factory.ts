import { Injectable, BadRequestException } from '@nestjs/common';

import { ShippoService } from './shippo.service';
import { CourierStrategy } from './courier.strategy';

@Injectable()
export class CourierFactory {
  constructor(
    private readonly shippoService: ShippoService,
  ) {}

  get(code: string): CourierStrategy {
    switch (code) {
      case 'shippo':
        return this.shippoService;

      default:
        throw new BadRequestException(
          `Unsupported courier: ${code}`,
        );
    }
  }
}