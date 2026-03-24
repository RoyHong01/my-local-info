import fs from 'fs/promises';
import path from 'path';
import Link from 'next/link';

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

export default async function Home() {
  const filePath = path.join(process.cwd(), 'public/data/local-info.json');
  const fileContents = await fs.readFile(filePath, 'utf8');
  const items: InfoItem[] = JSON.parse(fileContents);

  const events = items.filter(item => item.category === '행사');
  const benefits = items.filter(item => item.category === '혜택');
  const today = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric'
  });

  return (
    <div className="min-h-screen bg-orange-50/50 font-sans text-stone-800">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-orange-600">성남시 생활 정보</Link>
          <nav>
            <ul className="flex space-x-4 md:space-x-6 text-sm font-medium text-stone-600">
              <li><Link href="#events" className="hover:text-orange-600 transition">행사/축제</Link></li>
              <li><Link href="#benefits" className="hover:text-orange-600 transition">지원금/혜택</Link></li>
              <li><Link href="/blog" className="hover:text-orange-600 transition">블로그</Link></li>
            </ul>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 py-8 space-y-16">
        {/* Intro */}
        <section className="text-center py-8">
          <h2 className="text-3xl md:text-5xl font-extrabold text-stone-900 mb-6 drop-shadow-sm">
            우리 동네 소식을 <span className="text-orange-500">한눈에</span>
          </h2>
          <p className="text-stone-500 max-w-2xl mx-auto text-sm md:text-base leading-relaxed">
            성남시의 최신 행사, 축제 정보와 놓치기 쉬운 지원금 혜택을 모아 보여드립니다. <br className="hidden md:block" />
            매일 오전 새롭게 업데이트되는 지역 정보를 확인해보세요.
          </p>
        </section>

        {/* Events Section */}
        <section id="events" className="scroll-mt-24">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-2xl font-extrabold flex items-center gap-3">
              <span className="text-3xl">🎉</span> 이번 달 행사/축제
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((item) => (
              <Link href="/blog" key={item.id} className="group flex flex-col h-full">
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-stone-100 hover:shadow-lg hover:border-rose-200 transition-all duration-300 flex flex-col h-full transform hover:-translate-y-1">
                  <div className="flex justify-between items-start mb-4">
                    <span className="inline-block px-3 py-1 bg-rose-50 text-rose-600 text-xs font-bold rounded-full">
                      {item.category}
                    </span>
                  </div>
                  <h4 className="text-xl font-bold mb-3 group-hover:text-rose-500 transition-colors line-clamp-2">
                    {item.name}
                  </h4>
                  <p className="text-stone-500 text-sm mb-6 line-clamp-2 flex-grow">
                    {item.summary}
                  </p>
                  <div className="space-y-2 text-sm text-stone-600 mt-auto bg-stone-50 p-4 rounded-2xl">
                    <div className="flex items-center gap-3">
                      <span className="text-orange-400 text-base">📅</span>
                      <span className="font-medium text-stone-700">{item.startDate}{item.endDate ? ` ~ ${item.endDate}` : ''}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-orange-400 text-base">📍</span>
                      <span className="truncate">{item.location}</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Benefits Section */}
        <section id="benefits" className="scroll-mt-24">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-2xl font-extrabold flex items-center gap-3">
              <span className="text-3xl">🎁</span> 지원금/혜택
            </h3>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {benefits.map((item) => (
              <Link href="/blog" key={item.id} className="group flex flex-col h-full">
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-stone-100 hover:shadow-lg hover:border-amber-200 transition-all duration-300 flex flex-col h-full transform hover:-translate-y-1">
                  <div className="flex justify-between items-start mb-4">
                    <span className="inline-block px-3 py-1 bg-amber-50 text-amber-600 text-xs font-bold rounded-full">
                      {item.category}
                    </span>
                  </div>
                  <h4 className="text-xl font-bold mb-3 group-hover:text-amber-600 transition-colors">
                    {item.name}
                  </h4>
                  <p className="text-stone-500 text-sm mb-6 flex-grow">
                    {item.summary}
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 text-sm text-stone-600 mt-auto bg-stone-50 p-4 rounded-2xl">
                    <div className="flex-1 flex items-center gap-2">
                      <span className="text-orange-400">🎯</span>
                      <span className="font-medium text-stone-700">대상:</span> 
                      <span className="truncate">{item.target}</span>
                    </div>
                    <div className="flex-1 flex items-center gap-2">
                      <span className="text-orange-400">🏠</span>
                      <span className="font-medium text-stone-700">신청처:</span> 
                      <span className="truncate">{item.location}</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-stone-900 text-stone-400 py-12 mt-16 text-sm">
        <div className="max-w-5xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-center md:text-left">
            <p className="font-bold text-lg text-white mb-2">성남시 생활 정보</p>
            <p className="text-stone-500">© {new Date().getFullYear()} My Local Info. All rights reserved.</p>
          </div>
          <div className="text-center md:text-right text-stone-500 space-y-1">
            <p>데이터 출처: 공공데이터포털 (data.go.kr)</p>
            <p>마지막 업데이트: {today}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
