import type { Props } from '../App'
import { tienePlanPago } from '../lib/calculos'
import { OFERTAS } from '../lib/datos'
import { Seccion, TarjetaOferta, Titulo } from '../ui'

export default function Ofertas({ d }: Props) {
  const p = d.productor
  if (tienePlanPago(p)) return <><Titulo>Ofertas de tiendas</Titulo><Seccion>Tu plan es sin anuncios.</Seccion></>
  const lista = [...OFERTAS].sort((a, b) => Number(b.municipio === p.municipio) - Number(a.municipio === p.municipio))
  return (
    <>
      <Titulo>Ofertas de tiendas</Titulo>
      <p className="text-base text-tinta-2 mb-4">Las tiendas pagan por aparecer aquí. Así tu plan es gratis. Las ofertas son de ejemplo.</p>
      {lista.map((o) => <TarjetaOferta key={o.id} {...o} />)}
    </>
  )
}
