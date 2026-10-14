import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Board, BoardVisibility } from '../../database/entities/board.entity';
import { BoardCollaborator } from '../../database/entities/board-collaborator.entity';
import { BoardAccessService } from './board-access.service';

const BOARD_ID = '00000000-0000-4000-8000-000000000001';

describe('BoardAccessService', () => {
  let service: BoardAccessService;
  let boards: { findOne: jest.Mock };
  let collaborators: { findOneBy: jest.Mock };

  function board(overrides: Partial<Board> = {}): Board {
    return {
      id: BOARD_ID,
      ownerId: 'owner',
      visibility: BoardVisibility.PRIVATE,
      ...overrides,
    } as Board;
  }

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        BoardAccessService,
        {
          provide: getRepositoryToken(Board),
          useValue: { findOne: jest.fn() },
        },
        {
          provide: getRepositoryToken(BoardCollaborator),
          useValue: { findOneBy: jest.fn().mockResolvedValue(null) },
        },
      ],
    }).compile();
    service = module.get(BoardAccessService);
    boards = module.get(getRepositoryToken(Board));
    collaborators = module.get(getRepositoryToken(BoardCollaborator));
  });

  it('gives the owner the owner role', async () => {
    boards.findOne.mockResolvedValue(board());
    expect((await service.resolve(BOARD_ID, 'owner'))?.role).toBe('owner');
  });

  it('hides a private, unshared board from everyone else', async () => {
    boards.findOne.mockResolvedValue(board());
    expect(await service.resolve(BOARD_ID, 'stranger')).toBeNull();
  });

  it('uses the role an invitee was given', async () => {
    boards.findOne.mockResolvedValue(board());
    collaborators.findOneBy.mockResolvedValue({
      role: 'viewer',
    });
    expect((await service.resolve(BOARD_ID, 'friend'))?.role).toBe('viewer');
  });

  it('picks the strongest of several grants', async () => {
    boards.findOne.mockResolvedValue(
      board({ visibility: BoardVisibility.PUBLIC }),
    );
    collaborators.findOneBy.mockResolvedValue({ role: 'editor' });
    expect((await service.resolve(BOARD_ID, 'friend'))?.role).toBe('editor');
  });

  it('treats a public board as view-only for strangers', async () => {
    boards.findOne.mockResolvedValue(
      board({ visibility: BoardVisibility.PUBLIC }),
    );
    expect((await service.resolve(BOARD_ID, 'stranger'))?.role).toBe('viewer');
  });

  it('rejects ids that are not uuids without querying', async () => {
    expect(await service.resolve('not-a-uuid', 'owner')).toBeNull();
    expect(boards.findOne).not.toHaveBeenCalled();
  });
});
