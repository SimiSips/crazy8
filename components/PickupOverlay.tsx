'use client';
import { CardBack } from './PlayingCard';

const IVORY = '#f3efe8';

const fingerBase: React.CSSProperties = {
  position: 'absolute',
  background: IVORY,
  borderRadius: 10,
  transformOrigin: 'bottom center',
  boxShadow: 'inset -3px 0 4px rgba(0,0,0,.1)',
};

interface PickupOverlayProps {
  count: number;
  who: string; // 'YOU' or a player name (already uppercased by caller)
}

// "The hand gives you cards" — full-screen non-interactive pickup animation
export function PickupOverlay({ count, who }: PickupOverlayProps) {
  const n = Math.max(1, count);
  const mid = (n - 1) / 2;
  const noun = n > 1 ? ' CARDS' : ' CARD';
  const label = who === 'YOU'
    ? `YOU HAVE PICKED UP ${n}${noun}`
    : `${who} HAS PICKED UP ${n}${noun}`;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 120,
        pointerEvents: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%,-50%)',
          width: 260,
          height: 220,
          animation: 'handGive 1.5s cubic-bezier(.3,.7,.3,1) forwards',
        }}
      >
        {/* Fan of card backs held by the hand */}
        {Array.from({ length: n }).map((_, i) => (
          <CardBack
            key={i}
            w={64}
            h={92}
            style={{
              position: 'absolute',
              left: '50%',
              top: 40,
              transformOrigin: 'bottom center',
              transform: `translateX(-50%) rotate(${(i - mid) * 16}deg) translateX(${(i - mid) * 30}px)`,
              zIndex: i,
            }}
          />
        ))}
        {/* Cartoon hand: palm + 4 fingers + thumb */}
        <div style={{ position: 'absolute', left: '50%', bottom: -6, transform: 'translateX(-50%)', width: 120, height: 120 }}>
          <div
            style={{
              position: 'absolute',
              left: '50%',
              bottom: 0,
              transform: 'translateX(-50%)',
              width: 104,
              height: 74,
              background: IVORY,
              borderRadius: '50% 50% 46% 46%/60% 60% 40% 40%',
              boxShadow: '0 8px 20px rgba(0,0,0,.4),inset 0 -6px 10px rgba(0,0,0,.12)',
            }}
          />
          <div style={{ ...fingerBase, left: 14, bottom: 34, width: 17, height: 56, transform: 'rotate(-20deg)' }} />
          <div style={{ ...fingerBase, left: 36, bottom: 40, width: 17, height: 64, transform: 'rotate(-7deg)' }} />
          <div style={{ ...fingerBase, left: 58, bottom: 40, width: 17, height: 64, transform: 'rotate(7deg)' }} />
          <div style={{ ...fingerBase, left: 80, bottom: 34, width: 17, height: 56, transform: 'rotate(20deg)' }} />
          <div style={{ ...fingerBase, left: -2, bottom: 6, width: 20, height: 40, borderRadius: 12, transform: 'rotate(-52deg)' }} />
        </div>
      </div>
      {/* Caption */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          bottom: 118,
          transform: 'translateX(-50%)',
          fontFamily: 'var(--font-heading)',
          fontWeight: 800,
          fontSize: 15,
          letterSpacing: '.06em',
          color: 'var(--color-text)',
          textShadow: '0 2px 6px rgba(0,0,0,.5)',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </div>
    </div>
  );
}
