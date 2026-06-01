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

export default function Home() {
  const [activeAgent, setActiveAgent] = useState<Agent>(AGENTS.hhh)
  const [chatHistory, setChatHistory] = useState<Record<AgentId, Message[]>>({
    hhh: [{ role: 'agent', text: '...뭐, 왔어요? 앉아요.', time: now() }],
    weekend: [{ role: 'agent', text: '어서오세요 😊 주말에 오셨군요!', time: now() }],
    home: [{ role: 'agent', text: '양지마을에 오셨군요. 조용한 곳이에요.', time: now() }],
    boo: [{ role: 'agent', text: '안녕하세요!!!! 저 BOO!예요 🎉', time: now() }],
  })
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<'map' | 'feed'>('map')
  const messagesEndRef = useRef<HTMLDivElement>(null)

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

    const history = chatHistory[activeAgent.id].map(m => ({
      role: m.role === 'agent' ? 'assistant' : 'user',
      content: m.text,
    }))

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId: activeAgent.id, message: text, history }),
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

function MapView({ agents, activeAgent, onSelect }: {
  agents: Agent[]
  activeAgent: Agent
  onSelect: (a: Agent) => void
}) {
  return (
    <div className="relative w-full h-full bg-[#e8e0d5]">
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage: 'linear-gradient(90deg,#b4a591 1px,transparent 1px),linear-gradient(#b4a591 1px,transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />
      <div className="absolute" style={{ top: '8%', left: '8%', width: 130, height: 85 }}>
        <div
          className="w-full h-full rounded-[50%_50%_40%_40%] opacity-70 flex items-end justify-center pb-2"
          style={{ background: 'radial-gradient(ellipse at 50% 60%,#b5a882 60%,#c8bc9a)' }}
        >
          <span className="text-[10px] text-[#6b5e40] font-semibold">왕릉</span>
        </div>
      </div>
      <div className="absolute" style={{ top: '14%', left: '30%', width: 90, height: 58 }}>
        <div
          className="w-full h-full rounded-[50%_50%_40%_40%] opacity-55"
          style={{ background: 'radial-gradient(ellipse at 50% 60%,#b5a882 60%,#c8bc9a)' }}
        />
      </div>
      <div className="absolute bg-[#d4c9b8] border-y border-[#bfb49f]" style={{ top: '48%', left: 0, right: 0, height: 18 }} />
      <div className="absolute bg-[#d4c9b8] border-y border-[#bfb49f]" style={{ top: '72%', left: '10%', right: 0, height: 18 }} />
      <div className="absolute bg-[#d4c9b8] border-x border-[#bfb49f]" style={{ left: '44%', top: 0, bottom: 0, width: 18 }} />

      {agents.map(agent => (
        <button
          key={agent.id}
          onClick={() => onSelect(agent)}
          className="absolute flex flex-col items-center transition-transform hover:scale-110"
          style={{ top: `${agent.mapPosition.top}%`, left: `${agent.mapPosition.left}%`, transform: 'translate(-50%,-50%)' }}
        >
          <div
            className={`w-11 h-11 rounded-full flex items-center justify-center text-xl border-2 border-white shadow-md ${
              activeAgent.id === agent.id ? 'ring-4 ring-white/80' : ''
            }`}
            style={{ background: agent.color }}
          >
            {agent.emoji}
          </div>
          <span className="mt-1 text-[10px] font-bold text-white bg-black/60 px-1.5 py-0.5 rounded-full whitespace-nowrap">
            {agent.storeName}
          </span>
          <span className={`text-[9px] text-white px-1.5 py-0.5 rounded-full mt-0.5 ${
            agent.status === 'open' ? 'bg-green-500' :
            agent.status === 'weekend' ? 'bg-yellow-500' : 'bg-orange-500'
          }`}>
            {agent.status === 'open' ? '영업 중' : agent.status === 'weekend' ? '주말 영업' : '오픈 준비'}
          </span>
        </button>
      ))}

      <div className="absolute bottom-3 left-3 bg-white/90 rounded-lg px-3 py-2 text-[10px] text-gray-500 leading-6">
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
