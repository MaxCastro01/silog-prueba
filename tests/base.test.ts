import { expect, test } from 'vitest'
import { cuentaNueva, entrar, llamar } from './ayuda'
import * as cuenta from '../api/cuenta'
import * as datos from '../api/datos'
import { base } from '../server/db'

const hacer = (cookie: string, accion: string, entrada?: unknown) => llamar(datos.POST, 'datos', { accion, entrada }, cookie)
const ciclo = { temporada: 'PV 2027', cultivos: [{ nombre: 'Maíz', ha: 12 }, { nombre: 'Sorgo', ha: 3 }] }

test('la cuenta de prueba existe, empieza sin ciclo y no entra con otra contraseña', async () => {
  const cookie = await entrar()
  expect(cookie).toMatch(/^ciclo_sesion=/)
  const { j } = await llamar(datos.GET, 'datos', undefined, cookie)
  expect(j.datos.usuario).toEqual({ usuario: 'prueba', nombre: 'Productor de prueba', municipio: 'Guasave' })
  expect((await llamar(cuenta.POST, 'cuenta', { accion: 'entrar', usuario: 'prueba', clave: 'otra' })).status).toBe(401)
  expect((await llamar(cuenta.POST, 'cuenta', { accion: 'entrar', usuario: 'nadie', clave: 'otra' })).status).toBe(401)
})

test('sin sesión no hay datos; salir cierra la sesión', async () => {
  expect((await llamar(datos.GET, 'datos')).status).toBe(401)
  expect((await llamar(datos.GET, 'datos', undefined, 'ciclo_sesion=inventada')).status).toBe(401)
  const { cookie } = await cuentaNueva()
  expect((await llamar(datos.GET, 'datos', undefined, cookie)).status).toBe(200)
  const salida = await llamar(cuenta.POST, 'cuenta', { accion: 'salir' }, cookie)
  expect(salida.r.headers.get('set-cookie')).toContain('Max-Age=0')
  expect((await llamar(datos.GET, 'datos', undefined, cookie)).status).toBe(401)
})

test('no se repite usuario y se validan los datos de la cuenta', async () => {
  const { usuario } = await cuentaNueva()
  expect((await llamar(cuenta.POST, 'cuenta', { accion: 'crear', usuario, clave: 'secreta1', nombre: 'B', municipio: 'Guasave' })).status).toBe(409)
  expect((await llamar(cuenta.POST, 'cuenta', { accion: 'crear', usuario: 'xx', clave: 'secreta1', nombre: 'B', municipio: 'Guasave' })).status).toBe(400)
  expect((await llamar(cuenta.POST, 'cuenta', { accion: 'crear', usuario: 'abcde', clave: '123', nombre: 'B', municipio: 'Guasave' })).status).toBe(400)
  expect((await llamar(cuenta.POST, 'cuenta', { accion: 'crear', usuario: 'abcde', clave: 'secreta1', nombre: 'B', municipio: 'Monterrey' })).status).toBe(400)
})

test('un ciclo completo: cultivos, gastos, bitácora y pago', async () => {
  const { cookie } = await cuentaNueva()
  expect((await hacer(cookie, 'gasto', { concepto: 'x', monto: 1, tipo: 'diesel', fecha: '2027-05-01', cultivo: 'General' })).status).toBe(400)

  let { j } = await hacer(cookie, 'nuevoCiclo', ciclo)
  expect(j.datos.productor).toMatchObject({ temporada: 'PV 2027', pagado: false, cultivos: [{ nombre: 'Maíz', ha: 12, rendimiento: 10, precio: 4400 }, { nombre: 'Sorgo', ha: 3 }] })

  ;({ j } = await hacer(cookie, 'ajustarCultivo', { nombre: 'Maíz', rendimiento: 11.5, precio: 4600 }))
  expect(j.datos.productor.cultivos[0]).toMatchObject({ rendimiento: 11.5, precio: 4600 })

  await hacer(cookie, 'gasto', { concepto: 'Diésel', monto: 9840.5, tipo: 'diesel', fecha: '2027-05-01', cultivo: 'General' })
  ;({ j } = await hacer(cookie, 'gasto', { concepto: 'Semilla', monto: 50000, tipo: 'semilla', fecha: '2027-05-03', cultivo: 'Maíz' }))
  expect(j.datos.gastos.map((g: { concepto: string; monto: number }) => [g.concepto, g.monto])).toEqual([['Semilla', 50000], ['Diésel', 9840.5]])
  expect((await hacer(cookie, 'gasto', { concepto: 'x', monto: 5, tipo: 'diesel', fecha: '2027-05-01', cultivo: 'Frijol' })).status).toBe(400)
  expect((await hacer(cookie, 'gasto', { concepto: 'x', monto: -5, tipo: 'diesel', fecha: '2027-05-01', cultivo: 'Maíz' })).status).toBe(400)

  ;({ j } = await hacer(cookie, 'borrarGasto', { id: j.datos.gastos[1].id }))
  expect(j.datos.gastos).toHaveLength(1)

  const antes = Date.now()
  ;({ j } = await hacer(cookie, 'nota', { tipo: 'Riego', cultivo: 'Maíz', texto: 'Primer riego' }))
  const [nota] = j.datos.bitacora
  expect(nota).toMatchObject({ tipo: 'Riego', cultivo: 'Maíz', texto: 'Primer riego' })
  expect(Math.abs(new Date(nota.creado).getTime() - antes)).toBeLessThan(60_000)

  ;({ j } = await hacer(cookie, 'pagar'))
  expect(j.datos.productor.pagado).toBe(true)
})

test('la bitácora no se puede cambiar ni desde la base', async () => {
  const { cookie } = await cuentaNueva()
  await hacer(cookie, 'nuevoCiclo', ciclo)
  const { j } = await hacer(cookie, 'nota', { tipo: 'Plaga', cultivo: 'General', texto: 'Gusano' })
  const consulta = await base()
  await expect(consulta("update notas set creado = now() - interval '1 year' where id = $1", [j.datos.bitacora[0].id])).rejects.toThrow(/no se puede cambiar/)
})

test('varios ciclos: el nuevo queda activo y se puede volver al anterior', async () => {
  const { cookie } = await cuentaNueva()
  await hacer(cookie, 'nuevoCiclo', ciclo)
  await hacer(cookie, 'gasto', { concepto: 'Renta', monto: 1000, tipo: 'renta', fecha: '2027-05-01', cultivo: 'General' })
  let { j } = await hacer(cookie, 'nuevoCiclo', { temporada: 'OI 2027-28', cultivos: [{ nombre: 'Garbanzo', ha: 4 }] })
  expect(j.datos.productor.temporada).toBe('OI 2027-28')
  expect(j.datos.gastos).toEqual([])
  expect(j.datos.ciclos.map((c: { temporada: string; activo: boolean }) => [c.temporada, c.activo])).toEqual([['OI 2027-28', true], ['PV 2027', false]])
  ;({ j } = await hacer(cookie, 'elegirCiclo', { id: j.datos.ciclos[1].id }))
  expect(j.datos.gastos).toHaveLength(1)
})

test('mercado y comunidad: todos ven, solo el dueño borra', async () => {
  const ana = await cuentaNueva('Ana')
  const beto = await cuentaNueva('Beto')
  const foto = 'data:image/jpeg;base64,' + Buffer.from('jpeg falso').toString('base64')
  let { j } = await hacer(ana.cookie, 'anuncio', { titulo: 'Sembradora', categoria: 'Maquinaria', modo: 'renta', precio: 450, unidad: 'por hectárea', municipio: 'Guasave', whatsapp: '6871234567', foto })
  const [a] = j.datos.anuncios
  expect(a).toMatchObject({ titulo: 'Sembradora', autor: 'Ana', propio: true, foto: `api/datos?foto=${a.id}` })
  expect(a).not.toHaveProperty('usuario_id')

  const r = await llamar(datos.GET, `datos?foto=${a.id}`, undefined, beto.cookie)
  expect(r.r.headers.get('content-type')).toBe('image/jpeg')
  expect(Buffer.from(await r.r.arrayBuffer()).toString()).toBe('jpeg falso')

  ;({ j } = await hacer(beto.cookie, 'borrarAnuncio', { id: a.id }))
  expect(j.datos.anuncios.find((x: { id: string }) => x.id === a.id)).toMatchObject({ propio: false })
  ;({ j } = await hacer(ana.cookie, 'borrarAnuncio', { id: a.id }))
  expect(j.datos.anuncios.find((x: { id: string }) => x.id === a.id)).toBeUndefined()

  ;({ j } = await hacer(ana.cookie, 'publicacion', { tipo: 'Duda', cultivo: 'Frijol', texto: '¿Cuántos riegos?' }))
  const [p] = j.datos.publicaciones
  expect(p).toMatchObject({ autor: 'Ana', municipio: 'Guasave', respuestas: [] })
  ;({ j } = await hacer(beto.cookie, 'respuesta', { publicacion: p.id, texto: 'Tres' }))
  expect(j.datos.publicaciones[0].respuestas).toEqual([{ autor: 'Beto', texto: 'Tres', fecha: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) }])
})

test('nadie toca el ciclo de otro', async () => {
  const ana = await cuentaNueva()
  const beto = await cuentaNueva()
  const { j } = await hacer(ana.cookie, 'nuevoCiclo', ciclo)
  await hacer(ana.cookie, 'gasto', { concepto: 'Renta', monto: 1000, tipo: 'renta', fecha: '2027-05-01', cultivo: 'General' })
  const idCiclo = j.datos.ciclos[0].id
  expect((await hacer(beto.cookie, 'elegirCiclo', { id: idCiclo })).status).toBe(400)
  const deAna = (await hacer(ana.cookie, 'pagar')).j.datos.gastos[0].id
  await hacer(beto.cookie, 'borrarGasto', { id: deAna })
  expect((await llamar(datos.GET, 'datos', undefined, ana.cookie)).j.datos.gastos).toHaveLength(1)
})

test('empezar de cero borra lo del usuario y deja la cuenta', async () => {
  const { cookie } = await cuentaNueva()
  await hacer(cookie, 'nuevoCiclo', ciclo)
  await hacer(cookie, 'anuncio', { titulo: 'Bomba', categoria: 'Equipo', modo: 'renta', precio: 350, unidad: 'por día', municipio: 'Guasave', whatsapp: '6871234567' })
  const { j } = await hacer(cookie, 'borrarTodo')
  expect(j.datos.productor).toBeNull()
  expect(j.datos.ciclos).toEqual([])
  expect(j.datos.anuncios.some((a: { propio: boolean }) => a.propio)).toBe(false)
})

test('rechaza acciones raras y peticiones que no son JSON', async () => {
  const { cookie } = await cuentaNueva()
  expect((await hacer(cookie, '__proto__')).status).toBe(400)
  expect((await hacer(cookie, 'nuevoCiclo', { temporada: 'PV 1990', cultivos: [{ nombre: 'Maíz', ha: 1 }] })).status).toBe(400)
  expect((await hacer(cookie, 'nuevoCiclo', { temporada: 'PV 2027', cultivos: [{ nombre: 'Maíz', ha: 1 }, { nombre: 'Maíz', ha: 2 }] })).status).toBe(400)
  const r = await datos.POST(new Request('http://localhost/api/datos', { method: 'POST', headers: { 'Content-Type': 'text/plain', cookie }, body: '{"accion":"borrarTodo"}' }))
  expect(r.status).toBe(415)
})

test('en Vercel sin base avisa cómo conectarla', async () => {
  const { olvidarBase } = await import('../server/db')
  const guardado = { ...process.env }
  delete process.env.DATABASE_URL
  delete process.env.TEST_DATABASE_URL
  process.env.VERCEL = '1'
  olvidarBase()
  const r = await llamar(datos.GET, 'datos')
  expect(r.status).toBe(503)
  expect(r.j.error).toMatch(/Storage → Create Database → Neon/)
  process.env = guardado
  olvidarBase()
})

test('encuentra la base con el prefijo que haya puesto Vercel', async () => {
  const { urlDeLaBase } = await import('../server/db')
  const guardado = { ...process.env }
  for (const k of ['DATABASE_URL', 'POSTGRES_URL', 'TEST_DATABASE_URL']) delete process.env[k]
  process.env.NEON_URL_UNPOOLED = 'postgresql://directa'
  process.env.NEON_URL = 'postgresql://pooler'
  process.env.NEON_HOST = 'ep-algo.neon.tech'
  expect(urlDeLaBase()).toBe('postgresql://pooler')
  process.env = guardado
})
