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

function formatText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('\n');
}

function InfoRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;

  const baseLines = value.split('\n').map(l => l.trim()).filter(Boolean);
  const lines = baseLines.length === 1 && baseLines[0].length > 170
    ? baseLines[0]
        .split(/(?<=[.!?다])\s+(?=[가-힣A-Za-z0-9"“‘])/)
        .map(s => s.trim())
        .filter(Boolean)
        .reduce<string[]>((acc, cur, idx, arr) => {
          if (idx % 2 === 0) acc.push(cur);
          else acc[acc.length - 1] += ` ${cur}`;
          if (idx === arr.length - 1 && idx % 2 === 0) acc[acc.length - 1] = cur;
          return acc;
        }, [])
    : baseLines;

  return (
    <div className="py-3 border-b border-stone-100 last:border-0">
      <dt className="text-xs font-semibold text-stone-500 uppercase mb-1.5 tracking-wide">{label}</dt>
      <dd className="text-[15px] text-stone-900 leading-7 space-y-2">
        {lines.map((line, i) => {
          const isBullet = line.trimStart().startsWith('ㅇ');
          const displayLine = isBullet ? '• ' + line.trimStart().slice(1).trim() : line;
          return <p key={i} className="text-pretty">{displayLine}</p>;
        })}
      </dd>
    </div>
  );
}

export async function generateStaticParams() {
  const all = await readJson('subsidy.json');
  return all.map(item => ({
    id: encodeURIComponent(getField(item, ['서비스ID', 'id']))
  })).filter(p => p.id);
}

export default async function SubsidyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const all = await readJson('subsidy.json');
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

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-stone-800">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-3xl font-bold text-orange-500">픽앤조이 🎯</Link>
          <nav>
            <ul className="flex space-x-4 md:space-x-6 text-base font-medium text-stone-600">
              <li><Link href="/incheon" className="hover:text-blue-600 transition">인천시 정보</Link></li>
              <li><Link href="/subsidy" className="text-amber-600 font-bold">전국 보조금·복지 정책</Link></li>
              <li><Link href="/festival" className="hover:text-rose-600 transition">전국 축제·여행 정보</Link></li>
              <li><Link href="/blog" className="hover:text-orange-500 transition">블로그</Link></li>
            </ul>
          </nav>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10">
        <Link href="/subsidy" className="text-sm text-amber-600 hover:underline mb-6 inline-block">
          ← 전국 보조금 목록
        </Link>

        <article className="bg-white rounded-3xl shadow-sm border border-stone-100 p-8">
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

          <dl>
            <InfoRow label="서비스 요약" value={summary} />
            <InfoRow label="지원 내용" value={content} />
            <InfoRow label="지원 대상" value={target} />
            <InfoRow label="지원 유형" value={supportType} />
            <InfoRow label="신청 대상 구분" value={userType} />
            <InfoRow label="선정 기준" value={criteria} />
            <InfoRow label="신청 방법" value={method} />
            <InfoRow label="접수 기관" value={office} />
            <InfoRow label="담당 부서" value={dept} />
            <InfoRow label="전화 문의" value={phone} />
            <InfoRow label="소관 기관" value={org} />
          </dl>

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
