import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!supabaseUrl) {
  console.warn('Missing NEXT_PUBLIC_SUPABASE_URL in .env')
}

const validUrl = supabaseUrl.startsWith('http') ? supabaseUrl : 'http://localhost:54321'
const validAnonKey = supabaseAnonKey || 'placeholder-anon-key'
const validServiceKey = supabaseServiceKey || 'placeholder-service-key'

export const supabase = createClient(validUrl, validAnonKey, {
  auth: { persistSession: false }
})

export const supabaseAdmin = createClient(validUrl, validServiceKey, {
  auth: { persistSession: false }
})
