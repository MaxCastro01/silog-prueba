import { Download, Lock, Printer } from 'lucide-react'
import type { Props } from '../App'
import { expedienteCSV, gastoPorCultivo, haTotal, pesos, tienePlanPago } from '../lib/calculos'
import { TIPOS, type Tipo } from '../lib/datos'
import { Boton, BotonLink, Seccion, Titulo, fechaHora } from '../ui'

export default function Expediente({ d }: Props) {
  const p = d.productor
  if (!tienePlanPago(p)) {
    return (
      <>
        <Titulo>Expediente</Titulo>
        <Seccion>
          <p className="flex items-center gap-2 text-lg font-bold mb-2"><Lock aria-hidden /> Es parte del plan de pago</p>
          <p className="mb-3">Junta en un solo papel lo que el banco o la aseguradora te piden:</p>
          <ul className="list-disc pl-6 space-y-1 mb-4">
            <li>Tus costos por cultivo y por tipo de gasto.</li>
            <li>A cómo te sale la hectárea y la tonelada.</li>
            <li>Tu bitácora con fechas que no se pueden cambiar.</li>
            <li>Para descargar en Excel (CSV) o imprimir.</li>
          </ul>
          <BotonLink href="#/plan">Ver mi plan</BotonLink>
        </Seccion>
      </>
    )
  }

  const filas = gastoPorCultivo(p, d.gastos)
  function descargar() {
    // El BOM hace que Excel lea bien los acentos.
    const url = URL.createObjectURL(new Blob(['﻿' + expedienteCSV(d)], { type: 'text/csv;charset=utf-8' }))
    const a = Object.assign(document.createElement('a'), { href: url, download: `expediente-${p.temporada.replace(/\s+/g, '-')}.csv` })
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <Titulo>Expediente de costos</Titulo>
      <div className="no-imprimir grid gap-3 mb-4">
        <Boton tipo="secundario" onClick={descargar}><Download aria-hidden /> Descargar CSV (Excel)</Boton>
        <Boton tipo="secundario" onClick={() => print()}><Printer aria-hidden /> Imprimir o guardar PDF</Boton>
      </div>

      <Seccion>
        <dl className="grid grid-cols-2 gap-2">
          <div><dt className="text-base text-tinta-2">Productor</dt><dd className="font-bold">{p.nombre}</dd></div>
          <div><dt className="text-base text-tinta-2">Municipio</dt><dd className="font-bold">{p.municipio}, Sinaloa</dd></div>
          <div><dt className="text-base text-tinta-2">Temporada</dt><dd className="font-bold">{p.temporada}</dd></div>
          <div><dt className="text-base text-tinta-2">Superficie</dt><dd className="font-bold">{haTotal(p)} ha</dd></div>
        </dl>
        <p className="text-base text-tinta-2 mt-2">Generado el {fechaHora(new Date().toISOString())}</p>
      </Seccion>

      <Seccion titulo="Costos por cultivo">
        <div className="overflow-x-auto">
          <table className="w-full text-[0.8rem]">
            <thead>
              <tr className="text-left"><th className="py-1">Gasto</th>{filas.map((r) => <th key={r.cultivo.nombre} className="text-right">{r.cultivo.nombre}<span className="block font-normal text-tinta-2">{r.cultivo.ha} ha</span></th>)}</tr>
            </thead>
            <tbody>
              {(Object.keys(TIPOS) as Tipo[]).map((t) => (
                <tr key={t} className="border-t border-linea">
                  <td className="py-1">{TIPOS[t]}</td>
                  {filas.map((r) => <td key={r.cultivo.nombre} className="text-right">{pesos(r.porTipo[t])}</td>)}
                </tr>
              ))}
              <tr className="border-t-2 border-tinta font-bold"><td className="py-1">Total</td>{filas.map((r) => <td key={r.cultivo.nombre} className="text-right">{pesos(r.total)}</td>)}</tr>
              <tr><td className="py-1">Por hectárea</td>{filas.map((r) => <td key={r.cultivo.nombre} className="text-right">{pesos(r.porHa)}</td>)}</tr>
              <tr><td className="py-1">Por tonelada</td>{filas.map((r) => <td key={r.cultivo.nombre} className="text-right">{pesos(r.costoTon)}</td>)}</tr>
            </tbody>
          </table>
        </div>
        <p className="text-base text-tinta-2 mt-2">Los gastos generales se repartieron según las hectáreas de cada cultivo.</p>
      </Seccion>

      <Seccion titulo="Bitácora">
        <ol className="divide-y divide-linea">
          {[...d.bitacora].sort((a, b) => a.creado.localeCompare(b.creado)).map((n) => (
            <li key={n.id} className="py-2">
              <span className="text-base text-tinta-2">{fechaHora(n.creado)} · {n.cultivo}</span>
              <p><strong>{n.tipo}:</strong> {n.texto}</p>
            </li>
          ))}
        </ol>
      </Seccion>
    </>
  )
}
