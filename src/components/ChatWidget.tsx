"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type ChatItem = {
  question: string;
  answer: string;
};

type Message = {
  id: string;
  role: "user" | "bot";
  text: string;
};

type ChatWidgetProps = {
  items: ChatItem[];
};

export default function ChatWidget({ items }: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const hasItems = useMemo(() => items.length > 0, [items]);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isOpen]);

  const handleQuestionClick = (item: ChatItem) => {
    const questionId = `${Date.now()}-q`;
    const answerId = `${Date.now()}-a`;

    setMessages((prev) => [
      ...prev,
      { id: questionId, role: "user", text: item.question },
    ]);

    window.setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        { id: answerId, role: "bot", text: item.answer },
      ]);
    }, 220);
  };

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
              <p className="text-sm font-semibold">AI 상담원</p>
              <p className="text-xs text-blue-100">온라인</p>
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
                아래 질문 버튼을 눌러 대화를 시작해보세요.
              </div>
            )}

            {messages.map((message) => {
              const isUser = message.role === "user";

              return (
                <div key={message.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[82%] rounded-2xl px-3 py-2 text-sm leading-relaxed shadow-sm ${
                      isUser
                        ? "rounded-br-md bg-blue-500 text-white"
                        : "rounded-bl-md bg-slate-200 text-slate-900"
                    }`}
                  >
                    {message.text}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="border-t border-slate-200 bg-white p-3 sm:p-4">
            {hasItems ? (
              <div className="max-h-32 space-y-2 overflow-y-auto pr-1 sm:max-h-36">
                {items.map((item) => (
                  <button
                    key={item.question}
                    type="button"
                    onClick={() => handleQuestionClick(item)}
                    className="w-full rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-left text-sm text-blue-700 transition-colors hover:bg-blue-100"
                  >
                    {item.question}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">표시할 질문이 없습니다.</p>
            )}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="ml-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2"
        aria-label="챗봇 열기"
      >
        <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor" aria-hidden="true">
          <path d="M4 5.25A2.25 2.25 0 0 1 6.25 3h11.5A2.25 2.25 0 0 1 20 5.25v8.5A2.25 2.25 0 0 1 17.75 16H9.5l-3.86 3.22A.75.75 0 0 1 4.5 18.64V16A2.25 2.25 0 0 1 2.25 13.75v-8.5Z" />
        </svg>
      </button>
    </div>
  );
}
