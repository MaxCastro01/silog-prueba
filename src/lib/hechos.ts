import { compararZona, gastoPorCultivo, gastoPorTipo, haTotal, pesos } from './calculos'
import { GENERAL, TIPOS, type Datos, type Gasto, type Tipo } from './datos'
import { lineaNota } from './ia-tareas'
import { accionesPosibles } from './palancas'

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const plural = (n: number, uno: string, varios: string) => (n === 1 ? uno : varios)

/** "2026-10-06" → "6 de octubre de 2026". Si la fecha viene rara, se deja como está. */
export function fechaLarga(f: string) {
  const [a, m, d] = f.slice(0, 10).split('-').map(Number)
  return a && m >= 1 && m <= 12 && d ? `${d} de ${MESES[m - 1]} de ${a}` : f
}
const nombreMes = (ym: string) => {
  const [a, m] = ym.split('-').map(Number)
  return a && m >= 1 && m <= 12 ? `${MESES[m - 1]} de ${a}` : ym
}
// El concepto lo escribe el productor: se recorta para que no ocupe de más.
const detalleGasto = (g: Gasto) =>
  `${g.concepto.slice(0, 40)}, ${pesos(g.monto)} (${TIPOS[g.tipo]}, ${g.cultivo === GENERAL ? 'general' : g.cultivo}), ${fechaLarga(g.fecha)}`

/**
 * Lo que el productor ha capturado, ya sumado por el código. El modelo solo lee estas líneas:
 * no suma ni hace cuentas. De la bitácora solo van tipo, cultivo y fecha, nunca el texto de la nota.
 */
function hechosRegistros(d: Datos) {
  const lista: string[] = []
  if (d.gastos.length) {
    lista.push(`Has registrado ${d.gastos.length} ${plural(d.gastos.length, 'gasto', 'gastos')}`)
    const porMes = new Map<string, number>()
    for (const g of d.gastos) porMes.set(g.fecha.slice(0, 7), (porMes.get(g.fecha.slice(0, 7)) ?? 0) + g.monto)
    for (const [m, v] of [...porMes].sort(([a], [b]) => a.localeCompare(b)).slice(-12)) lista.push(`Gasto en ${nombreMes(m)}: ${pesos(v)}`)
    const mayor = d.gastos.reduce((a, b) => (b.monto > a.monto ? b : a))
    lista.push(`El gasto individual más grande: ${detalleGasto(mayor)}`)
    // Más reciente primero; si dos son del mismo día, queda primero el que se capturó después (así llegan del servidor).
    const recientes = [...d.gastos].sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 8)
    recientes.forEach((g, i) => lista.push(`${i === 0 ? 'Último gasto registrado' : 'Gasto reciente'}: ${detalleGasto(g)}`))
  }
  if (d.bitacora.length) {
    lista.push(`Bitácora: ${d.bitacora.length} ${plural(d.bitacora.length, 'nota registrada', 'notas registradas')}`)
    const porTipo = new Map<string, { n: number; ultima: string }>()
    for (const n of d.bitacora) {
      const t = porTipo.get(n.tipo) ?? { n: 0, ultima: '' }
      porTipo.set(n.tipo, { n: t.n + 1, ultima: n.creado > t.ultima ? n.creado : t.ultima })
    }
    for (const [tipo, t] of porTipo) lista.push(`Notas de ${tipo}: ${t.n}, la última el ${fechaLarga(t.ultima)}`)
    const ultima = d.bitacora.reduce((a, b) => (b.creado > a.creado ? b : a))
    lista.push(`Última nota de la bitácora: ${ultima.tipo}${ultima.cultivo === GENERAL ? '' : ` en ${ultima.cultivo}`}, el ${fechaLarga(ultima.creado)}`)
  }
  return lista
}

/** Los números que el chat puede usar, ya calculados. Sin nombre ni municipio. */
export function hechos(d: Datos) {
  const p = d.productor
  const porTipo = (Object.entries(gastoPorTipo(d.gastos)) as [Tipo, number][]).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])
  const lista = [
    `Total gastado en la temporada: ${pesos(d.gastos.reduce((s, g) => s + g.monto, 0))}`,
    `Temporada ${p.temporada}: ${haTotal(p)} hectáreas en ${p.cultivos.length} ${plural(p.cultivos.length, 'cultivo', 'cultivos')}`,
  ]
  if (porTipo[0]) lista.push(`El gasto más grande es ${TIPOS[porTipo[0][0]]}: ${pesos(porTipo[0][1])}`)
  for (const [t, v] of porTipo) lista.push(`Gasto en ${TIPOS[t]}: ${pesos(v)}`)

  for (const r of gastoPorCultivo(p, d.gastos)) {
    const c = r.cultivo
    lista.push(`${c.nombre} (${c.ha} ha): gasto total ${pesos(r.total)}, por hectárea ${pesos(r.porHa)}`)
    // Sin gastos en este cultivo no hay costo por tonelada: decir "vas ganando" con $0 gastados engaña.
    if (c.rendimiento > 0 && r.total > 0) {
      lista.push(`${c.nombre}: la tonelada te sale en ${pesos(r.costoTon)}, te ofrecen ${pesos(c.precio)}, ${r.margenTon >= 0 ? 'vas ganando' : 'vas perdiendo'} ${pesos(Math.abs(r.margenTon))} por tonelada`)
    }
    for (const f of compararZona(p.municipio, r)?.filas ?? []) {
      if (f.diferencia > 5) lista.push(`${TIPOS[f.tipo]} en ${c.nombre.toLowerCase()}: pagas ${pesos(f.tuyo)} por hectárea y el promedio de tu zona es ${pesos(f.zona)} (${f.diferencia} % más)`)
    }
    const s = accionesPosibles(r, p.municipio, d.gastos, d.anuncios).find((a) => a.id === 'rentar-sembradora')
    const renta = d.anuncios.find((a) => a.id === s?.anuncio)?.precio
    if (s && renta !== undefined) {
      lista.push(`Siembra de ${c.nombre.toLowerCase()}: pagaste de maquila ${pesos(s.ahorroMax / c.ha + renta)} por hectárea; rentar la sembradora de un vecino cuesta ${pesos(renta)} por hectárea, más tu diésel y tu operador. Ahorro posible: de ${pesos(s.ahorroMin)} a ${pesos(s.ahorroMax)}`)
    }
  }
  // 120 es el máximo que acepta api/ia (ENTRADAS.chat); los registros van al final y ya vienen acotados.
  return [...lista, ...hechosRegistros(d)].slice(0, 120)
}

/**
 * Las notas más recientes de la bitácora, con el texto que escribió el productor.
 * Solo las lee la IA local; el servidor las descarta si contesta la nube.
 */
export function notasParaChat(d: Datos) {
  return [...d.bitacora]
    .sort((a, b) => b.creado.localeCompare(a.creado))
    .slice(0, 40)
    .map((n) => ({ fecha: fechaLarga(n.creado), tipo: n.tipo, cultivo: n.cultivo, texto: n.texto.slice(0, 300) }))
}
export { lineaNota }

export const PREGUNTAS_EJEMPLO = [
  '¿En qué gasté más?',
  '¿Cuánto llevo de diésel?',
  '¿Me conviene rentar la sembradora o pagar maquila?',
  'Hazme un resumen de mi temporada',
  '¿Cuál fue mi último gasto?',
  '¿Qué he anotado en mi bitácora?',
]

/** Respuestas sin IA para las preguntas de ejemplo, armadas con los mismos hechos. */
export function respuestaEjemplo(pregunta: string, h: string[]) {
  const buscar = (inicio: string) => h.find((x) => x.startsWith(inicio))
  const sin = (x: string, inicio: string) => x.slice(inicio.length)
  if (pregunta === PREGUNTAS_EJEMPLO[0]) {
    const x = buscar('El gasto más grande es ')
    return x ? `En ${sin(x, 'El gasto más grande es ').replace(':', ', con')}.` : 'Todavía no registras gastos.'
  }
  if (pregunta === PREGUNTAS_EJEMPLO[1]) {
    const x = buscar('Gasto en Diésel: ')
    return x ? `Llevas ${sin(x, 'Gasto en Diésel: ')} de diésel.` : 'No has registrado diésel.'
  }
  if (pregunta === PREGUNTAS_EJEMPLO[2]) {
    const x = h.find((y) => y.startsWith('Siembra de '))
    return x ? `Te conviene rentarla. ${x.slice(x.indexOf(':') + 2).replace('pagaste', 'Pagaste')}.` : 'No hay una sembradora en renta por hectárea en tu municipio para comparar.'
  }
  if (pregunta === PREGUNTAS_EJEMPLO[3]) {
    const total = buscar('Total gastado en la temporada: ')
    if (!total || !buscar('Has registrado ')) return 'Todavía no registras gastos.'
    const partes = [`Llevas ${sin(total, 'Total gastado en la temporada: ')} gastado en la temporada.`]
    const mayor = buscar('El gasto más grande es ')
    if (mayor) partes.push(`Lo que más pesa es ${sin(mayor, 'El gasto más grande es ').replace(':', ',')}.`)
    const ton = h.find((x) => x.includes(': la tonelada te sale en '))
    if (ton) partes.push(`${ton}.`)
    const notas = buscar('Bitácora: ')
    if (notas) partes.push(`En tu bitácora tienes ${sin(notas, 'Bitácora: ')}.`)
    return partes.join(' ')
  }
  if (pregunta === PREGUNTAS_EJEMPLO[4]) {
    const x = buscar('Último gasto registrado: ')
    return x ? `Tu último gasto fue ${sin(x, 'Último gasto registrado: ')}.` : 'Todavía no registras gastos.'
  }
  if (pregunta === PREGUNTAS_EJEMPLO[5]) {
    const notas = buscar('Bitácora: ')
    const ultima = buscar('Última nota de la bitácora: ')
    if (!notas) return 'Todavía no tienes notas en tu bitácora.'
    return `Tienes ${sin(notas, 'Bitácora: ')}.${ultima ? ` La última fue ${sin(ultima, 'Última nota de la bitácora: ')}.` : ''}`
  }
  return 'En modo demo solo contesto las preguntas de ejemplo de arriba. Con la IA local puedes preguntar con tus propias palabras.'
}
