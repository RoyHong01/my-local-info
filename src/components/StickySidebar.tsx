'use client';

type StickySidebarProps = {
  children: React.ReactNode;
  className?: string;
};

export default function StickySidebar({
  children,
  className = '',
}: StickySidebarProps) {
  return (
    <aside className={`sticky-sidebar hidden lg:block w-60 flex-shrink-0 ${className}`.trim()}>
      {children}
    </aside>
  );
}
