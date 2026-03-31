'use client';

import { useState } from 'react';
import type { DailyRunReport, DailyRunIndexItem } from '@/lib/daily-runs';

interface Props {
  indexItems: DailyRunIndexItem[];
  reports: DailyRunReport[];
}

function statusBadge(status: string) {
  const v = String(status || '').toLowerCase();
  if (v === 'success') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (v === 'failure') return 'bg-rose-50 text-rose-700 border-rose-200';
  if (v === 'skipped') return 'bg-slate-100 text-slate-600 border-slate-200';
  if (v === 'cancelled') return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-stone-100 text-stone-600 border-stone-200';
}

function statusLabel(status: string) {
  const v = String(status || '').toLowerCase();
  if (v === 'success') return '성공';
  if (v === 'failure') return '실패';
  if (v === 'skipped') return '건너뜀';
  if (v === 'cancelled') return '취소';
  return status || '알 수 없음';
}

function statusIcon(status: string) {
  const v = String(status || '').toLowerCase();
  if (v === 'success') return '✅';
  if (v === 'failure') return '❌';
  if (v === 'skipped') return '⏭️';
  if (v === 'cancelled') return '⛔';
  return '❓';
}

function ReportDetail({ report }: { report: DailyRunReport }) {
  return (
    <div className="space-y-5 py-2">
      {/* 요약 수치 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: '블로그 생성', value: `${report.changes.generatedBlogPosts.length}건` },
          { label: '맛집 생성', value: `${report.changes.generatedLifePosts.length}건` },
          { label: '데이터 변경', value: `${report.changes.dataChangedFiles.length}개` },
          { label: '전체 파일', value: `${report.changes.totalChangedFiles}개` },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-lg bg-stone-50 border border-stone-200 p-3">
            <p className="text-xs text-stone-500">{label}</p>
            <p className="mt-0.5 text-lg font-bold text-stone-900">{value}</p>
          </div>
        ))}
      </div>

      {/* 예산 */}
      {report.budget?.enabled && (
        <div className={`rounded-xl border p-3 text-sm ${report.budget.stopped ? 'bg-rose-50 border-rose-200' : 'bg-emerald-50 border-emerald-200'}`}>
          <span className="font-bold">{report.budget.stopped ? '⛔ Gemini 예산 중단' : '✅ Gemini 예산 정상'}</span>
          <span className="text-stone-600 ml-2">
            {Number(report.budget.estimatedCostKrw || 0).toFixed(2)}원 / 한도 {Number(report.budget.limitKrw || 0).toFixed(0)}원
          </span>
          {report.budget.stopReason && (
            <p className="mt-1 text-xs text-rose-700">사유: {report.budget.stopReason}</p>
          )}
        </div>
      )}

      {/* 단계별 결과 */}
      <div>
        <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">🔄 단계별 실행 결과</p>
        <div className="space-y-2">
          {report.stages.map((stage) => (
            <div
              key={stage.key}
              className={`rounded-lg border p-3 ${
                stage.status === 'success' ? 'bg-emerald-50/50 border-emerald-100' :
                stage.status === 'failure' ? 'bg-rose-50/50 border-rose-100' :
                'bg-stone-50 border-stone-100'
              }`}
            >
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span>{statusIcon(stage.status)}</span>
                  <span className="font-semibold text-stone-900 text-sm">{stage.title}</span>
                  <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${statusBadge(stage.status)}`}>
                    {statusLabel(stage.status)}
                  </span>
                </div>
                {stage.deployUrl && (
                  <a href={stage.deployUrl} target="_blank" rel="noreferrer" className="text-xs text-orange-600 hover:text-orange-700 underline underline-offset-2">
                    배포 미리보기 →
                  </a>
                )}
              </div>
              {stage.steps && Object.keys(stage.steps).length > 0 && (
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1">
                  {Object.entries(stage.steps).map(([stepKey, stepStatus]) => (
                    <div key={stepKey} className="flex items-center gap-1.5 text-xs text-stone-600">
                      <span>{statusIcon(String(stepStatus))}</span>
                      <span className="font-mono text-stone-500 truncate">{stepKey}</span>
                      <span className={`inline-flex rounded border px-1.5 py-0.5 text-xs font-medium ${statusBadge(String(stepStatus))}`}>
                        {statusLabel(String(stepStatus))}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 커밋 목록 */}
      {report.commits && report.commits.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">📝 커밋 ({report.commits.length}건)</p>
          <div className="space-y-2">
            {report.commits.map((commit) => (
              <div key={commit.sha} className="rounded-lg border border-stone-200 bg-stone-50 p-3">
                <p className="font-medium text-stone-900 text-sm">{commit.subject}</p>
                <div className="flex items-center gap-3 mt-1">
                  <a
                    href={`https://github.com/${report.workflow.repository}/commit/${commit.sha}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-mono text-orange-600 hover:text-orange-700 underline underline-offset-2"
                  >
                    {commit.sha.slice(0, 7)}
                  </a>
                  {commit.authoredAt && (
                    <span className="text-xs text-stone-400">{commit.authoredAt.slice(0, 16).replace('T', ' ')}</span>
                  )}
                </div>
                {commit.files && commit.files.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs text-stone-500 mb-1">변경 파일 ({commit.files.length})</p>
                    <div className="flex flex-wrap gap-1">
                      {commit.files.map((file) => (
                        <span key={file} className="inline-flex rounded bg-white border border-stone-200 px-1.5 py-0.5 text-xs font-mono text-stone-700">
                          {file}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 생성 파일 분류 */}
      {(report.changes.generatedBlogPosts.length > 0 || report.changes.generatedLifePosts.length > 0 || report.changes.dataChangedFiles.length > 0) && (
        <div>
          <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">📂 변경 파일 분류</p>
          <div className="space-y-3">
            {report.changes.generatedBlogPosts.length > 0 && (
              <div>
                <p className="text-xs text-stone-500 mb-1">블로그 포스트 ({report.changes.generatedBlogPosts.length})</p>
                <div className="flex flex-wrap gap-1">
                  {report.changes.generatedBlogPosts.map((f) => (
                    <span key={f} className="inline-flex rounded bg-orange-50 border border-orange-200 px-1.5 py-0.5 text-xs font-mono text-orange-800">
                      {f.split('/').pop()}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {report.changes.generatedLifePosts.length > 0 && (
              <div>
                <p className="text-xs text-stone-500 mb-1">맛집 포스트 ({report.changes.generatedLifePosts.length})</p>
                <div className="flex flex-wrap gap-1">
                  {report.changes.generatedLifePosts.map((f) => (
                    <span key={f} className="inline-flex rounded bg-sky-50 border border-sky-200 px-1.5 py-0.5 text-xs font-mono text-sky-800">
                      {f.split('/').pop()}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {report.changes.dataChangedFiles.length > 0 && (
              <div>
                <p className="text-xs text-stone-500 mb-1">데이터 파일 ({report.changes.dataChangedFiles.length})</p>
                <div className="flex flex-wrap gap-1">
                  {report.changes.dataChangedFiles.map((f) => (
                    <span key={f} className="inline-flex rounded bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 text-xs font-mono text-emerald-800">
                      {f.split('/').pop()}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Actions 링크 */}
      <div>
        <a
          href={report.workflow.runUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center rounded-lg bg-stone-900 text-white px-4 py-2 text-sm font-semibold hover:bg-stone-700 transition-colors"
        >
          GitHub Actions 로그 전체 보기 →
        </a>
      </div>
    </div>
  );
}

export default function RunsDetailPanel({ indexItems, reports }: Props) {
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const reportMap = Object.fromEntries(reports.map((r) => [r.reportDateKst, r]));

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left text-stone-500 border-b border-stone-200">
            <th className="py-2 pr-3 w-6"></th>
            <th className="py-2 pr-4">날짜</th>
            <th className="py-2 pr-4">실행</th>
            <th className="py-2 pr-4">블로그</th>
            <th className="py-2 pr-4">맛집</th>
            <th className="py-2 pr-4">블로그 예산</th>
            <th className="py-2 pr-4">파일 변경</th>
            <th className="py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {indexItems.map((item) => {
            const failed = item.stageStatuses.some((s) => s.status === 'failure');
            const summaryClass = failed
              ? 'bg-rose-50 text-rose-700 border-rose-200'
              : 'bg-emerald-50 text-emerald-700 border-emerald-200';
            const isExpanded = expandedDate === item.date;
            const fullReport = reportMap[item.date];

            return (
              <>
                <tr
                  key={`${item.date}-${item.runId}-row`}
                  className={`border-b border-stone-100 transition-colors cursor-pointer ${isExpanded ? 'bg-orange-50/40' : 'hover:bg-orange-50/20'}`}
                  onClick={() => setExpandedDate(isExpanded ? null : item.date)}
                >
                  <td className="py-3 pr-3 text-stone-400 text-xs select-none">
                    {isExpanded ? '▼' : '▶'}
                  </td>
                  <td className="py-3 pr-4 font-semibold text-orange-600">{item.date}</td>
                  <td className="py-3 pr-4">
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${summaryClass}`}>
                      {failed ? '부분 실패' : '정상'}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-stone-700">{item.generatedBlogCount}건</td>
                  <td className="py-3 pr-4 text-stone-700">{item.generatedLifeCount}건</td>
                  <td className="py-3 pr-4 text-stone-700">
                    {item.blogBudgetEnabled
                      ? (item.blogBudgetStopped
                        ? `중단 (${Number(item.blogEstimatedCostKrw || 0).toFixed(0)}/${Number(item.blogBudgetLimitKrw || 0).toFixed(0)}원)`
                        : `정상 (${Number(item.blogEstimatedCostKrw || 0).toFixed(0)}/${Number(item.blogBudgetLimitKrw || 0).toFixed(0)}원)`)
                      : '-'}
                  </td>
                  <td className="py-3 pr-4 text-stone-700">{item.totalChangedFiles}개</td>
                  <td className="py-3">
                    <a
                      href={item.runUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-stone-500 hover:text-stone-700 underline underline-offset-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      #{item.runNumber} ↗
                    </a>
                  </td>
                </tr>

                {isExpanded && (
                  <tr key={`${item.date}-${item.runId}-detail`} className="bg-orange-50/20">
                    <td colSpan={8} className="px-4 pb-5 pt-3 border-b border-orange-100">
                      {fullReport ? (
                        <ReportDetail report={fullReport} />
                      ) : (
                        <p className="text-sm text-stone-500 py-2">상세 리포트 파일을 찾을 수 없습니다.</p>
                      )}
                    </td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
