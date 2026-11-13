'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const {spawn} = require('node:child_process');

// A short-lived loopback fixture for the existing HTTP auditor, not a preview
// or a public server. It verifies the files just built in this checkout.
async function auditCurrentBuild(root = process.cwd()) {
  const mime = {'.html':'text/html; charset=utf-8','.json':'application/json','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'};
  const server = http.createServer((request,response) => {
    try {
      const route = decodeURIComponent(new URL(request.url,'http://localhost').pathname);
      if (!['GET','HEAD'].includes(request.method) || route.split('/').some(part => part.startsWith('.') || part === 'node_modules')) {
        response.writeHead(404);response.end();return;
      }
      let file = path.resolve(root,'.' + route);
      if (path.relative(root,file).startsWith('..')) {response.writeHead(404);response.end();return;}
      if (fs.statSync(file).isDirectory()) file = path.join(file,'index.html');
      const stat = fs.statSync(file);
      if (!stat.isFile()) throw Error('Not a file');
      response.writeHead(200,{'Content-Type':mime[path.extname(file)] || 'application/octet-stream','Content-Length':stat.size});
      if (request.method === 'HEAD') response.end();
      else fs.createReadStream(file).on('error',()=>response.destroy()).pipe(response);
    } catch {response.writeHead(404);response.end();}
  });
  await new Promise((resolve,reject) => {server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  try {
    const port = server.address().port;
    await new Promise((resolve,reject) => {
      const child = spawn(process.execPath,['scripts/test_public_link_integrity.js'],{
        cwd:root,stdio:'inherit',env:{...process.env,PUBLIC_LINK_BASE_URL:`http://127.0.0.1:${port}`,PUBLIC_LINK_REPORT:'data/public_link_integrity.json',PUBLIC_LINK_CONCURRENCY:'8'}
      });
      child.once('error',reject);
      child.once('exit',code=>code === 0 ? resolve() : reject(Error('Current-build HTTP audit failed')));
    });
  } finally {await new Promise(resolve=>server.close(resolve));}
}
module.exports = {auditCurrentBuild};
