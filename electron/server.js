const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const WebSocket = require('ws');
const QRCode = require('qrcode');

function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const map = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.mp4': 'video/mp4',
    '.ttf': 'font/ttf',
    '.otf': 'font/otf'
  };
  return map[ext] || 'application/octet-stream';
}

let serverInfo = null;
let currentState = null;

async function startServer(baseDir, isDev = false) {
  const port = 7878;
  const ip = getLocalIp();
  const pin = "1234";
  const remote_url = `http://${ip}:${port}/remote.html`;
  const obs_url = `http://localhost:${port}/stream.html`;
  const qr_svg = await QRCode.toString(remote_url, { type: 'svg', margin: 1 });

  serverInfo = { port, ip, pin, remote_url, obs_url, qr_svg };

  const server = http.createServer((req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host}`);
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === '/' || pathname === '') pathname = '/index.html';

    if (pathname === '/api/server-info') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(serverInfo));
      return;
    }

    if (pathname === '/api/state') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(currentState || {}));
      return;
    }

    // Procura o arquivo nas pastas possíveis: baseDir, dist, public
    const searchDirs = [
      path.join(baseDir, 'dist'),
      path.join(baseDir, 'public'),
      baseDir
    ];

    let foundPath = null;
    for (const dir of searchDirs) {
      const p = path.join(dir, pathname);
      if (fs.existsSync(p) && fs.statSync(p).isFile()) {
        foundPath = p;
        break;
      }
    }

    if (foundPath) {
      const mime = getMimeType(foundPath);
      res.writeHead(200, { 'Content-Type': mime });
      fs.createReadStream(foundPath).pipe(res);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Arquivo não encontrado no Altaris Server.');
    }
  });

  const wss = new WebSocket.Server({ server, path: '/ws' });
  const clients = new Set();

  wss.on('connection', (ws) => {
    clients.add(ws);

    if (currentState) {
      try {
        ws.send(JSON.stringify({ type: 'state', payload: currentState }));
      } catch (_) {}
    }

    ws.on('message', (message) => {
      // Repassa para todos os outros clientes
      const raw = message.toString();
      try {
        const parsed = JSON.parse(raw);
        if (parsed.type === 'state_update') {
          currentState = parsed.payload;
        }
      } catch (_) {}

      for (const client of clients) {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          try {
            client.send(raw);
          } catch (_) {}
        }
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
    });
  });

  server.listen(port, () => {
    console.log(`[Altaris Electron Server] rodando em http://${ip}:${port}`);
    console.log(`[Altaris] celular: ${remote_url}  |  OBS: ${obs_url}`);
  });

  return {
    serverInfo,
    updateState: (state) => {
      currentState = state;
      const msg = JSON.stringify({ type: 'state', payload: state });
      for (const client of clients) {
        if (client.readyState === WebSocket.OPEN) {
          try { client.send(msg); } catch (_) {}
        }
      }
    }
  };
}

module.exports = { startServer, getServerInfo: () => serverInfo };
