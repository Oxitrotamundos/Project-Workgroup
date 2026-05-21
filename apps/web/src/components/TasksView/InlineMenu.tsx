import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useClickOutside } from '../../hooks/useClickOutside';

interface Option<T extends string> {
  value: T;
  label: string;
  glyph?: ReactNode;
}

interface Props<T extends string> {
  label: string;
  current: T;
  options: Option<T>[];
  onSelect: (value: T) => void;
  onClose: () => void;
}

export default function InlineMenu<T extends string>({ label, current, options, onSelect, onClose }: Props<T>) {
  const ref = useClickOutside<HTMLDivElement>(onClose);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div ref={ref} className="tv-popover" role="menu" aria-label={label}>
      <div className="tv-pop-label">{label}</div>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="menuitemradio"
          aria-checked={opt.value === current}
          data-current={opt.value === current}
          className="tv-pop-option"
          onClick={() => {
            if (opt.value !== current) onSelect(opt.value);
            onClose();
          }}
        >
          {opt.glyph !== undefined && <span aria-hidden="true">{opt.glyph}</span>}
          <span>{opt.label}</span>
        </button>
      ))}
    </div>
  );
}
