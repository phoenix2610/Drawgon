import type { Editor, TLAssetStore } from '@tldraw/tldraw';
import { DocumentShapeUtil } from './documents/DocumentShapeUtil';
import { FileShapeUtil } from './file-shape/FileShapeUtil';
import { readAsDataUrl } from './file-shape/file-utils';

export const customShapeUtils = [FileShapeUtil, DocumentShapeUtil];

export const inlineAssetStore: TLAssetStore = {
  async upload(_asset, file) {
    return { src: await readAsDataUrl(file) };
  },
  resolve(asset) {
    return asset.props.src;
  },
};

const THUMBNAIL_WIDTH = 480;

export async function renderThumbnail(
  editor: Editor,
): Promise<string | undefined> {
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
