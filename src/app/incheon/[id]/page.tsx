import fs from 'fs/promises';
import path from 'path';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { sanitizeMarkdown } from '@/lib/markdown-utils';
import TaeheoAdBanner from '@/components/TaeheoAdBanner';
import CoupangBanner from '@/components/CoupangBanner';
import { getTopIncheon } from '@/lib/priority-calculator';
import { buildIncheonMarkdown } from '@/lib/incheon-markdown';

interface DataItem {
  [key: string]: unknown;
}

async function readJson(filename: string): Promise<DataItem[]> {
  try {
    const filePath = path.join(process.cwd(), 'public', 'data', filename);
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return [];
  }
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
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('\n');
}

export async function generateStaticParams() {
  const all = await readJson('incheon.json');
  const topItems = getTopIncheon(all, 500);
  return topItems.map(item => ({
    id: encodeURIComponent(getField(item, ['서비스ID', 'id']))
  })).filter(p => p.id);
}

export default async function IncheonDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const all = await readJson('incheon.json');
  
  const item = all.find(i =>
    encodeURIComponent(getField(i, ['서비스ID', 'id'])) === id
  );

  if (!item) notFound();

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
  const generatedMarkdown = buildIncheonMarkdown({
    name,
    summary,
    content,
    target,
    method,
    deadline,
    supportType,
    userType,
    criteria,
    field,
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
          {/* 메인 콘텐츠 */}
          <div className="flex-1 min-w-0">
            <Link href="/incheon" className="text-sm text-blue-600 hover:underline mb-6 inline-block">
              ← 인천 지역 정보 목록
            </Link>

            <article className="bg-content-floral rounded-3xl shadow-sm border border-stone-100 p-8">
              <header className="mb-6 pb-6 border-b border-stone-100">
                {field && (
                  <span className="inline-block px-3 py-1 bg-blue-50 text-blue-600 text-xs font-bold rounded-full mb-3">
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
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {detailMarkdown}
                </ReactMarkdown>
              </div>

              <div className="mt-8 pt-6 border-t border-stone-100">
                {officialUrl && officialUrl !== '#' ? (
                  <a
                    href={officialUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-3 rounded-xl transition-colors"
                  >
                    공식 사이트에서 신청하기 →
                  </a>
                ) : (
                  <p className="text-xs text-stone-400">정보 출처: 공공데이터포털 (data.go.kr)</p>
                )}
              </div>
            </article>
          </div>
          {/* 사이드바 */}
          <div className="hidden lg:block w-60 flex-shrink-0 self-stretch">
            <aside className="sticky top-24 sticky-sidebar">
              <div className="flex flex-col gap-6">
                <TaeheoAdBanner />
                <CoupangBanner bannerId="coupang-sidebar-incheon-detail" />
              </div>
            </aside>
          </div>
        </div>
      </main>
    </div>
  );
}
