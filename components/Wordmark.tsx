// CUZCRAZY8 wordmark — Archivo 800
export function Wordmark({ size = 20, style }: { size?: number; style?: React.CSSProperties }) {
  return (
    <span
      style={{
        fontFamily: 'var(--font-heading)',
        fontWeight: 800,
        fontSize: size,
        letterSpacing: '.01em',
        color: 'var(--color-text)',
        ...style,
      }}
    >
      CUZCRAZY<span style={{ color: 'var(--color-accent)' }}>8</span>
    </span>
  );
}

// Giant decorative "8" watermark at the bottom-right
export function Watermark8({
  size = 520,
  opacity = 0.07,
  right = -40,
  bottom = -120,
}: {
  size?: number;
  opacity?: number;
  right?: number;
  bottom?: number;
}) {
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        right,
        bottom,
        fontFamily: 'var(--font-heading)',
        fontWeight: 800,
        fontSize: size,
        lineHeight: 0.8,
        letterSpacing: '-.04em',
        color: `color-mix(in srgb,#ec3013 ${Math.round(opacity * 100)}%,transparent)`,
        pointerEvents: 'none',
        userSelect: 'none',
      }}
    >
      8
    </div>
  );
}
