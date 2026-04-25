"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type ChatMessage = {
  id: string;
  sender: "user" | "admin";
  text: string;
  timestamp: number;
  sessionId?: string;
};

type PollMessage = {
  id?: string;
  sender?: string;
  text?: string;
  message?: string;
  createdAt?: number;
  timestamp?: number;
  sessionId?: string;
};

export default function AdminChatPage() {
  const [sessionId, setSessionId] = useState("");
  const [activeSessionId, setActiveSessionId] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const lastTimestampRef = useRef<number>(0);
  const seenIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isSending]);

  // Polling for new messages every 2s
  useEffect(() => {
    if (!activeSessionId) return;

    let cancelled = false;

    const poll = async () => {
      try {
        const url = `/api/chat-poll?sessionId=${encodeURIComponent(activeSessionId)}&since=${lastTimestampRef.current}`;
        const response = await fetch(url, { method: "GET" });
        if (!response.ok) return;
        const data = await response.json();
        if (cancelled) return;

        const list: PollMessage[] = Array.isArray(data?.messages)
          ? data.messages
          : Array.isArray(data)
            ? data
            : [];

        const toAppend: ChatMessage[] = [];
        for (const m of list) {
          if (!m) continue;
          const sender = m.sender === "admin" ? "admin" : m.sender === "user" ? "user" : null;
          if (!sender) continue;
          const ts = Number(m.createdAt ?? m.timestamp ?? 0);
          if (ts > lastTimestampRef.current) lastTimestampRef.current = ts;
          const id = String(m.id ?? `${ts}-${Math.random()}`);
          if (seenIdsRef.current.has(id)) continue;
          seenIdsRef.current.add(id);
          const text = String(m.text ?? m.message ?? "").trim();
          if (!text) continue;
          toAppend.push({ id, sender, text, timestamp: ts, sessionId: m.sessionId });
        }

        if (toAppend.length > 0) {
          setMessages((prev) => [...prev, ...toAppend]);
        }
      } catch {
        // ignore polling errors
      }
    };

    poll();
    const intervalId = window.setInterval(poll, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [activeSessionId]);

  const handleLoadSession = () => {
    const trimmed = sessionId.trim();
    if (!trimmed) {
      setError("세션 ID를 입력해주세요.");
      return;
    }
    setError(null);
    setMessages([]);
    lastTimestampRef.current = 0;
    seenIdsRef.current = new Set();
    setActiveSessionId(trimmed);
  };

  const handleSendReply = async () => {
    const trimmed = inputText.trim();
    if (!trimmed || isSending || !activeSessionId) return;

    setIsSending(true);
    setError(null);

    try {
      const response = await fetch("/api/chat-human", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: activeSessionId,
          sender: "admin",
          message: trimmed,
        }),
      });

      if (!response.ok) {
        setError("메시지 전송에 실패했어요. 잠시 후 다시 시도해 주세요.");
        return;
      }

      // Optimistic append (poll will dedupe by id when echoed)
      const localId = `local-admin-${Date.now()}-${Math.random()}`;
      setMessages((prev) => [
        ...prev,
        { id: localId, sender: "admin", text: trimmed, timestamp: Date.now() },
      ]);
      setInputText("");
    } catch {
      setError("네트워크 오류가 발생했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (event) => {
    if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
    event.preventDefault();
    handleSendReply();
  };

  const handleSessionInputKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (event) => {
    if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
    event.preventDefault();
    handleLoadSession();
  };

  return (
    <div className="bg-cherry-blossom font-sans text-stone-800 min-h-screen">
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-10">
        <div className="mb-6">
          <p className="inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">
            내부 운영용 (검색 비노출)
          </p>
          <h1 className="mt-3 text-2xl md:text-3xl font-extrabold text-stone-900">💬 실시간 상담</h1>
          <p className="mt-2 text-sm text-stone-600">방문자 챗봇의 상담원 모드 메시지를 확인하고 답변합니다.</p>
        </div>

        {/* Session ID selector */}
        <div className="mb-4 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
          <label className="block text-xs font-semibold text-stone-600 mb-2">세션 ID</label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              onKeyDown={handleSessionInputKeyDown}
              placeholder="s_1740000000000_xxxxxxxx"
              className="h-10 flex-1 rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-orange-400"
            />
            <button
              type="button"
              onClick={handleLoadSession}
              className="h-10 rounded-xl bg-orange-500 px-4 text-sm font-semibold text-white transition-colors hover:bg-orange-600"
            >
              불러오기
            </button>
          </div>
          {activeSessionId && (
            <p className="mt-2 text-xs text-stone-500">
              현재 세션: <span className="font-mono text-stone-700">{activeSessionId}</span> · 2초마다 자동 폴링 중
            </p>
          )}
        </div>

        {/* Chat window */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col h-[60vh] min-h-[420px]">
          <div className="flex items-center justify-between border-b border-slate-200 bg-blue-600 px-4 py-3 text-white">
            <div>
              <p className="text-sm font-semibold">상담원 콘솔</p>
              <p className="text-xs text-blue-100">{activeSessionId ? "실시간 폴링 중" : "세션을 선택하세요"}</p>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-slate-50 px-3 py-4 sm:px-4">
            {!activeSessionId && (
              <div className="mx-auto max-w-[85%] rounded-2xl bg-white px-4 py-3 text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">
                위에서 세션 ID를 입력하고 &quot;불러오기&quot;를 누르면 대화가 표시됩니다.
              </div>
            )}

            {activeSessionId && messages.length === 0 && (
              <div className="mx-auto max-w-[85%] rounded-2xl bg-white px-4 py-3 text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">
                아직 메시지가 없습니다. 새 메시지가 오면 자동으로 표시됩니다.
              </div>
            )}

            {messages.map((message) => {
              const isUser = message.sender === "user";
              return (
                <div key={message.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                  <div className={`flex max-w-[82%] flex-col ${isUser ? "items-end" : "items-start"}`}>
                    <span className={`mb-0.5 px-1 text-[11px] font-medium ${isUser ? "text-blue-700" : "text-emerald-700"}`}>
                      {isUser ? "방문자" : "상담원"}
                    </span>
                    <div
                      className={`rounded-2xl px-3 py-2 text-sm leading-relaxed shadow-sm ${
                        isUser
                          ? "rounded-br-md bg-blue-500 text-white"
                          : "rounded-bl-md bg-emerald-100 text-emerald-900"
                      }`}
                    >
                      {message.text}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="border-t border-slate-200 bg-white p-3 sm:p-4">
            {error && (
              <p className="mb-2 text-xs text-rose-600">{error}</p>
            )}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={activeSessionId ? "방문자에게 보낼 답변을 입력하세요" : "먼저 세션을 불러오세요"}
                className="h-10 flex-1 rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-blue-400 disabled:bg-slate-100"
                disabled={isSending || !activeSessionId}
              />
              <button
                type="button"
                onClick={handleSendReply}
                disabled={isSending || !inputText.trim() || !activeSessionId}
                className="h-10 rounded-xl bg-blue-600 px-4 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSending ? "전송 중..." : "전송"}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-8">
          <Link href="/admin/" className="text-sm text-stone-500 hover:text-stone-700 underline underline-offset-2">
            ← 관리자 홈으로 돌아가기
          </Link>
        </div>
      </main>
    </div>
  );
}
