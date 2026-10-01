import { readFile, writeFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';

// Use the backend's calendar and local-time rules in the HTML client too.
for (const name of ['domain', 'trip-itinerary']) {
  const source = await readFile(new URL(`../lib/${name}.ts`, import.meta.url), 'utf8');
  const javascript = stripTypeScriptTypes(source)
    .replaceAll('./domain.ts', './domain.js')
    .replace(/[\t ]+$/gm, '');
  await writeFile(new URL(`./dist/${name}.js`, import.meta.url), `// Generated from lib/${name}.ts by prepare-shared.mjs.\n${javascript}`);
}
