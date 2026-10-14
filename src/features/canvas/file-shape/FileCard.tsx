import { useEffect, useMemo, useRef, type CSSProperties } from 'react';
import { stopEventPropagation, useIsEditing } from '@tldraw/tldraw';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Download,
  File as FileIcon,
  FileAudio,
  FileCode,
  FileSpreadsheet,
  FileText,
  NotebookText,
} from 'lucide-react';
import type { FileKind, FileShape } from './file-shape-props';
import { downloadFileShape, formatBytes, parseCsv } from './file-utils';

const KIND_ICON: Record<FileKind, typeof FileIcon> = {
  markdown: NotebookText,
  text: FileText,
  code: FileCode,
  csv: FileSpreadsheet,
  audio: FileAudio,
  file: FileIcon,
};

const MAX_CSV_ROWS = 200;

export function FileCard({ shape }: { shape: FileShape }) {
  const { name, size, kind } = shape.props;
  const isEditing = useIsEditing(shape.id);
  const bodyRef = useRef<HTMLDivElement>(null);
  const Icon = KIND_ICON[kind];

  useEffect(() => {
    const body = bodyRef.current;
    if (!body || !isEditing) return;
    const stop = (e: WheelEvent) => e.stopPropagation();
    body.addEventListener('wheel', stop, { passive: true });
    return () => body.removeEventListener('wheel', stop);
  }, [isEditing]);

  return (
    <div style={cardStyle}>
      <div style={headerStyle}>
        <Icon size={16} style={{ flexShrink: 0, color: 'var(--tl-color-primary)' }} />
        <span style={titleStyle} title={name}>
          {name}
        </span>
        <span style={metaStyle}>{formatBytes(size)}</span>
        <button
          type="button"
          title={`Download ${name}`}
          aria-label={`Download ${name}`}
          onPointerDown={stopEventPropagation}
          onClick={() => downloadFileShape(shape)}
          style={downloadStyle}
        >
          <Download size={14} />
        </button>
      </div>
      <div
        ref={bodyRef}
        className="drawgon-file-body"
        style={{
          ...bodyStyle,
          overflow: isEditing ? 'auto' : 'hidden',
          pointerEvents: isEditing ? 'all' : 'none',
          userSelect: isEditing ? 'text' : 'none',
        }}
        onPointerDown={isEditing ? stopEventPropagation : undefined}
      >
        <FileBody shape={shape} />
      </div>
      {!isEditing && kind !== 'file' && kind !== 'audio' && (
        <div style={hintStyle}>Double-click to scroll</div>
      )}
    </div>
  );
}

function FileBody({ shape }: { shape: FileShape }) {
  const { kind, content, src, name, mimeType } = shape.props;

  switch (kind) {
    case 'markdown':
      return (
        <div className="drawgon-markdown">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              a: ({ node: _node, ...props }) => (
                <a {...props} target="_blank" rel="noreferrer noopener" />
              ),
            }}
          >
            {content}
          </ReactMarkdown>
        </div>
      );
    case 'csv':
      return <CsvTable content={content} delimiter={/\.tsv$/i.test(name) ? '\t' : ','} />;
    case 'audio':
      return (
        <audio
          controls
          src={src}
          style={{ width: '100%', pointerEvents: 'all' }}
          onPointerDown={stopEventPropagation}
        />
      );
    case 'file':
      return (
        <div style={placeholderStyle}>
          <span style={extensionStyle}>{extensionOf(name) || 'FILE'}</span>
          <span>{mimeType || 'Unknown type'}</span>
        </div>
      );
    default:
      return <pre style={preStyle}>{content}</pre>;
  }
}

function CsvTable({ content, delimiter }: { content: string; delimiter: string }) {
  const rows = useMemo(() => parseCsv(content, delimiter, MAX_CSV_ROWS + 1), [content, delimiter]);
  if (rows.length === 0) return <pre style={preStyle}>{content}</pre>;
  const [head, ...body] = rows;
  return (
    <table className="drawgon-csv">
      <thead>
        <tr>
          {head.map((cell, i) => (
            <th key={i}>{cell}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {body.slice(0, MAX_CSV_ROWS - 1).map((row, r) => (
          <tr key={r}>
            {row.map((cell, i) => (
              <td key={i}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function extensionOf(name: string) {
  const match = /\.([a-z0-9]{1,8})$/i.exec(name);
  return match ? match[1].toUpperCase() : '';
}

const cardStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  borderRadius: 10,
  overflow: 'hidden',
  background: 'var(--tl-color-panel)',
  color: 'var(--tl-color-text)',
  border: '1px solid var(--tl-color-divider)',
  boxShadow: 'var(--tl-shadow-2)',
  fontFamily: 'var(--tl-font-sans, system-ui, sans-serif)',
  position: 'relative',
};

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 10px',
  borderBottom: '1px solid var(--tl-color-divider)',
  background: 'var(--tl-color-low)',
  fontSize: 13,
};

const titleStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  fontWeight: 600,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const metaStyle: CSSProperties = {
  flexShrink: 0,
  fontSize: 11,
  color: 'var(--tl-color-text-3)',
};

const downloadStyle: CSSProperties = {
  flexShrink: 0,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 26,
  height: 26,
  borderRadius: 6,
  border: 'none',
  background: 'transparent',
  color: 'var(--tl-color-text-1)',
  cursor: 'pointer',
  pointerEvents: 'all',
};

const bodyStyle: CSSProperties = {
  flex: 1,
  minHeight: 0,
  padding: '10px 14px',
  fontSize: 13,
  lineHeight: 1.55,
};

const preStyle: CSSProperties = {
  margin: 0,
  fontFamily: 'var(--tl-font-mono, ui-monospace, monospace)',
  fontSize: 12,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
};

const placeholderStyle: CSSProperties = {
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  fontSize: 12,
  color: 'var(--tl-color-text-3)',
};

const extensionStyle: CSSProperties = {
  fontSize: 22,
  fontWeight: 700,
  letterSpacing: 1,
  color: 'var(--tl-color-text-1)',
};

const hintStyle: CSSProperties = {
  position: 'absolute',
  right: 8,
  bottom: 6,
  fontSize: 10,
  color: 'var(--tl-color-text-3)',
  background: 'var(--tl-color-panel)',
  padding: '1px 6px',
  borderRadius: 4,
  opacity: 0.85,
};
