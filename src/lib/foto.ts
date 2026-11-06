/** Reduce la foto a JPEG para que quepa en el navegador o en la petición a la IA. */
export function reducirFoto(archivo: File, ancho = 640): Promise<string> {
  return new Promise((ok, falla) => {
    const img = new Image()
    img.onload = () => {
      const escala = Math.min(1, ancho / img.width)
      const c = document.createElement('canvas')
      c.width = img.width * escala
      c.height = img.height * escala
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
      URL.revokeObjectURL(img.src)
      ok(c.toDataURL('image/jpeg', 0.7))
    }
    img.onerror = falla
    img.src = URL.createObjectURL(archivo)
  })
}
