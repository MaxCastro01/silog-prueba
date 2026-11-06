// Los datos del usuario que entró: leer (GET) y cambiar (POST con una acción).
import { ACCIONES, fotoDe, hacer, leerDatos, NoSePuede, type Accion } from '../server/acciones.js'
import { base, SinBase } from '../server/db.js'
import { esJSON, responder, usuarioDe } from '../server/sesion.js'

async function conUsuario(req: Request, f: (consulta: Awaited<ReturnType<typeof base>>, u: NonNullable<Awaited<ReturnType<typeof usuarioDe>>>) => Promise<Response>) {
  try {
    const consulta = await base()
    const u = await usuarioDe(consulta, req)
    if (!u) return responder({ error: 'Entra con tu usuario.' }, 401)
    return await f(consulta, u)
  } catch (e) {
    if (e instanceof NoSePuede) return responder({ error: e.message }, 400)
    if (e instanceof SinBase) return responder({ error: e.message }, 503)
    console.error(e)
    return responder({ error: 'No se pudo conectar con la base de datos. Intenta en un momento.' }, 503)
  }
}

export function GET(req: Request) {
  return conUsuario(req, async (consulta, u) => {
    const id = new URL(req.url).searchParams.get('foto')
    if (id === null) return responder({ datos: await leerDatos(consulta, u) }, 200, { 'Cache-Control': 'no-store' })
    const foto = await fotoDe(consulta, id)
    if (!foto) return new Response(null, { status: 404 })
    return new Response(new Uint8Array(foto), { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, max-age=86400' } })
  })
}

export function POST(req: Request) {
  return conUsuario(req, async (consulta, u) => {
    if (!esJSON(req)) return responder({ error: 'Formato no válido' }, 415)
    const cuerpo = (await req.json().catch(() => null)) as { accion?: string; entrada?: unknown } | null
    const accion = cuerpo?.accion as Accion
    if (!Object.hasOwn(ACCIONES, accion)) return responder({ error: 'Acción desconocida' }, 400)
    await hacer(consulta, u, accion, cuerpo?.entrada ?? {})
    // Se regresa todo ya actualizado: la pantalla se pinta con lo que quedó en la base.
    return responder({ datos: await leerDatos(consulta, u) }, 200, { 'Cache-Control': 'no-store' })
  })
}
