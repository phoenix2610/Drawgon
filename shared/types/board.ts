export type BoardVisibility = 'private' | 'public';

export interface BoardSummary {
  id: string;
  ownerId: string;
  title: string;
  visibility: BoardVisibility;
  /** Community the board is filed under, or null when unfiled. */
  communityId: string | null;
  thumbnailUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Board extends BoardSummary {
  snapshot: Record<string, unknown>;
}

export interface CreateBoardInput {
  title: string;
}

export interface UpdateBoardSnapshotInput {
  snapshot: Record<string, unknown>;
}

export interface UpdateBoardVisibilityInput {
  visibility: BoardVisibility;
}
