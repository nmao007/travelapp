import { readFile, readdir, writeFile } from 'node:fs/promises';

const core = new URL('../packages/core/src/', import.meta.url);
const dist = new URL('./dist/', import.meta.url);

// packages/core is the source of truth for trip logic shared with the native
// app. The site serves copies from dist/; edit the core files, not the copies.
for (const file of await readdir(core)) {
  if (!file.endsWith('.js')) continue;
  const source = await readFile(new URL(file, core), 'utf8');
  const banner = `// Copied from packages/core/src/${file} by prepare-shared.mjs. Edit the core file.\n`;
  await writeFile(new URL(file, dist), banner + source);
}
