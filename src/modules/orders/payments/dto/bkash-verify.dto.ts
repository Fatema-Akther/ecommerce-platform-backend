import { IsNotEmpty, IsString, Length } from 'class-validator';

export class BkashVerifyDto {
  @IsString()
  @IsNotEmpty()
  paymentId: string;

  @IsString()
  @Length(6, 6)
  otp: string;
}
