import { useState } from 'react'
import { MapPin, MessageCircle, Package, Plus, Tractor, Trash2, Wrench, Cog } from 'lucide-react'
import type { Props } from '../App'
import { pesos } from '../lib/calculos'
import { reducirFoto } from '../lib/foto'
import { CATEGORIAS, MUNICIPIOS, type Anuncio } from '../lib/datos'
import { Boton, Campo, Entrada, Lista, Opciones, Seccion, Titulo } from '../ui'

const ICONOS: Record<string, typeof Wrench> = { Herramientas: Wrench, Equipo: Cog, Maquinaria: Tractor, Insumos: Package }
const MODOS = { Todo: 'Venta y renta', venta: 'Venta', renta: 'Renta' }

export const linkWhatsApp = (a: Anuncio) =>
  `https://wa.me/52${a.whatsapp}?text=${encodeURIComponent(`Hola ${a.autor}, vi tu anuncio "${a.titulo}" en Mi Ciclo. ¿Sigue disponible?`)}`

export default function Mercado({ d, hacer, ocupado }: Props) {
  const [municipio, setMunicipio] = useState('Todos')
  const [categoria, setCategoria] = useState('Todas')
  const [modo, setModo] = useState('Todo')
  const [publicando, setPublicando] = useState(false)

  const lista = d.anuncios.filter(
    (a) => (municipio === 'Todos' || a.municipio === municipio) && (categoria === 'Todas' || a.categoria === categoria) && (modo === 'Todo' || a.modo === modo),
  )

  return (
    <>
      <Titulo>Mercado del campo</Titulo>
      {publicando ? (
        <Publicar d={d} hacer={hacer} ocupado={ocupado} cerrar={() => setPublicando(false)} />
      ) : (
        <Boton tipo="secundario" onClick={() => setPublicando(true)} className="mb-4"><Plus aria-hidden /> Publicar un anuncio</Boton>
      )}

      <div className="grid grid-cols-2 gap-3 mb-3">
        <Campo etiqueta="Municipio"><Lista opciones={['Todos', ...MUNICIPIOS]} value={municipio} onChange={(e) => setMunicipio(e.target.value)} /></Campo>
        <Campo etiqueta="Venta o renta"><Lista opciones={MODOS} value={modo} onChange={(e) => setModo(e.target.value)} /></Campo>
      </div>
      <div className="mb-4"><Opciones opciones={['Todas', ...CATEGORIAS]} valor={categoria} cambiar={setCategoria} /></div>

      <p className="text-base text-tinta-2 mb-3">{lista.length === 1 ? '1 anuncio' : `${lista.length} anuncios`}. Solo se muestra el municipio, nunca dónde vive cada quien.</p>
      {lista.length === 0 && <p className="text-lg">{d.anuncios.length === 0 ? 'Todavía no hay anuncios. Publica el primero: algo que vendas o rentes.' : 'No hay anuncios con esos filtros. Prueba con “Todos”.'}</p>}
      <ul className="space-y-4">
        {lista.map((a) => {
          const Icono = ICONOS[a.categoria] ?? Package
          return (
            <li key={a.id} className="bg-hoja rounded-xl border border-linea overflow-hidden">
              {a.foto ? (
                <img src={a.foto} alt={a.titulo} loading="lazy" className="w-full h-48 object-cover" />
              ) : (
                <div className="h-28 bg-campo-claro flex items-center justify-center text-campo" aria-hidden><Icono size={56} strokeWidth={1.75} /></div>
              )}
              <div className="p-4">
                <p className="text-sm font-bold uppercase tracking-wide">
                  <span className={a.modo === 'renta' ? 'text-campo' : 'text-tinta-2'}>{a.modo === 'renta' ? 'Se renta' : 'Se vende'}</span> · {a.categoria}
                </p>
                <h2 className="text-lg font-bold leading-tight">{a.titulo}</h2>
                <p className="text-xl font-bold mt-1">{pesos(a.precio)} <span className="text-base font-normal text-tinta-2">{a.unidad}</span></p>
                <p className="flex items-center gap-1 text-tinta-2 mb-3"><MapPin size={18} aria-hidden /> {a.municipio} · {a.autor}</p>
                {a.propio ? (
                  <button disabled={ocupado} onClick={() => confirm(`¿Quitar tu anuncio "${a.titulo}"?`) && hacer('borrarAnuncio', { id: a.id })}
                    className="min-h-14 w-full rounded-xl border-2 border-pierde text-pierde font-bold text-lg flex items-center justify-center gap-2">
                    <Trash2 aria-hidden /> Quitar mi anuncio
                  </button>
                ) : (
                <a
                  href={linkWhatsApp(a)}
                  target="_blank"
                  rel="noreferrer"
                  className="min-h-14 rounded-xl bg-campo text-white font-bold text-lg flex items-center justify-center gap-2 no-underline"
                >
                  <MessageCircle aria-hidden /> Contactar por WhatsApp
                </a>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </>
  )
}

function Publicar({ d, hacer, ocupado, cerrar }: Props & { cerrar: () => void }) {
  const [f, setF] = useState({ titulo: '', categoria: CATEGORIAS[0], modo: 'venta', precio: '', unidad: 'precio total', municipio: d.productor.municipio, whatsapp: '' })
  const [foto, setFoto] = useState<string>()
  const [error, setError] = useState('')
  const set = (campo: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [campo]: e.target.value })

  async function elegirFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0]
    if (!archivo) return
    try { setFoto(await reducirFoto(archivo)); setError('') } catch { setError('No se pudo abrir esa foto. Prueba con otra.') }
  }

  async function publicar(e: React.FormEvent) {
    e.preventDefault()
    if (await hacer('anuncio', { ...f, titulo: f.titulo.trim(), precio: Number(f.precio), foto })) cerrar()
  }

  return (
    <Seccion titulo="Nuevo anuncio">
      <form onSubmit={publicar}>
        <Campo etiqueta="¿Qué ofreces?"><Entrada required maxLength={80} value={f.titulo} onChange={set('titulo')} placeholder="Ej. Aspersora de mochila" /></Campo>
        <Opciones etiqueta="¿Lo vendes o lo rentas?" opciones={['Venta', 'Renta']} valor={f.modo === 'renta' ? 'Renta' : 'Venta'} cambiar={(v) => setF({ ...f, modo: v.toLowerCase(), unidad: v === 'Renta' ? 'por día' : 'precio total' })} />
        <Campo etiqueta="Categoría"><Lista opciones={CATEGORIAS} value={f.categoria} onChange={set('categoria')} /></Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Precio (pesos)"><Entrada required type="number" inputMode="numeric" min={1} value={f.precio} onChange={set('precio')} /></Campo>
          <Campo etiqueta="Cobro"><Lista opciones={['precio total', 'por día', 'por hectárea']} value={f.unidad} onChange={set('unidad')} /></Campo>
        </div>
        <Campo etiqueta="Municipio"><Lista opciones={MUNICIPIOS} value={f.municipio} onChange={set('municipio')} /></Campo>
        <Campo etiqueta="Tu WhatsApp (10 dígitos)">
          <Entrada required type="tel" inputMode="numeric" pattern="[0-9]{10}" title="10 dígitos, sin espacios" value={f.whatsapp} onChange={set('whatsapp')} />
        </Campo>
        <Campo etiqueta="Foto">
          <input type="file" accept="image/*" onChange={elegirFoto} className="block w-full text-base file:min-h-12 file:mr-3 file:rounded-xl file:border-2 file:border-campo file:bg-hoja file:px-4 file:font-bold file:text-campo" />
        </Campo>
        {error && <p role="alert" className="text-pierde font-bold mb-3">{error}</p>}
        {foto && <img src={foto} alt="Vista previa" className="w-full h-40 object-cover rounded-xl mb-4" />}
        <p className="text-base text-tinta-2 mb-3">Los demás solo verán tu municipio y tu nombre.</p>
        <div className="grid grid-cols-2 gap-3">
          <Boton type="button" tipo="secundario" onClick={cerrar}>Cancelar</Boton>
          <Boton type="submit" disabled={ocupado}>{ocupado ? 'Publicando…' : 'Publicar'}</Boton>
        </div>
      </form>
    </Seccion>
  )
}
