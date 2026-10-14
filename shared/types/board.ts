export type BoardVisibility = 'private' | 'public';

export type BoardRole = 'owner' | 'editor' | 'viewer';

export type CollaboratorRole = 'editor' | 'viewer';

export interface BoardPostMedia {
  name: string;
  type: string;
  url: string;
}

export interface BoardSummary {
  id: string;
  ownerId: string;
  title: string;
  publishedFromId: string | null;
  postTitle: string | null;
  postDetails: string | null;
  postTags: string[];
  postMedia: BoardPostMedia[];
  visibility: BoardVisibility;

  communityId: string | null;
  thumbnailUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Board extends BoardSummary {
  snapshot: Record<string, unknown>;
  role: BoardRole;
  ownerName: string;
}

export interface SharedBoardSummary extends BoardSummary {
  role: BoardRole;
  ownerName: string;
}

export interface CreateBoardInput {
  title: string;
}

export interface UpdateBoardVisibilityInput {
  visibility: BoardVisibility;
}

export interface BoardCollaborator {
  userId: string;
  name: string;

  email: string | null;
  username: string | null;
  avatarUrl: string | null;
  role: 'owner' | CollaboratorRole;
  addedAt: string | null;
}
