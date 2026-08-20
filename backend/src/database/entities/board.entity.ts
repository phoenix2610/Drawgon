import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Community } from './community.entity';

export enum BoardVisibility {
  PRIVATE = 'private',
  PUBLIC = 'public',
}

@Entity('boards')
export class Board {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'text', name: 'owner_id' })
  ownerId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'owner_id', foreignKeyConstraintName: 'FK_boards_owner' })
  owner?: User;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({
    type: 'enum',
    enum: BoardVisibility,
    default: BoardVisibility.PRIVATE,
  })
  visibility!: BoardVisibility;

  /** Community this board is posted to; null means it is unfiled. */
  @Index()
  @Column({ type: 'uuid', name: 'community_id', nullable: true })
  communityId!: string | null;

  @ManyToOne(() => Community, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({
    name: 'community_id',
    foreignKeyConstraintName: 'FK_boards_community',
  })
  community?: Community | null;

  @Column({ type: 'jsonb', default: {} })
  snapshot!: Record<string, unknown>;

  /** Small data-URL preview rendered client-side; `text` because data URLs
   *  routinely exceed varchar's default length. */
  @Column({ type: 'text', name: 'thumbnail_url', nullable: true })
  thumbnailUrl!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
