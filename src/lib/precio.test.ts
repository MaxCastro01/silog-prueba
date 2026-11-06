import { expect, test } from 'vitest'
import { precioTemporada } from './precio'

test.each([
  [0, 0],
  [10, 0],
  [11, 500],
  [25, 1000],
  [50, 2000],
  [100, 4000],
  [101, 4000],
])('%i ha cuesta %i', (ha, precio) => {
  expect(precioTemporada(ha)).toBe(precio)
})
