# Panel de Horarios

App para que un grupo de amigos meta sus horarios y vea de un vistazo cuándo
coincide todo el mundo libre. Estética de panel de estación: casillas que se
"encienden" según cuánta gente está libre en esa franja.

## Software que necesitas instalar (una vez)

1. **Node.js** (versión 18 o superior). Descárgalo de https://nodejs.org —
   trae `npm` incluido. Compruébalo con:
   ```
   node -v
   npm -v
   ```
2. **Un editor de código**, por ejemplo VS Code (https://code.visualstudio.com).
3. **Una cuenta gratuita en Supabase** (https://supabase.com) — hace de base
   de datos. No hace falta instalar nada local, es un servicio en la nube.
4. (Opcional pero recomendado) **Git** y una cuenta de GitHub, si luego
   queréis desplegar la app en algo como Vercel o Netlify.

No hace falta instalar nada más: no hay backend propio que mantener, todo el
código corre en el navegador y habla directamente con Supabase.

## Puesta en marcha

### 1. Instalar dependencias del proyecto

Dentro de la carpeta del proyecto:

```
npm install
```

### 2. Crear el proyecto en Supabase

1. Entra en https://supabase.com, crea una cuenta y pulsa "New project".
2. Cuando esté listo, ve a **SQL Editor** → **New query**, pega el
   contenido de `supabase/schema.sql` y pulsa "Run". Esto crea la tabla
   `schedules` donde se guardan los horarios de todos.
3. Ve a **Project Settings → API**. Copia:
   - **Project URL**
   - **anon public key**

### 3. Configurar las variables de entorno

Copia `.env.example` a un fichero nuevo llamado `.env` y rellena los dos
valores que copiaste de Supabase:

```
cp .env.example .env
```

### 4. Arrancar la app en local

```
npm run dev
```

Abre la URL que te muestre la terminal (normalmente `http://localhost:5173`).

## Cómo se usa

- Cada persona entra con su nombre y un **código de grupo** compartido
  (por ejemplo `ing-4b`) — no hace falta contraseña, el código hace de
  "llave" del grupo.
- En la pestaña **Mi horario**, cada uno marca sus horas de clase/ocupado.
- En la pestaña **Disponibilidad del grupo**, se ve el mapa de calor: cuanto
  más intenso el color, más gente libre en esa franja. Pasando el ratón por
  una casilla se ve quién exactamente está libre.

## Estructura del proyecto

```
src/
  components/
    JoinGroup.jsx      → pantalla de entrada (nombre + código de grupo)
    ScheduleGrid.jsx    → rejilla donde cada uno marca su propio horario
    GroupHeatmap.jsx    → mapa de calor con la disponibilidad conjunta
  lib/
    supabaseClient.js   → conexión a Supabase
    timeSlots.js        → configuración de días/horas de la rejilla
  App.jsx               → conecta todo: sesión, carga y guardado de datos
supabase/
  schema.sql            → script para crear la tabla en Supabase
```

## Personalización rápida

- **Rango de horas o días**: edita `src/lib/timeSlots.js` (`START_HOUR`,
  `END_HOUR`, `DAYS`).
- **Colores**: edita `tailwind.config.js` (paleta `board`).
- **Franjas de 15 o 60 min en vez de 30**: cambia `SLOT_MINUTES` en
  `timeSlots.js`.

## Siguientes pasos posibles

- Desplegar en Vercel o Netlify (gratis) conectando el repositorio de GitHub.
- Añadir el nombre de la asignatura al marcar una franja, no solo
  ocupado/libre.
- Exportar la franja común elegida como evento de calendario.
