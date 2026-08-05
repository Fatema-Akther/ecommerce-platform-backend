

import { IsString, MinLength } from 'class-validator';

export class ApiConfigDto {
  @IsString()
  @MinLength(3)
  keyRef!: string;
}