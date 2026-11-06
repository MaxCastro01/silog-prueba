import { compararZona, type gastoPorCultivo } from './calculos'
import { TIPOS, type Anuncio, type Gasto, type Tipo } from './datos'

type Fila = ReturnType<typeof gastoPorCultivo>[number]

// DATOS DE EJEMPLO: cambia estos rangos por referencias reales antes de usarlos con productores.
export const REFERENCIAS = {
  apoyoPorTonelada: { min: 0, max: 750 },
  ventaEnGrupo: { min: 100, max: 300 }, // pesos más por tonelada
}

/** Las tres formas exactas de quedar en cero: gastar menos, sacar más toneladas o vender más caro. */
export function palancas(porHa: number, rendimiento: number, precio: number) {
  const bajarHa = porHa - precio * rendimiento
  return {
    bajarHa, // positivo: lo que falta bajar por hectárea
    bajarPct: porHa > 0 ? (bajarHa / porHa) * 100 : 0,
    toneladasHa: precio > 0 ? porHa / precio : 0,
    precioMinimo: rendimiento > 0 ? porHa / rendimiento : 0,
  }
}

export type Certeza = 'seguro' | 'probable' | 'depende de ti'
export type Fuente = 'tu registro' | 'promedio de tu zona' | 'referencia FIRA' | 'dato de ejemplo'
export type Accion = {
  id: string
  titulo: string // texto de respaldo si no hay IA
  ahorroMin: number // pesos en todo el cultivo
  ahorroMax: number
  certeza: Certeza
  fuente: Fuente
  tipo?: Tipo // gasto que baja; las que suben el precio no tienen
  anuncio?: string
}

/** Acciones posibles con su ahorro calculado. La IA solo escoge y redacta de esta lista. */
export function accionesPosibles(r: Fila, municipio: string, gastos: Gasto[], anuncios: Anuncio[]): Accion[] {
  const c = r.cultivo
  const toneladas = c.ha * c.rendimiento
  const acciones: Accion[] = []

  // Rentar la sembradora de un vecino en vez de pagar la maquila de siembra.
  const siembra = gastos.filter((g) => g.cultivo === c.nombre && g.tipo === 'maquila' && /siembra/i.test(g.concepto)).reduce((s, g) => s + g.monto, 0)
  const sembradora = anuncios.find((a) => a.modo === 'renta' && a.municipio === municipio && a.unidad === 'por hectárea' && /sembradora/i.test(a.titulo))
  if (siembra > 0 && sembradora && c.ha > 0 && siembra / c.ha > sembradora.precio) {
    const max = (siembra / c.ha - sembradora.precio) * c.ha
    // La mitad baja cubre tu diésel y tu operador.
    acciones.push({ id: 'rentar-sembradora', titulo: 'Renta la sembradora de un vecino', ahorroMin: max / 2, ahorroMax: max, certeza: 'depende de ti', fuente: 'tu registro', tipo: 'maquila', anuncio: sembradora.id })
  }

  // Gastos más de 5 % arriba del promedio de su zona. Agroquímicos no: eso lo decide un agrónomo.
  for (const f of compararZona(municipio, r)?.filas ?? []) {
    if (f.diferencia <= 5 || f.tipo === 'agroquimicos') continue
    const max = (f.tuyo - f.zona) * c.ha
    acciones.push({ id: `zona-${f.tipo}`, titulo: `Baja tu gasto de ${TIPOS[f.tipo].toLowerCase()} al promedio de tu zona`, ahorroMin: max / 2, ahorroMax: max, certeza: 'probable', fuente: 'promedio de tu zona', tipo: f.tipo })
  }

  if (toneladas > 0) {
    const { apoyoPorTonelada: a, ventaEnGrupo: v } = REFERENCIAS
    acciones.push({ id: 'apoyo-tonelada', titulo: 'Revisa si calificas a un apoyo por tonelada', ahorroMin: a.min * toneladas, ahorroMax: a.max * toneladas, certeza: 'depende de ti', fuente: 'dato de ejemplo' })
    acciones.push({ id: 'vender-grupo', titulo: 'Vende en grupo o por contrato', ahorroMin: v.min * toneladas, ahorroMax: v.max * toneladas, certeza: 'probable', fuente: 'dato de ejemplo' })
  }
  return acciones
}

/** Cómo quedaría con las acciones activas. Usa la mitad del rango; si dos bajan el mismo gasto, cuenta solo la mayor. */
export function simular(r: Fila, acciones: Accion[], activas: string[]) {
  const porTipo = new Map<string, number>()
  let precioExtra = 0
  for (const a of acciones) {
    if (!activas.includes(a.id)) continue
    const medio = (a.ahorroMin + a.ahorroMax) / 2
    if (a.tipo) porTipo.set(a.tipo, Math.min(r.porTipo[a.tipo], Math.max(porTipo.get(a.tipo) ?? 0, medio)))
    else precioExtra += medio
  }
  const ahorro = [...porTipo.values()].reduce((s, v) => s + v, 0)
  const toneladas = r.cultivo.ha * r.cultivo.rendimiento
  const costoTon = toneladas > 0 ? (r.total - ahorro) / toneladas : 0
  const precio = r.cultivo.precio + (toneladas > 0 ? precioExtra / toneladas : 0)
  return { costoTon, precio, margenTon: precio - costoTon, ahorro: ahorro + precioExtra }
}
