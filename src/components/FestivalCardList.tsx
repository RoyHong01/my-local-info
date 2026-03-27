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

const fmtDate = (d: string) => d.length === 8
  ? `${d.slice(0,4)}.${d.slice(4,6)}.${d.slice(6,8)}`
  : d;

export default function FestivalCardList({ items }: { items: DataItem[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {items.map((item, i) => {
        const name = getField(item, ['title', 'name', '서비스명']);
        const rawSummary = getField(item, ['summary', 'overview', 'description', '서비스목적요약']);
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
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-stone-100 hover:shadow-md hover:border-rose-200 transition-all duration-300 flex flex-col min-h-[200px] cursor-pointer">
              <h2 className="text-base font-bold mb-2 line-clamp-2 text-stone-800">{name}</h2>
              {dateStr && (
                <p className="text-xs text-stone-500 mb-2 flex items-center gap-1">
                  <span>📅</span> {dateStr}
                </p>
              )}
              <p className="text-stone-700 text-sm line-clamp-3 flex-grow">{summary}</p>
              {location && (
                <p className="text-xs text-stone-400 mt-3 flex items-center gap-1">
                  <span>📍</span> {location}
                </p>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
