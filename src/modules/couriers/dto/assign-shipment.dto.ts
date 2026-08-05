import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { COURIER_SHIPMENT_STATUSES } from '../courier.types';
import type { CourierShipmentStatus } from '../courier.types';

export class AssignShipmentDto {
  @IsUUID()
  courierProviderId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  trackingNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  consignmentId?: string;

  @IsOptional()
  @IsIn(COURIER_SHIPMENT_STATUSES)
  courierStatus?: CourierShipmentStatus;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  codAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  deliveryCharge?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  // ✅ Add pickupAddress here
  @IsOptional()
  @IsString()
  @MaxLength(255)
  pickupAddress?: string;
}