import { expect, test } from 'vitest'
import { compararZona, expedienteCSV, gastoPorCultivo, ofertaPara } from './calculos'
import { datosEjemplo } from './datos'

const d = datosEjemplo()

test('Don Juan: el maíz sale cerca de 48 mil por ha y va perdiendo; el frijol va ganando', () => {
  const [maiz, frijol] = gastoPorCultivo(d.productor, d.gastos)
  expect(Math.round(maiz.porHa)).toBe(48000)
  expect(Math.round(maiz.costoTon)).toBe(4800)
  expect(maiz.margenTon).toBeLessThan(0)
  expect(frijol.margenTon).toBeGreaterThan(0)
  // Los generales se reparten completos: la suma por cultivo es el total gastado.
  const total = d.gastos.reduce((s, g) => s + g.monto, 0)
  expect(maiz.total + frijol.total).toBeCloseTo(total)
})

test('Don Juan paga 20 % más de maquila que su municipio', () => {
  const [maiz] = gastoPorCultivo(d.productor, d.gastos)
  const fila = compararZona('Guasave', maiz)!.filas.find((f) => f.tipo === 'maquila')!
  expect(fila.diferencia).toBe(20)
})

test('no se muestra la zona con menos de 5 productores ni sin datos', () => {
  const [maiz, frijol] = gastoPorCultivo(d.productor, d.gastos)
  expect(compararZona('Choix', maiz)).toBeNull()
  expect(compararZona('Guasave', frijol)).toBeNull()
  expect(compararZona('Rosario', maiz)).toBeNull()
})

test('ofertas: diésel sí, agroquímicos nunca, plan de pago nunca', () => {
  expect(ofertaPara('diesel', d.productor)?.municipio).toBe('Guasave')
  expect(ofertaPara('agroquimicos', d.productor)).toBeNull()
  expect(ofertaPara('diesel', { ...d.productor, pagado: true })).toBeNull()
})

test('el CSV escapa comillas', () => {
  const csv = expedienteCSV({ ...d, bitacora: [{ id: 'x', tipo: 'Plaga', cultivo: 'Maíz', texto: 'dijo "ojo"', creado: '2026-10-09T10:00:00' }] })
  expect(csv).toContain('"dijo ""ojo"""')
})
