// Todos los precios del plan viven aquí. Cámbialos solo en este objeto.
export const PRECIOS = {
  haGratis: 10, // hasta esta cantidad de hectáreas, gratis
  porHectarea: 40,
  minimo: 500,
  haPrecioFijo: 100, // más de esto paga el precio fijo
  precioFijo: 4000,
}

/** Precio de una temporada (OI o PV) por todas las hectáreas, sin importar cuántos cultivos. */
export function precioTemporada(ha: number): number {
  if (ha <= PRECIOS.haGratis) return 0
  if (ha > PRECIOS.haPrecioFijo) return PRECIOS.precioFijo
  return Math.max(PRECIOS.minimo, PRECIOS.porHectarea * ha)
}
