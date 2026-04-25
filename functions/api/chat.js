/**
 * Cloudflare Pages Function: POST /api/chat
 * RAG: /data/search-index.json에서 키워드 매칭으로 상위 3개 항목을 추려
 *      시스템 프롬프트에 주입한 뒤 Workers AI로 답변 생성.
 */

function stripMarkdown(input) {
  if (!input) return "";
  let s = String(input);
  s = s.replace(/```[\s\S]*?```/g, " ");
  s = s.replace(/`([^`]+)`/g, "$1");
  s = s.replace(/!\[[^\]]*\]\([^)]*\)/g, " ");
  s = s.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
  s = s.replace(/<[^>]+>/g, " ");
  s = s.replace(/^\s{0,3}#{1,6}\s+/gm, "");
  s = s.replace(/^\s{0,3}>\s?/gm, "");
  s = s.replace(/^\s{0,3}[-*+]\s+/gm, "");
  s = s.replace(/^\s{0,3}\d+\.\s+/gm, "");
  s = s.replace(/\*\*([^*]+)\*\*/g, "$1");
  s = s.replace(/\*([^*]+)\*/g, "$1");
  s = s.replace(/__([^_]+)__/g, "$1");
  s = s.replace(/_([^_]+)_/g, "$1");
  s = s.replace(/~~([^~]+)~~/g, "$1");
  s = s.replace(/[#*_>`~]+/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

function tokenize(text) {
  if (!text) return [];
  return String(text)
    .toLowerCase()
    .split(/[\s,.!?;:()\[\]{}<>"'`~\-+=/\\|]+/)
    .filter((t) => t && t.length >= 2);
}

function searchTopK(index, query, k = 3) {
  const tokens = Array.from(new Set(tokenize(query)));
  if (!tokens.length || !Array.isArray(index)) return [];

  const scored = [];
  for (const item of index) {
    if (!item) continue;
    const searchText = [item.title, item.summary, item.body, item.category]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (!searchText) continue;

    let score = 0;
    for (const tok of tokens) {
      if (!tok) continue;
      if (item.title && item.title.toLowerCase().includes(tok)) score += 3;
      if (searchText.includes(tok)) score += 1;
    }
    if (score > 0) scored.push({ item, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k).map((s) => s.item);
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const userMessage = typeof body?.message === "string" ? body.message.trim() : "";

    if (!userMessage) {
      return new Response(JSON.stringify({ error: "message is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    }

    let topItems = [];
    try {
      const indexUrl = new URL(request.url).origin + "/data/search-index.json";
      const indexRes = await fetch(indexUrl);
      if (indexRes.ok) {
        const index = await indexRes.json();
        topItems = searchTopK(index, userMessage, 3);
      }
    } catch (_) {}

    const blogDataBlock = topItems.length
      ? topItems.map((it, i) => `${i + 1}. ${it.title}\n   ${it.summary || ""}`).join("\n\n")
      : "(관련 데이터 없음)";

    const systemPrompt = `You are an AI assistant for a Korean local information blog.
Answer ONLY in Korean. Keep answers to 2-3 sentences maximum.
Do NOT use any markdown symbols (**, *, #, -). Plain text only.
Base your answer ONLY on the following blog data. If not relevant, reply: 해당 내용은 블로그에서 확인이 어렵습니다. 다른 질문을 해주세요.

[블로그 데이터]
${blogDataBlock}`;

    const result = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
      max_tokens: 150,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
    });

    const rawAnswer =
      result?.response ||
      result?.result?.response ||
      result?.output_text ||
      "죄송해요. 답변을 생성하지 못했어요.";

    const answer = stripMarkdown(rawAnswer);

    return new Response(JSON.stringify({ answer }), {
      status: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "failed to generate answer",
        detail: error instanceof Error ? error.message : "unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      }
    );
  }
}
