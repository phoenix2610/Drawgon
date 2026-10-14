
const LOGO_SRC = '/drawgon-logo.svg';

interface DrawgonMarkProps {
  
  size?: number;
  className?: string;
  
  animated?: boolean;
}

export function DrawgonMark({ size = 32, className, animated = false }: DrawgonMarkProps) {
  return (
    <img
      src={LOGO_SRC}
      alt="Drawgon"
      width={size}
      height={size}
      className={[
        'shrink-0 select-none object-contain',
        animated ? 'drawgon-pulse' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    />
  );
}
