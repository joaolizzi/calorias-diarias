import { useEffect, useId, useRef } from 'react';
import Icon from './Icon.jsx';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Diálogo acessível: role="dialog", Esc fecha, Tab fica preso dentro, o foco volta
// para quem abriu e a rolagem da página fica travada enquanto aberto.
export default function Modal({ title, onClose, className = '', children, closeLabel = 'Fechar' }) {
  const ref = useRef(null);
  const titleId = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const previous = document.activeElement;
    const node = ref.current;
    const first = node?.querySelector('input:not([type=hidden]), select, textarea') || node?.querySelector(FOCUSABLE);
    (first || node)?.focus({ preventScroll: true });
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKey = (event) => {
      if (event.key === 'Escape') { event.stopPropagation(); closeRef.current?.(); return; }
      if (event.key !== 'Tab' || !node) return;
      const items = [...node.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (!items.length) { event.preventDefault(); return; }
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      if (event.shiftKey && document.activeElement === firstItem) { event.preventDefault(); lastItem.focus(); }
      else if (!event.shiftKey && document.activeElement === lastItem) { event.preventDefault(); firstItem.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      if (previous && typeof previous.focus === 'function' && document.contains(previous)) previous.focus({ preventScroll: true });
    };
  }, []);

  return (
    <div className="modal-bg" onClick={onClose}>
      <div
        ref={ref}
        className={`modal ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          {title ? <h3 id={titleId}>{title}</h3> : <span />}
          <button type="button" className="icon-btn modal-close" onClick={onClose} aria-label={closeLabel}>
            <Icon name="close" size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
