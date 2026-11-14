import { readFile, readdir, writeFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';

const core = new URL('../packages/core/src/', import.meta.url);
const dist = new URL('./dist/', import.meta.url);

// Use the backend's calendar and local-time rules in the shared core too.
for (const name of ['domain', 'trip-itinerary']) {
  const source = await readFile(new URL(`../lib/${name}.ts`, import.meta.url), 'utf8');
  const javascript = stripTypeScriptTypes(source)
    .replaceAll('./domain.ts', './domain.js')
    .replace(/[\t ]+$/gm, '');
  await writeFile(new URL(`${name}.js`, core), `// Generated from lib/${name}.ts by site/prepare-shared.mjs.\n${javascript}`);
}

// packages/core is the source of truth for trip logic shared with the native
// app. The site serves copies from dist/; edit the core files, not the copies.
for (const file of await readdir(core)) {
  if (!file.endsWith('.js')) continue;
  const source = await readFile(new URL(file, core), 'utf8');
  const banner = `// Copied from packages/core/src/${file} by prepare-shared.mjs. Edit the core file.\n`;
  await writeFile(new URL(file, dist), source.startsWith('// Generated') ? source : banner + source);
}
