/**
 * pick-n-joy-trigger Worker
 * Admin 페이지에서 GitHub Actions workflow_dispatch를 트리거하는 프록시
 *
 * Secrets (wrangler secret put):
 *   ADMIN_SECRET  — X-Admin-Secret 헤더 검증용
 *   GITHUB_TOKEN  — GitHub PAT (workflow 스코프 필요)
 */

const worker = {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowedOrigins = [
      env.ALLOWED_ORIGIN,
      'https://my-local-info-2gs.pages.dev',
      'http://localhost:3000',
    ];
    const corsOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

    const corsHeaders = {
      'Access-Control-Allow-Origin': corsOrigin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Secret',
      'Access-Control-Max-Age': '86400',
    };

    // Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // POST only
    if (request.method !== 'POST') {
      return json({ ok: false, error: 'Method not allowed' }, 405, corsHeaders);
    }

    // Auth check
    const secret = request.headers.get('X-Admin-Secret');
    if (!secret || secret !== env.ADMIN_SECRET) {
      return json({ ok: false, error: 'Unauthorized' }, 401, corsHeaders);
    }

    // Parse body
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, error: 'Invalid JSON body' }, 400, corsHeaders);
    }

    const mode = body.mode;
    if (mode !== 'full' && mode !== 'deploy_only') {
      return json({ ok: false, error: 'Invalid mode. Use "full" or "deploy_only".' }, 400, corsHeaders);
    }

    // GitHub workflow_dispatch
    const ghUrl = `https://api.github.com/repos/${env.GITHUB_REPO}/actions/workflows/${env.GITHUB_WORKFLOW}/dispatches`;

    try {
      const ghRes = await fetch(ghUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'pick-n-joy-trigger-worker',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ref: 'main',
          inputs: { mode },
        }),
      });

      if (ghRes.status === 204) {
        return json({ ok: true, message: `Workflow dispatched (mode: ${mode})` }, 200, corsHeaders);
      }

      const detail = await ghRes.text();
      return json(
        { ok: false, error: `GitHub API error (${ghRes.status})`, detail },
        502,
        corsHeaders,
      );
    } catch (e) {
      return json(
        { ok: false, error: 'Failed to call GitHub API', detail: e.message },
        502,
        corsHeaders,
      );
    }
  },
};

export default worker;

function json(data, status, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
}
