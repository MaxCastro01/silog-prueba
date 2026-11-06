export const TIPOS = {
  renta: 'Renta de tierra',
  semilla: 'Semilla',
  fertilizante: 'Fertilizante',
  agroquimicos: 'Agroquímicos',
  diesel: 'Diésel',
  maquila: 'Maquila',
  jornales: 'Jornales',
  agua: 'Agua',
  intereses: 'Intereses',
} as const
export type Tipo = keyof typeof TIPOS

export const CULTIVOS = ['Maíz', 'Sorgo', 'Garbanzo', 'Frijol', 'Trigo', 'Hortalizas'] as const
// OI = otoño-invierno, PV = primavera-verano.
export const TEMPORADAS = ['OI 2025-26', 'PV 2026', 'OI 2026-27', 'PV 2027', 'OI 2027-28', 'PV 2028'] as const
export const MUNICIPIOS = [
  'Ahome', 'Angostura', 'Badiraguato', 'Choix', 'Concordia', 'Cosalá', 'Culiacán', 'El Fuerte',
  'Eldorado', 'Elota', 'Escuinapa', 'Guasave', 'Juan José Ríos', 'Mazatlán', 'Mocorito', 'Navolato',
  'Rosario', 'Salvador Alvarado', 'San Ignacio', 'Sinaloa',
]
// Valores de arranque cuando el productor agrega un cultivo; él los cambia en Inicio.
export const RENDIMIENTO_INICIAL: Record<string, { rendimiento: number; precio: number }> = {
  Maíz: { rendimiento: 10, precio: 4400 },
  Sorgo: { rendimiento: 6, precio: 3800 },
  Garbanzo: { rendimiento: 2, precio: 16000 },
  Frijol: { rendimiento: 2, precio: 20000 },
  Trigo: { rendimiento: 6, precio: 5500 },
  Hortalizas: { rendimiento: 30, precio: 6000 },
}

export const GENERAL = 'General'

export type Cultivo = { nombre: string; ha: number; rendimiento: number; precio: number }
export type Productor = { nombre: string; municipio: string; temporada: string; cultivos: Cultivo[]; pagado: boolean }
export type Gasto = { id: string; concepto: string; monto: number; tipo: Tipo; fecha: string; cultivo: string }
export type Nota = { id: string; tipo: string; cultivo: string; texto: string; creado: string }
export type Anuncio = {
  id: string; titulo: string; categoria: string; modo: 'venta' | 'renta'; precio: number; unidad: string
  municipio: string; whatsapp: string; foto?: string; autor: string; propio?: boolean
}
export type Respuesta = { autor: string; texto: string; fecha: string }
export type Publicacion = {
  id: string; tipo: string; municipio: string; cultivo: string; autor: string; texto: string; fecha: string
  respuestas: Respuesta[]
}
export type Oferta = { id: string; tienda: string; municipio: string; tipo: Tipo; texto: string }
export type Cuenta = { usuario: string; nombre: string; municipio: string }
export type CicloResumen = { id: string; temporada: string; activo: boolean }
export type Datos = {
  usuario: Cuenta
  ciclos: CicloResumen[]
  productor: Productor
  gastos: Gasto[]
  bitacora: Nota[]
  anuncios: Anuncio[]
  publicaciones: Publicacion[]
}
/** Lo que manda el servidor: sin ciclo todavía, no hay productor. */
export type DatosServidor = Omit<Datos, 'productor'> & { productor: Productor | null }

export const TIPOS_NOTA = ['Siembra', 'Riego', 'Aplicación', 'Plaga', 'Clima', 'Cosecha']
export const CATEGORIAS = ['Herramientas', 'Equipo', 'Maquinaria', 'Insumos']
export const TIPOS_PUBLICACION = ['Duda', 'Aviso de plaga', 'Recomendación']

// Promedio de gasto por hectárea de maíz, por municipio. DATOS DE EJEMPLO, no son reales.
// productores = cuántos productores forman el promedio (menos de 5 no se muestra).
export const ZONA_MAIZ: Record<string, { productores: number; porHa: Record<Tipo, number> }> = {
  Guasave: {
    productores: 23,
    porHa: { renta: 12000, semilla: 6800, fertilizante: 9200, agroquimicos: 2900, diesel: 3100, maquila: 7000, jornales: 1700, agua: 1500, intereses: 2600 },
  },
  Culiacán: {
    productores: 31,
    porHa: { renta: 13000, semilla: 7100, fertilizante: 9400, agroquimicos: 3000, diesel: 3000, maquila: 7400, jornales: 1800, agua: 1600, intereses: 2700 },
  },
  Navolato: {
    productores: 12,
    porHa: { renta: 12500, semilla: 7000, fertilizante: 9100, agroquimicos: 2800, diesel: 3200, maquila: 7200, jornales: 1700, agua: 1500, intereses: 2500 },
  },
  Choix: {
    productores: 3,
    porHa: { renta: 8000, semilla: 6500, fertilizante: 8000, agroquimicos: 2500, diesel: 3500, maquila: 6500, jornales: 1500, agua: 1200, intereses: 2000 },
  },
}
// Referencia pública de FIRA para maíz en Sinaloa, en pesos por hectárea.
export const FIRA_MAIZ_HA = 48400

export const OFERTAS: Oferta[] = [
  { id: 'o1', tienda: 'Gasolinera El Huizache', municipio: 'Guasave', tipo: 'diesel', texto: 'Diésel a $24.10 el litro pagando de contado, de lunes a miércoles.' },
  { id: 'o2', tienda: 'Agroinsumos del Évora', municipio: 'Guasave', tipo: 'fertilizante', texto: '5 % menos en urea por tonelada completa, con entrega en tu parcela.' },
  { id: 'o3', tienda: 'Semillas Tres Ríos', municipio: 'Culiacán', tipo: 'semilla', texto: 'Bolsa de semilla de maíz con 8 % de descuento apartando antes del 15 de noviembre.' },
]

const g = (id: number, concepto: string, monto: number, tipo: Tipo, fecha: string, cultivo: string): Gasto =>
  ({ id: `g${id}`, concepto, monto, tipo, fecha, cultivo })

// Don Juan: solo para la calculadora de la portada y las pruebas. La app usa la base de datos.
export function datosEjemplo(): Datos {
  return {
    usuario: { usuario: 'donjuan', nombre: 'Don Juan', municipio: 'Guasave' },
    ciclos: [{ id: 'c1', temporada: 'OI 2026-27', activo: true }],
    productor: {
      nombre: 'Don Juan',
      municipio: 'Guasave',
      temporada: 'OI 2026-27',
      pagado: false,
      cultivos: [
        { nombre: 'Maíz', ha: 20, rendimiento: 10, precio: 4400 },
        { nombre: 'Frijol', ha: 5, rendimiento: 2, precio: 20000 },
      ],
    },
    // Maíz queda en ~48,000 $/ha, cerca de la referencia de FIRA.
    gastos: [
      g(1, 'Renta de 25 ha', 300000, 'renta', '2026-08-15', GENERAL),
      g(2, 'Semilla híbrida de maíz', 140000, 'semilla', '2026-09-20', 'Maíz'),
      g(3, 'Semilla de frijol', 22500, 'semilla', '2026-09-22', 'Frijol'),
      g(4, 'Urea', 120000, 'fertilizante', '2026-09-25', 'Maíz'),
      g(5, 'Fosfato (MAP)', 60000, 'fertilizante', '2026-09-25', 'Maíz'),
      g(6, 'Fertilizante para frijol', 15000, 'fertilizante', '2026-09-26', 'Frijol'),
      g(7, 'Herbicida', 24000, 'agroquimicos', '2026-09-28', 'Maíz'),
      g(8, 'Insecticida para gusano cogollero', 30000, 'agroquimicos', '2026-10-01', 'Maíz'),
      g(9, 'Agroquímicos para frijol', 18000, 'agroquimicos', '2026-10-01', 'Frijol'),
      g(10, 'Diésel para el tractor', 75000, 'diesel', '2026-09-10', GENERAL),
      g(11, 'Barbecho y rastra', 90000, 'maquila', '2026-09-05', GENERAL),
      g(12, 'Siembra de maíz', 36000, 'maquila', '2026-10-03', 'Maíz'),
      g(13, 'Trilla de maíz (apartada)', 60000, 'maquila', '2026-10-03', 'Maíz'),
      g(14, 'Jornales de riego', 40000, 'jornales', '2026-10-05', GENERAL),
      g(15, 'Cuota de agua del módulo', 37500, 'agua', '2026-09-01', GENERAL),
      g(16, 'Intereses del crédito de avío', 70000, 'intereses', '2026-10-06', GENERAL),
    ],
    bitacora: [
      { id: 'b1', tipo: 'Riego', cultivo: 'Maíz', texto: 'Riego de presiembra en las 20 ha.', creado: '2026-09-12T07:40:00' },
      { id: 'b2', tipo: 'Siembra', cultivo: 'Maíz', texto: 'Siembra con sembradora de precisión, 90 mil semillas por ha.', creado: '2026-10-03T08:15:00' },
      { id: 'b3', tipo: 'Siembra', cultivo: 'Frijol', texto: 'Siembra de frijol azufrado en 5 ha.', creado: '2026-10-04T09:00:00' },
      { id: 'b4', tipo: 'Clima', cultivo: GENERAL, texto: 'Lluvia ligera en la tarde, unos 10 mm.', creado: '2026-10-06T18:30:00' },
      { id: 'b5', tipo: 'Plaga', cultivo: 'Maíz', texto: 'Se ve gusano cogollero en la orilla del canal.', creado: '2026-10-08T07:10:00' },
    ],
    anuncios: [
      { id: 'a1', titulo: 'Sembradora de precisión 4 surcos', categoria: 'Maquinaria', modo: 'renta', precio: 450, unidad: 'por hectárea', municipio: 'Guasave', whatsapp: '6871234567', autor: 'Ramón' },
      { id: 'a2', titulo: 'Aspersora de mochila 20 L', categoria: 'Herramientas', modo: 'venta', precio: 1200, unidad: 'precio total', municipio: 'Guasave', whatsapp: '6871112233', autor: 'Lupita' },
      { id: 'a3', titulo: 'Bomba de agua 3 pulgadas a gasolina', categoria: 'Equipo', modo: 'renta', precio: 350, unidad: 'por día', municipio: 'Guasave', whatsapp: '6879876543', autor: 'Chuy' },
      { id: 'a4', titulo: 'Rastra de 24 discos, usada', categoria: 'Maquinaria', modo: 'venta', precio: 65000, unidad: 'precio total', municipio: 'Navolato', whatsapp: '6721234567', autor: 'Don Beto' },
      { id: 'a5', titulo: 'Cintilla calibre 8000, 10 rollos', categoria: 'Insumos', modo: 'venta', precio: 9500, unidad: 'precio total', municipio: 'Culiacán', whatsapp: '6671234567', autor: 'Mario' },
      { id: 'a6', titulo: 'Tractor John Deere 6403 con operador', categoria: 'Maquinaria', modo: 'renta', precio: 1800, unidad: 'por día', municipio: 'Culiacán', whatsapp: '6677654321', autor: 'Hermanos Félix' },
      { id: 'a7', titulo: 'Aspersora de motor 25 L', categoria: 'Equipo', modo: 'venta', precio: 4800, unidad: 'precio total', municipio: 'Navolato', whatsapp: '6729988776', autor: 'Toño' },
      { id: 'a8', titulo: 'Cultivadora de 4 surcos', categoria: 'Maquinaria', modo: 'renta', precio: 300, unidad: 'por hectárea', municipio: 'Navolato', whatsapp: '6725554433', autor: 'Chayo' },
      { id: 'a9', titulo: 'Palas, azadones y bieldos', categoria: 'Herramientas', modo: 'venta', precio: 900, unidad: 'precio total', municipio: 'Culiacán', whatsapp: '6673332211', autor: 'Pancho' },
      { id: 'a10', titulo: 'Remolque de 4 toneladas', categoria: 'Equipo', modo: 'renta', precio: 500, unidad: 'por día', municipio: 'Guasave', whatsapp: '6874445566', autor: 'Nacho' },
    ],
    publicaciones: [
      { id: 'p1', tipo: 'Aviso de plaga', municipio: 'Guasave', cultivo: 'Maíz', autor: 'Ramón', texto: 'Ya anda el gusano cogollero por el rumbo de Tamazula. Revisen sus orillas.', fecha: '2026-10-07', respuestas: [{ autor: 'Lupita', texto: 'Aquí también, en la parte de abajo.', fecha: '2026-10-07' }] },
      { id: 'p2', tipo: 'Duda', municipio: 'Guasave', cultivo: 'Frijol', autor: 'Chuy', texto: '¿Cuántos riegos le dan al frijol en esta temporada?', fecha: '2026-10-05', respuestas: [{ autor: 'Don Juan', texto: 'Yo le doy tres, depende de la lluvia.', fecha: '2026-10-05' }] },
      { id: 'p3', tipo: 'Recomendación', municipio: 'Culiacán', cultivo: 'Maíz', autor: 'Mario', texto: 'Junten pedido de fertilizante entre varios, sale más barato por tonelada.', fecha: '2026-10-02', respuestas: [] },
      { id: 'p4', tipo: 'Duda', municipio: 'Navolato', cultivo: 'Maíz', autor: 'Chayo', texto: '¿Alguien sabe a cómo está la maquila de trilla este año?', fecha: '2026-10-01', respuestas: [{ autor: 'Don Beto', texto: 'Me cobraron 2,800 por hectárea.', fecha: '2026-10-02' }] },
      { id: 'p5', tipo: 'Recomendación', municipio: 'Guasave', cultivo: 'Maíz', autor: 'Nacho', texto: 'Calibren la sembradora antes de entrar, se ahorra semilla.', fecha: '2026-09-28', respuestas: [] },
      { id: 'p6', tipo: 'Aviso de plaga', municipio: 'Navolato', cultivo: 'Garbanzo', autor: 'Toño', texto: 'Se está viendo rabia del garbanzo en parcelas con mucha humedad.', fecha: '2026-09-25', respuestas: [] },
    ],
  }
}
