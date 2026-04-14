'use client';

import { useEffect, useRef } from 'react';

type StickySidebarProps = {
  children: React.ReactNode;
  className?: string;
};

export default function StickySidebar({
  children,
  className = '',
}: StickySidebarProps) {
  const shellRef = useRef<HTMLElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const shell = shellRef.current;
    const content = contentRef.current;
    if (!shell || !content) return undefined;

    const syncHeight = () => {
      if (window.innerWidth < 1024) {
        shell.style.minHeight = 'auto';
        return;
      }
      const parent = shell.parentElement;
      if (!parent) return;

      const parentHeight = parent.getBoundingClientRect().height;
      const contentHeight = content.getBoundingClientRect().height;
      shell.style.minHeight = `${Math.ceil(Math.max(parentHeight, contentHeight))}px`;
    };

    syncHeight();

    const observer = new ResizeObserver(syncHeight);
    observer.observe(document.body);
    observer.observe(content);

    window.addEventListener('resize', syncHeight);
    window.addEventListener('load', syncHeight);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', syncHeight);
      window.removeEventListener('load', syncHeight);
    };
  }, []);

  return (
    <aside ref={shellRef} className={`sticky-sidebar-shell hidden lg:block w-60 flex-shrink-0 self-stretch ${className}`.trim()}>
      <div ref={contentRef} className="sticky-sidebar-content">
        {children}
      </div>
    </aside>
  );
}
