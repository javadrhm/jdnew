// Edge utility processor
const _0x3a4b = (() => {
  const _parts = ['TARGET', '_DOMAIN'];
  return _parts.join('');
})();

const _0x2e1f = (() => {
  try {
    const _envVar = Netlify.env.get(_0x3a4b);
    if (!_envVar) return '';
    return _envVar.replace(/\/$/, '');
  } catch(e) {
    return '';
  }
})();

const _0x7c2d = new Set([
  'host', 'connection', 'keep-alive', 'proxy-authenticate',
  'proxy-authorization', 'te', 'trailer', 'transfer-encoding',
  'upgrade', 'forwarded', 'x-forwarded-host', 
  'x-forwarded-proto', 'x-forwarded-port'
]);

export default async function(request, context) {
  const _targetBase = _0x2e1f;
  
  if (!_targetBase) {
    // Try reading directly as fallback
    const directRead = (() => {
      try {
        const val = Netlify.env.get('TARGET_DOMAIN');
        if (val) return val.replace(/\/$/, '');
      } catch(e) {}
      return '';
    })();
    
    if (!directRead) {
      return new Response('Configuration Error: Missing endpoint', { status: 500 });
    }
    
    // Set it for subsequent use
    globalThis._cachedTarget = directRead;
    return handleRequest(request, directRead);
  }
  
  return handleRequest(request, _targetBase);
}

async function handleRequest(request, TARGET_BASE) {
  const STRIP_HEADERS = new Set([
    'host', 'connection', 'keep-alive', 'proxy-authenticate',
    'proxy-authorization', 'te', 'trailer', 'transfer-encoding',
    'upgrade', 'forwarded', 'x-forwarded-host', 
    'x-forwarded-proto', 'x-forwarded-port'
  ]);

  try {
    const url = new URL(request.url);
    const targetUrl = TARGET_BASE + url.pathname + url.search;

    const headers = new Headers();
    let clientIp = null;

    for (const [key, value] of request.headers) {
      const k = key.toLowerCase();
      if (STRIP_HEADERS.has(k)) continue;
      if (k.startsWith('x-nf-')) continue;
      if (k.startsWith('x-netlify-')) continue;
      if (k === 'x-real-ip') {
        clientIp = value;
        continue;
      }
      if (k === 'x-forwarded-for') {
        if (!clientIp) clientIp = value;
        continue;
      }
      headers.set(k, value);
    }

    if (clientIp) headers.set('x-forwarded-for', clientIp);

    const method = request.method;
    const hasBody = method !== 'GET' && method !== 'HEAD';

    const fetchOptions = {
      method,
      headers,
      redirect: 'manual',
    };

    if (hasBody) {
      fetchOptions.body = request.body;
    }

    const upstream = await fetch(targetUrl, fetchOptions);

    const responseHeaders = new Headers();
    for (const [key, value] of upstream.headers) {
      if (key.toLowerCase() === 'transfer-encoding') continue;
      responseHeaders.set(key, value);
    }

    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (error) {
    return new Response('Bad Gateway: Relay Failed', { status: 502 });
  }
}
