/**
 * Cloudflare Pages Function: GET /api/chat-poll
 * KV(CHAT_KV)에서 "msg_" prefix의 메시지를 모두 조회합니다.
 * 쿼리 파라미터:
 *   - sender: 지정 시 해당 발신자 메시지만 필터링
 */

export async function onRequestGet({ request, env }) {
  try {
    if (!env.CHAT_KV) {
      return new Response(JSON.stringify({ error: "CHAT_KV binding missing" }), {
        status: 500,
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    }

    const url = new URL(request.url);
    const senderFilter = url.searchParams.get("sender");

    const messages = [];
    let cursor;
    do {
      const list = await env.CHAT_KV.list({ prefix: "msg_", cursor });
      for (const k of list.keys) {
        const raw = await env.CHAT_KV.get(k.name);
        if (!raw) continue;
        try {
          const parsed = JSON.parse(raw);
          if (senderFilter && parsed.sender !== senderFilter) continue;
          messages.push({
            key: k.name,
            message: parsed.message,
            sender: parsed.sender,
            timestamp: parsed.timestamp,
          });
        } catch {
          // skip invalid entry
        }
      }
      cursor = list.list_complete ? undefined : list.cursor;
    } while (cursor);

    messages.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

    return new Response(JSON.stringify({ messages }), {
      status: 200,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal error", detail: String(err && err.message || err) }),
      { status: 500, headers: { "content-type": "application/json; charset=utf-8" } }
    );
  }
}
