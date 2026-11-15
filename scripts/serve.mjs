import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve, extname, sep} from 'node:path';
const root = resolve('public');
createServer(async (req,res) => {
  try {
    const path = resolve(root, '.' + decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/\/$/,'/index.html'));
    if (!path.startsWith(root + sep)) throw new Error('Forbidden');
    const body = await readFile(path);
    res.writeHead(200, {'Content-Type': ({'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.json':'application/json','.mjs':'text/javascript'})[extname(path)] || 'text/plain'}); res.end(body);
  } catch {res.writeHead(404);res.end('Not found');}
}).listen(4173,'127.0.0.1',()=>console.log('http://127.0.0.1:4173'));
