import type { Metadata } from 'next';
import Link from 'next/link';
import { getDailyRunIndex, getDailyRunReports } from '@/lib/daily-runs';

export const metadata: Metadata = {
  title: '운영 리포트 | 픽앤조이',
  description: 'Daily Update & Deploy 실행 결과 리포트',
  robots: {
    index: false,
    follow: false,
  },
};

function statusBadge(status: string) {
  const value = String(status || '').toLowerCase();
  if (value === 'success') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (value === 'failure') return 'bg-rose-50 text-rose-700 border-rose-200';
  if (value === 'skipped') return 'bg-slate-100 text-slate-600 border-slate-200';
  if (value === 'cancelled') return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-stone-100 text-stone-600 border-stone-200';
}

function statusLabel(status: string) {
  const value = String(status || '').toLowerCase();
  if (value === 'success') return '성공';
  if (value === 'failure') return '실패';
  if (value === 'skipped') return '건너뜀';
  if (value === 'cancelled') return '취소';
  return '알 수 없음';
}

export default async function AdminRunsPage() {
  const [indexItems, reports] = await Promise.all([getDailyRunIndex(), getDailyRunReports(20)]);
  const latest = reports[0];

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50/40 via-white to-stone-50">
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-6">
          <p className="inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">
            내부 운영용 (검색 비노출)
          </p>
          <h1 className="mt-3 text-2xl md:text-3xl font-extrabold text-stone-900">📊 Daily Update & Deploy 리포트</h1>
          <p className="mt-2 text-sm text-stone-600">
            자동 수집/생성/배포 작업 결과를 날짜별로 확인하는 관리자 화면입니다.
          </p>
        </div>

        {!latest ? (
          <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center text-stone-500 shadow-sm">
            아직 생성된 일일 리포트가 없습니다. 다음 스케줄 실행 후 자동으로 표시됩니다.
          </div>
        ) : (
          <>
            <section className="rounded-2xl border border-stone-200 bg-white p-5 md:p-6 shadow-sm mb-6">
              <h2 className="text-lg font-bold text-stone-900">최신 실행 요약 ({latest.reportDateKst})</h2>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="rounded-xl bg-stone-50 p-4 border border-stone-200">
                  <p className="text-xs text-stone-500">실행 번호</p>
                  <p className="mt-1 text-xl font-bold text-stone-900">#{latest.workflow.runNumber}</p>
                </div>
                <div className="rounded-xl bg-stone-50 p-4 border border-stone-200">
                  <p className="text-xs text-stone-500">블로그 생성</p>
                  <p className="mt-1 text-xl font-bold text-stone-900">{latest.changes.generatedBlogPosts.length}건</p>
                </div>
                <div className="rounded-xl bg-stone-50 p-4 border border-stone-200">
                  <p className="text-xs text-stone-500">맛집 생성</p>
                  <p className="mt-1 text-xl font-bold text-stone-900">{latest.changes.generatedLifePosts.length}건</p>
                </div>
                <div className="rounded-xl bg-stone-50 p-4 border border-stone-200">
                  <p className="text-xs text-stone-500">총 변경 파일</p>
                  <p className="mt-1 text-xl font-bold text-stone-900">{latest.changes.totalChangedFiles}개</p>
                </div>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-stone-500 border-b border-stone-200">
                      <th className="py-2 pr-4">단계</th>
                      <th className="py-2 pr-4">상태</th>
                      <th className="py-2">배포 URL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {latest.stages.map((stage) => (
                      <tr key={stage.key} className="border-b border-stone-100 last:border-0">
                        <td className="py-3 pr-4 font-medium text-stone-800">{stage.title}</td>
                        <td className="py-3 pr-4">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusBadge(stage.status)}`}>
                            {statusLabel(stage.status)}
                          </span>
                        </td>
                        <td className="py-3">
                          {stage.deployUrl ? (
                            <a className="text-orange-600 hover:text-orange-700 underline underline-offset-2" href={stage.deployUrl} target="_blank" rel="noreferrer">
                              배포 미리보기 열기
                            </a>
                          ) : (
                            <span className="text-stone-400">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {latest.workflow.runUrl && (
                <div className="mt-4">
                  <a
                    href={latest.workflow.runUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center rounded-lg bg-stone-900 text-white px-4 py-2 text-sm font-semibold hover:bg-stone-700 transition-colors"
                  >
                    GitHub Actions 실행 로그 보기
                  </a>
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-stone-200 bg-white p-5 md:p-6 shadow-sm">
              <h2 className="text-lg font-bold text-stone-900">날짜별 리포트 이력</h2>
              <p className="mt-1 text-sm text-stone-500">최근 {indexItems.length}건의 실행 결과를 보여줍니다.</p>

              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-stone-500 border-b border-stone-200">
                      <th className="py-2 pr-4">날짜</th>
                      <th className="py-2 pr-4">실행</th>
                      <th className="py-2 pr-4">블로그</th>
                      <th className="py-2 pr-4">맛집</th>
                      <th className="py-2 pr-4">파일 변경</th>
                      <th className="py-2">링크</th>
                    </tr>
                  </thead>
                  <tbody>
                    {indexItems.map((item) => {
                      const failed = item.stageStatuses.some((stage) => stage.status === 'failure');
                      const summaryClass = failed ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200';

                      return (
                        <tr key={`${item.date}-${item.runId}`} className="border-b border-stone-100 last:border-0">
                          <td className="py-3 pr-4 font-semibold text-stone-900">{item.date}</td>
                          <td className="py-3 pr-4">
                            <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${summaryClass}`}>
                              {failed ? '부분 실패' : '정상'}
                            </span>
                          </td>
                          <td className="py-3 pr-4 text-stone-700">{item.generatedBlogCount}건</td>
                          <td className="py-3 pr-4 text-stone-700">{item.generatedLifeCount}건</td>
                          <td className="py-3 pr-4 text-stone-700">{item.totalChangedFiles}개</td>
                          <td className="py-3">
                            <a href={item.runUrl} target="_blank" rel="noreferrer" className="text-orange-600 hover:text-orange-700 underline underline-offset-2">
                              Run #{item.runNumber}
                            </a>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        <div className="mt-6">
          <Link href="/" className="text-sm text-stone-500 hover:text-stone-700 underline underline-offset-2">
            ← 홈으로 돌아가기
          </Link>
        </div>
      </main>
    </div>
  );
}
