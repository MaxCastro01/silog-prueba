import { useState } from 'react'
import type { Hacer } from '../App'
import { CULTIVOS, TEMPORADAS, type Cuenta } from '../lib/datos'
import type { Props } from '../App'
import { haTotal } from '../lib/calculos'
import { Boton, BotonLink, Campo, Entrada, Opciones, Seccion, Titulo } from '../ui'
import { ResumenPlan } from './Plan'

// La temporada que viene según el mes: OI se siembra en otoño, PV en primavera.
function temporadaSugerida(hoy = new Date()) {
  const a = hoy.getFullYear()
  const t = hoy.getMonth() >= 7 ? `OI ${a}-${String(a + 1).slice(2)}` : `PV ${a}`
  return (TEMPORADAS as readonly string[]).includes(t) ? t : TEMPORADAS[2]
}

/** Empieza un ciclo: temporada, cultivos y hectáreas. El nombre y el municipio ya vienen de la cuenta. */
export default function Registro({ usuario, hacer, ocupado, primero = false }: { usuario: Cuenta; hacer: Hacer; ocupado: boolean; primero?: boolean }) {
  const [temporada, setTemporada] = useState(temporadaSugerida)
  const [has, setHas] = useState<Record<string, string>>({})
  const [error, setError] = useState('')

  const elegidos = CULTIVOS.filter((c) => c in has)
  const alternar = (c: string) => {
    const { [c]: quitado, ...resto } = has
    setHas(quitado === undefined ? { ...has, [c]: '' } : resto)
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    // Se revisa aquí también: no todos los celulares respetan el mínimo del campo, y aceptamos coma decimal.
    const cultivos = elegidos.map((c) => ({ nombre: c, ha: Number(has[c].replace(',', '.')) }))
    const mal = cultivos.find((c) => !(c.ha > 0))
    if (mal) return setError(`Escribe cuántas hectáreas de ${mal.nombre.toLowerCase()} vas a sembrar (más de 0).`)
    setError('')
    // replace: al regresar no vuelve al formulario vacío.
    if (await hacer('nuevoCiclo', { temporada, cultivos })) location.replace('#/listo')
  }

  return (
    <>
      <Titulo>{primero ? `Hola, ${usuario.nombre}. Arma tu ciclo` : 'Empezar otro ciclo'}</Titulo>
      <p className="mb-4">{primero ? `Dinos qué vas a sembrar en ${usuario.municipio}. Con eso sacamos tus números.` : 'Tu ciclo de ahora se guarda; lo puedes volver a abrir desde Más.'}</p>
      <form onSubmit={guardar}>
        <Opciones etiqueta="Temporada" opciones={TEMPORADAS} valor={temporada} cambiar={setTemporada} />
        <fieldset className="mb-4">
          <legend className="font-bold mb-1">¿Qué vas a sembrar?</legend>
          <div className="flex flex-wrap gap-2">
            {CULTIVOS.map((c) => (
              <button key={c} type="button" aria-pressed={c in has} onClick={() => alternar(c)}
                className={`min-h-12 rounded-full px-4 font-bold border-2 ${c in has ? 'bg-campo text-white border-campo' : 'bg-hoja border-linea'}`}>
                {c}
              </button>
            ))}
          </div>
        </fieldset>
        {elegidos.map((c) => (
          <Campo key={c} etiqueta={`Hectáreas de ${c.toLowerCase()}`}>
            <Entrada required type="number" inputMode="decimal" min={0.1} max={10000} step="any" value={has[c]} onChange={(e) => setHas({ ...has, [c]: e.target.value })} />
          </Campo>
        ))}
        {error && <p role="alert" className="text-pierde font-bold mb-3">{error}</p>}
        <Boton type="submit" disabled={elegidos.length === 0 || ocupado}>{ocupado ? 'Guardando…' : 'Empezar mi ciclo'}</Boton>
        <p className="text-base text-tinta-2 mt-3">El rendimiento y el precio arrancan con valores comunes de Sinaloa; los cambias en Números.</p>
      </form>
    </>
  )
}

/** Después de armar el ciclo: cuánto cuesta su plan y por dónde seguir. */
export function Listo({ d }: Props) {
  return (
    <>
      <Titulo>Listo, {d.usuario.nombre}</Titulo>
      <Seccion titulo={`Tu plan para ${d.productor.temporada}`}><ResumenPlan ha={haTotal(d.productor)} /></Seccion>
      <BotonLink href="#/gasto" className="mb-3">Registrar mi primer gasto</BotonLink>
      <BotonLink href="#/inicio" tipo="secundario">Ver mis números</BotonLink>
    </>
  )
}
