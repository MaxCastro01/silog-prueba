import { vi } from 'vitest'
import * as cuenta from '../api/cuenta'

// Arrancar PGlite tarda unos segundos la primera vez.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 })

// Cada archivo de pruebas usa su propia base en memoria (PGlite), o un Postgres real con TEST_DATABASE_URL.
if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
else process.env.DATOS_DIR = 'memoria'

export const URL_BASE = 'http://localhost/api/'

export async function llamar(f: (r: Request) => Promise<Response> | Response, ruta: string, cuerpo?: unknown, cookie = '') {
  const r = await f(new Request(URL_BASE + ruta, {
    method: cuerpo === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', cookie },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  }))
  const tipo = r.headers.get('content-type') ?? ''
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- en las pruebas se revisa la forma con expect
  const j: any = tipo.includes('json') ? await r.json() : null
  return { status: r.status, cookie: r.headers.get('set-cookie')?.split(';')[0] ?? '', j, r }
}

export async function entrar(usuario = 'prueba', clave = 'campo2026') {
  const { cookie, status } = await llamar(cuenta.POST, 'cuenta', { accion: 'entrar', usuario, clave })
  if (status !== 200) throw new Error(`no entró: ${status}`)
  return cookie
}

let n = 0
/** Una cuenta nueva y única para la prueba (sirve también contra un Postgres compartido). */
export async function cuentaNueva(nombre = 'Ana') {
  const usuario = `t${Date.now().toString(36)}${n++}`
  const { cookie } = await llamar(cuenta.POST, 'cuenta', { accion: 'crear', usuario, clave: 'secreta1', nombre, municipio: 'Guasave' })
  return { usuario, cookie }
}
