import { BaseBoxShapeUtil, HTMLContainer } from '@tldraw/tldraw';
import { FILE_SHAPE_TYPE, fileShapeProps, type FileShape } from './file-shape-props';
import { FileCard } from './FileCard';

export class FileShapeUtil extends BaseBoxShapeUtil<FileShape> {
  static override type = FILE_SHAPE_TYPE;
  static override props = fileShapeProps;

  override getDefaultProps(): FileShape['props'] {
    return {
      w: 420,
      h: 360,
      name: 'Untitled',
      mimeType: 'text/plain',
      size: 0,
      kind: 'text',
      content: '',
      src: '',
    };
  }

  override canEdit() {
    return true;
  }

  override canEditInReadonly() {
    return true;
  }

  override component(shape: FileShape) {
    return (
      <HTMLContainer>
        <FileCard shape={shape} />
      </HTMLContainer>
    );
  }

  override getIndicatorPath(shape: FileShape) {
    const path = new Path2D();
    path.roundRect(0, 0, shape.props.w, shape.props.h, 10);
    return path;
  }
}
