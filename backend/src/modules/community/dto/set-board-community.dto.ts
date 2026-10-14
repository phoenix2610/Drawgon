import { IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

export class SetBoardCommunityDto {
  @IsOptional()
  @IsString()
  @MaxLength(32)
  slug!: string | null;
}

export class SetBoardCommunitiesDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(32, { each: true })
  slugs!: string[];
}
