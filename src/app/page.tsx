import fs from 'fs/promises';
import path from 'path';
import Link from 'next/link';
import AdBanner from '@/components/AdBanner';

interface DataItem {
  [key: string]: unknown;
  expired?: boolean;
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

function IncheonCard({ item }: { item: DataItem }) {
  const name = getField(item, ['서비스명', 'name', 'title']);
  const summary = getField(item, ['서비스목적요약', 'summary', 'description']);
  const org = getField(item, ['소관기관명', 'location', 'addr1']);
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-stone-100 hover:shadow-md hover:border-blue-200 transition-all duration-300 flex flex-col h-full">
      <span className="inline-block px-3 py-1 bg-blue-50 text-blue-600 text-xs font-bold rounded-full mb-3 self-start">
        인천
      </span>
      <h4 className="text-base font-bold mb-2 line-clamp-2 text-stone-800">{name}</h4>
      <p className="text-stone-500 text-sm line-clamp-2 flex-grow">{summary}</p>
      {org && (
        <p className="text-xs text-stone-400 mt-3 flex items-center gap-1">
          <span>🏛</span> {org}
        </p>
      )}
    </div>
  );
}

function SubsidyCard({ item }: { item: DataItem }) {
  const name = getField(item, ['서비스명', 'name', 'title']);
  const summary = getField(item, ['서비스목적요약', 'summary', 'description']);
  const target = getField(item, ['지원대상', 'target']);
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-stone-100 hover:shadow-md hover:border-amber-200 transition-all duration-300 flex flex-col h-full">
      <span className="inline-block px-3 py-1 bg-amber-50 text-amber-600 text-xs font-bold rounded-full mb-3 self-start">
        보조금
      </span>
      <h4 className="text-base font-bold mb-2 text-stone-800">{name}</h4>
      <p className="text-stone-500 text-sm flex-grow">{summary}</p>
      {target && (
        <p className="text-xs text-stone-400 mt-3 flex items-center gap-1">
          <span>🎯</span> {target}
        </p>
      )}
    </div>
  );
}

function FestivalCard({ item }: { item: DataItem }) {
  const name = getField(item, ['title', 'name', '서비스명']);
  const summary = getField(item, ['summary', 'overview', 'description', '서비스목적요약']);
  const location = getField(item, ['addr1', 'location', '소관기관명']);
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-stone-100 hover:shadow-md hover:border-rose-200 transition-all duration-300 flex flex-col h-full">
      <span className="inline-block px-3 py-1 bg-rose-50 text-rose-600 text-xs font-bold rounded-full mb-3 self-start">
        축제·여행
      </span>
      <h4 className="text-base font-bold mb-2 line-clamp-2 text-stone-800">{name}</h4>
      <p className="text-stone-500 text-sm line-clamp-2 flex-grow">{summary}</p>
      {location && (
        <p className="text-xs text-stone-400 mt-3 flex items-center gap-1">
          <span>📍</span> {location}
        </p>
      )}
    </div>
  );
}

export default async function Home() {
  const [incheonAll, subsidyAll, festivalAll] = await Promise.all([
    readJson('incheon.json'),
    readJson('subsidy.json'),
    readJson('festival.json'),
  ]);

  const incheon = incheonAll.filter(i => !i.expired).slice(0, 3);
  const subsidy = subsidyAll.filter(i => !i.expired).slice(0, 3);
  const festival = festivalAll.filter(i => !i.expired).slice(0, 3);

  const today = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric'
  });

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-stone-800">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-orange-500">픽앤조이 🎯</Link>
          <nav>
            <ul className="flex space-x-3 md:space-x-5 text-sm font-medium text-stone-600">
              <li><Link href="#incheon" className="hover:text-blue-600 transition">인천정보</Link></li>
              <li><Link href="#subsidy" className="hover:text-amber-600 transition">보조금</Link></li>
              <li><Link href="#festival" className="hover:text-rose-600 transition">축제·여행</Link></li>
              <li><Link href="/blog" className="hover:text-orange-500 transition">블로그</Link></li>
              <li><Link href="/about" className="hover:text-orange-500 transition">소개</Link></li>
            </ul>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-br from-orange-500 to-amber-400 text-white py-16 px-4 text-center">
        <h1 className="text-3xl md:text-5xl font-extrabold mb-4 drop-shadow">
          당신의 일상을 Pick, 당신의 주말을 Enjoy!
        </h1>
        <p className="text-orange-100 text-sm md:text-base max-w-xl mx-auto">
          인천 및 전국의 최신 행사·축제·보조금·여행 정보를 매일 업데이트합니다.
        </p>
      </section>

      <main className="max-w-5xl mx-auto px-4 py-10">
        {/* 3열 가로 배치 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* 인천 지역 정보 열 */}
          <section id="incheon" className="scroll-mt-24 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-extrabold flex items-center gap-2">
                <span className="text-xl">🏙</span> 인천 지역 정보
              </h2>
            </div>
            <div className="flex flex-col gap-4 flex-grow">
              {incheon.length === 0 ? (
                <p className="text-stone-400 text-sm py-8 text-center">곧 업데이트될 예정입니다.</p>
              ) : (
                incheon.map((item, i) => <IncheonCard key={i} item={item} />)
              )}
            </div>
            <Link href="/incheon" className="text-sm text-blue-600 hover:underline mt-4 text-right">더보기 →</Link>
          </section>

          {/* 전국 보조금 열 */}
          <section id="subsidy" className="scroll-mt-24 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-extrabold flex items-center gap-2">
                <span className="text-xl">💰</span> 전국 보조금·복지
              </h2>
            </div>
            <div className="flex flex-col gap-4 flex-grow">
              {subsidy.length === 0 ? (
                <p className="text-stone-400 text-sm py-8 text-center">곧 업데이트될 예정입니다.</p>
              ) : (
                subsidy.map((item, i) => <SubsidyCard key={i} item={item} />)
              )}
            </div>
            <Link href="/subsidy" className="text-sm text-amber-600 hover:underline mt-4 text-right">더보기 →</Link>
          </section>

          {/* 전국 축제·여행 열 */}
          <section id="festival" className="scroll-mt-24 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-extrabold flex items-center gap-2">
                <span className="text-xl">🎪</span> 전국 축제·여행
              </h2>
            </div>
            <div className="flex flex-col gap-4 flex-grow">
              {festival.length === 0 ? (
                <p className="text-stone-400 text-sm py-8 text-center">곧 업데이트될 예정입니다.</p>
              ) : (
                festival.map((item, i) => <FestivalCard key={i} item={item} />)
              )}
            </div>
            <Link href="/festival" className="text-sm text-rose-600 hover:underline mt-4 text-right">더보기 →</Link>
          </section>
        </div>

        {/* Ad Banner */}
        <div className="mt-12">
          <AdBanner />
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-stone-900 text-stone-400 py-10 mt-16 text-sm">
        <div className="max-w-5xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-center md:text-left">
            <p className="font-bold text-lg text-white mb-1">픽앤조이</p>
            <p className="text-stone-500">pick-n-joy.com</p>
          </div>
          <div className="text-center md:text-right text-stone-500 space-y-1">
            <p>데이터 출처: 공공데이터포털 · 한국관광공사</p>
            <p>마지막 업데이트: {today}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
