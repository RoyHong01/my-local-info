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

    const result = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
      max_tokens: 300,
      messages: [
        {
          role: "system",
          content:
            "You are an AI assistant for a Korean local information blog. Answer in Korean.",
        },
        {
          role: "user",
          content: userMessage,
        },
      ],
    });

    const answer =
      result?.response ||
      result?.result?.response ||
      result?.output_text ||
      "죄송해요. 답변을 생성하지 못했어요.";

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
