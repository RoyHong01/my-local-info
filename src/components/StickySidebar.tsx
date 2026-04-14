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
    <aside className={`sticky-sidebar-shell hidden lg:block w-60 flex-shrink-0 self-start ${className}`.trim()}>
      <div className="sticky-sidebar-content">
        {children}
      </div>
    </aside>
  );
}
