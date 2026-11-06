import { GENERAL, OFERTAS, TIPOS, ZONA_MAIZ, type Datos, type Gasto, type Productor, type Tipo } from './datos'
import { precioTemporada } from './precio'

export const MIN_PRODUCTORES_ZONA = 5

export const haTotal = (p: Productor) => p.cultivos.reduce((s, c) => s + c.ha, 0)

/** El plan de pago está activo solo si su temporada cuesta y ya la pagó. */
export const tienePlanPago = (p: Productor) => precioTemporada(haTotal(p)) > 0 && p.pagado

const ceros = () => Object.fromEntries(Object.keys(TIPOS).map((t) => [t, 0])) as Record<Tipo, number>

/** Gasto de cada cultivo por tipo. Los gastos generales se reparten por hectárea. */
export function gastoPorCultivo(p: Productor, gastos: Gasto[]) {
  const total = haTotal(p)
  return p.cultivos.map((c) => {
    const porTipo = ceros()
    for (const g of gastos) {
      if (g.cultivo === c.nombre) porTipo[g.tipo] += g.monto
      else if (g.cultivo === GENERAL && total > 0) porTipo[g.tipo] += (g.monto * c.ha) / total
    }
    const suma = Object.values(porTipo).reduce((s, v) => s + v, 0)
    const toneladas = c.ha * c.rendimiento
    const costoTon = toneladas > 0 ? suma / toneladas : 0
    return {
      cultivo: c,
      porTipo,
      total: suma,
      porHa: c.ha > 0 ? suma / c.ha : 0,
      costoTon,
      // Positivo: gana esto por tonelada al precio que le ofrecen.
      margenTon: c.precio - costoTon,
    }
  })
}

export function gastoPorTipo(gastos: Gasto[]) {
  const porTipo = ceros()
  for (const g of gastos) porTipo[g.tipo] += g.monto
  return porTipo
}

/** Compara el gasto por hectárea con el promedio del municipio. null si no hay grupo de 5 o más productores. */
export function compararZona(municipio: string, r: ReturnType<typeof gastoPorCultivo>[number]) {
  const zona = r.cultivo.nombre === 'Maíz' ? ZONA_MAIZ[municipio] : undefined
  if (!zona || zona.productores < MIN_PRODUCTORES_ZONA || r.cultivo.ha <= 0) return null
  const filas = (Object.keys(TIPOS) as Tipo[]).map((tipo) => {
    const tuyo = r.porTipo[tipo] / r.cultivo.ha
    return { tipo, tuyo, zona: zona.porHa[tipo], diferencia: Math.round(((tuyo - zona.porHa[tipo]) / zona.porHa[tipo]) * 100) }
  })
  return { productores: zona.productores, filas }
}

/** Oferta de tienda para el momento en que registra un gasto. Nunca para agroquímicos ni en plan de pago. */
export function ofertaPara(tipo: Tipo, p: Productor) {
  if (tienePlanPago(p) || tipo === 'agroquimicos') return null
  return OFERTAS.find((o) => o.tipo === tipo && o.municipio === p.municipio) ?? null
}

const celda = (v: string | number) => `"${String(v).replaceAll('"', '""')}"`

export function expedienteCSV(d: Datos) {
  const filas: (string | number)[][] = [['Productor', d.productor.nombre], ['Municipio', d.productor.municipio], ['Temporada', d.productor.temporada], []]
  filas.push(['Costos por cultivo', ...Object.values(TIPOS), 'Total', 'Por hectárea', 'Por tonelada'])
  for (const r of gastoPorCultivo(d.productor, d.gastos)) {
    filas.push([`${r.cultivo.nombre} (${r.cultivo.ha} ha)`, ...Object.values(r.porTipo).map(Math.round), Math.round(r.total), Math.round(r.porHa), Math.round(r.costoTon)])
  }
  filas.push([], ['Gastos', 'Fecha', 'Tipo', 'Cultivo', 'Monto'])
  for (const g of d.gastos) filas.push([g.concepto, g.fecha, TIPOS[g.tipo], g.cultivo, g.monto])
  filas.push([], ['Bitácora', 'Fecha y hora', 'Cultivo', 'Nota'])
  for (const n of d.bitacora) filas.push([n.tipo, n.creado, n.cultivo, n.texto])
  return filas.map((f) => f.map(celda).join(',')).join('\n')
}

export const pesos = (n: number) => '$' + Math.round(n).toLocaleString('es-MX')
