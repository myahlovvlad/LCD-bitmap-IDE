import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const ROOTS = ['src/renderer', 'src/features'];
const LOCALIZED_ATTRIBUTES = new Set(['title', 'aria-label', 'placeholder', 'alt']);
const TECHNICAL_TEXT = new Set([
  'English', 'Русский', '中文',
  'v', '/ schema 6', 'x', 'bytes', 'LCD', 'ID:', 'CLI', 'CSV',
  'RU', 'EN', 'ZH', 'CH',
  'Mermaid stateDiagram-v2', 'LCD-bitmap IDE Python DSL',
  'LCD-bitmap IDE',
  'Renderer error / Ошибка интерфейса / 界面错误',
  'Reload / Перезапустить / 重新加载',
  '· 1bpp · vertical-LSB',
  'C/H · BIN · XBM · Arduino · Rust',
  'CSV · JSON · RU/EN/ZH ·',
  '· SHA-256',
  'http://127.0.0.1:', '/mcp',
  'Beer-Lambert / ECROS.ABSORBANCE',
  'ECROS.RESULT.%T_A',
  'ELK Layout',
  'Auto',
  'CLI ·',
  'Z ·',
  'HMI Designer',
  'Runtime'
]);

describe('GUI localization coverage', () => {
  it('does not introduce unlocalized user-facing JSX literals', () => {
    const findings = collectTsxFiles()
      .flatMap(findUnlocalizedLiterals);

    expect(findings, findings.join('\n')).toEqual([]);
  });
});

function collectTsxFiles(): string[] {
  const result: string[] = [];
  const walk = (directory: string): void => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === 'graphify-out') continue;
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(target);
      else if (target.endsWith('.tsx')) result.push(target);
    }
  };
  ROOTS.forEach((root) => walk(path.join(process.cwd(), root)));
  return result;
}

function findUnlocalizedLiterals(filename: string): string[] {
  const source = fs.readFileSync(filename, 'utf8');
  const file = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const findings: string[] = [];

  const inspect = (node: ts.Node): void => {
    if (ts.isJsxText(node)) {
      check(node, node.text.replace(/\s+/g, ' ').trim(), 'text');
    } else if (
      ts.isJsxAttribute(node)
      && node.initializer
      && ts.isStringLiteral(node.initializer)
      && LOCALIZED_ATTRIBUTES.has(node.name.text)
    ) {
      check(node, node.initializer.text, node.name.text);
    }
    ts.forEachChild(node, inspect);
  };

  const check = (node: ts.Node, value: string, kind: string): void => {
    if (!/[A-Za-zА-Яа-я\u3400-\u9fff]/u.test(value) || isTechnical(value)) return;
    const line = file.getLineAndCharacterOfPosition(node.pos).line + 1;
    findings.push(`${path.relative(process.cwd(), filename)}:${line}:${kind}:${value}`);
  };

  inspect(file);
  return findings;
}

function isTechnical(value: string): boolean {
  return TECHNICAL_TEXT.has(value)
    || /^@[A-Za-z0-9_. -]+(?:\s+or\s+true\/false)?$/.test(value)
    || value === 'tag-id'
    || value === 'value'
    || value === 'Math.log10(x)';
}
