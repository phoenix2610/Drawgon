import { jsPDF } from 'jspdf';
import type { Editor } from '@tldraw/tldraw';

/** Thrown when there is nothing on the canvas worth exporting. */
export class EmptyBoardError extends Error {
  constructor() {
    super('This board is empty — draw something before exporting.');
    this.name = 'EmptyBoardError';
  }
}

function shapeIds(editor: Editor) {
  const ids = [...editor.getCurrentPageShapeIds()];
  if (ids.length === 0) throw new EmptyBoardError();
  return ids;
}

/** Exports always render light-on-white so they read correctly off-screen. */
const EXPORT_OPTS = {
  background: true,
  darkMode: false,
  padding: 32,
} as const;

function safeFilename(title: string) {
  const base = title.trim().replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '');
  return base.toLowerCase() || 'drawgon-board';
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  // The anchor must be connected, and the blob URL must outlive the click —
  // revoking synchronously cancels the download before it starts.
  document.body.appendChild(anchor);
  anchor.click();
  window.setTimeout(() => {
    anchor.remove();
    URL.revokeObjectURL(url);
  }, 0);
}

export async function exportPng(editor: Editor, title: string) {
  const { blob } = await editor.toImage(shapeIds(editor), {
    ...EXPORT_OPTS,
    format: 'png',
    scale: 2,
  });
  triggerDownload(blob, `${safeFilename(title)}.png`);
}

export async function exportSvg(editor: Editor, title: string) {
  const { blob } = await editor.toImage(shapeIds(editor), {
    ...EXPORT_OPTS,
    format: 'svg',
  });
  triggerDownload(blob, `${safeFilename(title)}.svg`);
}

export async function exportPdf(editor: Editor, title: string) {
  const { url, width, height } = await editor.toImageDataUrl(shapeIds(editor), {
    ...EXPORT_OPTS,
    format: 'png',
    scale: 2,
  });

  // Size the page to the drawing so nothing is cropped or letterboxed.
  const doc = new jsPDF({
    orientation: width >= height ? 'landscape' : 'portrait',
    unit: 'px',
    format: [width, height],
  });
  // 'FAST' compression — an uncompressed full-page bitmap runs to megabytes.
  doc.addImage(url, 'PNG', 0, 0, width, height, undefined, 'FAST');
  doc.save(`${safeFilename(title)}.pdf`);
}
