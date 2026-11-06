// Reconocimiento de voz del navegador (Chrome, Edge, Safari). El audio lo procesa Google o Apple.
type Reconocedor = {
  lang: string
  start(): void
  onresult: (e: { results: { 0: { 0: { transcript: string } } } }) => void
  onerror: (e: { error: string }) => void
  onend: () => void
}
const Clase = (window as unknown as Record<string, (new () => Reconocedor) | undefined>).SpeechRecognition ??
  (window as unknown as Record<string, (new () => Reconocedor) | undefined>).webkitSpeechRecognition

export const puedeDictar = () => Boolean(Clase)

export function dictar(): Promise<string> {
  return new Promise((ok, falla) => {
    if (!Clase) return falla(new Error('Tu navegador no permite dictar. Escríbelo abajo.'))
    const r = new Clase()
    r.lang = 'es-MX'
    let texto = ''
    r.onresult = (e) => { texto = e.results[0][0].transcript }
    r.onerror = (e) => falla(new Error(e.error === 'not-allowed' ? 'Da permiso al micrófono para dictar.' : 'No se escuchó bien. Intenta otra vez o escríbelo.'))
    r.onend = () => (texto ? ok(texto) : falla(new Error('No se escuchó nada. Intenta otra vez o escríbelo.')))
    r.start()
  })
}
