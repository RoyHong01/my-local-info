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

/* ── Category card components ── */

function IncheonCard({ item }: { item: DataItem }) {
  const name = getField(item, ['서비스명', 'name', 'title']);
  const summary = getField(item, ['서비스목적요약', 'summary', 'description']);
  const org = getField(item, ['소관기관명', 'location', 'addr1']);
  const id = getField(item, ['서비스ID', 'id']);
  return (
    <Link href={`/incheon/${encodeURIComponent(id)}`} className="block group">
      <div className="bg-white rounded-xl p-4 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 border border-gray-100">
        <div className="flex items-start justify-between mb-2">
          <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-600">인천</span>
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-300 group-hover:text-gray-500 transition-colors"><path d="M7 7h10v10"/><path d="M7 17 17 7"/></svg>
        </div>
        <h4 className="text-sm font-bold text-gray-900 mb-1.5 group-hover:text-orange-600 transition-colors line-clamp-2">{name}</h4>
        <p className="text-xs text-gray-500 leading-relaxed mb-2 line-clamp-2">{summary}</p>
        {org && (
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <span>🏛</span><span>{org}</span>
          </div>
        )}
      </div>
    </Link>
  );
}

function SubsidyCard({ item }: { item: DataItem }) {
  const name = getField(item, ['서비스명', 'name', 'title']);
  const summary = getField(item, ['서비스목적요약', 'summary', 'description']);
  const target = getField(item, ['지원대상', 'target']);
  const id = getField(item, ['서비스ID', 'id']);
  return (
    <Link href={`/subsidy/${encodeURIComponent(id)}`} className="block group">
      <div className="bg-white rounded-xl p-4 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 border border-gray-100">
        <div className="flex items-start justify-between mb-2">
          <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-50 text-orange-600">보조금</span>
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-300 group-hover:text-gray-500 transition-colors"><path d="M7 7h10v10"/><path d="M7 17 17 7"/></svg>
        </div>
        <h4 className="text-sm font-bold text-gray-900 mb-1.5 group-hover:text-orange-600 transition-colors line-clamp-2">{name}</h4>
        <p className="text-xs text-gray-500 leading-relaxed mb-2 line-clamp-2">{summary}</p>
        {target && (
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <span>🎯</span><span>{target}</span>
          </div>
        )}
      </div>
    </Link>
  );
}

function FestivalCard({ item }: { item: DataItem }) {
  const name = getField(item, ['title', 'name', '서비스명']);
  const summary = getField(item, ['summary', 'overview', 'description', '서비스목적요약']);
  const location = getField(item, ['addr1', 'location', '소관기관명']);
  const id = getField(item, ['contentid', 'id']);
  return (
    <Link href={`/festival/${encodeURIComponent(id)}`} className="block group">
      <div className="bg-white rounded-xl p-4 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 border border-gray-100">
        <div className="flex items-start justify-between mb-2">
          <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-600">축제·여행</span>
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-300 group-hover:text-gray-500 transition-colors"><path d="M7 7h10v10"/><path d="M7 17 17 7"/></svg>
        </div>
        <h4 className="text-sm font-bold text-gray-900 mb-1.5 group-hover:text-orange-600 transition-colors line-clamp-2">{name}</h4>
        <p className="text-xs text-gray-500 leading-relaxed mb-2 line-clamp-2">{summary}</p>
        {location && (
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <span>📍</span><span>{location}</span>
          </div>
        )}
      </div>
    </Link>
  );
}

/* ── Main Page ── */

export default async function Home() {
  const [incheonAll, subsidyAll, festivalAll] = await Promise.all([
    readJson('incheon.json'),
    readJson('subsidy.json'),
    readJson('festival.json'),
  ]);

  const incheon = incheonAll.filter(i => !i.expired).slice(0, 3);
  const subsidy = subsidyAll.filter(i => !i.expired).slice(0, 3);
  const festival = festivalAll.filter(i => !i.expired).slice(0, 3);

  const categories = [
    {
      id: 'incheon',
      emoji: '🏙️',
      title: '인천 지역 정보',
      description: '인천시 생활정보, 행사, 지역 소식을 한눈에',
      gradient: 'from-blue-500 to-cyan-500',
      items: incheon,
      CardComponent: IncheonCard,
      href: '/incheon',
      linkColor: 'text-blue-600 hover:text-blue-700',
    },
    {
      id: 'subsidy',
      emoji: '💰',
      title: '전국 보조금·복지',
      description: '놓치기 쉬운 보조금과 복지 혜택을 모아서',
      gradient: 'from-orange-500 to-amber-500',
      items: subsidy,
      CardComponent: SubsidyCard,
      href: '/subsidy',
      linkColor: 'text-orange-600 hover:text-orange-700',
    },
    {
      id: 'festival',
      emoji: '🎪',
      title: '전국 축제·여행',
      description: '전국 곳곳의 축제와 여행 정보를 놓치지 마세요',
      gradient: 'from-purple-500 to-pink-500',
      items: festival,
      CardComponent: FestivalCard,
      href: '/festival',
      linkColor: 'text-purple-600 hover:text-purple-700',
    },
  ];

  return (
    <div className="min-h-screen bg-[#FAFAFA] font-sans text-stone-800">
      {/* ── Hero Section ── */}
      <section className="relative min-h-[85vh] flex items-center justify-center overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-orange-500 via-orange-600 to-purple-700" />

        {/* Animated background shapes */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-white/5 animate-pulse" />
          <div className="absolute -bottom-20 -left-20 w-[400px] h-[400px] rounded-full bg-white/5 animate-[pulse_3s_ease-in-out_infinite_1s]" />
          <div className="absolute top-1/3 left-1/4 w-[300px] h-[300px] rounded-full bg-purple-400/10 animate-[pulse_3s_ease-in-out_infinite_0.5s]" />
        </div>

        {/* Dot pattern overlay */}
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] bg-[length:40px_40px]" />

        {/* Navigation */}
        <header className="absolute top-0 left-0 right-0 z-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16 md:h-20">
              <Link href="/" className="flex items-center gap-2">
                <span className="text-2xl font-extrabold text-white drop-shadow-md">픽앤조이</span>
                <span className="text-2xl">🎯</span>
              </Link>
              <nav className="hidden lg:flex items-center gap-1">
                {[
                  { label: '인천시 정보', href: '/incheon' },
                  { label: '전국 보조금·복지 정책', href: '/subsidy' },
                  { label: '전국 축제·여행 정보', href: '/festival' },
                  { label: '블로그', href: '/blog' },
                  { label: '일상의 즐거움', href: '/life' },
                  { label: '소개', href: '/about' },
                ].map(link => (
                  <Link
                    key={link.label}
                    href={link.href}
                    className="px-3 py-2 text-sm font-medium rounded-lg text-white/90 hover:text-white hover:bg-white/10 transition-all duration-200"
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
            </div>
          </div>
        </header>

        {/* Hero Content */}
        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center pt-12 pb-24">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/15 backdrop-blur-sm border border-white/20 text-white text-sm font-medium mb-12 animate-fade-in">
            ✨ 매일 업데이트되는 생활정보 플랫폼
          </div>

          {/* Title */}
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white leading-snug tracking-tight mb-5 animate-fade-in-up">
            당신의 일상을{' '}
            <span className="relative inline-block">
              <span className="relative z-10">Pick</span>
              <span className="absolute bottom-0.5 left-0 right-0 h-2.5 bg-yellow-400/40 rounded-sm -z-0" />
            </span>
            , 당신의 주말을{' '}
            <span className="relative inline-block">
              <span className="relative z-10">Enjoy!</span>
              <span className="absolute bottom-0.5 left-0 right-0 h-2.5 bg-yellow-400/40 rounded-sm -z-0" />
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-sm sm:text-base md:text-lg text-white/80 font-medium mb-14 animate-fade-in-up">
            몰라서 못 받은 돈, 놓친 축제, 실망한 맛집— 이제 픽앤조이가 대신 찾아드립니다
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up">
            <Link
              href="/subsidy"
              className="group flex items-center gap-3 px-8 py-4 bg-white text-orange-600 font-bold text-lg rounded-2xl shadow-xl shadow-black/10 hover:shadow-2xl hover:shadow-black/20 hover:-translate-y-0.5 transition-all duration-300"
            >
              👉 내가 받을 수 있는 보조금 보러가기
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:translate-x-1 transition-transform"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
            </Link>
            <Link
              href="/festival"
              className="group flex items-center gap-3 px-8 py-4 bg-white/15 backdrop-blur-sm text-white font-bold text-lg rounded-2xl border border-white/30 hover:bg-white/25 hover:-translate-y-0.5 transition-all duration-300"
            >
              🎉 이번 주말 근처 축제 확인하기
            </Link>
          </div>

          {/* Stats */}
          <div className="mt-14 grid grid-cols-3 gap-8 max-w-md mx-auto animate-fade-in-up">
            <div className="text-center">
              <div className="text-3xl sm:text-4xl font-extrabold text-white">{subsidyAll.filter(i => !i.expired).length}+</div>
              <div className="text-sm text-white/60 mt-1">보조금 정보</div>
            </div>
            <div className="text-center">
              <div className="text-3xl sm:text-4xl font-extrabold text-white">{festivalAll.filter(i => !i.expired).length}+</div>
              <div className="text-sm text-white/60 mt-1">축제·행사</div>
            </div>
            <div className="text-center">
              <div className="text-3xl sm:text-4xl font-extrabold text-white">매일</div>
              <div className="text-sm text-white/60 mt-1">업데이트</div>
            </div>
          </div>
        </div>

        {/* Bottom wave */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
            <path d="M0 120L60 110C120 100 240 80 360 70C480 60 600 60 720 65C840 70 960 80 1080 85C1200 90 1320 90 1380 90L1440 90V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0Z" fill="#FAFAFA"/>
          </svg>
        </div>
      </section>

      {/* ── Category Cards Section ── */}
      <section className="py-20 bg-[#FAFAFA]" id="categories">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-12">
          <div className="text-center">
            <span className="inline-block px-6 py-2.5 rounded-full bg-orange-100 text-orange-600 text-base font-bold mb-4 tracking-wide shadow-sm">
              📋 카테고리별 정보
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-3">
              필요한 정보를 <span className="bg-gradient-to-r from-orange-500 to-purple-600 bg-clip-text text-transparent">한눈에</span>
            </h2>
            <p className="text-base text-gray-500 max-w-xl mx-auto">
              인천 지역 소식부터 전국 보조금, 축제 정보까지 카테고리별로 정리했습니다
            </p>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {categories.map(cat => (
              <div key={cat.id} id={cat.id} className="space-y-4 scroll-mt-24">
                {/* Category Header */}
                <div className={`relative overflow-hidden rounded-2xl shadow-md group`}>
                  <div className={`absolute inset-0 bg-gradient-to-br ${cat.gradient}`} />
                  <div className="relative p-5">
                    <div className="text-2xl mb-1">{cat.emoji}</div>
                    <h3 className="text-xl font-extrabold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)] tracking-wide">{cat.title}</h3>
                    <p className="text-sm font-semibold text-white/95 drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]">{cat.description}</p>
                  </div>
                </div>

                {/* Item Cards */}
                {cat.items.length === 0 ? (
                  <p className="text-gray-400 text-sm py-8 text-center">곧 업데이트될 예정입니다.</p>
                ) : (
                  cat.items.map((item, idx) => <cat.CardComponent key={idx} item={item} />)
                )}

                {/* View More */}
                <Link
                  href={cat.href}
                  className="flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-gray-200 text-sm font-medium text-gray-400 hover:border-orange-300 hover:text-orange-500 transition-colors"
                >
                  더보기
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 7h10v10"/><path d="M7 17 17 7"/></svg>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features Section ── */}
      <section className="py-14 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900">
              왜{' '}
              <span className="bg-gradient-to-r from-orange-500 to-purple-600 bg-clip-text text-transparent">
                픽앤조이
              </span>
              인가요?
            </h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { icon: '🔍', title: '매일 직접 수집', desc: '공공기관 사이트에서 최신 정보를 매일 수집' },
              { icon: '🔔', title: '놓치지 않는 알림', desc: '새로운 보조금·축제 정보를 바로 확인' },
              { icon: '🛡️', title: '검증된 정보', desc: '공식 출처만 사용한 신뢰할 수 있는 정보' },
              { icon: '⚡', title: '빠른 업데이트', desc: '실시간 정책·행사 변경사항 즉시 반영' },
              { icon: '⏰', title: '시간 절약', desc: '여러 사이트 대신 한 곳에서 모두 확인' },
              { icon: '❤️', title: '맞춤 추천', desc: '나이·지역·상황에 맞는 맞춤형 정보' },
            ].map((f, idx) => (
              <div key={idx} className="text-center p-4 rounded-xl bg-gray-50 hover:bg-orange-50 transition-colors duration-300">
                <div className="w-10 h-10 rounded-lg bg-white shadow-sm flex items-center justify-center text-lg mx-auto mb-3">
                  {f.icon}
                </div>
                <h3 className="text-sm font-bold text-gray-900 mb-1">{f.title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-lg font-extrabold bg-gradient-to-r from-orange-400 to-purple-400 bg-clip-text text-transparent">
                픽앤조이
              </span>
              <span className="text-lg">🎯</span>
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-400">
              <span>데이터 출처: 공공데이터포털 · 한국관광공사</span>
              <span className="text-gray-700">|</span>
              <Link href="/about" className="hover:text-orange-400 transition-colors">소개</Link>
            </div>
            <div className="text-center text-sm text-gray-500 space-y-1">
              <p>© 2026 픽앤조이. All rights reserved.</p>
              <p className="text-xs text-gray-600">이 사이트는 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
