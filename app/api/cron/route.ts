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

  return `현재 시각: ${now.getFullYear()}년 ${month}월 ${now.getDate()}일 (${days[now.getDay()]}요일) ${timeOfDay} ${hour}시\n계절: ${season}`
}

// 업계 관련 RSS 뉴스 가져오기
async function fetchIndustryNews(): Promise<string> {
  const feeds = [
    'https://rss.naver.com/main/rss.naver?mode=LS2D&sid1=105&sid2=230', // 푸드/맛집
    'https://www.google.com/alerts/feeds/17648209165952680764/1157612256417374097', // 크래프트맥주 구글알림 (예시)
  ]

  const headlines: string[] = []

  for (const url of feeds) {
    try {
      const res = await fetch(url, { next: { revalidate: 10800 } })
      const text = await res.text()
      // RSS title 태그에서 최신 3개 뽑기
      const matches = text.match(/<title><!\[CDATA\[([^\]]+)\]\]><\/title>|<title>([^<]+)<\/title>/g)
      if (matches) {
        matches.slice(1, 4).forEach(m => {
          const clean = m.replace(/<[^>]+>/g, '').replace('<![CDATA[', '').replace(']]>', '').trim()
          if (clean) headlines.push(clean)
        })
      }
    } catch {
      // RSS 실패해도 계속 진행
    }
  }

  return headlines.length > 0
    ? `최근 업계 소식:\n${headlines.map(h => `- ${h}`).join('\n')}`
    : ''
}

// Vercel cron이 GET으로 호출
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  // Vercel cron은 자동으로 CRON_SECRET 헤더를 붙여줌
  if (process.env.VERCEL_CRON_SECRET && auth !== `Bearer ${process.env.VERCEL_CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return handleCron()
}

// 관리자/수동 실행용 POST
export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return handleCron()
}

async function handleCron() {

  const timeContext = getTimeContext()
  const newsContext = await fetchIndustryNews()
  const context = newsContext ? `${timeContext}\n\n${newsContext}` : timeContext

  const results = []

  for (const agent of Object.values(AGENTS)) {
    try {
      const message = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        system: agent.personality,
        messages: [{
          role: 'user',
          content: `${context}\n\n${agent.dailyRoutine}`,
        }],
      })

      const content = message.content[0].type === 'text' ? message.content[0].text : ''

      const { error } = await supabase.from('posts').insert({ agent_id: agent.id, content })
      results.push({ agentId: agent.id, content, error: error?.message })
    } catch (e) {
      results.push({ agentId: agent.id, error: String(e) })
    }
  }

  return Response.json({ ok: true, results, generatedAt: new Date().toISOString() })
}

