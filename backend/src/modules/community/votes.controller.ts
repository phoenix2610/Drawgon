import { Body, Controller, Delete, Param, Put } from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { VotesService } from './votes.service';
import { SetVoteDto } from './dto/set-vote.dto';

@Controller('community/boards/:id/vote')
export class VotesController {
  constructor(private readonly votesService: VotesService) {}

  @Put()
  setVote(
    @Param('id') boardId: string,
    @Body() dto: SetVoteDto,
    @Session() session: UserSession,
  ) {
    return this.votesService.setVote(boardId, session.user.id, dto.value);
  }

  @Delete()
  removeVote(@Param('id') boardId: string, @Session() session: UserSession) {
    return this.votesService.removeVote(boardId, session.user.id);
  }
}
