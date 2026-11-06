// Crear cuenta, entrar y salir. Solo se pide usuario, contraseña, nombre y municipio.
import { z } from 'zod'
import { MUNICIPIOS } from '../src/lib/datos.js'
import { claveCorrecta, huellaClave } from '../server/claves.js'
import { base, SinBase } from '../server/db.js'
import { abrirSesion, cerrarSesion, esJSON, responder } from '../server/sesion.js'

const usuario = z.string().trim().toLowerCase().regex(/^[a-z0-9._-]{3,30}$/)
const ENTRAR = z.object({ usuario, clave: z.string().min(1).max(200) })
const CREAR = z.object({
  usuario,
  clave: z.string().min(6).max(200),
  nombre: z.string().trim().min(1).max(40),
  municipio: z.string().refine((m) => MUNICIPIOS.includes(m)),
})

export async function POST(req: Request) {
  if (!esJSON(req)) return responder({ error: 'Formato no válido' }, 415)
  const cuerpo = (await req.json().catch(() => null)) as { accion?: string } | null
  try {
    const consulta = await base()
    if (cuerpo?.accion === 'salir') return responder({ ok: true }, 200, { 'Set-Cookie': await cerrarSesion(consulta, req) })

    if (cuerpo?.accion === 'crear') {
      const v = CREAR.safeParse(cuerpo)
      if (!v.success) return responder({ error: 'Revisa los datos: usuario de 3 a 30 letras o números sin espacios, contraseña de 6 o más.' }, 400)
      const [u] = await consulta<{ id: string }>(
        'insert into usuarios (usuario, clave, nombre, municipio) values ($1, $2, $3, $4) on conflict (usuario) do nothing returning id',
        [v.data.usuario, await huellaClave(v.data.clave), v.data.nombre, v.data.municipio])
      if (!u) return responder({ error: 'Ese usuario ya existe. Escoge otro.' }, 409)
      return responder({ ok: true }, 200, { 'Set-Cookie': await abrirSesion(consulta, req, u.id) })
    }

    if (cuerpo?.accion === 'entrar') {
      const v = ENTRAR.safeParse(cuerpo)
      const [u] = v.success ? await consulta<{ id: string; clave: string }>('select id, clave from usuarios where usuario = $1', [v.data.usuario]) : []
      // Mismo mensaje si no existe el usuario o si la contraseña no es: no se revela quién tiene cuenta.
      if (!u || !(await claveCorrecta(v.data!.clave, u.clave))) return responder({ error: 'El usuario o la contraseña no coinciden.' }, 401)
      return responder({ ok: true }, 200, { 'Set-Cookie': await abrirSesion(consulta, req, u.id) })
    }
    return responder({ error: 'Acción desconocida' }, 400)
  } catch (e) {
    if (e instanceof SinBase) return responder({ error: e.message }, 503)
    console.error(e)
    return responder({ error: 'No se pudo conectar con la base de datos. Intenta en un momento.' }, 503)
  }
}
