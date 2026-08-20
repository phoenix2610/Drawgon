import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Board } from '../../database/entities/board.entity';
import { CreateBoardDto } from './dto/create-board.dto';
import { UpdateBoardSnapshotDto } from './dto/update-board-snapshot.dto';
import { UpdateBoardVisibilityDto } from './dto/update-board-visibility.dto';
import { RenameBoardDto } from './dto/rename-board.dto';

@Injectable()
export class BoardsService {
  constructor(
    @InjectRepository(Board)
    private readonly boardsRepository: Repository<Board>,
  ) {}

  async listByOwner(ownerId: string): Promise<Board[]> {
    return this.boardsRepository.find({
      where: { ownerId },
      order: { updatedAt: 'DESC' },
    });
  }

  async findOneOwnedBy(id: string, ownerId: string): Promise<Board> {
    const board = await this.boardsRepository.findOne({
      where: { id, ownerId },
    });
    if (!board) {
      throw new NotFoundException(`Board ${id} not found`);
    }
    return board;
  }

  async create(ownerId: string, dto: CreateBoardDto): Promise<Board> {
    const board = this.boardsRepository.create({
      ownerId,
      title: dto.title,
      snapshot: {},
    });
    return this.boardsRepository.save(board);
  }

  async updateSnapshot(
    id: string,
    ownerId: string,
    dto: UpdateBoardSnapshotDto,
  ): Promise<Board> {
    const board = await this.findOneOwnedBy(id, ownerId);
    board.snapshot = dto.snapshot;
    if (dto.thumbnail !== undefined) {
      board.thumbnailUrl = dto.thumbnail || null;
    }
    return this.boardsRepository.save(board);
  }

  async rename(
    id: string,
    ownerId: string,
    dto: RenameBoardDto,
  ): Promise<Board> {
    const board = await this.findOneOwnedBy(id, ownerId);
    const title = dto.title.trim();
    if (!title) {
      throw new BadRequestException('Title cannot be blank.');
    }
    board.title = title;
    return this.boardsRepository.save(board);
  }

  async updateVisibility(
    id: string,
    ownerId: string,
    dto: UpdateBoardVisibilityDto,
  ): Promise<Board> {
    const board = await this.findOneOwnedBy(id, ownerId);
    board.visibility = dto.visibility;
    return this.boardsRepository.save(board);
  }
}
