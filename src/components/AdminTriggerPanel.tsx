'use client';

import { useState } from 'react';

const WORKER_URL = 'https://pick-n-joy-trigger.royshong01.workers.dev';
const ADMIN_SECRET = 'picknjoy-admin-2026';

type Mode = 'full' | 'deploy_only';

export default function AdminTriggerPanel() {
  const [loading, setLoading] = useState<Mode | null>(null);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function trigger(mode: Mode) {
    setLoading(mode);
    setResult(null);
    try {
      const res = await fetch(WORKER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Secret': ADMIN_SECRET,
        },
        body: JSON.stringify({ mode }),
      });
      const data = await res.json();
      if (data.ok) {
        setResult({ ok: true, message: `✅ GitHub Actions 실행 요청 완료! (mode: ${mode})` });
      } else {
        setResult({ ok: false, message: `❌ 실패: ${data.error ?? '알 수 없는 오류'}${data.detail ? ` — ${data.detail}` : ''}` });
      }
    } catch (e) {
      setResult({ ok: false, message: `❌ 실패: 네트워크 오류 (${e instanceof Error ? e.message : String(e)})` });
    } finally {
      setLoading(null);
    }
  }

  return (
    <section className="rounded-2xl border border-orange-200 bg-orange-50/60 p-5 md:p-6 shadow-sm mb-6">
      <h2 className="text-lg font-bold text-stone-900">🕹️ 수동 실행</h2>
      <p className="mt-1 text-sm text-stone-500">GitHub Actions 워크플로우를 지금 바로 트리거합니다.</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          onClick={() => trigger('full')}
          disabled={loading !== null}
          className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading === 'full' ? (
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : '🔄'}
          전체 업데이트 실행
        </button>
        <button
          onClick={() => trigger('deploy_only')}
          disabled={loading !== null}
          className="inline-flex items-center gap-2 rounded-lg bg-stone-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-stone-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading === 'deploy_only' ? (
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : '🚀'}
          배포만 실행
        </button>
      </div>
      {result && (
        <p className={`mt-3 rounded-lg px-4 py-2.5 text-sm font-medium ${result.ok ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
          {result.message}
        </p>
      )}
    </section>
  );
}
