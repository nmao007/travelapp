import { createServer } from 'node:http';
import { handleRequest } from './request-handler.mjs';

const port = Number(process.env.PORT || 3010);
createServer(handleRequest).listen(port, '127.0.0.1', () => {
  process.stdout.write(`Local: http://127.0.0.1:${port}\n`);
});
