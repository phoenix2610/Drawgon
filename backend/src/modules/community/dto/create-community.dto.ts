import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateCommunityDto {
  @IsString()
  @MinLength(3)
  @MaxLength(32)
  slug!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
