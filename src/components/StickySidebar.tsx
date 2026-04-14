'use client';

import { useEffect, useRef } from 'react';

type StickySidebarProps = {
  children: React.ReactNode;
  className?: string;
  topOffset?: number;
  footerSelector?: string;
};

export default function StickySidebar({
  children,
  className = '',
  topOffset = 96,
  footerSelector = '#site-footer',
}: StickySidebarProps) {
  const shellRef = useRef<HTMLElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const shell = shellRef.current;
    const content = contentRef.current;
    if (!shell || !content) return undefined;

    let frameId = 0;

    const applyStatic = () => {
      content.dataset.mode = 'static';
      content.style.position = 'static';
      content.style.top = 'auto';
      content.style.bottom = 'auto';
      content.style.width = '100%';
    };

    const applySticky = () => {
      if (content.dataset.mode === 'sticky') return;
      content.dataset.mode = 'sticky';
      content.style.position = 'sticky';
      content.style.top = `${topOffset}px`;
      content.style.bottom = 'auto';
      content.style.width = '100%';
    };

    const applyAbsolute = (absoluteTop: number) => {
      const nextTop = `${Math.max(0, absoluteTop)}px`;
      if (content.dataset.mode === 'absolute' && content.style.top === nextTop) return;
      content.dataset.mode = 'absolute';
      content.style.position = 'absolute';
      content.style.top = nextTop;
      content.style.bottom = 'auto';
      content.style.width = '100%';
    };

    const updatePosition = () => {
      frameId = 0;

      if (window.innerWidth < 1024) {
        applyStatic();
        return;
      }

      const footer = document.querySelector<HTMLElement>(footerSelector);
      if (!footer) {
        applySticky();
        return;
      }

      const shellRect = shell.getBoundingClientRect();
      const footerRect = footer.getBoundingClientRect();
      const shellTop = window.scrollY + shellRect.top;
      const footerTop = window.scrollY + footerRect.top;
      const contentHeight = content.offsetHeight;
      const footerGap = 24;
      const stickyBottom = window.scrollY + topOffset + contentHeight;
      const shouldDockToFooter = stickyBottom >= footerTop - footerGap;

      if (!shouldDockToFooter) {
        applySticky();
        return;
      }

      const absoluteTop = footerTop - shellTop - contentHeight - footerGap;
      applyAbsolute(absoluteTop);
    };

    const requestUpdate = () => {
      if (frameId) return;
      frameId = window.requestAnimationFrame(updatePosition);
    };

    updatePosition();
    window.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', requestUpdate);

    return () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      window.removeEventListener('scroll', requestUpdate);
      window.removeEventListener('resize', requestUpdate);
    };
  }, [footerSelector, topOffset]);

  return (
    <aside ref={shellRef} className={`sticky-sidebar-shell hidden lg:block w-60 flex-shrink-0 self-start ${className}`.trim()}>
      <div ref={contentRef} className="sticky-sidebar-content">
        {children}
      </div>
    </aside>
  );
}
