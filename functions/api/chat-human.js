/**
 * Cloudflare Pages Function: POST /api/chat-human
 * 메시지를 KV(CHAT_KV)에 저장합니다.
 * key:   "msg_" + Date.now()
 * value: JSON.stringify({ message, sender, timestamp })
 */

export async function onRequestPost({ request, env }) {
  try {
    if (!env.CHAT_KV) {
      return new Response(JSON.stringify({ error: "CHAT_KV binding missing" }), {
        status: 500,
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    }

    const { message, sender } = body;
    if (typeof message !== "string" || !message.trim()) {
      return new Response(JSON.stringify({ error: "message is required" }), {
        status: 400,
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    }
    if (typeof sender !== "string" || !sender.trim()) {
      return new Response(JSON.stringify({ error: "sender is required" }), {
        status: 400,
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    }

    const timestamp = Date.now();
    const key = "msg_" + timestamp;
    const value = JSON.stringify({ message, sender, timestamp });

    await env.CHAT_KV.put(key, value);

    return new Response(JSON.stringify({ ok: true, key, timestamp }), {
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
