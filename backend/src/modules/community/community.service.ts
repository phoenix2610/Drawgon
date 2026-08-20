import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, In, Repository } from 'typeorm';
import { Board, BoardVisibility } from '../../database/entities/board.entity';
import { VotesService } from './votes.service';
import { CommentsService } from './comments.service';
import { BookmarksService } from './bookmarks.service';

export interface FeedItem {
  id: string;
  title: string;
  ownerId: string;
  ownerName: string;
  thumbnailUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  score: number;
  myVote: number | null;
  commentCount: number;
  bookmarked: boolean;
}

// Single-board detail view only — the feed list deliberately omits the
// (potentially large) snapshot blob for every board it lists.
export interface FeedItemDetail extends FeedItem {
  snapshot: Record<string, unknown>;
}

@Injectable()
export class CommunityService {
  constructor(
    @InjectRepository(Board)
    private readonly boardsRepository: Repository<Board>,
    private readonly votesService: VotesService,
    private readonly commentsService: CommentsService,
    private readonly bookmarksService: BookmarksService,
  ) {}

  async listFeed(currentUserId: string, query?: string): Promise<FeedItem[]> {
    const term = query?.trim();
    const boards = await this.boardsRepository.find({
      where: {
        visibility: BoardVisibility.PUBLIC,
        ...(term ? { title: ILike(`%${term}%`) } : {}),
      },
      relations: { owner: true },
      order: { updatedAt: 'DESC' },
    });
    return this.enrichBoards(boards, currentUserId);
  }

  /** Boards the user has bookmarked, newest-updated first. */
  async listSaved(currentUserId: string): Promise<FeedItem[]> {
    const savedIds =
      await this.bookmarksService.listMineWithBoardIds(currentUserId);
    if (savedIds.size === 0) return [];

    const boards = await this.boardsRepository.find({
      where: {
        id: In([...savedIds]),
        visibility: BoardVisibility.PUBLIC,
      },
      relations: { owner: true },
      order: { updatedAt: 'DESC' },
    });
    return this.enrichBoards(boards, currentUserId);
  }

  async getPublicBoard(id: string): Promise<Board> {
    const board = await this.boardsRepository.findOne({
      where: { id, visibility: BoardVisibility.PUBLIC },
      relations: { owner: true },
    });
    if (!board) {
      throw new NotFoundException(`Public board ${id} not found`);
    }
    return board;
  }

  async getPublicBoardWithStats(
    id: string,
    currentUserId: string,
  ): Promise<FeedItemDetail> {
    const board = await this.getPublicBoard(id);
    const [enriched] = await this.enrichBoards([board], currentUserId);
    return { ...enriched, snapshot: board.snapshot };
  }

  async duplicateBoard(id: string, currentUserId: string): Promise<Board> {
    // Readable via ownership OR public visibility — matches "duplicate
    // shared boards" from the community use case, but also lets an owner
    // duplicate their own private board as a quick copy.
    const board = await this.boardsRepository.findOne({ where: { id } });
    if (
      !board ||
      (board.visibility !== BoardVisibility.PUBLIC &&
        board.ownerId !== currentUserId)
    ) {
      throw new NotFoundException(`Board ${id} not found`);
    }

    const copy = this.boardsRepository.create({
      ownerId: currentUserId,
      title: `${board.title} (copy)`,
      visibility: BoardVisibility.PRIVATE,
      // Verbatim JSON copy — same shape/page ids as the original. Safe
      // since a duplicate never joins the same collaboration room as its
      // source; true id-remapping is a stretch goal, not MVP (see
      // PROGRESS.md).
      snapshot: board.snapshot,
    });
    return this.boardsRepository.save(copy);
  }

  /** Public so community-scoped feeds share one definition of feed shape. */
  async enrichBoards(
    boards: Board[],
    currentUserId: string,
  ): Promise<FeedItem[]> {
    const boardIds = boards.map((b) => b.id);
    const [scores, commentCounts, bookmarked] = await Promise.all([
      this.votesService.getScoresForBoards(boardIds, currentUserId),
      this.commentsService.countsForBoards(boardIds),
      this.bookmarksService.isBookmarkedByMany(boardIds, currentUserId),
    ]);

    return boards.map((board) => ({
      id: board.id,
      title: board.title,
      ownerId: board.ownerId,
      ownerName: board.owner?.name ?? 'Unknown',
      thumbnailUrl: board.thumbnailUrl,
      createdAt: board.createdAt,
      updatedAt: board.updatedAt,
      score: scores.get(board.id)?.score ?? 0,
      myVote: scores.get(board.id)?.myVote ?? null,
      commentCount: commentCounts.get(board.id) ?? 0,
      bookmarked: bookmarked.has(board.id),
    }));
  }
}
