import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scryptA = promisify(scrypt) as (clave: string, sal: Buffer, largo: number) => Promise<Buffer>

/** La contraseña nunca se guarda: solo su huella con sal (scrypt). */
export async function huellaClave(clave: string) {
  const sal = randomBytes(16)
  return `scrypt$${sal.toString('base64')}$${(await scryptA(clave, sal, 32)).toString('base64')}`
}

export async function claveCorrecta(clave: string, huella: string) {
  const [, sal, esperada] = huella.split('$')
  if (!sal || !esperada) return false
  const calculada = await scryptA(clave, Buffer.from(sal, 'base64'), 32)
  const b = Buffer.from(esperada, 'base64')
  return b.length === calculada.length && timingSafeEqual(b, calculada)
}

export const nuevoToken = () => randomBytes(32).toString('base64url')
/** En la base se guarda la huella del token: si alguien la lee, no puede entrar con ella. */
export const huellaToken = (token: string) => createHash('sha256').update(token).digest('base64url')
