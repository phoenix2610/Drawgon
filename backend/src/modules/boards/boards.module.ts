import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Board } from '../../database/entities/board.entity';
import { BoardCollaborator } from '../../database/entities/board-collaborator.entity';
import { User } from '../../database/entities/user.entity';
import { UserProfile } from '../../database/entities/user-profile.entity';
import { BoardsController } from './boards.controller';
import { BoardsService } from './boards.service';
import { BoardAccessService } from './board-access.service';
import { CollaboratorsController } from './collaborators.controller';
import { CollaboratorsService } from './collaborators.service';
import { BoardSyncService } from './sync/board-sync.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Board, BoardCollaborator, User, UserProfile]),
  ],
  controllers: [BoardsController, CollaboratorsController],
  providers: [
    BoardsService,
    BoardAccessService,
    CollaboratorsService,
    BoardSyncService,
  ],
  exports: [BoardAccessService, BoardSyncService],
})
export class BoardsModule {}
