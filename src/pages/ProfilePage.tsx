import { Bookmark, Grid3x3 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { BoardSummary } from '@shared/board';
import type { FeedItem } from '@shared/community';
import { listBoards } from '@/lib/boards-api';
import { listSavedBoards } from '@/lib/community-api';
import { useSession } from '@/lib/auth-client';
import { Avatar } from '@/components/Avatar';
import { PinCard } from '@/features/community/PinCard';
import { DrawgonLoader } from '@/components/DrawgonLoader';

type Tab = 'creations' | 'saved';

export function ProfilePage() {
  const { data: session } = useSession();
  const [tab, setTab] = useState<Tab>('creations');
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [saved, setSaved] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([listBoards(), listSavedBoards()])
      .then(([mine, savedItems]) => {
        setBoards(mine);
        setSaved(savedItems);
      })
      .finally(() => setLoading(false));
  }, []);

  const publicCount = boards.filter((b) => b.visibility === 'public').length;
  const name = session?.user.name || session?.user.email || '?';

  const tabClass = (t: Tab) =>
    `inline-flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition ${
      tab === t
        ? 'border-brand text-brand'
        : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
    }`;

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <header className="flex items-center gap-4">
        <Avatar name={name} />
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold text-neutral-900 dark:text-neutral-50">
            {session?.user.name || 'Unnamed'}
          </h1>
          <p className="truncate text-sm text-neutral-500">{session?.user.email}</p>
        </div>
      </header>

      <dl className="mt-5 flex gap-6 text-sm">
        <div>
          <dt className="text-neutral-400">Canvases</dt>
          <dd className="font-semibold text-neutral-900 dark:text-neutral-50">
            {boards.length}
          </dd>
        </div>
        <div>
          <dt className="text-neutral-400">Published</dt>
          <dd className="font-semibold text-neutral-900 dark:text-neutral-50">
            {publicCount}
          </dd>
        </div>
        <div>
          <dt className="text-neutral-400">Saved</dt>
          <dd className="font-semibold text-neutral-900 dark:text-neutral-50">
            {saved.length}
          </dd>
        </div>
      </dl>

      <div className="mt-6 flex border-b border-neutral-200 dark:border-neutral-800">
        <button type="button" onClick={() => setTab('creations')} className={tabClass('creations')}>
          <Grid3x3 size={15} />
          Creations
        </button>
        <button type="button" onClick={() => setTab('saved')} className={tabClass('saved')}>
          <Bookmark size={15} />
          Saved
        </button>
      </div>

      {loading && <DrawgonLoader fullScreen={false} size={72} />}

      {!loading && tab === 'creations' && (
        boards.length === 0 ? (
          <p className="py-16 text-center text-neutral-500">No canvases yet.</p>
        ) : (
          <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {boards.map((board) => (
              <li key={board.id}>
                <Link
                  to={`/boards/${board.id}`}
                  className="group block overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900"
                >
                  {board.thumbnailUrl ? (
                    <img src={board.thumbnailUrl} alt="" className="h-28 w-full object-cover object-top" />
                  ) : (
                    <div className="h-28 bg-gradient-to-br from-violet-500/10 to-cyan-500/10" />
                  )}
                  <div className="flex items-center justify-between gap-2 p-3">
                    <p className="truncate text-sm font-medium text-neutral-900 group-hover:text-brand dark:text-neutral-50">
                      {board.title}
                    </p>
                    {board.visibility === 'public' && (
                      <span className="shrink-0 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
                        Public
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )
      )}

      {!loading && tab === 'saved' && (
        saved.length === 0 ? (
          <p className="py-16 text-center text-neutral-500">Nothing saved yet.</p>
        ) : (
          <div className="mt-6 columns-2 gap-4 sm:columns-3 lg:columns-4">
            {saved.map((item) => (
              <PinCard key={item.id} item={item} />
            ))}
          </div>
        )
      )}
    </div>
  );
}
