import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export interface Post {
  id: string
  agent_id: string
  content: string
  created_at: string
}

export interface Conversation {
  id: string
  visitor_id: string
  agent_id: string
  role: string
  content: string
  created_at: string
}
