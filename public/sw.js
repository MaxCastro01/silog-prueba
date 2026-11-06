// Guarda lo que se abre para que la app funcione sin señal en el campo.
self.addEventListener('fetch', (e) => {
  // Los datos de cada quien (api/) nunca se guardan en el celular por esta vía.
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin) || new URL(e.request.url).pathname.includes('/api/')) return
  e.respondWith(
    fetch(e.request)
      .then((r) => {
        const copia = r.clone()
        caches.open('mi-ciclo').then((c) => c.put(e.request, copia))
        return r
      })
      .catch(() => caches.match(e.request).then((r) => r ?? caches.match(self.registration.scope))),
  )
})
