import { renderToString } from 'react-dom/server'
import { expect, test } from 'vitest'
import { datosEjemplo } from '../lib/datos'
import MedPlant from './MedPlant'

// La pantalla se dibuja en el servidor para comprobar que no falla y que muestra lo que el productor necesita ver.
const dibujar = () => renderToString(<MedPlant d={datosEjemplo()} hacer={async () => true} ocupado={false} />)

test('MedPlant: la pantalla inicial pide la foto y ofrece los cultivos del ciclo', () => {
  const html = dibujar()
  expect(html).toContain('MedPlant')
  expect(html).toContain('Tomar foto')
  expect(html).toContain('Elegir foto')
  expect(html).toContain('Analizar planta')
  expect(html).toContain('Primero toma o elige una foto')
  // Sin foto, el botón de analizar está apagado.
  expect(html).toMatch(/<button[^>]*disabled=""[^>]*>[\s\S]*Analizar planta/)
  // Los cultivos del ciclo y la opción "No sé".
  for (const c of datosEjemplo().productor.cultivos) expect(html).toContain(`>${c.nombre}</option>`)
  expect(html).toContain('>No sé</option>')
  // Todavía no hay resultado ni aviso de agrónomo.
  expect(html).not.toContain('Conviene que lo vea un agrónomo')
})

test('MedPlant: la foto se toma con la cámara trasera y también se puede elegir de la galería', () => {
  const html = dibujar()
  expect(html.match(/type="file"/g)).toHaveLength(2)
  expect(html.match(/capture="environment"/g)).toHaveLength(1)
})
