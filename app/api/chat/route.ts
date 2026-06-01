import Anthropic from '@anthropic-ai/sdk'
import { getAgentById } from '@/lib/agents'
import { NextRequest } from 'next/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const { agentId, message, history } = await req.json()

  const agent = getAgentById(agentId)
  if (!agent) return Response.json({ error: 'Agent not found' }, { status: 404 })

  const messages = [
    ...(history || []),
    { role: 'user' as const, content: message },
  ]

  const stream = await anthropic.messages.stream({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    system: agent.personality,
    messages,
  })

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          controller.enqueue(encoder.encode(chunk.delta.text))
        }
      }
      controller.close()
    },
  })

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
