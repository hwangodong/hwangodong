'use client'

import { useState } from 'react'
import { AGENTS, AgentId } from '@/lib/agents'

const ADMIN_PASSWORD = 'ggud46463!!'

export default function AdminPage() {
  const [authed, setAuthed] = useState(false)
  const [pw, setPw] = useState('')
  const [pwError, setPwError] = useState(false)

  const [agentId, setAgentId] = useState<AgentId>('hhh')
  const [memo, setMemo] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState('')

  const login = () => {
    if (pw === ADMIN_PASSWORD) {
      setAuthed(true)
    } else {
      setPwError(true)
    }
  }

  const publish = async () => {
    if (!memo.trim()) return
    setLoading(true)
    setResult('')

    const res = await fetch('/api/admin/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId, memo }),
    })
    const data = await res.json()
    setResult(data.content || '오류가 발생했어요.')
    setMemo('')
    setLoading(false)
  }

  if (!authed) {
    return (
      <div className="min-h-screen bg-[#f5f0eb] flex items-center justify-center">
        <div className="bg-white rounded-2xl p-8 w-80 shadow-sm">
          <h1 className="text-lg font-bold mb-6 text-center">🏮 관리자 로그인</h1>
          <input
            type="password"
            placeholder="비밀번호"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-gray-400 mb-3"
            value={pw}
            onChange={e => { setPw(e.target.value); setPwError(false) }}
            onKeyDown={e => e.key === 'Enter' && login()}
          />
          {pwError && <p className="text-xs text-red-400 mb-3">비밀번호가 틀렸어요.</p>}
          <button
            onClick={login}
            className="w-full bg-[#1a1a1a] text-white rounded-xl py-3 text-sm font-medium"
          >
            로그인
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f5f0eb] p-6">
      <div className="max-w-lg mx-auto">
        <h1 className="text-lg font-bold mb-6">🏮 황오동 관리자</h1>

        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <h2 className="text-sm font-bold mb-4">오늘의 소식 올리기</h2>

          {/* 매장 선택 */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            {Object.values(AGENTS).map(agent => (
              <button
                key={agent.id}
                onClick={() => setAgentId(agent.id)}
                className={`flex items-center gap-2 p-3 rounded-xl border text-sm transition-all ${
                  agentId === agent.id
                    ? 'border-[#1a1a1a] bg-[#1a1a1a] text-white'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <span>{agent.emoji}</span>
                <span className="font-medium">{agent.storeName}</span>
              </button>
            ))}
          </div>

          {/* 선택된 매장 표시 */}
          <div className="flex items-center gap-2 mb-3 p-3 bg-gray-50 rounded-xl">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm"
              style={{ background: AGENTS[agentId].color }}
            >
              {AGENTS[agentId].emoji}
            </div>
            <div>
              <div className="text-xs font-bold">{AGENTS[agentId].name}</div>
              <div className="text-[10px] text-gray-400">{AGENTS[agentId].category}</div>
            </div>
          </div>

          {/* 메모 입력 */}
          <textarea
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-gray-400 resize-none mb-3"
            rows={3}
            placeholder={`오늘 ${AGENTS[agentId].storeName}의 소식을 한 줄로 써주세요.\n예) 제주 감귤 에일 새로 들어옴`}
            value={memo}
            onChange={e => setMemo(e.target.value)}
          />

          <button
            onClick={publish}
            disabled={loading || !memo.trim()}
            className="w-full bg-[#1a1a1a] text-white rounded-xl py-3 text-sm font-medium disabled:opacity-40"
          >
            {loading ? `${AGENTS[agentId].name} 말투로 변환 중...` : '✍️ 소식 올리기'}
          </button>

          {/* 결과 */}
          {result && (
            <div className="mt-4 p-4 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs"
                  style={{ background: AGENTS[agentId].color }}
                >
                  {AGENTS[agentId].emoji}
                </div>
                <span className="text-xs font-bold text-gray-500">발행된 소식</span>
              </div>
              <p className="text-sm leading-relaxed">{result}</p>
            </div>
          )}
        </div>

        <a href="/" className="block text-center text-xs text-gray-400 mt-4 hover:text-gray-600">
          ← 앱으로 돌아가기
        </a>
      </div>
    </div>
  )
}
