# Design

## World: letreros de carretera

El mundo visual de Mi Ciclo son los letreros que el productor ve camino a la parcela: el verde de los letreros de destino con su filo blanco reflejante, el amarillo de los preventivos, el asfalto con su raya amarilla y el tablero de la caseta. Da máximo contraste al sol y se siente del campo, no de una startup.

- **Portada (Persuade):** el mundo carga la página. El primer letrero es una calculadora que funciona y su respuesta va arriba ("Desde aquí ganas $4,800/t"). Siguen las tres salidas a los lados de la raya amarilla, el letrero preventivo de la IA, la caseta de tarifas, el tablero para el jurado y el letrero de llegada. Cada letrero se para sobre sus postes.
- **App (Operate):** el mundo solo presta la letra, la paleta y una firma. La firma es la cabecera verde de la tarjeta de cada cultivo, que da el costo por tonelada. Los controles son los estándar.

## Tokens (src/index.css, `@theme`)

| Token | Valor | Uso |
|---|---|---|
| `--color-campo` | `#00613f` | Verde de letrero: fondos de letrero, botón principal |
| `--color-campo-hondo` | `#00492f` | Letrero principal sobre fondo verde |
| `--color-campo-claro` | `#dbeae1` | Selección y estado activo en la app |
| `--color-maiz` | `#f5c211` | Amarillo preventivo: avisos, "va perdiendo", raya central |
| `--color-maiz-claro` | `#fdf1c4` | Avisos suaves en la app |
| `--color-asfalto` | `#24282b` | Fondo de la carretera, tinta sobre amarillo |
| `--color-asfalto-claro` | `#3a3f43` | Segundo tono de asfalto |
| `--color-fondo` | `#e9eee9` | Fondo de la app |
| `--color-tinta` / `--color-tinta-2` | `#161b18` / `#44504a` | Texto |
| `--color-pierde` | `#a3241b` | Pérdidas en la app |
| `--font-senal` | Overpass 800/900 | Títulos y cifras (derivada de la letra de carretera) |
| `--font-sans` | Lexend 400/700 | Texto |

Base de 20 px; objetivos táctiles de 56 px o más.

## Firmas

- `.letrero`: verde, esquina de 1rem, filo blanco de 3px metido 9px hacia adentro y sombra suave hacia abajo. El preventivo es igual, en amarillo con filo negro.
- `Escudo` (`src/ui.tsx`): escudo de carretera federal con "MI CICLO · SINALOA". Es la marca.
- Postes grises bajo los letreros de la portada.
- Pestaña amarilla "SALIDA n | destino" que lleva a la pantalla de la app.

## Reglas

- Ninguna cifra se escribe a mano: sale de las funciones probadas de `src/lib`.
- Todo material ilustrativo se marca como "datos de ejemplo".
- No hay rayas laterales, tarjetas dentro de tarjetas ni etiquetas pequeñas sobre los títulos.
- No exagerar la señalética al punto de parecer de gobierno: no hay escudos oficiales ni logos.
