import { useEffect, useState, type FormEvent } from 'react';
import { Check, Link2, LogOut, Trash2, UserPlus, X } from 'lucide-react';
import type { Board, BoardCollaborator, CollaboratorRole } from '@shared/board';
import {
  generateInviteLink,
  inviteCollaborator,
  listCollaborators,
  removeCollaborator,
  updateCollaborator,
} from '@/lib/boards-api';
import { apiErrorMessage } from '@/lib/api-client';
import { Avatar } from '@/components/Avatar';

interface CollaboratorsDialogProps {
  board: Board;
  currentUserId: string;
  onClose: () => void;
  onPeopleChange?: (people: BoardCollaborator[]) => void;
  onLeft: () => void;
}

const selectClass =
  'rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-xs text-neutral-800 focus:border-brand focus:outline-none disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100';

export function CollaboratorsDialog({
  board,
  currentUserId,
  onClose,
  onPeopleChange,
  onLeft,
}: CollaboratorsDialogProps) {
  const isOwner = board.role === 'owner';
  const [people, setPeopleState] = useState<BoardCollaborator[] | null>(null);
  const [target, setTarget] = useState('');
  const [role, setRole] = useState<CollaboratorRole>('editor');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function setPeople(next: BoardCollaborator[]) {
    setPeopleState(next);
    onPeopleChange?.(next);
  }

  useEffect(() => {
    listCollaborators(board.id)
      .then(setPeopleState)
      .catch((e) => setError(apiErrorMessage(e, 'Could not load people.')));
  }, [board.id]);

  async function run(action: () => Promise<void>, fallback: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(apiErrorMessage(e, fallback));
    } finally {
      setBusy(false);
    }
  }

  function invite(e: FormEvent) {
    e.preventDefault();
    if (!target.trim()) return;
    void run(async () => {
      setPeople(await inviteCollaborator(board.id, target, role));
      setTarget('');
    }, 'Could not invite that person.');
  }

  function copyInviteLink() {
    void run(async () => {
      const { token } = await generateInviteLink(board.id, role);
      await navigator.clipboard.writeText(
        `${window.location.origin}/boards/join/${token}`,
      );
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }, 'Could not create an invite link.');
  }

  return (
    <div
      className="fixed inset-0 z-[100001] flex items-center justify-center bg-neutral-950/45 p-4 backdrop-blur-[1px]"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-dialog-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl border border-neutral-200 bg-white shadow-2xl dark:border-neutral-800 dark:bg-neutral-950"
      >
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4 dark:border-neutral-800">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-brand">
              Board collaborators
            </p>
            <h2
              id="share-dialog-title"
              className="mt-1 text-lg font-semibold text-neutral-900 dark:text-neutral-50"
            >
              Share “{board.title}”
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-200/70 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-50"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-5 px-5 py-4">
          {error && (
            <p className="rounded-lg bg-red-100 px-3 py-2 text-sm text-red-800 dark:bg-red-500/15 dark:text-red-300">
              {error}
            </p>
          )}

          {isOwner && (
            <div className="space-y-3">
              <form onSubmit={invite} className="flex flex-wrap items-center gap-2">
                <input
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  placeholder="Username or email"
                  aria-label="Username or email to invite"
                  className="min-w-0 flex-1 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-brand focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                />
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as CollaboratorRole)}
                  aria-label="Role for new collaborators"
                  className={selectClass}
                >
                  <option value="editor">Can edit</option>
                  <option value="viewer">Can view</option>
                </select>
                <button
                  type="submit"
                  disabled={busy || !target.trim()}
                  className="inline-flex items-center gap-1.5 rounded-full bg-brand px-3 py-2 text-xs font-medium text-white transition hover:bg-brand-hover disabled:opacity-60"
                >
                  <UserPlus size={13} />
                  Invite
                </button>
              </form>

              <div className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-neutral-300 bg-neutral-50 px-3.5 py-2.5 dark:border-neutral-700 dark:bg-neutral-900/60">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                    Invite via link
                  </p>
                  <p className="text-[11px] text-neutral-500">
                    Anyone signed in who opens it joins as{' '}
                    {role === 'editor' ? 'an editor' : 'a viewer'}. Expires in
                    7 days.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={copyInviteLink}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition disabled:opacity-60 ${
                    copied
                      ? 'bg-emerald-600 text-white'
                      : 'bg-neutral-200 text-neutral-800 hover:bg-neutral-300 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700'
                  }`}
                >
                  {copied ? <Check size={12} /> : <Link2 size={12} />}
                  {copied ? 'Copied!' : 'Copy link'}
                </button>
              </div>
            </div>
          )}

          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">
              People with access
            </p>
            {people === null ? (
              <p className="text-sm text-neutral-500">Loading...</p>
            ) : (
              <ul className="max-h-64 space-y-1 overflow-y-auto">
                {people.map((person) => {
                  const isMe = person.userId === currentUserId;
                  const detail = person.username
                    ? `@${person.username}`
                    : person.email;
                  return (
                    <li
                      key={person.userId}
                      className="flex items-center gap-3 rounded-lg px-2 py-1.5"
                    >
                      <Avatar
                        name={person.name}
                        avatarUrl={person.avatarUrl}
                        size="sm"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-50">
                          {person.name}
                          {isMe && (
                            <span className="ml-1 font-normal text-neutral-400">
                              (you)
                            </span>
                          )}
                        </p>
                        {detail && (
                          <p className="truncate text-xs text-neutral-500">
                            {detail}
                          </p>
                        )}
                      </div>
                      {person.role === 'owner' ? (
                        <span className="text-xs text-neutral-500">Owner</span>
                      ) : isOwner ? (
                        <>
                          <select
                            value={person.role}
                            disabled={busy}
                            aria-label={`Role for ${person.name}`}
                            onChange={(e) =>
                              void run(async () => {
                                setPeople(
                                  await updateCollaborator(
                                    board.id,
                                    person.userId,
                                    e.target.value as CollaboratorRole,
                                  ),
                                );
                              }, 'Could not change their access.')
                            }
                            className={selectClass}
                          >
                            <option value="editor">Can edit</option>
                            <option value="viewer">Can view</option>
                          </select>
                          <button
                            type="button"
                            disabled={busy}
                            title={`Remove ${person.name}`}
                            aria-label={`Remove ${person.name}`}
                            onClick={() =>
                              void run(async () => {
                                await removeCollaborator(board.id, person.userId);
                                setPeople(
                                  (people ?? []).filter(
                                    (p) => p.userId !== person.userId,
                                  ),
                                );
                              }, 'Could not remove them.')
                            }
                            className="inline-flex h-7 w-7 items-center justify-center rounded-full text-neutral-400 transition hover:bg-red-100 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-500/15 dark:hover:text-red-400"
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      ) : (
                        <span className="text-xs text-neutral-500">
                          {person.role === 'editor' ? 'Can edit' : 'Can view'}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Everyone with access sees changes, cursors and the voice call
            live. Viewers can look around and join the call but not draw.
          </p>

          {!isOwner && people?.some((p) => p.userId === currentUserId) && (
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await removeCollaborator(board.id, currentUserId);
                  onLeft();
                }, 'Could not leave this board.')
              }
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-100 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-500/15"
            >
              <LogOut size={13} />
              Leave this board
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
