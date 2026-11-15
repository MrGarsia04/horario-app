// Capturas de pantalla de la app con datos de ejemplo (Supabase simulado: no toca ninguna base real).
// Uso: arrancar `VITE_SUPABASE_URL=http://127.0.0.1:54321 VITE_SUPABASE_ANON_KEY=x npx vite --port 5190`
// y luego `node scripts/capturas.mjs`. Salida: capturas-fase-2/
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const BASE = process.env.BASE ?? 'http://localhost:5190'
const OUT = new URL(`../${process.env.CAPTURAS_DIR ?? 'capturas-fase-2'}/`, import.meta.url).pathname
const SOLO_MOVIL = process.env.SOLO_MOVIL === '1'
mkdirSync(OUT, { recursive: true })
const exe = process.env.CHROME ?? join(homedir(), '.cache/ms-playwright/chromium-1248/chrome-linux64/chrome')

const ME = '00000000-0000-0000-0000-000000000001'
const others = { '00000000-0000-0000-0000-000000000002': 'Ana', '00000000-0000-0000-0000-000000000003': 'Beto', '00000000-0000-0000-0000-000000000004': 'Carla' }
const names = { [ME]: 'Iker', ...others }
const T = (u) => ({ id: 't-' + u.slice(-1), user_id: u, name: 'Clases', is_active: true, active_from: null, active_to: null, color: '#4C7C7C', every_n_weeks: 1, anchor_week: null, sort_order: 0, created_at: '2026-01-01' })
// Capas extra de Iker: una quincenal y otra desactivada
const monday = (() => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.toISOString().slice(0, 10) })()
const extraLayers = [
  { ...T(ME), id: 't-q', name: 'Prácticas', color: '#C0504D', every_n_weeks: 2, anchor_week: monday, created_at: '2026-01-02' },
  { ...T(ME), id: 't-off', name: 'Verano', color: '#4CAF7A', is_active: false, created_at: '2026-01-03' },
]
const B = (u, i, day, s, e, title, color, repeat = 'weekly') => ({ id: `b${u.slice(-1)}${i}`, template_id: 't-' + u.slice(-1), user_id: u, group_code: null, title, color, location: null, day, start_min: s, end_min: e, repeat, valid_from: null, valid_to: null })
const blocks = [
  B(ME, 1, 'mon', 540, 630, 'Cálculo', '#4C7C7C'), B(ME, 2, 'mon', 720, 810, 'Física', '#5B8DEF'), { ...B(ME, 3, 'tue', 600, 720, 'Prácticas', null), template_id: 't-q' },
  B(ME, 4, 'wed', 540, 660, 'Álgebra', null), B(ME, 5, 'thu', 780, 870, 'Inglés', '#4CAF7A'), { ...B(ME, 6, 'fri', 600, 690, 'Lab', null), template_id: 't-q' }, { ...B(ME, 7, 'mon', 900, 1020, 'Playa', null), template_id: 't-off' },
  B('00000000-0000-0000-0000-000000000002', 1, 'mon', 570, 660, null, null), B('00000000-0000-0000-0000-000000000002', 2, 'tue', 540, 780, null, null),
  B('00000000-0000-0000-0000-000000000003', 1, 'mon', 600, 720, null, null), B('00000000-0000-0000-0000-000000000003', 2, 'wed', 540, 660, null, null), B('00000000-0000-0000-0000-000000000003', 3, 'thu', 840, 960, null, null),
  B('00000000-0000-0000-0000-000000000004', 1, 'tue', 600, 690, null, null), B('00000000-0000-0000-0000-000000000004', 2, 'fri', 540, 720, null, null),
]
const templates = [...Object.keys(names).map(T), ...extraLayers]
const config = { days: ['mon', 'tue', 'wed', 'thu', 'fri'], startTime: '09:00', endTime: '19:00', slotMinutes: 90, breaks: [] }

const rows = {
  profiles: [{ id: ME, username: 'Iker', auth_id: ME, birthday: null, bio: null }, ...Object.entries(others).map(([id, username]) => ({ id, username, auth_id: id, birthday: null, bio: null }))],
  profile_private: [{ profile_id: ME, contact_email: 'iker@correo.com' }],
  group_memberships: Object.keys(names).map((u, i) => ({ user_id: u, group_code: 'informaticos', role: i === 0 ? 'owner' : 'member', joined_at: '2026-01-0' + (i + 1), schedule_visibility: 'busy' })),
  group_settings: [{ group_code: 'informaticos', config, updated_at: '2026-01-01' }],
  schedules: [], schedule_overrides: [], friendships: [], events: [], event_invitations: [],
  schedule_templates: templates.filter((t) => t.user_id === ME), schedule_blocks: blocks.filter((b) => b.user_id === ME), schedule_exceptions: [],
}

async function mockSupabase(context) {
  await context.route('http://127.0.0.1:54321/**', async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': '*' }
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
    const json = (body, status = 200) => route.fulfill({ status, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(body) })
    if (url.pathname.startsWith('/rest/v1/rpc/')) {
      const fn = url.pathname.split('/').pop()
      if (fn === 'group_schedules') {
        return json({ visibility: Object.fromEntries(Object.keys(names).map((u) => [u, 'busy'])), templates, blocks: blocks.map((b) => (b.user_id === ME ? b : { ...b, title: null, color: null })), exceptions: [] })
      }
      if (fn === 'get_invite_code') return json('a1b2c3d4e5f60718293a4b5c')
      if (fn === 'ensure_default_layer') return json('t-1')
      return json(null)
    }
    if (url.pathname.startsWith('/rest/v1/')) {
      const table = url.pathname.split('/').pop()
      let data = rows[table] ?? []
      // filtros básicos de PostgREST: col=eq.valor y col=in.(a,b)
      for (const [col, val] of url.searchParams) {
        if (val.startsWith('eq.')) data = data.filter((r) => String(r[col]) === val.slice(3))
        else if (val.startsWith('in.(')) data = data.filter((r) => val.slice(4, -1).split(',').includes(String(r[col])))
      }
      const single = (req.headers()['accept'] ?? '').includes('vnd.pgrst.object')
      if (single) {
        return data[0] ? json(data[0]) : route.fulfill({ status: 406, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify({ code: 'PGRST116', message: 'no rows', details: '', hint: null }) })
      }
      return json(data)
    }
    return json({})
  })
}

const session = JSON.stringify({
  access_token: 'x.y.z', refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: { id: ME, aud: 'authenticated', role: 'authenticated', email: 'u@usuarios.horario-app.com', user_metadata: { username: 'Iker' } },
})

const browser = await chromium.launch({ executablePath: exe })
const sizes = [['movil-390x844', 390, 844, 3], ['movil-360x740', 360, 740, 3], ['escritorio-1280', 1280, 800, 1]]
const themes = ['panel', 'rosa']

for (const [label, width, height, dpr] of sizes) {
  for (const theme of themes) {
    if (SOLO_MOVIL && label !== 'movil-390x844') continue
  if (label !== 'movil-390x844' && theme === 'rosa') continue // rosa solo en el móvil principal
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr === 3 ? 2 : 1, hasTouch: dpr === 3, isMobile: dpr === 3 })
    await mockSupabase(context)
    await context.addInitScript(([s, t]) => {
      localStorage.setItem('sb-127-auth-token', s)
      localStorage.setItem('horario-app-theme', t === 'rosa' ? 'rosa' : 'panel')
      if (!sessionStorage.getItem('ver-tutorial')) { localStorage.setItem('opf-tutorial-v1', '1'); localStorage.setItem('opf-tutorial-v2', '1') }
    }, [session, theme])
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    const shot = async (name) => page.screenshot({ path: `${OUT}${label}-${theme}-${name}.png` })
    const goto = async (path) => { await page.goto(BASE + path); await page.waitForTimeout(900) }

    if (process.env.FLOW === '3d') {
      // Recorrido guiado desde cero (tutorial sin marcar) + Planes y Grupo con los cambios de la fase 3d
      await goto('/grupos')
      await page.evaluate(() => { sessionStorage.setItem('ver-tutorial', '1'); localStorage.removeItem('opf-tutorial-v2') })
      await goto('/g/informaticos')
      await shot('1-tour-inicio')
      const next = page.getByRole('button', { name: /^(Empezar|Siguiente)$/ })
      let n = 2
      for (let k = 0; k < 7; k++) {
        if (!(await next.isVisible().catch(() => false))) break
        await next.click()
        await page.waitForTimeout(900)
        await shot(`${n++}-tour-paso`)
      }
      const listo = page.getByRole('button', { name: 'Listo' })
      if (await listo.isVisible().catch(() => false)) await listo.click()
      await page.waitForTimeout(300)
      await goto('/g/informaticos/grupo')
      await shot('9-grupo-ventana-auto')
      await page.getByRole('button', { name: /^Ver:/ }).click()
      await page.waitForTimeout(300)
      await shot('9b-vista-automatico')
      await page.getByRole('tab', { name: 'Personalizado' }).click()
      await page.getByLabel('Desde las').selectOption('720')
      await page.getByLabel('Hasta las').selectOption('1080')
      await page.getByRole('button', { name: 'Jue', exact: true }).click()
      await page.getByRole('button', { name: 'Vie', exact: true }).click()
      await shot('9c-vista-personalizada')
      await page.getByRole('button', { name: 'Aplicar' }).click()
      await page.waitForTimeout(400)
      await shot('9d-mapa-vista-propia')
      await goto('/planes')
      await shot('10-planes-semana')
      await page.getByRole('button', { name: 'Semana siguiente' }).click()
      await page.waitForTimeout(500)
      await shot('11-planes-otra-semana')
      await page.getByRole('button', { name: 'Ajustes' }).click()
      await page.waitForTimeout(300)
      await shot('12-ajustes')
      await page.getByRole('button', { name: 'Cerrar' }).first().click()
    } else {
    await goto('/g/informaticos')
    await shot('1-horario')
    await page.getByRole('tab', { name: /^Capas/ }).click()
    await page.waitForTimeout(300)
    await shot('2-capas')
    await page.getByRole('button', { name: 'Editar' }).first().click()
    await page.waitForTimeout(300)
    await shot('3-capa-nombre')
    await page.getByRole('button', { name: /Bloques/ }).first().click()
    await page.waitForTimeout(300)
    await shot('4-capa-bloques')
    await page.getByRole('button', { name: 'Bloque', exact: true }).click()
    await page.waitForTimeout(300)
    await shot('5-capa-bloque-nuevo')
    await page.getByRole('button', { name: 'Cerrar' }).last().click()
    await page.getByRole('button', { name: /Cuándo/ }).click()
    await page.waitForTimeout(300)
    await shot('6-capa-cuando')
    await page.getByRole('button', { name: 'Cerrar' }).first().click()
    await goto('/g/informaticos/grupo')
    await shot('7-grupo-1h')
    await page.getByRole('button', { name: '30 min' }).click()
    await page.waitForTimeout(300)
    await shot('8-grupo-30min')
    await page.getByRole('button', { name: '1 hora' }).click()
    await page.getByRole('button', { name: 'Solo cuando yo estoy libre' }).click()
    await page.waitForTimeout(200)
    await shot('9-grupo-solo-yo')
    await page.getByRole('button', { name: 'Solo cuando yo estoy libre' }).click()
    await page.locator('button[aria-label*="libres"]').nth(12).click()
    await page.waitForTimeout(300)
    await shot('10-franja')
    await page.getByRole('button', { name: 'Cerrar' }).last().click()
    await goto('/planes')
    await shot('11-planes')
    await goto('/perfil')
    await shot('12-perfil')
    await page.getByRole('button', { name: 'Ajustes' }).click()
    await page.waitForTimeout(300)
    await shot('13-ajustes')
    await page.getByRole('button', { name: 'Cerrar' }).first().click()
    }
    if (errors.length) console.log(label, theme, 'ERRORES:', errors.slice(0, 3))
    await context.close()
  }
}
await browser.close()
console.log('Capturas en', OUT)
