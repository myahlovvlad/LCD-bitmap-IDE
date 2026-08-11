/**
 * Fills missing simplified-Chinese LCD strings using a machine-translation
 * service and writes a review ledger beside the project.  The ledger is the
 * authoritative checklist for a native-language reviewer; translations are
 * never silently presented as human-approved.
 *
 * Usage: npx tsx scripts/translate-ecros-zh.ts input.lcdproj output.lcdproj
 */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';

type TextObject = { id: string; type: string; text?: { ru?: string; en?: string; zh?: string } };
type ProjectFile = { project: { screens: Record<string, { name: string; objects: TextObject[] }> } };
type Translation = { source: string; zh: string; status: 'machine-review-required' | 'failed' };

const [inputArg, outputArg] = process.argv.slice(2);
if (!inputArg || !outputArg) throw new Error('Usage: translate-ecros-zh <input.lcdproj> <output.lcdproj>');
const inputPath = resolve(inputArg);
const outputPath = resolve(outputArg);
const cachePath = join(dirname(outputPath), 'ecros-5400uv-zh-machine-cache.json');
const ledgerPath = join(dirname(outputPath), 'ecros-5400uv-zh-review.csv');
const file = JSON.parse(await readFile(inputPath, 'utf8')) as ProjectFile;
const cache: Record<string, Translation> = await readFile(cachePath, 'utf8').then((raw) => JSON.parse(raw) as Record<string, Translation>).catch(() => ({}));

const sourceOf = (object: TextObject): string => (object.text?.ru || object.text?.en || '').trim();
const missing = Object.values(file.project.screens).flatMap((screen) => screen.objects
  .filter((object) => object.type === 'text' && !object.text?.zh?.trim() && sourceOf(object))
  .map(sourceOf));
const unique = [...new Set(missing)];

async function translate(source: string): Promise<Translation> {
  if (cache[source]) return cache[source];
  const url = new URL('https://translate.googleapis.com/translate_a/single');
  url.searchParams.set('client', 'gtx');
  url.searchParams.set('sl', /[А-Яа-яЁё]/.test(source) ? 'ru' : 'en');
  url.searchParams.set('tl', 'zh-CN');
  url.searchParams.set('dt', 't');
  url.searchParams.set('q', source);
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, { headers: { 'User-Agent': 'LCD-bitmap-IDE translation review tool' } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = await response.json() as [Array<[string]>];
      const zh = body[0]?.map((piece) => piece[0]).join('').trim();
      if (zh) return { source, zh, status: 'machine-review-required' };
    } catch {
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 350 * (attempt + 1)));
    }
  }
  return { source, zh: '', status: 'failed' };
}

let cursor = 0;
const workers = Array.from({ length: 4 }, async () => {
  while (cursor < unique.length) {
    const source = unique[cursor++];
    cache[source] = await translate(source);
    if (cursor % 25 === 0) console.log(`Translated ${cursor}/${unique.length} unique strings`);
  }
});
await Promise.all(workers);

const reviewRows: string[] = ['Screen ID,Screen name,Object ID,Source RU/EN,ZH (machine),Status'];
let applied = 0;
for (const [screenId, screen] of Object.entries(file.project.screens)) {
  for (const object of screen.objects) {
    const source = sourceOf(object);
    if (object.type !== 'text' || !source) continue;
    const result = cache[source];
    const needsTranslation = !object.text?.zh?.trim();
    if (needsTranslation && result?.zh) {
      object.text = { ...object.text, zh: result.zh };
      applied++;
    }
    reviewRows.push([screenId, screen.name, object.id, source, object.text?.zh ?? result?.zh ?? '', result?.status ?? 'pre-existing']
      .map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','));
  }
}
await writeFile(cachePath, `${JSON.stringify(cache, null, 2)}\n`, 'utf8');
await writeFile(ledgerPath, `\uFEFF${reviewRows.join('\r\n')}\r\n`, 'utf8');
await writeFile(outputPath, `${JSON.stringify(file, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ unique: unique.length, missing: missing.length, applied, cachePath, ledgerPath, outputPath }, null, 2));
