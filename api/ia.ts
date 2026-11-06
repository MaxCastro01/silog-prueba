// Función serverless (Vercel, y npm run dev): las claves viven aquí, nunca en el navegador.
// Proveedores, en este orden si no se fuerza uno con IA_PROVEEDOR (ollama | api | openrouter | anthropic):
//   1. Ollama (IA local, OLLAMA_URL)            2. API externa compatible con OpenAI (IA_API_KEY + IA_MODELO)
//   3. OpenRouter (OPENROUTER_API_KEY)          4. Anthropic (ANTHROPIC_API_KEY)
// Sin ninguno, modo demo. Con Ollama los datos no salen de tu equipo; si Ollama falla, NO se manda a la nube a menos que pongas OLLAMA_RESPALDO=1.
// Con un proveedor externo, el texto de la bitácora y la conversación del chat solo se mandan si pones IA_REGISTROS_EN_NUBE=1.
import Anthropic from '@anthropic-ai/sdk'
import { ENTRADAS, ESFUERZO, ESQUEMAS, SISTEMA, lineaNota, type Entrada, type Tarea } from '../src/lib/ia-tareas.js'
import { base } from '../server/db.js'
import { usuarioDe } from '../server/sesion.js'

export const MODELO = 'claude-opus-5-5'
// Modelos gratuitos de OpenRouter (no cobran). Si uno falla, está saturado o ya no existe, se prueba el siguiente.
// shortcut: lista fija; los gratuitos cambian seguido. Para usar otros, ponlos en OPENROUTER_MODEL separados por comas.
export const MODELOS_GRATIS = [
  'openrouter/free',
  'google/gemini-2.0-flash-exp:free',
  'mistralai/mistral-small-3.2-24b-instruct:free',
  'meta-llama/llama-4-maverick:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'deepseek/deepseek-chat-v3-0324:free',
]
const modelosOpenRouter = () => (process.env.OPENROUTER_MODEL || MODELOS_GRATIS.join(',')).split(',').map((m) => m.trim()).filter(Boolean)

const responder = (cuerpo: unknown, status = 200) => Response.json(cuerpo, { status })

class ErrorProveedor extends Error {
  constructor(public status: number, mensaje: string) { super(mensaje) }
}

/** Lo que se le manda al modelo, igual para todos los proveedores. */
// conRegistros: el texto de la bitácora y la conversación solo se mandan a la IA local, o a la externa si IA_REGISTROS_EN_NUBE=1. Si no, se descartan.
function contenido(tarea: Tarea, entrada: Entrada<Tarea>, conRegistros = false): { texto: string; imagen?: string } {
  if (tarea === 'chat') {
    const e = entrada as Entrada<'chat'>
    const partes = [`HECHOS:\n${e.hechos.map((h) => `- ${h}`).join('\n')}`]
    if (conRegistros && e.notas?.length) partes.push(`BITÁCORA (notas del productor, de la más reciente a la más antigua):\n${e.notas.map((n) => `- ${lineaNota(n)}`).join('\n')}`)
    if (conRegistros && e.historial?.length) partes.push(`CONVERSACIÓN ANTERIOR:\n${e.historial.map((t) => `Productor: ${t.pregunta}\nTú: ${t.respuesta}`).join('\n')}`)
    partes.push(`PREGUNTA: ${e.pregunta}`)
    return { texto: partes.join('\n\n') }
  }
  if (tarea === 'gasto') {
    const { imagen, ...resto } = entrada as Entrada<'gasto'>
    return { texto: JSON.stringify(resto), imagen }
  }
  if (tarea === 'medplant') {
    const { imagen, cultivo, nota } = entrada as Entrada<'medplant'>
    return { texto: `CULTIVO QUE DICE EL PRODUCTOR: ${cultivo}${nota ? `\nLO QUE NOTÓ EL PRODUCTOR: ${nota}` : ''}\n\nAnaliza la planta de la foto.`, imagen }
  }
  return { texto: JSON.stringify(entrada) }
}

async function conAnthropic(tarea: Tarea, { texto, imagen }: ReturnType<typeof contenido>) {
  try {
    const r = await new Anthropic().beta.messages.create({
      model: process.env.ANTHROPIC_MODEL || MODELO,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SISTEMA[tarea],
      output_config: { effort: ESFUERZO[tarea], format: { type: 'json_schema', schema: ESQUEMAS[tarea] } },
      messages: [{
        role: 'user',
        content: [
          ...(imagen ? [{ type: 'image' as const, source: { type: 'base64' as const, media_type: 'image/jpeg' as const, data: imagen } }] : []),
          { type: 'text' as const, text: texto },
        ],
      }],
    })
    if (r.stop_reason !== 'end_turn') throw new ErrorProveedor(502, `Respuesta incompleta (${r.stop_reason})`)
    return r.content.find((b) => b.type === 'text')?.text ?? ''
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) throw new ErrorProveedor(429, 'Muchas solicitudes, intenta en un momento')
    if (e instanceof Anthropic.APIError) throw new ErrorProveedor(502, `Error del servicio de IA (${e.status})`)
    throw e
  }
}

async function conOpenRouter(tarea: Tarea, { texto, imagen }: ReturnType<typeof contenido>) {
  let ultimo = 'sin detalle'
  const limite = Date.now() + 50_000 // la función de Vercel tiene 60 s (vercel.json)
  for (const modelo of modelosOpenRouter()) {
    if (Date.now() > limite) break
    let r: Response
    try {
      r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        signal: AbortSignal.timeout(Math.min(25_000, limite - Date.now())),
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json', 'X-Title': 'Mi Ciclo' },
        body: JSON.stringify({
          model: modelo,
          max_tokens: 1500, // las respuestas son JSON cortos
          // El esquema va también en el texto, por si el modelo no respeta response_format.
          messages: [
            { role: 'system', content: `${SISTEMA[tarea]}\n\nResponde solo con un objeto JSON que cumpla este esquema:\n${JSON.stringify(ESQUEMAS[tarea])}` },
            {
              role: 'user',
              content: [
                ...(imagen ? [{ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imagen}` } }] : []),
                { type: 'text', text: texto },
              ],
            },
          ],
          response_format: { type: 'json_schema', json_schema: { name: tarea, strict: true, schema: ESQUEMAS[tarea] } },
        }),
      })
    } catch {
      ultimo = `${modelo}: no respondió a tiempo`
      continue
    }
    const j = (await r.json().catch(() => ({}))) as { error?: { message?: string }; choices?: { message?: { content?: string }; finish_reason?: string }[] }
    if (r.status === 401) throw new ErrorProveedor(502, 'La clave de OpenRouter no es válida. Revisa OPENROUTER_API_KEY en .env.local.')
    const salida = j.choices?.[0]?.message?.content
    if (r.ok && !j.error && salida && j.choices?.[0]?.finish_reason !== 'length') return salida
    // Saturado, sin saldo, sin soporte para imagen o ya no existe: probamos el siguiente.
    ultimo = `${modelo} (${r.status}): ${(j.error?.message ?? 'respuesta vacía').slice(0, 120)}`
  }
  throw new ErrorProveedor(502, `Ningún modelo de OpenRouter respondió. Los gratuitos a veces están saturados: intenta en un minuto o pon otro en OPENROUTER_MODEL. Último: ${ultimo}`)
}

type Proveedor = 'local' | 'nube'

/** IA local con Ollama (https://ollama.com). OLLAMA_URL, normalmente http://localhost:11434. */
async function conOllama(tarea: Tarea, { texto, imagen }: ReturnType<typeof contenido>) {
  const base = process.env.OLLAMA_URL!.replace(/\/$/, '')
  // El modelo de texto y el de visión son distintos: con 8 GB de VRAM no caben los dos a la vez, Ollama cambia entre ellos.
  const modelo = imagen ? process.env.OLLAMA_MODELO_VISION || 'qwen2.5vl:7b' : process.env.OLLAMA_MODELO || 'qwen3:8b'
  const limite = Number(process.env.OLLAMA_TIMEOUT_MS) || 50_000 // la función de Vercel tiene 60 s (vercel.json)

  const llamar = (conThink: boolean) => fetch(`${base}/api/chat`, {
    signal: AbortSignal.timeout(limite),
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Con la app publicada, Ollama se alcanza por un túnel (ngrok) que exige esta contraseña antes de dejar pasar nada.
      ...(process.env.OLLAMA_TOKEN ? { Authorization: `Bearer ${process.env.OLLAMA_TOKEN}` } : {}),
      'ngrok-skip-browser-warning': '1', // evita la pantalla de aviso de ngrok en las llamadas de servidor
    },
    body: JSON.stringify({
      model: modelo,
      stream: false,
      ...(conThink ? { think: false } : {}), // qwen3 y otros "piensan" antes de contestar: aquí solo estorba
      keep_alive: '30m', // deja el modelo en memoria entre preguntas
      format: ESQUEMAS[tarea], // Ollama acepta el esquema JSON y obliga al modelo a respetarlo
      options: { temperature: 0.2, num_ctx: Number(process.env.OLLAMA_CTX) || 8192 },
      messages: [
        { role: 'system', content: `${SISTEMA[tarea]}\n\nResponde solo con un objeto JSON que cumpla este esquema:\n${JSON.stringify(ESQUEMAS[tarea])}` },
        { role: 'user', content: texto, ...(imagen ? { images: [imagen] } : {}) }, // base64 sin el prefijo data:
      ],
    }),
  })
  type RespuestaOllama = { error?: string; message?: { content?: string } }
  const leer = async (r: Response) => (await r.json().catch(() => ({}))) as RespuestaOllama

  let r: Response
  try {
    r = await llamar(true)
    // Algunos modelos no entienden "think": se vuelve a intentar sin él.
    if (r.status === 400 && /think/i.test((await r.clone().text().catch(() => '')))) r = await llamar(false)
  } catch (e) {
    const lento = e instanceof DOMException && e.name === 'TimeoutError'
    throw new ErrorProveedor(502, lento ? 'La IA local tardó demasiado. Si es la primera pregunta, el modelo estaba cargando: intenta otra vez.' : 'No se pudo conectar con la IA local. ¿Está prendido Ollama?')
  }
  const j = await leer(r)
  if (!r.ok || j.error) {
    if (r.status === 401 || r.status === 403) throw new ErrorProveedor(502, 'El túnel de la IA local rechazó la contraseña. Revisa que OLLAMA_TOKEN sea el mismo de ollama.yaml.')
    const falta = r.status === 404 || /not found/i.test(j.error ?? '')
    throw new ErrorProveedor(502, falta ? `A Ollama le falta el modelo ${modelo}. Instálalo con: ollama pull ${modelo}` : `La IA local no respondió (${(j.error ?? r.status).toString().slice(0, 120)})`)
  }
  if (!j.message?.content) throw new ErrorProveedor(502, 'La IA local respondió vacío. Intenta otra vez.')
  return j.message.content
}

/** IA externa con clave: cualquier API compatible con OpenAI (OpenAI, Gemini, Groq, DeepSeek, Together, etc.). */
async function conApiExterna(tarea: Tarea, { texto, imagen }: ReturnType<typeof contenido>) {
  const base = (process.env.IA_API_URL || 'https://api.openai.com/v1').replace(/\/$/, '')
  const modelo = (imagen && process.env.IA_MODELO_VISION) || process.env.IA_MODELO
  if (!modelo) throw new ErrorProveedor(502, 'Falta IA_MODELO: el nombre del modelo de tu proveedor de IA (míralo en su documentación).')
  const limite = Number(process.env.IA_TIMEOUT_MS) || 50_000 // la función de Vercel tiene 60 s (vercel.json)
  const mensajes = [
    // El esquema va también en el texto, por si el modelo no respeta response_format.
    { role: 'system', content: `${SISTEMA[tarea]}\n\nResponde solo con un objeto JSON que cumpla este esquema:\n${JSON.stringify(ESQUEMAS[tarea])}` },
    {
      role: 'user',
      content: [
        ...(imagen ? [{ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imagen}` } }] : []),
        { type: 'text', text: texto },
      ],
    },
  ]
  // No todos los proveedores aceptan el esquema estricto: si lo rechazan (400) se prueba uno menos exigente.
  // No se manda max_tokens ni temperature porque algunos modelos nuevos rechazan esos parámetros.
  const formatos: (object | undefined)[] = [{ type: 'json_schema', json_schema: { name: tarea, strict: true, schema: ESQUEMAS[tarea] } }, { type: 'json_object' }, undefined]
  let ultimo = 'sin detalle'
  for (const formato of formatos) {
    let r: Response
    try {
      r = await fetch(`${base}/chat/completions`, {
        signal: AbortSignal.timeout(limite),
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.IA_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: modelo, messages: mensajes, ...(formato ? { response_format: formato } : {}) }),
      })
    } catch (e) {
      const lento = e instanceof DOMException && e.name === 'TimeoutError'
      throw new ErrorProveedor(502, lento ? 'La IA externa tardó demasiado. Intenta otra vez.' : 'No se pudo conectar con la IA externa. Revisa IA_API_URL y tu conexión.')
    }
    const j = (await r.json().catch(() => ({}))) as { error?: { message?: string } | string; choices?: { message?: { content?: string }; finish_reason?: string }[] }
    const detalle = (typeof j.error === 'string' ? j.error : j.error?.message ?? '').slice(0, 160)
    if (r.status === 401 || r.status === 403) throw new ErrorProveedor(502, 'La clave de la IA externa no es válida o no tiene permiso. Revisa IA_API_KEY.')
    if (r.status === 429) throw new ErrorProveedor(429, 'La IA externa dice que hay muchas solicitudes o que se acabó el saldo. Intenta en un momento o revisa tu cuenta.')
    if (r.status === 404) throw new ErrorProveedor(502, `La IA externa no encontró el modelo ${modelo} o la dirección. Revisa IA_MODELO e IA_API_URL.`)
    const salida = j.choices?.[0]?.message?.content
    if (r.ok && !j.error && salida) {
      if (j.choices?.[0]?.finish_reason === 'length') throw new ErrorProveedor(502, 'La respuesta de la IA externa quedó incompleta. Intenta otra vez.')
      return salida
    }
    ultimo = `(${r.status}) ${detalle || 'respuesta vacía'}`
    if (r.status !== 400) break // un 400 suele ser el formato: se prueba el siguiente; cualquier otro error ya no mejora
  }
  throw new ErrorProveedor(502, `La IA externa no respondió ${ultimo}`)
}

type Opcion = 'ollama' | 'api' | 'openrouter' | 'anthropic'
const OPCIONES: Opcion[] = ['ollama', 'api', 'openrouter', 'anthropic']

/** Los proveedores que tienen sus variables puestas, en orden de prioridad. */
const configurados = (): Opcion[] => OPCIONES.filter((o) => ({
  ollama: process.env.OLLAMA_URL,
  api: process.env.IA_API_KEY,
  openrouter: process.env.OPENROUTER_API_KEY,
  anthropic: process.env.ANTHROPIC_API_KEY,
})[o])

/** IA_PROVEEDOR fuerza uno; si no, el primero configurado. */
function elegir(): { proveedor?: Opcion; error?: string } {
  const forzado = process.env.IA_PROVEEDOR?.trim().toLowerCase()
  if (!forzado) return { proveedor: configurados()[0] }
  if (!OPCIONES.includes(forzado as Opcion)) return { error: `IA_PROVEEDOR debe ser una de estas: ${OPCIONES.join(', ')}.` }
  if (!configurados().includes(forzado as Opcion)) {
    const falta = { ollama: 'OLLAMA_URL', api: 'IA_API_KEY', openrouter: 'OPENROUTER_API_KEY', anthropic: 'ANTHROPIC_API_KEY' }[forzado as Opcion]
    return { error: `IA_PROVEEDOR=${forzado} pero falta ${falta}.` }
  }
  return { proveedor: forzado as Opcion }
}

async function llamar(p: Opcion, tarea: Tarea, entrada: Entrada<Tarea>): Promise<string> {
  // La IA local siempre ve las notas y la conversación; las externas solo con IA_REGISTROS_EN_NUBE=1.
  const c = contenido(tarea, entrada, p === 'ollama' || process.env.IA_REGISTROS_EN_NUBE === '1')
  if (p === 'ollama') return conOllama(tarea, c)
  if (p === 'api') return conApiExterna(tarea, c)
  if (p === 'openrouter') return conOpenRouter(tarea, c)
  return conAnthropic(tarea, c)
}

/** Con Ollama la nube solo es respaldo si OLLAMA_RESPALDO=1 (y entonces los datos sí salen). */
async function generar(proveedor: Opcion, tarea: Tarea, entrada: Entrada<Tarea>): Promise<{ texto: string; proveedor: Proveedor }> {
  try {
    return { texto: await llamar(proveedor, tarea, entrada), proveedor: proveedor === 'ollama' ? 'local' : 'nube' }
  } catch (e) {
    const respaldo = configurados().find((o) => o !== 'ollama')
    if (proveedor === 'ollama' && process.env.OLLAMA_RESPALDO === '1' && respaldo) return { texto: await llamar(respaldo, tarea, entrada), proveedor: 'nube' }
    throw e
  }
}

/** Algunos modelos envuelven el JSON en ```json … ```; nos quedamos con el objeto. */
export const extraerJSON = (texto: string) => JSON.parse(texto.slice(texto.indexOf('{'), texto.lastIndexOf('}') + 1))

export async function POST(req: Request) {
  // Sin ningún proveedor: la app usa sus respuestas de ejemplo.
  if (!configurados().length && !process.env.IA_PROVEEDOR) return responder({ demo: true })
  // Solo quien entró con su usuario usa la IA.
  const usuario = await base().then((c) => usuarioDe(c, req)).catch(() => null)
  if (!usuario) return responder({ error: 'Entra con tu usuario para usar la IA.' }, 401)

  const cuerpo = (await req.json().catch(() => null)) as { tarea?: string; entrada?: unknown } | null
  const tarea = cuerpo?.tarea as Tarea
  if (!Object.hasOwn(ENTRADAS, tarea)) return responder({ error: 'Tarea desconocida' }, 400)
  const entrada = ENTRADAS[tarea].safeParse(cuerpo?.entrada)
  if (!entrada.success) return responder({ error: 'Datos no válidos' }, 400)

  const { proveedor: elegido, error } = elegir()
  if (!elegido) return responder({ error: error ?? 'La IA no está configurada.' }, 502)

  try {
    const { texto, proveedor } = await generar(elegido, tarea, entrada.data)
    // "local" solo aparece cuando contestó Ollama: la pantalla lo muestra como "IA local".
    return responder({ respuesta: extraerJSON(texto), ...(proveedor === 'local' ? { local: true } : {}) })
  } catch (e) {
    if (e instanceof ErrorProveedor) return responder({ error: e.message }, e.status)
    if (e instanceof TypeError) return responder({ error: 'No se pudo conectar con el servicio de IA' }, 502)
    return responder({ error: 'No se pudo leer la respuesta' }, 502)
  }
}
