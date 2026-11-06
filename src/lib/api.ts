// La puerta a la base de datos desde el navegador. La sesión va en una cookie que el navegador maneja solo.
import type { DatosServidor } from './datos'

export class ErrorApi extends Error {
  status: number
  constructor(mensaje: string, status: number) { super(mensaje); this.status = status }
}

async function pedir(ruta: string, cuerpo?: object) {
  let r: Response
  try {
    r = await fetch(ruta, cuerpo && { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) })
  } catch {
    throw new ErrorApi('Sin conexión. Revisa tu señal e intenta otra vez.', 0)
  }
  const j = r.headers.get('content-type')?.includes('application/json') ? await r.json().catch(() => ({})) : {}
  if (!r.ok) throw new ErrorApi(j.error ?? 'Algo falló. Intenta otra vez.', r.status)
  return j
}

export const leerDatos = async (): Promise<DatosServidor> => (await pedir('api/datos')).datos
export const hacerAccion = async (accion: string, entrada: object = {}): Promise<DatosServidor> => (await pedir('api/datos', { accion, entrada })).datos
export const cuenta = (cuerpo: { accion: 'entrar' | 'crear' | 'salir' } & Record<string, string>) => pedir('api/cuenta', cuerpo)
