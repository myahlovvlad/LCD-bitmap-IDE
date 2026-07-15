import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import type { CanvasObject as DomainCanvasObject } from '../../src/domain';
import type { CanvasObject as RendererCanvasObject } from '../../src/renderer/types/domain';

type IsSameType<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2)
  ? (<T>() => T extends B ? 1 : 2) extends (<T>() => T extends A ? 1 : 2)
    ? true
    : false
  : false;

type Assert<T extends true> = T;
type RendererDomainFacadeContract = Assert<IsSameType<DomainCanvasObject, RendererCanvasObject>>;

const _rendererDomainFacadeContract: RendererDomainFacadeContract = true;

const PROTECTED_ROOTS = [
  'src/application',
  'src/compiler',
  'src/domain',
  'src/fsm-interchange',
  'src/model',
  'src/screen-dsl',
  'src/screen-interchange',
  'src/services',
  'src/entities'
] as const;

const FORBIDDEN_PACKAGES = new Set([
  '@xyflow/react',
  'electron',
  'react',
  'react-dom',
  'react-dom/client',
  'zustand'
]);

interface BoundaryViolation {
  file: string;
  importPath: string;
  rule: string;
}

const SCREEN_DSL_STUDIO_FORBIDDEN_PACKAGES = new Set([
  'yaml',
  'js-yaml',
  '@stoplight/yaml',
  'electron',
  'node:fs',
  'node:path',
  'fs',
  'path'
]);

const SCREEN_DSL_STUDIO_FORBIDDEN_INTERNAL = [
  'src/application/screenDsl/parser',
  'src/application/screenDsl/changeSet',
  'src/application/screenDsl/mapper',
];

describe('architecture boundaries', () => {
  it('keeps application, domain, model, services and entities independent from renderer UI infrastructure', () => {
    const violations = collectBoundaryViolations();

    expect(violations).toEqual([]);
  });

  it('src/features/screen-dsl-studio/ does not import parsers, YAML libs, ChangeSet, fs, path, or Electron', () => {
    const root = process.cwd();
    const studioDir = path.join(root, 'src/features/screen-dsl-studio');
    const files = collectTypeScriptFiles(studioDir);
    const violations: string[] = [];

    for (const file of files) {
      const source = ts.createSourceFile(
        file,
        readFileSync(file, 'utf8'),
        ts.ScriptTarget.Latest,
        true,
        file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
      );
      const relFile = normalizePath(path.relative(root, file));
      for (const specifier of collectModuleSpecifiers(source)) {
        if (SCREEN_DSL_STUDIO_FORBIDDEN_PACKAGES.has(specifier)) {
          violations.push(`${relFile}: imports forbidden package ${specifier}`);
        }
        const internalTarget = resolveInternalImport(root, file, specifier);
        if (internalTarget) {
          for (const forbidden of SCREEN_DSL_STUDIO_FORBIDDEN_INTERNAL) {
            if (internalTarget.startsWith(forbidden)) {
              violations.push(`${relFile}: imports forbidden internal module ${specifier}`);
            }
          }
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('src/application/ screenDsl layer does not import React, Zustand, or Electron', () => {
    const root = process.cwd();
    const appDir = path.join(root, 'src/application');
    const files = collectTypeScriptFiles(appDir);
    const violations: string[] = [];

    for (const file of files) {
      const source = ts.createSourceFile(
        file,
        readFileSync(file, 'utf8'),
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS
      );
      for (const specifier of collectModuleSpecifiers(source)) {
        if (FORBIDDEN_PACKAGES.has(specifier)) {
          violations.push(`${normalizePath(path.relative(root, file))}: imports ${specifier}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('screenDslSession layer has no React, Zustand, or Electron imports', () => {
    const root = process.cwd();
    const sessionDir = path.join(root, 'src/application/screenDslSession');
    const files = collectTypeScriptFiles(sessionDir);
    const violations: string[] = [];

    for (const file of files) {
      const source = ts.createSourceFile(
        file,
        readFileSync(file, 'utf8'),
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS
      );
      for (const specifier of collectModuleSpecifiers(source)) {
        if (FORBIDDEN_PACKAGES.has(specifier)) {
          violations.push(`${path.relative(root, file)}: imports ${specifier}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('screenDslSession layer does not import renderer or feature modules', () => {
    const root = process.cwd();
    const sessionDir = path.join(root, 'src/application/screenDslSession');
    const files = collectTypeScriptFiles(sessionDir);
    const violations: string[] = [];

    for (const file of files) {
      const source = ts.createSourceFile(
        file,
        readFileSync(file, 'utf8'),
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS
      );
      for (const specifier of collectModuleSpecifiers(source)) {
        const internalTarget = resolveInternalImport(root, file, specifier);
        if (internalTarget?.startsWith('src/renderer/') || internalTarget?.startsWith('src/features/')) {
          violations.push(`${path.relative(root, file)}: imports ${specifier}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('Screen DSL file workflow keeps a narrow preload IPC boundary', () => {
    const root = process.cwd();
    const preload = readFileSync(path.join(root, 'src/preload/preload.cts'), 'utf8');
    const main = readFileSync(path.join(root, 'src/main/main.ts'), 'utf8');
    const adapter = readFileSync(path.join(root, 'src/features/screen-dsl-studio/screenDslFileAdapter.ts'), 'utf8');

    expect(preload).toContain("screenDslFiles:");
    expect(preload).toContain('SCREEN_DSL_FILE_OPEN_CHANNEL');
    expect(preload).toContain('SCREEN_DSL_FILE_SAVE_CHANNEL');
    expect(preload).not.toContain('ipcRenderer:');
    expect(preload).not.toContain('invoke: ipcRenderer.invoke');
    expect(preload).not.toContain('fs.');
    expect(main).toContain('SCREEN_DSL_FILE_OPEN_CHANNEL');
    expect(main).toContain('SCREEN_DSL_FILE_SAVE_CHANNEL');
    expect(main).not.toContain("ipcMain.handle('file:");
    expect(adapter).not.toContain("from 'electron'");
    expect(adapter).not.toContain("from 'node:fs'");
    expect(adapter).not.toContain("from 'node:path'");
  });

  it('Screen DSL shared file contracts do not import Electron, fs, path, React, Zustand or project sessions', () => {
    const root = process.cwd();
    const sharedDir = path.join(root, 'src/shared/screenDslFiles');
    const files = collectTypeScriptFiles(sharedDir);
    const forbidden = new Set(['electron', 'node:fs', 'fs', 'node:path', 'path', 'react', 'zustand']);
    const violations: string[] = [];

    for (const file of files) {
      const source = ts.createSourceFile(
        file,
        readFileSync(file, 'utf8'),
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS
      );
      for (const specifier of collectModuleSpecifiers(source)) {
        if (forbidden.has(specifier)) {
          violations.push(`${normalizePath(path.relative(root, file))}: imports ${specifier}`);
        }
        const internalTarget = resolveInternalImport(root, file, specifier);
        if (internalTarget?.startsWith('src/application/')) {
          violations.push(`${normalizePath(path.relative(root, file))}: imports ${specifier}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});

function collectBoundaryViolations(): BoundaryViolation[] {
  const root = process.cwd();
  const files = PROTECTED_ROOTS
    .flatMap((sourceRoot) => collectTypeScriptFiles(path.join(root, sourceRoot)))
    .filter((file) => existsSync(file));
  const violations: BoundaryViolation[] = [];

  for (const file of files) {
    const source = ts.createSourceFile(
      file,
      readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
      file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    );
    const relativeFile = normalizePath(path.relative(root, file));
    for (const importPath of collectModuleSpecifiers(source)) {
      const internalTarget = resolveInternalImport(root, file, importPath);
      if (FORBIDDEN_PACKAGES.has(importPath)) {
        violations.push({
          file: relativeFile,
          importPath,
          rule: 'protected layers must not import React, Zustand, Electron or UI libraries'
        });
      } else if (internalTarget?.startsWith('src/renderer/') || internalTarget === 'src/renderer') {
        violations.push({
          file: relativeFile,
          importPath,
          rule: 'protected layers must not import renderer modules'
        });
      } else if (internalTarget?.startsWith('src/features/') || internalTarget === 'src/features') {
        violations.push({
          file: relativeFile,
          importPath,
          rule: 'protected layers must not import feature/UI modules'
        });
      } else if (
        relativeFile.startsWith('src/compiler/') &&
        (internalTarget?.startsWith('src/application/') ||
          internalTarget === 'src/application' ||
          internalTarget?.startsWith('src/main/') ||
          internalTarget?.startsWith('src/preload/'))
      ) {
        violations.push({
          file: relativeFile,
          importPath,
          rule: 'compiler must not import application sessions, Electron main/preload or command infrastructure'
        });
      }
    }
  }

  return violations;
}

function collectTypeScriptFiles(directory: string): string[] {
  if (!existsSync(directory)) {
    return [];
  }
  return readdirSync(directory).flatMap((name) => {
    const absolute = path.join(directory, name);
    const stat = statSync(absolute);
    if (stat.isDirectory()) {
      return collectTypeScriptFiles(absolute);
    }
    return /\.(cts|ts|tsx)$/.test(name) ? [absolute] : [];
  });
}

function collectModuleSpecifiers(source: ts.SourceFile): string[] {
  const specifiers: string[] = [];
  const visit = (node: ts.Node): void => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      specifiers.push(node.moduleSpecifier.text);
    }
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      specifiers.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return specifiers;
}

function resolveInternalImport(root: string, importer: string, importPath: string): string | null {
  if (!importPath.startsWith('.')) {
    return null;
  }
  const resolved = path.resolve(path.dirname(importer), importPath);
  const relative = normalizePath(path.relative(root, resolved));
  return relative.startsWith('src/') ? relative : null;
}

function normalizePath(value: string): string {
  return value.split(path.sep).join('/');
}
