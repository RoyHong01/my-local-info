'use client';

export default function CoupangBanner() {
  const partnerId = process.env.NEXT_PUBLIC_COUPANG_PARTNER_ID;

  if (!partnerId || partnerId === '나중에_입력') {
    return null;
  }

  return (
    <div className="my-8 flex justify-center">
      <iframe
        src={`https://ads-partners.coupang.com/widgets.html?id=${partnerId}&template=carousel&trackingCode=AF0000000&subId=&width=680&height=140`}
        width="680"
        height="140"
        frameBorder="0"
        scrolling="no"
        referrerPolicy="unsafe-url"
        className="max-w-full"
      />
      <p className="text-xs text-stone-400 text-center mt-2">
        이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.
      </p>
    </div>
  );
}
