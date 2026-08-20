import { DrawgonMark } from './DrawgonMark';

interface DrawgonLoaderProps {
  label?: string;
  /** Fills the viewport — use for route-level and boot loading states. */
  fullScreen?: boolean;
  size?: number;
}

export function DrawgonLoader({
  label = 'Loading...',
  fullScreen = true,
  size = 96,
}: DrawgonLoaderProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center justify-center gap-4 ${
        fullScreen ? 'h-screen bg-neutral-50 dark:bg-neutral-950' : 'py-12'
      }`}
    >
      <DrawgonMark size={size} animated />
      <p className="text-sm text-neutral-500 dark:text-neutral-400">{label}</p>
    </div>
  );
}
