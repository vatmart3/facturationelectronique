// Routeur minimal à la place de Kong : /auth/v1 → supabase/auth, /rest/v1 → PostgREST.
import http from 'node:http'

const cibles = { '/auth/v1': Number(process.env.AUTH_PORT ?? 9999), '/rest/v1': Number(process.env.REST_PORT ?? 3010) }
const port = Number(process.env.ROUTEUR_PORT ?? 54321)

http
  .createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin ?? '*')
    res.setHeader('Access-Control-Allow-Headers', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS')
    if (req.method === 'OPTIONS') return res.end()
    const prefixe = Object.keys(cibles).find((p) => req.url.startsWith(p))
    if (!prefixe) {
      res.statusCode = 404
      return res.end(JSON.stringify({ message: 'Service non simulé localement' }))
    }
    const amont = http.request(
      { host: '127.0.0.1', port: cibles[prefixe], path: req.url.slice(prefixe.length) || '/', method: req.method, headers: req.headers },
      (r) => {
        res.writeHead(r.statusCode ?? 502, r.headers)
        r.pipe(res)
      },
    )
    amont.on('error', (e) => {
      res.statusCode = 502
      res.end(JSON.stringify({ message: e.message }))
    })
    req.pipe(amont)
  })
  .listen(port, () => console.log(`Supabase local sur http://localhost:${port}`))
