import { useState, type FormEvent } from 'react';
import { Link2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/components/toast/ToastProvider';

function tokenFrom(input: string): string | null {
  const match = /\/join\/([^/?#\s]+)/.exec(input);
  const token = match ? match[1] : input.trim();
  return /^[\w-]+\.[\w-]+$/.test(token) ? token : null;
}

export function JoinWithLink() {
  const [value, setValue] = useState('');
  const navigate = useNavigate();
  const toast = useToast();

  function submit(e: FormEvent) {
    e.preventDefault();
    const token = tokenFrom(value);
    if (!token) {
      toast.error(
        "That doesn't look like an invite link",
        'Paste the full link the board owner sent you.',
      );
      return;
    }
    navigate(`/boards/join/${token}`);
  }

  return (
    <form
      onSubmit={submit}
      className="mb-6 flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-neutral-300 bg-neutral-50 px-3.5 py-2.5 dark:border-neutral-700 dark:bg-neutral-900/60"
    >
      <Link2 size={15} className="text-brand" />
      <label htmlFor="join-link" className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
        Got an invite link?
      </label>
      <input
        id="join-link"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Paste it here to join the board"
        autoComplete="off"
        className="min-w-0 flex-1 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-brand focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
      />
      <button
        type="submit"
        disabled={!value.trim()}
        className="rounded-full bg-brand px-3.5 py-1.5 text-xs font-medium text-white transition hover:bg-brand-hover disabled:opacity-50"
      >
        Join
      </button>
    </form>
  );
}
