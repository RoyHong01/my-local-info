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

export default function ChatBot({ items }: ChatBotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

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
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isOpen, isLoading]);

  const addBotMessage = (text: string) => {
    setMessages((prev) => [
      ...prev,
      { id: `${Date.now()}-a-${Math.random()}`, role: "bot", text },
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

  const submitQuestion = async (question: string) => {
    await submitToAi(question);
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
              <p className="text-sm font-semibold">AI 도우미</p>
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
              return (
                <div key={message.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                  <div className={`flex max-w-[82%] flex-col ${isUser ? "items-end" : "items-start"}`}>
                    <div
                      className={`rounded-2xl px-3 py-2 text-sm leading-relaxed shadow-sm ${
                        isUser
                          ? "rounded-br-md bg-blue-500 text-white"
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
                  답변 생성 중...
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-slate-200 bg-white p-3 sm:p-4">
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

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={inputText}
                onChange={(event) => setInputText(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="메시지를 입력하세요"
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
