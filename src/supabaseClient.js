import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://jpbaxwqahcmgmrvwshvc.supabase.co'
const supabaseAnonKey = 'sb_publishable_Vh_p0cf1WKslQ-CmxDcrxQ_WweCF00T'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export const supabaseAdmin = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  }
})