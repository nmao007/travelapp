import '../site/prepare-shared.mjs';
import { cp, mkdir, rm } from 'node:fs/promises';

const output = new URL('../vercel-static/', import.meta.url);
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(new URL('../site/dist/', import.meta.url), output, { recursive: true });
await cp(new URL('../site/preview.html', import.meta.url), new URL('preview.html', output));
// Root opens the device preview; /app serves the real app inside it.
await cp(new URL('../site/dist/index.html', import.meta.url), new URL('app.html', output));
await cp(new URL('../site/preview.html', import.meta.url), new URL('index.html', output));
