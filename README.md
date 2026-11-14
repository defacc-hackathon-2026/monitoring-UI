# Open Witness · Monitor

Interfaz web **de solo lectura** para vigilar en vivo lo que pasa por el gateway de
[Open Witness](https://github.com/defacc-hackathon-2026/LasNewjeans-OpenWitness): sesiones, línea de tiempo con la
procedencia de cada entrada, estado de integridad de la bitácora, alertas y atribución de cada acción
(SPEC §17.5, meta G14).

Consume la API de `owit monitor`, un proceso aparte que solo **lee** `data/` (nunca tiene la llave del gateway ni los
tokens de sesión: es el papel del auditor).

## Qué muestra

- **Sesiones**: usuario, agente, upstream, última actividad, insignia de integridad (*íntegra hasta seq N, anclada
  hasta M*, *pendiente de ancla* o **FALLA** con la comprobación que falló) y contadores. Las sesiones en FALLA van
  arriba.
- **Línea de tiempo**: cada entrada de la bitácora con el color de su procedencia (`usuario firmado`, `sin firma`,
  `mcp:*`, `builtin:*`, `modelo`, `agente`, `hook`, `gateway`), las anclas como separadores y lo nuevo resaltado al
  llegar. Filtros: todo, contenido, acciones y decisiones; "seguir en vivo".
- **Detalle de una acción** (clic en una `ACCIÓN`): el veredicto (`USER_INSTRUCTED` con no repudio, `TOOL_INJECTED`
  parcial o no, `AMBIGUOUS`, `MODEL_INITIATIVE`, `UNVERIFIABLE`), de dónde salió cada argumento y el contexto exacto
  que vio el modelo, con el argumento resaltado en el fragmento de la herramienta que lo aportó.
- **Alertas**: bitácora que no verifica (crítica), acción atribuida a una herramienta, herramienta quitada por su
  manifiesto o denegada por el hook, anomalías, `history_mismatch` y texto sin firma (info).

La atribución en vivo es **provisional**: solo reglas, nunca el juez LLM, y pasa a `UNVERIFIABLE` si después falla la
verificación de la bitácora.

## Diseño

Neutros limpios (claro y oscuro), Newsreader para lo que se lee e IBM Plex Mono para lo que se registra. Cuatro
colores con significado: **verde** = el usuario y su firma, **azul** = lo que trajo una herramienta, **gris** = el
modelo, **rojo** = inyectado, alterado o roto (y ámbar para lo ambiguo o sin firma).

Lo visual va primero y el texto queda en desplegables:
- cada sesión muestra una barra con un segmento por acción, del color de su veredicto;
- la línea de tiempo es la cadena por carriles de actor (usuario, agente, modelo, herramientas, gateway), con las
  anclas como sellos y la cadena punteada en rojo desde el primer eslabón alterado; cada fila es una línea que se
  despliega para ver el texto completo;
- cada acción es una tarjeta con su insignia (INYECTADO, FIRMADO, NO VERIFICABLE) y de dónde salió cada argumento;
  la frase en castellano está en "en palabras";
- el detalle de una acción es un diagrama: un hilo de cada argumento al fragmento donde apareció. La firma, la regla
  y el contexto completo están en desplegables debajo.

## Stack

React 19 + Vite 8, TypeScript 7 (el compilador nativo, para el chequeo de tipos) y SWC
(`@vitejs/plugin-react-swc`) para transformar el código. Tailwind CSS v4. Sin librerías de UI ni de estado: un
`useReducer` alimentado por `EventSource` (`/api/events`).

## Uso

En el repo de Open Witness, arranca el monitor (API en `127.0.0.1:8790`):

```bash
uv run owit monitor --demo --live      # bitácoras de la demo + sesiones nuevas en vivo
uv run owit monitor --data data --registry keys/registry.json   # las de un gateway real
```

Aquí, en desarrollo (Vite reenvía `/api` al monitor; otra URL con `OWIT_MONITOR_URL`):

```bash
npm install
npm run dev
```

Para la demo sin red, compila y deja que el propio monitor sirva la página:

```bash
npm run build
uv run owit monitor --demo --ui ../monitoring-UI/dist     # desde el repo de Open Witness
```

Si el monitor escucha fuera de `127.0.0.1` exige un token: abre la página con `?token=<token>` (se guarda solo en
`sessionStorage` de la pestaña).

Enlaces directos: `#/s/<sid>` abre una sesión y `#/s/<sid>/a/<seq>` una acción.

## Privacidad

El monitor muestra a quién se le atribuye cada acción, así que se trata como el acceso de un auditor: escucha en
`127.0.0.1` por defecto, los fragmentos se recortan a 280 caracteres y con `owit monitor --no-content` solo se ven
metadatos y hashes (la UI lo indica con la insignia "sin contenido").

## Uso de IA

Escrito con Claude Code (Claude Opus 5.5) y revisado por Andres.
