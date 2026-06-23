import { useEffect } from 'react';

interface LightboxProps {
  url: string;
  onClose: () => void;
}

export function Lightbox({ url, onClose }: LightboxProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="lightbox" onClick={onClose}>
      <img className="lightbox__img" src={url} alt="" onClick={(e) => e.stopPropagation()} />
    </div>
  );
}
