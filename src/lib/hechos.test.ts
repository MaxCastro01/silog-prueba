import { expect, test } from 'vitest'
import { datosEjemplo } from './datos'
import { PREGUNTAS_EJEMPLO, fechaLarga, hechos, lineaNota, notasParaChat, respuestaEjemplo } from './hechos'
import { numerosValidos } from './ia'

const d = datosEjemplo()
const h = hechos(d)

test('los hechos traen los números clave y nada personal', () => {
  expect(h).toContain('Gasto en Diésel: $75,000')
  expect(h).toContain('El gasto más grande es Renta de tierra: $300,000')
  expect(h.some((x) => x.includes('Maquila en maíz') && x.includes('20 % más'))).toBe(true)
  expect(h.some((x) => x.includes('$1,800 por hectárea') && x.includes('$450 por hectárea'))).toBe(true)
  expect(h.join(' ')).not.toMatch(/Don Juan|Guasave|687/)
})

test('las respuestas de ejemplo solo usan números de los hechos', () => {
  expect(respuestaEjemplo(PREGUNTAS_EJEMPLO[0], h)).toBe('En Renta de tierra, con $300,000.')
  expect(respuestaEjemplo(PREGUNTAS_EJEMPLO[1], h)).toBe('Llevas $75,000 de diésel.')
  expect(respuestaEjemplo(PREGUNTAS_EJEMPLO[2], h)).toMatch(/^Te conviene rentarla\. Pagaste de maquila \$1,800/)
  for (const q of PREGUNTAS_EJEMPLO) expect(numerosValidos(respuestaEjemplo(q, h), h)).toBe(true)
})

test('los hechos incluyen los registros ya sumados: gasto por mes, últimos gastos y bitácora', () => {
  expect(h).toContain('Has registrado 16 gastos')
  expect(h).toContain('Gasto en septiembre de 2026: $584,000')
  expect(h).toContain('Gasto en octubre de 2026: $254,000')
  // Los tres meses suman el total de la temporada.
  expect(300000 + 584000 + 254000).toBe(1138000)
  expect(h).toContain('Último gasto registrado: Intereses del crédito de avío, $70,000 (Intereses, general), 6 de octubre de 2026')
  expect(h.filter((x) => x.startsWith('Gasto reciente: '))).toHaveLength(7)
  expect(h).toContain('Bitácora: 5 notas registradas')
  expect(h).toContain('Notas de Siembra: 2, la última el 4 de octubre de 2026')
  expect(h).toContain('Última nota de la bitácora: Plaga en Maíz, el 8 de octubre de 2026')
})

test('de la bitácora solo van tipo, cultivo y fecha, nunca el texto de la nota', () => {
  expect(h.join(' ')).not.toMatch(/gusano cogollero en la orilla|presiembra|sembradora de precisión/)
})

test('los hechos caben en lo que acepta la IA y funcionan sin registros', () => {
  expect(h.length).toBeLessThanOrEqual(120)
  expect(Math.max(...h.map((x) => x.length))).toBeLessThanOrEqual(200)
  const vacio = hechos({ ...d, gastos: [], bitacora: [] })
  expect(vacio[0]).toBe('Total gastado en la temporada: $0')
  expect(vacio.some((x) => x.startsWith('Has registrado') || x.startsWith('Bitácora'))).toBe(false)
  // Un concepto larguísimo se recorta, y con muchos gastos no pasa del tope.
  const muchos = hechos({ ...d, gastos: Array.from({ length: 300 }, (_, i) => ({ ...d.gastos[0], id: String(i), concepto: 'x'.repeat(500), fecha: `2026-${String((i % 12) + 1).padStart(2, '0')}-10` })) })
  expect(muchos.length).toBeLessThanOrEqual(120)
  expect(Math.max(...muchos.map((x) => x.length))).toBeLessThanOrEqual(200)
})

test('un solo gasto o una sola nota se escriben en singular', () => {
  const uno = hechos({ ...d, gastos: [d.gastos[0]], bitacora: [d.bitacora[0]] })
  expect(uno).toContain('Has registrado 1 gasto')
  expect(uno).toContain('Bitácora: 1 nota registrada')
})

test('las fechas se leen como las dice la gente', () => {
  expect(fechaLarga('2026-10-06')).toBe('6 de octubre de 2026')
  expect(fechaLarga('2026-09-12T07:40:00')).toBe('12 de septiembre de 2026')
  expect(fechaLarga('rara')).toBe('rara')
})

test('el resumen y el último gasto de ejemplo salen de los hechos', () => {
  expect(respuestaEjemplo(PREGUNTAS_EJEMPLO[3], h)).toBe(
    'Llevas $1,138,000 gastado en la temporada. Lo que más pesa es Renta de tierra, $300,000. Maíz: la tonelada te sale en $4,800, te ofrecen $4,400, vas perdiendo $400 por tonelada. En tu bitácora tienes 5 notas registradas.')
  expect(respuestaEjemplo(PREGUNTAS_EJEMPLO[4], h)).toMatch(/^Tu último gasto fue Intereses del crédito de avío, \$70,000/)
  expect(respuestaEjemplo(PREGUNTAS_EJEMPLO[3], hechos({ ...d, gastos: [] }))).toBe('Todavía no registras gastos.')
})

test('sin gastos no se inventa un costo por tonelada', () => {
  const vacio = hechos({ ...d, gastos: [] })
  expect(vacio.some((x) => x.includes('la tonelada te sale'))).toBe(false)
  expect(vacio.some((x) => x.includes('vas ganando'))).toBe(false)
})

test('el chat recibe las notas de la bitácora con su texto, la más reciente primero y con fecha larga', () => {
  const notas = notasParaChat(d)
  expect(notas).toHaveLength(5)
  expect(notas[0]).toEqual({ fecha: '8 de octubre de 2026', tipo: 'Plaga', cultivo: 'Maíz', texto: 'Se ve gusano cogollero en la orilla del canal.' })
  expect(lineaNota(notas[0])).toBe('8 de octubre de 2026 · Plaga · Maíz: Se ve gusano cogollero en la orilla del canal.')
  // Un número escrito en una nota (90 mil semillas, 10 mm) sí es válido en una respuesta sobre esa nota.
  const permitidos = [...h, ...notas.map(lineaNota)]
  expect(numerosValidos('Sembraste con 90 mil semillas por ha el 3 de octubre de 2026.', permitidos)).toBe(true)
  expect(numerosValidos('Sembraste con 95 mil semillas por ha.', permitidos)).toBe(false)
})

test('solo van las 40 notas más recientes y el texto largo se recorta', () => {
  const muchas = Array.from({ length: 60 }, (_, i) => ({ ...d.bitacora[0], id: String(i), texto: 'x'.repeat(500), creado: `2026-10-${String((i % 28) + 1).padStart(2, '0')}T08:00:00` }))
  const notas = notasParaChat({ ...d, bitacora: muchas })
  expect(notas).toHaveLength(40)
  expect(notas.every((n) => n.texto.length === 300)).toBe(true)
  expect(notasParaChat({ ...d, bitacora: [] })).toEqual([])
})

test('la pregunta de ejemplo sobre la bitácora contesta con los hechos', () => {
  expect(respuestaEjemplo(PREGUNTAS_EJEMPLO[5], h)).toBe('Tienes 5 notas registradas. La última fue Plaga en Maíz, el 8 de octubre de 2026.')
  expect(respuestaEjemplo(PREGUNTAS_EJEMPLO[5], hechos({ ...d, bitacora: [] }))).toBe('Todavía no tienes notas en tu bitácora.')
})
