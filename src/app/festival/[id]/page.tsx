import fs from 'fs/promises';
import path from 'path';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { sanitizeMarkdown } from '@/lib/markdown-utils';
import TaeheoAdBanner from '@/components/TaeheoAdBanner';
import CoupangBanner from '@/components/CoupangBanner';
import ReadingProgressBar from '@/components/ReadingProgressBar';
import { getTopFestival } from '@/lib/priority-calculator';
import { buildFestivalMarkdown } from '@/lib/festival-markdown';

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

const fmtDate = (d: string) => d.length === 8
  ? `${d.slice(0,4)}.${d.slice(4,6)}.${d.slice(6,8)}`
  : d;

function toNumberString(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'string') return value.trim();
  return '';
}

function normalizeDateKey(value: string): string {
  return value.replace(/[^0-9]/g, '');
}

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
  const addr = getField(item, ['addr1', 'location']);
  const addr2 = getField(item, ['addr2']);
  const mapx = toNumberString(item.mapx);
  const mapy = toNumberString(item.mapy);
  const mapTargetName = name || '축제장';
  const kakaoMapHref = mapx && mapy
    ? `https://map.kakao.com/link/to/${encodeURIComponent(mapTargetName)},${mapy},${mapx}`
    : addr
      ? `https://map.kakao.com/?q=${encodeURIComponent(addr)}`
      : '';
  const regionCode = getField(item, ['lDongRegnCd', 'areacode']).trim();
  const currentId = getField(item, ['contentid', 'id']);
  const todayKey = normalizeDateKey(new Date().toISOString().slice(0, 10));
  const relatedFestivals = regionCode
    ? all
        .filter(f => {
          const fid = getField(f, ['contentid', 'id']);
          if (!fid || fid === currentId) return false;
          if (f.expired === true) return false;
          const fRegion = getField(f, ['lDongRegnCd', 'areacode']).trim();
          if (!fRegion || fRegion !== regionCode) return false;
          const fEnd = normalizeDateKey(getField(f, ['eventenddate', 'endDate']));
          if (fEnd && fEnd < todayKey) return false;
          return Boolean(getField(f, ['title', 'name']));
        })
        .sort((a, b) => {
          const aStart = normalizeDateKey(getField(a, ['eventstartdate', 'startDate'])) || '99999999';
          const bStart = normalizeDateKey(getField(b, ['eventstartdate', 'startDate'])) || '99999999';
          return aStart.localeCompare(bStart);
        })
        .slice(0, 3)
    : [];
  const tel = getField(item, ['tel']);
  const homepage = getField(item, ['homepage']);
  const generatedMarkdown = buildFestivalMarkdown({
    name,
    overview,
    startDate: rawStart,
    endDate: rawEnd,
    addr1: addr,
    addr2,
    tel,
    homepage,
  });
  const detailMarkdown = sanitizeMarkdown(getField(item, ['description_markdown']) || generatedMarkdown);
  const editorNote = Array.isArray(item.editor_note)
    ? (item.editor_note as string[]).filter((t): t is string => typeof t === 'string')
    : [];

  return (
    <div className="bg-cherry-blossom font-sans text-stone-800">
      <ReadingProgressBar />
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
                {kakaoMapHref && (
                  <div className="mt-4">
                    <a
                      href={kakaoMapHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 bg-yellow-400 hover:bg-yellow-300 text-stone-900 font-extrabold px-5 py-2.5 rounded-xl transition-colors"
                    >
                      🧭 카카오맵 길찾기
                    </a>
                  </div>
                )}
              </header>

              <div className="prose prose-stone prose-orange lg:prose-lg max-w-none prose-p:my-3 prose-p:leading-8 prose-p:text-stone-900 prose-h2:text-2xl prose-h3:text-xl">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {detailMarkdown}
                </ReactMarkdown>
              </div>

              {editorNote.length > 0 && (
                <div className="mt-6 p-5 bg-rose-50 border border-rose-200 rounded-2xl">
                  <h3 className="text-sm font-extrabold text-rose-700 mb-3 flex items-center gap-1.5">
                    <span>📌</span> 픽앤조이 큐레이터의 한 마디
                  </h3>
                  <ul className="space-y-2">
                    {editorNote.map((tip, i) => (
                      <li key={i} className="text-sm text-stone-700 flex items-start gap-2">
                        <span className="text-rose-500 font-bold flex-shrink-0 mt-0.5">✓</span>
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

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

              {relatedFestivals.length > 0 && (
                <section className="mt-10 pt-8 border-t border-stone-100">
                  <h2 className="text-xl font-extrabold text-stone-900 mb-4">같은 지역 다른 축제</h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {relatedFestivals.map(f => {
                      const fid = getField(f, ['contentid', 'id']);
                      const fTitle = getField(f, ['title', 'name', '서비스명']);
                      const fAddr = getField(f, ['addr1', 'location']);
                      const fStart = getField(f, ['eventstartdate', 'startDate']);
                      const fEnd = getField(f, ['eventenddate', 'endDate']);
                      const fDate = fStart
                        ? fEnd
                          ? `${fmtDate(normalizeDateKey(fStart))} ~ ${fmtDate(normalizeDateKey(fEnd))}`
                          : fmtDate(normalizeDateKey(fStart))
                        : '일정 추후 공지';

                      return (
                        <Link
                          key={fid}
                          href={`/festival/${encodeURIComponent(fid)}`}
                          className="block rounded-2xl border border-rose-100 bg-rose-50/50 p-4 hover:bg-rose-50 transition-colors"
                        >
                          <p className="text-xs font-bold text-rose-600 mb-2">추천 축제</p>
                          <h3 className="text-sm font-extrabold text-stone-900 leading-6 mb-2">{fTitle}</h3>
                          <p className="text-xs text-stone-600 mb-1">📅 {fDate}</p>
                          {fAddr && <p className="text-xs text-stone-500 line-clamp-2">📍 {fAddr}</p>}
                        </Link>
                      );
                    })}
                  </div>
                </section>
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
