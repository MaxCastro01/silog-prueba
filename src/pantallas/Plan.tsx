import { Check } from 'lucide-react'
import type { Props } from '../App'
import { haTotal, pesos, tienePlanPago } from '../lib/calculos'
import { PRECIOS, precioTemporada } from '../lib/precio'
import { Boton, Seccion, Titulo } from '../ui'

export const INCLUYE_PAGO = ['Expediente para crédito o seguro', 'Varias parcelas en una cuenta', 'Comparación con tu zona gasto por gasto', 'Sin anuncios de tiendas']

export function ResumenPlan({ ha }: { ha: number }) {
  const precio = precioTemporada(ha)
  return precio === 0 ? (
    <>
      <p className="text-[2rem] font-bold leading-tight">Gratis</p>
      <p>Con {ha} ha tu plan no cuesta. Verás ofertas de tiendas de tu municipio.</p>
    </>
  ) : (
    <>
      <p className="text-[2rem] font-bold leading-tight">{pesos(precio)}</p>
      <p className="text-lg">por temporada</p>
      <p className="mb-3">Por tus {ha} ha, con todos tus cultivos.</p>
      <ul className="space-y-1">{INCLUYE_PAGO.map((x) => <li key={x} className="flex gap-2"><Check className="text-campo shrink-0" aria-hidden />{x}</li>)}</ul>
    </>
  )
}

export default function Plan({ d, hacer, ocupado }: Props) {
  const p = d.productor
  const ha = haTotal(p)
  const precio = precioTemporada(ha)

  return (
    <>
      <Titulo>Mi plan · {p.temporada}</Titulo>
      <Seccion><ResumenPlan ha={ha} /></Seccion>

      {precio > 0 && (tienePlanPago(p) ? (
        <Seccion className="border-2 border-campo">
          <p className="flex items-center gap-2 text-lg font-bold text-campo"><Check aria-hidden /> Temporada pagada</p>
          <p>Pago simulado: no se cobró nada. Ya puedes ver tu <a href="#/expediente" className="font-bold text-campo">expediente</a>.</p>
        </Seccion>
      ) : (
        <>
          <Boton onClick={() => hacer('pagar')} disabled={ocupado} className="mb-2">{ocupado ? 'Procesando…' : `Pagar ${pesos(precio)}`}</Boton>
          <p className="text-base text-tinta-2 mb-4">Maqueta: el pago es simulado y no se cobra nada. Queda guardado en tu ciclo.</p>
        </>
      ))}

      <Seccion titulo="Cómo se cobra">
        <ul className="list-disc pl-6 space-y-1">
          <li>Se paga por temporada (OI o PV), no por cultivo.</li>
          <li>{PRECIOS.haGratis} ha o menos: gratis.</li>
          <li>Más de {PRECIOS.haGratis} ha: {pesos(PRECIOS.porHectarea)} por hectárea, mínimo {pesos(PRECIOS.minimo)}.</li>
          <li>Más de {PRECIOS.haPrecioFijo} ha: {pesos(PRECIOS.precioFijo)} fijo.</li>
        </ul>
      </Seccion>
    </>
  )
}
