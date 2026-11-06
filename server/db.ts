// Base de datos: Postgres. En Vercel, la que conectes (Neon, Supabase…) por DATABASE_URL.
// Sin DATABASE_URL, en tu computadora: PGlite, un Postgres que se guarda en la carpeta .datos (no hay que instalar nada).
import { ESQUEMA, sembrar } from './esquema.js'

export type Consulta = <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<T[]>
type Base = { consulta: Consulta; ejecutar: (sql: string) => Promise<void> }

export class SinBase extends Error {}

/** Vercel nombra la variable según el prefijo que escojas (POSTGRES_URL, STORAGE_URL, NEON_URL…): se busca por su valor. */
export function urlDeLaBase() {
  if (process.env.DATABASE_URL || process.env.POSTGRES_URL) return process.env.DATABASE_URL || process.env.POSTGRES_URL
  const directa = (k: string) => Number(/UNPOOLED|NON_POOLING|PRISMA/.test(k)) // mejor la del pooler
  return Object.entries(process.env)
    .filter(([, v]) => /^postgres(ql)?:\/\//.test(v ?? ''))
    .sort(([a], [b]) => directa(a) - directa(b))[0]?.[1]
}

async function abrir(): Promise<Base> {
  const url = urlDeLaBase()
  if (url) {
    const { default: pg } = await import('pg')
    const pool = new pg.Pool({ connectionString: url, max: 3 })
    return {
      consulta: async (sql, params) => (await pool.query(sql, params)).rows,
      ejecutar: async (sql) => { await pool.query(sql) },
    }
  }
  // En Vercel no hay disco que dure: sin base conectada, mejor avisar que perder datos.
  if (process.env.VERCEL) {
    // Solo nombres, nunca valores: ayuda a ver qué conectó Vercel.
    const vistas = Object.keys(process.env).filter((k) => /POSTGRES|DATABASE|NEON|PG/.test(k)).join(', ') || 'ninguna'
    throw new SinBase(`Falta conectar la base de datos. En Vercel: tu proyecto → Storage → Create Database → Neon → Connect, y luego Deployments → Redeploy. Variables de base vistas: ${vistas}.`)
  }
  // shortcut: nombre en variable para que Vercel no empaquete PGlite; solo se usa en la computadora.
  const modulo = '@electric-sql/pglite'
  const { PGlite } = await import(/* @vite-ignore */ modulo)
  const pg = new PGlite(process.env.DATOS_DIR === 'memoria' ? undefined : process.env.DATOS_DIR || '.datos')
  return {
    consulta: async (sql, params) => (await pg.query(sql, params)).rows,
    ejecutar: async (sql) => { await pg.exec(sql) },
  }
}

// Una sola conexión por proceso, también entre recargas de `npm run dev`.
const g = globalThis as { __miCiclo?: Promise<Consulta> }

export function base(): Promise<Consulta> {
  g.__miCiclo ??= abrir().then(async (b) => {
    await b.ejecutar(ESQUEMA)
    await sembrar(b.consulta)
    return b.consulta
  })
  // Si falló (sin red, sin base), el siguiente intento vuelve a probar.
  g.__miCiclo.catch(() => { g.__miCiclo = undefined })
  return g.__miCiclo
}

/** Solo para pruebas: empieza con una base nueva. */
export const olvidarBase = () => { g.__miCiclo = undefined }
