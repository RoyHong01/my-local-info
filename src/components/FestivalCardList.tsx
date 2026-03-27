'use client';
import Link from 'next/link';

interface DataItem {
  [key: string]: unknown;
  expired?: boolean;
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

export default function FestivalCardList({ items }: { items: DataItem[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {items.map((item, i) => {
        const name = getField(item, ['title', 'name', '서비스명']);
        const rawSummary = cleanText(getField(item, ['summary', 'overview', 'description', '서비스목적요약']));
        const summary = rawSummary || '상세 정보는 해당 축제를 통해 확인하세요.';
        const location = getField(item, ['addr1', 'location', '소관기관명']);
        const rawStart = getField(item, ['eventstartdate', 'startDate']);
        const rawEnd = getField(item, ['eventenddate', 'endDate']);
        const dateStr = rawStart
          ? rawEnd ? `${fmtDate(rawStart)} ~ ${fmtDate(rawEnd)}` : fmtDate(rawStart)
          : '';
        const itemId = encodeURIComponent(getField(item, ['contentid', 'id']));
        return (
          <Link
            key={i}
            href={`/festival/${itemId}`}
            onClick={() => sessionStorage.setItem('festivalScrollY', String(window.scrollY))}
          >
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-stone-100 border-t-2 border-t-rose-500 hover:shadow-md hover:border-rose-200 transition-all duration-300 flex flex-col min-h-[220px] cursor-pointer">
              <h2 className="text-[1.05rem] font-bold tracking-tight leading-snug mb-2 line-clamp-2 text-stone-900">{name}</h2>
              {dateStr && (
                <p className="inline-flex w-fit items-center gap-1 rounded-full bg-rose-50 text-rose-700 text-[11px] font-semibold px-2.5 py-1 mb-3">
                  <span className="text-rose-500">📅</span> {dateStr}
                </p>
              )}
              <p className="text-[15px] leading-relaxed text-stone-700 line-clamp-3 mb-4 flex-grow">{summary}</p>
              {location && (
                <p className="mt-auto pt-3 border-t border-stone-100 text-[12px] text-stone-500 flex items-center gap-1 truncate">
                  <span className="text-stone-400">📍</span> {location}
                </p>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
