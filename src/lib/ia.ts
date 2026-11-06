// Única puerta a la IA desde el navegador. Sin servidor o sin clave, usa respuestas de ejemplo.
import { GENERAL } from './datos'
import { SALIDAS, type Entrada, type Salida, type Tarea } from './ia-tareas'
import type { Accion } from './palancas'

export class ErrorIA extends Error {}

// La IA local a veces contesta algo que no pasa la validación (formato o cifras): se le pregunta una vez más.
const INTENTOS = 2

/**
 * `aceptar` es opcional: una regla extra (por ejemplo, que las cifras vengan de los hechos).
 * Si la respuesta no la cumple se reintenta; al agotar los intentos se regresa la última y la pantalla decide qué mostrar.
 * `local` es true cuando contestó Ollama (IA en el equipo del dueño de la app, no en la nube).
 */
export async function pedirIA<T extends Tarea>(
  tarea: T,
  entrada: Entrada<T>,
  ejemplo: () => Salida<T>,
  aceptar?: (datos: Salida<T>) => boolean,
): Promise<{ datos: Salida<T>; ejemplo: boolean; local: boolean }> {
  const comoEjemplo = () => ({ datos: ejemplo(), ejemplo: true, local: false })
  for (let intento = 1; ; intento++) {
    let r: Response
    try {
      r = await fetch('api/ia', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tarea, entrada }) })
    } catch {
      return comoEjemplo() // sin internet
    }
    // npm run dev, XAMPP o vite preview no tienen la función: modo demo.
    if (!r.headers.get('content-type')?.includes('application/json')) return comoEjemplo()
    const j = await r.json().catch(() => ({}))
    if (j.demo) return comoEjemplo()
    if (!r.ok) throw new ErrorIA(j.error ?? 'No se pudo usar la IA. Intenta otra vez.')
    const v = SALIDAS[tarea].safeParse(j.respuesta)
    if (v.success) {
      const datos = v.data as Salida<T>
      if (!aceptar || aceptar(datos) || intento >= INTENTOS) return { datos, ejemplo: false, local: Boolean(j.local) }
    } else if (intento >= INTENTOS) {
      throw new ErrorIA('La IA respondió algo que no entendimos. No se guardó nada.')
    }
  }
}

/** El plan solo vale si usa acciones de la lista y no trae cifras inventadas. */
export function validarPlan(plan: Salida<'plan'>, acciones: Accion[]) {
  const ids = plan.acciones.map((a) => a.id)
  const conocidas = new Set(acciones.map((a) => a.id))
  const ok =
    ids.length >= Math.min(3, acciones.length) && ids.length <= 5 && new Set(ids).size === ids.length && ids.every((id) => conocidas.has(id)) &&
    ![plan.resumen, ...plan.acciones.map((a) => a.texto)].some((t) => /\d/.test(t))
  if (!ok) throw new ErrorIA('La IA dio un plan que no pudimos comprobar. Inténtalo de nuevo.')
  return plan
}

const numeros = (t: string) => (t.match(/\d[\d,]*(\.\d+)?/g) ?? []).map((n) => n.replaceAll(',', ''))

/** Cada número de la respuesta tiene que venir de los hechos calculados por la app. */
export function numerosValidos(respuesta: string, hechos: string[]) {
  const permitidos = new Set(hechos.flatMap(numeros))
  return numeros(respuesta).every((n) => permitidos.has(n))
}

// Textos de ejemplo para cuando no hay IA. Las cifras las pone la app, no estos textos.
const TEXTOS_EJEMPLO: Record<string, string> = {
  'rentar-sembradora': 'Renta la sembradora de precisión del vecino en vez de pagar la maquila de siembra.',
  'zona-maquila': 'Pide precio a otros maquileros: pagas más de maquila que tus vecinos.',
  'apoyo-tonelada': 'Pregunta en el CADER o en tu asociación si calificas a un apoyo por tonelada.',
  'vender-grupo': 'Júntate con otros productores para vender en grupo o amarrar un contrato.',
}
const ORDEN_EJEMPLO = ['zona-maquila', 'rentar-sembradora', 'apoyo-tonelada', 'vender-grupo']

export function planEjemplo(acciones: Accion[]): Salida<'plan'> {
  const elegidas = [...acciones].sort((a, b) => (ORDEN_EJEMPLO.indexOf(a.id) + 1 || 99) - (ORDEN_EJEMPLO.indexOf(b.id) + 1 || 99)).slice(0, 4)
  return {
    resumen: 'Con lo que te ofrecen hoy no te alcanza. Bajar la maquila ayuda, pero lo que más pesa es el precio de venta.',
    acciones: elegidas.map((a) => ({ id: a.id, texto: TEXTOS_EJEMPLO[a.id] ?? a.titulo })),
  }
}

/** Lo que leyó la IA de una nota pasa a texto de formulario; lo que no cuadra se deja vacío o en su valor normal. */
export function limpiarGasto(g: Salida<'gasto'>, cultivos: string[], hoy: string) {
  return {
    concepto: g.concepto.slice(0, 80),
    monto: Number.isFinite(g.monto) && g.monto > 0 ? String(Math.round(g.monto * 100) / 100) : '',
    tipo: g.tipo,
    fecha: /^\d{4}-\d{2}-\d{2}$/.test(g.fecha) && g.fecha <= hoy ? g.fecha : hoy,
    cultivo: cultivos.includes(g.cultivo) ? g.cultivo : GENERAL,
  }
}

// ---- MedPlant: lo que la IA dice de la foto de una planta ----

// MedPlant orienta, no receta: ninguna línea con agroquímicos o dosis llega a la pantalla, aunque el modelo la escriba.
const QUIMICA = /fungicida|insecticida|herbicida|acaricida|nematicida|plaguicida|pesticida|agroqu[ií]mic|\bdosis\b|\b\d+([.,]\d+)?\s*(ml|cc|l|lt|lts|litros?|g|gr|gramos?|kg|kilos?)\b/i

/** Deja la respuesta de MedPlant lista para mostrar: textos cortos, sin productos ni dosis y sin afirmar lo que no se sostiene. */
export function limpiarMedplant(m: Salida<'medplant'>) {
  const corto = (t: string, n: number) => t.replace(/\s+/g, ' ').trim().slice(0, n)
  const seguro = (t: string) => !QUIMICA.test(t)
  const lista = (a: string[], max: number, n: number) => a.map((x) => corto(x, n)).filter((x) => x && seguro(x)).slice(0, max)

  const esPlanta = m.esPlanta
  const observaciones = esPlanta ? lista(m.observaciones, 5, 160) : []
  const queHacer = esPlanta ? lista(m.queHacer, 4, 160) : []
  const posiblesCausas = esPlanta
    ? m.posiblesCausas
        .map((c) => ({ nombre: corto(c.nombre, 60), certeza: c.certeza, porQue: corto(c.porQue, 160) }))
        .filter((c) => c.nombre && seguro(c.nombre) && seguro(c.porQue))
        .slice(0, 3)
    : []
  // Sin nada que se vea en la foto no se afirma ni "sana" ni "con problema".
  const estado = !esPlanta || observaciones.length === 0 ? 'no_se_sabe' : m.estado
  const resumenModelo = corto(m.resumen, 300)
  const resumen = resumenModelo && seguro(resumenModelo) ? resumenModelo : esPlanta ? 'Revisa lo que se ve en la foto y consulta a un agrónomo.' : 'No veo una planta en la foto.'
  const mejorarFoto = corto(m.mejorarFoto, 200)
  return {
    esPlanta,
    planta: corto(m.planta, 40) || 'No se distingue',
    estado,
    resumen,
    observaciones,
    posiblesCausas,
    queHacer,
    // Ante un problema siempre se manda con el agrónomo, diga lo que diga el modelo.
    consultarAgronomo: m.consultarAgronomo || estado === 'con_problema',
    mejorarFoto: seguro(mejorarFoto) ? mejorarFoto : '',
  }
}
export type ResultadoMedplant = ReturnType<typeof limpiarMedplant>

/** Lo que se muestra en modo demo, sin IA conectada. */
export const medplantEjemplo = (cultivo: string): Salida<'medplant'> => ({
  esPlanta: true,
  planta: cultivo === 'No sé' ? 'No se distingue' : cultivo,
  estado: 'con_detalles',
  resumen: 'Se ven algunas hojas con manchas claras. Puede ser un daño leve, pero con una sola foto no se puede estar seguro.',
  observaciones: ['Manchas claras en varias hojas', 'El resto de la planta se ve verde y firme'],
  posiblesCausas: [
    { nombre: 'Falta de nutrientes', certeza: 'baja', porQue: 'Las manchas están repartidas y no se ven insectos.' },
    { nombre: 'Hongo en la hoja', certeza: 'baja', porQue: 'Las manchas podrían ser el inicio de una enfermedad.' },
  ],
  queHacer: ['Revisa el envés de las hojas y si se repite en otras plantas', 'Anota desde cuándo lo ves', 'Toma otra foto de cerca y con luz de día'],
  consultarAgronomo: true,
  mejorarFoto: 'Acércate a una hoja afectada y toma la foto con luz de día.',
})
