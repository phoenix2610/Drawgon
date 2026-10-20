import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { Board } from './board.entity';
import { User } from './user.entity';

export type CollaboratorRole = 'editor' | 'viewer';

@Entity('board_collaborators')
export class BoardCollaborator {
  @PrimaryColumn({ type: 'uuid', name: 'board_id' })
  boardId!: string;

  @PrimaryColumn({ type: 'text', name: 'user_id' })
  userId!: string;

  @Column({ type: 'varchar', length: 20, default: 'editor' })
  role!: CollaboratorRole;

  @Column({ type: 'timestamptz', name: 'last_opened_at', nullable: true })
  lastOpenedAt!: Date | null;

  @ManyToOne(() => Board, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'board_id' })
  board?: Board;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
