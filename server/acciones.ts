// Lo que cada usuario puede leer y cambiar. Todo pasa por aquí y se valida antes de tocar la base.
import { z } from 'zod'
import {
  CATEGORIAS, CULTIVOS, GENERAL, MUNICIPIOS, RENDIMIENTO_INICIAL, TEMPORADAS, TIPOS, TIPOS_NOTA, TIPOS_PUBLICACION,
  type Anuncio, type Cultivo, type DatosServidor, type Gasto, type Nota, type Publicacion,
} from '../src/lib/datos.js'
import type { Consulta } from './db.js'
import type { Usuario } from './sesion.js'

const texto = (max: number) => z.string().trim().min(1).max(max)
const dinero = z.number().finite().positive().max(100_000_000)
const uno = <T extends readonly string[]>(l: T) => z.string().refine((v) => l.includes(v))
const dia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
// Fotos de anuncios: JPEG ya reducido en el navegador.
const foto = z.string().regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/).max(400_000)

export const ACCIONES = {
  nuevoCiclo: z.object({
    temporada: uno(TEMPORADAS),
    cultivos: z.array(z.object({ nombre: uno(CULTIVOS), ha: z.number().positive().max(10_000) })).min(1).max(CULTIVOS.length)
      .refine((l) => new Set(l.map((c) => c.nombre)).size === l.length),
  }),
  elegirCiclo: z.object({ id: z.uuid() }),
  ajustarCultivo: z.object({ nombre: z.string(), rendimiento: z.number().min(0).max(1000), precio: z.number().min(0).max(1_000_000) }),
  pagar: z.object({}),
  gasto: z.object({ concepto: texto(120), monto: dinero, tipo: z.enum(Object.keys(TIPOS) as [keyof typeof TIPOS]), fecha: dia, cultivo: z.string() }),
  borrarGasto: z.object({ id: z.uuid() }),
  nota: z.object({ tipo: uno(TIPOS_NOTA), cultivo: z.string(), texto: texto(500) }),
  anuncio: z.object({
    titulo: texto(80), categoria: uno(CATEGORIAS), modo: z.enum(['venta', 'renta']), precio: dinero,
    unidad: uno(['precio total', 'por día', 'por hectárea']), municipio: uno(MUNICIPIOS), whatsapp: z.string().regex(/^\d{10}$/), foto: foto.optional(),
  }),
  borrarAnuncio: z.object({ id: z.uuid() }),
  publicacion: z.object({ tipo: uno(TIPOS_PUBLICACION), cultivo: uno(CULTIVOS), texto: texto(500) }),
  respuesta: z.object({ publicacion: z.uuid(), texto: texto(300) }),
  borrarTodo: z.object({}),
}
export type Accion = keyof typeof ACCIONES

export class NoSePuede extends Error {}

type FilaCiclo = { id: string; temporada: string; cultivos: Cultivo[]; pagado: boolean }

async function cicloActivo(consulta: Consulta, u: Usuario) {
  if (!u.ciclo_activo) return null
  const [c] = await consulta<FilaCiclo>('select id, temporada, cultivos, pagado from ciclos where id = $1 and usuario_id = $2', [u.ciclo_activo, u.id])
  return c ?? null
}

const iso = (v: unknown) => new Date(v as string).toISOString()

export async function leerDatos(consulta: Consulta, u: Usuario): Promise<DatosServidor> {
  const ciclo = await cicloActivo(consulta, u)
  const [ciclos, gastos, notas, anuncios, publicaciones] = await Promise.all([
    consulta<{ id: string; temporada: string }>('select id, temporada from ciclos where usuario_id = $1 order by creado desc', [u.id]),
    ciclo ? consulta<Gasto>('select id, concepto, monto, tipo, fecha, cultivo from gastos where ciclo_id = $1 order by fecha desc, creado desc', [ciclo.id]) : [],
    ciclo ? consulta<Nota>('select id, tipo, cultivo, texto, creado from notas where ciclo_id = $1 order by creado desc', [ciclo.id]) : [],
    // Las fotos no van aquí: se piden aparte (api/datos?foto=id) para que esta respuesta sea ligera.
    consulta<Anuncio & { usuario_id: string; con_foto: boolean }>(
      `select a.id, a.titulo, a.categoria, a.modo, a.precio, a.unidad, a.municipio, a.whatsapp, u.nombre as autor, a.usuario_id, a.foto is not null as con_foto
       from anuncios a join usuarios u on u.id = a.usuario_id order by a.creado desc limit 200`),
    consulta<Publicacion & { creado: string }>(
      `select p.id, p.tipo, p.municipio, p.cultivo, p.texto, p.creado, u.nombre as autor,
         coalesce((select json_agg(json_build_object('autor', ru.nombre, 'texto', r.texto, 'fecha', r.creado) order by r.creado)
                   from respuestas r join usuarios ru on ru.id = r.usuario_id where r.publicacion_id = p.id), '[]') as respuestas
       from publicaciones p join usuarios u on u.id = p.usuario_id order by p.creado desc limit 100`),
  ])
  return {
    usuario: { usuario: u.usuario, nombre: u.nombre, municipio: u.municipio },
    ciclos: ciclos.map((c) => ({ ...c, activo: c.id === ciclo?.id })),
    productor: ciclo && { nombre: u.nombre, municipio: u.municipio, temporada: ciclo.temporada, cultivos: ciclo.cultivos, pagado: ciclo.pagado },
    gastos,
    bitacora: notas.map((n) => ({ ...n, creado: iso(n.creado) })),
    anuncios: anuncios.map(({ usuario_id, con_foto, ...a }) => ({ ...a, foto: con_foto ? `api/datos?foto=${a.id}` : undefined, propio: usuario_id === u.id })),
    publicaciones: publicaciones.map((p) => ({
      ...p, fecha: iso(p.creado).slice(0, 10),
      respuestas: p.respuestas.map((r) => ({ ...r, fecha: iso(r.fecha).slice(0, 10) })),
    })),
  }
}

function leer<A extends Accion>(accion: A, entrada: unknown): z.infer<(typeof ACCIONES)[A]> {
  const v = ACCIONES[accion].safeParse(entrada)
  if (!v.success) throw new NoSePuede('Revisa los datos: algo no está bien escrito.')
  return v.data as z.infer<(typeof ACCIONES)[A]>
}

export async function hacer(consulta: Consulta, u: Usuario, accion: Accion, entrada: unknown) {
  const ciclo = await cicloActivo(consulta, u)
  const conCiclo = () => {
    if (!ciclo) throw new NoSePuede('Primero empieza un ciclo.')
    return ciclo
  }
  const cultivoValido = (nombre: string) => {
    if (nombre !== GENERAL && !conCiclo().cultivos.some((c) => c.nombre === nombre)) throw new NoSePuede('Ese cultivo no está en tu ciclo.')
  }

  switch (accion) {
    case 'nuevoCiclo': {
      const { temporada, cultivos } = leer('nuevoCiclo', entrada)
      const lista = cultivos.map((c) => ({ nombre: c.nombre, ha: c.ha, ...RENDIMIENTO_INICIAL[c.nombre] }))
      const [c] = await consulta<{ id: string }>('insert into ciclos (usuario_id, temporada, cultivos) values ($1, $2, $3) returning id', [u.id, temporada, JSON.stringify(lista)])
      await consulta('update usuarios set ciclo_activo = $1 where id = $2', [c.id, u.id])
      u.ciclo_activo = c.id
      return
    }
    case 'elegirCiclo': {
      const e = leer('elegirCiclo', entrada)
      const [c] = await consulta('update usuarios set ciclo_activo = $1 where id = $2 and exists (select 1 from ciclos where id = $1 and usuario_id = $2) returning 1', [e.id, u.id])
      if (!c) throw new NoSePuede('Ese ciclo no es tuyo.')
      u.ciclo_activo = e.id
      return
    }
    case 'ajustarCultivo': {
      const { nombre, rendimiento, precio } = leer('ajustarCultivo', entrada)
      cultivoValido(nombre)
      const cultivos = conCiclo().cultivos.map((c) => (c.nombre === nombre ? { ...c, rendimiento, precio } : c))
      await consulta('update ciclos set cultivos = $1 where id = $2', [JSON.stringify(cultivos), conCiclo().id])
      return
    }
    case 'pagar': // Pago simulado: no se cobra nada.
      leer('pagar', entrada)
      await consulta('update ciclos set pagado = true where id = $1', [conCiclo().id])
      return
    case 'gasto': {
      const g = leer('gasto', entrada)
      cultivoValido(g.cultivo)
      await consulta('insert into gastos (ciclo_id, concepto, monto, tipo, fecha, cultivo) values ($1, $2, $3, $4, $5, $6)', [conCiclo().id, g.concepto, g.monto, g.tipo, g.fecha, g.cultivo])
      return
    }
    case 'borrarGasto': {
      const e = leer('borrarGasto', entrada)
      await consulta('delete from gastos where id = $1 and ciclo_id in (select id from ciclos where usuario_id = $2)', [e.id, u.id])
      return
    }
    case 'nota': {
      const n = leer('nota', entrada)
      cultivoValido(n.cultivo)
      // La fecha la pone la base (now()), no el celular.
      await consulta('insert into notas (ciclo_id, tipo, cultivo, texto) values ($1, $2, $3, $4)', [conCiclo().id, n.tipo, n.cultivo, n.texto])
      return
    }
    case 'anuncio': {
      const a = leer('anuncio', entrada)
      await consulta('insert into anuncios (usuario_id, titulo, categoria, modo, precio, unidad, municipio, whatsapp, foto) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
        [u.id, a.titulo, a.categoria, a.modo, a.precio, a.unidad, a.municipio, a.whatsapp, a.foto ?? null])
      return
    }
    case 'borrarAnuncio': {
      const e = leer('borrarAnuncio', entrada)
      await consulta('delete from anuncios where id = $1 and usuario_id = $2', [e.id, u.id])
      return
    }
    case 'publicacion': {
      const p = leer('publicacion', entrada)
      await consulta('insert into publicaciones (usuario_id, tipo, municipio, cultivo, texto) values ($1, $2, $3, $4, $5)', [u.id, p.tipo, u.municipio, p.cultivo, p.texto])
      return
    }
    case 'respuesta': {
      const e = leer('respuesta', entrada)
      const [r] = await consulta('insert into respuestas (publicacion_id, usuario_id, texto) select id, $2, $3 from publicaciones where id = $1 returning 1', [e.publicacion, u.id, e.texto])
      if (!r) throw new NoSePuede('Esa publicación ya no existe.')
      return
    }
    case 'borrarTodo':
      leer('borrarTodo', entrada)
      // Borra lo del usuario (ciclos con sus gastos y bitácora, anuncios, publicaciones). La cuenta se queda.
      await consulta('update usuarios set ciclo_activo = null where id = $1', [u.id])
      for (const t of ['respuestas', 'publicaciones', 'anuncios', 'ciclos']) await consulta(`delete from ${t} where usuario_id = $1`, [u.id])
      u.ciclo_activo = null
      return
  }
}

export async function fotoDe(consulta: Consulta, id: string) {
  if (!z.uuid().safeParse(id).success) return null
  const [a] = await consulta<{ foto: string | null }>('select foto from anuncios where id = $1', [id])
  return a?.foto ? Buffer.from(a.foto.split(',')[1], 'base64') : null
}
