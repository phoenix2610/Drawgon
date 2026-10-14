import { DefaultStylePanel, DefaultToolbar } from '@tldraw/tldraw';
import { DocumentToolbar } from './documents/DocumentToolbar';

export function LeftStylePanel() {
  return (
    <div className="pointer-events-auto absolute left-2 top-1/2 -translate-y-1/2 z-[400]">
      <DefaultStylePanel />
    </div>
  );
}

export function CustomToolbar(props: Parameters<typeof DefaultToolbar>[0]) {
  return (
    <div className="flex items-end gap-2">
      <div className="pb-[calc(var(--tl-space-3)+var(--tl-sab))] pointer-events-auto">
        <DocumentToolbar />
      </div>
      <DefaultToolbar {...props} />
    </div>
  );
}
