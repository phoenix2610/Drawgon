import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Board, BoardVisibility } from '../../database/entities/board.entity';
import { BoardCollaborator } from '../../database/entities/board-collaborator.entity';
import { BoardsService } from './boards.service';
import { BoardAccessService } from './board-access.service';
import { BoardSyncService } from './sync/board-sync.service';

jest.mock('./sync/board-sync.service', () => ({
  BoardSyncService: class BoardSyncService {},
}));

type MockRepository = Partial<Record<keyof Repository<Board>, jest.Mock>>;

function createMockRepository(): MockRepository {
  return {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  };
}

describe('BoardsService', () => {
  let service: BoardsService;
  let repository: MockRepository;
  let access: { resolve: jest.Mock };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BoardsService,
        {
          provide: getRepositoryToken(Board),
          useValue: createMockRepository(),
        },
        {
          provide: getRepositoryToken(BoardCollaborator),
          useValue: createMockRepository(),
        },
        { provide: BoardAccessService, useValue: { resolve: jest.fn() } },
        {
          provide: BoardSyncService,
          useValue: {
            flush: jest.fn(),
            revalidate: jest.fn(),
            discard: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(BoardsService);
    repository = module.get(getRepositoryToken(Board));
    access = module.get(BoardAccessService);
  });

  it('listByOwner scopes the query to the given owner', async () => {
    repository.find!.mockResolvedValue([]);

    await service.listByOwner('owner-1');

    expect(repository.find).toHaveBeenCalledWith({
      where: { ownerId: 'owner-1', publishedFromId: IsNull() },
      order: { updatedAt: 'DESC' },
    });
  });

  it('findOneOwnedBy throws NotFoundException when no board matches the id+owner pair', async () => {
    repository.findOne!.mockResolvedValue(null);

    await expect(
      service.findOneOwnedBy('board-1', 'owner-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.findOne).toHaveBeenCalledWith({
      where: { id: 'board-1', ownerId: 'owner-1' },
    });
  });

  it("findOneOwnedBy does not leak another owner's board", async () => {
    repository.findOne!.mockResolvedValue(null);

    await expect(
      service.findOneOwnedBy('someone-elses-board', 'owner-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('create persists a new board owned by the given user with an empty snapshot', async () => {
    const created = {
      ownerId: 'owner-1',
      title: 'My board',
      snapshot: {},
    } as Board;
    repository.create!.mockReturnValue(created);
    repository.save!.mockResolvedValue({
      ...created,
      id: 'board-1',
      visibility: BoardVisibility.PRIVATE,
    });

    const result = await service.create('owner-1', { title: 'My board' });

    expect(repository.create).toHaveBeenCalledWith({
      ownerId: 'owner-1',
      title: 'My board',
      snapshot: {},
    });
    expect(repository.save).toHaveBeenCalledWith(created);
    expect(result.id).toBe('board-1');
  });

  it('updateThumbnail lets an editor update the preview', async () => {
    access.resolve.mockResolvedValue({
      board: { id: 'board-1' },
      role: 'editor',
    });

    await service.updateThumbnail('board-1', 'editor-1', {
      thumbnail: 'data:x',
    });

    expect(repository.update).toHaveBeenCalledWith(
      { id: 'board-1' },
      { thumbnailUrl: 'data:x' },
    );
  });

  it('updateThumbnail refuses a viewer', async () => {
    access.resolve.mockResolvedValue({
      board: { id: 'board-1' },
      role: 'viewer',
    });

    await expect(
      service.updateThumbnail('board-1', 'viewer-1', { thumbnail: 'data:x' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('findAccessible hides boards the user has no access to', async () => {
    access.resolve.mockResolvedValue(null);

    await expect(
      service.findAccessible('board-1', 'stranger'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('publishing a board again updates its existing post instead of adding a copy', async () => {
    const board = {
      id: 'board-1',
      ownerId: 'owner-1',
      title: 'Design System v2',
      snapshot: { document: { store: { id: 2 } } },
      thumbnailUrl: 'thumb-2.jpg',
    } as unknown as Board;
    const existingPost = {
      id: 'post-1',
      ownerId: 'owner-1',
      publishedFromId: 'board-1',
      visibility: BoardVisibility.PUBLIC,
      postTitle: 'Old title',
    } as unknown as Board;
    repository
      .findOne!.mockResolvedValueOnce(board)
      .mockResolvedValueOnce(board)
      .mockResolvedValueOnce(existingPost);
    repository.save!.mockImplementation((b) => Promise.resolve(b));

    const result = await service.publish('board-1', 'owner-1', {
      postTitle: 'New title',
      postDetails: '',
      postTags: [],
      postMedia: [],
    });

    expect(repository.create).not.toHaveBeenCalled();
    expect(result.id).toBe('post-1');
    expect(result.postTitle).toBe('New title');
    expect(result.snapshot).toEqual(board.snapshot);
    expect(result.thumbnailUrl).toBe('thumb-2.jpg');
  });

  it('the first publish creates a public copy linked to the board', async () => {
    const board = {
      id: 'board-1',
      ownerId: 'owner-1',
      title: 'B',
      snapshot: {},
    } as Board;
    repository
      .findOne!.mockResolvedValueOnce(board)
      .mockResolvedValueOnce(board)
      .mockResolvedValueOnce(null);
    repository.create!.mockImplementation((b: Board) => b);
    repository.save!.mockImplementation((b) =>
      Promise.resolve({ ...b, id: 'post-1' }),
    );

    const result = await service.publish('board-1', 'owner-1', {
      postTitle: 'Hello',
      postDetails: '',
      postTags: [],
      postMedia: [],
    });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        publishedFromId: 'board-1',
        visibility: BoardVisibility.PUBLIC,
        postTitle: 'Hello',
      }),
    );
    expect(result.id).toBe('post-1');
  });
});
