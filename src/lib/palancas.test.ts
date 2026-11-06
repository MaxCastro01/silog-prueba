import { expect, test } from 'vitest'
import { gastoPorCultivo } from './calculos'
import { datosEjemplo } from './datos'
import { accionesPosibles, palancas, simular } from './palancas'

test('palancas del ejemplo: 48,000 $/ha, 10 t/ha, 4,400 $/t', () => {
  const p = palancas(48000, 10, 4400)
  expect(p.bajarHa).toBe(4000)
  expect(p.bajarPct).toBeCloseTo(8.3, 1)
  expect(p.toneladasHa).toBeCloseTo(10.9, 1)
  expect(p.precioMinimo).toBe(4800)
})

const d = datosEjemplo()
const [maiz, frijol] = gastoPorCultivo(d.productor, d.gastos)
const acciones = accionesPosibles(maiz, 'Guasave', d.gastos, d.anuncios)
const id = (x: string) => acciones.find((a) => a.id === x)!

test('acciones de Don Juan salen de sus datos', () => {
  // Siembra: paga 1,800/ha de maquila y la sembradora se renta en 450/ha → hasta 27,000.
  expect(id('rentar-sembradora')).toMatchObject({ ahorroMax: 27000, ahorroMin: 13500, anuncio: 'a1', fuente: 'tu registro' })
  // Maquila 8,400/ha contra 7,000 de la zona en 20 ha → hasta 28,000.
  expect(id('zona-maquila')).toMatchObject({ ahorroMax: 28000, fuente: 'promedio de tu zona' })
  expect(acciones.some((a) => a.id === 'zona-agroquimicos')).toBe(false)
  expect(id('apoyo-tonelada').fuente).toBe('dato de ejemplo')
})

test('sin promedio de zona no hay acciones de zona', () => {
  expect(accionesPosibles(frijol, 'Guasave', d.gastos, d.anuncios).some((a) => a.id.startsWith('zona-'))).toBe(false)
})

test('simulador: rentar sembradora + apoyo pone a Don Juan en verde', () => {
  expect(simular(maiz, acciones, []).margenTon).toBeCloseTo(-400)
  expect(simular(maiz, acciones, ['rentar-sembradora']).margenTon).toBeLessThan(0)
  expect(simular(maiz, acciones, ['rentar-sembradora', 'apoyo-tonelada']).margenTon).toBeGreaterThan(0)
})

test('dos acciones sobre la maquila no se suman dos veces', () => {
  const una = simular(maiz, acciones, ['zona-maquila']).ahorro
  const dos = simular(maiz, acciones, ['zona-maquila', 'rentar-sembradora']).ahorro
  expect(dos).toBe(una) // cuenta solo la mayor: 21,000 contra 20,250
})
