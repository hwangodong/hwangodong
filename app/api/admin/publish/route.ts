import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { getAgentById } from '@/lib/agents'
import { NextRequest } from 'next/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: NextRequest) {
  const { agentId, memo } = await req.json()

  const agent = getAgentById(agentId)
  if (!agent) return Response.json({ error: 'Agent not found' }, { status: 404 })

  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
  const days = ['일', '월', '화', '수', '목', '금', '토']
  const timeContext = `현재 시각: ${now.getFullYear()}년 ${now.getMonth()+1}월 ${now.getDate()}일 (${days[now.getDay()]}요일) ${now.getHours()}시`

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 200,
    system: agent.personality,
    messages: [{
      role: 'user',
      content: `${timeContext}\n\n아래 실제 소식을 바탕으로 ${agent.name} 말투로 자연스럽게 포스팅을 작성해주세요.\n실제 소식: ${memo}\n\n꾸며내지 말고 주어진 정보만 바탕으로 작성하세요.`,
    }],
  })

  const content = message.content[0].type === 'text' ? message.content[0].text : ''

  await supabase.from('posts').insert({ agent_id: agentId, content })

  return Response.json({ content })
}
