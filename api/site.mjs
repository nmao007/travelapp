import { handleRequest } from '../site/request-handler.mjs';

export default async function handler(request, response) {
  // Keep the original API path explicit across Vercel's rewrite.
  const url = new URL(request.url, 'http://localhost');
  const endpoint = url.searchParams.get('endpoint');
  if (endpoint) {
    url.pathname = `/api/${endpoint}`;
    url.searchParams.delete('endpoint');
    request.url = url.pathname + url.search;
  }
  return handleRequest(request, response);
}
