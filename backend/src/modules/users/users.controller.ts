import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Put,
  Query,
} from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('search')
  searchUsers(@Query('q') q: string) {
    if (!q || !q.trim()) return [];
    return this.usersService.searchUsers(q.trim());
  }

  @Get('me/profile')
  getMyProfile(@Session() session: UserSession) {
    return this.usersService.getOrCreateProfile(session.user.id);
  }

  @Patch('me/profile')
  updateMyProfile(
    @Body() dto: UpdateProfileDto,
    @Session() session: UserSession,
  ) {
    return this.usersService.updateProfile(session.user.id, dto);
  }

  @Get(':userId/profile')
  getPublicProfile(
    @Param('userId') userId: string,
    @Session() session: UserSession,
  ) {
    return this.usersService.getPublicProfileByUserId(userId, session.user.id);
  }

  @Put(':userId/follow')
  followUser(@Param('userId') userId: string, @Session() session: UserSession) {
    return this.usersService.followUser(session.user.id, userId);
  }

  @Delete(':userId/follow')
  unfollowUser(
    @Param('userId') userId: string,
    @Session() session: UserSession,
  ) {
    return this.usersService.unfollowUser(session.user.id, userId);
  }

  @Get(':userId/following')
  getFollowing(@Param('userId') userId: string) {
    return this.usersService.getFollowing(userId);
  }

  @Get(':userId/followers')
  getFollowers(@Param('userId') userId: string) {
    return this.usersService.getFollowers(userId);
  }
}
