import fs from 'fs/promises';
import path from 'path';
import Link from 'next/link';

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

export default async function IncheonPage() {
  const all = await readJson('incheon.json');
  const items = all.filter(i => !i.expired);

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-stone-800">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-orange-500">픽앤조이 🎯</Link>
          <nav>
            <ul className="flex space-x-3 md:space-x-5 text-sm font-medium text-stone-600">
              <li><Link href="/incheon" className="text-blue-600 font-bold">인천정보</Link></li>
              <li><Link href="/subsidy" className="hover:text-amber-600 transition">보조금</Link></li>
              <li><Link href="/festival" className="hover:text-rose-600 transition">축제·여행</Link></li>
              <li><Link href="/blog" className="hover:text-orange-500 transition">블로그</Link></li>
            </ul>
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-extrabold flex items-center gap-2 mb-2">
            <span className="text-3xl">🏙</span> 인천 지역 정보
          </h1>
          <p className="text-stone-500 text-sm">인천광역시 내 행사·축제·보조금 정보 전체 목록입니다.</p>
        </div>

        {items.length === 0 ? (
          <p className="text-stone-400 text-sm py-16 text-center">곧 업데이트될 예정입니다.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {items.map((item, i) => {
              const name = getField(item, ['서비스명', 'name', 'title']);
              const summary = getField(item, ['서비스목적요약', 'summary', 'description']);
              const org = getField(item, ['소관기관명', 'location', 'addr1']);
              const target = getField(item, ['지원대상', 'target']);
              return (
                <div key={i} className="bg-white rounded-2xl p-5 shadow-sm border border-stone-100 hover:shadow-md hover:border-blue-200 transition-all duration-300 flex flex-col min-h-[180px]">
                  <span className="inline-block px-3 py-1 bg-blue-50 text-blue-600 text-xs font-bold rounded-full mb-3 self-start">인천</span>
                  <h2 className="text-base font-bold mb-2 line-clamp-2 text-stone-800">{name}</h2>
                  <p className="text-stone-700 text-sm line-clamp-3 overflow-hidden flex-grow">{summary || '상세 정보는 해당 서비스를 통해 확인하세요.'}</p>
                  <div className="mt-3 space-y-1 text-xs text-stone-400">
                    {org && <p className="flex items-center gap-1"><span>🏛</span> {org}</p>}
                    {target && <p className="flex items-center gap-1"><span>🎯</span> {target}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
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
