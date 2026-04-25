import type { Metadata } from 'next';
import Link from 'next/link';
import { getDailyRunIndex } from '@/lib/daily-runs';
import { toGitHubLoginUrl } from '@/lib/github-auth-link';

export const metadata: Metadata = {
  title: '관리자 | 픽앤조이',
  description: '픽앤조이 운영 관리자 화면',
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  const indexItems = await getDailyRunIndex();
  const latest = indexItems[0];
  const latestFailed = latest?.stageStatuses.some((s) => s.status === 'failure');

  return (
    <div className="bg-cherry-blossom font-sans text-stone-800">
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-10">
        <div className="mb-8">
          <p className="inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">
            내부 운영용 (검색 비노출)
          </p>
          <h1 className="mt-3 text-2xl md:text-3xl font-extrabold text-stone-900">⚙️ 픽앤조이 관리자</h1>
          <p className="mt-2 text-sm text-stone-600">운영 현황을 확인하고 관리하는 내부 화면입니다.</p>
        </div>

        {/* 최신 실행 상태 요약 */}
        <div className={`rounded-2xl border p-5 mb-6 shadow-sm ${latest ? (latestFailed ? 'bg-rose-50 border-rose-200' : 'bg-emerald-50 border-emerald-200') : 'bg-stone-50 border-stone-200'}`}>
          {latest ? (
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className={`text-sm font-bold ${latestFailed ? 'text-rose-700' : 'text-emerald-700'}`}>
                  {latestFailed ? '⚠️ 마지막 실행에 실패한 단계가 있습니다' : '✅ 마지막 자동화 실행 정상'}
                </p>
                <p className="text-xs text-stone-600 mt-0.5">
                  {latest.date} · 블로그 {latest.generatedBlogCount}건 · 맛집 {latest.generatedLifeCount}건
                  {latest.blogBudgetEnabled && ` · Gemini ${Number(latest.blogEstimatedCostKrw || 0).toFixed(0)}원 사용`}
                </p>
              </div>
              <a
                href={toGitHubLoginUrl(latest.runUrl)}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-semibold text-stone-700 underline underline-offset-2 hover:text-stone-900"
              >
                Actions 로그 보기 →
              </a>
            </div>
          ) : (
            <p className="text-sm text-stone-500">아직 생성된 리포트가 없습니다. 다음 스케줄 실행 후 표시됩니다.</p>
          )}
        </div>

        {/* 관리 메뉴 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            href="/admin/runs/"
            className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm hover:shadow-md hover:border-orange-300 transition-all group"
          >
            <div className="text-2xl mb-3">📊</div>
            <h2 className="text-base font-bold text-stone-900 group-hover:text-orange-600 transition-colors">Daily 실행 리포트</h2>
            <p className="text-sm text-stone-500 mt-1">날짜별 자동화 실행 결과, 단계별 성공/실패, Gemini 비용 현황</p>
            {latest && (
              <p className="text-xs text-stone-400 mt-3">최근 {indexItems.length}건 기록됨 · 마지막 {latest.date}</p>
            )}
          </Link>

          <Link
            href="/admin/chat/"
            className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm hover:shadow-md hover:border-orange-300 transition-all group"
          >
            <div className="text-2xl mb-3">💬</div>
            <h2 className="text-base font-bold text-stone-900 group-hover:text-orange-600 transition-colors">실시간 상담</h2>
            <p className="text-sm text-stone-500 mt-1">방문자 챗봇의 상담원 모드 메시지 확인 및 답변 (2초 폴링)</p>
          </Link>
        </div>

        <div className="mt-8">
          <Link href="/" className="text-sm text-stone-500 hover:text-stone-700 underline underline-offset-2">
            ← 홈으로 돌아가기
          </Link>
        </div>
      </main>
    </div>
  );
}
