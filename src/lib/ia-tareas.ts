// Lo que comparten el navegador (src/lib/ia.ts) y el servidor (api/ia.ts): qué pide cada tarea y qué responde.
import { z } from 'zod'
import { TIPOS, TIPOS_NOTA } from './datos.js'

const tipoGasto = z.enum(Object.keys(TIPOS) as [keyof typeof TIPOS, ...(keyof typeof TIPOS)[]])

// Al modelo solo le llegan números y categorías: nunca nombre, teléfono ni municipio.
export const ENTRADAS = {
  plan: z.object({
    cultivo: z.string().max(30),
    hectareas: z.number(),
    gastoPorHectarea: z.array(z.object({ tipo: z.string().max(30), tuyo: z.number(), zona: z.number().nullable() })).max(20),
    faltaPorHectarea: z.number(),
    acciones: z.array(z.object({ id: z.string().max(40), titulo: z.string().max(120), certeza: z.string().max(20), fuente: z.string().max(30) })).max(20),
    bitacora: z.array(z.object({ tipo: z.string().max(20), fecha: z.string().max(10) })).max(50),
  }),
  gasto: z.object({
    texto: z.string().max(500).optional(),
    imagen: z.string().max(4_000_000).optional(), // JPEG en base64
    cultivos: z.array(z.string().max(30)).max(10),
    hoy: z.string().max(10),
  }),
  bitacora: z.object({ texto: z.string().max(500), cultivos: z.array(z.string().max(30)).max(10) }),
  // MedPlant: la foto de una planta, el cultivo que cree el productor y, si quiere, lo que notó.
  medplant: z.object({
    imagen: z.string().max(4_000_000), // JPEG en base64
    cultivo: z.string().max(30),
    nota: z.string().max(300).optional(),
  }),
  chat: z.object({
    pregunta: z.string().max(300),
    hechos: z.array(z.string().max(200)).max(120),
    // Lo que el productor escribió en su bitácora y las últimas preguntas de la conversación.
    // Solo los usa la IA local: si contesta la nube, el servidor los descarta.
    notas: z.array(z.object({ fecha: z.string().max(40), tipo: z.string().max(30), cultivo: z.string().max(30), texto: z.string().max(300) })).max(40).optional(),
    historial: z.array(z.object({ pregunta: z.string().max(300), respuesta: z.string().max(600) })).max(4).optional(),
  }),
}

/** Una nota de la bitácora como línea de texto. La usan igual el servidor (para el modelo) y la pantalla (para revisar las cifras). */
export const lineaNota = (n: { fecha: string; tipo: string; cultivo: string; texto: string }) => `${n.fecha} · ${n.tipo} · ${n.cultivo}: ${n.texto}`

export const SALIDAS = {
  plan: z.object({ resumen: z.string(), acciones: z.array(z.object({ id: z.string(), texto: z.string() })) }),
  gasto: z.object({ concepto: z.string(), monto: z.number(), tipo: tipoGasto, fecha: z.string(), cultivo: z.string() }),
  bitacora: z.object({ tipo: z.enum(TIPOS_NOTA as [string, ...string[]]), cultivo: z.string(), texto: z.string() }),
  chat: z.object({ fueraDeTema: z.boolean(), respuesta: z.string() }),
  medplant: z.object({
    esPlanta: z.boolean(),
    planta: z.string(),
    estado: z.enum(['sana', 'con_detalles', 'con_problema', 'no_se_sabe']),
    resumen: z.string(),
    observaciones: z.array(z.string()),
    posiblesCausas: z.array(z.object({ nombre: z.string(), certeza: z.enum(['alta', 'media', 'baja']), porQue: z.string() })),
    queHacer: z.array(z.string()),
    consultarAgronomo: z.boolean(),
    mejorarFoto: z.string(),
  }),
}

export type Tarea = keyof typeof SALIDAS
export type Entrada<T extends Tarea> = z.infer<(typeof ENTRADAS)[T]>
export type Salida<T extends Tarea> = z.infer<(typeof SALIDAS)[T]>

const LIMITES = 'Nunca recomiendes marcas, productos ni dosis de agroquímicos. Si se habla de plagas, solo di: "consulta a un agrónomo o a la junta local de sanidad vegetal". Nunca prometas un apoyo de gobierno: di "revisa si calificas".'

export const SISTEMA: Record<Tarea, string> = {
  plan: `Ayudas a un productor agrícola de Sinaloa a dejar de perder dinero. Recibes sus números ya calculados y una lista de acciones posibles, cada una con su id.
Escoge de 3 a 5 acciones de esa lista (todas si hay menos de 3), las que más le ayuden, y para cada una escribe qué hacer en una sola frase corta, como habla la gente del campo.
En "resumen" escribe una o dos frases que expliquen su situación.
Reglas: no escribas ningún número ni cifra, la app pone los montos. No inventes acciones fuera de la lista. ${LIMITES} El productor decide; tú solo sugieres.`,
  gasto: `Lees la nota de compra (foto) o lo que dijo el productor (texto) y sacas un solo gasto.
"tipo" es uno de: ${Object.entries(TIPOS).map(([k, v]) => `${k} (${v})`).join(', ')}.
"monto" es el total en pesos. "fecha" en formato AAAA-MM-DD; si no se ve, usa la de hoy que te dan. "cultivo" es uno de la lista que te dan o "General" si no se sabe.
"concepto" es corto, sin nombres de personas.`,
  bitacora: `Conviertes lo que dijo el productor en una nota de bitácora del campo.
"tipo" es uno de: ${TIPOS_NOTA.join(', ')}. "cultivo" es uno de la lista que te dan o "General". "texto" resume lo que pasó en una frase, sin nombres de personas. ${LIMITES}`,
  medplant: `Eres MedPlant, un apoyo para un productor agrícola de Sinaloa. Recibes la foto de una planta, el cultivo que cree el productor y, a veces, lo que notó. Dices qué se ve y qué podría estar pasando. No eres agrónomo ni das un diagnóstico seguro.
Reglas:
- Describe solo lo que se VE en la foto. No inventes síntomas. Si la foto está borrosa, oscura, lejana o tapada, di estado "no_se_sabe" y en "mejorarFoto" explica cómo tomarla mejor (por ejemplo: de cerca, con luz de día, la hoja del frente y del envés).
- Si la foto no es de una planta, pon esPlanta en false, estado "no_se_sabe" y listas vacías.
- "planta" es qué planta parece; si no se distingue, "No se distingue". Si el cultivo que dice el productor no coincide con lo que ves, dilo en el resumen.
- "estado" es sana, con_detalles (manchas leves, daños pequeños), con_problema (daño claro o que se extiende) o no_se_sabe.
- "observaciones": de 1 a 5 frases cortas de lo que se ve (color, manchas, forma de las hojas, insectos visibles, marchitez).
- "posiblesCausas": hasta 3 causas posibles (plaga, enfermedad, falta de nutrientes, falta o exceso de agua, calor, daño mecánico), cada una con certeza alta, media o baja y en "porQue" qué de la foto lo apunta. Nunca pongas certeza alta si la foto no es clara. Nunca afirmes una enfermedad o plaga como un hecho.
- "queHacer": hasta 4 pasos seguros y sencillos, como habla la gente del campo: revisar el envés de las hojas, ver si se repite en otras plantas, anotar cuándo empezó, tomar otra foto, revisar el riego, aislar la planta. No pongas ningún producto, marca ni dosis.
- "consultarAgronomo" en true si el estado es con_problema, si hay dudas importantes o si puede extenderse al lote.
- Escribe todo en español sencillo, sin tecnicismos de más. ${LIMITES}`,
  chat: `Eres el asistente de un productor agrícola de Sinaloa. Contestas solo preguntas sobre sus registros, con lo que viene en el mensaje:
HECHOS: números ya calculados por la app (gastos, costo por tonelada, zona, gasto por mes, últimos gastos).
BITÁCORA: las notas que el productor escribió, de la más reciente a la más antigua. Si no viene, no tienes sus notas.
CONVERSACIÓN ANTERIOR: sirve para entender preguntas como "¿y la semana pasada?".
Usa únicamente los números y las fechas de HECHOS y BITÁCORA, escritos igual que ahí (por ejemplo "6 de octubre de 2026"); no hagas cuentas nuevas ni sumas.
Contesta en una o dos frases sencillas, con palabras de campo. Si piden un resumen, hasta cinco frases cortas.
Si preguntan por la bitácora, di qué anotó y cuándo, sin agregar nada que no esté escrito.
Si lo que piden sí es de sus registros pero no está en HECHOS ni en BITÁCORA, responde "No tengo eso anotado." con fueraDeTema en false.
Si la pregunta no es sobre sus registros (el clima, qué producto aplicar, política), pon fueraDeTema en true y respuesta vacía. ${LIMITES}`,
}

export const ESFUERZO: Record<Tarea, 'low' | 'medium'> = { plan: 'medium', gasto: 'low', bitacora: 'low', chat: 'low', medplant: 'medium' }

const esquemaJSON = (s: z.ZodType) => {
  const { $schema: _, ...resto } = z.toJSONSchema(s) as Record<string, unknown>
  return resto
}
export const ESQUEMAS = Object.fromEntries(Object.entries(SALIDAS).map(([k, v]) => [k, esquemaJSON(v)])) as Record<Tarea, Record<string, unknown>>
