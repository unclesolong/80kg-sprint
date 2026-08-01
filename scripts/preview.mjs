import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize, resolve } from 'node:path'

const root = resolve('dist')
const base = '/80kg-sprint/'
const port = Number(process.env.PORT || 43871)
const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json; charset=utf-8'
}

createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url ?? base, 'http://localhost').pathname)
  if (pathname === '/80kg-sprint') {
    response.writeHead(308, { Location: base })
    response.end()
    return
  }
  if (!pathname.startsWith(base)) {
    response.writeHead(404)
    response.end('Not found')
    return
  }
  const relative = normalize(pathname.slice(base.length)).replace(/^(\.\.[/\\])+/, '')
  let file = join(root, relative || 'index.html')
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(root, 'index.html')
  const contentType = contentTypes[extname(file)] ?? 'application/octet-stream'
  response.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-cache' })
  createReadStream(file).pipe(response)
}).listen(port, '127.0.0.1', () => {
  console.log(`80KG Sprint production preview: http://127.0.0.1:${port}${base}`)
})
