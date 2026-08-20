import { useCallback, useRef } from 'react';
import { Tldraw, type Editor, type TLEditorSnapshot } from '@tldraw/tldraw';
import '@tldraw/tldraw/tldraw.css';
import { updateBoardSnapshot } from '@/lib/boards-api';
import { useThemeStore } from '@/store/theme';
import { PdfImporter } from './PdfImporter';

const AUTOSAVE_DEBOUNCE_MS = 1500;
/** Feed previews are displayed small; this keeps the data URL well under 100KB. */
const THUMBNAIL_WIDTH = 480;

/**
 * Renders a small preview of the board for the Pinterest-style feed. Returns
 * undefined for an empty board, and never rejects — a failed preview must not
 * take the snapshot save down with it.
 */
async function renderThumbnail(editor: Editor): Promise<string | undefined> {
  try {
    const ids = [...editor.getCurrentPageShapeIds()];
    if (ids.length === 0) return undefined;

    const bounds = editor.getCurrentPageBounds();
    const scale = bounds ? Math.min(1, THUMBNAIL_WIDTH / bounds.width) : 1;

    const { url } = await editor.toImageDataUrl(ids, {
      format: 'jpeg',
      quality: 0.7,
      background: true,
      darkMode: false,
      padding: 16,
      scale,
    });
    return url;
  } catch {
    return undefined;
  }
}

interface BoardCanvasProps {
  boardId: string;
  initialSnapshot: Record<string, unknown>;
  /** Community view of someone else's board — no autosave, no editing. */
  readOnly?: boolean;
  /** Hands the mounted editor up so siblings (share tray, imports) can drive it. */
  onEditorReady?: (editor: Editor) => void;
}

function isEmptySnapshot(snapshot: Record<string, unknown>): boolean {
  return Object.keys(snapshot).length === 0;
}

export function BoardCanvas({
  boardId,
  initialSnapshot,
  readOnly = false,
  onEditorReady,
}: BoardCanvasProps) {
  const saveTimeoutRef = useRef<number | undefined>(undefined);
  // tldraw keeps its own color-mode preference; without this it ignores our
  // `dark` class and stays light while the rest of the app flips.
  const theme = useThemeStore((s) => s.theme);

  const handleMount = useCallback(
    (editor: Editor) => {
      onEditorReady?.(editor);

      if (readOnly) {
        editor.updateInstanceState({ isReadonly: true });
        return;
      }

      const unsubscribe = editor.store.listen(
        () => {
          window.clearTimeout(saveTimeoutRef.current);
          saveTimeoutRef.current = window.setTimeout(() => {
            const snapshot = editor.getSnapshot();
            void renderThumbnail(editor).then((thumbnail) =>
              updateBoardSnapshot(
                boardId,
                snapshot as unknown as Record<string, unknown>,
                thumbnail,
              ),
            );
          }, AUTOSAVE_DEBOUNCE_MS);
        },
        { source: 'user', scope: 'document' },
      );

      return () => {
        window.clearTimeout(saveTimeoutRef.current);
        unsubscribe();
      };
    },
    [boardId, readOnly, onEditorReady],
  );

  return (
    <div className="h-full w-full">
      <Tldraw
        snapshot={
          isEmptySnapshot(initialSnapshot)
            ? undefined
            : (initialSnapshot as unknown as TLEditorSnapshot)
        }
        colorScheme={theme}
        onMount={handleMount}
      >
        <PdfImporter readOnly={readOnly} />
      </Tldraw>
    </div>
  );
}
