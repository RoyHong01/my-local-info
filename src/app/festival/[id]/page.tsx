import fs from 'fs/promises';
import path from 'path';
import Link from 'next/link';
import { notFound } from 'next/navigation';

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

const cleanText = (text: string) =>
  text.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();

const fmtDate = (d: string) => d.length === 8
  ? `${d.slice(0,4)}.${d.slice(4,6)}.${d.slice(6,8)}`
  : d;

export async function generateStaticParams() {
  const all = await readJson('festival.json');
  return all.map(item => ({
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
  const overview = cleanText(getField(item, ['overview', 'summary', 'description', '서비스목적요약']));
  const addr = getField(item, ['addr1', 'location']);
  const tel = getField(item, ['tel']);
  const homepage = getField(item, ['homepage']);

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-stone-800">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-3xl font-bold text-orange-500">픽앤조이 🎯</Link>
          <nav>
            <ul className="flex space-x-4 md:space-x-6 text-base font-medium text-stone-600">
              <li><Link href="/incheon" className="hover:text-blue-600 transition">인천시 정보</Link></li>
              <li><Link href="/subsidy" className="hover:text-amber-600 transition">전국 보조금·복지 정책</Link></li>
              <li><Link href="/festival" className="text-rose-600 font-bold">전국 축제·여행 정보</Link></li>
              <li><Link href="/blog" className="hover:text-orange-500 transition">블로그</Link></li>
            </ul>
          </nav>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10">
        <Link href="/festival" className="text-sm text-rose-600 hover:underline mb-6 inline-block">
          ← 전국 축제·여행 목록
        </Link>

        <article className="bg-white rounded-3xl shadow-sm border border-stone-100 p-8">
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

          <dl>
            {overview && (
              <div className="py-4 border-b border-stone-100">
                <dt className="text-xs font-semibold text-stone-400 uppercase mb-1">상세 설명</dt>
                <dd className="text-stone-700 text-sm leading-relaxed">{overview}</dd>
              </div>
            )}
            {addr && (
              <div className="py-4 border-b border-stone-100">
                <dt className="text-xs font-semibold text-stone-400 uppercase mb-1">주소</dt>
                <dd className="text-stone-700 text-sm flex items-center gap-1"><span>📍</span> {addr}</dd>
              </div>
            )}
            {tel && (
              <div className="py-4 border-b border-stone-100 last:border-0">
                <dt className="text-xs font-semibold text-stone-400 uppercase mb-1">전화</dt>
                <dd className="text-stone-700 text-sm">{tel}</dd>
              </div>
            )}
          </dl>

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
      </main>

      <footer className="bg-stone-900 text-stone-400 py-10 mt-16 text-sm">
        <div className="max-w-5xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-center md:text-left">
            <p className="font-bold text-lg text-white mb-1">픽앤조이</p>
            <p className="text-stone-500">pick-n-joy.com</p>
          </div>
          <div className="text-center md:text-right text-stone-500">
            <p>데이터 출처: 공공데이터포털 · 한국관광공사</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
