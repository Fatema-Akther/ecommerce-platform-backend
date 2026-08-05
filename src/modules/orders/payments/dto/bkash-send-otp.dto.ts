import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class BkashSendOtpDto {
  @IsString()
  @IsNotEmpty()
  orderId!: string;

  @IsString()
  @Matches(/^01\d{9}$/) 
  phone!: string;
}
