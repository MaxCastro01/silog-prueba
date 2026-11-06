import { useState } from 'react'
import { Lock } from 'lucide-react'
import type { Props } from '../App'
import { GENERAL, TIPOS_NOTA } from '../lib/datos'
import { ErrorIA, pedirIA } from '../lib/ia'
import { Area, Boton, Campo, Lista, Opciones, Titulo, fechaHora } from '../ui'
import Dictado from './Dictado'

export default function Bitacora({ d, hacer, ocupado }: Props) {
  const [tipo, setTipo] = useState(TIPOS_NOTA[0])
  const [cultivo, setCultivo] = useState(d.productor.cultivos[0]?.nombre ?? GENERAL)
  const [texto, setTexto] = useState('')
  const [entendiendo, setEntendiendo] = useState(false)
  const [aviso, setAviso] = useState('')
  const nombres = d.productor.cultivos.map((c) => c.nombre)

  // La IA llena la nota; el productor revisa y confirma con "Guardar en la bitácora".
  async function entender(dicho: string) {
    setEntendiendo(true)
    try {
      const r = await pedirIA('bitacora', { texto: dicho, cultivos: nombres }, () => ({ tipo: 'Riego', cultivo: nombres[0] ?? GENERAL, texto: 'Riego en la parcela.' }))
      setTipo(r.datos.tipo)
      setCultivo(nombres.includes(r.datos.cultivo) ? r.datos.cultivo : GENERAL)
      setTexto(r.datos.texto.slice(0, 300))
      setAviso(r.ejemplo ? 'Ejemplo: sin IA conectada se llena una nota fija. Revísala antes de guardar.' : r.local ? 'Lo llenó la IA local. Revisa que esté bien antes de guardar.' : 'Lo llenó la IA. Revisa que esté bien antes de guardar.')
    } catch (e) {
      setAviso(e instanceof ErrorIA ? e.message : 'No se pudo entender. Escríbelo abajo.')
    } finally {
      setEntendiendo(false)
    }
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    // La fecha la pone la base de datos al guardar; ni la app ni nadie la puede cambiar después.
    if (!(await hacer('nota', { tipo, cultivo, texto: texto.trim() }))) return
    setTexto('')
    setAviso('')
  }

  const notas = [...d.bitacora].sort((a, b) => b.creado.localeCompare(a.creado))

  return (
    <>
      <Titulo>Bitácora</Titulo>
      <Dictado ejemplo="Ej. regué el maíz" ocupado={entendiendo} entender={entender} />
      {entendiendo && <p role="status" className="font-bold mb-4">Entendiendo…</p>}
      {aviso && <p role="status" className="font-bold mb-4 bg-maiz-claro rounded-xl p-3">{aviso}</p>}
      <form onSubmit={guardar} className="mb-6">
        <Opciones etiqueta="¿Qué pasó?" opciones={TIPOS_NOTA} valor={tipo} cambiar={setTipo} />
        <Campo etiqueta="Cultivo">
          <Lista opciones={[...d.productor.cultivos.map((c) => c.nombre), GENERAL]} value={cultivo} onChange={(e) => setCultivo(e.target.value)} />
        </Campo>
        <Campo etiqueta="Nota">
          <Area required maxLength={500} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Ej. Primer riego de auxilio" />
        </Campo>
        <p className="text-base text-tinta-2 mb-3 flex gap-2"><Lock size={20} className="shrink-0 mt-0.5" aria-hidden /> La fecha y la hora se ponen solas al guardar y ya no se pueden cambiar.</p>
        <Boton type="submit" disabled={ocupado}>{ocupado ? 'Guardando…' : 'Guardar en la bitácora'}</Boton>
      </form>

      {notas.length === 0 && <p>Todavía no hay notas en este ciclo.</p>}
      <ol className="space-y-3">
        {notas.map((n) => (
          <li key={n.id} className="bg-hoja rounded-xl border border-linea p-4">
            <p className="flex justify-between gap-2 text-base text-tinta-2">
              <span className="flex items-center gap-1"><Lock size={16} aria-label="Fecha fija" /> {fechaHora(n.creado)}</span>
              <span>{n.cultivo}</span>
            </p>
            <p className="font-bold text-lg">{n.tipo}</p>
            <p>{n.texto}</p>
          </li>
        ))}
      </ol>
    </>
  )
}
