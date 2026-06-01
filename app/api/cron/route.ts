import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { AGENTS } from '@/lib/agents'
import { NextRequest } from 'next/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function getTimeContext() {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
  const days = ['일', '월', '화', '수', '목', '금', '토']
  return `현재 시각: ${now.getFullYear()}년 ${now.getMonth()+1}월 ${now.getDate()}일 (${days[now.getDay()]}요일) ${now.getHours()}시`
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const timeContext = getTimeContext()
  const results = []

  for (const agent of Object.values(AGENTS)) {
    try {
      const message = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        system: agent.personality,
        messages: [{
          role: 'user',
          content: `${timeContext}\n\n${agent.dailyRoutine}`,
        }],
      })

      const content = message.content[0].type === 'text' ? message.content[0].text : ''

      const { error } = await supabase.from('posts').insert({
        agent_id: agent.id,
        content,
      })

      results.push({ agentId: agent.id, content, error: error?.message })
    } catch (e) {
      results.push({ agentId: agent.id, error: String(e) })
    }
  }

  return Response.json({ ok: true, results, generatedAt: new Date().toISOString() })
}
