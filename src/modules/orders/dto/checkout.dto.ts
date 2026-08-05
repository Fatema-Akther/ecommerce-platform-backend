import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';


class DirectCheckoutItemDto {
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;

  @IsOptional()
  @IsString()
  variantId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  variantLabel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  image?: string;



    @IsOptional()
  @IsArray()
  @IsString({ each: true })
  selectedOptionIds?: string[];

  @IsOptional()
  @IsObject()
  selectedOptions?: Record<string, string>;
}

export class CheckoutDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(120)
  fullName!: string;

  @IsString()
@IsNotEmpty()
@MaxLength(30)
phone!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(12)
  @MaxLength(500)
  address!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @IsOptional()
  @IsString()
@IsIn([
 'cod',
 'stripe'
])
paymentMethod?: 
'cod' | 'stripe';



   @IsOptional()
  @ValidateNested()
  @Type(() => DirectCheckoutItemDto)
  directItem?: DirectCheckoutItemDto;




  @IsString()
@IsNotEmpty()
@MaxLength(100)
city!: string;


@IsString()
@IsNotEmpty()
@MaxLength(100)
state!: string;


@IsString()
@IsNotEmpty()
@MaxLength(20)
postalCode!: string;


@IsString()
@IsNotEmpty()
@MaxLength(2)
country!: string;





@IsOptional()
@IsNumber()
shippingCost?: number;


@IsOptional()
@IsString()
shippingMethod?: string;


@IsOptional()
@IsString()
shippingRateId?: string;


@IsOptional()
@IsObject()
shippingRate?: Record<string, any>;

@IsOptional()
shippingPayload?: any;
  
}