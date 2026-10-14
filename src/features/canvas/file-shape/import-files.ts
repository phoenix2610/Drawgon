import { createShapeId, type Editor, type TLShapeId, type VecLike } from '@tldraw/tldraw';
import { FILE_SHAPE_TYPE, type FileKind } from './file-shape-props';
import { classifyFile, formatBytes, isTextKind, readAsDataUrl } from './file-utils';

export const MAX_TEXT_BYTES = 1024 * 1024;

export const MAX_BINARY_BYTES = 8 * 1024 * 1024;

const SIZES: Record<FileKind, { w: number; h: number }> = {
  markdown: { w: 460, h: 420 },
  text: { w: 440, h: 360 },
  code: { w: 480, h: 380 },
  csv: { w: 520, h: 340 },
  audio: { w: 360, h: 120 },
  file: { w: 280, h: 160 },
};

const GAP = 24;

export function isImageOrVideo(file: File) {

  if (isTextKind(classifyFile(file))) return false;
  return file.type.startsWith('image/') || file.type.startsWith('video/');
}

export async function importFilesAsCards(
  editor: Editor,
  files: File[],
  point?: VecLike,
): Promise<{ created: number; rejected: { name: string; reason: string }[] }> {
  const rejected: { name: string; reason: string }[] = [];
  const shapes: {
    kind: FileKind;
    file: File;
    content: string;
    src: string;
  }[] = [];

  for (const file of files) {
    const kind = classifyFile(file);
    const limit = isTextKind(kind) ? MAX_TEXT_BYTES : MAX_BINARY_BYTES;
    if (file.size > limit) {
      rejected.push({
        name: file.name,
        reason: `larger than ${formatBytes(limit)}`,
      });
      continue;
    }
    try {
      shapes.push({
        kind,
        file,
        content: isTextKind(kind) ? await file.text() : '',
        src: isTextKind(kind) ? '' : await readAsDataUrl(file),
      });
    } catch {
      rejected.push({ name: file.name, reason: 'could not be read' });
    }
  }

  if (shapes.length === 0) return { created: 0, rejected };

  const columns = Math.min(3, shapes.length);
  const cellW = Math.max(...shapes.map((s) => SIZES[s.kind].w)) + GAP;
  const rowHeights: number[] = [];
  shapes.forEach((s, i) => {
    const row = Math.floor(i / columns);
    rowHeights[row] = Math.max(rowHeights[row] ?? 0, SIZES[s.kind].h + GAP);
  });
  const totalH = rowHeights.reduce((a, b) => a + b, 0);
  const origin = point ?? editor.getViewportPageBounds().center;
  const left = origin.x - (columns * cellW) / 2;
  const top = origin.y - totalH / 2;
  const ids: TLShapeId[] = [];

  editor.run(() => {
    shapes.forEach(({ kind, file, content, src }, i) => {
      const { w, h } = SIZES[kind];
      const row = Math.floor(i / columns);
      const id = createShapeId();
      ids.push(id);
      editor.createShape({
        id,
        type: FILE_SHAPE_TYPE,
        x: left + (i % columns) * cellW,
        y: top + rowHeights.slice(0, row).reduce((a, b) => a + b, 0),
        props: {
          w,
          h,
          name: file.name,
          mimeType: file.type,
          size: file.size,
          kind,
          content,
          src,
        },
      });
    });
  });

  editor.select(...ids);
  if (!point) editor.zoomToSelection({ animation: { duration: 200 } });
  return { created: ids.length, rejected };
}
