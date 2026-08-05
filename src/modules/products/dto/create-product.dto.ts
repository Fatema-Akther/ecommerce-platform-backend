import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
  ValidateNested,
  IsNotEmptyObject,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';

class MediaDto {
  @IsIn(['image', 'video', 'youtube'])
  type!: 'image' | 'video' | 'youtube';

  @IsString()
  url!: string;

  @IsOptional()
  @IsString()
  publicId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  position?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  width?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  height?: number;

  @IsOptional()
  @IsString()
  format?: string;
}

class VariantDto {
  @IsObject()
  @IsNotEmptyObject()
  options!: Record<string, string>;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  extraPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  stock?: number;

  

  @IsOptional()
@IsString()
@Matches(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/, {
  message: 'Color code must be a valid hex code',
})
colorCode?: string;
}

export class CreateProductDto {
  @IsString()
  @Length(2, 180)
  name!: string;

  @IsOptional()
@IsString()
@Length(2, 200)
slug?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  discountPrice?: number;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  stock?: number;

  @IsUUID()
  categoryId!: string;

  @IsOptional()
  @IsIn(['new', 'used', 'refurbished'])
  condition?: 'new' | 'used' | 'refurbished';

  @IsOptional()
  @IsBoolean()
  isFlashDeal?: boolean;

  @IsOptional()
  @IsString()
  flashStartAt?: string;

  @IsOptional()
  @IsString()
  flashEndAt?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MediaDto)
  media?: MediaDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VariantDto)
  variants?: VariantDto[];



  @IsOptional()
@Type(() => Number)
@IsNumber()
@Min(0)
weight?: number;


@IsOptional()
@Type(() => Number)
@IsNumber()
@Min(0)
length?: number;


@IsOptional()
@Type(() => Number)
@IsNumber()
@Min(0)
width?: number;


@IsOptional()
@Type(() => Number)
@IsNumber()
@Min(0)
height?: number;
}