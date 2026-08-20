import { Bookmark, MessageSquare } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { FeedItem } from '@shared/community';
import { VoteButtons } from './VoteButtons';
import { Avatar } from '@/components/Avatar';
import { addBookmark, removeBookmark } from '@/lib/community-api';

export function BoardCard({ item }: { item: FeedItem }) {
  const [stats, setStats] = useState({ score: item.score, myVote: item.myVote });
  const [bookmarked, setBookmarked] = useState(item.bookmarked);
  const [bookmarkPending, setBookmarkPending] = useState(false);

  async function toggleBookmark(e: React.MouseEvent) {
    e.preventDefault();
    if (bookmarkPending) return;
    setBookmarkPending(true);
    try {
      if (bookmarked) {
        await removeBookmark(item.id);
        setBookmarked(false);
      } else {
        await addBookmark(item.id);
        setBookmarked(true);
      }
    } finally {
      setBookmarkPending(false);
    }
  }

  return (
    <Link
      to={`/community/boards/${item.id}`}
      className="group flex items-start gap-3 rounded-xl border border-neutral-200 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-700"
    >
      <VoteButtons
        boardId={item.id}
        score={stats.score}
        myVote={stats.myVote}
        onChange={setStats}
      />

      <div className="min-w-0 flex-1 py-0.5">
        <div className="mb-1 flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
          <Avatar name={item.ownerName} size="sm" />
          <span className="font-medium text-neutral-700 dark:text-neutral-300">
            {item.ownerName}
          </span>
          <span aria-hidden="true">·</span>
          <span>{new Date(item.updatedAt).toLocaleDateString()}</span>
        </div>
        <p className="truncate font-semibold text-neutral-900 group-hover:text-brand dark:text-neutral-50">
          {item.title}
        </p>
        <div className="mt-2 flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs font-semibold text-neutral-500 dark:text-neutral-400">
          <MessageSquare size={14} />
          {item.commentCount} {item.commentCount === 1 ? 'comment' : 'comments'}
        </div>
      </div>

      {item.thumbnailUrl && (
        <img
          src={item.thumbnailUrl}
          alt=""
          loading="lazy"
          className="hidden h-16 w-24 shrink-0 rounded-md object-cover sm:block"
        />
      )}

      <button
        type="button"
        onClick={(e) => void toggleBookmark(e)}
        disabled={bookmarkPending}
        aria-pressed={bookmarked}
        title={bookmarked ? 'Remove bookmark' : 'Bookmark'}
        className={`shrink-0 rounded-full p-1.5 transition ${
          bookmarked
            ? 'text-amber-500'
            : 'text-neutral-300 hover:bg-neutral-100 hover:text-neutral-500 dark:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-400'
        }`}
      >
        <Bookmark size={18} fill={bookmarked ? 'currentColor' : 'none'} />
      </button>
    </Link>
  );
}
