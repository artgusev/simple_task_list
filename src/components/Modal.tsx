import { useEffect, useRef, type ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  className?: string;
  'aria-labelledby'?: string;
  'aria-label'?: string;
  children: ReactNode;
}

/**
 * Native <dialog> wrapper: focus trapping, Escape and backdrop click come from the platform.
 * Children render only while open, so forms inside reset each time.
 */
export function Modal({ open, onClose, className, children, ...aria }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
      // The dialog focuses itself on open; hand focus to the field marked for it, if any.
      el.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    } else if (!open && el.open) {
      el.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={className ? `modal ${className}` : 'modal'}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      {...aria}
    >
      {open ? children : null}
    </dialog>
  );
}
