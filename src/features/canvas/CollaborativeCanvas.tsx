import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Tldraw,
  UserRecordType,
  atom,
  createUserId,
  defaultBindingUtils,
  defaultShapeUtils,
  useEditor,
  useValue,
  type Editor,
  type TLComponents,
  type TLUserStore,
} from '@tldraw/tldraw';
import { useSync } from '@tldraw/sync';
import '@tldraw/tldraw/tldraw.css';
import { WifiOff } from 'lucide-react';
import { API_BASE_URL } from '@/lib/api-client';
import { updateBoardThumbnail } from '@/lib/boards-api';
import { useThemeStore } from '@/store/theme';
import { useMediaQuery, WIDE_LAYOUT_QUERY } from '@/hooks/useMediaQuery';
import { DrawgonLoader } from '@/components/DrawgonLoader';
import { customShapeUtils, inlineAssetStore, renderThumbnail } from './canvas-config';
import { FileImporter } from './FileImporter';
import { CustomToolbar, LeftStylePanel } from './canvas-components';

const THUMBNAIL_DEBOUNCE_MS = 3000;

const CURSOR_COLORS = [
  '#e03131', '#f76707', '#f59f00', '#2f9e44', '#0c8599',
  '#1971c2', '#6741d9', '#c2255c', '#5c940d', '#862e9c',
];

const syncShapeUtils = [...defaultShapeUtils, ...customShapeUtils];

const compactComponents: TLComponents = {
  Toolbar: CustomToolbar,
};

const editingComponents: TLComponents = {
  StylePanel: LeftStylePanel,
  Toolbar: CustomToolbar,
};

function colorFor(userId: string) {
  let hash = 0;
  for (const char of userId) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return CURSOR_COLORS[Math.abs(hash) % CURSOR_COLORS.length];
}

function syncUri(boardId: string) {
  return `${API_BASE_URL.replace(/^http/, 'ws')}/sync/${encodeURIComponent(boardId)}`;
}

const SYNC_ERRORS: Record<string, string> = {
  NOT_FOUND: 'This board no longer exists, or it is no longer shared with you.',
  FORBIDDEN: 'Your access to this board was removed.',
  NOT_AUTHENTICATED: 'Your session expired. Sign in again to keep editing.',
  CLIENT_TOO_OLD: 'Drawgon was updated. Reload the page to keep editing.',
};

export interface ActivePerson {
  userId: string;
  name: string;
  color: string;
}

interface CollaborativeCanvasProps {
  boardId: string;
  user: { id: string; name: string };
  onEditorReady?: (editor: Editor) => void;

  onPresenceChange?: (people: ActivePerson[]) => void;
}

function PresenceReporter({
  self,
  onChange,
}: {
  self: ActivePerson;
  onChange?: (people: ActivePerson[]) => void;
}) {
  const editor = useEditor();
  const others = useValue(
    'collaborators',
    () =>
      editor.getCollaborators().map((c) => ({
        userId: c.userId,
        name: c.userName || 'Someone',
        color: c.color,
      })),
    [editor],
  );
  useEffect(() => {
    const unique = new Map([self, ...others].map((p) => [p.userId, p]));
    onChange?.([...unique.values()]);
  }, [others, self, onChange]);
  return null;
}

export function CollaborativeCanvas({
  boardId,
  user,
  onEditorReady,
  onPresenceChange,
}: CollaborativeCanvasProps) {
  const theme = useThemeStore((s) => s.theme);
  const isWide = useMediaQuery(WIDE_LAYOUT_QUERY);
  const thumbnailTimer = useRef<number | undefined>(undefined);

  const users = useMemo<TLUserStore>(
    () => ({
      currentUser: atom(
        'currentUser',
        UserRecordType.create({
          id: createUserId(user.id),
          name: user.name,
          color: colorFor(user.id),
        }),
      ),
    }),
    [user.id, user.name],
  );

  const self = useMemo(
    () => ({ userId: user.id, name: user.name, color: colorFor(user.id) }),
    [user.id, user.name],
  );

  const store = useSync({
    uri: syncUri(boardId),
    assets: inlineAssetStore,
    shapeUtils: syncShapeUtils,
    bindingUtils: defaultBindingUtils,
    users,
  });

  const handleMount = useCallback(
    (editor: Editor) => {
      onEditorReady?.(editor);
      const unsubscribe = editor.store.listen(
        () => {
          if (editor.getIsReadonly()) return;
          window.clearTimeout(thumbnailTimer.current);
          thumbnailTimer.current = window.setTimeout(() => {
            void renderThumbnail(editor).then((thumbnail) => {
              if (thumbnail) void updateBoardThumbnail(boardId, thumbnail);
            });
          }, THUMBNAIL_DEBOUNCE_MS);
        },
        { source: 'user', scope: 'document' },
      );
      return () => {
        window.clearTimeout(thumbnailTimer.current);
        unsubscribe();
      };
    },
    [boardId, onEditorReady],
  );

  if (store.status === 'error') {
    const reason = (store.error as { reason?: string }).reason ?? '';
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm text-neutral-600 dark:text-neutral-300">
          {SYNC_ERRORS[reason] ?? 'Lost the connection to this board.'}
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-full bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover"
        >
          Reload
        </button>
      </div>
    );
  }

  if (store.status === 'loading') {
    return <DrawgonLoader fullScreen={false} label="Joining board..." />;
  }

  return (
    <div className="relative h-full w-full">
      <Tldraw
        store={store}
        shapeUtils={customShapeUtils}
        components={isWide ? editingComponents : compactComponents}
        colorScheme={theme}
        onMount={handleMount}
        licenseKey={import.meta.env.VITE_TLDRAW_LICENSE_KEY}
      >
        <FileImporter />
        <PresenceReporter self={self} onChange={onPresenceChange} />
      </Tldraw>
      {store.connectionStatus === 'offline' && (
        <div className="pointer-events-none absolute right-3 top-14 z-[400] inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800 shadow dark:bg-amber-500/15 dark:text-amber-300">
          <WifiOff size={12} />
          Reconnecting... your changes will sync when you are back
        </div>
      )}
    </div>
  );
}
