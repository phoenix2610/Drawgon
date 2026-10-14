import { useState, type FormEvent } from 'react';
import { deleteCommunity } from '@/lib/communities-api';
import { apiErrorMessage } from '@/lib/api-client';

interface DeleteCommunityDialogProps {
  slug: string;
  boardCount: number;
  onCancel: () => void;
  onDeleted: () => void;
}

export function DeleteCommunityDialog({
  slug,
  boardCount,
  onCancel,
  onDeleted,
}: DeleteCommunityDialogProps) {
  const [typed, setTyped] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (typed !== slug || deleting) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteCommunity(slug);
      onDeleted();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not delete this community.'));
      setDeleting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100001] flex items-center justify-center bg-neutral-950/45 p-4 backdrop-blur-[1px]"
      onClick={onCancel}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-community-title"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => void handleSubmit(e)}
        className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-5 shadow-2xl dark:border-neutral-800 dark:bg-neutral-950"
      >
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-red-600 dark:text-red-400">
          Delete community
        </p>
        <h2
          id="delete-community-title"
          className="mt-2 text-lg font-semibold text-neutral-900 dark:text-neutral-50"
        >
          Delete d/{slug}?
        </h2>
        <p className="mt-2 text-sm leading-6 text-neutral-500 dark:text-neutral-400">
          This removes the community and all its memberships for good.
          {boardCount > 0 &&
            ` Posts published only to d/${slug} are deleted with it; posts also shared to other communities stay there.`}{' '}
          Your own boards are not affected.
        </p>
        {error && (
          <p className="mt-3 rounded-lg bg-red-100 px-3 py-2 text-sm text-red-800 dark:bg-red-500/15 dark:text-red-300">
            {error}
          </p>
        )}
        <label className="mt-4 block text-sm text-neutral-700 dark:text-neutral-200">
          Type <span className="font-mono font-semibold">{slug}</span> to confirm
          <input
            autoFocus
            value={typed}
            onChange={(e) => setTyped(e.target.value.trim().toLowerCase())}
            className="mt-1.5 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-red-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
          />
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 dark:border-neutral-700 dark:text-neutral-200"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={typed !== slug || deleting}
            className="rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
          >
            {deleting ? 'Deleting...' : 'Delete community'}
          </button>
        </div>
      </form>
    </div>
  );
}
