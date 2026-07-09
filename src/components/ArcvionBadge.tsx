import { useLocation } from 'react-router-dom';

/**
 * Small, non-intrusive site-wide credit. Fixed bottom-centre so it never
 * collides with the sidebar or the AI Companion (bottom-right). Hidden during
 * an exam so it does not distract test-takers.
 */
export default function ArcvionBadge() {
  const { pathname } = useLocation();
  if (pathname.startsWith('/student/exam') || pathname === '/built-by-arcvion') return null;

  return (
    <a
      href="https://arcvion.in"
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-2 left-1/2 -translate-x-1/2 z-[45] flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-medium transition-opacity hover:!opacity-100"
      style={{
        backgroundColor: 'rgba(17,24,39,0.55)',
        color: '#E5E7EB',
        backdropFilter: 'blur(6px)',
        border: '1px solid rgba(255,255,255,0.10)',
        opacity: 0.65,
      }}
      title="Built by Arcvion — visit arcvion.in"
    >
      Built with <span style={{ color: '#F43F5E' }}>❤</span> by
      <span style={{ fontWeight: 700, color: '#fff' }}>Arcvion</span>
    </a>
  );
}
