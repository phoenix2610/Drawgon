import { T, type RecordProps, type TLShape } from '@tldraw/tldraw';

export const FILE_SHAPE_TYPE = 'drawgon-file';

export const FILE_KINDS = [
  'markdown',
  'text',
  'code',
  'csv',
  'audio',
  'file',
] as const;

export type FileKind = (typeof FILE_KINDS)[number];

export interface FileShapeProps {
  w: number;
  h: number;
  name: string;
  mimeType: string;
  size: number;
  kind: FileKind;

  content: string;

  src: string;
}

declare module '@tldraw/tlschema' {
  interface TLGlobalShapePropsMap {
    'drawgon-file': FileShapeProps;
  }
}

export type FileShape = TLShape<typeof FILE_SHAPE_TYPE>;

export const fileShapeProps: RecordProps<FileShape> = {
  w: T.nonZeroNumber,
  h: T.nonZeroNumber,
  name: T.string,
  mimeType: T.string,
  size: T.number,
  kind: T.literalEnum(...FILE_KINDS),
  content: T.string,
  src: T.string,
};
