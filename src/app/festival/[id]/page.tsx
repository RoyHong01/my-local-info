import fs from 'fs/promises';
import path from 'path';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { sanitizeMarkdown } from '@/lib/markdown-utils';
import TaeheoAdBanner from '@/components/TaeheoAdBanner';
import CoupangBanner from '@/components/CoupangBanner';
import { getTopFestival } from '@/lib/priority-calculator';

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
    .replace(/\u00a0/g, ' ')
    .split('\n')
    .map(line => line.trim())
    .join('\n')
    .trim();
}

function splitParagraphs(text: string): string[] {
  if (!text) return [];

  const normalized = formatText(text);
  const byBlankLine = normalized
    .split(/\n{2,}/)
    .map(p => p.trim())
    .filter(Boolean);

  if (byBlankLine.length > 1) return byBlankLine;

  const sentenceSplit = normalized
    .split(/(?<=[.!?다])\s+(?=[가-힣A-Za-z0-9"“‘])/)
    .map(s => s.trim())
    .filter(Boolean);

  if (sentenceSplit.length <= 2) return [normalized];

  const chunks: string[] = [];
  for (let i = 0; i < sentenceSplit.length; i += 2) {
    chunks.push(sentenceSplit.slice(i, i + 2).join(' '));
  }
  return chunks;
}

function buildFestivalMarkdown(params: {
  name: string;
  dateStr: string;
  overviewParagraphs: string[];
  addr: string;
  tel: string;
  homepage: string;
}): string {
  const parts: string[] = [];

  parts.push(`## ${params.name} 이렇게 즐겨보세요`);

  if (params.dateStr) {
    parts.push(`- **일정**: ${params.dateStr}`);
  }

  if (params.overviewParagraphs.length > 0) {
    parts.push('### ✨ 축제 소개');
    params.overviewParagraphs.forEach((p) => parts.push(p.trim()));
  }

  parts.push('### 📌 방문 정보');
  if (params.addr) parts.push(`- **주소**: ${params.addr}`);
  if (params.tel) parts.push(`- **전화**: ${params.tel}`);
  if (params.homepage) parts.push(`- **공식 홈페이지**: ${params.homepage}`);

  return parts.join('\n\n').trim();
}

const fmtDate = (d: string) => d.length === 8
  ? `${d.slice(0,4)}.${d.slice(4,6)}.${d.slice(6,8)}`
  : d;

export async function generateStaticParams() {
  const all = await readJson('festival.json');
  const topItems = getTopFestival(all, 300);
  return topItems.map(item => ({
    id: encodeURIComponent(getField(item, ['contentid', 'id']))
  })).filter(p => p.id);
}

export default async function FestivalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const all = await readJson('festival.json');
  
  const item = all.find(i =>
    encodeURIComponent(getField(i, ['contentid', 'id'])) === id
  );

  if (!item) notFound();

  const name = getField(item, ['title', 'name', '서비스명']);
  const rawStart = getField(item, ['eventstartdate', 'startDate']);
  const rawEnd = getField(item, ['eventenddate', 'endDate']);
  const dateStr = rawStart
    ? rawEnd ? `${fmtDate(rawStart)} ~ ${fmtDate(rawEnd)}` : fmtDate(rawStart)
    : '';
  const overview = formatText(getField(item, ['overview', 'summary', 'description', '서비스목적요약']));
  const overviewParagraphs = splitParagraphs(overview);
  const addr = getField(item, ['addr1', 'location']);
  const tel = getField(item, ['tel']);
  const homepage = getField(item, ['homepage']);
  const generatedMarkdown = buildFestivalMarkdown({
    name,
    dateStr,
    overviewParagraphs,
    addr,
    tel,
    homepage,
  });
  const detailMarkdown = sanitizeMarkdown(getField(item, ['description_markdown']) || generatedMarkdown);

  return (
    <div className="bg-cherry-blossom font-sans text-stone-800">

      <main className="max-w-6xl mx-auto px-4 py-10">
        <div className="flex gap-12 items-start overflow-visible">
          {/* 메인 콘텐츠 */}
          <div className="flex-1 min-w-0">
            <Link href="/festival" className="text-sm text-rose-600 hover:underline mb-6 inline-block">
              ← 전국 축제·여행 목록
            </Link>

            <article className="bg-content-floral rounded-3xl shadow-sm border border-stone-100 p-8">
              <header className="mb-6 pb-6 border-b border-stone-100">
                <span className="inline-block px-3 py-1 bg-rose-50 text-rose-600 text-xs font-bold rounded-full mb-3">
                  축제·여행
                </span>
                <h1 className="text-2xl font-extrabold text-stone-900 mb-2">{name}</h1>
                {dateStr && (
                  <p className="text-sm text-orange-500 flex items-center gap-1">
                    <span>📅</span> {dateStr}
                  </p>
                )}
              </header>

              <div className="prose prose-stone prose-orange lg:prose-lg max-w-none prose-p:my-3 prose-p:leading-8 prose-p:text-stone-900 prose-h2:text-2xl prose-h3:text-xl">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {detailMarkdown}
                </ReactMarkdown>
              </div>

              {homepage && (
                <div className="mt-8 pt-6 border-t border-stone-100">
                  <a
                    href={homepage}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-rose-500 hover:bg-rose-600 text-white font-bold px-6 py-3 rounded-xl transition-colors"
                  >
                    공식 홈페이지 방문하기 →
                  </a>
                </div>
              )}
            </article>
          </div>
          {/* 사이드바 */}
          <div className="hidden lg:block w-60 flex-shrink-0 self-stretch">
            <aside className="sticky top-24 sticky-sidebar">
              <div className="flex flex-col gap-6">
                <TaeheoAdBanner />
                <CoupangBanner bannerId="coupang-sidebar-festival-detail" />
              </div>
            </aside>
          </div>
        </div>
      </main>
    </div>
  );
}
