import { useEffect, useRef, useState, type ComponentType } from 'react';
import { MoreHorizontal } from 'lucide-react';

export interface BoardMoreMenuItem {
  label: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  onSelect: () => void;
  danger?: boolean;
}

export function BoardMoreMenu({ items }: { items: BoardMoreMenuItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (items.length === 0) return null;

  return (
    <div ref={ref} className="relative lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="More board actions"
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full text-neutral-600 transition hover:bg-neutral-200/70 dark:text-neutral-300 dark:hover:bg-neutral-800"
      >
        <MoreHorizontal size={18} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-[100000] mt-1 w-52 overflow-hidden rounded-xl border border-neutral-200 bg-white py-1 shadow-xl dark:border-neutral-800 dark:bg-neutral-900"
        >
          {items.map(({ label, icon: Icon, onSelect, danger }) => (
            <button
              key={label}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onSelect();
              }}
              className={`flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm transition ${
                danger
                  ? 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/50'
                  : 'text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800'
              }`}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
