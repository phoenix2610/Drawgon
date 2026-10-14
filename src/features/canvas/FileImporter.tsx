import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  defaultHandleExternalFileContent,
  useDefaultHelpers,
  useEditor,
  useToasts,
  useTranslation,
  useValue,
  type VecLike,
} from '@tldraw/tldraw';
import { Paperclip } from 'lucide-react';
import { MAX_PDF_PAGES, importPdfToCanvas, isPdf } from './import-pdf';
import { importFilesAsCards, isImageOrVideo } from './file-shape/import-files';

export const ACCEPTED_FILES_LABEL =
  'Images, video, PDF, Markdown, text, code, CSV, audio or any other file';

export function FileImporter() {
  const editor = useEditor();
  const helpers = useDefaultHelpers();
  const toasts = useToasts();
  const msg = useTranslation();
  const [busy, setBusy] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const readOnly = useValue('readOnly', () => editor.getIsReadonly(), [editor]);

  const importRef = useRef<(files: File[], point?: VecLike) => Promise<void>>(
    async () => {},
  );
  const importFiles = async (files: File[], point?: VecLike) => {
    if (editor.getIsReadonly()) return;
    const pdfs = files.filter(isPdf);
    const media = files.filter((f) => !isPdf(f) && isImageOrVideo(f));
    const other = files.filter((f) => !isPdf(f) && !isImageOrVideo(f));

    for (const pdf of pdfs) {
      setBusy('Reading PDF...');
      try {
        const pages = await importPdfToCanvas(editor, pdf, (done, total) =>
          setBusy(`Importing page ${done} of ${total}...`),
        );
        if (pages === MAX_PDF_PAGES) {
          helpers.addToast({
            title: 'Partial import',
            description: `Only the first ${MAX_PDF_PAGES} pages of ${pdf.name} were imported.`,
          });
        }
      } catch (e) {
        helpers.addToast({
          title: `Could not import ${pdf.name}`,
          description: e instanceof Error ? e.message : 'Unknown error.',
          severity: 'error',
        });
      }
    }

    if (media.length > 0) {
      await defaultHandleExternalFileContent(
        editor,
        { point, files: media },
        { toasts, msg },
      );
    }

    if (other.length > 0) {
      setBusy('Adding files...');
      const { rejected } = await importFilesAsCards(editor, other, point);
      for (const { name, reason } of rejected) {
        helpers.addToast({
          title: `Could not add ${name}`,
          description: `The file is ${reason}.`,
          severity: 'error',
        });
      }
    }
    setBusy(null);
  };

  useLayoutEffect(() => {
    importRef.current = importFiles;
  });

  useEffect(() => {
    editor.registerExternalContentHandler('files', ({ files, point }) =>
      importRef.current(files, point),
    );
  }, [editor]);

  if (readOnly) return null;

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = '';
          if (files.length > 0) void importRef.current(files);
        }}
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={busy !== null}
        title={`Add files to the board: ${ACCEPTED_FILES_LABEL}`}
        className="pointer-events-auto absolute left-1/2 top-3 z-[400] inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 shadow-md transition hover:bg-neutral-100 disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
      >
        <Paperclip size={13} />
        {busy ?? 'Add file'}
      </button>
    </>
  );
}
