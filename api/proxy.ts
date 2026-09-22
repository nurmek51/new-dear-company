import type { IncomingMessage, ServerResponse } from 'node:http';

const API_ORIGIN = 'https://backend.dearcompany.ai';
const API_PREFIX = '/api';

type ProxyRequest = IncomingMessage & { body?: unknown };
type ProxyResponse = ServerResponse;

const REQUEST_HEADERS_TO_SKIP = new Set([
  'connection',
  'content-length',
  'host',
  'origin',
  'referer',
  'transfer-encoding',
  'x-forwarded-for',
  'x-forwarded-host',
  'x-forwarded-port',
  'x-forwarded-proto',
  'x-real-ip',
  'x-vercel-deployment-url',
  'x-vercel-forwarded-for',
  'x-vercel-id',
  'x-vercel-ip-city',
  'x-vercel-ip-continent',
  'x-vercel-ip-country',
  'x-vercel-ip-country-region',
  'x-vercel-ip-latitude',
  'x-vercel-ip-longitude',
  'x-vercel-ja4-digest',
  'x-vercel-oidc-token',
  'x-vercel-proxied-for',
]);

function upstreamUrl(requestUrl = '/api/proxy'): string {
  const incoming = new URL(requestUrl, 'https://proxy.invalid');
  const path = incoming.searchParams.get('path')?.replace(/^\/+/, '') ?? '';
  incoming.searchParams.delete('path');
  const query = incoming.searchParams.toString();
  return `${API_ORIGIN}${API_PREFIX}/${path}${query ? `?${query}` : ''}`;
}

function upstreamHeaders(req: ProxyRequest): Headers {
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (REQUEST_HEADERS_TO_SKIP.has(name.toLowerCase()) || value === undefined) continue;
    headers.set(name, Array.isArray(value) ? value.join(', ') : value);
  }

  // Unsafe Django requests must look same-origin to the upstream server.
  if (req.headers.origin) headers.set('origin', API_ORIGIN);
  if (req.headers.referer) headers.set('referer', `${API_ORIGIN}/`);
  return headers;
}

async function requestBody(req: ProxyRequest): Promise<BodyInit | undefined> {
  if (req.method === 'GET' || req.method === 'HEAD') return undefined;

  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'string') return req.body;
    if (Buffer.isBuffer(req.body)) {
      return req.body.buffer.slice(req.body.byteOffset, req.body.byteOffset + req.body.byteLength) as ArrayBuffer;
    }
    return JSON.stringify(req.body);
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (!chunks.length) return undefined;
  const body = Buffer.concat(chunks);
  return body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as ArrayBuffer;
}

function proxyCookie(cookie: string): string {
  return cookie.replace(/;\s*Domain=backend\.dearcompany\.ai/gi, '');
}

function copyResponseHeaders(upstream: Response, res: ProxyResponse): void {
  const passthrough = [
    'cache-control',
    'content-disposition',
    'content-type',
    'etag',
    'last-modified',
    'retry-after',
  ];
  for (const name of passthrough) {
    const value = upstream.headers.get(name);
    if (value) res.setHeader(name, value);
  }

  const headers = upstream.headers as Headers & { getSetCookie?: () => string[] };
  const cookies = headers.getSetCookie?.() ?? [];
  if (cookies.length) res.setHeader('set-cookie', cookies.map(proxyCookie));
}

export default async function handler(req: ProxyRequest, res: ProxyResponse): Promise<void> {
  try {
    const upstream = await fetch(upstreamUrl(req.url), {
      method: req.method ?? 'GET',
      headers: upstreamHeaders(req),
      body: await requestBody(req),
      redirect: 'manual',
    });

    res.statusCode = upstream.status;
    copyResponseHeaders(upstream, res);

    const location = upstream.headers.get('location');
    if (location) res.setHeader('location', location.replace(API_ORIGIN, ''));

    if (!upstream.body || req.method === 'HEAD') {
      res.end();
      return;
    }

    for await (const chunk of upstream.body) res.write(Buffer.from(chunk));
    res.end();
  } catch (error) {
    console.error('API proxy request failed', error);
    if (res.headersSent) {
      res.end();
      return;
    }
    res.statusCode = 502;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ detail: 'The API is temporarily unavailable. Please try again.' }));
  }
}

export const config = {
  maxDuration: 60,
};
