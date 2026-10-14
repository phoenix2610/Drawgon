import type { FileKind, FileShape } from './file-shape-props';

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function parseCsv(
  text: string,
  delimiter = ',',
  maxRows = Infinity,
): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length && rows.length < maxRows; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"' && field === '') {
      quoted = true;
    } else if (char === delimiter) {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  if ((field !== '' || row.length > 0) && rows.length < maxRows) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const MARKDOWN = /\.(md|markdown|mdown|mkd|mdx)$/i;
const CSV = /\.(csv|tsv)$/i;
const CODE =
  /\.(js|jsx|mjs|cjs|ts|tsx|json|jsonc|py|rb|go|rs|java|kt|kts|swift|c|h|cc|cpp|hpp|cs|php|scala|sh|bash|zsh|ps1|sql|html|htm|css|scss|sass|less|xml|yaml|yml|toml|ini|env|vue|svelte|lua|r|dart|ex|exs|hs|pl|m|gradle|dockerfile|graphql|gql|proto)$/i;
const TEXT = /\.(txt|text|log|rtf|tex|srt|vtt|conf|cfg|gitignore)$/i;

export function classifyFile(file: File): FileKind {
  const type = file.type;
  if (MARKDOWN.test(file.name) || type === 'text/markdown') return 'markdown';
  if (CSV.test(file.name) || type === 'text/csv') return 'csv';
  if (CODE.test(file.name) || /^Dockerfile$|^Makefile$/i.test(file.name)) return 'code';
  if (type.startsWith('audio/')) return 'audio';
  if (TEXT.test(file.name) || type.startsWith('text/')) return 'text';
  if (type === 'application/json' || type === 'application/xml') return 'code';
  return 'file';
}

export function isTextKind(kind: FileKind) {
  return kind === 'markdown' || kind === 'text' || kind === 'code' || kind === 'csv';
}

export function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function downloadFileShape(shape: FileShape) {
  const { name, mimeType, content, src } = shape.props;
  const href = src
    ? src
    : URL.createObjectURL(new Blob([content], { type: mimeType || 'text/plain' }));
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = name;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  window.setTimeout(() => {
    anchor.remove();
    if (!src) URL.revokeObjectURL(href);
  }, 0);
}
