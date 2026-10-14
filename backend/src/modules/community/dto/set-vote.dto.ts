import { IsIn } from 'class-validator';

export class SetVoteDto {
  @IsIn([1, -1])
  value!: 1 | -1;
}
