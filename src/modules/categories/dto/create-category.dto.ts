import { IsBoolean, IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  @Length(2, 120)
  name: string;

  @IsString()
  @Length(2, 160)
  slug: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
