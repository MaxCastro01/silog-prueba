import type { ComponentProps, ReactNode } from 'react'
import { pesos } from './lib/calculos'

export const fechaHora = (iso: string) => new Date(iso).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })
// Mediodía para que la zona horaria no mueva el día.
export const fecha = (dia: string) => new Date(dia + 'T12:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })

export function Titulo({ children }: { children: ReactNode }) {
  return <h1 className="text-[1.6rem] font-bold leading-tight text-balance mt-2 mb-4">{children}</h1>
}

export function Seccion({ titulo, children, className = '' }: { titulo?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`bg-hoja rounded-xl border border-linea p-4 mb-4 ${className}`}>
      {titulo && <h2 className="text-lg font-bold mb-3">{titulo}</h2>}
      {children}
    </section>
  )
}

const estilos = {
  principal: 'bg-campo text-white hover:bg-[#164426]',
  secundario: 'bg-hoja text-campo border-2 border-campo hover:bg-campo-claro',
  maiz: 'bg-maiz text-tinta hover:bg-[#d9a313]',
}

export function Boton({ tipo = 'principal', className = '', ...p }: ComponentProps<'button'> & { tipo?: keyof typeof estilos }) {
  return (
    <button
      {...p}
      className={`min-h-14 w-full rounded-xl px-4 text-lg font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 ${estilos[tipo]} ${className}`}
    />
  )
}

export function BotonLink({ tipo = 'principal', className = '', ...p }: ComponentProps<'a'> & { tipo?: keyof typeof estilos }) {
  return (
    <a
      {...p}
      className={`min-h-14 w-full rounded-xl px-4 text-lg font-bold flex items-center justify-center gap-2 no-underline transition-colors ${estilos[tipo]} ${className}`}
    />
  )
}

const control = 'w-full min-h-14 rounded-xl border-2 border-linea bg-hoja px-3 text-lg focus:border-campo'

export function Campo({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <label className="block mb-4">
      <span className="block font-bold mb-1">{etiqueta}</span>
      {children}
    </label>
  )
}

export const Entrada = (p: ComponentProps<'input'>) => <input {...p} className={`${control} ${p.className ?? ''}`} />
export const Area = (p: ComponentProps<'textarea'>) => <textarea rows={3} {...p} className={`${control} py-2 ${p.className ?? ''}`} />

export function Lista({ opciones, ...p }: ComponentProps<'select'> & { opciones: readonly string[] | Record<string, string> }) {
  const pares = Array.isArray(opciones) ? opciones.map((o) => [o, o]) : Object.entries(opciones)
  return (
    <select {...p} className={`${control} ${p.className ?? ''}`}>
      {pares.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
    </select>
  )
}

/** Botones grandes para escoger una opción; más fácil que una lista para pocas opciones. */
export function Opciones({ opciones, valor, cambiar, etiqueta }: { opciones: readonly string[]; valor: string; cambiar: (v: string) => void; etiqueta?: string }) {
  const grupo = (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={etiqueta}>
      {opciones.map((o) => (
        <button
          key={o}
          type="button"
          role="radio"
          aria-checked={valor === o}
          onClick={() => cambiar(o)}
          className={`min-h-12 rounded-full px-4 font-bold border-2 ${valor === o ? 'bg-campo text-white border-campo' : 'bg-hoja text-tinta border-linea'}`}
        >
          {o}
        </button>
      ))}
    </div>
  )
  return etiqueta ? <div className="mb-4"><p className="font-bold mb-1" aria-hidden>{etiqueta}</p>{grupo}</div> : grupo
}

/** Siempre dice "Oferta": es publicidad pagada por la tienda. */
export function TarjetaOferta({ tienda, municipio, texto }: { tienda: string; municipio: string; texto: string }) {
  return (
    <aside className="rounded-xl border-2 border-maiz bg-maiz-claro p-4 mb-4">
      <span className="inline-block rounded bg-maiz px-2 text-sm font-bold uppercase tracking-wide">Oferta</span>
      <p className="font-bold mt-2">{tienda} · {municipio}</p>
      <p>{texto}</p>
    </aside>
  )
}

/** La regla: desde qué precio ganas y dónde está el precio que te ofrecen. */
export function Regla({ costoTon, precio, rango, etiqueta = 'Te ofrecen' }: { costoTon: number; precio: number; rango?: [number, number]; etiqueta?: string }) {
  // Con rango fijo se ve cómo se mueven las marcas.
  const [lo, hi] = rango ?? [Math.min(costoTon, precio) * 0.8, Math.max(costoTon, precio) * 1.2]
  const f = (v: number) => (v - lo) / (hi - lo)
  const pos = (v: number) => `${f(v) * 100}%`
  return (
    <div className="relative mt-10 mb-12" aria-hidden>
      <div className="h-4 rounded-full overflow-hidden flex">
        <div className="bg-pierde-claro transition-[width] duration-500 ease-out" style={{ width: pos(costoTon) }} />
        <div className="bg-campo-claro flex-1" />
      </div>
      <div className="absolute -top-8 h-[3.25rem] border-l-[3px] border-tinta transition-[left] duration-500 ease-out" style={{ left: pos(costoTon) }}>
        <span className={`absolute -top-1 whitespace-nowrap text-sm font-bold ${f(costoTon) > 0.4 ? 'right-1' : 'left-1'}`}>Desde aquí ganas</span>
      </div>
      <div className="absolute top-[-0.25rem] size-6 -ml-3 rounded-full bg-maiz border-[3px] border-tinta transition-[left] duration-500 ease-out" style={{ left: pos(precio) }}>
        <span className={`absolute top-7 whitespace-nowrap text-sm font-bold ${f(precio) > 0.5 ? 'right-0' : 'left-0'}`}>{etiqueta} {pesos(precio)}</span>
      </div>
    </div>
  )
}

/** Escudo de carretera federal con el nombre: la marca de Mi Ciclo. */
export function Escudo({ ancho = 64 }: { ancho?: number }) {
  return (
    <svg width={ancho} height={ancho * 1.1} viewBox="0 0 100 110" role="img" aria-label="Mi Ciclo, Sinaloa" className="font-senal">
      <path d="M10 4h80q6 0 6 6v30q0 42-46 66Q4 82 4 40V10q0-6 6-6Z" fill="#fff" stroke="var(--color-asfalto)" strokeWidth="4" />
      <text x="50" y="36" textAnchor="middle" fontSize="22" fontWeight="900" fill="var(--color-campo)">MI</text>
      <text x="50" y="60" textAnchor="middle" fontSize="22" fontWeight="900" fill="var(--color-campo)">CICLO</text>
      <text x="50" y="78" textAnchor="middle" fontSize="10.5" fontWeight="800" letterSpacing="1.5" fill="var(--color-asfalto)">SINALOA</text>
    </svg>
  )
}
