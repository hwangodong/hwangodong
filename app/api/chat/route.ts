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
  const { agentId, message, nickname } = await req.json()

  const agent = getAgentById(agentId)
  if (!agent) return Response.json({ error: 'Agent not found' }, { status: 404 })

  // 이전 대화 기록 불러오기 (최근 20개)
  const { data: pastConversations } = await supabase
    .from('conversations')
    .select('role, content')
    .eq('visitor_id', nickname || 'anonymous')
    .eq('agent_id', agentId)
    .order('created_at', { ascending: true })
    .limit(20)

  const history = (pastConversations || []).map(c => ({
    role: c.role as 'user' | 'assistant',
    content: c.content,
  }))

  const systemPrompt = nickname
    ? `${agent.personality}\n\n지금 대화하는 방문객의 닉네임은 '${nickname}'입니다. 자연스러운 대화 흐름에서 가끔 이름을 불러주세요. 이전 대화 기록이 있다면 그 내용을 기억하고 자연스럽게 이어가세요.`
    : agent.personality

  const messages = [
    ...history,
    { role: 'user' as const, content: message },
  ]

  // 유저 메시지 저장
  await supabase.from('conversations').insert({
    visitor_id: nickname || 'anonymous',
    agent_id: agentId,
    role: 'user',
    content: message,
  })

  const stream = await anthropic.messages.stream({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    system: systemPrompt,
    messages,
  })

  let fullResponse = ''
  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          fullResponse += chunk.delta.text
          controller.enqueue(encoder.encode(chunk.delta.text))
        }
      }
      // 에이전트 응답 저장
      await supabase.from('conversations').insert({
        visitor_id: nickname || 'anonymous',
        agent_id: agentId,
        role: 'assistant',
        content: fullResponse,
      })
      controller.close()
    },
  })

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
