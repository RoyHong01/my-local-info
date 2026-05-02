"use client";

import { useEffect, useRef, useState } from "react";

type ChatItem = {
  question: string;
  answer: string;
};

type Message = {
  id: string;
  role: "user" | "bot" | "admin" | "system";
  text: string;
};

type ChatBotProps = {
  items: ChatItem[];
};

type ChatMode = "ai" | "human";

type PollMessage = {
  id?: string;
  sender?: string;
  text?: string;
  message?: string;
  createdAt?: number;
  timestamp?: number;
};

function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "";
  const KEY = "pnj_chat_session_id";
  try {
    const existing = window.localStorage.getItem(KEY);
    if (existing) return existing;
    const fresh = `s_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(KEY, fresh);
    return fresh;
  } catch {
    return `s_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }
}

export default function ChatBot({ items }: ChatBotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<ChatMode>("ai");
  const [sessionId, setSessionId] = useState<string>("");
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const lastTimestampRef = useRef<number>(0);
  const seenAdminIdsRef = useRef<Set<string>>(new Set());

  const suggestedQuestions = (
    Array.isArray(items)
      ? items.map((item) => String(item?.question || "").trim()).filter(Boolean)
      : []
  ).slice(0, 3);

  const fallbackQuestions = [
    "이 블로그는 어떤 블로그인가요?",
    "정보는 얼마나 자주 업데이트되나요?",
    "어떤 정보를 제공하나요?",
  ];

  const quickQuestions = suggestedQuestions.length > 0
    ? suggestedQuestions
    : fallbackQuestions;

  useEffect(() => {
    setSessionId(getOrCreateSessionId());
  }, []);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isOpen, isLoading]);

  // Polling for admin replies in human mode
  useEffect(() => {
    if (mode !== "human" || !sessionId) return;

    let cancelled = false;

    const poll = async () => {
      try {
        const url = `/api/chat-poll?sessionId=${encodeURIComponent(sessionId)}&since=${lastTimestampRef.current}`;
        const response = await fetch(url, { method: "GET" });
        if (!response.ok) return;
        const data = await response.json();
        if (cancelled) return;

        const list: PollMessage[] = Array.isArray(data?.messages)
          ? data.messages
          : Array.isArray(data)
            ? data
            : [];

        const newAdmin = list.filter((m) => m && m.sender === "admin");
        if (newAdmin.length === 0) return;

        const toAppend: Message[] = [];
        for (const m of newAdmin) {
          const ts = Number(m.createdAt ?? m.timestamp ?? 0);
          if (ts > lastTimestampRef.current) lastTimestampRef.current = ts;
          const id = String(m.id ?? `${ts}-${Math.random()}`);
          if (seenAdminIdsRef.current.has(id)) continue;
          seenAdminIdsRef.current.add(id);
          const text = String(m.text ?? m.message ?? "").trim();
          if (!text) continue;
          toAppend.push({ id: `admin-${id}`, role: "admin", text });
        }

        if (toAppend.length > 0) {
          setMessages((prev) => [...prev, ...toAppend]);
        }
      } catch {
        // ignore network errors during polling
      }
    };

    poll();
    const intervalId = window.setInterval(poll, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [mode, sessionId]);

  const addBotMessage = (text: string) => {
    setMessages((prev) => [
      ...prev,
      { id: `${Date.now()}-a-${Math.random()}`, role: "bot", text },
    ]);
  };

  const addSystemMessage = (text: string) => {
    setMessages((prev) => [
      ...prev,
      { id: `${Date.now()}-s-${Math.random()}`, role: "system", text },
    ]);
  };

  const submitToAi = async (question: string) => {
    const trimmed = question.trim();
    if (!trimmed || isLoading) return;

    setMessages((prev) => [
      ...prev,
      { id: `${Date.now()}-q-${Math.random()}`, role: "user", text: trimmed },
    ]);
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });

      const data = await response.json();

      if (!response.ok) {
        addBotMessage("요청 처리 중 문제가 발생했어요. 잠시 후 다시 시도해 주세요.");
        return;
      }

      const answer = typeof data?.answer === "string" ? data.answer : "답변을 받지 못했어요.";
      addBotMessage(answer);
    } catch {
      addBotMessage("네트워크 오류가 발생했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setIsLoading(false);
    }
  };

  const submitToHuman = async (question: string) => {
    const trimmed = question.trim();
    if (!trimmed || isLoading) return;

    setMessages((prev) => [
      ...prev,
      { id: `${Date.now()}-q-${Math.random()}`, role: "user", text: trimmed },
    ]);
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat-human", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          sender: "user",
          message: trimmed,
        }),
      });

      if (!response.ok) {
        addSystemMessage("메시지 전송에 실패했어요. 잠시 후 다시 시도해 주세요.");
      }
    } catch {
      addSystemMessage("네트워크 오류가 발생했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setIsLoading(false);
    }
  };

  const submitQuestion = async (question: string) => {
    if (mode === "human") {
      await submitToHuman(question);
    } else {
      await submitToAi(question);
    }
  };

  const handleSubmit = async () => {
    const current = inputText;
    setInputText("");
    await submitQuestion(current);
  };

  const handleKeyDown: React.KeyboardEventHandler<HTMLInputElement> = async (event) => {
    if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
    event.preventDefault();
    await handleSubmit();
  };

  const handleConnectHuman = () => {
    if (mode === "human") return;
    setMode("human");
    lastTimestampRef.current = 0;
    seenAdminIdsRef.current = new Set();
    addSystemMessage("상담원 연결을 요청했어요. 메시지를 남기시면 상담원이 확인 후 답변드립니다.");
  };

  const handleBackToAi = () => {
    if (mode === "ai") return;
    setMode("ai");
    addSystemMessage("AI 도우미 모드로 전환되었어요.");
  };

  const headerTitle = mode === "human" ? "상담원 대기 중" : "AI 도우미";
  const headerSub = mode === "human" ? "실시간 상담" : "온라인";
  const inputPlaceholder = mode === "human"
    ? "상담원에게 보낼 메시지를 입력하세요"
    : "메시지를 입력하세요";

  return (
    <div className="fixed bottom-4 right-4 z-[70] sm:bottom-6 sm:right-6">
      <div
        className={`overflow-hidden rounded-none border border-slate-200 bg-white shadow-2xl transition-all duration-300 ease-out sm:rounded-2xl ${
          isOpen
            ? "pointer-events-auto mb-3 h-[100dvh] w-[100vw] opacity-100 translate-y-0 sm:h-[500px] sm:w-[360px]"
            : "pointer-events-none mb-0 h-0 w-0 opacity-0 translate-y-2"
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-slate-200 bg-blue-600 px-4 py-3 text-white">
            <div>
              <p className="text-sm font-semibold">{headerTitle}</p>
              <p className="text-xs text-blue-100">{headerSub}</p>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-md p-1 text-blue-100 hover:bg-blue-500/70 hover:text-white"
              aria-label="채팅창 닫기"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-slate-50 px-3 py-4 sm:px-4">
            {messages.length === 0 && (
              <div className="mx-auto max-w-[85%] rounded-2xl bg-white px-4 py-3 text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">
                메시지를 입력해 대화를 시작해보세요.
              </div>
            )}

            {messages.map((message) => {
              if (message.role === "system") {
                return (
                  <div key={message.id} className="flex justify-center">
                    <div className="max-w-[90%] rounded-full bg-slate-200/70 px-3 py-1 text-center text-xs text-slate-600">
                      {message.text}
                    </div>
                  </div>
                );
              }

              const isUser = message.role === "user";
              const isAdmin = message.role === "admin";

              return (
                <div key={message.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                  <div className={`flex max-w-[82%] flex-col ${isUser ? "items-end" : "items-start"}`}>
                    {isAdmin && (
                      <span className="mb-0.5 px-1 text-[11px] font-medium text-emerald-700">상담원</span>
                    )}
                    <div
                      className={`rounded-2xl px-3 py-2 text-sm leading-relaxed shadow-sm ${
                        isUser
                          ? "rounded-br-md bg-blue-500 text-white"
                          : isAdmin
                            ? "rounded-bl-md bg-emerald-100 text-emerald-900"
                            : "rounded-bl-md bg-slate-200 text-slate-900"
                      }`}
                    >
                      {message.text}
                    </div>
                  </div>
                </div>
              );
            })}

            {isLoading && (
              <div className="flex justify-start">
                <div className="inline-flex items-center gap-2 rounded-2xl rounded-bl-md bg-slate-200 px-3 py-2 text-sm text-slate-700 shadow-sm">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
                  {mode === "human" ? "메시지 전송 중..." : "답변 생성 중..."}
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-slate-200 bg-white p-3 sm:p-4">
            {mode === "ai" && (
              <div className="mb-3">
                <div className="flex flex-col gap-1.5">
                {quickQuestions.map((question) => (
                  <button
                    key={question}
                    type="button"
                    onClick={() => submitQuestion(question)}
                    disabled={isLoading}
                    className="w-full rounded-lg bg-slate-100 px-3 py-1.5 text-left text-xs text-slate-700 transition-colors hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {question}
                  </button>
                ))}                </div>              </div>
            )}

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={inputText}
                onChange={(event) => setInputText(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={inputPlaceholder}
                className="h-10 flex-1 rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-blue-400"
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isLoading || !inputText.trim()}
                className="h-10 rounded-xl bg-blue-600 px-4 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                전송
              </button>
            </div>

            {mode === "human" && (
              <div className="mt-3 flex justify-center">
                <button
                  type="button"
                  onClick={handleBackToAi}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100"
                >
                  AI 도우미로 돌아가기
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="ml-auto flex h-14 w-14 items-center justify-center rounded-full bg-orange-500 text-white shadow-lg transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2"
        aria-label="챗봇 열기"
      >
        <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor" aria-hidden="true">
          <path d="M4 5.25A2.25 2.25 0 0 1 6.25 3h11.5A2.25 2.25 0 0 1 20 5.25v8.5A2.25 2.25 0 0 1 17.75 16H9.5l-3.86 3.22A.75.75 0 0 1 4.5 18.64V16A2.25 2.25 0 0 1 2.25 13.75v-8.5Z" />
        </svg>
      </button>
    </div>
  );
}
