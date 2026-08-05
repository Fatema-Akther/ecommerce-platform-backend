import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateOrderStatusDto {
  @IsString()
  @IsIn(['processing', 'shipped', 'delivered', 'completed', 'cancelled' ,'failed','refunded'])
  status!: 'processing' | 'shipped' | 'delivered' | 'completed' | 'cancelled'|'failed'|
    'refunded';

  @IsOptional()
  @IsString()
  @MinLength(2)
  note?: string;
}