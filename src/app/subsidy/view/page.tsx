'use client';

import Link from 'next/link';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import TaeheoAdBanner from '@/components/TaeheoAdBanner';
import CoupangBanner from '@/components/CoupangBanner';
import { sanitizeMarkdown } from '@/lib/markdown-utils';

interface DataItem {
  [key: string]: unknown;
}

function getField(item: DataItem, keys: string[]): string {
  for (const key of keys) {
    if (item[key] && typeof item[key] === 'string') return item[key] as string;
  }
  return '';
}

function formatText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join('\n');
}

function markdownEscape(value: string): string {
  return value
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\u00a0/g, ' ')
    .trim();
}

function buildSubsidyMarkdown(params: {
  name: string;
  summary: string;
  content: string;
  target: string;
  method: string;
  deadline: string;
  supportType: string;
  userType: string;
  criteria: string;
  office: string;
  dept: string;
  phone: string;
  org: string;
}): string {
  const parts: string[] = [];

  parts.push(`## ${params.name} 꼭 알아야 할 핵심`);

  if (params.summary) {
    parts.push(markdownEscape(params.summary));
  }

  if (params.content) {
    parts.push('### 💡 어떤 혜택인가요?');
    parts.push(markdownEscape(params.content));
  }

  if (params.target) {
    parts.push('### 👥 지원 대상');
    parts.push(markdownEscape(params.target));
  }

  if (params.method) {
    parts.push('### 📝 신청 방법');
    parts.push(markdownEscape(params.method));
  }

  const infos = [
    ['신청기한', params.deadline],
    ['지원유형', params.supportType],
    ['신청 대상 구분', params.userType],
    ['선정 기준', params.criteria],
    ['접수 기관', params.office],
    ['담당 부서', params.dept],
    ['전화 문의', params.phone],
    ['소관 기관', params.org],
  ].filter(([, v]) => !!v);

  if (infos.length > 0) {
    parts.push('### 📌 한눈에 보는 신청 정보');
    infos.forEach(([k, v]) => parts.push(`- **${k}**: ${markdownEscape(v as string)}`));
  }

  return parts.join('\n\n').trim();
}

function SubsidyViewContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id') ?? '';

  const [items, setItems] = useState<DataItem[] | null>(null);

  useEffect(() => {
    let mounted = true;

    fetch('/data/subsidy.json', { cache: 'force-cache' })
      .then((res) => (res.ok ? res.json() : []))
      .then((json) => {
        if (!mounted) return;
        if (Array.isArray(json)) {
          setItems(json as DataItem[]);
          return;
        }
        setItems([]);
      })
      .catch(() => {
        if (mounted) setItems([]);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const item = useMemo(() => {
    if (!items || !id) return null;
    return items.find(
      (entry) => encodeURIComponent(getField(entry, ['서비스ID', 'id'])) === id
    ) ?? null;
  }, [items, id]);

  if (!id) {
    return (
      <div className="bg-cherry-blossom font-sans text-stone-800">
        <main className="max-w-6xl mx-auto px-4 py-10">
          <p className="text-sm text-stone-500">잘못된 접근입니다. 목록에서 다시 선택해주세요.</p>
          <Link href="/subsidy" className="text-sm text-amber-600 hover:underline mt-4 inline-block">
            ← 전국 보조금 목록으로 이동
          </Link>
        </main>
      </div>
    );
  }

  if (items === null) {
    return (
      <div className="bg-cherry-blossom font-sans text-stone-800">
        <main className="max-w-6xl mx-auto px-4 py-10">
          <p className="text-sm text-stone-500">상세 정보를 불러오는 중입니다...</p>
        </main>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="bg-cherry-blossom font-sans text-stone-800">
        <main className="max-w-6xl mx-auto px-4 py-10">
          <p className="text-sm text-stone-500">해당 정책 정보를 찾을 수 없습니다.</p>
          <Link href="/subsidy" className="text-sm text-amber-600 hover:underline mt-4 inline-block">
            ← 전국 보조금 목록으로 이동
          </Link>
        </main>
      </div>
    );
  }

  const name = getField(item, ['서비스명', 'name', 'title']);
  const field = getField(item, ['서비스분야']);
  const deadline = getField(item, ['신청기한', 'endDate']);
  const summary = formatText(getField(item, ['서비스목적요약', 'summary', 'description']));
  const content = formatText(getField(item, ['지원내용']));
  const target = formatText(getField(item, ['지원대상', 'target']));
  const method = formatText(getField(item, ['신청방법']));
  const office = formatText(getField(item, ['접수기관명']));
  const phone = getField(item, ['전화문의']);
  const org = formatText(getField(item, ['소관기관명', 'location']));
  const supportType = getField(item, ['지원유형']);
  const userType = getField(item, ['사용자구분']);
  const dept = getField(item, ['부서명']);
  const criteria = formatText(getField(item, ['선정기준']));
  const officialUrl = getField(item, ['상세조회URL', 'link']);
  const generatedMarkdown = buildSubsidyMarkdown({
    name,
    summary,
    content,
    target,
    method,
    deadline,
    supportType,
    userType,
    criteria,
    office,
    dept,
    phone,
    org,
  });
  const detailMarkdown = sanitizeMarkdown(getField(item, ['description_markdown']) || generatedMarkdown);

  return (
    <div className="bg-cherry-blossom font-sans text-stone-800">
      <main className="max-w-6xl mx-auto px-4 py-10">
        <div className="flex gap-12 items-start overflow-visible">
          <div className="flex-1 min-w-0">
            <Link href="/subsidy" className="text-sm text-amber-600 hover:underline mb-6 inline-block">
              ← 전국 보조금 목록
            </Link>

            <article className="bg-content-floral rounded-3xl shadow-sm border border-stone-100 p-8">
              <header className="mb-6 pb-6 border-b border-stone-100">
                {field && (
                  <span className="inline-block px-3 py-1 bg-amber-50 text-amber-600 text-xs font-bold rounded-full mb-3">
                    {field}
                  </span>
                )}
                <h1 className="text-2xl font-extrabold text-stone-900 mb-2">{name}</h1>
                {deadline && (
                  <p className="text-sm text-orange-500 flex items-center gap-1">
                    <span>📅</span> 신청기한: {deadline}
                  </p>
                )}
              </header>

              <div className="prose prose-stone prose-orange lg:prose-lg max-w-none prose-p:my-3 prose-p:leading-8 prose-p:text-stone-900 prose-h2:text-2xl prose-h3:text-xl">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{detailMarkdown}</ReactMarkdown>
              </div>

              <div className="mt-8 pt-6 border-t border-stone-100">
                {officialUrl && officialUrl !== '#' ? (
                  <a
                    href={officialUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-bold px-6 py-3 rounded-xl transition-colors"
                  >
                    공식 사이트에서 신청하기 →
                  </a>
                ) : (
                  <p className="text-xs text-stone-400">정보 출처: 공공데이터포털 (data.go.kr)</p>
                )}
              </div>
            </article>
          </div>

          <div className="hidden lg:block w-60 flex-shrink-0 self-stretch">
            <aside className="sticky top-24 sticky-sidebar">
              <div className="flex flex-col gap-6">
                <TaeheoAdBanner />
                <CoupangBanner bannerId="coupang-sidebar-subsidy-detail" />
              </div>
            </aside>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function SubsidyViewPage() {
  return (
    <Suspense
      fallback={
        <div className="bg-cherry-blossom font-sans text-stone-800">
          <main className="max-w-6xl mx-auto px-4 py-10">
            <p className="text-sm text-stone-500">상세 정보를 불러오는 중입니다...</p>
          </main>
        </div>
      }
    >
      <SubsidyViewContent />
    </Suspense>
  );
}
