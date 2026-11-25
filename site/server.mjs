import { createServer } from 'node:http';
import { networkInterfaces } from 'node:os';
import { handleRequest } from './request-handler.mjs';

const port = Number(process.env.PORT || 3010);
// Like `expo start`, the development server listens on the
// network so the native app on a phone (same Wi-Fi) can reach it. Set
// HOST=127.0.0.1 to keep it to this computer.
const host = process.env.HOST || '0.0.0.0';
createServer(handleRequest).listen(port, host, () => {
  process.stdout.write(`Local:   http://127.0.0.1:${port}\n`);
  if (host !== '0.0.0.0') return;
  const network = Object.values(networkInterfaces()).flat().find(entry => entry?.family === 'IPv4' && !entry.internal);
  if (network) process.stdout.write(`Network: http://${network.address}:${port}\n`);
});
