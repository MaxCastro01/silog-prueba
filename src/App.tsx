import { useCallback, useEffect, useState } from 'react'
import { Calculator, Menu, NotebookPen, ReceiptText, Sprout, Store } from 'lucide-react'
import { ErrorApi, hacerAccion, leerDatos } from './lib/api'
import type { Datos, DatosServidor } from './lib/datos'
import Inicio from './pantallas/Inicio'
import Gasto from './pantallas/Gasto'
import Bitacora from './pantallas/Bitacora'
import MedPlant from './pantallas/MedPlant'
import Mercado from './pantallas/Mercado'
import Mas from './pantallas/Mas'
import Comunidad from './pantallas/Comunidad'
import Expediente from './pantallas/Expediente'
import Plan from './pantallas/Plan'
import Registro, { Listo } from './pantallas/Registro'
import Ofertas from './pantallas/Ofertas'
import Preguntale from './pantallas/Preguntale'
import Portada from './pantallas/Portada'
import Entrar from './pantallas/Entrar'
import { Boton, Escudo } from './ui'

/** hacer() guarda en la base y regresa true si salió bien; si falla, la app muestra el aviso arriba. */
export type Hacer = (accion: string, entrada?: object) => Promise<boolean>
export type Props = { d: Datos; hacer: Hacer; ocupado: boolean }

const NAV = [
  { ruta: 'inicio', texto: 'Números', Icono: Calculator },
  { ruta: 'gasto', texto: 'Gasto', Icono: ReceiptText },
  { ruta: 'bitacora', texto: 'Bitácora', Icono: NotebookPen },
  { ruta: 'medplant', texto: 'MedPlant', Icono: Sprout },
  { ruta: 'mercado', texto: 'Mercado', Icono: Store },
  { ruta: 'mas', texto: 'Más', Icono: Menu },
]
const DENTRO_DE_MAS = ['comunidad', 'expediente', 'plan', 'registro', 'listo', 'ofertas', 'preguntale']

const leerRuta = () => location.hash.replace('#/', '') || 'portada'

type Estado = { es: 'cargando' } | { es: 'fuera' } | { es: 'sinRed'; mensaje: string } | { es: 'dentro'; d: DatosServidor }

export default function App() {
  const [estado, setEstado] = useState<Estado>({ es: 'cargando' })
  const [ruta, setRuta] = useState(leerRuta)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState('')

  const cargar = useCallback(async () => {
    try {
      setEstado({ es: 'dentro', d: await leerDatos() })
    } catch (e) {
      setEstado(e instanceof ErrorApi && e.status === 401 ? { es: 'fuera' } : { es: 'sinRed', mensaje: e instanceof Error ? e.message : '' })
    }
  }, [])
  useEffect(() => { cargar() }, [cargar])
  useEffect(() => {
    const alCambiar = () => { setRuta(leerRuta()); setError(''); scrollTo(0, 0) }
    addEventListener('hashchange', alCambiar)
    return () => removeEventListener('hashchange', alCambiar)
  }, [])

  const hacer: Hacer = useCallback(async (accion, entrada) => {
    setOcupado(true)
    setError('')
    try {
      setEstado({ es: 'dentro', d: await hacerAccion(accion, entrada) })
      return true
    } catch (e) {
      if (e instanceof ErrorApi && e.status === 401) setEstado({ es: 'fuera' })
      else setError(e instanceof Error ? e.message : 'Algo falló. Intenta otra vez.')
      return false
    } finally {
      setOcupado(false)
    }
  }, [])

  if (ruta === 'portada') return <Portada />

  let contenido: React.ReactNode
  let conNav = false
  if (estado.es === 'cargando') contenido = <p role="status" className="text-lg mt-8 text-center">Cargando tus números…</p>
  else if (estado.es === 'sinRed') {
    contenido = (
      <div role="alert" className="mt-6">
        <p className="text-lg font-bold mb-2">No pudimos abrir tus datos.</p>
        <p className="mb-4">{estado.mensaje}</p>
        <Boton onClick={() => { setEstado({ es: 'cargando' }); cargar() }}>Intentar otra vez</Boton>
      </div>
    )
  } else if (estado.es === 'fuera') contenido = <Entrar listo={cargar} />
  else if (!estado.d.productor) contenido = <Registro usuario={estado.d.usuario} primero hacer={hacer} ocupado={ocupado} />
  else {
    conNav = true
    const props: Props = { d: { ...estado.d, productor: estado.d.productor }, hacer, ocupado }
    const pantallas: Record<string, React.ReactNode> = {
      inicio: <Inicio {...props} />,
      gasto: <Gasto {...props} />,
      bitacora: <Bitacora {...props} />,
      medplant: <MedPlant {...props} />,
      mercado: <Mercado {...props} />,
      mas: <Mas {...props} salir={() => setEstado({ es: 'fuera' })} />,
      comunidad: <Comunidad {...props} />,
      expediente: <Expediente {...props} />,
      plan: <Plan {...props} />,
      registro: <Registro usuario={props.d.usuario} hacer={hacer} ocupado={ocupado} />,
      listo: <Listo {...props} />,
      ofertas: <Ofertas {...props} />,
      preguntale: <Preguntale {...props} />,
    }
    contenido = pantallas[ruta] ?? pantallas.inicio
  }
  const activa = DENTRO_DE_MAS.includes(ruta) ? 'mas' : ruta

  return (
    <div className={`min-h-dvh ${conNav ? 'pb-28' : 'pb-8'}`}>
      <header className="no-imprimir bg-campo">
        <div className="mx-auto max-w-xl px-4 py-1.5">
          <a href="#/portada" className="inline-block" aria-label="Ir a la portada de Mi Ciclo"><Escudo ancho={44} /></a>
        </div>
      </header>
      {error && (
        <p role="alert" className="no-imprimir sticky top-0 z-10 bg-pierde text-white font-bold px-4 py-3">
          <span className="mx-auto max-w-xl flex justify-between gap-3">
            {error}
            <button onClick={() => setError('')} className="underline shrink-0" aria-label="Cerrar aviso">Cerrar</button>
          </span>
        </p>
      )}
      <main className="mx-auto max-w-xl px-4 pt-2">{contenido}</main>
      {conNav && (
        <nav className="no-imprimir fixed bottom-0 inset-x-0 z-10 bg-hoja border-t-2 border-linea" aria-label="Secciones">
          <ul className="mx-auto max-w-xl grid grid-cols-6">
            {NAV.map(({ ruta: r, texto, Icono }) => (
              <li key={r}>
                <a
                  href={`#/${r}`}
                  aria-current={activa === r ? 'page' : undefined}
                  className={`flex flex-col items-center gap-1 py-2 min-h-18 text-[0.7rem] leading-tight text-center font-bold no-underline ${activa === r ? 'text-campo bg-campo-claro' : 'text-tinta-2'}`}
                >
                  <Icono size={28} strokeWidth={2.25} aria-hidden />
                  {texto}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  )
}
