import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

/** Roughly 1MB of base64 — generous for a 320px preview, tight enough to
 *  reject someone posting a full-resolution export. */
const MAX_THUMBNAIL_CHARS = 1_000_000;

export class UpdateBoardSnapshotDto {
  @IsObject()
  snapshot!: Record<string, unknown>;

  /** Data-URL preview rendered by the client alongside the snapshot. */
  @IsOptional()
  @IsString()
  @MaxLength(MAX_THUMBNAIL_CHARS)
  thumbnail?: string;
}
