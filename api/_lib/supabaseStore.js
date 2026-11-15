// Implementación del `store` de recuperar.js sobre Supabase (service role: solo servidor).
import { createClient } from '@supabase/supabase-js'

export function createStore(url, serviceKey) {
  const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const must = ({ data, error }) => {
    if (error) throw new Error(error.message)
    return data
  }

  return {
    async findProfileByUsername(name) {
      // ilike con el texto escapado = comparación sin distinguir mayúsculas
      const escaped = name.replace(/[\\%_]/g, (c) => `\\${c}`)
      const rows = must(await db.from('profiles').select('id, username, auth_id').ilike('username', escaped).limit(1))
      return rows[0] ?? null
    },
    async getContactEmail(profileId) {
      const row = must(await db.from('profile_private').select('contact_email').eq('profile_id', profileId).maybeSingle())
      return row?.contact_email ?? null
    },
    async countRequests({ profileId, ipHash, since }) {
      let q = db.from('recovery_requests').select('id', { count: 'exact', head: true }).gte('requested_at', since.toISOString())
      if (profileId) q = q.eq('profile_id', profileId)
      if (ipHash) q = q.eq('ip_hash', ipHash)
      const { count, error } = await q
      if (error) throw new Error(error.message)
      return count ?? 0
    },
    async logRequest({ profileId, ipHash, at }) {
      must(await db.from('recovery_requests').insert({ profile_id: profileId, ip_hash: ipHash, requested_at: at.toISOString() }))
    },
    async saveCode(profileId, codeHash, expiresAt) {
      must(await db.from('recovery_codes').upsert(
        { profile_id: profileId, code_hash: codeHash, expires_at: expiresAt.toISOString(), attempts: 0 },
        { onConflict: 'profile_id' }
      ))
    },
    async getCode(profileId) {
      return must(await db.from('recovery_codes').select('code_hash, expires_at, attempts').eq('profile_id', profileId).maybeSingle())
    },
    async bumpAttempts(profileId) {
      // Atómico en SQL: dos peticiones simultáneas no pueden saltarse el límite.
      const { data, error } = await db.rpc('bump_recovery_attempts', { p_profile: profileId })
      if (error) throw new Error(error.message)
      return data
    },
    async deleteCode(profileId) {
      must(await db.from('recovery_codes').delete().eq('profile_id', profileId))
    },
    async setAuthPassword(authId, password) {
      const { error } = await db.auth.admin.updateUserById(authId, { password })
      if (error) throw new Error(error.message)
    },
    async revokeSessions(authId) {
      const { error } = await db.rpc('revoke_user_sessions', { p_auth_id: authId })
      if (error) console.error('Recuperación: no se pudieron cerrar sesiones', error.message)
    },
    async setLegacyPassword(profileId, hash) {
      must(await db.from('legacy_credentials').update({ password_hash: hash }).eq('profile_id', profileId))
    },
  }
}
