import { useState } from 'react'
import { ArrowRight, ArrowUp, ArrowUpRight } from 'lucide-react'
import { compararZona, gastoPorCultivo, pesos } from '../lib/calculos'
import { FIRA_MAIZ_HA, TIPOS, datosEjemplo } from '../lib/datos'
import { accionesPosibles, palancas } from '../lib/palancas'
import { PRECIOS } from '../lib/precio'
import { Escudo } from '../ui'

// Toda cifra de la portada sale de las mismas funciones (con pruebas) que usa la app.
const ejemplo = datosEjemplo()
const [maiz] = gastoPorCultivo(ejemplo.productor, ejemplo.gastos)
const peorZona = compararZona(ejemplo.productor.municipio, maiz)?.filas.filter((f) => f.diferencia > 0).sort((a, b) => b.diferencia - a.diferencia)[0]
const acciones = accionesPosibles(maiz, ejemplo.productor.municipio, ejemplo.gastos, ejemplo.anuncios)
const sembradora = ejemplo.anuncios.find((a) => a.id === acciones.find((x) => x.id === 'rentar-sembradora')?.anuncio)

const IR_A_LA_APP = '#/inicio'

export default function Portada() {
  return (
    <div className="bg-asfalto text-white">
      <Encabezado />
      <Calculadora />
      <Carretera />
      <Precaucion />
      <Caseta />
      <ParaElJurado />
      <Llegada />
    </div>
  )
}

function Encabezado() {
  return (
    <header className="bg-campo">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-2">
        <Escudo ancho={52} />
        <a href={IR_A_LA_APP} className="font-senal text-lg font-extrabold text-white underline decoration-maiz decoration-[3px]">Entrar</a>
      </div>
    </header>
  )
}

/** Los postes que sostienen un letrero, hasta el suelo de la sección. */
function Postes({ alto = 'h-16' }: { alto?: string }) {
  return (
    <div className="mx-auto flex max-w-md justify-between px-12" aria-hidden>
      <span className={`${alto} w-3 bg-[#8d969c]`} />
      <span className={`${alto} w-3 bg-[#8d969c]`} />
    </div>
  )
}

function BotonApp({ texto = 'Arma tu ciclo gratis' }: { texto?: string }) {
  return (
    <a href={IR_A_LA_APP} className="inline-flex min-h-14 items-center gap-2 rounded-xl bg-white px-6 font-senal text-xl font-black text-campo">
      {texto} <ArrowRight aria-hidden />
    </a>
  )
}

/** El letrero de la entrada: una calculadora que funciona, con la respuesta y la acción arriba. */
function Calculadora() {
  const [gastoHa, setGastoHa] = useState(String(Math.round(maiz.porHa)))
  const [toneladas, setToneladas] = useState(String(maiz.cultivo.rendimiento))
  const [precio, setPrecio] = useState(String(maiz.cultivo.precio))
  const g = Number(gastoHa), t = Number(toneladas), p = Number(precio)
  const listo = g > 0 && t > 0 && p > 0
  const { precioMinimo } = palancas(g, t, p)
  const margen = p - precioMinimo
  const gana = margen >= 0

  return (
    <section className="bg-campo pt-6 md:pt-10" aria-labelledby="titulo-portada">
      <div className="mx-auto max-w-5xl px-4">
        <h1 id="titulo-portada" className="max-w-3xl text-[2.3rem] font-black leading-[1.02] text-balance md:text-[3.8rem]">
          ¿A cómo te sale la tonelada?
        </h1>
        <p className="mt-3 max-w-xl text-lg text-white/90 md:text-xl">
          Anota lo que gastas y Mi Ciclo te dice desde qué precio ganas. Hecha para el productor de Sinaloa.
        </p>

        <div className="letrero bg-campo-hondo! mt-7 p-6 md:p-8">
          <div aria-live="polite">
            {listo ? (
              <>
                <p className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 font-senal font-black">
                  <span className="text-2xl md:text-3xl">Desde aquí ganas</span>
                  <span className="flex items-center gap-3 text-[2.6rem] leading-none md:text-[3.6rem]">
                    {pesos(precioMinimo)}<span className="text-xl md:text-2xl">/t</span>
                    <ArrowUp className="size-10 md:size-14" strokeWidth={3} aria-hidden />
                  </span>
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-4">
                  <p className={`rounded-lg px-4 py-2 font-senal text-xl font-black md:text-2xl ${gana ? 'bg-white text-campo' : 'bg-maiz text-asfalto'}`}>
                    {gana ? `Vas ganando ${pesos(margen)} por tonelada` : `Vas perdiendo ${pesos(-margen)} por tonelada`}
                  </p>
                  <BotonApp />
                </div>
              </>
            ) : (
              <p className="font-senal text-2xl font-black">Llena los tres datos.</p>
            )}
          </div>

          <div className="mt-6 border-t-[3px] border-white/85 pt-5">
            <p className="text-lg text-white/90">Son los números de Don Juan, 20 ha de maíz en Guasave (datos de ejemplo). Cámbialos por los tuyos:</p>
            <div className="mt-3 grid gap-x-8 gap-y-4 md:grid-cols-3">
              <Dato etiqueta="Gastas por hectárea" sufijo="$" valor={gastoHa} cambiar={setGastoHa} />
              <Dato etiqueta="Toneladas por hectárea" valor={toneladas} cambiar={setToneladas} paso="0.1" />
              <Dato etiqueta="Te pagan por tonelada" sufijo="$" valor={precio} cambiar={setPrecio} />
            </div>
          </div>
        </div>
        <Postes alto="h-16 md:h-24" />
      </div>
    </section>
  )
}

function Dato({ etiqueta, valor, cambiar, sufijo, paso = '1' }: { etiqueta: string; valor: string; cambiar: (v: string) => void; sufijo?: string; paso?: string }) {
  return (
    <label className="block">
      <span className="block font-senal text-lg font-extrabold">{etiqueta}</span>
      <span className="mt-1 flex items-center rounded-xl bg-white text-asfalto focus-within:ring-4 focus-within:ring-maiz">
        {sufijo && <span className="pl-4 font-senal text-2xl font-black" aria-hidden>{sufijo}</span>}
        <input
          type="number" inputMode="decimal" min={0} step={paso} value={valor}
          onChange={(e) => cambiar(e.target.value)}
          className="min-h-14 w-full rounded-xl bg-transparent px-3 font-senal text-2xl font-black outline-none"
        />
      </span>
    </label>
  )
}

const SALIDAS = [
  {
    destino: 'Números', ruta: '#/inicio',
    problema: 'No sé cuánto me cuesta producir',
    solucion: 'Anotas tus gastos, a mano, con foto de la nota o dictando. Te dice a cómo te sale la hectárea, la tonelada y desde qué precio ganas.',
    prueba: `Don Juan: ${pesos(maiz.porHa)} por hectárea, ${pesos(maiz.costoTon)} por tonelada.`,
  },
  {
    destino: 'Mercado', ruta: '#/mercado',
    problema: 'Pago de más y no tengo con qué comparar',
    solucion: 'Te compara con el promedio de tu municipio y te deja rentar o comprar equipo a tus vecinos, por WhatsApp.',
    prueba: `${peorZona ? `Paga ${peorZona.diferencia} % más de ${TIPOS[peorZona.tipo].toLowerCase()} que su zona.` : ''}${sembradora ? ` Una sembradora en renta a ${pesos(sembradora.precio)} ${sembradora.unidad}.` : ''}`,
  },
  {
    destino: 'Expediente', ruta: '#/expediente',
    problema: 'Cuando me piden papeles, no tengo',
    solucion: 'Bitácora con fecha y hora que no se pueden cambiar, y un expediente de costos para el crédito o el seguro.',
    prueba: `${ejemplo.bitacora.length} registros de bitácora; se descargan para Excel o se imprimen.`,
  },
]

/** El camino: tres salidas, una por problema, a los lados de la raya amarilla. */
function Carretera() {
  return (
    <section className="relative overflow-hidden py-16 md:py-24" aria-labelledby="titulo-salidas">
      {/* Raya central y orillas blancas de la carretera */}
      <svg className="absolute inset-y-0 left-6 h-full w-2 md:left-1/2 md:-ml-1" aria-hidden>
        <line x1="4" y1="0" x2="4" y2="100%" stroke="var(--color-maiz)" strokeWidth="6" strokeDasharray="40 30" />
      </svg>
      <span className="absolute inset-y-0 left-1 hidden w-1.5 bg-white/70 md:block" aria-hidden />
      <span className="absolute inset-y-0 right-1 hidden w-1.5 bg-white/70 md:block" aria-hidden />
      <div className="relative mx-auto max-w-5xl px-4">
        <h2 id="titulo-salidas" className="relative ml-8 inline-block bg-asfalto py-2 pr-6 text-[2rem] font-black leading-tight md:ml-0 md:max-w-[calc(50%-1.5rem)] md:text-[2.8rem]">
          Tres problemas del campo, tres salidas
        </h2>
        <ol className="mt-12 space-y-14">
          {SALIDAS.map((s, i) => (
            <li key={s.problema} className={`ml-8 md:ml-0 md:w-[calc(50%-2.5rem)] ${i % 2 ? 'md:ml-auto' : ''}`}>
              <a href={s.ruta} className="inline-flex items-center gap-2 rounded-t-lg bg-maiz px-3 py-1 font-senal text-base font-black text-asfalto no-underline">
                <span>SALIDA {i + 1}</span><span className="h-4 w-0.5 bg-asfalto/50" aria-hidden /><span>{s.destino}</span> <ArrowUpRight size={20} strokeWidth={3} aria-hidden />
              </a>
              <div className="letrero p-6 md:p-7">
                <h3 className="text-[1.6rem] font-black leading-tight">{s.problema}</h3>
                <p className="mt-3 text-lg text-white/90">{s.solucion}</p>
                <p className="mt-4 border-t-2 border-white/40 pt-3 text-base font-bold">{s.prueba}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

/** Amarillo preventivo: la regla de oro de la IA. */
function Precaucion() {
  const ejemplos = acciones.filter((a) => ['rentar-sembradora', 'zona-maquila', 'vender-grupo'].includes(a.id))
  return (
    <section className="bg-maiz py-16 text-asfalto md:py-24" aria-labelledby="titulo-ia">
      <div className="mx-auto grid max-w-5xl gap-10 px-4 md:grid-cols-[1.1fr_1fr] md:items-start">
        <div>
          <h2 id="titulo-ia" className="text-[2rem] font-black leading-tight md:text-[2.8rem]">Aquí la IA no inventa números</h2>
          <p className="mt-4 text-lg md:text-xl">
            Las cuentas las hace el programa y están probadas. La IA solo explica y propone: lee la foto de tu nota, entiende lo que le dictas y arma un plan para ponerte en verde. <strong>Tú decides.</strong>
          </p>
          <p className="mt-4 text-base">Nunca te receta agroquímicos ni te promete apoyos de gobierno.</p>
        </div>
        {/* Letrero preventivo: amarillo con filo negro metido en el borde */}
        <div className="rounded-2xl bg-maiz p-7 outline-[5px] -outline-offset-[11px] outline-asfalto outline shadow-[0_10px_24px_-12px_rgb(0_0_0/0.45)]">
          <p className="font-senal text-2xl font-black">Ponte en verde</p>
          <p className="text-base">Plan de ejemplo para Don Juan</p>
          <ul className="mt-3 divide-y-2 divide-asfalto/25">
            {ejemplos.map((a) => (
              <li key={a.id} className="py-3">
                <span className="block font-bold">{a.titulo}</span>
                <span className="text-base">Podría ahorrar de {pesos(a.ahorroMin)} a {pesos(a.ahorroMax)} · {a.certeza} · dato: {a.fuente}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

/** Las tarifas como en la caseta: por temporada, no por cultivo. */
function Caseta() {
  const filas = [
    ['Hasta ' + PRECIOS.haGratis + ' ha', 'Gratis', 'con ofertas de tiendas de tu municipio'],
    [`De ${PRECIOS.haGratis + 1} a ${PRECIOS.haPrecioFijo} ha`, `${pesos(PRECIOS.porHectarea)} por ha`, `mínimo ${pesos(PRECIOS.minimo)} · 25 ha = ${pesos(25 * PRECIOS.porHectarea)}`],
    [`Más de ${PRECIOS.haPrecioFijo} ha`, pesos(PRECIOS.precioFijo), 'precio fijo'],
  ]
  return (
    <section className="py-16 md:py-24" aria-labelledby="titulo-tarifas">
      <div className="mx-auto max-w-5xl px-4">
        <h2 id="titulo-tarifas" className="text-[2rem] font-black leading-tight md:text-[2.8rem]">Tarifas por temporada</h2>
        <p className="mt-3 max-w-2xl text-lg text-white/85">Se paga por temporada (OI o PV), con todos tus cultivos. El plan de pago trae expediente, comparación detallada con tu zona y cero anuncios.</p>
        <div className="letrero mt-8 overflow-hidden p-2 md:p-3">
          <table className="w-full">
            <caption className="sr-only">Tarifas de Mi Ciclo por temporada</caption>
            <tbody>
              {filas.map(([ha, precio, nota]) => (
                <tr key={ha} className="border-b-2 border-white/30 last:border-0">
                  <th scope="row" className="px-4 py-4 text-left font-senal text-xl font-extrabold md:text-2xl">{ha}</th>
                  <td className="px-4 py-4 text-right">
                    <span className="block font-senal text-2xl font-black md:text-[2rem]">{precio}</span>
                    <span className="text-base text-white/85">{nota}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

/** Lo que buscan los jueces: un tablero de información, con la fuente en cada renglón. */
function ParaElJurado() {
  const datos = [
    ['92.8 %', 'de los productores de Sinaloa dice que su principal problema es el alto costo de insumos y servicios.', 'Dato del equipo'],
    [pesos(FIRA_MAIZ_HA), `por hectárea cuesta producir maíz, según la referencia pública de FIRA. Don Juan va en ${pesos(maiz.porHa)}.`, 'FIRA'],
    ['0', 'datos sensibles: no pide INE, CURP, CLABE ni ubicación. Las comparaciones nunca usan grupos de menos de 5 productores.', 'Diseño de la app'],
  ]
  return (
    <section className="bg-asfalto-claro pt-16 md:pt-24" aria-labelledby="titulo-jurado">
      <div className="mx-auto max-w-5xl px-4">
        <h2 id="titulo-jurado" className="text-[2rem] font-black leading-tight md:text-[2.8rem]">Para el jurado</h2>
        <p className="mt-3 max-w-2xl text-lg text-white/85">
          Modelo de negocio: el plan por temporada lo pagan quienes tienen más de {PRECIOS.haGratis} ha; los pequeños usan la app gratis y la sostienen las ofertas de tiendas, siempre marcadas como “Oferta” y nunca junto a un aviso de plaga.
        </p>
        <div className="letrero mt-8 p-3 md:p-4">
          <dl>
            {datos.map(([cifra, texto, fuente]) => (
              <div key={fuente} className="grid gap-x-6 gap-y-1 border-b-2 border-white/30 px-3 py-5 last:border-0 md:grid-cols-[13rem_1fr] md:items-baseline">
                <dt className="font-senal text-[2.4rem] font-black leading-none">{cifra}</dt>
                <dd className="text-lg">
                  {texto} <span className="text-base text-white/80">Fuente: {fuente}.</span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
        <Postes alto="h-16 md:h-24" />
      </div>
    </section>
  )
}

/** La llegada: el último letrero, con el destino y la acción puestos en él. */
function Llegada() {
  return (
    <section className="bg-campo pt-16 md:pt-20" aria-labelledby="titulo-llegada">
      <div className="mx-auto max-w-3xl px-4">
        <div className="letrero bg-campo-hondo! p-7 md:p-9">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <Escudo ancho={72} />
              <h2 id="titulo-llegada" className="text-[2rem] font-black leading-tight md:text-[2.6rem]">Tus cuentas claras</h2>
            </div>
            <ArrowRight className="size-14 shrink-0" strokeWidth={3} aria-hidden />
          </div>
          <div className="mt-6 border-t-[3px] border-white/85 pt-6">
            <BotonApp texto="Entrar a Mi Ciclo" />
          </div>
        </div>
        <Postes alto="h-12" />
      </div>
      <p className="bg-asfalto px-4 py-6 text-center text-base text-white/80">
        Maqueta en producción para Enactus México. Cuentas y datos guardados en base de datos; entra con la cuenta de prueba (prueba / campo2026) o crea la tuya. La calculadora de arriba usa números de ejemplo; la comparación con tu zona y las ofertas de tiendas son de ejemplo; pagos simulados; la IA usa modelos gratuitos y puede tardar.
      </p>
    </section>
  )
}
