import { IsIn, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class ManualBkashReviewDto {
  @IsString()
  @IsNotEmpty()
  paymentId!: string;

  @IsString()
  @IsIn(['approve', 'reject'])
  action!: 'approve' | 'reject';

  @IsOptional()
  @IsString()
  @MinLength(2)
  note?: string;
}