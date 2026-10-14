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
import { BoardsService } from './boards.service';
import { CreateBoardDto } from './dto/create-board.dto';
import { UpdateBoardThumbnailDto } from './dto/update-board-thumbnail.dto';
import { UpdateBoardVisibilityDto } from './dto/update-board-visibility.dto';
import { RenameBoardDto } from './dto/rename-board.dto';
import { PublishBoardDto } from './dto/publish-board.dto';

@Controller('boards')
export class BoardsController {
  constructor(private readonly boardsService: BoardsService) {}

  @Get()
  list(@Session() session: UserSession) {
    return this.boardsService.listByOwner(session.user.id);
  }

  @Get('shared')
  listShared(@Session() session: UserSession) {
    return this.boardsService.listSharedWith(session.user.id);
  }

  @Get('posts')
  listPosts(@Session() session: UserSession) {
    return this.boardsService.listPostsByOwner(session.user.id);
  }

  @Get(':id/post')
  getPost(@Param('id') id: string, @Session() session: UserSession) {
    return this.boardsService.getPost(id, session.user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Session() session: UserSession) {
    return this.boardsService.findAccessible(id, session.user.id);
  }

  @Post()
  create(@Body() dto: CreateBoardDto, @Session() session: UserSession) {
    return this.boardsService.create(session.user.id, dto);
  }

  @Patch(':id/thumbnail')
  @HttpCode(204)
  updateThumbnail(
    @Param('id') id: string,
    @Body() dto: UpdateBoardThumbnailDto,
    @Session() session: UserSession,
  ) {
    return this.boardsService.updateThumbnail(id, session.user.id, dto);
  }

  @Patch(':id/title')
  rename(
    @Param('id') id: string,
    @Body() dto: RenameBoardDto,
    @Session() session: UserSession,
  ) {
    return this.boardsService.rename(id, session.user.id, dto);
  }

  @Patch(':id/visibility')
  updateVisibility(
    @Param('id') id: string,
    @Body() dto: UpdateBoardVisibilityDto,
    @Session() session: UserSession,
  ) {
    return this.boardsService.updateVisibility(id, session.user.id, dto);
  }

  @Post(':id/publish')
  publish(
    @Param('id') id: string,
    @Body() dto: PublishBoardDto,
    @Session() session: UserSession,
  ) {
    return this.boardsService.publish(id, session.user.id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Session() session: UserSession) {
    return this.boardsService.remove(id, session.user.id);
  }
}
