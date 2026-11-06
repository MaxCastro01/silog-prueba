import { useState } from 'react'
import { MapPin } from 'lucide-react'
import type { Hacer, Props } from '../App'
import { CULTIVOS, MUNICIPIOS, TIPOS_PUBLICACION, type Publicacion } from '../lib/datos'
import { Area, Boton, Campo, Entrada, Lista, Opciones, Seccion, Titulo, fecha } from '../ui'

export default function Comunidad({ d, hacer, ocupado }: Props) {
  const p = d.productor
  const [municipio, setMunicipio] = useState(p.municipio)
  const [cultivo, setCultivo] = useState('Todos')
  const [tipo, setTipo] = useState(TIPOS_PUBLICACION[0])
  const [nuevoCultivo, setNuevoCultivo] = useState(p.cultivos[0]?.nombre ?? CULTIVOS[0])
  const [texto, setTexto] = useState('')

  const lista = d.publicaciones.filter((x) => (municipio === 'Todos' || x.municipio === municipio) && (cultivo === 'Todos' || x.cultivo === cultivo))

  async function publicar(e: React.FormEvent) {
    e.preventDefault()
    if (!(await hacer('publicacion', { tipo, cultivo: nuevoCultivo, texto: texto.trim() }))) return
    setTexto('')
    setMunicipio(p.municipio)
  }

  return (
    <>
      <Titulo>Comunidad</Titulo>
      <Seccion titulo="Escribe a tus vecinos">
        <form onSubmit={publicar}>
          <Opciones etiqueta="¿Qué es?" opciones={TIPOS_PUBLICACION} valor={tipo} cambiar={setTipo} />
          <Campo etiqueta="Cultivo"><Lista opciones={CULTIVOS} value={nuevoCultivo} onChange={(e) => setNuevoCultivo(e.target.value)} /></Campo>
          <Campo etiqueta="Mensaje"><Area required maxLength={500} value={texto} onChange={(e) => setTexto(e.target.value)} /></Campo>
          <p className="text-base text-tinta-2 mb-3">Se publica en {p.municipio}, con tu nombre.</p>
          <Boton type="submit" disabled={ocupado}>{ocupado ? 'Publicando…' : 'Publicar'}</Boton>
        </form>
      </Seccion>

      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta="Municipio"><Lista opciones={['Todos', ...MUNICIPIOS]} value={municipio} onChange={(e) => setMunicipio(e.target.value)} /></Campo>
        <Campo etiqueta="Cultivo"><Lista opciones={['Todos', ...CULTIVOS]} value={cultivo} onChange={(e) => setCultivo(e.target.value)} /></Campo>
      </div>
      {lista.length === 0 && <p className="text-lg mb-4">Nadie ha escrito aquí todavía. Sé el primero.</p>}
      <ul className="space-y-4">
        {lista.map((x) => <Tarjeta key={x.id} x={x} hacer={hacer} ocupado={ocupado} />)}
      </ul>
    </>
  )
}

function Tarjeta({ x, hacer, ocupado }: { x: Publicacion; hacer: Hacer; ocupado: boolean }) {
  const [r, setR] = useState('')
  const plaga = x.tipo === 'Aviso de plaga'
  return (
    <li className="bg-hoja rounded-xl border border-linea p-4">
      <p className={`text-sm font-bold uppercase tracking-wide ${plaga ? 'text-pierde' : 'text-campo'}`}>{x.tipo} · {x.cultivo}</p>
      <p className="text-lg my-1">{x.texto}</p>
      <p className="text-base text-tinta-2 flex items-center gap-1"><MapPin size={16} aria-hidden /> {x.municipio} · {x.autor} · {fecha(x.fecha)}</p>
      {x.respuestas.length > 0 && (
        <ul className="mt-3 space-y-2 border-t border-linea pt-3">
          {x.respuestas.map((y, i) => <li key={i}><strong>{y.autor}:</strong> {y.texto}</li>)}
        </ul>
      )}
      <form className="mt-3 flex gap-2" onSubmit={async (e) => { e.preventDefault(); if (await hacer('respuesta', { publicacion: x.id, texto: r.trim() })) setR('') }}>
        <Entrada required maxLength={300} value={r} onChange={(e) => setR(e.target.value)} placeholder="Responder" aria-label="Tu respuesta" />
        <button type="submit" disabled={ocupado} className="min-h-14 rounded-xl bg-campo text-white font-bold px-4 disabled:opacity-50">Enviar</button>
      </form>
    </li>
  )
}
