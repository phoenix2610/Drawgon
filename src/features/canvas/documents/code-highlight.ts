import hljs from 'highlight.js/lib/core';
import bash from 'highlight.js/lib/languages/bash';
import cpp from 'highlight.js/lib/languages/cpp';
import css from 'highlight.js/lib/languages/css';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import python from 'highlight.js/lib/languages/python';
import rust from 'highlight.js/lib/languages/rust';
import sql from 'highlight.js/lib/languages/sql';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import c from 'highlight.js/lib/languages/c';
import csharp from 'highlight.js/lib/languages/csharp';
import diff from 'highlight.js/lib/languages/diff';
import dockerfile from 'highlight.js/lib/languages/dockerfile';
import go from 'highlight.js/lib/languages/go';
import ini from 'highlight.js/lib/languages/ini';
import java from 'highlight.js/lib/languages/java';
import kotlin from 'highlight.js/lib/languages/kotlin';
import markdown from 'highlight.js/lib/languages/markdown';
import php from 'highlight.js/lib/languages/php';
import ruby from 'highlight.js/lib/languages/ruby';
import scss from 'highlight.js/lib/languages/scss';
import swift from 'highlight.js/lib/languages/swift';
import yaml from 'highlight.js/lib/languages/yaml';

hljs.registerLanguage('bash', bash);
hljs.registerLanguage('cpp', cpp);
hljs.registerLanguage('css', css);
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('json', json);
hljs.registerLanguage('python', python);
hljs.registerLanguage('rust', rust);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('c', c);
hljs.registerLanguage('csharp', csharp);
hljs.registerLanguage('diff', diff);
hljs.registerLanguage('dockerfile', dockerfile);
hljs.registerLanguage('go', go);
hljs.registerLanguage('ini', ini);
hljs.registerLanguage('java', java);
hljs.registerLanguage('kotlin', kotlin);
hljs.registerLanguage('markdown', markdown);
hljs.registerLanguage('php', php);
hljs.registerLanguage('ruby', ruby);
hljs.registerLanguage('scss', scss);
hljs.registerLanguage('swift', swift);
hljs.registerLanguage('yaml', yaml);

const ALIASES: Record<string, string> = { html: 'xml', shell: 'bash' };

const EXTENSIONS: Record<string, string> = {
  js: 'javascript', mjs: 'javascript', cjs: 'javascript', jsx: 'javascript',
  ts: 'typescript', tsx: 'typescript',
  py: 'python', rs: 'rust', go: 'go', java: 'java', kt: 'kotlin', swift: 'swift',
  c: 'c', h: 'c', cpp: 'cpp', cc: 'cpp', hpp: 'cpp', cs: 'csharp',
  rb: 'ruby', php: 'php', sql: 'sql',
  html: 'xml', htm: 'xml', xml: 'xml', svg: 'xml',
  css: 'css', scss: 'scss', json: 'json', yml: 'yaml', yaml: 'yaml',
  md: 'markdown', sh: 'bash', bash: 'bash', zsh: 'bash',
  toml: 'ini', ini: 'ini', env: 'ini', diff: 'diff', patch: 'diff',
  dockerfile: 'dockerfile',
};

export function languageForFile(fileName: string): string | null {
  const name = fileName.toLowerCase();
  const ext = name.includes('.') ? name.split('.').pop()! : name;
  return EXTENSIONS[ext] ?? null;
}

export function highlightLines(code: string, language: string | null): string[] {
  const html = language ? highlightCode(code, language) : escapeHtml(code);
  const open: string[] = [];
  return html.split('\n').map((line) => {
    const prefix = open.join('');
    for (const tag of line.match(/<span[^>]*>|<\/span>/g) ?? []) {
      if (tag === '</span>') open.pop();
      else open.push(tag);
    }
    return prefix + line + '</span>'.repeat(open.length);
  });
}

export function highlightCode(code: string, language: string): string {
  const lang = ALIASES[language] ?? language;
  if (!hljs.getLanguage(lang)) return escapeHtml(code);
  return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
}

function escapeHtml(text: string) {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
