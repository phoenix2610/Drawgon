import {
  createTLSchema,
  defaultBindingSchemas,
  defaultShapeSchemas,
} from '@tldraw/tlschema';
import { T } from '@tldraw/validate';

const documentBlockProps = {
  w: T.number,
  h: T.number,
  docType: T.string,
  title: T.string,
  content: T.string,
  meta: T.jsonValue,
};

const fileShapeProps = {
  w: T.nonZeroNumber,
  h: T.nonZeroNumber,
  name: T.string,
  mimeType: T.string,
  size: T.number,
  kind: T.literalEnum('markdown', 'text', 'code', 'csv', 'audio', 'file'),
  content: T.string,
  src: T.string,
};

export const boardSchema = createTLSchema({
  shapes: {
    ...defaultShapeSchemas,
    'drawgon-file': { props: fileShapeProps },
    document_block: { props: documentBlockProps },
  },
  bindings: defaultBindingSchemas,
});
