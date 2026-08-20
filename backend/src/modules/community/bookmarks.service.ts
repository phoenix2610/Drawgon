import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Bookmark } from '../../database/entities/bookmark.entity';

@Injectable()
export class BookmarksService {
  constructor(
    @InjectRepository(Bookmark)
    private readonly bookmarksRepository: Repository<Bookmark>,
  ) {}

  async add(boardId: string, userId: string): Promise<{ bookmarked: true }> {
    const existing = await this.bookmarksRepository.findOne({
      where: { boardId, userId },
    });
    if (!existing) {
      await this.bookmarksRepository.save(
        this.bookmarksRepository.create({ boardId, userId }),
      );
    }
    return { bookmarked: true };
  }

  async remove(
    boardId: string,
    userId: string,
  ): Promise<{ bookmarked: false }> {
    await this.bookmarksRepository.delete({ boardId, userId });
    return { bookmarked: false };
  }

  async listMineWithBoardIds(userId: string): Promise<Set<string>> {
    const rows = await this.bookmarksRepository.find({ where: { userId } });
    return new Set(rows.map((r) => r.boardId));
  }

  async isBookmarkedByMany(
    boardIds: string[],
    userId: string,
  ): Promise<Set<string>> {
    if (boardIds.length === 0) return new Set();
    const rows = await this.bookmarksRepository.find({
      where: { boardId: In(boardIds), userId },
    });
    return new Set(rows.map((r) => r.boardId));
  }
}
