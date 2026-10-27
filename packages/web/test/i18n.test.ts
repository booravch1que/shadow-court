import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { en } from '../src/i18n/en';
import { detectLang, makeT } from '../src/i18n';
import { ru } from '../src/i18n/ru';

const base = (key: string) => key.replace(/_(zero|one|two|few|many|other)$/, '');
const bases = (dict: Record<string, string>) => new Set(Object.keys(dict).map(base));
const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

test('English and Russian define the same keys', () => {
  const a = bases(en);
  const b = bases(ru);
  assert.deepEqual([...a].filter((k) => !b.has(k)), [], 'missing in ru');
  assert.deepEqual([...b].filter((k) => !a.has(k)), [], 'missing in en');
});

test('Russian has all four plural forms wherever it pluralises', () => {
  for (const key of bases(ru)) {
    const forms = Object.keys(ru).filter((k) => base(k) === key && k !== key);
    if (forms.length === 0) continue;
    for (const f of ['one', 'few', 'many', 'other']) assert.ok(`${key}_${f}` in ru, `${key}_${f}`);
  }
});

test('translations use the same placeholders in both languages', () => {
  for (const key of Object.keys(en)) {
    const ruKey = key in ru ? key : undefined;
    if (!ruKey) continue;
    assert.deepEqual(placeholders(ru[key] as string), placeholders(en[key] as string), key);
  }
});

test('plural rules', () => {
  const t = makeT('ru');
  assert.equal(t('coins', { count: 1 }), '1 монета');
  assert.equal(t('coins', { count: 3 }), '3 монеты');
  assert.equal(t('coins', { count: 5 }), '5 монет');
  assert.equal(t('coins', { count: 21 }), '21 монета');
  assert.equal(makeT('en')('coins', { count: 1 }), '1 coin');
  assert.equal(makeT('en')('coins', { count: 2 }), '2 coins');
});

test('missing keys fall back to English, then to the key', () => {
  const t = makeT('ru', { en: { a: 'A' }, ru: {} });
  assert.equal(t('a'), 'A');
  assert.equal(t('zzz'), 'zzz');
});

test('language detection', () => {
  assert.equal(detectLang(null, 'ru-RU'), 'ru');
  assert.equal(detectLang(null, 'de'), 'en');
  assert.equal(detectLang('en', 'ru'), 'en');
});

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
  });
}

test('every literal t(\'key\') used in the source exists', () => {
  const src = new URL('../src', import.meta.url).pathname;
  const used = new Set<string>();
  for (const file of walk(src)) {
    if (file.includes(`${join('src', 'i18n')}`)) continue;
    for (const m of readFileSync(file, 'utf8').matchAll(/\bt\(\s*'([^']+)'/g)) used.add(m[1] as string);
  }
  const have = bases(en);
  const missing = [...used].filter((k) => !have.has(k) && !(k in en));
  assert.deepEqual(missing, []);
});
