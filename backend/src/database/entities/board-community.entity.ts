import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Board } from './board.entity';
import { Community } from './community.entity';

@Entity('board_communities')
@Unique('UQ_board_communities_board_community', ['boardId', 'communityId'])
export class BoardCommunity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'board_id' })
  boardId!: string;

  @ManyToOne(() => Board, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'board_id', foreignKeyConstraintName: 'FK_board_communities_board' })
  board!: Board;

  @Column({ type: 'uuid', name: 'community_id' })
  communityId!: string;

  @ManyToOne(() => Community, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'community_id',
    foreignKeyConstraintName: 'FK_board_communities_community',
  })
  community!: Community;
}
