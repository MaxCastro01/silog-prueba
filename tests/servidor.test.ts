import { afterEach, beforeAll, beforeEach, expect, test, vi } from 'vitest'
import { entrar } from './ayuda'
import { POST, extraerJSON } from '../api/ia'

let cookie = ''
beforeAll(async () => { cookie = await entrar() })
const pedir = (cuerpo: unknown, conSesion = true) =>
  POST(new Request('http://localhost/api/ia', { method: 'POST', headers: conSesion ? { cookie } : {}, body: JSON.stringify(cuerpo) }))
// Antes y después de cada prueba no debe quedar ninguna variable de IA: ni las de tu .env.local ni las de otra prueba.
const VARIABLES_IA = ['ANTHROPIC_API_KEY', 'ANTHROPIC_MODEL', 'OPENROUTER_API_KEY', 'OPENROUTER_MODEL', 'OLLAMA_URL', 'OLLAMA_TOKEN', 'OLLAMA_MODELO', 'OLLAMA_MODELO_VISION', 'OLLAMA_RESPALDO', 'OLLAMA_CTX', 'OLLAMA_TIMEOUT_MS', 'IA_API_URL', 'IA_API_KEY', 'IA_MODELO', 'IA_MODELO_VISION', 'IA_PROVEEDOR', 'IA_REGISTROS_EN_NUBE', 'IA_TIMEOUT_MS']
const limpiarIA = () => { for (const k of VARIABLES_IA) delete process.env[k] }
beforeEach(limpiarIA)
afterEach(() => {
  limpiarIA()
  vi.unstubAllGlobals()
})

test('sin clave responde modo demo', async () => {
  expect(await (await pedir({ tarea: 'chat', entrada: {} })).json()).toEqual({ demo: true })
})

test('con clave, solo quien entró puede usar la IA', async () => {
  process.env.OPENROUTER_API_KEY = 'prueba'
  const f = openRouterResponde({})
  expect((await pedir({ tarea: 'chat', entrada: { pregunta: 'hola', hechos: [] } }, false)).status).toBe(401)
  expect(f).not.toHaveBeenCalled()
})

test('con clave valida la tarea y los datos antes de llamar al modelo', async () => {
  process.env.ANTHROPIC_API_KEY = 'prueba'
  expect((await pedir({ tarea: 'hackear' })).status).toBe(400)
  expect((await pedir({ tarea: '__proto__' })).status).toBe(400)
  expect((await pedir({ tarea: 'chat', entrada: { pregunta: 'x'.repeat(1000), hechos: [] } })).status).toBe(400)
})

function openRouterResponde(cuerpo: object, status = 200) {
  const f = vi.fn(async (_url: string, _init: RequestInit) => new Response(JSON.stringify(cuerpo), { status }))
  vi.stubGlobal('fetch', f)
  return f
}
const gasto = { concepto: 'Diésel', monto: 800, tipo: 'diesel', fecha: '2026-10-09', cultivo: 'Maíz' }

test('OpenRouter: manda modelo, esquema e imagen, y regresa el JSON', async () => {
  process.env.OPENROUTER_API_KEY = 'sk-or-prueba'
  process.env.OPENROUTER_MODEL = 'anthropic/claude-haiku-5.5'
  const f = openRouterResponde({ choices: [{ finish_reason: 'stop', message: { content: '```json\n' + JSON.stringify(gasto) + '\n```' } }] })
  const r = await pedir({ tarea: 'gasto', entrada: { imagen: 'AAAA', cultivos: ['Maíz'], hoy: '2026-10-09' } })
  expect(await r.json()).toEqual({ respuesta: gasto })
  const [url, init] = f.mock.calls[0]
  expect(url).toBe('https://openrouter.ai/api/v1/chat/completions')
  expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sk-or-prueba')
  const body = JSON.parse(init.body as string)
  expect(body.model).toBe('anthropic/claude-haiku-5.5')
  expect(body.response_format.json_schema.name).toBe('gasto')
  expect(body.messages[1].content[0]).toEqual({ type: 'image_url', image_url: { url: 'data:image/jpeg;base64,AAAA' } })
})

test('OpenRouter: sus errores llegan como mensaje amable, sin la clave', async () => {
  process.env.OPENROUTER_API_KEY = 'sk-or-prueba'
  openRouterResponde({ error: { message: 'xyz is not a valid model ID' } }, 400)
  const r = await pedir({ tarea: 'chat', entrada: { pregunta: 'hola', hechos: [] } })
  expect(r.status).toBe(502)
  const { error } = (await r.json()) as { error: string }
  expect(error).toContain('not a valid model ID')
  expect(error).not.toContain('sk-or')
})

test('OpenRouter: sin OPENROUTER_MODEL usa modelos gratuitos y salta al siguiente si uno falla', async () => {
  process.env.OPENROUTER_API_KEY = 'sk-or-prueba'
  const respuestas = [
    new Response(JSON.stringify({ error: { message: 'rate limited' } }), { status: 429 }),
    new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ fueraDeTema: false, respuesta: 'ok' }) } }] })),
  ]
  const f = vi.fn(async (_url: string, _init: RequestInit) => respuestas.shift()!)
  vi.stubGlobal('fetch', f)
  const r = await pedir({ tarea: 'chat', entrada: { pregunta: 'hola', hechos: [] } })
  expect(await r.json()).toEqual({ respuesta: { fueraDeTema: false, respuesta: 'ok' } })
  const modelos = f.mock.calls.map((c) => JSON.parse(c[1].body as string).model)
  expect(modelos).toHaveLength(2)
  expect(modelos.every((m: string) => m === 'openrouter/free' || m.endsWith(':free'))).toBe(true)
  expect(JSON.parse(f.mock.calls[0][1].body as string).max_tokens).toBeLessThanOrEqual(1500)
})

test('OpenRouter: si un modelo no responde a tiempo, prueba el siguiente', async () => {
  process.env.OPENROUTER_API_KEY = 'sk-or-prueba'
  let llamadas = 0
  vi.stubGlobal('fetch', vi.fn(async () => {
    if (llamadas++ === 0) throw new DOMException('timeout', 'TimeoutError')
    return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: '{"fueraDeTema":true,"respuesta":""}' } }] }))
  }))
  const r = await pedir({ tarea: 'chat', entrada: { pregunta: 'hola', hechos: [] } })
  expect(await r.json()).toEqual({ respuesta: { fueraDeTema: true, respuesta: '' } })
  expect(llamadas).toBe(2)
})

test('OpenRouter: clave mala se avisa sin probar más modelos', async () => {
  process.env.OPENROUTER_API_KEY = 'sk-or-mala'
  const f = openRouterResponde({ error: { message: 'No auth' } }, 401)
  const r = await pedir({ tarea: 'chat', entrada: { pregunta: 'hola', hechos: [] } })
  expect(((await r.json()) as { error: string }).error).toContain('clave de OpenRouter no es válida')
  expect(f).toHaveBeenCalledTimes(1)
})

// --- Ollama (IA local)
const ollamaResponde = (contenido: object, status = 200) => {
  const f = vi.fn(async (_url: string, _init: RequestInit) => new Response(JSON.stringify(status === 200 ? { message: { role: 'assistant', content: JSON.stringify(contenido) } } : contenido), { status }))
  vi.stubGlobal('fetch', f)
  return f
}
const chat = { tarea: 'chat', entrada: { pregunta: 'hola', hechos: ['Gasto en Diésel: $75,000'] } }

test('Ollama: con OLLAMA_URL no necesita ninguna clave, manda el esquema y marca la respuesta como local', async () => {
  process.env.OLLAMA_URL = 'http://localhost:11434/'
  const f = ollamaResponde({ fueraDeTema: false, respuesta: 'Llevas $75,000 de diésel.' })
  const r = await pedir(chat)
  expect(await r.json()).toEqual({ respuesta: { fueraDeTema: false, respuesta: 'Llevas $75,000 de diésel.' }, local: true })
  const [url, init] = f.mock.calls[0]
  expect(url).toBe('http://localhost:11434/api/chat')
  const body = JSON.parse(init.body as string)
  expect(body).toMatchObject({ model: 'qwen3:8b', stream: false, think: false, keep_alive: '30m' })
  expect(body.format).toMatchObject({ type: 'object', required: ['fueraDeTema', 'respuesta'] })
  expect(body.options).toMatchObject({ temperature: 0.2, num_ctx: 8192 })
  expect(body.messages[0].role).toBe('system')
  expect(body.messages[1].content).toContain('HECHOS:\n- Gasto en Diésel: $75,000')
  expect((init.headers as Record<string, string>).Authorization).toBeUndefined()
})

const conRegistros = {
  tarea: 'chat',
  entrada: {
    pregunta: '¿Cuándo vi plaga?',
    hechos: ['Gasto en Diésel: $75,000'],
    notas: [{ fecha: '8 de octubre de 2026', tipo: 'Plaga', cultivo: 'Maíz', texto: 'Se ve gusano cogollero en la orilla del canal.' }],
    historial: [{ pregunta: '¿En qué gasté más?', respuesta: 'En renta.' }],
  },
}

test('Ollama: el chat recibe el texto de la bitácora y la conversación anterior', async () => {
  process.env.OLLAMA_URL = 'http://localhost:11434'
  const f = ollamaResponde({ fueraDeTema: false, respuesta: 'El 8 de octubre de 2026 anotaste gusano cogollero en el maíz.' })
  const r = await pedir(conRegistros)
  expect(((await r.json()) as { local: boolean }).local).toBe(true)
  const texto = JSON.parse(f.mock.calls[0][1].body as string).messages[1].content as string
  expect(texto).toContain('BITÁCORA (notas del productor, de la más reciente a la más antigua):\n- 8 de octubre de 2026 · Plaga · Maíz: Se ve gusano cogollero en la orilla del canal.')
  expect(texto).toContain('CONVERSACIÓN ANTERIOR:\nProductor: ¿En qué gasté más?\nTú: En renta.')
  expect(texto.endsWith('PREGUNTA: ¿Cuándo vi plaga?')).toBe(true)
})

test('si contesta la nube, el texto de la bitácora y la conversación NO salen de la computadora', async () => {
  process.env.OPENROUTER_API_KEY = 'sk-or-prueba'
  const f = openRouterResponde({ choices: [{ finish_reason: 'stop', message: { content: '{"fueraDeTema":false,"respuesta":"No tengo eso anotado."}' } }] })
  await pedir(conRegistros)
  // messages[0] es el mensaje de sistema (instrucciones); messages[1] es lo que el usuario manda.
  const enviado = JSON.stringify(JSON.parse(f.mock.calls[0][1].body as string).messages[1])
  expect(enviado).toContain('Gasto en Diésel')
  expect(enviado).not.toMatch(/gusano cogollero|BITÁCORA|CONVERSACIÓN|En renta/)
})

test('Ollama: con OLLAMA_TOKEN manda la contraseña del túnel; si el túnel la rechaza, avisa claro', async () => {
  process.env.OLLAMA_URL = 'https://algo.ngrok-free.dev'
  process.env.OLLAMA_TOKEN = 'secreto-largo'
  const f = ollamaResponde({ fueraDeTema: true, respuesta: '' })
  await pedir(chat)
  expect(f.mock.calls[0][0]).toBe('https://algo.ngrok-free.dev/api/chat')
  expect((f.mock.calls[0][1].headers as Record<string, string>).Authorization).toBe('Bearer secreto-largo')
  ollamaResponde({}, 401)
  const r = await pedir(chat)
  expect(r.status).toBe(502)
  expect(((await r.json()) as { error: string }).error).toContain('rechazó la contraseña')
})

test('Ollama: solo quien entró puede usarla', async () => {
  process.env.OLLAMA_URL = 'http://localhost:11434'
  const f = ollamaResponde({})
  expect((await pedir(chat, false)).status).toBe(401)
  expect(f).not.toHaveBeenCalled()
})

test('Ollama: la foto va a su modelo de visión, en base64 sin prefijo', async () => {
  process.env.OLLAMA_URL = 'http://localhost:11434'
  process.env.OLLAMA_MODELO_VISION = 'gemma3:4b'
  const f = ollamaResponde(gasto)
  const r = await pedir({ tarea: 'gasto', entrada: { imagen: 'AAAA', cultivos: ['Maíz'], hoy: '2026-10-09' } })
  expect(await r.json()).toEqual({ respuesta: gasto, local: true })
  const body = JSON.parse(f.mock.calls[0][1].body as string)
  expect(body.model).toBe('gemma3:4b')
  expect(body.messages[1].images).toEqual(['AAAA'])
})

test('Ollama: sin foto usa OLLAMA_MODELO', async () => {
  process.env.OLLAMA_URL = 'http://localhost:11434'
  process.env.OLLAMA_MODELO = 'llama3.1:8b'
  const f = ollamaResponde({ fueraDeTema: true, respuesta: '' })
  await pedir(chat)
  expect(JSON.parse(f.mock.calls[0][1].body as string).model).toBe('llama3.1:8b')
})

test('Ollama: si el modelo no entiende "think", se repite la llamada sin él', async () => {
  process.env.OLLAMA_URL = 'http://localhost:11434'
  const respuestas = [
    new Response(JSON.stringify({ error: '"llama3.1:8b" does not support thinking' }), { status: 400 }),
    new Response(JSON.stringify({ message: { content: '{"fueraDeTema":true,"respuesta":""}' } })),
  ]
  const f = vi.fn(async (_url: string, _init: RequestInit) => respuestas.shift()!)
  vi.stubGlobal('fetch', f)
  const r = await pedir(chat)
  expect(await r.json()).toEqual({ respuesta: { fueraDeTema: true, respuesta: '' }, local: true })
  expect(JSON.parse(f.mock.calls[1][1].body as string)).not.toHaveProperty('think')
})

test('Ollama: avisa en español si no está prendido, si falta el modelo o si tarda', async () => {
  process.env.OLLAMA_URL = 'http://localhost:11434'
  vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('fetch failed') }))
  let r = await pedir(chat)
  expect(r.status).toBe(502)
  expect(((await r.json()) as { error: string }).error).toContain('¿Está prendido Ollama?')

  ollamaResponde({ error: "model 'qwen3:8b' not found" }, 404)
  r = await pedir(chat)
  expect(((await r.json()) as { error: string }).error).toContain('ollama pull qwen3:8b')

  vi.stubGlobal('fetch', vi.fn(async () => { throw new DOMException('timeout', 'TimeoutError') }))
  r = await pedir(chat)
  expect(((await r.json()) as { error: string }).error).toContain('tardó demasiado')
})

test('Ollama: si falla, los datos NO se mandan a la nube a menos que se pida el respaldo', async () => {
  process.env.OLLAMA_URL = 'http://localhost:11434'
  process.env.OPENROUTER_API_KEY = 'sk-or-prueba'
  const f = vi.fn(async (url: string) => {
    if (url.startsWith('http://localhost')) throw new TypeError('fetch failed')
    return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: '{"fueraDeTema":true,"respuesta":""}' } }] }))
  })
  vi.stubGlobal('fetch', f)
  expect((await pedir(chat)).status).toBe(502)
  expect(f.mock.calls.every((c) => String(c[0]).startsWith('http://localhost'))).toBe(true)

  process.env.OLLAMA_RESPALDO = '1'
  const r = await pedir(chat)
  expect(await r.json()).toEqual({ respuesta: { fueraDeTema: true, respuesta: '' } }) // sin "local": contestó la nube
  expect(f.mock.calls.some((c) => String(c[0]).startsWith('https://openrouter.ai'))).toBe(true)
})

// --- IA externa con clave (API compatible con OpenAI)
const completion = (contenido: object) => ({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(contenido) } }] })
const configurarApi = () => {
  process.env.IA_API_KEY = 'sk-prueba'
  process.env.IA_MODELO = 'modelo-prueba'
}
const cuerpoDe = (f: { mock: { calls: unknown[][] } }, n = 0) => JSON.parse((f.mock.calls[n][1] as RequestInit).body as string)

test('IA externa: con IA_API_KEY e IA_MODELO manda el esquema y regresa el JSON, sin marcarlo como local', async () => {
  configurarApi()
  const f = openRouterResponde(completion({ fueraDeTema: false, respuesta: 'Llevas $75,000 de diésel.' }))
  const r = await pedir(chat)
  expect(await r.json()).toEqual({ respuesta: { fueraDeTema: false, respuesta: 'Llevas $75,000 de diésel.' } })
  const [url, init] = f.mock.calls[0]
  expect(url).toBe('https://api.openai.com/v1/chat/completions')
  expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sk-prueba')
  const body = cuerpoDe(f)
  expect(body.model).toBe('modelo-prueba')
  expect(body.response_format).toMatchObject({ type: 'json_schema', json_schema: { name: 'chat', strict: true } })
  // Algunos modelos nuevos rechazan estos parámetros, así que no se mandan.
  expect(body).not.toHaveProperty('max_tokens')
  expect(body).not.toHaveProperty('temperature')
})

test('IA externa: IA_API_URL cambia de proveedor (Gemini, Groq, etc.) y la foto va al modelo de visión', async () => {
  configurarApi()
  process.env.IA_API_URL = 'https://otro.proveedor.com/v1/'
  process.env.IA_MODELO_VISION = 'modelo-vision'
  const f = openRouterResponde(completion(gasto))
  await pedir({ tarea: 'gasto', entrada: { imagen: 'AAAA', cultivos: ['Maíz'], hoy: '2026-10-09' } })
  expect(f.mock.calls[0][0]).toBe('https://otro.proveedor.com/v1/chat/completions')
  expect(cuerpoDe(f).model).toBe('modelo-vision')
  expect(cuerpoDe(f).messages[1].content[0]).toEqual({ type: 'image_url', image_url: { url: 'data:image/jpeg;base64,AAAA' } })
})

test('IA externa: si el proveedor rechaza el esquema estricto, prueba con json_object y luego sin formato', async () => {
  configurarApi()
  const respuestas = [
    new Response(JSON.stringify({ error: { message: 'response_format json_schema is not supported' } }), { status: 400 }),
    new Response(JSON.stringify({ error: { message: 'json_object is not supported' } }), { status: 400 }),
    new Response(JSON.stringify(completion({ fueraDeTema: true, respuesta: '' }))),
  ]
  const f = vi.fn(async (_url: string, _init: RequestInit) => respuestas.shift()!)
  vi.stubGlobal('fetch', f)
  const r = await pedir(chat)
  expect(await r.json()).toEqual({ respuesta: { fueraDeTema: true, respuesta: '' } })
  expect(cuerpoDe(f, 1).response_format).toEqual({ type: 'json_object' })
  expect(cuerpoDe(f, 2)).not.toHaveProperty('response_format')
})

test('IA externa: avisa en español si falta el modelo, si la clave es mala, si no hay saldo o si no existe el modelo', async () => {
  process.env.IA_API_KEY = 'sk-prueba'
  openRouterResponde({})
  const mensaje = async () => ((await (await pedir(chat)).json()) as { error: string }).error
  expect(await mensaje()).toContain('Falta IA_MODELO')
  process.env.IA_MODELO = 'modelo-prueba'
  openRouterResponde({ error: { message: 'Incorrect API key' } }, 401)
  expect(await mensaje()).toContain('Revisa IA_API_KEY')
  openRouterResponde({ error: { message: 'quota' } }, 429)
  expect(await mensaje()).toContain('saldo')
  openRouterResponde({ error: { message: 'model not found' } }, 404)
  expect(await mensaje()).toContain('no encontró el modelo modelo-prueba')
  openRouterResponde({ error: { message: 'boom' } }, 500)
  expect(await mensaje()).toContain('(500) boom')
  expect(JSON.stringify(await mensaje())).not.toContain('sk-prueba')
})

test('IA externa: de la bitácora y la conversación no sale nada, salvo con IA_REGISTROS_EN_NUBE=1', async () => {
  configurarApi()
  const f = openRouterResponde(completion({ fueraDeTema: false, respuesta: 'No tengo eso anotado.' }))
  await pedir(conRegistros)
  const sinRegistros = JSON.stringify(cuerpoDe(f).messages[1])
  expect(sinRegistros).toContain('Gasto en Diésel')
  expect(sinRegistros).not.toMatch(/gusano cogollero|BITÁCORA|CONVERSACIÓN|En renta/)

  process.env.IA_REGISTROS_EN_NUBE = '1'
  const g = openRouterResponde(completion({ fueraDeTema: false, respuesta: 'El 8 de octubre de 2026 anotaste gusano cogollero.' }))
  await pedir(conRegistros)
  const texto = JSON.stringify(cuerpoDe(g).messages[1])
  expect(texto).toContain('gusano cogollero en la orilla del canal')
  expect(texto).toContain('CONVERSACIÓN ANTERIOR')
})

test('prioridad: Ollama, luego la API externa, luego OpenRouter, luego Anthropic', async () => {
  process.env.OPENROUTER_API_KEY = 'sk-or-prueba'
  configurarApi()
  const f = openRouterResponde(completion({ fueraDeTema: true, respuesta: '' }))
  await pedir(chat)
  expect(f.mock.calls[0][0]).toBe('https://api.openai.com/v1/chat/completions') // la API externa gana sobre OpenRouter
  process.env.OLLAMA_URL = 'http://localhost:11434'
  const g = ollamaResponde({ fueraDeTema: true, respuesta: '' })
  await pedir(chat)
  expect(g.mock.calls[0][0]).toBe('http://localhost:11434/api/chat') // y Ollama gana sobre todas
})

test('IA_PROVEEDOR deja cambiar entre local y externa sin borrar variables', async () => {
  process.env.OLLAMA_URL = 'http://localhost:11434'
  configurarApi()
  process.env.IA_PROVEEDOR = 'api'
  const f = openRouterResponde(completion({ fueraDeTema: true, respuesta: '' }))
  await pedir(chat)
  expect(f.mock.calls[0][0]).toBe('https://api.openai.com/v1/chat/completions')
  process.env.IA_PROVEEDOR = 'OLLAMA'
  const g = ollamaResponde({ fueraDeTema: true, respuesta: '' })
  expect(await (await pedir(chat)).json()).toMatchObject({ local: true })
  expect(g.mock.calls[0][0]).toBe('http://localhost:11434/api/chat')
})

test('IA_PROVEEDOR mal escrito o sin sus variables da un aviso claro y no cae a otro proveedor', async () => {
  process.env.OPENROUTER_API_KEY = 'sk-or-prueba'
  const f = openRouterResponde({})
  process.env.IA_PROVEEDOR = 'chatgpt'
  let r = await pedir(chat)
  expect(r.status).toBe(502)
  expect(((await r.json()) as { error: string }).error).toContain('ollama, api, openrouter, anthropic')
  process.env.IA_PROVEEDOR = 'api'
  r = await pedir(chat)
  expect(((await r.json()) as { error: string }).error).toBe('IA_PROVEEDOR=api pero falta IA_API_KEY.')
  expect(f).not.toHaveBeenCalled()
  // Y quien no entró no ve nada de esto.
  expect((await pedir(chat, false)).status).toBe(401)
})

test('con IA_PROVEEDOR puesto pero sin ninguna clave, avisa en vez de mostrar el modo demo', async () => {
  process.env.IA_PROVEEDOR = 'ollama'
  const r = await pedir(chat)
  expect(((await r.json()) as { error: string }).error).toBe('IA_PROVEEDOR=ollama pero falta OLLAMA_URL.')
})

test('Ollama con respaldo: si falla, usa la API externa (y los datos sí salen)', async () => {
  process.env.OLLAMA_URL = 'http://localhost:11434'
  process.env.OLLAMA_RESPALDO = '1'
  configurarApi()
  const f = vi.fn(async (url: string, _init: RequestInit) => {
    if (url.startsWith('http://localhost')) throw new TypeError('fetch failed')
    return new Response(JSON.stringify(completion({ fueraDeTema: true, respuesta: '' })))
  })
  vi.stubGlobal('fetch', f)
  const r = await pedir(chat)
  expect(await r.json()).toEqual({ respuesta: { fueraDeTema: true, respuesta: '' } })
  expect(f.mock.calls.some((c) => c[0] === 'https://api.openai.com/v1/chat/completions')).toBe(true)
})

// --- MedPlant (foto de una planta)
const analisis = {
  esPlanta: true, planta: 'Maíz', estado: 'con_detalles', resumen: 'Hojas con manchas claras.',
  observaciones: ['Manchas claras en las hojas de abajo'],
  posiblesCausas: [{ nombre: 'Falta de nutrientes', certeza: 'baja', porQue: 'Las manchas están repartidas.' }],
  queHacer: ['Revisa el envés de las hojas'], consultarAgronomo: true, mejorarFoto: '',
}
const medplantPeticion = { tarea: 'medplant', entrada: { imagen: 'AAAA', cultivo: 'Maíz', nota: 'Las hojas de abajo se ven amarillas' } }

test('MedPlant con Ollama: usa el modelo de visión y manda la foto, el cultivo y lo que notó el productor', async () => {
  process.env.OLLAMA_URL = 'http://localhost:11434'
  process.env.OLLAMA_MODELO_VISION = 'qwen2.5vl:7b'
  const f = ollamaResponde(analisis)
  const r = await pedir(medplantPeticion)
  expect(await r.json()).toEqual({ respuesta: analisis, local: true })
  const body = JSON.parse(f.mock.calls[0][1].body as string)
  expect(body.model).toBe('qwen2.5vl:7b')
  expect(body.messages[1].images).toEqual(['AAAA'])
  expect(body.messages[1].content).toContain('CULTIVO QUE DICE EL PRODUCTOR: Maíz')
  expect(body.messages[1].content).toContain('LO QUE NOTÓ EL PRODUCTOR: Las hojas de abajo se ven amarillas')
  expect(body.format.required).toEqual(expect.arrayContaining(['esPlanta', 'estado', 'posiblesCausas', 'queHacer', 'consultarAgronomo']))
  // Las reglas de seguridad viajan en las instrucciones.
  expect(body.messages[0].content).toMatch(/No pongas ningún producto, marca ni dosis/)
  expect(body.messages[0].content).toMatch(/Nunca afirmes una enfermedad o plaga como un hecho/)
})

test('MedPlant con IA externa: la foto va como image_url al modelo de visión', async () => {
  configurarApi()
  process.env.IA_MODELO_VISION = 'modelo-vision'
  const f = openRouterResponde(completion(analisis))
  const r = await pedir({ tarea: 'medplant', entrada: { imagen: 'AAAA', cultivo: 'No sé' } })
  expect(await r.json()).toEqual({ respuesta: analisis })
  const body = cuerpoDe(f)
  expect(body.model).toBe('modelo-vision')
  expect(body.messages[1].content[0]).toEqual({ type: 'image_url', image_url: { url: 'data:image/jpeg;base64,AAAA' } })
  expect(body.messages[1].content[1].text).toContain('CULTIVO QUE DICE EL PRODUCTOR: No sé')
  expect(body.messages[1].content[1].text).not.toContain('LO QUE NOTÓ')
})

test('MedPlant: sin sesión no se usa, sin foto o con una foto enorme se rechaza', async () => {
  process.env.OLLAMA_URL = 'http://localhost:11434'
  const f = ollamaResponde(analisis)
  expect((await pedir(medplantPeticion, false)).status).toBe(401)
  expect((await pedir({ tarea: 'medplant', entrada: { cultivo: 'Maíz' } })).status).toBe(400)
  expect((await pedir({ tarea: 'medplant', entrada: { imagen: 'A'.repeat(4_000_001), cultivo: 'Maíz' } })).status).toBe(400)
  expect((await pedir({ tarea: 'medplant', entrada: { imagen: 'AAAA', cultivo: 'Maíz', nota: 'x'.repeat(301) } })).status).toBe(400)
  expect(f).not.toHaveBeenCalled()
})

test('MedPlant en modo demo (sin IA) responde demo', async () => {
  expect(await (await pedir(medplantPeticion)).json()).toEqual({ demo: true })
})

test('extraerJSON tolera texto alrededor', () => {
  expect(extraerJSON('Aquí va: {"a":1} listo')).toEqual({ a: 1 })
})
