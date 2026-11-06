# Mi Ciclo — maqueta en producción

App para pequeños y medianos productores de Sinaloa: saber cuánto les cuesta producir, compararse con su zona, rentar equipo entre vecinos y tener papeles cuando los piden.

Web instalable (PWA), en español, pensada para el celular. Cada productor entra con **su usuario y contraseña** y sus datos se guardan en una **base de datos Postgres**: los ve igual desde cualquier celular o computadora.

**Cuenta de prueba:** usuario `prueba`, contraseña `campo2026`. Empieza vacía para armar un ciclo desde cero (temporada, cultivos y hectáreas que quieras). Es compartida: si alguien ya la usó, en **Más → Borrar todo y empezar de cero** queda limpia. También se puede **crear una cuenta** propia desde la pantalla de entrada.

## Correrla en tu computadora

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # precios, costos, palancas, IA, y la base de datos (cuentas, ciclos, permisos)
npm run build    # revisa tipos y deja la app lista en dist/
```

No hay que instalar ninguna base de datos: sin `DATABASE_URL`, `npm run dev` usa **PGlite** (un Postgres que se guarda en la carpeta `.datos/` del proyecto). Para empezar con la base vacía, apaga `npm run dev` y borra esa carpeta. Si quieres usar tu propio Postgres, pon `DATABASE_URL=postgres://...` en `.env.local`.

Para verla desde tu celular en la misma red wifi: `npm run dev -- --host` y abre la dirección “Network” que aparece.

XAMPP ya no sirve para esta versión: la app necesita su servidor (las funciones de `api/`) para guardar en la base.

## Publicarla gratis en Vercel

1. Entra a [vercel.com](https://vercel.com) con tu cuenta de GitHub.
2. **Add New → Project** → escoge el repositorio `agroenac` → **Import** → **Deploy** (la primera vez la app avisará que falta la base; es normal).
3. **La base de datos:** en tu proyecto de Vercel → pestaña **Storage** → **Create Database** → **Neon** (Postgres, plan gratis) → región Washington D.C. o la más cercana → **Connect** al proyecto. Vercel agrega solo la variable `DATABASE_URL`. Las tablas y la cuenta de prueba se crean solas la primera vez que alguien entra.
4. **La IA (opcional):** Settings → **Environment Variables** → agrega `OPENROUTER_API_KEY` con tu clave **nueva** de OpenRouter. Deja `OPENROUTER_MODEL` sin poner para usar los modelos gratuitos.
5. **Deployments → ⋯ → Redeploy** para que tome las variables. Te queda una dirección tipo `https://agroenac.vercel.app`: la portada en la raíz y la app en “Entrar”.
6. Si la rama de producción no es esta, en Settings → Git → **Production Branch** escribe `claude/inspiring-lovelace-m06vbx` (o une la rama a `main`).

Sirve cualquier Postgres (Neon, Supabase, Railway…): la app lee `DATABASE_URL` (o `POSTGRES_URL`). `vercel.json` le da a la función de IA hasta 60 s porque los modelos gratis a veces tardan.

### Activar la IA

La IA funciona con **Ollama** (IA local, `OLLAMA_URL`), una **API externa con clave** (`IA_API_KEY`), **OpenRouter** (`OPENROUTER_API_KEY`) o directo con **Anthropic** (`ANTHROPIC_API_KEY`). El orden es ese: se usa el primero que esté configurado. Sin ninguno, todo sale en modo demo, marcado “Ejemplo”. Para escoger uno sin borrar variables, pon `IA_PROVEEDOR=ollama`, `api`, `openrouter` o `anthropic`.

#### IA externa con clave (la más simple para publicar y probar con el equipo)

No necesita tu computadora prendida ni túnel: la función de Vercel llama directo a la API.

1. Consigue una clave en tu proveedor (OpenAI, Gemini, Groq, DeepSeek… cualquiera compatible con OpenAI) y mira el nombre del modelo en su documentación.
2. En `.env.local` (o en Vercel → Settings → Environment Variables) pon `IA_API_KEY`, `IA_MODELO` y, si no es OpenAI, `IA_API_URL` (ver `.env.example` con las direcciones más comunes).
3. Para que el chat conteste sobre el **texto** de la bitácora y recuerde la conversación, igual que con la IA local, pon `IA_REGISTROS_EN_NUBE=1`. Sin eso, la IA externa solo ve los números ya calculados y de la bitácora solo tipo, cultivo y fecha. Con eso en 1, **el texto de las notas, el concepto de los últimos gastos y las últimas preguntas salen hacia tu proveedor de IA**: úsalo con datos de prueba o con el aviso de privacidad que corresponda.
4. En Vercel, **Redeploy** para que tome las variables. En tu computadora, reinicia `npm run dev`.

Las respuestas de la IA externa llevan la etiqueta **IA** (la local, **IA local**). Si el proveedor no acepta el formato estricto de respuesta, la app prueba con uno menos exigente sola. Los errores (clave mala, sin saldo, modelo que no existe) salen en español y nunca muestran la clave. Para volver a la IA local sin borrar nada: `IA_PROVEEDOR=ollama`.

#### IA local con Ollama (la que usamos para la demo)

Los datos del productor se quedan en tu computadora: el modelo corre ahí y la respuesta lleva la etiqueta **IA local**.

1. Instala [Ollama](https://ollama.com) y déjalo prendido.
2. Baja los modelos (nombres en ollama.com/library): `ollama pull qwen3:8b` (texto) y, solo si vas a probar la foto de la nota, `ollama pull qwen2.5vl:7b`.
3. En `.env.local` pon `OLLAMA_URL=http://localhost:11434` (ver `.env.example` para `OLLAMA_MODELO`, `OLLAMA_MODELO_VISION`, `OLLAMA_CTX` y `OLLAMA_TIMEOUT_MS`).
4. `npm run dev`. Para verla desde el celular en la misma red: `npm run dev -- --host`.
5. **Antes de presentar, haz una pregunta de calentamiento**: la primera tarda porque el modelo se carga en memoria (después queda 30 minutos cargado).

Con 8 GB de VRAM caben modelos de ~7-8B, pero no el de texto y el de visión a la vez: Ollama cambia entre ellos y el cambio tarda unos segundos.

**Publicada en Vercel (para probar con el equipo)**: la función de Vercel no puede ver tu `localhost`, así que Ollama se expone con un túnel de [ngrok](https://ngrok.com), que da una dirección fija y gratis y exige una contraseña antes de dejar pasar nada. Se configura una sola vez; después, cada sesión de pruebas son tres comandos.

*Una sola vez*
1. Publica la app en Vercel con los pasos de la sección anterior.
2. Crea una cuenta en ngrok, instala su programa ([download.ngrok.com](https://download.ngrok.com)) y conecta tu cuenta con `ngrok config add-authtoken TU_AUTHTOKEN` (lo ves en su panel).
3. Copia `ollama.example.yaml` como `ollama.yaml` y cambia `TU_CONTRASENA` por una contraseña larga. En cmd puedes generar una con: `powershell -Command "[guid]::NewGuid().ToString('N')+[guid]::NewGuid().ToString('N')"`.
4. Corre `npm run tunel`. ngrok muestra tu dirección fija, tipo `https://algo.ngrok-free.dev`. Se queda igual cada vez que lo reinicias.
5. En Vercel → Settings → Environment Variables agrega `OLLAMA_URL` (esa dirección, sin diagonal al final) y `OLLAMA_TOKEN` (la contraseña) → Deployments → Redeploy.

*Cada sesión de pruebas*
1. Prende Ollama (ver que `http://localhost:11434` diga "Ollama is running").
2. Calienta el modelo para que la primera pregunta no tarde: `curl.exe http://localhost:11434/api/generate -d "{\"model\":\"qwen3:8b\",\"keep_alive\":\"30m\"}"`.
3. `npm run tunel` y dejar esa terminal abierta. Tu computadora debe seguir prendida, con internet y sin suspenderse.
4. Al terminar, Ctrl+C en la terminal del túnel: la IA local deja de estar accesible. La app sigue funcionando, solo que el chat avisa que no está prendido Ollama.

Con esta forma, **los datos pasan por Vercel y por ngrok** antes de llegar a tu computadora (aunque el modelo corra en ella); ya no es 100 % local. Por eso va con contraseña y solo mientras pruebas. Ollama atiende una pregunta a la vez en una GPU de 8 GB: si varios del equipo preguntan al mismo tiempo, esperan turno (cada respuesta tarda unos segundos) y alguna puede agotar el tiempo; en ese caso basta repetirla.

**Si Ollama falla** (apagado, sin el modelo, muy lento) la app lo dice en español y **no** manda los datos a la nube, salvo que pongas `OLLAMA_RESPALDO=1` (entonces contesta la API externa, OpenRouter o Anthropic que tengas configurada).

**Qué ve el modelo en el chat** (cuando contesta Ollama, o una IA externa con `IA_REGISTROS_EN_NUBE=1`): los totales, el gasto por mes y los últimos 8 gastos (con su concepto recortado a 40 letras), las 40 notas más recientes de la bitácora **con el texto que escribió el productor**, y sus últimas 3 preguntas con sus respuestas, para entender "¿y la semana pasada?". El productor puede preguntar con sus propias palabras ("¿cuándo vi plaga y qué anoté?"). Los números siguen viniendo del código; si el modelo escribe una cifra que no está en los hechos ni en las notas, se le pregunta una vez más y, si insiste, no se muestra. No recomienda productos ni dosis: ante eso dice que consulte a un agrónomo.

**En tu computadora (para pruebas):**

1. Copia `.env.example` como `.env.local` (en Windows: `copy .env.example .env.local`).
2. Pon tu clave: `OPENROUTER_API_KEY=sk-or-...`. Deja `OPENROUTER_MODEL` vacío para usar **modelos gratuitos** (la lista está en `MODELOS_GRATIS`, en `api/ia.ts`): si uno está saturado o ya no existe, la app prueba el siguiente. Para usar otros, escríbelos en `OPENROUTER_MODEL` separados por comas (de openrouter.ai/models; para leer notas tienen que aceptar imágenes).
3. `npm run dev` (si ya estaba corriendo, apágalo con Ctrl+C y vuelve a correrlo). Ya no saldrá la etiqueta “Ejemplo”.

`.env.local` no se sube a git y la clave no llega al navegador.

**Publicada en Vercel:** tu proyecto → Settings → Environment Variables → agrega `OPENROUTER_API_KEY` (y `OPENROUTER_MODEL` si quieres otro) → Deployments → Redeploy.

Ponle un **límite de gasto** a tu clave en OpenRouter (Settings → Keys → Credit limit). La IA solo responde a quien entró con su usuario, pero cualquiera puede crear una cuenta; todavía no hay límite de uso por persona.

Los modelos gratuitos son más débiles y se saturan: a veces responden algo que la app rechaza (y lo dice) o tardan. Para la presentación conviene probar antes o usar el modo demo. Si un modelo no respeta el formato, la app no guarda nada y muestra un error amable; prueba con otro modelo. Con OpenRouter los datos pasan por OpenRouter y por el proveedor del modelo.

Las pantallas usan `#/` en la dirección, así que no hace falta configurar redirecciones. Ya publicada, en el celular: menú del navegador → “Agregar a pantalla de inicio”.

## Qué es real y qué está simulado

| Real (funciona de verdad) | Simulado o de ejemplo |
|---|---|
| **Cuentas** con usuario y contraseña (guardada con scrypt, nunca en texto), sesión en cookie segura de 60 días | **Pago del plan**: botón simulado, no cobra nada (sí queda guardado en el ciclo) |
| **Base de datos Postgres**: ciclos, gastos, bitácora, anuncios con foto, publicaciones y respuestas | **Promedios de zona**: inventados, marcados “datos de ejemplo”. Solo la referencia de FIRA (~$48,400/ha maíz) es pública |
| **Varios ciclos** por cuenta (OI y PV); se abre el que quieras desde Más | **Ofertas de tiendas**: de ejemplo |
| Registro y borrado de gastos, costo por ha y por tonelada, desde qué precio gana | **Calculadora de la portada**: usa los números de “Don Juan”, de ejemplo |
| Reparto de gastos generales por hectárea | **Apoyo por tonelada y venta en grupo**: rangos de ejemplo en `REFERENCIAS` (`src/lib/palancas.ts`) |
| **Bitácora sellada por el servidor**: la fecha la pone la base de datos y un *trigger* de Postgres impide cambiar cualquier nota, incluso con acceso directo a la base | **IA sin clave**: respuestas fijas marcadas “Ejemplo” |
| Mercado entre usuarios: publicar con foto, filtros, WhatsApp (`wa.me`), quitar tu anuncio | |
| Comunidad entre usuarios: publicar y responder | |
| Cada quien solo ve y cambia lo suyo (probado: nadie abre ni borra el ciclo, gasto o anuncio de otro) | |
| Reglas de precio por temporada, expediente en CSV e impresión | |
| **Ponte en verde** y la **IA** (local con Ollama, o con clave) (foto de la nota, dictado, plan y chat), solo para usuarios que entraron | |

## La IA: qué hace y qué no

**Regla de oro: las cuentas las hace el código, la IA solo explica y propone.**

- **Ponte en verde** (tarjeta del cultivo, cuando va perdiendo): el código calcula cuánto bajar por hectárea, cuántas toneladas necesita y a qué precio tendría que vender, y arma la lista de acciones con su ahorro. La IA solo escoge de 3 a 5 y las redacta. Si propone una acción que no está en la lista o escribe cifras, el plan se rechaza. El simulador usa la mitad de cada rango y, si dos acciones bajan el mismo gasto, cuenta solo la mayor.
- **MedPlant** (pestaña junto a Bitácora): el productor toma o elige la foto de una planta, dice qué cultivo es y, si quiere, qué notó. La IA describe **solo lo que se ve**, da hasta 3 causas posibles con su grado de certeza (nunca afirma una plaga o enfermedad como hecho) y pasos sencillos y seguros (revisar el envés, ver si se repite, anotar desde cuándo, tomar otra foto). Si la foto no sirve, dice cómo tomarla mejor; si no es una planta, lo dice. Antes de mostrar nada, el código **quita cualquier línea con agroquímicos o dosis** aunque el modelo la escriba, recorta los textos, no deja afirmar "sana" o "con problema" sin nada que se vea y, si hay un problema, **siempre manda con un agrónomo**. Siempre se muestra un aviso: es una orientación, no un diagnóstico. Si hay detalles o un problema, el productor puede guardar el resumen (no la foto) en su bitácora como nota de tipo Plaga; la nota queda sellada como cualquier otra. Sin IA conectada muestra un resultado fijo marcado "Ejemplo".
- **Foto de la nota y dictado**: la IA llena el formulario; nada se guarda hasta que el productor revisa y toca Guardar. El dictado usa el reconocimiento de voz del navegador (Chrome o Safari), así que el audio lo procesa Google o Apple; también se puede escribir la frase.
- **Pregúntale a tus números** (Más): el código calcula los números permitidos (totales, gasto por mes, últimos gastos, resumen de la bitácora); si la respuesta trae un número que no está ahí, se pregunta una vez más y, si insiste, no se muestra. Si le preguntan otra cosa, contesta que solo ve sus números. Acepta preguntas como “Hazme un resumen de mi temporada” o “¿Cuál fue mi último gasto?”.
- Nunca recomienda marcas ni dosis de agroquímicos; en plagas manda con un agrónomo o la junta local de sanidad vegetal. Nunca promete apoyos: dice “revisa si calificas”.
- **Privacidad**: al modelo no le llega nombre, teléfono ni municipio; con OpenRouter o Anthropic, de la bitácora solo van tipo, cultivo y fecha. **Con Ollama** el chat también lee el texto de las notas y la conversación, y el concepto de los últimos gastos; corriendo todo en tu computadora, nada de eso sale de ella (publicada en Vercel pasa por Vercel y ngrok). El servidor descarta las notas y la conversación si contesta una IA externa y no pusiste `IA_REGISTROS_EN_NUBE=1`, aunque la pantalla las mande. La foto de la nota sí se manda completa (puede traer el nombre de la tienda). **La foto de MedPlant** también se manda completa al modelo que esté activo (con Ollama, a tu computadora; con una IA externa, a tu proveedor), se reduce antes a 1280 px y **no se guarda en ningún lado** de la app.


Los precios del plan están en un solo lugar: `src/lib/precio.ts`.

Privacidad: no se pide INE, CURP, CLABE ni ubicación; el mercado solo muestra el municipio; la comparación por zona no aparece si el grupo tiene menos de 5 productores (`MIN_PRODUCTORES_ZONA` en `src/lib/calculos.ts`).

## Lo que todavía no hace

- **WhatsApp real**: solo abre WhatsApp con un mensaje listo; no hay chat ni avisos dentro de la app.
- **IA probada con clave real**: el código está probado en modo demo y con respuestas simuladas de OpenRouter, pero no se ha corrido contra OpenRouter ni Anthropic con una clave real. Pruébala con `npm run dev` y tu `.env.local` antes de presentarla.
- **MedPlant: historial y calidad.** No guarda las fotos ni los análisis (solo el resumen si el productor lo manda a la bitácora), así que no se puede comparar una planta con su foto de hace una semana. Con IA local, un modelo de visión chico (qwen2.5vl:7b) ve mucho menos que uno externo: para MedPlant conviene una IA externa con visión (`IA_MODELO_VISION`) o probar varias fotos antes de la demo. No está validado por un agrónomo.
- **Extras de IA**: aviso semanal contra lo planeado (falta capturar un presupuesto), sugerencia de anuncio en el mercado y resumen del expediente para la financiera.
- **Límite de uso por productor** en la función de IA, y límite de intentos al entrar (hoy se puede probar contraseñas sin freno).
- **Recuperar contraseña**: no se pide correo ni teléfono, así que si se olvida no hay cómo recuperarla.
- **Pagos reales**: no hay cobro (Mercado Pago, Stripe, OXXO, etc.).
- **Sin señal**: la app abre sin señal, pero los datos vienen del servidor; sin conexión no se ven ni se guardan. Falta guardar una copia en el celular y mandarla cuando vuelva la señal.
- **Promedios de zona reales**: la base ya junta los gastos de todos; falta calcular el promedio por municipio con 5 o más productores en lugar de los datos de ejemplo.
- **Editar el ciclo** (cambiar hectáreas o agregar un cultivo después de crearlo) y cambiar nombre o municipio de la cuenta.
- **Varias parcelas por cuenta**: el plan de pago lo promete; en la demo cada cultivo cuenta como una sola parcela.
- **Moderación** de anuncios y publicaciones.

## Cómo está hecho

Vite + React + TypeScript + Tailwind. Iconos de `lucide-react`, letras Lexend y Overpass. Postgres (`pg` en producción, PGlite en tu computadora). Funciones de Vercel en `api/`.

```
src/lib/precio.ts      reglas de precio (con pruebas)
src/lib/calculos.ts    costos, zona, ofertas, CSV (con pruebas)
src/lib/palancas.ts    palancas, acciones con ahorro y simulador (con pruebas)
src/lib/hechos.ts      números que puede usar el chat (con pruebas)
src/lib/ia.ts          puerta a la IA, modo demo y validaciones (con pruebas)
src/lib/ia-tareas.ts   qué pide y qué responde cada tarea (lo comparten navegador y servidor)
api/ia.ts              función que llama a la IA (Ollama, OpenRouter o Anthropic); solo con sesión
api/cuenta.ts          crear cuenta, entrar y salir
api/datos.ts           leer y cambiar los datos del usuario que entró
server/esquema.ts      tablas, trigger de la bitácora y cuenta de prueba (se crean solas)
server/acciones.ts     qué puede hacer cada usuario, validado antes de tocar la base
server/db.ts           conexión: DATABASE_URL o PGlite en .datos/
tests/                 pruebas del servidor y la base (con PGlite; con TEST_DATABASE_URL, contra un Postgres real)
src/lib/api.ts         puerta a la base desde el navegador
src/lib/datos.ts       tipos, listas y datos de ejemplo de la portada
src/pantallas/         una pantalla por archivo
src/ui.tsx             botones, campos y tarjetas compartidas
```

El guion para jueces está en [GUION-DEMO.md](GUION-DEMO.md).
