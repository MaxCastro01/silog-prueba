import { Check, ChevronRight, FileText, LogOut, MessageCircleQuestion, MessagesSquare, Plus, Signpost, Tag, Trash2, Wallet } from 'lucide-react'
import type { Props } from '../App'
import { cuenta } from '../lib/api'
import { Seccion, Titulo } from '../ui'

export default function Mas({ d, hacer, ocupado, salir }: Props & { salir: () => void }) {
  const opciones = [
    { href: '#/preguntale', texto: 'Pregúntale a tus números', detalle: '¿En qué gasté más? ¿Me conviene rentar?', Icono: MessageCircleQuestion },
    { href: '#/comunidad', texto: 'Comunidad', detalle: 'Dudas, avisos de plaga y consejos', Icono: MessagesSquare },
    { href: '#/expediente', texto: 'Expediente', detalle: 'Tus costos y bitácora para crédito o seguro', Icono: FileText },
    { href: '#/plan', texto: 'Mi plan', detalle: 'Precio de tu temporada', Icono: Wallet },
    { href: '#/ofertas', texto: 'Ofertas de tiendas', detalle: 'Descuentos en tu municipio', Icono: Tag },
    { href: '#/portada', texto: 'Qué es Mi Ciclo', detalle: 'La portada con la calculadora y las tarifas', Icono: Signpost },
  ]

  async function borrarTodo() {
    if (confirm('¿Borrar todos tus ciclos, gastos, bitácora, anuncios y publicaciones? No se puede deshacer. Tu cuenta se queda.')) {
      if (await hacer('borrarTodo')) location.hash = '#/inicio'
    }
  }
  async function cerrar() {
    await cuenta({ accion: 'salir' }).catch(() => {})
    salir()
  }

  return (
    <>
      <Titulo>Más</Titulo>
      <ul className="bg-hoja rounded-xl border border-linea divide-y divide-linea mb-6">
        {opciones.map(({ href, texto, detalle, Icono }) => (
          <li key={href}>
            <a href={href} className="flex items-center gap-3 p-4 min-h-18 no-underline text-tinta">
              <Icono size={28} className="text-campo shrink-0" aria-hidden />
              <span className="flex-1"><strong className="block text-lg">{texto}</strong><span className="text-base text-tinta-2">{detalle}</span></span>
              <ChevronRight aria-hidden className="text-tinta-2" />
            </a>
          </li>
        ))}
      </ul>

      <Seccion titulo="Mis ciclos">
        <ul className="divide-y divide-linea mb-3">
          {d.ciclos.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 py-2 min-h-14">
              <span className="text-lg font-bold">{c.temporada}</span>
              {c.activo
                ? <span className="flex items-center gap-1 text-campo font-bold"><Check size={20} aria-hidden /> Abierto</span>
                : <button disabled={ocupado} onClick={() => hacer('elegirCiclo', { id: c.id })} className="min-h-12 px-4 rounded-xl border-2 border-campo text-campo font-bold">Abrir</button>}
            </li>
          ))}
        </ul>
        <a href="#/registro" className="flex items-center gap-2 text-campo font-bold min-h-12"><Plus size={22} aria-hidden /> Empezar otro ciclo</a>
      </Seccion>

      <Seccion titulo="Mi cuenta">
        <p className="mb-3">{d.usuario.nombre} · {d.usuario.municipio}<span className="block text-base text-tinta-2">Usuario: {d.usuario.usuario}</span></p>
        <button onClick={cerrar} className="flex items-center gap-2 text-campo font-bold min-h-12"><LogOut size={22} aria-hidden /> Salir</button>
        <button onClick={borrarTodo} disabled={ocupado} className="flex items-center gap-2 text-left text-pierde font-bold min-h-12"><Trash2 size={22} aria-hidden /> Borrar todo y empezar de cero</button>
      </Seccion>
    </>
  )
}
