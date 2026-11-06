import { useState } from 'react'
import { Mic } from 'lucide-react'
import { dictar, puedeDictar } from '../lib/voz'
import { Boton, Entrada } from '../ui'

/** Dicta o escribe una frase; la IA la convierte en datos que el productor revisa antes de guardar. */
export default function Dictado({ ejemplo, entender, ocupado }: { ejemplo: string; entender: (texto: string) => void; ocupado: boolean }) {
  const [texto, setTexto] = useState('')
  const [escuchando, setEscuchando] = useState(false)
  const [error, setError] = useState('')

  async function escuchar() {
    setError('')
    setEscuchando(true)
    try {
      const t = await dictar()
      setTexto(t)
      entender(t)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setEscuchando(false)
    }
  }

  return (
    <div className="mb-4">
      {puedeDictar() && (
        <Boton tipo="secundario" type="button" onClick={escuchar} disabled={escuchando || ocupado} className="mb-2">
          <Mic aria-hidden /> {escuchando ? 'Te escucho…' : 'Dictar'}
        </Boton>
      )}
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (texto.trim()) entender(texto.trim()) }}>
        <Entrada value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={ejemplo} aria-label="Lo que dirías" />
        <button type="submit" disabled={ocupado || !texto.trim()} className="min-h-14 rounded-xl bg-campo text-white font-bold px-4 disabled:opacity-50">Llenar</button>
      </form>
      {error && <p role="alert" className="text-pierde font-bold mt-2">{error}</p>}
    </div>
  )
}
