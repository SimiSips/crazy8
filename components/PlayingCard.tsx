'use client';
import type { Card } from '@/lib/types';

// ─── CuzCrazy8 card system ─────────────────────────────────────────────────────
// Every card is a tilted ivory oval with a chunky italic value and matching
// corner indices. Three host-selectable looks: solid / framed / glass.

export type CardLook = 'solid' | 'framed' | 'glass';

export const CARD_COLORS: Record<string, { bg: string; deep: string; name: string }> = {
  red: { bg: '#ec3013', deep: '#ae1800', name: 'RED' },
  blue: { bg: '#1f5fce', deep: '#123c86', name: 'BLUE' },
  green: { bg: '#1f8f4e', deep: '#155c33', name: 'GREEN' },
  yellow: { bg: '#f4b400', deep: '#7a5a00', name: 'YELLOW' },
  wild: { bg: '#201e1d', deep: '#000', name: 'WILD' },
};

// Legacy export kept for anything referencing plain colors
export const CARD_BG: Record<string, string> = {
  red: CARD_COLORS.red.bg,
  green: CARD_COLORS.green.bg,
  blue: CARD_COLORS.blue.bg,
  yellow: CARD_COLORS.yellow.bg,
};

function cardLabel(card: Card): string {
  switch (card.type) {
    case 'number': return String(card.value);
    case 'skip': return '⊘';
    case 'reverse': return '⇄';
    case 'draw2': return '+2';
    case 'draw4': return '+4';
    case 'wild8': return '8';
  }
}

// ─── Face-up card ──────────────────────────────────────────────────────────────
interface CardFaceProps {
  card: Card;
  w: number;
  h: number;
  look?: CardLook;
  style?: React.CSSProperties;
}

export function CardFace({ card, w, h, look = 'solid', style }: CardFaceProps) {
  const isWild = card.type === 'wild8' || card.type === 'draw4';
  const colorKey = isWild ? 'wild' : (card.color ?? 'red');
  const col = CARD_COLORS[colorKey];
  const label = cardLabel(card);

  const numSize = Math.round(w * 0.6);
  const cornerSize = Math.round(
    Math.max(11, Math.round(w * 0.21)) * (label.length > 1 ? 0.78 : 1),
  );
  const rad = Math.round(Math.min(w, h) * 0.11);
  const pad = Math.round(cornerSize * 0.42);

  let surface: React.CSSProperties;
  let ovalBg: string;
  let numColor: string;
  let cornerColor: string;
  if (look === 'framed' && !isWild) {
    surface = {
      background: '#f8f4f4',
      boxShadow: `inset 0 0 0 ${Math.max(4, Math.round(w * 0.055))}px ${col.bg}, var(--shadow-sm)`,
    };
    ovalBg = col.bg;
    numColor = '#f8f4f4';
    cornerColor = col.deep;
  } else if (look === 'glass' && !isWild) {
    surface = {
      background: `linear-gradient(150deg, rgba(255,255,255,.34) 0%, rgba(255,255,255,.06) 46%, rgba(255,255,255,.14) 100%), color-mix(in srgb, ${col.bg} 32%, transparent)`,
      backdropFilter: 'blur(12px) saturate(1.5)',
      WebkitBackdropFilter: 'blur(12px) saturate(1.5)',
      boxShadow: `inset 0 0 0 1.5px rgba(255,255,255,.5), inset 0 -14px 26px color-mix(in srgb, ${col.bg} 34%, transparent), 0 8px 24px rgba(0,0,0,.4)`,
    };
    ovalBg = 'rgba(255,255,255,.2)';
    numColor = '#fff';
    cornerColor = '#fff';
  } else {
    surface = {
      background: col.bg,
      boxShadow: 'inset 0 0 0 2px color-mix(in srgb, #f8f4f4 22%, transparent), var(--shadow-sm)',
    };
    ovalBg = '#f8f4f4';
    numColor = col.bg;
    cornerColor = '#f8f4f4';
  }

  const o = Math.max(2, Math.round(numSize * 0.06));
  const numShadow =
    look === 'glass' && !isWild
      ? `0 0 16px color-mix(in srgb, ${col.bg} 85%, transparent), 0 2px 6px rgba(0,0,0,.35)`
      : `${o}px ${o}px 0 ${col.deep}`;

  const cornerStyle: React.CSSProperties = {
    position: 'absolute',
    zIndex: 3,
    fontStyle: 'italic',
    fontWeight: 800,
    fontSize: cornerSize,
    lineHeight: 1,
    color: cornerColor,
    textShadow: '0 1px 2px rgba(32,30,29,.28)',
  };

  return (
    <div
      style={{
        position: 'relative',
        width: w,
        height: h,
        flex: '0 0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: rad,
        overflow: 'hidden',
        fontFamily: 'var(--font-heading)',
        fontWeight: 800,
        ...surface,
        ...style,
      }}
    >
      {/* Tilted ivory oval */}
      <span
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%,-50%) rotate(26deg)',
          width: w * 0.6,
          height: h * 0.84,
          background: ovalBg,
          borderRadius: '50%',
          zIndex: 1,
        }}
      />
      {/* Corner indices */}
      <span style={{ ...cornerStyle, top: pad, left: pad + 2 }}>{label}</span>
      {/* Center */}
      {isWild ? (
        <span
          style={{
            position: 'relative',
            zIndex: 2,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: Math.max(2, Math.round(w * 0.05)),
            width: '44%',
            height: '44%',
            transform: 'rotate(6deg)',
          }}
        >
          <span style={{ background: '#ec3013', borderRadius: 3 }} />
          <span style={{ background: '#1f5fce', borderRadius: 3 }} />
          <span style={{ background: '#f4b400', borderRadius: 3 }} />
          <span style={{ background: '#1f8f4e', borderRadius: 3 }} />
        </span>
      ) : (
        <span
          style={{
            position: 'relative',
            zIndex: 2,
            fontStyle: 'italic',
            fontWeight: 800,
            fontSize: numSize,
            lineHeight: 1,
            color: numColor,
            textShadow: numShadow,
          }}
        >
          {label}
        </span>
      )}
      <span style={{ ...cornerStyle, bottom: pad, right: pad + 2, transform: 'rotate(180deg)' }}>
        {label}
      </span>
    </div>
  );
}

// ─── Face-down card (black back with C8 mark) ─────────────────────────
export function CardBack({ w = 46, h = 66, style }: { w?: number; h?: number; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        width: w,
        height: h,
        flex: '0 0 auto',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: Math.round(w * 0.13),
        border: '2px solid #2b2b2b',
        background: '#141110',
        backgroundImage: 'repeating-linear-gradient(45deg,#161616 0px,#161616 5px,#242424 5px,#242424 10px)',
        boxShadow: '0 3px 8px rgba(0,0,0,.4)',
        overflow: 'hidden',
        ...style,
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-heading)',
          fontWeight: 800,
          fontStyle: 'italic',
          fontSize: Math.round(w * 0.34),
          lineHeight: 1,
          color: 'rgba(248,244,244,.82)',
          transform: 'rotate(-14deg)',
          textShadow: '2px 2px 0 rgba(236,48,19,.55)',
        }}
      >
        C8
      </span>
    </div>
  );
}

// ─── Overlapping stack of card backs  ─────────────────────────
interface CardFanProps {
  count: number;
  direction?: 'horizontal' | 'vertical';
  maxShow?: number;
  w?: number;
  h?: number;
}

export function CardFan({ count, direction = 'horizontal', maxShow = 7, w = 44, h = 64 }: CardFanProps) {
  const show = Math.max(1, Math.min(count, maxShow));
  const overlap = direction === 'horizontal' ? Math.round(w * 0.62) : Math.round(h * 0.66);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: direction === 'horizontal' ? 'row' : 'column',
        alignItems: 'flex-start',
      }}
    >
      {Array.from({ length: show }).map((_, i) => (
        <CardBack
          key={i}
          w={w}
          h={h}
          style={{
            marginLeft: direction === 'horizontal' && i > 0 ? -overlap : 0,
            marginTop: direction === 'vertical' && i > 0 ? -overlap : 0,
            zIndex: i,
          }}
        />
      ))}
    </div>
  );
}

// ─── Draw deck (stacked shadow look) ──────────────────────────────────────────
export function DrawDeck({
  w = 104,
  h = 150,
  onClick,
  disabled,
  badge,
}: {
  w?: number;
  h?: number;
  onClick?: () => void;
  disabled?: boolean;
  badge?: number;
}) {
  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={disabled ? undefined : onClick}
        style={{
          width: w,
          height: h,
          cursor: disabled ? 'default' : 'pointer',
          border: '2px solid #2b2b2b',
          padding: 0,
          borderRadius: Math.round(w * 0.135),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#141110',
          backgroundImage: 'repeating-linear-gradient(45deg,#161616 0px,#161616 5px,#242424 5px,#242424 10px)',
          boxShadow: '3px 3px 0 #0c0c0c, 6px 6px 0 #1c1c1c, 9px 9px 0 #282828, 0 10px 22px rgba(0,0,0,.5)',
          transition: 'transform .18s cubic-bezier(.34,1.56,.64,1)',
        }}
        onMouseEnter={e => {
          if (!disabled) e.currentTarget.style.transform = 'translateY(-6px) rotate(-3deg)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = '';
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-heading)',
            fontWeight: 800,
            fontStyle: 'italic',
            fontSize: Math.round(w * 0.29),
            letterSpacing: '-0.02em',
            transform: 'rotate(-90deg)',
            color: 'color-mix(in srgb,#f8f4f4 85%,transparent)',
          }}
        >
          C8
        </span>
      </button>
      {badge !== undefined && (
        <span
          style={{
            position: 'absolute',
            top: -7,
            right: -7,
            background: '#f4b400',
            color: '#141110',
            fontSize: 10,
            fontWeight: 800,
            fontFamily: 'var(--font-heading)',
            padding: '2px 7px',
            borderRadius: 10,
          }}
        >
          {badge}
        </span>
      )}
    </div>
  );
}
