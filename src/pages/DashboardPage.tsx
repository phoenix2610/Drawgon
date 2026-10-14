import { Megaphone, Plus, Sparkles, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  createBoard,
  deleteBoard,
  listBoards,
  listMyPosts,
  listSharedBoards,
  type MyPost,
} from '@/lib/boards-api';
import { Avatar } from '@/components/Avatar';
import { DrawgonLoader } from '@/components/DrawgonLoader';
import { useToast } from '@/components/toast/ToastProvider';
import type { BoardSummary } from '@shared/board';

export function DashboardPage() {
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [sharedBoards, setSharedBoards] = useState<BoardSummary[]>([]);
  const [posts, setPosts] = useState<MyPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    Promise.all([listBoards(), listSharedBoards(), listMyPosts().catch(() => [])])
      .then(([myBoards, shared, myPosts]) => {
        setBoards(myBoards);
        setSharedBoards(shared);
        setPosts(myPosts);
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate() {
    setCreating(true);
    try {
      const board = await createBoard({ title: 'Untitled board' });
      navigate(`/boards/${board.id}`);
    } catch {
      toast.error('Could not create board. Please try again.');
    } finally {
      setCreating(false);
    }
  }

  async function handleDeleteBoard(e: React.MouseEvent, boardId: string, title: string) {
    e.preventDefault();
    e.stopPropagation();
    const hasPost = posts.some((p) => p.sourceBoardId === boardId);
    const question = hasPost
      ? `Are you sure you want to delete "${title}"? Its community post stays up; you can remove it under "Your posts".`
      : `Are you sure you want to delete "${title}"?`;
    if (!window.confirm(question)) return;

    try {
      await deleteBoard(boardId);
      setBoards((prev) => prev.filter((b) => b.id !== boardId));
      setPosts((prev) =>
        prev.map((p) => (p.sourceBoardId === boardId ? { ...p, sourceBoardId: null } : p)),
      );
      toast.success('Board deleted');
    } catch {
      toast.error('Could not delete board.');
    }
  }

  async function handleDeletePost(post: MyPost) {
    if (
      !window.confirm(
        `Remove "${post.title}" from every community it was posted to? Its votes and comments go with it.`,
      )
    )
      return;
    try {
      await deleteBoard(post.id);
      setPosts((prev) => prev.filter((p) => p.id !== post.id));
      toast.success('Post deleted');
    } catch {
      toast.error('Could not delete post.');
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-50">
            My Boards
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
            <li key={board.id} className="relative group">
              <Link
                to={`/boards/${board.id}`}
                className="group/card flex items-start gap-3 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-700"
              >
                <Avatar name={board.title} />
                <div className="min-w-0 flex-1 pr-7">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-medium text-neutral-900 group-hover/card:text-brand dark:text-neutral-50">
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
              <button
                type="button"
                onClick={(e) => void handleDeleteBoard(e, board.id, board.title)}
                title="Delete board"
                className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 opacity-80 transition group-hover:opacity-100 hover:bg-red-50 hover:text-red-600 sm:opacity-0 [@media(hover:none)]:opacity-100 dark:text-neutral-500 dark:hover:bg-red-500/15 dark:hover:text-red-400"
              >
                <Trash2 size={15} />
              </button>
            </li>
          ))}
        </ul>

        {posts.length > 0 && (
          <section className="mt-12">
            <h2 className="mb-1 flex items-center gap-2 text-xl font-semibold text-neutral-900 dark:text-neutral-50">
              <Megaphone size={18} className="text-brand" />
              Your posts
            </h2>
            <p className="mb-4 text-sm text-neutral-500 dark:text-neutral-400">
              Boards you published to communities. Publishing a board again updates its post.
            </p>
            <ul className="divide-y divide-neutral-200 overflow-hidden rounded-2xl border border-neutral-200 bg-white dark:divide-neutral-800 dark:border-neutral-800 dark:bg-neutral-900">
              {posts.map((post) => (
                <li key={post.id} className="flex items-center gap-3 p-3">
                  <Link
                    to={`/community/boards/${post.id}`}
                    className="flex min-w-0 flex-1 items-center gap-3"
                  >
                    {post.thumbnailUrl ? (
                      <img
                        src={post.thumbnailUrl}
                        alt=""
                        loading="lazy"
                        className="h-12 w-16 shrink-0 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="h-12 w-16 shrink-0 rounded-lg bg-gradient-to-br from-violet-500/15 via-brand/10 to-cyan-500/15" />
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-neutral-900 dark:text-neutral-50">
                        {post.title}
                      </p>
                      <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">
                        {post.communities.length > 0
                          ? post.communities.map((c) => `d/${c.slug}`).join(', ')
                          : 'Not in any community'}
                        {' · '}
                        {post.sourceBoardId ? 'from one of your boards' : 'original board deleted'}
                      </p>
                    </div>
                  </Link>
                  {post.sourceBoardId && (
                    <Link
                      to={`/boards/${post.sourceBoardId}`}
                      className="hidden shrink-0 rounded-full border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-100 sm:inline-flex dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
                    >
                      Open board
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleDeletePost(post)}
                    title="Delete post"
                    aria-label={`Delete post ${post.title}`}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-neutral-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/60 dark:hover:text-red-400"
                  >
                    <Trash2 size={15} />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {sharedBoards.length > 0 && (
          <div className="mt-12">
            <h2 className="mb-6 text-xl font-semibold text-neutral-900 dark:text-neutral-50">
              Shared with me
            </h2>
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
              {sharedBoards.map((board) => (
                <li key={board.id}>
                  <Link
                    to={`/boards/${board.id}`}
                    className="group flex items-start gap-3 rounded-xl border border-brand/20 bg-brand/5 p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md dark:bg-brand/10"
                  >
                    <Avatar name={board.title} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate font-medium text-neutral-900 group-hover:text-brand dark:text-neutral-50">
                          {board.title}
                        </p>
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
        )}
    </div>
  );
}
