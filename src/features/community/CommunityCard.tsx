import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import type { CommunitySummary } from '@shared/community';
import { CommunityAvatar } from './CommunityAvatar';
import { joinCommunity, leaveCommunity } from '@/lib/communities-api';
import { DeleteCommunityDialog } from './DeleteCommunityDialog';

export function CommunityCard({
  community,
  onDeleted,
}: {
  community: CommunitySummary;
  onDeleted?: () => void;
}) {
  const [state, setState] = useState(community);
  const [pending, setPending] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  async function toggleMembership(e: React.MouseEvent) {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    try {
      setState(
        state.joined
          ? await leaveCommunity(state.slug)
          : await joinCommunity(state.slug),
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Link
        to={`/c/${state.slug}`}
        className="group flex items-center gap-3 rounded-xl border border-neutral-200 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-700"
      >
        <CommunityAvatar slug={state.slug} />

        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-neutral-900 group-hover:text-brand dark:text-neutral-50">
            d/{state.slug}
          </p>
          <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">
            {state.memberCount} {state.memberCount === 1 ? 'member' : 'members'}{' '}
            · {state.boardCount} {state.boardCount === 1 ? 'board' : 'boards'}
          </p>
          {state.description && (
            <p className="mt-1 line-clamp-1 text-xs text-neutral-500 dark:text-neutral-400">
              {state.description}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={(e) => void toggleMembership(e)}
          disabled={pending || state.role === 'owner'}
          title={state.role === 'owner' ? 'You own this community' : undefined}
          className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
            state.joined
              ? 'border border-neutral-300 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800'
              : 'bg-brand text-white hover:bg-brand-hover'
          }`}
        >
          {state.role === 'owner' ? 'Owner' : state.joined ? 'Joined' : 'Join'}
        </button>

        {state.role === 'owner' && onDeleted && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              setConfirmingDelete(true);
            }}
            title={`Delete d/${state.slug}`}
            aria-label={`Delete d/${state.slug}`}
            className="shrink-0 rounded-full p-1.5 text-neutral-400 transition hover:bg-red-100 hover:text-red-600 dark:text-neutral-500 dark:hover:bg-red-500/15 dark:hover:text-red-400"
          >
            <Trash2 size={15} />
          </button>
        )}
      </Link>
      {confirmingDelete && (
        <DeleteCommunityDialog
          slug={state.slug}
          boardCount={state.boardCount}
          onCancel={() => setConfirmingDelete(false)}
          onDeleted={() => {
            setConfirmingDelete(false);
            onDeleted?.();
          }}
        />
      )}
    </>
  );
}
