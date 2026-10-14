import { Controller, Delete, Param, Put } from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { BookmarksService } from './bookmarks.service';

@Controller('community/boards/:id/bookmark')
export class BookmarksController {
  constructor(private readonly bookmarksService: BookmarksService) {}

  @Put()
  add(@Param('id') boardId: string, @Session() session: UserSession) {
    return this.bookmarksService.add(boardId, session.user.id);
  }

  @Delete()
  remove(@Param('id') boardId: string, @Session() session: UserSession) {
    return this.bookmarksService.remove(boardId, session.user.id);
  }
}
