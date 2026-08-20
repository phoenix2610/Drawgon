import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Vote } from '../../database/entities/vote.entity';

@Injectable()
export class VotesService {
  constructor(
    @InjectRepository(Vote)
    private readonly votesRepository: Repository<Vote>,
  ) {}

  /** Clicking the same direction again clears the vote (toggle), matching Reddit-style voting UX. */
  async setVote(
    boardId: string,
    userId: string,
    value: 1 | -1,
  ): Promise<{ score: number; myVote: number | null }> {
    const existing = await this.votesRepository.findOne({
      where: { boardId, userId },
    });

    if (existing && existing.value === value) {
      await this.votesRepository.remove(existing);
    } else if (existing) {
      existing.value = value;
      await this.votesRepository.save(existing);
    } else {
      await this.votesRepository.save(
        this.votesRepository.create({ boardId, userId, value }),
      );
    }

    return this.getScoreAndMyVote(boardId, userId);
  }

  async removeVote(
    boardId: string,
    userId: string,
  ): Promise<{ score: number; myVote: number | null }> {
    await this.votesRepository.delete({ boardId, userId });
    return this.getScoreAndMyVote(boardId, userId);
  }

  private async getScoreAndMyVote(boardId: string, userId: string) {
    const [score, mine] = await Promise.all([
      this.getScore(boardId),
      this.votesRepository.findOne({ where: { boardId, userId } }),
    ]);
    return { score, myVote: mine?.value ?? null };
  }

  async getScore(boardId: string): Promise<number> {
    const result: { sum: string | null } | undefined =
      await this.votesRepository
        .createQueryBuilder('vote')
        .select('SUM(vote.value)', 'sum')
        .where('vote.boardId = :boardId', { boardId })
        .getRawOne();
    return Number(result?.sum ?? 0);
  }

  /** Batched score + this user's vote for many boards at once (feed view) — avoids N+1. */
  async getScoresForBoards(
    boardIds: string[],
    userId: string,
  ): Promise<Map<string, { score: number; myVote: number | null }>> {
    const result = new Map<string, { score: number; myVote: number | null }>();
    if (boardIds.length === 0) return result;

    const scoreRows: Array<{ boardId: string; sum: string }> =
      await this.votesRepository
        .createQueryBuilder('vote')
        .select('vote.board_id', 'boardId')
        .addSelect('SUM(vote.value)', 'sum')
        .where('vote.boardId IN (:...boardIds)', { boardIds })
        .groupBy('vote.board_id')
        .getRawMany();

    const myVotes = await this.votesRepository.find({
      where: { boardId: In(boardIds), userId },
    });
    const myVoteByBoard = new Map(myVotes.map((v) => [v.boardId, v.value]));

    for (const boardId of boardIds) {
      result.set(boardId, {
        score: 0,
        myVote: myVoteByBoard.get(boardId) ?? null,
      });
    }
    for (const row of scoreRows) {
      const existing = result.get(row.boardId);
      if (existing) existing.score = Number(row.sum);
    }

    return result;
  }
}
