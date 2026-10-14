jest.mock('./sync/board-sync.service', () => ({
  BoardSyncService: class BoardSyncService {},
}));

import {
  CollaboratorsService,
  verifyInviteToken,
} from './collaborators.service';

const BOARD_ID = '00000000-0000-4000-8000-000000000001';

describe('board invite links', () => {
  let service: CollaboratorsService;

  beforeAll(() => {
    process.env.BETTER_AUTH_SECRET = 'test-secret';
  });

  beforeEach(() => {
    const boards = {
      findOneBy: jest
        .fn()
        .mockResolvedValue({ id: BOARD_ID, ownerId: 'owner' }),
    };
    service = new CollaboratorsService(
      {} as never,
      boards as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
  });

  it('round-trips the board and role', async () => {
    const { token } = await service.generateInviteLink(
      BOARD_ID,
      'owner',
      'viewer',
    );
    expect(verifyInviteToken(token)).toMatchObject({
      b: BOARD_ID,
      r: 'viewer',
    });
  });

  it('rejects a token whose payload was edited', async () => {
    const { token } = await service.generateInviteLink(
      BOARD_ID,
      'owner',
      'viewer',
    );
    const [, signature] = token.split('.');
    const forged = Buffer.from(
      JSON.stringify({ b: BOARD_ID, r: 'editor', e: Date.now() + 1e9 }),
    ).toString('base64url');
    expect(verifyInviteToken(`${forged}.${signature}`)).toBeNull();
  });

  it('rejects an expired token', async () => {
    const now = Date.now();
    jest.spyOn(Date, 'now').mockReturnValue(now - 8 * 24 * 60 * 60 * 1000);
    const { token } = await service.generateInviteLink(
      BOARD_ID,
      'owner',
      'editor',
    );
    jest.spyOn(Date, 'now').mockReturnValue(now);
    expect(verifyInviteToken(token)).toBeNull();
  });

  it('rejects garbage', () => {
    expect(verifyInviteToken('not-a-token')).toBeNull();
  });
});
