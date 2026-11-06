import { useState } from 'react'
import { Camera, Check, Image as Galeria, Sprout, TriangleAlert } from 'lucide-react'
import type { Props } from '../App'
import { GENERAL } from '../lib/datos'
import { reducirFoto } from '../lib/foto'
import { ErrorIA, limpiarMedplant, medplantEjemplo, pedirIA, type ResultadoMedplant } from '../lib/ia'
import { Boton, Campo, Entrada, Lista, Seccion, Titulo } from '../ui'

const NO_SE = 'No sé'
const ESTADOS = {
  sana: { texto: 'Se ve sana', clase: 'bg-campo-claro text-campo' },
  con_detalles: { texto: 'Con detalles', clase: 'bg-maiz-claro text-tinta' },
  con_problema: { texto: 'Con problema', clase: 'bg-pierde-claro text-pierde' },
  no_se_sabe: { texto: 'No se puede saber', clase: 'bg-fondo text-tinta-2' },
}
const CERTEZA = { alta: 'Bastante seguro', media: 'Posible', baja: 'Poco seguro' }

export default function MedPlant({ d, hacer, ocupado }: Props) {
  const nombres = d.productor.cultivos.map((c) => c.nombre)
  const [cultivo, setCultivo] = useState(nombres[0] ?? NO_SE)
  const [nota, setNota] = useState('')
  const [foto, setFoto] = useState('') // JPEG reducido, en data URL; no se guarda en ningún lado
  const [analizando, setAnalizando] = useState(false)
  const [error, setError] = useState('')
  const [r, setR] = useState<(ResultadoMedplant & { ejemplo: boolean; local: boolean }) | null>(null)
  const [guardada, setGuardada] = useState(false)

  async function elegirFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0]
    e.target.value = ''
    if (!archivo) return
    const f = await reducirFoto(archivo, 1280).catch(() => '')
    if (!f) return setError('No se pudo abrir esa foto. Prueba con otra.')
    setFoto(f)
    setR(null)
    setGuardada(false)
    setError('')
  }

  async function analizar(e: React.FormEvent) {
    e.preventDefault()
    if (!foto) return
    setAnalizando(true)
    setError('')
    setGuardada(false)
    try {
      // Si la respuesta viene vacía de observaciones se pregunta una vez más antes de rendirse.
      const res = await pedirIA(
        'medplant',
        { imagen: foto.split(',')[1], cultivo, nota: nota.trim() || undefined },
        () => medplantEjemplo(cultivo),
        (x) => !x.esPlanta || x.observaciones.length > 0,
      )
      setR({ ...limpiarMedplant(res.datos), ejemplo: res.ejemplo, local: res.local })
      setTimeout(() => document.getElementById('resultado-medplant')?.scrollIntoView({ behavior: 'smooth' }), 50)
    } catch (e) {
      setError(e instanceof ErrorIA ? e.message : 'No se pudo analizar la foto. Intenta otra vez.')
    } finally {
      setAnalizando(false)
    }
  }

  // El productor decide si queda en su bitácora; la foto no se guarda, solo este resumen.
  async function guardarEnBitacora() {
    if (!r) return
    const causas = r.posiblesCausas.length ? ` Posibles causas: ${r.posiblesCausas.map((c) => `${c.nombre} (${CERTEZA[c.certeza].toLowerCase()})`).join(', ')}.` : ''
    const texto = `MedPlant (orientativo): ${r.resumen}${causas}`.slice(0, 500)
    if (await hacer('nota', { tipo: 'Plaga', cultivo: nombres.includes(cultivo) ? cultivo : GENERAL, texto })) setGuardada(true)
  }

  const estado = r ? ESTADOS[r.estado] : null

  return (
    <>
      <Titulo>MedPlant</Titulo>
      <p className="mb-4">Toma una foto de la planta y te digo qué se ve y qué podría tener.</p>

      <div className="grid grid-cols-2 gap-2 mb-4">
        {[
          { texto: 'Tomar foto', Icono: Camera, captura: true },
          { texto: 'Elegir foto', Icono: Galeria, captura: false },
        ].map(({ texto, Icono, captura }) => (
          <label key={texto} className={`min-h-14 rounded-xl px-3 text-lg font-bold flex items-center justify-center gap-2 bg-maiz text-tinta cursor-pointer ${analizando ? 'opacity-50 pointer-events-none' : ''}`}>
            <Icono aria-hidden /> {texto}
            <input type="file" accept="image/*" {...(captura ? { capture: 'environment' } : {})} onChange={elegirFoto} className="sr-only" />
          </label>
        ))}
      </div>

      {foto && <img src={foto} alt="Foto de la planta que se va a revisar" className="w-full max-h-80 object-cover rounded-xl border border-linea mb-4" />}

      <form onSubmit={analizar}>
        <Campo etiqueta="¿Qué cultivo es?">
          <Lista opciones={[...nombres, NO_SE]} value={cultivo} onChange={(e) => setCultivo(e.target.value)} />
        </Campo>
        <Campo etiqueta="¿Qué notaste? (opcional)">
          <Entrada maxLength={300} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej. Las hojas de abajo se ven amarillas" />
        </Campo>
        <Boton type="submit" disabled={!foto || analizando}>
          <Sprout aria-hidden /> {analizando ? 'Revisando la planta…' : 'Analizar planta'}
        </Boton>
        {!foto && <p className="text-base text-tinta-2 mt-2">Primero toma o elige una foto. Si es de cerca y con luz de día, sale mejor.</p>}
      </form>

      {error && <p role="alert" className="text-pierde font-bold mt-4">{error}</p>}
      {analizando && <p role="status" className="font-bold mt-4">Revisando la planta… puede tardar unos segundos.</p>}

      {r && estado && (
        <div id="resultado-medplant" className="mt-6" role="status">
          <Seccion>
            <p className="mb-2">
              {r.ejemplo && <span className="inline-block bg-maiz px-2 rounded text-sm font-bold uppercase mr-2">Ejemplo</span>}
              {!r.ejemplo && <span className="inline-block bg-campo-claro text-campo px-2 rounded text-sm font-bold uppercase mr-2">{r.local ? 'IA local' : 'IA'}</span>}
              <span className={`inline-block px-2 rounded text-sm font-bold uppercase ${estado.clase}`}>{estado.texto}</span>
            </p>
            {r.ejemplo && <p className="text-base mb-2 bg-maiz-claro rounded-xl p-3 font-bold">Ejemplo: sin IA conectada se muestra un resultado fijo, no de tu foto.</p>}
            <p className="text-lg font-bold">{r.esPlanta ? r.planta : 'No veo una planta'}</p>
            <p className="mb-2">{r.resumen}</p>
            {r.mejorarFoto && <p className="mb-2"><span className="font-bold">Para otra foto:</span> {r.mejorarFoto}</p>}
          </Seccion>

          {r.observaciones.length > 0 && (
            <Seccion titulo="Lo que se ve">
              <ul className="list-disc pl-5 space-y-1">{r.observaciones.map((o) => <li key={o}>{o}</li>)}</ul>
            </Seccion>
          )}

          {r.posiblesCausas.length > 0 && (
            <Seccion titulo="Qué podría ser">
              <ul className="space-y-3">
                {r.posiblesCausas.map((c) => (
                  <li key={c.nombre}>
                    <span className="font-bold">{c.nombre}</span> <span className="text-base text-tinta-2">· {CERTEZA[c.certeza]}</span>
                    <span className="block">{c.porQue}</span>
                  </li>
                ))}
              </ul>
            </Seccion>
          )}

          {r.queHacer.length > 0 && (
            <Seccion titulo="Qué hacer ahora">
              <ul className="list-disc pl-5 space-y-1">{r.queHacer.map((q) => <li key={q}>{q}</li>)}</ul>
            </Seccion>
          )}

          {r.consultarAgronomo && <p className="flex items-start gap-2 font-bold text-pierde mb-4"><TriangleAlert className="shrink-0 mt-0.5" aria-hidden /> Conviene que lo vea un agrónomo.</p>}

          <p className="bg-maiz-claro rounded-xl p-3 text-base mb-4">
            Esto es solo una orientación: una foto no sustituye a un agrónomo. Ante plagas o enfermedades, consulta a un agrónomo o a la junta local de sanidad vegetal. Aquí no se recomiendan productos ni dosis.
          </p>

          {(r.estado === 'con_detalles' || r.estado === 'con_problema') && !guardada && (
            <>
              <Boton tipo="secundario" disabled={ocupado} onClick={guardarEnBitacora}>{ocupado ? 'Guardando…' : 'Guardar en mi bitácora'}</Boton>
              <p className="text-base text-tinta-2 mt-2">Se guarda este resumen, no la foto. La fecha se pone sola y ya no se puede cambiar.</p>
            </>
          )}
          {guardada && (
            <p className="flex items-center gap-2 font-bold text-campo"><Check aria-hidden /> Guardado en tu bitácora. <a href="#/bitacora" className="underline">Verla</a></p>
          )}
        </div>
      )}
    </>
  )
}
