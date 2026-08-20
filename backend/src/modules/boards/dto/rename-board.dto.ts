import { IsString, MaxLength, MinLength } from 'class-validator';

export class RenameBoardDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title!: string;
}
