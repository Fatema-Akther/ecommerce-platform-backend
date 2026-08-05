import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { COURIER_MODES } from '../courier.types';
import type { CourierMode } from '../courier.types';
import { ApiConfigDto } from './api-config.dto';
import { Type } from 'class-transformer';

export class UpdateCourierProviderDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  code?: string;

  @IsOptional()
  @IsIn(COURIER_MODES)
  mode?: CourierMode;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  websiteUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  trackingUrlPattern?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isApiEnabled?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;


  @IsOptional()
@ValidateNested()
@Type(() => ApiConfigDto)
apiConfig?: ApiConfigDto;
}