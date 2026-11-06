import { useState } from 'react'
import type { Props } from '../App'
import { PREGUNTAS_EJEMPLO, hechos, lineaNota, notasParaChat, respuestaEjemplo } from '../lib/hechos'
import { ErrorIA, numerosValidos, pedirIA } from '../lib/ia'
import { Entrada, Titulo } from '../ui'

// ia: la contestó una IA de verdad (local o externa) y la respuesta es válida; esas son las que sirven de contexto en la siguiente pregunta.
type Turno = { pregunta: string; respuesta: string; ejemplo: boolean; local: boolean; ia: boolean }

const FUERA = 'Solo veo tus gastos, tu bitácora y tus cuentas. Eso no lo sé.'

export default function Preguntale({ d }: Props) {
  const [turnos, setTurnos] = useState<Turno[]>([])
  const [pregunta, setPregunta] = useState('')
  const [pensando, setPensando] = useState(false)

  async function preguntar(q: string) {
    if (!q.trim() || pensando) return
    setPensando(true)
    setPregunta('')
    const h = hechos(d)
    const notas = notasParaChat(d)
    // Las cifras de la respuesta pueden venir de los hechos o de lo que el propio productor escribió en la bitácora.
    const permitidos = [...h, ...notas.map(lineaNota)]
    // Las últimas respuestas de la IA, para que entienda "¿y la semana pasada?".
    const historial = turnos.filter((x) => x.ia).slice(-3).map((x) => ({ pregunta: x.pregunta.slice(0, 300), respuesta: x.respuesta.slice(0, 600) }))
    let t: Turno
    try {
      // Si la respuesta trae una cifra que no sale de los hechos ni de la bitácora, se le pregunta una vez más antes de rendirse.
      const buena = (r: { fueraDeTema: boolean; respuesta: string }) => r.fueraDeTema || !r.respuesta || numerosValidos(r.respuesta, permitidos)
      const { datos, ejemplo, local } = await pedirIA('chat', { pregunta: q.slice(0, 300), hechos: h, notas, historial }, () => ({ fueraDeTema: false, respuesta: respuestaEjemplo(q, h) }), buena)
      // La respuesta solo se muestra si cada número viene de los hechos de la app o de las notas del productor.
      const valida = !datos.fueraDeTema && Boolean(datos.respuesta) && numerosValidos(datos.respuesta, permitidos)
      const respuesta = datos.fueraDeTema || !datos.respuesta ? FUERA : valida ? datos.respuesta : 'No pude contestar eso con tus números. Pregúntalo de otra forma.'
      t = { pregunta: q, respuesta, ejemplo, local, ia: !ejemplo && valida }
    } catch (e) {
      t = { pregunta: q, respuesta: e instanceof ErrorIA ? e.message : 'No se pudo contestar. Intenta otra vez.', ejemplo: false, local: false, ia: false }
    }
    setTurnos((x) => [...x, t])
    setPensando(false)
  }

  return (
    <>
      <Titulo>Pregúntale a tus números</Titulo>
      <p className="mb-4">Escribe tu pregunta con tus propias palabras sobre tus gastos, tu bitácora y tus cuentas, o toca una de estas:</p>
      <div className="flex flex-wrap gap-2 mb-4">
        {PREGUNTAS_EJEMPLO.map((q) => (
          <button key={q} type="button" onClick={() => preguntar(q)} disabled={pensando}
            className="min-h-12 rounded-xl px-4 py-2 font-bold border-2 border-campo text-campo bg-hoja text-left disabled:opacity-50">{q}</button>
        ))}
      </div>
      <ol className="space-y-3 mb-4" aria-live="polite">
        {turnos.map((t, i) => (
          <li key={i}>
            <p className="font-bold text-right bg-campo-claro rounded-xl p-3 ml-8">{t.pregunta}</p>
            <div className="bg-hoja border border-linea rounded-xl p-3 mt-2 mr-8">
              {t.ejemplo && <span className="inline-block bg-maiz px-2 rounded text-sm font-bold uppercase mb-1">Ejemplo</span>}
              {t.ia && <span className="inline-block bg-campo-claro text-campo px-2 rounded text-sm font-bold uppercase mb-1">{t.local ? 'IA local' : 'IA'}</span>}
              <p className="text-lg">{t.respuesta}</p>
            </div>
          </li>
        ))}
        {pensando && <li className="text-tinta-2">Revisando tus registros…</li>}
      </ol>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); preguntar(pregunta) }}>
        <Entrada value={pregunta} onChange={(e) => setPregunta(e.target.value)} placeholder="Ej. ¿Cuándo vi plaga y qué anoté?" aria-label="Tu pregunta" maxLength={300} />
        <button type="submit" disabled={pensando || !pregunta.trim()} className="min-h-14 rounded-xl bg-campo text-white font-bold px-4 disabled:opacity-50">Enviar</button>
      </form>
    </>
  )
}
