import { afterEach, expect, test, vi } from 'vitest'
import { gastoPorCultivo } from './calculos'
import { datosEjemplo } from './datos'
import { ErrorIA, limpiarGasto, limpiarMedplant, medplantEjemplo, numerosValidos, pedirIA, planEjemplo, validarPlan } from './ia'
import { SALIDAS } from './ia-tareas'
import { ESQUEMAS } from './ia-tareas'
import { accionesPosibles } from './palancas'

const d = datosEjemplo()
const acciones = accionesPosibles(gastoPorCultivo(d.productor, d.gastos)[0], 'Guasave', d.gastos, d.anuncios)

test('el plan de ejemplo pasa la validación', () => {
  expect(validarPlan(planEjemplo(acciones), acciones).acciones.length).toBe(4)
})

test('se rechaza un plan con acciones inventadas, repetidas o con cifras', () => {
  const bueno = planEjemplo(acciones)
  const con = (cambio: object) => () => validarPlan({ ...bueno, ...cambio }, acciones)
  expect(con({ acciones: [...bueno.acciones.slice(0, 2), { id: 'comprar-dron', texto: 'Compra un dron' }] })).toThrow(ErrorIA)
  expect(con({ acciones: [bueno.acciones[0], bueno.acciones[0], bueno.acciones[1]] })).toThrow(ErrorIA)
  expect(con({ resumen: 'Te ahorras 30 mil pesos' })).toThrow(ErrorIA)
})

test('el chat solo puede usar números de los hechos', () => {
  const hechos = ['Gasto en Diésel: $75,000', 'Maquila: pagas 20 % más que tu zona']
  expect(numerosValidos('Llevas $75,000 de diésel.', hechos)).toBe(true)
  expect(numerosValidos('Pagas 20 % más de maquila.', hechos)).toBe(true)
  expect(numerosValidos('Llevas $80,000 de diésel.', hechos)).toBe(false)
})

test('los esquemas JSON no traen $schema y cierran propiedades', () => {
  expect(ESQUEMAS.plan).not.toHaveProperty('$schema')
  expect(ESQUEMAS.gasto).toMatchObject({ additionalProperties: false, required: ['concepto', 'monto', 'tipo', 'fecha', 'cultivo'] })
})

test('lo leído de una nota se limpia antes de llenar el formulario', () => {
  expect(limpiarGasto({ concepto: 'Diésel', monto: 800, tipo: 'diesel', fecha: '2026-10-08', cultivo: 'Maíz' }, ['Maíz'], '2026-10-09'))
    .toEqual({ concepto: 'Diésel', monto: '800', tipo: 'diesel', fecha: '2026-10-08', cultivo: 'Maíz' })
  // Monto negativo, fecha futura o rara y cultivo que no tiene: se corrigen.
  expect(limpiarGasto({ concepto: 'x', monto: -5, tipo: 'diesel', fecha: '2027-01-01', cultivo: 'Sorgo' }, ['Maíz'], '2026-10-09'))
    .toMatchObject({ monto: '', fecha: '2026-10-09', cultivo: 'General' })
})

// --- pedirIA: reintento y bandera de IA local (el fetch del navegador se simula)
afterEach(() => vi.unstubAllGlobals())
const respuestas = (...lista: object[]) => {
  const f = vi.fn(async () => Response.json(lista.shift() ?? {}))
  vi.stubGlobal('fetch', f)
  return f
}
const ENTRADA = { pregunta: 'hola', hechos: [] }
const ejemploChat = () => ({ fueraDeTema: false, respuesta: 'ejemplo' })

test('pedirIA marca cuando contestó la IA local', async () => {
  respuestas({ respuesta: { fueraDeTema: false, respuesta: 'ok' }, local: true })
  expect(await pedirIA('chat', ENTRADA, ejemploChat)).toEqual({ datos: { fueraDeTema: false, respuesta: 'ok' }, ejemplo: false, local: true })
  respuestas({ respuesta: { fueraDeTema: false, respuesta: 'ok' } })
  expect((await pedirIA('chat', ENTRADA, ejemploChat)).local).toBe(false)
})

test('pedirIA sin proveedor usa el ejemplo', async () => {
  respuestas({ demo: true })
  expect(await pedirIA('chat', ENTRADA, ejemploChat)).toEqual({ datos: ejemploChat(), ejemplo: true, local: false })
})

test('pedirIA pregunta otra vez si la respuesta no cumple el formato', async () => {
  const f = respuestas({ respuesta: { cosa: 1 } }, { respuesta: { fueraDeTema: false, respuesta: 'ahora sí' } })
  expect((await pedirIA('chat', ENTRADA, ejemploChat)).datos.respuesta).toBe('ahora sí')
  expect(f).toHaveBeenCalledTimes(2)
  const g = respuestas({ respuesta: { cosa: 1 } }, { respuesta: { cosa: 2 } }, { respuesta: { fueraDeTema: false, respuesta: 'tarde' } })
  await expect(pedirIA('chat', ENTRADA, ejemploChat)).rejects.toThrow(ErrorIA)
  expect(g).toHaveBeenCalledTimes(2) // solo dos intentos
})

test('pedirIA reintenta si no pasa la regla extra y, al agotar los intentos, deja decidir a la pantalla', async () => {
  const hechos = ['Gasto en Diésel: $75,000']
  const buena = (r: { respuesta: string }) => numerosValidos(r.respuesta, hechos)
  const f = respuestas({ respuesta: { fueraDeTema: false, respuesta: 'Llevas $80,000' } }, { respuesta: { fueraDeTema: false, respuesta: 'Llevas $75,000' } })
  expect((await pedirIA('chat', ENTRADA, ejemploChat, buena)).datos.respuesta).toBe('Llevas $75,000')
  expect(f).toHaveBeenCalledTimes(2)
  respuestas({ respuesta: { fueraDeTema: false, respuesta: 'Llevas $80,000' } }, { respuesta: { fueraDeTema: false, respuesta: 'Llevas $90,000' } })
  expect((await pedirIA('chat', ENTRADA, ejemploChat, buena)).datos.respuesta).toBe('Llevas $90,000') // la pantalla la rechaza con su propio aviso
})

test('pedirIA no reintenta cuando el servidor da un error', async () => {
  const f = vi.fn(async () => Response.json({ error: 'A Ollama le falta el modelo' }, { status: 502 }))
  vi.stubGlobal('fetch', f)
  await expect(pedirIA('chat', ENTRADA, ejemploChat)).rejects.toThrow('le falta el modelo')
  expect(f).toHaveBeenCalledTimes(1)
})

// --- MedPlant
const medplant = (extra: Partial<Parameters<typeof limpiarMedplant>[0]> = {}) => ({
  esPlanta: true,
  planta: 'Maíz',
  estado: 'con_detalles' as const,
  resumen: 'Hojas con manchas claras.',
  observaciones: ['Manchas claras en las hojas de abajo'],
  posiblesCausas: [{ nombre: 'Falta de nutrientes', certeza: 'baja' as const, porQue: 'Las manchas están repartidas.' }],
  queHacer: ['Revisa el envés de las hojas'],
  consultarAgronomo: false,
  mejorarFoto: '',
  ...extra,
})

test('MedPlant: el ejemplo de demo cumple el formato y pasa la limpieza sin perder nada', () => {
  const e = medplantEjemplo('Maíz')
  expect(SALIDAS.medplant.safeParse(e).success).toBe(true)
  const l = limpiarMedplant(e)
  expect(l.estado).toBe('con_detalles')
  expect(l.observaciones).toHaveLength(2)
  expect(l.queHacer).toHaveLength(3)
  expect(medplantEjemplo('No sé').planta).toBe('No se distingue')
})

test('MedPlant: nunca llegan a la pantalla agroquímicos ni dosis, aunque el modelo los escriba', () => {
  const l = limpiarMedplant(medplant({
    queHacer: ['Aplica un fungicida cada 8 días', 'Mezcla 2 ml por litro de agua', 'Usa la dosis de la etiqueta', 'Aplica 3 kg por hectárea', 'Revisa el envés de las hojas', 'Anota desde cuándo lo ves'],
    posiblesCausas: [
      { nombre: 'Hongo', certeza: 'media', porQue: 'Se controla con un insecticida' },
      { nombre: 'Falta de agua', certeza: 'baja', porQue: 'Las hojas se ven caídas.' },
    ],
    resumen: 'Conviene aplicar un herbicida ya.',
    mejorarFoto: 'Pon 10 ml de agua en la hoja',
  }))
  expect(l.queHacer).toEqual(['Revisa el envés de las hojas', 'Anota desde cuándo lo ves'])
  expect(l.posiblesCausas.map((c) => c.nombre)).toEqual(['Falta de agua'])
  expect(l.resumen).toBe('Revisa lo que se ve en la foto y consulta a un agrónomo.')
  expect(l.mejorarFoto).toBe('')
  // Lo normal del campo no se confunde con una dosis.
  const ok = limpiarMedplant(medplant({ queHacer: ['Revisa 10 plantas del surco', 'Toma la foto a 30 cm de la hoja'] }))
  expect(ok.queHacer).toHaveLength(2)
})

test('MedPlant: sin nada que se vea en la foto no afirma si está sana o con problema', () => {
  expect(limpiarMedplant(medplant({ observaciones: [], estado: 'sana' })).estado).toBe('no_se_sabe')
  expect(limpiarMedplant(medplant({ observaciones: ['   '], estado: 'con_problema' })).estado).toBe('no_se_sabe')
})

test('MedPlant: si no es una planta, vacía las listas y no da causas ni pasos', () => {
  const l = limpiarMedplant(medplant({ esPlanta: false, estado: 'con_problema', resumen: '' }))
  expect(l).toMatchObject({ esPlanta: false, estado: 'no_se_sabe', observaciones: [], posiblesCausas: [], queHacer: [], resumen: 'No veo una planta en la foto.' })
})

test('MedPlant: un problema siempre se manda con el agrónomo, y los textos largos se recortan', () => {
  expect(limpiarMedplant(medplant({ estado: 'con_problema', consultarAgronomo: false })).consultarAgronomo).toBe(true)
  expect(limpiarMedplant(medplant({ estado: 'sana', consultarAgronomo: false })).consultarAgronomo).toBe(false)
  const largo = limpiarMedplant(medplant({
    resumen: 'a'.repeat(900),
    observaciones: Array.from({ length: 12 }, (_, i) => `Observación ${i} ${'x'.repeat(400)}`),
    queHacer: Array.from({ length: 9 }, (_, i) => `Paso ${i}`),
    posiblesCausas: Array.from({ length: 7 }, (_, i) => ({ nombre: `Causa ${i}`, certeza: 'baja' as const, porQue: 'y'.repeat(500) })),
  }))
  expect(largo.resumen.length).toBe(300)
  expect(largo.observaciones).toHaveLength(5)
  expect(largo.observaciones.every((o) => o.length <= 160)).toBe(true)
  expect(largo.queHacer).toHaveLength(4)
  expect(largo.posiblesCausas).toHaveLength(3)
})

test('MedPlant: pedirIA reintenta una vez si la respuesta viene sin observaciones', async () => {
  const vacia = { esPlanta: true, planta: 'Maíz', estado: 'sana', resumen: 'ok', observaciones: [], posiblesCausas: [], queHacer: [], consultarAgronomo: false, mejorarFoto: '' }
  const f = respuestas({ respuesta: vacia }, { respuesta: { ...vacia, observaciones: ['Hojas verdes y firmes'] } })
  const r = await pedirIA('medplant', { imagen: 'AAAA', cultivo: 'Maíz' }, () => medplantEjemplo('Maíz'), (x) => !x.esPlanta || x.observaciones.length > 0)
  expect(r.datos.observaciones).toEqual(['Hojas verdes y firmes'])
  expect(f).toHaveBeenCalledTimes(2)
})
