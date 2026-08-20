import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SetBoardCommunityDto {
  /** Community handle, or null to unfile the board. */
  @IsOptional()
  @IsString()
  @MaxLength(32)
  slug!: string | null;
}
