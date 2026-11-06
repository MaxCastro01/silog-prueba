import { readFileSync, readdirSync } from 'node:fs'
import { expect, test } from 'vitest'

// npm run dev solo pasa al servidor las variables de .env.local que empiezan con los prefijos de vite.config.ts.
// Si una variable nueva no empieza con uno de ellos, funciona en las pruebas y en Vercel pero NO en tu computadora
// (la app cae en modo demo sin avisar). Esta prueba lo detecta.
const NO_DEL_ARCHIVO = ['VERCEL', 'NODE_ENV', 'DATOS_DIR'] // las pone Vercel/Node, o no se configuran en .env.local

test('toda variable de entorno que usa el servidor se carga con npm run dev', () => {
  const config = readFileSync('vite.config.ts', 'utf8')
  const prefijos = [...(config.match(/loadEnv\([\s\S]*?\[([^\]]+)\]/)?.[1] ?? '').matchAll(/'([A-Z_]+)'/g)].map((m) => m[1])
  expect(prefijos.length).toBeGreaterThan(0)

  const usadas = new Set<string>()
  for (const dir of ['api', 'server']) {
    for (const archivo of readdirSync(dir).filter((a) => a.endsWith('.ts'))) {
      for (const m of readFileSync(`${dir}/${archivo}`, 'utf8').matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)) usadas.add(m[1])
    }
  }
  const sinCargar = [...usadas].filter((v) => !NO_DEL_ARCHIVO.includes(v) && !prefijos.some((p) => v.startsWith(p)))
  expect(sinCargar).toEqual([])
})

test('.env.example solo documenta variables que la app realmente lee', () => {
  const usadas = new Set<string>()
  for (const dir of ['api', 'server']) {
    for (const archivo of readdirSync(dir).filter((a) => a.endsWith('.ts'))) {
      for (const m of readFileSync(`${dir}/${archivo}`, 'utf8').matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)) usadas.add(m[1])
    }
  }
  const ejemplo = [...readFileSync('.env.example', 'utf8').matchAll(/^([A-Z][A-Z0-9_]*)=/gm)].map((m) => m[1])
  expect(ejemplo.filter((v) => !usadas.has(v))).toEqual([])
})
