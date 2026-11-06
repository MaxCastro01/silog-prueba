import { useState } from 'react'
import { KeyRound } from 'lucide-react'
import { cuenta } from '../lib/api'
import { MUNICIPIOS } from '../lib/datos'
import { Boton, Campo, Entrada, Lista, Opciones, Titulo } from '../ui'

const PRUEBA = { usuario: 'prueba', clave: 'campo2026' }

export default function Entrar({ listo }: { listo: () => void }) {
  const [modo, setModo] = useState('Entrar')
  const [f, setF] = useState({ usuario: '', clave: '', nombre: '', municipio: 'Culiacán' })
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const set = (campo: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [campo]: e.target.value })
  const crear = modo === 'Crear cuenta'

  async function enviar(datos: Record<string, string>) {
    setEnviando(true)
    setError('')
    try {
      await cuenta({ accion: crear ? 'crear' : 'entrar', ...datos })
      listo()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Algo falló. Intenta otra vez.')
      setEnviando(false)
    }
  }

  return (
    <>
      <Titulo>{crear ? 'Crea tu cuenta' : 'Entra a Mi Ciclo'}</Titulo>

      <section className="letrero p-6 mb-6">
        <p className="flex items-center gap-2 text-lg font-bold mb-1"><KeyRound aria-hidden /> Cuenta de prueba</p>
        <p className="mb-1">Empieza vacía: arma tu ciclo desde cero, con los cultivos y hectáreas que quieras.</p>
        <p className="mb-4">Usuario <strong className="font-senal text-xl">{PRUEBA.usuario}</strong> · contraseña <strong className="font-senal text-xl">{PRUEBA.clave}</strong></p>
        <Boton tipo="maiz" disabled={enviando} onClick={() => { setModo('Entrar'); enviar(PRUEBA) }}>Entrar con la cuenta de prueba</Boton>
        <p className="text-base text-white/90 mt-3">Es compartida: otras personas pueden ver lo que captures en ella.</p>
      </section>

      <Opciones etiqueta="¿Ya tienes cuenta?" opciones={['Entrar', 'Crear cuenta']} valor={modo} cambiar={(v) => { setModo(v); setError('') }} />
      <form onSubmit={(e) => { e.preventDefault(); enviar(crear ? f : { usuario: f.usuario, clave: f.clave }) }}>
        <Campo etiqueta="Usuario">
          <Entrada required value={f.usuario} onChange={set('usuario')} autoComplete="username" autoCapitalize="none" spellCheck={false}
            pattern="[A-Za-z0-9._\-]{3,30}" title="De 3 a 30 letras o números, sin espacios" />
        </Campo>
        <Campo etiqueta="Contraseña">
          <Entrada required type="password" value={f.clave} onChange={set('clave')} autoComplete={crear ? 'new-password' : 'current-password'} minLength={crear ? 6 : undefined} />
        </Campo>
        {crear && (
          <>
            <Campo etiqueta="¿Cómo te llamas?"><Entrada required maxLength={40} value={f.nombre} onChange={set('nombre')} autoComplete="given-name" /></Campo>
            <Campo etiqueta="Municipio"><Lista opciones={MUNICIPIOS} value={f.municipio} onChange={set('municipio')} /></Campo>
            <p className="text-base text-tinta-2 mb-4">Solo te pedimos esto. Nunca te pediremos INE, CURP, cuenta de banco ni tu ubicación.</p>
          </>
        )}
        {error && <p role="alert" className="text-pierde font-bold mb-4">{error}</p>}
        <Boton type="submit" disabled={enviando}>{enviando ? 'Un momento…' : crear ? 'Crear mi cuenta' : 'Entrar'}</Boton>
      </form>
    </>
  )
}
