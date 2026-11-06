import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv, type Plugin } from 'vite'

// npm run dev también sirve las funciones de api/ (cuenta, datos, ia) como lo hace Vercel.
// Lee las claves de .env.local; nunca llegan al navegador (no empiezan con VITE_).
function apiLocal(): Plugin {
  return {
    name: 'api-local',
    configureServer(server) {
      // Las pruebas (vitest) no leen tu .env.local: así no dependen de tus claves ni pueden tocar tu base de datos real.
      if (!process.env.VITEST) Object.assign(process.env, loadEnv(server.config.mode, process.cwd(), ['IA_', 'OPENROUTER_', 'ANTHROPIC_', 'OLLAMA_', 'DATABASE_', 'POSTGRES_']))
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? '/', 'http://localhost')
        const nombre = url.pathname.match(/\/api\/(cuenta|datos|ia)$/)?.[1]
        if (!nombre) return next()
        try {
          const modulo = await server.ssrLoadModule(`/api/${nombre}.ts`)
          const f = modulo[req.method ?? 'GET']
          if (!f) { res.statusCode = 405; return res.end() }
          const partes: Buffer[] = []
          for await (const parte of req) partes.push(parte as Buffer)
          const headers = new Headers()
          for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v)
          const r: Response = await f(new Request(`http://${req.headers.host}${req.url}`, {
            method: req.method, headers, body: partes.length ? Buffer.concat(partes) : undefined,
          }))
          res.statusCode = r.status
          r.headers.forEach((v, k) => { if (k !== 'set-cookie') res.setHeader(k, v) })
          const cookies = r.headers.getSetCookie()
          if (cookies.length) res.setHeader('Set-Cookie', cookies)
          res.end(Buffer.from(await r.arrayBuffer()))
        } catch (e) {
          next(e)
        }
      })
    },
  }
}

export default defineConfig({
  // Rutas relativas: funciona en la raíz o en una subcarpeta.
  base: './',
  plugins: [react(), tailwindcss(), apiLocal()],
})
