import { IsString, MaxLength } from 'class-validator';

const MAX_THUMBNAIL_CHARS = 1_000_000;

export class UpdateBoardThumbnailDto {
  @IsString()
  @MaxLength(MAX_THUMBNAIL_CHARS)
  thumbnail!: string;
}
