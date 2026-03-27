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

export default function SubsidyCardList({ items }: { items: DataItem[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {items.map((item, i) => {
        const name = getField(item, ['서비스명', 'name', 'title']);
        const rawSummary = cleanText(getField(item, ['서비스목적요약', 'summary', 'description']))
          || '상세 정보는 해당 정책을 통해 확인하세요.';
        const target = cleanText(getField(item, ['지원대상', 'target']));
        const org = cleanText(getField(item, ['소관기관명', 'location']));
        const startDate = getField(item, ['startDate']);
        const deadline = getField(item, ['신청기한', 'endDate']);
        const dateStr = startDate && deadline
          ? `${startDate} ~ ${deadline}`
          : deadline || startDate;
        const itemId = encodeURIComponent(getField(item, ['서비스ID', 'id']));
        return (
          <Link
            key={i}
            href={`/subsidy/${itemId}`}
            onClick={() => sessionStorage.setItem('subsidyScrollY', String(window.scrollY))}
          >
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-stone-100 hover:shadow-md hover:border-amber-200 transition-all duration-300 flex flex-col cursor-pointer" style={{minHeight: '200px'}}>
              <h2 className="text-base font-bold mb-2 text-stone-800">{name}</h2>
              {dateStr && (
                <p className="text-xs text-orange-500 mb-2 flex items-center gap-1">
                  <span>📅</span> {dateStr}
                </p>
              )}
              <p className="text-stone-700 text-sm mb-3"
                 style={{display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden'}}>
                {rawSummary}
              </p>
              <div className="mt-auto space-y-1 text-xs text-stone-500">
                {target && (
                  <p className="flex items-center gap-1"
                     style={{display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'}}>
                    <span>🎯</span> {target}
                  </p>
                )}
                {org && <p className="flex items-center gap-1 truncate"><span>🏛</span> {org}</p>}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
