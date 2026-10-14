import { apiClient } from '@/lib/api-client';
import type {
  Board,
  BoardCollaborator,
  BoardSummary,
  BoardVisibility,
  CollaboratorRole,
  CreateBoardInput,
  SharedBoardSummary,
} from '@shared/board';
import type { BoardPostMedia } from '@shared/board';

export async function listBoards(): Promise<BoardSummary[]> {
  const res = await apiClient.get<BoardSummary[]>('/boards');
  return res.data;
}

export async function getBoard(id: string): Promise<Board> {
  const res = await apiClient.get<Board>(`/boards/${id}`);
  return res.data;
}

export async function createBoard(input: CreateBoardInput): Promise<Board> {
  const res = await apiClient.post<Board>('/boards', input);
  return res.data;
}

export async function listSharedBoards(): Promise<SharedBoardSummary[]> {
  const res = await apiClient.get<SharedBoardSummary[]>('/boards/shared');
  return res.data;
}

export async function updateBoardThumbnail(
  id: string,
  thumbnail: string,
): Promise<void> {
  await apiClient.patch(`/boards/${id}/thumbnail`, { thumbnail });
}

export async function listCollaborators(
  id: string,
): Promise<BoardCollaborator[]> {
  const res = await apiClient.get<BoardCollaborator[]>(
    `/boards/${id}/collaborators`,
  );
  return res.data;
}

export async function inviteCollaborator(
  id: string,
  target: string,
  role: CollaboratorRole = 'editor',
): Promise<BoardCollaborator[]> {
  const value = target.trim();
  const isEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
  const res = await apiClient.post<BoardCollaborator[]>(
    `/boards/${id}/collaborators`,
    isEmail ? { email: value, role } : { username: value, role },
  );
  return res.data;
}

export async function updateCollaborator(
  id: string,
  userId: string,
  role: CollaboratorRole,
): Promise<BoardCollaborator[]> {
  const res = await apiClient.patch<BoardCollaborator[]>(
    `/boards/${id}/collaborators/${userId}`,
    { role },
  );
  return res.data;
}

export async function removeCollaborator(
  id: string,
  userId: string,
): Promise<void> {
  await apiClient.delete(`/boards/${id}/collaborators/${userId}`);
}

export async function renameBoard(id: string, title: string): Promise<Board> {
  const res = await apiClient.patch<Board>(`/boards/${id}/title`, { title });
  return res.data;
}

export async function updateBoardVisibility(
  id: string,
  visibility: BoardVisibility,
): Promise<Board> {
  const res = await apiClient.patch<Board>(`/boards/${id}/visibility`, {
    visibility,
  });
  return res.data;
}

export async function updateBoardPost(
  id: string,
  input: {
    postTitle: string;
    postDetails: string;
    postTags: string[];
    postMedia: BoardPostMedia[];
  },
): Promise<Board> {
  const res = await apiClient.patch<Board>(`/boards/${id}/post`, input);
  return res.data;
}

export interface ExistingBoardPost {
  id: string;
  postTitle: string | null;
  postDetails: string | null;
  postTags: string[];
  postMedia: BoardPostMedia[];
  updatedAt: string;
  communities: { id: string; slug: string; name: string }[];
}

export async function getBoardPost(id: string): Promise<ExistingBoardPost | null> {
  const res = await apiClient.get<ExistingBoardPost | ''>(`/boards/${id}/post`);
  return res.data || null;
}

export interface MyPost {
  id: string;
  title: string;
  thumbnailUrl: string | null;
  updatedAt: string;

  sourceBoardId: string | null;
  communities: { id: string; slug: string }[];
}

export async function listMyPosts(): Promise<MyPost[]> {
  const res = await apiClient.get<MyPost[]>('/boards/posts');
  return res.data;
}

export async function publishBoard(
  id: string,
  input: {
    postTitle: string;
    postDetails: string;
    postTags: string[];
    postMedia: BoardPostMedia[];
  },
): Promise<Board> {
  const res = await apiClient.post<Board>(`/boards/${id}/publish`, input);
  return res.data;
}

export async function deleteBoard(id: string): Promise<void> {
  await apiClient.delete(`/boards/${id}`);
}

export async function generateInviteLink(
  boardId: string,
  role: 'editor' | 'viewer' = 'editor',
): Promise<{ token: string; expiresAt: number }> {
  const res = await apiClient.post<{ token: string; expiresAt: number }>(
    `/boards/${boardId}/collaborators/invite-link`,
    { role },
  );
  return res.data;
}

export async function joinBoardViaToken(token: string): Promise<{ boardId: string }> {
  const res = await apiClient.post<{ boardId: string }>(`/boards/join/${token}`);
  return res.data;
}
