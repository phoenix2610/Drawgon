import { IsIn } from 'class-validator';
import { BoardVisibility } from '../../../database/entities/board.entity';

export class UpdateBoardVisibilityDto {
  @IsIn([BoardVisibility.PRIVATE, BoardVisibility.PUBLIC])
  visibility!: BoardVisibility;
}
