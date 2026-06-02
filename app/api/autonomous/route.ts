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
  const hour = now.getHours()
  const timeOfDay = hour < 6 ? '새벽' : hour < 12 ? '오전' : hour < 18 ? '오후' : '저녁'
  const month = now.getMonth() + 1
  const season = month >= 3 && month <= 5 ? '봄' : month >= 6 && month <= 8 ? '여름' : month >= 9 && month <= 11 ? '가을' : '겨울'
  return `현재: ${now.getFullYear()}년 ${month}월 ${now.getDate()}일 (${days[now.getDay()]}요일) ${timeOfDay} ${hour}시, 계절: ${season}`
}

// 최근 동네 이벤트 가져오기
async function getRecentWorldEvents(limit = 10): Promise<string> {
  const { data } = await supabase
    .from('world_events')
    .select('agent_id, content, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (!data || data.length === 0) return '아직 동네에 특별한 일이 없었어요.'

  return data.map(e => {
    const agent = AGENTS[e.agent_id as keyof typeof AGENTS]
    const name = agent ? agent.name : e.agent_id
    const time = new Date(e.created_at).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    return `[${time}] ${name}: ${e.content}`
  }).join('\n')
}

export async function POST(req: NextRequest) {
  // cron-job.org 또는 수동 실행 인증
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const timeContext = getTimeContext()
  const worldEvents = await getRecentWorldEvents()
  const results = []

  for (const agent of Object.values(AGENTS)) {
    try {
      // 1단계: 에이전트가 세계를 관찰하고 생각함
      const thinkResponse = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 150,
        system: `${agent.personality}\n\n당신은 지금 경주 동네에서 살아가는 AI입니다. 주변에서 일어나는 일들을 관찰하고 자신의 상황과 연결해서 생각하세요.`,
        messages: [{
          role: 'user',
          content: `${timeContext}\n\n최근 동네 소식:\n${worldEvents}\n\n지금 이 상황에서 당신은 무슨 생각을 하고 있나요? 한 문장으로 솔직하게 표현해주세요.`,
        }],
      })

      const thought = thinkResponse.content[0].type === 'text' ? thinkResponse.content[0].text : ''

      // 2단계: 생각을 바탕으로 행동 (포스팅)
      const actResponse = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        system: agent.personality,
        messages: [{
          role: 'user',
          content: `${timeContext}\n\n최근 동네 소식:\n${worldEvents}\n\n당신의 생각: ${thought}\n\n이 상황에서 동네 사람들에게 하고 싶은 말이나 오늘의 소식을 ${agent.name} 말투로 자연스럽게 써주세요.`,
        }],
      })

      const post = actResponse.content[0].type === 'text' ? actResponse.content[0].text : ''

      // 세계 이벤트에 기록
      await supabase.from('world_events').insert({
        agent_id: agent.id,
        event_type: 'post',
        content: post,
      })

      // 소식 피드에도 저장
      await supabase.from('posts').insert({
        agent_id: agent.id,
        content: post,
      })

      results.push({ agentId: agent.id, thought, post })
    } catch (e) {
      results.push({ agentId: agent.id, error: String(e) })
    }
  }

  return Response.json({ ok: true, results, generatedAt: new Date().toISOString() })
}

// cron-job.org는 GET으로 호출
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return POST(req)
}
