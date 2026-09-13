import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  // Rendered below the scrolling body, so action buttons stay put however
  // tall the content gets (a long bill, a big order).
  footer?: React.ReactNode;
  // By default the whole body scrolls. Pass false when the content manages
  // its own scrolling (e.g. only a list in the middle should scroll while
  // things above it stay pinned) — the body then becomes a flex column that
  // simply fills the space.
  scrollBody?: boolean;
  // Drop the X in the title bar — for dialogs whose footer already carries
  // a Close button, so there's one obvious way out instead of two.
  hideCloseButton?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = 'md',
  footer,
  scrollBody = true,
  hideCloseButton = false,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxWidthClass = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
  }[maxWidth];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* The panel is capped at the viewport height and only its body
          scrolls — the title bar and footer stay pinned. */}
      <div
        className={`relative w-full ${maxWidthClass} max-h-[calc(100dvh-2rem)] sm:max-h-[calc(100dvh-3rem)] flex flex-col bg-white rounded-2xl shadow-2xl border border-stone-100 overflow-hidden z-10 my-auto`}
        role="dialog"
      >
        {title && (
          <div className="shrink-0 flex items-center justify-between gap-3 px-4 sm:px-6 py-3 sm:py-4 border-b border-stone-100 bg-stone-50/70">
            <h3 className="text-base sm:text-lg font-bold text-stone-900 min-w-0">{title}</h3>
            {!hideCloseButton && (
              <button
                onClick={onClose}
                className="shrink-0 p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 rounded-full transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        )}
        <div
          className={`p-6 flex-1 min-h-0 ${
            scrollBody ? 'overflow-y-auto no-scrollbar' : 'flex flex-col overflow-hidden'
          }`}
        >
          {children}
        </div>
        {footer && (
          <div className="shrink-0 px-6 py-4 border-t border-stone-100 bg-white">{footer}</div>
        )}
      </div>
    </div>
  );
};
