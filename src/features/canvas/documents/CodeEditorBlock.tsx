import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Play,
  Copy,
  Check,
  Terminal,
  Code as CodeIcon,
  RotateCcw,
} from 'lucide-react';
import { highlightCode } from './code-highlight';

interface CodeEditorBlockProps {
  content: string;
  language?: string;
  onChange: (newContent: string) => void;
  onLanguageChange?: (newLang: string) => void;
  readOnly?: boolean;
  scale?: number;
  zoomLevel?: number;
}

const SUPPORTED_LANGUAGES = [
  { id: 'typescript', label: 'TypeScript' },
  { id: 'javascript', label: 'JavaScript' },
  { id: 'python', label: 'Python' },
  { id: 'html', label: 'HTML / Web' },
  { id: 'css', label: 'CSS' },
  { id: 'json', label: 'JSON' },
  { id: 'sql', label: 'SQL' },
  { id: 'rust', label: 'Rust' },
  { id: 'cpp', label: 'C++' },
  { id: 'shell', label: 'Bash / Shell' },
];

const MONO =
  'ui-monospace, "JetBrains Mono", "Cascadia Code", "Fira Code", Menlo, Consolas, monospace';
const RUN_TIMEOUT_MS = 3000;

const RUNNER_HTML = `<!doctype html><script>
window.addEventListener('message', (event) => {
  const send = (kind, args) => parent.postMessage({ kind, text: args.map((a) => {
    try { return typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a); }
    catch { return String(a); }
  }).join(' ') }, '*');
  console.log = (...a) => send('log', a);
  console.info = console.log;
  console.warn = (...a) => send('warn', a);
  console.error = (...a) => send('error', a);
  try { new Function(event.data)(); send('done', []); }
  catch (err) { send('error', ['Runtime Error: ' + (err && err.message)]); send('done', []); }
}, { once: true });
</script>`;

function stripTypes(source: string) {
  return source
    .replace(/interface\s+\w+[\s\S]*?}/g, '')
    .replace(/type\s+\w+\s*=[\s\S]*?;/g, '')
    .replace(/:\s*[A-Za-z0-9_<>[\]|&, ]+(?=[,)=;{])/g, '');
}

export function CodeEditorBlock({
  content,
  language = 'typescript',
  onChange,
  onLanguageChange,
  readOnly = false,
  scale = 1,
  zoomLevel: _zoomLevel = 1,
}: CodeEditorBlockProps) {
  const [activeTab, setActiveTab] = useState<'editor' | 'output'>('editor');
  const [outputLogs, setOutputLogs] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState(false);
  const [scroll, setScroll] = useState({ top: 0, left: 0 });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const runnerRef = useRef<HTMLIFrameElement | null>(null);

  const lines = useMemo(() => content.split('\n'), [content]);

  const highlighted = useMemo(
    () => highlightCode(content, language) + '\n',
    [content, language],
  );

  const fontSize = Math.max(10, Math.round(12.5 * scale));
  const lineHeight = Math.round(fontSize * 1.6);
  const textStyle = {
    fontFamily: MONO,
    fontSize: `${fontSize}px`,
    lineHeight: `${lineHeight}px`,
    tabSize: 2,
  } as const;

  useEffect(() => () => runnerRef.current?.remove(), []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (readOnly) return;
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = e.currentTarget;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      onChange(content.substring(0, start) + '  ' + content.substring(end));
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2;
      }, 0);
    }
  };

  const handleCopy = () => {
    void navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const runInSandbox = (source: string) => {
    runnerRef.current?.remove();
    const frame = document.createElement('iframe');
    frame.setAttribute('sandbox', 'allow-scripts');
    frame.style.display = 'none';
    frame.srcdoc = RUNNER_HTML;
    runnerRef.current = frame;

    const logs: string[] = [];
    let finished = false;
    const finish = (extra?: string) => {
      if (finished) return;
      finished = true;
      window.removeEventListener('message', onMessage);
      window.clearTimeout(timer);
      frame.remove();
      if (extra) logs.push(extra);
      if (logs.length === 0) logs.push('Execution completed with no console logs.');
      setOutputLogs([...logs]);
      setRunning(false);
    };
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frame.contentWindow) return;
      const { kind, text } = event.data as { kind: string; text: string };
      if (kind === 'done') return finish();
      logs.push(kind === 'log' ? text : `[${kind === 'warn' ? 'Warn' : 'Error'}] ${text}`);
      setOutputLogs([...logs]);
    };
    const timer = window.setTimeout(
      () => finish(`Stopped after ${RUN_TIMEOUT_MS / 1000}s without finishing.`),
      RUN_TIMEOUT_MS,
    );

    window.addEventListener('message', onMessage);
    frame.onload = () => frame.contentWindow?.postMessage(source, '*');
    document.body.appendChild(frame);
  };

  const runCode = () => {
    setActiveTab('output');
    setOutputLogs([]);

    if (language === 'javascript' || language === 'typescript') {
      setRunning(true);
      runInSandbox(language === 'typescript' ? stripTypes(content) : content);
    } else if (language === 'json') {
      try {
        const parsed = JSON.parse(content);
        setOutputLogs(['Valid JSON:', JSON.stringify(parsed, null, 2)]);
      } catch (e) {
        setOutputLogs([`Invalid JSON Error: ${(e as Error).message}`]);
      }
    } else if (language === 'html') {
      setOutputLogs(['Rendered below in a sandboxed preview.']);
    } else {
      setOutputLogs([
        `${language.toUpperCase()} cannot run in the browser.`,
        `${lines.length} lines, ${content.length} characters.`,
      ]);
    }
  };

  return (
    <div className="drawgon-code flex h-full w-full flex-col">
      <div
        className="flex shrink-0 items-center justify-between border-b px-2.5 py-1.5 text-xs"
        style={{ borderColor: 'var(--code-border)', background: 'var(--code-gutter-bg)' }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <select
            value={language}
            onChange={(e) => onLanguageChange?.(e.target.value)}
            disabled={readOnly}
            aria-label="Language"
            className="rounded border bg-transparent px-2 py-0.5 text-[11px] font-medium outline-none focus:border-brand"
            style={{ borderColor: 'var(--code-border)', color: 'var(--code-fg)' }}
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <option key={lang.id} value={lang.id}>
                {lang.label}
              </option>
            ))}
          </select>

          <div
            className="flex items-center rounded-lg p-0.5 text-[11px]"
            style={{ background: 'var(--code-border)' }}
          >
            {(
              [
                ['editor', 'Code', CodeIcon],
                ['output', 'Console', Terminal],
              ] as const
            ).map(([tab, label, Icon]) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className="flex items-center gap-1 rounded px-2 py-0.5 transition"
                style={
                  activeTab === tab
                    ? { background: 'var(--code-bg)', color: 'var(--code-fg)' }
                    : { color: 'var(--code-muted)' }
                }
              >
                <Icon size={11} />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={runCode}
            disabled={running}
            title="Run code or check syntax"
            className="flex items-center gap-1 rounded bg-brand/15 px-2 py-1 text-[11px] font-medium text-brand transition hover:bg-brand/25 disabled:opacity-50"
          >
            <Play size={11} className="fill-current" />
            <span>{running ? 'Running' : 'Run'}</span>
          </button>
          <button
            type="button"
            onClick={handleCopy}
            title="Copy code"
            aria-label="Copy code"
            className="rounded p-1 transition hover:bg-black/5 dark:hover:bg-white/10"
            style={{ color: 'var(--code-muted)' }}
          >
            {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
          </button>
        </div>
      </div>

      <div
        className="relative min-h-0 flex-1 overflow-hidden"
        onPointerDown={(e) => e.stopPropagation()}
      >
        {activeTab === 'editor' ? (
          <div className="flex h-full w-full">
            <div
              aria-hidden
              className="shrink-0 select-none overflow-hidden border-r text-right"
              style={{
                ...textStyle,
                borderColor: 'var(--code-border)',
                background: 'var(--code-gutter-bg)',
                color: 'var(--code-muted)',
              }}
            >
              <div style={{ padding: '12px 10px 12px 12px', transform: `translateY(${-scroll.top}px)` }}>
                {lines.map((_, i) => (
                  <div key={i}>{i + 1}</div>
                ))}
              </div>
            </div>

            <div className="relative min-w-0 flex-1">
              <pre
                aria-hidden
                className="pointer-events-none absolute inset-0 m-0 overflow-hidden whitespace-pre"
                style={{ ...textStyle, padding: 12 }}
              >
                <code
                  style={{
                    display: 'block',
                    transform: `translate(${-scroll.left}px, ${-scroll.top}px)`,
                  }}
                  dangerouslySetInnerHTML={{ __html: highlighted }}
                />
              </pre>
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={handleKeyDown}
                onScroll={(e) =>
                  setScroll({
                    top: e.currentTarget.scrollTop,
                    left: e.currentTarget.scrollLeft,
                  })
                }
                readOnly={readOnly}
                placeholder="// Write code here..."
                spellCheck={false}
                autoCapitalize="off"
                autoComplete="off"
                autoCorrect="off"
                wrap="off"
                aria-label="Code"
                className="absolute inset-0 h-full w-full resize-none overflow-auto whitespace-pre border-none bg-transparent outline-none"
                style={{
                  ...textStyle,
                  padding: 12,
                  color: 'transparent',
                  caretColor: 'var(--code-caret)',
                }}
              />
            </div>
          </div>
        ) : (
          <div className="h-full w-full overflow-auto p-3 text-xs" style={{ fontFamily: MONO }}>
            <div
              className="mb-2 flex items-center justify-between border-b pb-1 text-[11px]"
              style={{ borderColor: 'var(--code-border)', color: 'var(--code-muted)' }}
            >
              <span className="flex items-center gap-1">
                <Terminal size={12} /> Output
              </span>
              <button
                type="button"
                onClick={() => setOutputLogs([])}
                className="flex items-center gap-1 hover:underline"
              >
                <RotateCcw size={10} /> Clear
              </button>
            </div>
            {outputLogs.length === 0 ? (
              <div className="py-2 italic" style={{ color: 'var(--code-muted)' }}>
                {running ? 'Running…' : 'Click Run to execute and see console output.'}
              </div>
            ) : (
              <pre className="whitespace-pre-wrap leading-relaxed">{outputLogs.join('\n')}</pre>
            )}

            {language === 'html' && (
              <div className="mt-4 overflow-hidden rounded border" style={{ borderColor: 'var(--code-border)' }}>
                <p className="bg-neutral-100 px-2 py-1 text-[10px] font-bold uppercase text-neutral-500">
                  Rendered preview
                </p>
                <iframe
                  title="HTML preview"
                  sandbox=""
                  srcDoc={content}
                  className="h-64 w-full bg-white"
                />
              </div>
            )}
          </div>
        )}
      </div>

      <div
        className="flex shrink-0 items-center justify-between border-t px-3 py-1 text-[10px]"
        style={{ borderColor: 'var(--code-border)', background: 'var(--code-gutter-bg)', color: 'var(--code-muted)' }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <span>Tab = 2 spaces</span>
        <span>
          {lines.length} {lines.length === 1 ? 'line' : 'lines'} · {content.length} chars
        </span>
      </div>
    </div>
  );
}
