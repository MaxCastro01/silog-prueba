import { useState } from 'react'
import { Sparkles, TrendingDown, TrendingUp } from 'lucide-react'
import { compararZona, pesos, type gastoPorCultivo } from '../lib/calculos'
import { TIPOS, type Datos } from '../lib/datos'
import { ErrorIA, pedirIA, planEjemplo, validarPlan } from '../lib/ia'
import type { Salida } from '../lib/ia-tareas'
import { accionesPosibles, palancas, simular } from '../lib/palancas'
import { Boton, Regla } from '../ui'

type Fila = ReturnType<typeof gastoPorCultivo>[number]

const COLOR_CERTEZA = { seguro: 'bg-campo text-white', probable: 'bg-campo-claro text-campo', 'depende de ti': 'bg-maiz-claro text-tinta' }

export default function PonteEnVerde({ d, r }: { d: Datos; r: Fila }) {
  const c = r.cultivo
  const [estado, setEstado] = useState<'cerrado' | 'cargando' | 'listo'>('cerrado')
  const [plan, setPlan] = useState<Salida<'plan'> & { ejemplo: boolean; local: boolean }>()
  const [error, setError] = useState('')
  const [activas, setActivas] = useState<string[]>([])

  const acciones = accionesPosibles(r, d.productor.municipio, d.gastos, d.anuncios)
  const lev = palancas(r.porHa, c.rendimiento, c.precio)
  const plaga = d.bitacora.some((n) => n.tipo === 'Plaga' && n.cultivo === c.nombre)

  async function pedirPlan() {
    setEstado('cargando')
    setError('')
    const zona = compararZona(d.productor.municipio, r)
    try {
      // Solo números y categorías: ni nombre, ni teléfono, ni municipio.
      const { datos, ejemplo, local } = await pedirIA('plan', {
        cultivo: c.nombre,
        hectareas: c.ha,
        gastoPorHectarea: (Object.keys(TIPOS) as (keyof typeof TIPOS)[]).map((t) => ({ tipo: TIPOS[t], tuyo: Math.round(r.porTipo[t] / c.ha), zona: zona?.filas.find((f) => f.tipo === t)?.zona ?? null })),
        faltaPorHectarea: Math.round(lev.bajarHa),
        acciones: acciones.map(({ id, titulo, certeza, fuente }) => ({ id, titulo, certeza, fuente })),
        bitacora: d.bitacora.filter((n) => n.cultivo === c.nombre).map((n) => ({ tipo: n.tipo, fecha: n.creado.slice(0, 10) })),
      }, () => planEjemplo(acciones), (p) => { try { return Boolean(validarPlan(p, acciones)) } catch { return false } }) // si no pasa la validación, se reintenta una vez
      setPlan({ ...validarPlan(datos, acciones), ejemplo, local })
      setEstado('listo')
    } catch (e) {
      setError(e instanceof ErrorIA ? e.message : 'No se pudo armar el plan. Intenta otra vez.')
      setEstado('cerrado')
    }
  }

  if (estado !== 'listo' || !plan) {
    return (
      <div className="mt-2">
        <Boton tipo="maiz" onClick={pedirPlan} disabled={estado === 'cargando'}>
          <Sparkles aria-hidden /> {estado === 'cargando' ? 'Armando tu plan…' : 'Ponte en verde'}
        </Boton>
        {error && <p role="alert" className="text-pierde font-bold mt-2">{error}</p>}
      </div>
    )
  }

  const sim = simular(r, acciones, activas)
  const sinNada = simular(r, acciones, [])
  const todo = simular(r, acciones, acciones.map((a) => a.id))
  const rango: [number, number] = [Math.min(todo.costoTon, sinNada.precio) * 0.9, Math.max(sinNada.costoTon, todo.precio) * 1.1]
  const gana = sim.margenTon >= 0
  const alternar = (id: string) => setActivas((x) => (x.includes(id) ? x.filter((y) => y !== id) : [...x, id]))

  return (
    <div className="mt-4 border-t-2 border-maiz pt-4">
      <h3 className="text-lg font-bold">Ponte en verde</h3>
      <p className="mb-2">Para quedar en cero necesitas <strong>una</strong> de estas:</p>
      <ul className="list-disc pl-6 mb-4 space-y-1">
        <li>Gastar {pesos(lev.bajarHa)} menos por hectárea ({lev.bajarPct.toFixed(1)} %).</li>
        <li>Sacar {lev.toneladasHa.toFixed(1)} toneladas por hectárea con el mismo gasto.</li>
        <li>Vender a {pesos(lev.precioMinimo)} la tonelada.</li>
      </ul>

      <p className="text-sm font-bold uppercase tracking-wide mb-1">
        {plan.ejemplo ? <span className="bg-maiz px-2 rounded">Ejemplo</span> : <span className="text-campo">{plan.local ? 'Sugerido por IA local' : 'Sugerido por IA'}</span>}
      </p>
      <p className="mb-3">{plan.resumen}</p>
      {plaga && <p className="mb-3 font-bold">Viste plaga en tu {c.nombre.toLowerCase()}: consulta a un agrónomo o a la junta local de sanidad vegetal.</p>}

      <p className="text-base text-tinta-2 mb-2">Marca lo que sí harías:</p>
      <ul className="space-y-3 mb-4">
        {plan.acciones.map(({ id, texto }) => {
          const a = acciones.find((x) => x.id === id)!
          const activa = activas.includes(id)
          return (
            <li key={id}>
              <label className={`flex gap-3 rounded-xl border-2 p-3 cursor-pointer ${activa ? 'border-campo bg-campo-claro' : 'border-linea bg-hoja'}`}>
                <input type="checkbox" checked={activa} onChange={() => alternar(id)} className="size-7 shrink-0 mt-0.5" />
                <span>
                  <span className="block font-bold">{texto}</span>
                  <span className="block">Podrías ahorrar de {pesos(a.ahorroMin)} a {pesos(a.ahorroMax)}</span>
                  <span className="flex flex-wrap gap-2 mt-1 text-sm">
                    <span className={`px-2 rounded font-bold ${COLOR_CERTEZA[a.certeza]}`}>{a.certeza}</span>
                    <span className="text-tinta-2">Dato: {a.fuente}</span>
                  </span>
                </span>
              </label>
              {a.anuncio && <a href="#/mercado" className="inline-block mt-1 ml-3 font-bold text-campo">Ver la sembradora en el mercado</a>}
            </li>
          )
        })}
      </ul>

      <div aria-live="polite">
        <p className={`text-xl font-bold flex items-center gap-2 ${gana ? 'text-gana' : 'text-pierde'}`}>
          {gana ? <TrendingUp size={32} className="shrink-0" aria-hidden /> : <TrendingDown size={32} className="shrink-0" aria-hidden />}
          {activas.length === 0 ? 'Así vas hoy' : gana ? `Así quedarías ganando ${pesos(sim.margenTon)} por tonelada` : `Así todavía pierdes ${pesos(-sim.margenTon)} por tonelada`}
        </p>
      </div>
      <Regla costoTon={sim.costoTon} precio={sim.precio} rango={rango} etiqueta={sim.precio > c.precio ? 'Recibirías' : 'Te ofrecen'} />
      <p className="text-base text-tinta-2">Cuenta la mitad de cada rango. Si dos acciones bajan el mismo gasto, solo cuenta la mayor. Tú decides: esto es una sugerencia.</p>
    </div>
  )
}
