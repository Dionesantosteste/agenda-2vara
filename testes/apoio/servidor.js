// Servidor simples para os testes: entrega os arquivos do site (pasta acima de testes/).
const http = require('http');
const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..', '..');
const PORTA = Number(process.env.PORTA || 4173);
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.json': 'application/json', '.webp': 'image/webp' };

http.createServer((req, res) => {
  let caminho = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (caminho.endsWith('/')) caminho += 'index.html';
  const arquivo = path.join(RAIZ, caminho);
  if (!arquivo.startsWith(RAIZ) || arquivo.includes(path.sep + 'testes' + path.sep)){ res.writeHead(404); res.end(); return; }
  fs.readFile(arquivo, (err, dados) => {
    if (err){ res.writeHead(404); res.end('não encontrado'); return; }
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(arquivo).toLowerCase()] || 'application/octet-stream' });
    res.end(dados);
  });
}).listen(PORTA, () => console.log('Site dos testes em http://localhost:' + PORTA));
