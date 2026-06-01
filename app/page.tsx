'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { AGENTS, Agent, AgentId } from '@/lib/agents'
import { Post } from '@/lib/supabase'

interface Message {
  role: 'user' | 'agent'
  text: string
  time: string
}

function now() {
  return new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
}

function renderText(text: string) {
  const urlRegex = /(https?:\/\/[^\s]+)/g
  const parts = text.split(urlRegex)
  return parts.map((part, i) =>
    urlRegex.test(part) ? (
      <a
        key={i}
        href={part}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 mt-1 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs text-[#1a1a1a] font-medium hover:bg-gray-50"
      >
        🛍️ 온라인 샵 보러 가기 →
      </a>
    ) : (
      <span key={i}>{part}</span>
    )
  )
}

function NicknameGate({ onEnter }: { onEnter: (nickname: string) => void }) {
  const [value, setValue] = useState('')
  return (
    <div className="min-h-screen bg-[#f5f0eb] flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl p-8 w-full max-w-sm shadow-sm text-center">
        <div className="text-4xl mb-4">🏮</div>
        <h1 className="text-lg font-bold mb-1">황오동 가상 동네</h1>
        <p className="text-sm text-gray-400 mb-6">닉네임을 알려주세요.<br/>에이전트들이 당신을 기억할게요.</p>
        <input
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-gray-400 mb-3 text-center"
          placeholder="닉네임 입력 (예: 경주여행자)"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && value.trim() && onEnter(value.trim())}
          maxLength={12}
        />
        <button
          onClick={() => value.trim() && onEnter(value.trim())}
          disabled={!value.trim()}
          className="w-full bg-[#1a1a1a] text-white rounded-xl py-3 text-sm font-medium disabled:opacity-40"
        >
          동네 입장하기 →
        </button>
      </div>
    </div>
  )
}

export default function Home() {
  const [nickname, setNickname] = useState<string | null>(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('nickname')
    return null
  })

  // URL ?from=agentId 파라미터로 초기 매장 결정
  const [activeAgent, setActiveAgent] = useState<Agent>(() => {
    if (typeof window !== 'undefined') {
      const from = new URLSearchParams(window.location.search).get('from')
      if (from && AGENTS[from as AgentId]) return AGENTS[from as AgentId]
    }
    return AGENTS.hhh
  })

  const [chatHistory, setChatHistory] = useState<Record<AgentId, Message[]>>({
    hhh: [], weekend: [], home: [], boo: [],
  })
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<'map' | 'feed'>('map')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const handleEnter = (name: string) => {
    localStorage.setItem('nickname', name)
    setNickname(name)
    setChatHistory({
      hhh: [{ role: 'agent', text: `...${name}씨, 왔어요? 앉아요.`, time: now() }],
      weekend: [{ role: 'agent', text: `어서오세요 😊 ${name}님, 반가워요!`, time: now() }],
      home: [{ role: 'agent', text: `${name}님, 양지마을에 오셨군요. 조용한 곳이에요.`, time: now() }],
      boo: [{ role: 'agent', text: `${name}님 안녕하세요!!!! 저 BOO!예요 🎉`, time: now() }],
    })
  }

  if (!nickname) return <NicknameGate onEnter={handleEnter} />

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory, activeAgent])

  const sendMessage = async () => {
    if (!input.trim() || loading) return
    const text = input.trim()
    setInput('')
    setLoading(true)

    const userMsg: Message = { role: 'user', text, time: now() }
    setChatHistory(prev => ({
      ...prev,
      [activeAgent.id]: [...prev[activeAgent.id], userMsg],
    }))

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId: activeAgent.id, message: text, nickname }),
    })

    if (!res.body) { setLoading(false); return }

    const agentMsg: Message = { role: 'agent', text: '', time: now() }
    setChatHistory(prev => ({
      ...prev,
      [activeAgent.id]: [...prev[activeAgent.id], agentMsg],
    }))

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const chunk = decoder.decode(value)
      setChatHistory(prev => {
        const msgs = [...prev[activeAgent.id]]
        msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], text: msgs[msgs.length - 1].text + chunk }
        return { ...prev, [activeAgent.id]: msgs }
      })
    }
    setLoading(false)
  }

  const messages = chatHistory[activeAgent.id]

  return (
    <div className="flex flex-col h-screen bg-[#f5f0eb] font-sans">
      <header className="bg-[#1a1a1a] text-white px-5 py-3 flex items-center justify-between">
        <h1 className="text-sm font-bold tracking-wide">🏮 황오동 가상 동네</h1>
        <span className="text-xs text-gray-400">황오동카니발 365</span>
      </header>

      <main className="flex flex-1 overflow-hidden">
        <div className="flex-1 relative overflow-hidden">
          {tab === 'map' ? (
            <MapView agents={Object.values(AGENTS)} activeAgent={activeAgent} onSelect={setActiveAgent} />
          ) : (
            <FeedView />
          )}
        </div>

        <div className="w-80 bg-white flex flex-col border-l border-gray-200">
          <div className="p-4 border-b border-gray-100 flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-lg flex-shrink-0"
              style={{ background: activeAgent.color }}
            >
              {activeAgent.emoji}
            </div>
            <div>
              <div className="text-sm font-bold">{activeAgent.name} · {activeAgent.storeName}</div>
              <div className="text-xs text-gray-400">{activeAgent.category}</div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-2 items-end ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                {msg.role === 'agent' && (
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-sm flex-shrink-0"
                    style={{ background: activeAgent.color }}
                  >
                    {activeAgent.emoji}
                  </div>
                )}
                <div className={`max-w-[210px] flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div
                    className={`px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                      msg.role === 'agent'
                        ? 'bg-gray-100 rounded-tl-sm'
                        : 'bg-[#1a1a1a] text-white rounded-tr-sm'
                    }`}
                  >
                    {msg.text ? renderText(msg.text) : (loading && i === messages.length - 1 && msg.role === 'agent' ? (
                      <span className="inline-flex gap-1 py-1">
                        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </span>
                    ) : '')}
                  </div>
                  <div className="text-[10px] text-gray-300 mt-1">{msg.time}</div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-3 border-t border-gray-100 flex gap-2 items-center">
            <input
              className="flex-1 px-3 py-2 rounded-full border border-gray-200 text-sm outline-none focus:border-gray-400"
              placeholder={`${activeAgent.name}에게 말 걸기...`}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
            />
            <button
              onClick={sendMessage}
              disabled={loading}
              className="w-9 h-9 bg-[#1a1a1a] text-white rounded-full flex items-center justify-center text-base disabled:opacity-40"
            >
              ↑
            </button>
          </div>
        </div>
      </main>

      <nav className="bg-white border-t border-gray-200 flex">
        {(['map', 'feed'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 flex flex-col items-center gap-1 text-xs ${tab === t ? 'text-[#1a1a1a]' : 'text-gray-300'}`}
          >
            <span className="text-xl">{t === 'map' ? '🗺️' : '📰'}</span>
            {t === 'map' ? '지도' : '소식'}
          </button>
        ))}
      </nav>
    </div>
  )
}

// 매장별 캐릭터 설정
const CHARACTERS: Record<string, { idle: string; active: string; building: string }> = {
  hhh:     { idle: '🧍', active: '🙋', building: '🍺' },
  weekend: { idle: '🧍', active: '🙋', building: '🛍️' },
  home:    { idle: '🧎', active: '🙋', building: '🏡' },
  boo:     { idle: '👷', active: '🙆', building: '🏗️' },
}

function IsometricBuilding({ agent, isActive, onClick }: {
  agent: Agent
  isActive: boolean
  onClick: () => void
}) {
  const char = CHARACTERS[agent.id]
  const [bounce, setBounce] = useState(false)

  useEffect(() => {
    if (isActive) {
      setBounce(true)
      const t = setTimeout(() => setBounce(false), 600)
      return () => clearTimeout(t)
    }
  }, [isActive])

  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-0 group"
      style={{ filter: isActive ? 'drop-shadow(0 0 8px rgba(255,255,255,0.8))' : 'none' }}
    >
      {/* 말풍선 (active일 때) */}
      {isActive && (
        <div className="mb-1 bg-white rounded-xl px-2 py-1 text-[10px] font-bold shadow-md whitespace-nowrap animate-bounce">
          {agent.name} 👋
        </div>
      )}

      {/* 캐릭터 */}
      <div className={`text-2xl transition-transform ${bounce ? 'scale-125' : 'group-hover:scale-110'}`}
        style={{ transform: `rotate(0deg)` }}>
        {isActive ? char.active : char.idle}
      </div>

      {/* 건물 — 아이소메트릭 느낌 */}
      <div className="relative mt-0">
        {/* 지붕 */}
        <div
          className="w-16 h-5 flex items-center justify-center text-lg"
          style={{
            background: agent.color,
            clipPath: 'polygon(0% 100%, 50% 0%, 100% 100%)',
            marginBottom: -2,
          }}
        />
        {/* 앞면 */}
        <div
          className="w-16 h-10 flex items-center justify-center text-base border-t-0"
          style={{
            background: agent.color,
            opacity: 0.85,
            borderRadius: '0 0 4px 4px',
          }}
        >
          <span>{char.building}</span>
        </div>
        {/* 옆면 (3D 느낌) */}
        <div
          className="absolute right-0 top-0 w-3 h-10"
          style={{
            background: agent.color,
            filter: 'brightness(0.6)',
            transform: 'skewY(-45deg) translateX(100%)',
            transformOrigin: 'top left',
            borderRadius: '0 2px 2px 0',
          }}
        />
      </div>

      {/* 매장 이름 */}
      <div className="mt-1 text-[10px] font-bold text-white bg-black/60 px-2 py-0.5 rounded-full whitespace-nowrap">
        {agent.storeName}
      </div>

      {/* 상태 뱃지 */}
      <div className={`text-[9px] text-white px-1.5 py-0.5 rounded-full mt-0.5 ${
        agent.status === 'open' ? 'bg-green-500' :
        agent.status === 'weekend' ? 'bg-yellow-500' : 'bg-orange-500'
      }`}>
        {agent.status === 'open' ? '영업 중' : agent.status === 'weekend' ? '주말 영업' : '오픈 준비'}
      </div>
    </button>
  )
}

function MapView({ agents, activeAgent, onSelect }: {
  agents: Agent[]
  activeAgent: Agent
  onSelect: (a: Agent) => void
}) {
  return (
    <div className="relative w-full h-full overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #c8dff0 0%, #d4e8c2 40%, #c8b99a 100%)' }}>

      {/* 하늘 */}
      <div className="absolute top-0 left-0 right-0 h-1/3"
        style={{ background: 'linear-gradient(180deg,#87CEEB,#c8dff0)' }}>
        <div className="absolute top-4 left-12 text-2xl opacity-70">☁️</div>
        <div className="absolute top-8 right-16 text-xl opacity-60">☁️</div>
        <div className="absolute top-3 left-1/2 text-lg opacity-50">☁️</div>
      </div>

      {/* 왕릉들 */}
      <div className="absolute" style={{ top: '18%', left: '6%' }}>
        <div className="flex flex-col items-center">
          <div className="w-20 h-12 rounded-[50%_50%_40%_40%] opacity-80 flex items-end justify-center pb-1"
            style={{ background: 'radial-gradient(ellipse at 50% 60%,#8a7d5c,#b5a882)' }}>
            <span className="text-[9px] text-[#4a3f20] font-bold">왕릉</span>
          </div>
          <div className="w-24 h-3 rounded-full opacity-40 mt-0"
            style={{ background: '#6b5e40' }} />
        </div>
      </div>

      <div className="absolute" style={{ top: '14%', left: '22%' }}>
        <div className="w-14 h-9 rounded-[50%_50%_40%_40%] opacity-70"
          style={{ background: 'radial-gradient(ellipse at 50% 60%,#8a7d5c,#b5a882)' }} />
      </div>

      {/* 땅 / 잔디 */}
      <div className="absolute bottom-0 left-0 right-0 h-2/3"
        style={{ background: 'linear-gradient(180deg,#b8c99a 0%,#c8b99a 60%,#b8a888 100%)' }} />

      {/* 도로 — 아이소메트릭 */}
      <div className="absolute"
        style={{
          top: '52%', left: '-5%', right: '-5%', height: 22,
          background: '#c4b89a',
          borderTop: '2px solid #a89878',
          borderBottom: '2px solid #a89878',
          transform: 'skewY(-2deg)',
        }} />
      <div className="absolute"
        style={{
          top: '68%', left: '15%', right: '-5%', height: 18,
          background: '#c4b89a',
          borderTop: '2px solid #a89878',
          borderBottom: '2px solid #a89878',
          transform: 'skewY(-1deg)',
        }} />

      {/* 나무들 */}
      {['12%', '55%', '80%', '35%'].map((left, i) => (
        <div key={i} className="absolute flex flex-col items-center"
          style={{ top: `${42 + i * 5}%`, left }}>
          <div className="text-xl">🌲</div>
        </div>
      ))}

      {/* 매장 건물들 */}
      <div className="absolute" style={{ top: '38%', left: '8%' }}>
        <IsometricBuilding agent={AGENTS.hhh} isActive={activeAgent.id === 'hhh'} onClick={() => onSelect(AGENTS.hhh)} />
      </div>
      <div className="absolute" style={{ top: '55%', left: '38%' }}>
        <IsometricBuilding agent={AGENTS.weekend} isActive={activeAgent.id === 'weekend'} onClick={() => onSelect(AGENTS.weekend)} />
      </div>
      <div className="absolute" style={{ top: '32%', left: '62%' }}>
        <IsometricBuilding agent={AGENTS.home} isActive={activeAgent.id === 'home'} onClick={() => onSelect(AGENTS.home)} />
      </div>
      <div className="absolute" style={{ top: '62%', left: '68%' }}>
        <IsometricBuilding agent={AGENTS.boo} isActive={activeAgent.id === 'boo'} onClick={() => onSelect(AGENTS.boo)} />
      </div>

      {/* 범례 */}
      <div className="absolute bottom-3 left-3 bg-white/80 rounded-lg px-3 py-2 text-[10px] text-gray-500 leading-5 backdrop-blur-sm">
        🟢 영업 중 &nbsp; 🟡 주말만 &nbsp; 🟠 오픈 예정
      </div>
    </div>
  )
}

function FeedView() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)

  const fetchPosts = useCallback(async () => {
    const res = await fetch('/api/posts')
    const data = await res.json()
    setPosts(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchPosts() }, [fetchPosts])

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-4 flex items-center justify-between border-b border-[#d4c9b8] bg-[#f0ebe4]">
        <span className="text-sm font-bold">오늘의 동네 소식</span>
        <button onClick={fetchPosts} className="text-xs text-gray-400 hover:text-gray-600">새로고침</button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40 text-sm text-gray-400">불러오는 중...</div>
      ) : posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 gap-2">
          <p className="text-sm text-gray-400 text-center">아직 소식이 없어요.<br />아래 버튼으로 에이전트들을 깨워보세요!</p>
          <TriggerButton onDone={fetchPosts} />
        </div>
      ) : (
        <div className="p-4 flex flex-col gap-3">
          <TriggerButton onDone={fetchPosts} />
          {posts.map(post => {
            const agent = AGENTS[post.agent_id as AgentId]
            if (!agent) return null
            return (
              <div key={post.id} className="bg-white rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-sm"
                    style={{ background: agent.color }}
                  >
                    {agent.emoji}
                  </div>
                  <div>
                    <div className="text-xs font-bold">{agent.name}</div>
                    <div className="text-[10px] text-gray-400">
                      {new Date(post.created_at).toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
                <p className="text-sm leading-relaxed text-gray-700">{post.content}</p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function TriggerButton({ onDone }: { onDone: () => void }) {
  const [running, setRunning] = useState(false)

  const trigger = async () => {
    setRunning(true)
    await fetch('/api/cron', {
      method: 'POST',
      headers: { authorization: 'Bearer hwangodong2026' },
    })
    await onDone()
    setRunning(false)
  }

  return (
    <button
      onClick={trigger}
      disabled={running}
      className="text-xs bg-[#1a1a1a] text-white px-4 py-2 rounded-full disabled:opacity-40"
    >
      {running ? '에이전트 깨우는 중...' : '🌅 지금 소식 생성하기'}
    </button>
  )
}
