import { readFile, mkdir, copyFile } from 'node:fs/promises';
const packageRoot = new URL('../node_modules/maplibre-gl/', import.meta.url);
const {version} = JSON.parse(await readFile(new URL('package.json',packageRoot),'utf8'));
if (!/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(version)) throw new Error('Unexpected map library version.');
const target = new URL(`../public/maps/maplibre-${version}/`,import.meta.url);
await mkdir(target,{recursive:true});
for (const file of ['maplibre-gl-worker.mjs','maplibre-gl-shared.mjs']) await copyFile(new URL(`dist/${file}`,packageRoot),new URL(file,target));
await copyFile(new URL('LICENSE.txt',packageRoot),new URL('LICENSE.txt',target));
