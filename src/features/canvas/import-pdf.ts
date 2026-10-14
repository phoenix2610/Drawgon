import {
  AssetRecordType,
  createShapeId,
  type Editor,
  type TLAssetId,
  type TLImageShape,
} from '@tldraw/tldraw';

const RENDER_SCALE = 2;

export const MAX_PDF_PAGES = 30;
const PAGE_GAP = 32;

export class PdfImportError extends Error {}

export async function loadPdfJs() {
  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  return pdfjs;
}

async function pageToDataUrl(
  page: { getViewport: (o: { scale: number }) => { width: number; height: number }; render: (o: never) => { promise: Promise<void> } },
): Promise<{ url: string; width: number; height: number }> {
  const viewport = page.getViewport({ scale: RENDER_SCALE });
  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const context = canvas.getContext('2d');
  if (!context) throw new PdfImportError('Could not get a 2D canvas context.');

  await page.render({ canvasContext: context, viewport } as never).promise;
  
  
  
  return {
    url: canvas.toDataURL('image/jpeg', 0.82),
    width: canvas.width,
    height: canvas.height,
  };
}

export async function importPdfToCanvas(
  editor: Editor,
  file: File,
  onProgress?: (done: number, total: number) => void,
): Promise<number> {
  const pdfjs = await loadPdfJs();
  const data = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data }).promise;

  const total = Math.min(doc.numPages, MAX_PDF_PAGES);
  if (total === 0) throw new PdfImportError('That PDF has no pages.');

  
  const centre = editor.getViewportPageBounds().center;
  let cursorY = centre.y;
  const shapeIds = [];

  for (let pageNo = 1; pageNo <= total; pageNo++) {
    const page = await doc.getPage(pageNo);
    const { url, width, height } = await pageToDataUrl(page);

    
    const w = width / RENDER_SCALE;
    const h = height / RENDER_SCALE;

    const assetId: TLAssetId = AssetRecordType.createId();
    editor.createAssets([
      AssetRecordType.create({
        id: assetId,
        type: 'image',
        typeName: 'asset',
        props: {
          name: `${file.name} — page ${pageNo}`,
          src: url,
          w: width,
          h: height,
          mimeType: 'image/jpeg',
          isAnimated: false,
        },
      }),
    ]);

    const shapeId = createShapeId();
    shapeIds.push(shapeId);
    editor.createShapes<TLImageShape>([
      {
        id: shapeId,
        type: 'image',
        x: centre.x - w / 2,
        y: cursorY,
        props: { assetId, w, h },
      },
    ]);

    cursorY += h + PAGE_GAP;
    onProgress?.(pageNo, total);
  }

  editor.setSelectedShapes(shapeIds);
  editor.zoomToSelection();
  return total;
}

export function isPdf(file: File) {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
}
