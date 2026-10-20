import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  Check,
  Link2,
  Loader2,
  LogOut,
  Mail,
  Search,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import type { Board, BoardCollaborator, CollaboratorRole } from '@shared/board';
import {
  generateInviteLink,
  inviteCollaborator,
  listCollaborators,
  removeCollaborator,
  updateCollaborator,
} from '@/lib/boards-api';
import { apiErrorMessage } from '@/lib/api-client';
import { searchUsers } from '@/lib/users-api';
import type { UserSearchResult } from '@shared/user';
import { Avatar } from '@/components/Avatar';
import { useToast } from '@/components/toast/ToastProvider';

interface CollaboratorsDialogProps {
  board: Board;
  currentUserId: string;
  activeUserIds: string[];
  onClose: () => void;
  onPeopleChange?: (people: BoardCollaborator[]) => void;
  onLeft: () => void;
}

const selectClass =
  'rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-xs text-neutral-800 focus:border-brand focus:outline-none disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100';

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const REFRESH_MS = 8000;

function timeAgo(iso: string | null): string {
  if (!iso) return '';
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function PersonStatus({
  person,
  active,
}: {
  person: BoardCollaborator;
  active: boolean;
}) {
  if (person.role === 'owner' && !active) return null;
  if (active) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Active now
      </span>
    );
  }
  if (person.lastOpenedAt) {
    return (
      <span className="text-[11px] text-neutral-500">
        Opened the board {timeAgo(person.lastOpenedAt)}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
      Invite sent {timeAgo(person.addedAt)} · not opened yet
    </span>
  );
}

export function CollaboratorsDialog({
  board,
  currentUserId,
  activeUserIds,
  onClose,
  onPeopleChange,
  onLeft,
}: CollaboratorsDialogProps) {
  const isOwner = board.role === 'owner';
  const [people, setPeopleState] = useState<BoardCollaborator[] | null>(null);
  const toast = useToast();
  const [target, setTarget] = useState('');
  const [role, setRole] = useState<CollaboratorRole>('editor');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const openedBefore = useRef<Map<string, string | null>>(new Map());

  const query = target.trim().replace(/^@/, '');
  const looksLikeEmail = EMAIL_PATTERN.test(target.trim());
  const canSearch = query.length >= 2 && !looksLikeEmail;
  const withAccess = new Set((people ?? []).map((p) => p.userId));
  const visibleResults = canSearch
    ? results.filter((r) => r.userId !== currentUserId && !withAccess.has(r.userId))
    : [];

  function setPeople(next: BoardCollaborator[]) {
    setPeopleState(next);
    onPeopleChange?.(next);
  }

  useEffect(() => {
    let live = true;
    function load(first: boolean) {
      listCollaborators(board.id)
        .then((list) => {
          if (!live) return;
          if (!first && isOwner) {
            for (const p of list) {
              const known = openedBefore.current.get(p.userId);
              if (known === null && p.lastOpenedAt) {
                toast.info(
                  `${p.name} opened the board`,
                  'Your invite was received.',
                );
              }
            }
          }
          openedBefore.current = new Map(
            list.map((p) => [p.userId, p.lastOpenedAt]),
          );
          setPeopleState(list);
        })
        .catch((e) => {
          if (live && first) setError(apiErrorMessage(e, 'Could not load people.'));
        });
    }
    load(true);
    const timer = window.setInterval(() => load(false), REFRESH_MS);
    return () => {
      live = false;
      window.clearInterval(timer);
    };
  }, [board.id, isOwner, toast]);

  useEffect(() => {
    if (!canSearch) return;
    let live = true;
    const timer = window.setTimeout(() => {
      setSearching(true);
      searchUsers(query)
        .then((found) => live && setResults(found))
        .catch(() => live && setResults([]))
        .finally(() => live && setSearching(false));
    }, 250);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [query, canSearch]);

  async function run(action: () => Promise<void>, fallback: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      const message = apiErrorMessage(e, fallback);
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  const accessLabel = role === 'editor' ? 'edit' : 'view';

  function inviteUser(user: { userId: string; name: string }) {
    void run(async () => {
      setPeople(await inviteCollaborator(board.id, { userId: user.userId }, role));
      toast.success(
        `Invite sent to ${user.name}`,
        `They've been notified and can ${accessLabel} "${board.title}". We'll tell you when they open it.`,
      );
      setTarget('');
    }, 'Could not invite that person.');
  }

  function inviteEmail() {
    const email = target.trim();
    void run(async () => {
      const list = await inviteCollaborator(board.id, email, role);
      setPeople(list);
      const match = list.find((p) => p.email?.toLowerCase() === email.toLowerCase());
      toast.success(
        `Invite sent to ${match?.name ?? email}`,
        `They've been notified and can ${accessLabel} "${board.title}". We'll tell you when they open it.`,
      );
      setTarget('');
    }, 'Could not invite that person.');
  }

  function submitInvite(e: FormEvent) {
    e.preventDefault();
    if (!target.trim()) return;
    if (looksLikeEmail) inviteEmail();
    else if (visibleResults.length === 1) inviteUser(visibleResults[0]);
  }

  function copyInviteLink() {
    void run(async () => {
      const { token } = await generateInviteLink(board.id, role);
      const url = `${window.location.origin}/boards/join/${token}`;
      setInviteUrl(url);
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
        toast.success(
          'Invite link copied',
          `Anyone signed in who opens it joins as ${role === 'editor' ? 'an editor' : 'a viewer'}. It expires in 7 days.`,
        );
      } catch {
        toast.info('Invite link ready', 'Copy it from the box in the dialog.');
      }
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
              <form onSubmit={submitInvite} className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative min-w-0 flex-1">
                    <Search
                      size={14}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
                    />
                    <input
                      value={target}
                      onChange={(e) => setTarget(e.target.value)}
                      placeholder="Search by name, username or email"
                      aria-label="Search people to invite"
                      autoComplete="off"
                      className="w-full rounded-lg border border-neutral-200 bg-neutral-50 py-2 pl-8 pr-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-brand focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                    />
                  </div>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as CollaboratorRole)}
                    aria-label="Role for new collaborators"
                    className={selectClass}
                  >
                    <option value="editor">Can edit</option>
                    <option value="viewer">Can view</option>
                  </select>
                </div>

                {looksLikeEmail && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={inviteEmail}
                    className="flex w-full items-center gap-3 rounded-lg border border-neutral-200 px-3 py-2 text-left text-sm transition hover:bg-neutral-100 disabled:opacity-60 dark:border-neutral-700 dark:hover:bg-neutral-900"
                  >
                    <Mail size={16} className="text-brand" />
                    <span className="min-w-0 flex-1 truncate">
                      Invite <span className="font-medium">{target.trim()}</span>
                    </span>
                    <UserPlus size={14} className="text-neutral-400" />
                  </button>
                )}

                {canSearch && (
                  <div className="max-h-52 overflow-y-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
                    {searching && visibleResults.length === 0 && (
                      <p className="flex items-center gap-2 px-3 py-2.5 text-xs text-neutral-500">
                        <Loader2 size={12} className="animate-spin" />
                        Searching...
                      </p>
                    )}
                    {!searching && visibleResults.length === 0 && (
                      <p className="px-3 py-2.5 text-xs text-neutral-500">
                        No one found for “{query}”. Try their email, or send an
                        invite link instead.
                      </p>
                    )}
                    {visibleResults.map((user) => (
                      <button
                        key={user.userId}
                        type="button"
                        disabled={busy}
                        onClick={() => inviteUser(user)}
                        className="flex w-full items-center gap-3 px-3 py-2 text-left transition hover:bg-neutral-100 disabled:opacity-60 dark:hover:bg-neutral-900"
                      >
                        <Avatar name={user.name} avatarUrl={user.avatarUrl} size="sm" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-neutral-900 dark:text-neutral-50">
                            {user.name}
                          </span>
                          {user.username && (
                            <span className="block truncate text-xs text-neutral-500">
                              @{user.username}
                            </span>
                          )}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-brand px-2.5 py-1 text-[11px] font-medium text-white">
                          <UserPlus size={12} />
                          Invite
                        </span>
                      </button>
                    ))}
                  </div>
                )}
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

              {inviteUrl && (
                <input
                  readOnly
                  value={inviteUrl}
                  aria-label="Invite link"
                  onFocus={(e) => e.currentTarget.select()}
                  className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-600 focus:border-brand focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300"
                />
              )}
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
                        <PersonStatus
                          person={person}
                          active={activeUserIds.includes(person.userId)}
                        />
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
                                const nextRole = e.target.value as CollaboratorRole;
                                setPeople(
                                  await updateCollaborator(
                                    board.id,
                                    person.userId,
                                    nextRole,
                                  ),
                                );
                                toast.success(
                                  `${person.name} can now ${nextRole === 'editor' ? 'edit' : 'view'}`,
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
                                toast.success(
                                  `${person.name} removed`,
                                  'They no longer have access to this board.',
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
