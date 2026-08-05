import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { COURIER_SHIPMENT_STATUSES } from '../courier.types';
import type { CourierShipmentStatus } from '../courier.types';

export class UpdateShipmentStatusDto {
  @IsIn(COURIER_SHIPMENT_STATUSES)
  courierStatus!: CourierShipmentStatus;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  trackingNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  consignmentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}