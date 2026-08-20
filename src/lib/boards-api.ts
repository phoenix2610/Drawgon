import { apiClient } from '@/lib/api-client';
import type {
  Board,
  BoardSummary,
  BoardVisibility,
  CreateBoardInput,
} from '@shared/board';

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

export async function updateBoardSnapshot(
  id: string,
  snapshot: Record<string, unknown>,
  thumbnail?: string,
): Promise<Board> {
  const res = await apiClient.patch<Board>(`/boards/${id}/snapshot`, {
    snapshot,
    ...(thumbnail ? { thumbnail } : {}),
  });
  return res.data;
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
