// Edge utility processor
const _0x3a4b = (() => {
  const _parts = ['TAR', 'GET_', 'DOMAIN'];
  const _joined = _parts.join('');
  const _second = ['REPL', 'ACE', '/$', ''];
  return (_joined + '_' + _second[0] + _second[1]).replace(new RegExp(_second[2]), _second[3]);
})();

const _0x7c2d = (() => {
  const _set = ['host', 'conn', 'ection', 'keep-ali', 've', 'proxy-authentic', 'ate'];
  const _combined = [_set[0], _set[1]+_set[2], _set[3]+_set[4], _set[5]+_set[6]].filter(Boolean);
  return new Set([..._combined, 'proxy-authorization', 'te', 'trailer', 'transfer-encoding', 'upgrade', 'forwarded', 'x-forwarded-host', 'x-forwarded-proto', 'x-forwarded-port']);
})();

const _0x2e1f = (() => {
  const _src = (Netlify['env']['get'](_0x3a4b) || '');
  return _src['replace'](/\/$/, '');
})();

const _0x8f3a = async (_request) => {
  const _targetBase = _0x2e1f;
  
  if (!_targetBase) {
    return new Response('Configuration Error: Missing endpoint', { status: 500 });
  }

  try {
    const _urlObj = new URL(_request.url);
    const _pathWithQuery = _urlObj['pathname'] + _urlObj['search'];
    const _destination = (() => {
      const _base = _targetBase;
      const _suffix = _pathWithQuery;
      return _base + _suffix;
    })();

    const _forwardHeaders = new Headers();
    let _originAddr = null;

    const _skipConditions = (() => {
      const _blockedSet = _0x7c2d;
      const _check = (k) => _blockedSet['has'](k);
      return _check;
    })();

    for (const [_key, _val] of _request['headers']) {
      const _lowerKey = _key['toLowerCase']();
      
      if (_skipConditions(_lowerKey)) continue;
      if (_lowerKey['startsWith']('x-nf-')) continue;
      if (_lowerKey['startsWith']('x-netlify-')) continue;
      
      if (_lowerKey === 'x-real-ip') {
        _originAddr = _val;
        continue;
      }
      
      if (_lowerKey === 'x-forwarded-for') {
        if (!_originAddr) _originAddr = _val;
        continue;
      }
      
      _forwardHeaders['set'](_lowerKey, _val);
    }

    if (_originAddr) {
      _forwardHeaders['set']('x-forwarded-for', _originAddr);
    }

    const _methodType = _request['method'];
    const _hasPayload = !['GET', 'HEAD']['includes'](_methodType);
    
    const _fetchConfig = {
      method: _methodType,
      headers: _forwardHeaders,
      redirect: 'manual',
    };
    
    if (_hasPayload) {
      _fetchConfig['body'] = _request['body'];
    }

    const _upstreamRes = await fetch(_destination, _fetchConfig);
    
    const _responseHeaders = new Headers();
    
    for (const [_hKey, _hVal] of _upstreamRes['headers']) {
      const _lowerHeader = _hKey['toLowerCase']();
      if (_lowerHeader !== 'transfer-encoding') {
        _responseHeaders['set'](_hKey, _hVal);
      }
    }

    return new Response(_upstreamRes['body'], {
      status: _upstreamRes['status'],
      headers: _responseHeaders,
    });
    
  } catch (_err) {
    return new Response('Connection Error: Relay failed', { status: 502 });
  }
};

export default async function(request, context) {
  return _0x8f3a(request);
}
