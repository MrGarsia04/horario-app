import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'

export function useMyBirthday(userId) {
  return useQuery({
    queryKey: ['profile', userId, 'birthday'],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('birthday').eq('id', userId).maybeSingle()
      return data?.birthday ?? null
    },
  })
}
