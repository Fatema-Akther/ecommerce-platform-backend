import { IsNotEmpty, IsString } from 'class-validator';

export class BkashResendOtpDto {
  @IsString()
  @IsNotEmpty()
  paymentId: string;
}
