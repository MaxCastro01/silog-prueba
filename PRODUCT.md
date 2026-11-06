# Product

Mi Ciclo (nombre provisional): app para pequeños y medianos productores agrícolas de Sinaloa con una sola misión, bajarles el costo de producir.

## Platform

web

## Stack

Vite + React + TypeScript + Tailwind v4, PWA instalable. Cuentas con usuario y contraseña; datos en Postgres (Neon en Vercel, PGlite en la computadora). Funciones de Vercel en `api/` (cuenta, datos, ia). La IA va por Ollama (local, primero si hay `OLLAMA_URL`), una API externa con clave (`IA_API_KEY`, compatible con OpenAI), OpenRouter (modelos gratuitos) o Anthropic; sin ninguno, modo demo.

## Users

- **Productores** de maíz, sorgo, garbanzo, frijol, trigo y hortalizas en Sinaloa, de 2 a 100+ ha, muchos de más de 50 años. Usan el celular en la mano, en el campo, al sol. Lenguaje del productor: "lo que llevas gastado", "a cómo te sale la tonelada".
- **Jueces de Enactus México** y aliados: evalúan impacto, viabilidad y modelo de negocio.
- La portada habla a los dos: arriba lo que gana el productor; abajo los datos que buscan los jueces.

## Product Purpose

Resolver tres problemas conectados:
1. "No sé cuánto me cuesta producir": registra gastos y muestra costo por hectárea, por tonelada y desde qué precio gana.
2. "Pago de más y no tengo con qué comparar": compara con el promedio de su zona y un mercado entre vecinos para comprar, vender o rentar equipo.
3. "Cuando necesito demostrar algo, no tengo papeles": bitácora con fecha que no se puede cambiar y expediente para crédito o seguro.

La IA solo explica y propone ("Ponte en verde", captura por foto o voz, "Pregúntale a tus números", y MedPlant, que orienta sobre la foto de una planta sin recetar productos ni dosis); todas las cuentas las hace el código.

## Positioning

Una herramienta de cuentas claras hecha para el campo de Sinaloa, no una app de tecnología. Cobra por temporada: gratis hasta 10 ha; más de 10 ha, $40 por hectárea (mínimo $500); más de 100 ha, $4,000 fijo.

## Operating Context

Contexto 2026: producir maíz costó más de lo que se pagó; el 92.8 % de los productores de Sinaloa dice que su principal problema es el alto costo de insumos y servicios (dato dado por el equipo). Referencia pública de FIRA: ~$48,400/ha en maíz.

## Capabilities and Constraints

- Maqueta en producción: cuentas reales y base de datos; cuenta de prueba `prueba` / `campo2026` que empieza vacía. Pagos simulados. Promedios de zona, ofertas de tiendas y la calculadora de la portada ("Don Juan") son de ejemplo.
- WhatsApp solo por enlace `wa.me`; nada de bot general.
- La IA local (Ollama) corre en la computadora del equipo: la primera respuesta tarda mientras carga el modelo y la computadora debe estar prendida. Los modelos gratuitos de OpenRouter pueden tardar o saturarse.

## Brand Commitments

- Nada que parezca startup de tecnología ajena al campo.
- Nada de caricatura ni estética infantil (granjitas, vaquitas, colores de juguete).
- Letra grande, botones grandes, alto contraste, pocas palabras.

## Evidence on Hand

No hay fotos, testimonios ni logo reales todavía. Todo material visual es ilustrativo y debe marcarse como tal; ningún testimonio, cliente ni cifra de impacto se inventa.

## Product Principles

- Las cuentas las hace el código, la IA solo explica y propone.
- El productor decide; la app sugiere.
- Nunca recomendar marcas ni dosis de agroquímicos; nunca prometer apoyos de gobierno.
- Las ofertas de tiendas siempre dicen "Oferta" y nunca aparecen junto a un aviso de plaga.

## Accessibility & Inclusion

Personas mayores de 50 años, al sol: contraste AA o mejor, texto base de 20 px, objetivos táctiles de 56 px o más, español sencillo. Privacidad: no se pide INE, CURP, CLABE ni ubicación exacta; comparaciones por zona nunca con grupos de menos de 5 productores.
