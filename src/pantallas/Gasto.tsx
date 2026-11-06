import { useState } from 'react'
import { Camera, Check, Trash2 } from 'lucide-react'
import type { Props } from '../App'
import { ofertaPara, pesos } from '../lib/calculos'
import { GENERAL, TIPOS, type Gasto as TGasto, type Oferta, type Tipo } from '../lib/datos'
import { reducirFoto } from '../lib/foto'
import { ErrorIA, limpiarGasto, pedirIA } from '../lib/ia'
import type { Entrada as EntradaIA, Salida } from '../lib/ia-tareas'
import { Boton, Campo, Entrada, Lista, Seccion, TarjetaOferta, Titulo, fecha } from '../ui'
import Dictado from './Dictado'

const hoy = () => new Date().toLocaleDateString('en-CA')
const vacio = () => ({ concepto: '', monto: '', tipo: 'diesel' as Tipo, fecha: hoy(), cultivo: GENERAL })

export default function Gasto({ d, hacer, ocupado }: Props) {
  const [f, setF] = useState(vacio)
  const [leyendo, setLeyendo] = useState('')
  const [aviso, setAviso] = useState('')
  const [error, setError] = useState('')
  const [guardado, setGuardado] = useState<{ gasto: Omit<TGasto, 'id'>; oferta: Oferta | null } | null>(null)
  const cultivos = [GENERAL, ...d.productor.cultivos.map((c) => c.nombre)]
  const set = (campo: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [campo]: e.target.value })

  // La IA llena el formulario; el productor revisa y confirma con "Guardar gasto".
  async function llenarConIA(mensaje: string, entrada: Pick<EntradaIA<'gasto'>, 'texto' | 'imagen'>, ejemplo: Salida<'gasto'>) {
    setLeyendo(mensaje)
    setError('')
    setGuardado(null)
    try {
      const r = await pedirIA('gasto', { ...entrada, cultivos: cultivos.slice(1), hoy: hoy() }, () => ejemplo)
      setF(limpiarGasto(r.datos, cultivos, hoy()))
      setAviso(r.ejemplo ? 'Ejemplo: sin IA conectada se llenan datos fijos. Revisa y corrige antes de guardar.' : r.local ? 'Lo llenó la IA local. Revisa que esté bien antes de guardar.' : 'Lo llenó la IA. Revisa que esté bien antes de guardar.')
    } catch (e) {
      setError(e instanceof ErrorIA ? e.message : 'No se pudo leer. Captúralo a mano.')
    } finally {
      setLeyendo('')
    }
  }

  async function leerFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0]
    e.target.value = ''
    if (!archivo) return
    const foto = await reducirFoto(archivo, 1280).catch(() => '')
    if (!foto) return setError('No se pudo abrir esa foto. Prueba con otra.')
    llenarConIA('Leyendo la nota…', { imagen: foto.split(',')[1] }, { concepto: 'Diésel, 400 litros', monto: 9840, tipo: 'diesel', fecha: hoy(), cultivo: GENERAL })
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    const gasto = { concepto: f.concepto.trim(), monto: Number(f.monto), tipo: f.tipo, fecha: f.fecha, cultivo: f.cultivo }
    if (!(await hacer('gasto', gasto))) return
    setGuardado({ gasto, oferta: ofertaPara(gasto.tipo, d.productor) })
    setF(vacio())
    setAviso('')
    scrollTo(0, 0)
  }

  return (
    <>
      <Titulo>Registrar gasto</Titulo>

      {guardado && (
        <div role="status">
          <Seccion className="border-2 border-campo">
            <p className="flex items-center gap-2 text-lg font-bold text-campo"><Check aria-hidden /> Gasto guardado</p>
            <p>{guardado.gasto.concepto}: {pesos(guardado.gasto.monto)}</p>
            <a href="#/inicio" className="font-bold text-campo">Ver mis números</a>
          </Seccion>
          {guardado.oferta && <TarjetaOferta {...guardado.oferta} />}
        </div>
      )}

      <label className={`min-h-14 w-full rounded-xl px-4 text-lg font-bold flex items-center justify-center gap-2 mb-2 bg-maiz text-tinta cursor-pointer ${leyendo ? 'opacity-50 pointer-events-none' : ''}`}>
        <Camera aria-hidden /> {leyendo || 'Leer foto de la nota'}
        <input type="file" accept="image/*" capture="environment" onChange={leerFoto} className="sr-only" />
      </label>
      <Dictado ejemplo="Ej. 800 de diésel" ocupado={Boolean(leyendo)} entender={(texto) =>
        llenarConIA('Entendiendo…', { texto }, { concepto: 'Diésel para el tractor', monto: 800, tipo: 'diesel', fecha: hoy(), cultivo: GENERAL })} />
      {leyendo && <p role="status" className="font-bold mb-4">{leyendo}</p>}
      {aviso && <p role="status" className="font-bold mb-4 bg-maiz-claro rounded-xl p-3">{aviso}</p>}
      {error && <p role="alert" className="text-pierde font-bold mb-4">{error}</p>}

      <form onSubmit={guardar}>
        <Campo etiqueta="¿Qué compraste o pagaste?">
          <Entrada required value={f.concepto} onChange={set('concepto')} placeholder="Ej. Diésel para el tractor" />
        </Campo>
        <Campo etiqueta="¿Cuánto fue? (pesos)">
          <Entrada required type="number" inputMode="numeric" min={1} step="any" value={f.monto} onChange={set('monto')} />
        </Campo>
        <Campo etiqueta="Tipo de gasto">
          <Lista opciones={TIPOS} value={f.tipo} onChange={set('tipo')} />
        </Campo>
        <Campo etiqueta="¿A qué cultivo va?">
          <Lista opciones={cultivos} value={f.cultivo} onChange={set('cultivo')} />
          {f.cultivo === GENERAL && <span className="block text-base text-tinta-2 mt-1">Se reparte entre tus cultivos según sus hectáreas.</span>}
        </Campo>
        <Campo etiqueta="Fecha">
          <Entrada required type="date" value={f.fecha} onChange={set('fecha')} />
        </Campo>
        <Boton type="submit" disabled={ocupado}>{ocupado ? 'Guardando…' : 'Guardar gasto'}</Boton>
      </form>

      <h2 className="text-lg font-bold mt-8 mb-2">Tus gastos de {d.productor.temporada}</h2>
      {d.gastos.length === 0 && <p>Todavía no hay gastos en este ciclo.</p>}
      {d.gastos.length > 0 && (
        <ul className="divide-y divide-linea bg-hoja rounded-xl border border-linea">
          {d.gastos.map((g) => (
            <li key={g.id} className="p-3 flex items-center gap-3">
              <span className="flex-1">{g.concepto}<span className="block text-base text-tinta-2">{TIPOS[g.tipo]} · {g.cultivo} · {fecha(g.fecha)}</span></span>
              <span className="font-bold whitespace-nowrap">{pesos(g.monto)}</span>
              <button disabled={ocupado} onClick={() => confirm(`¿Borrar "${g.concepto}" de ${pesos(g.monto)}?`) && hacer('borrarGasto', { id: g.id })}
                className="size-12 shrink-0 flex items-center justify-center rounded-xl text-tinta-2 hover:text-pierde" aria-label={`Borrar ${g.concepto}`}>
                <Trash2 size={22} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
