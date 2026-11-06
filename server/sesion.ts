import { huellaToken, nuevoToken } from './claves.js'
import type { Consulta } from './db.js'

const COOKIE = 'ciclo_sesion'
const DIAS = 60

export const responder = (cuerpo: unknown, status = 200, headers?: Record<string, string>) => Response.json(cuerpo, { status, headers })

function leerCookie(req: Request) {
  for (const parte of (req.headers.get('cookie') ?? '').split(';')) {
    const [k, ...v] = parte.trim().split('=')
    if (k === COOKIE) return v.join('=')
  }
  return ''
}

// Secure fuera de localhost: el navegador solo la manda por https.
const cookie = (req: Request, valor: string, segundos: number) => {
  const local = /^(localhost|127\.0\.0\.1)(:|$)/.test(new URL(req.url).host)
  return `${COOKIE}=${valor}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${segundos}${local ? '' : '; Secure'}`
}

export async function abrirSesion(consulta: Consulta, req: Request, usuarioId: string) {
  const token = nuevoToken()
  await consulta(`insert into sesiones (token, usuario_id, expira) values ($1, $2, now() + interval '${DIAS} days')`, [huellaToken(token), usuarioId])
  // De paso se limpian las vencidas.
  await consulta('delete from sesiones where expira < now()')
  return cookie(req, token, DIAS * 86400)
}

export async function cerrarSesion(consulta: Consulta, req: Request) {
  const token = leerCookie(req)
  if (token) await consulta('delete from sesiones where token = $1', [huellaToken(token)])
  return cookie(req, '', 0)
}

export type Usuario = { id: string; usuario: string; nombre: string; municipio: string; ciclo_activo: string | null }

export async function usuarioDe(consulta: Consulta, req: Request): Promise<Usuario | null> {
  const token = leerCookie(req)
  if (!token) return null
  const [u] = await consulta<Usuario>(
    `select u.id, u.usuario, u.nombre, u.municipio, u.ciclo_activo from sesiones s join usuarios u on u.id = s.usuario_id
     where s.token = $1 and s.expira > now()`, [huellaToken(token)])
  return u ?? null
}

/** Para POST con cookie: solo JSON, así un formulario de otro sitio no puede mandar nada a nombre del usuario. */
export const esJSON = (req: Request) => req.headers.get('content-type')?.includes('application/json') ?? false
