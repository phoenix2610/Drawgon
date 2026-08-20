import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateCommunityDto {
  // Shape is checked in CommunitiesService, which owns the reserved-word list
  // and the exact handle grammar.
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
