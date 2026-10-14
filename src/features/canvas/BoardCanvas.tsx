import { Tldraw, type Editor, type TLEditorSnapshot } from '@tldraw/tldraw';
import '@tldraw/tldraw/tldraw.css';
import { useThemeStore } from '@/store/theme';
import { customShapeUtils } from './canvas-config';

interface BoardCanvasProps {
  initialSnapshot: Record<string, unknown>;
  onEditorReady?: (editor: Editor) => void;
}

function isEmptySnapshot(snapshot: Record<string, unknown>): boolean {
  return Object.keys(snapshot).length === 0;
}

export function BoardCanvas({ initialSnapshot, onEditorReady }: BoardCanvasProps) {
  const theme = useThemeStore((s) => s.theme);

  return (
    <div className="h-full w-full">
      <Tldraw
        snapshot={
          isEmptySnapshot(initialSnapshot)
            ? undefined
            : (initialSnapshot as unknown as TLEditorSnapshot)
        }
        shapeUtils={customShapeUtils}
        colorScheme={theme}
        onMount={(editor) => {
          editor.updateInstanceState({ isReadonly: true });
          onEditorReady?.(editor);
        }}
        licenseKey={import.meta.env.VITE_TLDRAW_LICENSE_KEY}
      />
    </div>
  );
}
