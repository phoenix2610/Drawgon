import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { CollaboratorsService } from './collaborators.service';
import {
  InviteCollaboratorDto,
  InviteLinkDto,
  UpdateCollaboratorDto,
} from './dto/collaborator.dto';

@Controller('boards')
export class CollaboratorsController {
  constructor(private readonly collabsService: CollaboratorsService) {}

  @Post(':boardId/collaborators')
  inviteCollaborator(
    @Param('boardId') boardId: string,
    @Body() dto: InviteCollaboratorDto,
    @Session() session: UserSession,
  ) {
    return this.collabsService.invite(
      boardId,
      session.user.id,
      { username: dto.username, email: dto.email },
      dto.role ?? 'editor',
    );
  }

  @Patch(':boardId/collaborators/:userId')
  updateCollaborator(
    @Param('boardId') boardId: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateCollaboratorDto,
    @Session() session: UserSession,
  ) {
    return this.collabsService.updateRole(
      boardId,
      session.user.id,
      userId,
      dto.role,
    );
  }

  @Delete(':boardId/collaborators/:userId')
  @HttpCode(204)
  removeCollaborator(
    @Param('boardId') boardId: string,
    @Param('userId') userId: string,
    @Session() session: UserSession,
  ) {
    return this.collabsService.remove(boardId, session.user.id, userId);
  }

  @Get(':boardId/collaborators')
  getCollaborators(
    @Param('boardId') boardId: string,
    @Session() session: UserSession,
  ) {
    return this.collabsService.list(boardId, session.user.id);
  }

  @Post(':boardId/collaborators/invite-link')
  generateInviteLink(
    @Param('boardId') boardId: string,
    @Body() dto: InviteLinkDto,
    @Session() session: UserSession,
  ) {
    return this.collabsService.generateInviteLink(
      boardId,
      session.user.id,
      dto.role ?? 'editor',
    );
  }

  @Post('join/:token')
  joinViaToken(@Param('token') token: string, @Session() session: UserSession) {
    return this.collabsService.joinViaToken(token, session.user.id);
  }
}
