import { useEffect, useState } from 'react'
import { TrendingDown, TrendingUp } from 'lucide-react'
import type { Props } from '../App'
import { compararZona, gastoPorCultivo, gastoPorTipo, haTotal, pesos, tienePlanPago } from '../lib/calculos'
import { FIRA_MAIZ_HA, TIPOS, type Cultivo, type Tipo } from '../lib/datos'
import { Regla, Seccion, Titulo } from '../ui'
import PonteEnVerde from './PonteEnVerde'

type Ajuste = { rendimiento: number; precio: number }

export default function Inicio({ d: guardados, hacer }: Props) {
  // Lo que el productor va tecleando se ve al instante y se guarda cuando deja de escribir.
  const [borrador, setBorrador] = useState<Record<string, Ajuste>>({})
  const p = { ...guardados.productor, cultivos: guardados.productor.cultivos.map((c) => ({ ...c, ...borrador[c.nombre] })) }
  const d = { ...guardados, productor: p }
  useEffect(() => {
    const pendientes = Object.entries(borrador)
    if (pendientes.length === 0) return
    const t = setTimeout(async () => {
      for (const [nombre, ajuste] of pendientes) await hacer('ajustarCultivo', { nombre, ...ajuste })
      // Solo se suelta lo que ya se guardó; si siguió tecleando, eso se queda para la próxima.
      setBorrador((b) => Object.fromEntries(Object.entries(b).filter(([n, a]) => !pendientes.some(([m, x]) => m === n && x === a))))
    }, 800)
    return () => clearTimeout(t)
  }, [borrador, hacer])
  const total = d.gastos.reduce((s, g) => s + g.monto, 0)
  const porTipo = Object.entries(gastoPorTipo(d.gastos)).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]) as [Tipo, number][]
  const max = porTipo[0]?.[1] ?? 1
  const cultivos = gastoPorCultivo(p, d.gastos)
  const pago = tienePlanPago(p)

  const editar = (c: Cultivo, campo: keyof Ajuste, valor: number) =>
    setBorrador((b) => ({ ...b, [c.nombre]: { rendimiento: c.rendimiento, precio: c.precio, [campo]: valor } }))

  return (
    <>
      <Titulo>Hola, {p.nombre}</Titulo>
      <p className="text-tinta-2 -mt-3 mb-4">{p.municipio} · {p.temporada} · {haTotal(p)} ha</p>

      <Seccion titulo="Lo que llevas gastado">
        <p className="text-[2.2rem] font-bold leading-none mb-4">{pesos(total)}</p>
        {porTipo.length === 0 && <p>Todavía no registras gastos. <a href="#/gasto" className="font-bold text-campo">Registra el primero</a>.</p>}
        <ul className="space-y-2" aria-label="Gasto por tipo">
          {porTipo.map(([tipo, monto]) => (
            <li key={tipo}>
              <div className="flex justify-between text-base">
                <span>{TIPOS[tipo]}</span>
                <span className="font-bold">{pesos(monto)}</span>
              </div>
              <div className="h-3 rounded-r bg-campo" style={{ width: `${Math.max(2, (monto / max) * 100)}%` }} aria-hidden />
            </li>
          ))}
        </ul>
      </Seccion>

      {cultivos.map((r) => {
        const zona = compararZona(p.municipio, r)
        const peor = zona?.filas.filter((f) => f.diferencia > 0).sort((a, b) => b.diferencia - a.diferencia)[0]
        return (
          <Seccion key={r.cultivo.nombre} className="overflow-hidden">
            <Veredicto c={r.cultivo} costoTon={r.costoTon} margenTon={r.margenTon} />
            {r.margenTon < 0 && r.cultivo.rendimiento > 0 && <PonteEnVerde d={d} r={r} key={`${r.cultivo.rendimiento}-${r.cultivo.precio}`} />}
            <dl className="grid grid-cols-2 gap-3 my-4">
              <div><dt className="text-tinta-2 text-base">Por hectárea</dt><dd className="text-xl font-bold">{pesos(r.porHa)}</dd></div>
              <div><dt className="text-tinta-2 text-base">Total del cultivo</dt><dd className="text-xl font-bold">{pesos(r.total)}</dd></div>
            </dl>
            <div className="grid grid-cols-2 gap-3">
              <NumeroEditable etiqueta="Toneladas por ha que esperas" valor={r.cultivo.rendimiento} paso={0.1} cambiar={(v) => editar(r.cultivo, 'rendimiento', v)} />
              <NumeroEditable etiqueta="Precio que te ofrecen ($/t)" valor={r.cultivo.precio} paso={50} cambiar={(v) => editar(r.cultivo, 'precio', v)} />
            </div>

            {r.cultivo.nombre === 'Maíz' && (
              <div className="mt-4 border-t border-linea pt-4">
                <h3 className="font-bold mb-2">Contra tu zona <span className="text-sm font-bold bg-maiz-claro px-2 rounded">datos de ejemplo</span></h3>
                {!zona && <p>Todavía no hay 5 productores de {p.municipio} para comparar. Así cuidamos que nadie sea identificado.</p>}
                {zona && peor && (
                  <p className="text-lg">Pagas <strong className="text-pierde">{peor.diferencia} % más de {TIPOS[peor.tipo].toLowerCase()}</strong> que el promedio de {p.municipio}.</p>
                )}
                {zona && !peor && <p className="text-lg">Ningún gasto está arriba del promedio de {p.municipio}. Bien.</p>}
                {zona && pago && <TablaZona filas={zona.filas} />}
                {zona && !pago && <p className="text-base text-tinta-2 mt-2"><a href="#/plan" className="font-bold text-campo">Con el plan de pago</a> ves la comparación gasto por gasto.</p>}
                {zona && <p className="text-base text-tinta-2 mt-2">Promedio de {zona.productores} productores. FIRA calcula unos {pesos(FIRA_MAIZ_HA)} por hectárea de maíz; tú vas en {pesos(r.porHa)}.</p>}
              </div>
            )}
          </Seccion>
        )
      })}
    </>
  )
}

/** Cuánto le cuesta la tonelada y si va ganando. */
function Veredicto({ c, costoTon, margenTon }: { c: Cultivo; costoTon: number; margenTon: number }) {
  const titulo = <h2 className="text-xl font-black">{c.nombre} · {c.ha} ha</h2>
  if (c.rendimiento <= 0) return <>{titulo}<p className="mt-2">Escribe cuántas toneladas por hectárea esperas para saber a cómo te sale.</p></>
  const gana = margenTon >= 0
  const toneladas = c.ha * c.rendimiento
  return (
    <div>
      {/* El letrero es la cabecera de la tarjeta, no una tarjeta dentro de otra. */}
      <div className="-mx-4 -mt-4 bg-campo px-5 pt-4 pb-5 text-white">
        <h2 className="text-xl font-black">{c.nombre} · {c.ha} ha</h2>
        <p className="font-senal font-extrabold mt-3 text-white/90">A cómo te sale la tonelada</p>
        <p className="font-senal text-[2.4rem] font-black leading-none mt-1">{pesos(costoTon)}</p>
        <p className={`mt-3 inline-flex items-center gap-2 rounded-lg px-3 py-1 font-senal text-lg font-black ${gana ? 'bg-white text-campo' : 'bg-maiz text-asfalto'}`}>
          {gana ? <TrendingUp size={28} className="shrink-0" aria-hidden /> : <TrendingDown size={28} className="shrink-0" aria-hidden />}
          {gana ? 'Vas ganando' : 'Vas perdiendo'} {pesos(Math.abs(margenTon))} por tonelada
        </p>
      </div>
      <p className="mt-3 text-base text-tinta-2">Unos {pesos(Math.abs(margenTon) * toneladas)} en toda la cosecha, si te pagan {pesos(c.precio)}.</p>

      <Regla costoTon={costoTon} precio={c.precio} />
    </div>
  )
}

function NumeroEditable({ etiqueta, valor, paso, cambiar }: { etiqueta: string; valor: number; paso: number; cambiar: (v: number) => void }) {
  return (
    <label className="block">
      <span className="block text-base text-tinta-2 leading-tight mb-1">{etiqueta}</span>
      <input
        type="number"
        inputMode="decimal"
        min={0}
        step={paso}
        value={valor}
        onChange={(e) => cambiar(Math.max(0, Number(e.target.value)))}
        className="w-full min-h-14 rounded-xl border-2 border-linea bg-hoja px-3 text-lg font-bold focus:border-campo"
      />
    </label>
  )
}

function TablaZona({ filas }: { filas: NonNullable<ReturnType<typeof compararZona>>['filas'] }) {
  return (
    <table className="w-full mt-3 text-base">
      <thead>
        <tr className="text-left text-tinta-2"><th className="font-normal">Por hectárea</th><th className="font-normal text-right">Tú</th><th className="font-normal text-right">Zona</th><th /></tr>
      </thead>
      <tbody>
        {filas.map((f) => (
          <tr key={f.tipo} className="border-t border-linea">
            <td className="py-1">{TIPOS[f.tipo]}</td>
            <td className="text-right">{pesos(f.tuyo)}</td>
            <td className="text-right">{pesos(f.zona)}</td>
            <td className={`text-right font-bold pl-2 ${f.diferencia > 5 ? 'text-pierde' : 'text-tinta-2'}`}>{f.diferencia > 0 ? '+' : ''}{f.diferencia} %</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
