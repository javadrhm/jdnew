
const B1LOCKED_HEADERS = [
  "host", "connection", "keep-alive", "proxy-authenticate",
  "proxy-authorization", "te", "trailer", "transfer-encoding",
  "upgrade", "forwarded", "x-forwarded-host", "x-forwarded-proto", "x-forwarded-port"
];

const constructDestUrl = (domain, path, query) => {
  if (domain.startsWith('http://') || domain.startsWith('https://')) {
    return `${domain}${path}${query}`;
  }
  const isHttps = !domain.includes(':') || domain.includes(':443') || /^s\d+\./.test(domain);
  return `${isHttps ? 'https://' : 'http://'}${domain}${path}${query}`;
};

export default async (req, ctx) => {
  try {
    const parsedUrl = new URL(req.url);
    const destHost = req.headers.get("x-host");


    if (!destHost && parsedUrl.pathname.startsWith("/cheshmabi")) {
  destHost = "https://netli.zistgpt.com";
}

    
    // Handle root path with no destination - show Hello World
    if (parsedUrl.pathname === "/" && !destHost) {
      const wsCheck = (req.headers.get("upgrade") || "").toLowerCase();
      if (wsCheck !== "websocket") {
        const htmlResponse = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Hello World Test Project</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            color: white;
        }
        .container {
            text-align: center;
            padding: 2rem;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 20px;
            backdrop-filter: blur(10px);
            box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.37);
        }
        h1 {
            font-size: 4rem;
            margin: 0;
            animation: fadeInDown 1s ease-out;
        }
        p {
            font-size: 1.5rem;
            margin: 1rem 0 0;
            opacity: 0.9;
            animation: fadeInUp 1s ease-out 0.3s both;
        }
        @keyframes fadeInDown {
            from {
                opacity: 0;
                transform: translateY(-30px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        @keyframes fadeInUp {
            from {
                opacity: 0;
                transform: translateY(30px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 Hello World!</h1>
        <p>Test Project</p>
    </div>
</body>
</html>`;
        
        return new Response(htmlResponse, {
          headers: { "content-type": "text/html; charset=UTF-8" },
        });
      }
    }

    if (!destHost) {
      return new Response("Invalid Request: Missing target host.", { status: 400 });
    }

    const finalUrl = constructDestUrl(destHost, parsedUrl.pathname, parsedUrl.search);
    const proxyHeaders = new Headers();
    let clientAddress = null;

    req.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      if (B1LOCKED_HEADERS.includes(lowerKey) || lowerKey.startsWith("x-nf-") || lowerKey.startsWith("x-netlify-") || lowerKey === "x-host") {
        return;
      }
      
      if (lowerKey === "x-real-ip") {
        clientAddress = value;
        return;
      }
      if (lowerKey === "x-forwarded-for") {
        if (!clientAddress) clientAddress = value;
        return;
      }
      proxyHeaders.set(lowerKey, value);
    });

    if (clientAddress) {
      proxyHeaders.set("x-forwarded-for", clientAddress);
    }

    const reqMethod = req.method;
    const fetchConfig = {
      method: reqMethod,
      headers: proxyHeaders,
      redirect: "manual",
      body: (reqMethod === "GET" || reqMethod === "HEAD") ? undefined : req.body,
    };

    const serverRes = await fetch(finalUrl, fetchConfig);
    const responseHeaders = new Response();
    
    serverRes.headers.forEach((value, key) => {
      if (key.toLowerCase() !== "transfer-encoding") {
        responseHeaders.set(key, value);
      }
    });

    return new Response(serverRes.body, {
      status: serverRes.status,
      headers: responseHeaders,
    });

  } catch (err) {
    return new Response("Gateway Error: Connection Failed", { status: 502 });
  }
};
