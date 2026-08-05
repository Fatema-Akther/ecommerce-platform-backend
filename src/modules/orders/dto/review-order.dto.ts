import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewOrderDto {
  @IsString()
  @IsIn(['approve', 'reject'])
  action!: 'approve' | 'reject';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}