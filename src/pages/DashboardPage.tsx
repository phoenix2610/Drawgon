import { Hash, LogOut, Plus, Sparkles, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createBoard, listBoards } from '@/lib/boards-api';
import { signOut, useSession } from '@/lib/auth-client';
import { Avatar } from '@/components/Avatar';
import { DrawgonLoader } from '@/components/DrawgonLoader';
import { DrawgonWordmark } from '@/components/DrawgonWordmark';
import { ThemeToggle } from '@/components/ThemeToggle';
import type { BoardSummary } from '@shared/board';

export function DashboardPage() {
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();
  const { data: session } = useSession();

  useEffect(() => {
    listBoards()
      .then(setBoards)
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate() {
    setCreating(true);
    try {
      const board = await createBoard({ title: 'Untitled board' });
      navigate(`/boards/${board.id}`);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <div className="mx-auto max-w-4xl px-6 py-12">
        <div className="mb-6 flex items-center justify-between">
          <DrawgonWordmark />
          <div className="flex items-center gap-1">
            {session?.user.email && (
              <span
                className="mr-2 flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400"
                title={session.user.email}
              >
                <Avatar name={session.user.email} size="sm" />
                <span className="hidden sm:inline">{session.user.email}</span>
              </span>
            )}
            <Link
              to="/communities"
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-neutral-600 transition hover:bg-neutral-200/70 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-neutral-50"
            >
              <Hash size={15} />
              Communities
            </Link>
            <Link
              to="/community"
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-neutral-600 transition hover:bg-neutral-200/70 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-neutral-50"
            >
              <Users size={15} />
              Feed
            </Link>
            <ThemeToggle />
            <button
              onClick={() => void signOut()}
              title="Sign out"
              aria-label="Sign out"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-200/70 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-50"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>

        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-50">
            Your boards
          </h1>
          <button
            onClick={() => void handleCreate()}
            disabled={creating}
            className="inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-hover disabled:opacity-50"
          >
            <Plus size={16} />
            {creating ? 'Creating...' : 'New board'}
          </button>
        </div>

        {loading && <DrawgonLoader fullScreen={false} size={72} />}

        {!loading && boards.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-neutral-300 py-16 text-center dark:border-neutral-700">
            <Sparkles size={22} className="text-neutral-400" />
            <p className="text-neutral-500">No boards yet. Create one to start drawing.</p>
          </div>
        )}

        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          {boards.map((board) => (
            <li key={board.id}>
              <Link
                to={`/boards/${board.id}`}
                className="group flex items-start gap-3 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-700"
              >
                <Avatar name={board.title} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-medium text-neutral-900 group-hover:text-brand dark:text-neutral-50">
                      {board.title}
                    </p>
                    {board.visibility === 'public' && (
                      <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
                        Public
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-neutral-500">
                    Updated {new Date(board.updatedAt).toLocaleString()}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
