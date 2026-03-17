import fs from 'fs/promises';
import path from 'path';
import Link from 'next/link';
import { notFound } from 'next/navigation';

interface InfoItem {
  id: string;
  name: string;
  category: "행사" | "혜택";
  startDate: string;
  endDate: string;
  location: string;
  target: string;
  summary: string;
  link: string;
}

// 빌드 타임에 생성할 경로 지정 (Static Export를 위함)
export async function generateStaticParams() {
  const filePath = path.join(process.cwd(), 'public/data/local-info.json');
  const fileContents = await fs.readFile(filePath, 'utf8');
  const items: InfoItem[] = JSON.parse(fileContents);

  return items.map((item) => ({
    id: item.id,
  }));
}

export default async function DetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const filePath = path.join(process.cwd(), 'public/data/local-info.json');
  const fileContents = await fs.readFile(filePath, 'utf8');
  const items: InfoItem[] = JSON.parse(fileContents);

  const item = items.find((i) => i.id === id);

  if (!item) {
    notFound();
  }

  const isEvent = item.category === '행사';
  const themeColorText = isEvent ? 'text-rose-600' : 'text-amber-600';
  const themeColorBg = isEvent ? 'bg-rose-50' : 'bg-amber-50';
  const themeColorBtn = isEvent ? 'bg-rose-500 hover:bg-rose-600' : 'bg-amber-500 hover:bg-amber-600';

  return (
    <div className="min-h-screen bg-orange-50/50 font-sans text-stone-800">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-orange-600">← 성남시 생활 정보</Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-4 py-12">
        <article className="bg-white rounded-3xl p-8 md:p-12 shadow-sm border border-stone-100">
          
          {/* Category Badge */}
          <div className="mb-6">
             <span className={`inline-block px-4 py-1.5 ${themeColorBg} ${themeColorText} text-sm font-bold rounded-full`}>
               {item.category}
             </span>
          </div>

          {/* Title */}
          <h1 className="text-3xl md:text-4xl font-extrabold text-stone-900 mb-8 leading-tight">
            {item.name}
          </h1>

          {/* Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10 text-stone-600">
            {isEvent ? (
              <>
                <div className="bg-stone-50 p-5 rounded-2xl flex items-start gap-4">
                  <span className="text-2xl mt-0.5">📅</span>
                  <div>
                    <p className="text-xs font-bold text-stone-400 mb-1">기간</p>
                    <p className="font-medium text-stone-800">{item.startDate} {item.endDate && `~ ${item.endDate}`}</p>
                  </div>
                </div>
                <div className="bg-stone-50 p-5 rounded-2xl flex items-start gap-4">
                  <span className="text-2xl mt-0.5">📍</span>
                  <div>
                    <p className="text-xs font-bold text-stone-400 mb-1">장소</p>
                    <p className="font-medium text-stone-800">{item.location}</p>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="bg-stone-50 p-5 rounded-2xl flex items-start gap-4">
                  <span className="text-2xl mt-0.5">🎯</span>
                  <div>
                    <p className="text-xs font-bold text-stone-400 mb-1">대상</p>
                    <p className="font-medium text-stone-800">{item.target}</p>
                  </div>
                </div>
                <div className="bg-stone-50 p-5 rounded-2xl flex items-start gap-4">
                  <span className="text-2xl mt-0.5">🏠</span>
                  <div>
                    <p className="text-xs font-bold text-stone-400 mb-1">신청처</p>
                    <p className="font-medium text-stone-800">{item.location}</p>
                  </div>
                </div>
              </>
            )}
          </div>

          <hr className="border-stone-100 mb-10" />

          {/* Details */}
          <section className="prose prose-stone max-w-none mb-12">
            <h3 className="text-xl font-bold mb-4 text-stone-800">상세 설명</h3>
            <p className="text-stone-600 leading-relaxed text-lg">
              {item.summary}
            </p>
            {/* TODO: 나중에 실제 API 데이터로 상세 내용 추가 */}
            <p className="text-stone-500 mt-6 p-6 bg-orange-50/50 rounded-2xl italic text-sm border-l-4 border-orange-200">
              ※ 현재는 요약 정보만 제공됩니다. 향후 API 연동 시 전체 상세 내용이 이곳에 표시됩니다.
            </p>
          </section>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center font-medium">
            <a 
              href={item.link} 
              target="_blank" 
              rel="noopener noreferrer"
              className={`w-full sm:w-auto px-8 py-4 ${themeColorBtn} text-white rounded-xl shadow-md transition-all duration-200 text-center flex items-center justify-center gap-2 transform hover:-translate-y-0.5`}
            >
              원본 사이트에서 자세히 보기 <span className="text-lg leading-none">↗</span>
            </a>
            <Link 
              href="/"
              className="w-full sm:w-auto px-8 py-4 bg-white text-stone-600 border border-stone-200 hover:bg-stone-50 hover:border-stone-300 rounded-xl transition-all duration-200 text-center"
            >
              목록으로 돌아가기
            </Link>
          </div>

        </article>
      </main>
      
      {/* Spacer for footer feeling */}
      <div className="h-16"></div>
    </div>
  );
}
