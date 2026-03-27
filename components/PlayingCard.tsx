'use client';
import { motion } from 'framer-motion';
import type { Card } from '@/lib/types';

// ─── Color maps ────────────────────────────────────────────────────────────────
export const CARD_BG: Record<string, string> = {
  red: '#f03030',
  green: '#22c55e',
  blue: '#3b82f6',
  yellow: '#facc15',
};

const CARD_SHADOW: Record<string, string> = {
  red: '0 0 20px rgba(229,62,62,0.7)',
  green: '0 0 20px rgba(56,161,105,0.7)',
  blue: '0 0 20px rgba(49,130,206,0.7)',
  yellow: '0 0 20px rgba(214,158,46,0.7)',
};

const TYPE_CENTER: Record<string, string> = {
  skip: '⊘',
  reverse: '↺',
  draw2: '+2',
  wild8: '8',
};

function cardCenter(card: Card): string {
  if (card.type === 'number') return String(card.value);
  return TYPE_CENTER[card.type] ?? '?';
}

// ─── Stacked face-down fan ─────────────────────────────────────────────────────
interface CardFanProps {
  count: number;
  direction?: 'horizontal' | 'vertical';
}

export function CardFan({ count, direction = 'horizontal' }: CardFanProps) {
  const show = Math.min(count, 9);
  const W = 46;
  const H = 66;
  const offset = direction === 'horizontal' ? 13 : 10;
  const totalW = direction === 'horizontal' ? W + (show - 1) * offset : W;
  const totalH = direction === 'vertical' ? H + (show - 1) * offset : H;

  return (
    <div style={{ position: 'relative', width: totalW, height: totalH, flexShrink: 0 }}>
      {Array.from({ length: show }).map((_, i) => {
        const style: React.CSSProperties =
          direction === 'horizontal'
            ? { position: 'absolute', left: i * offset, top: 0, zIndex: i }
            : { position: 'absolute', top: i * offset, left: 0, zIndex: i };
        return (
          <div key={i} style={style}>
            <FaceDownCard />
          </div>
        );
      })}
    </div>
  );
}

// ─── Face-down card ────────────────────────────────────────────────────────────
export function FaceDownCard() {
  return (
    <div
      style={{
        width: 46,
        height: 66,
        borderRadius: 8,
        background: 'linear-gradient(145deg, #1a1a2e 0%, #0f0f1a 100%)',
        border: '2px solid rgba(255,255,255,0.25)',
        boxShadow: '2px 2px 6px rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          inset: 4,
          position: 'absolute',
          borderRadius: 5,
          border: '1.5px solid rgba(255,255,255,0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 8, fontWeight: 900, letterSpacing: 0.5 }}>
          CRAZY 8
        </span>
      </div>
    </div>
  );
}

// ─── Playing card (face-up) ────────────────────────────────────────────────────
interface PlayingCardProps {
  card: Card;
  playable?: boolean;
  selected?: boolean;
  onClick?: () => void;
  size?: 'sm' | 'md';
  chosenColor?: string; // for wild8 on discard: shows the color that was picked
}

export function PlayingCard({ card, playable, selected, onClick, size = 'md', chosenColor }: PlayingCardProps) {
  const isWild = card.type === 'wild8';
  const label = cardCenter(card);
  const wildBg = chosenColor && CARD_BG[chosenColor]
    ? `linear-gradient(160deg, ${CARD_BG[chosenColor]}dd 0%, ${CARD_BG[chosenColor]} 100%)`
    : 'linear-gradient(135deg,#e53e3e 0%,#d69e2e 33%,#38a169 66%,#3182ce 100%)';
  const bg = isWild
    ? wildBg
    : `linear-gradient(160deg, ${CARD_BG[card.color ?? 'red']}dd 0%, ${CARD_BG[card.color ?? 'red']} 100%)`;

  const W = size === 'md' ? 72 : 50;
  const H = size === 'md' ? 104 : 72;
  const centerSize = size === 'md' ? (card.type === 'number' ? 40 : 28) : (card.type === 'number' ? 26 : 18);
  const cornerSize = size === 'md' ? 11 : 9;
  const shadow = !isWild && card.color ? CARD_SHADOW[card.color] : '0 0 20px rgba(168,85,247,0.7)';

  return (
    <motion.div
      whileHover={playable ? { y: -18, scale: 1.06 } : {}}
      whileTap={playable ? { scale: 0.93 } : {}}
      animate={{ y: selected ? -22 : 0, scale: selected ? 1.04 : 1 }}
      transition={{ type: 'spring', stiffness: 450, damping: 28 }}
      onClick={playable ? onClick : undefined}
      style={{
        width: W,
        height: H,
        borderRadius: 10,
        background: bg,
        border: playable || selected ? '2.5px solid #fff' : '2px solid rgba(255,255,255,0.35)',
        boxShadow: playable || selected ? shadow : '1px 2px 6px rgba(0,0,0,0.4)',
        position: 'relative',
        cursor: playable ? 'pointer' : 'default',
        flexShrink: 0,
        opacity: !playable && !selected ? 0.55 : 1,
        filter: !playable && !selected ? 'saturate(0.6)' : 'none',
      }}
    >
      {/* Inner frame */}
      <div
        style={{
          position: 'absolute',
          inset: 4,
          borderRadius: 7,
          border: '1.5px solid rgba(255,255,255,0.5)',
        }}
      />

      {/* Top-left corner */}
      <div style={{ position: 'absolute', top: 5, left: 6, color: '#fff', fontWeight: 900, fontSize: cornerSize, lineHeight: 1 }}>
        {label}
      </div>

      {/* Center label */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontWeight: 900, fontSize: centerSize,
        textShadow: '1px 1px 4px rgba(0,0,0,0.4)',
      }}>
        {label}
      </div>

      {/* Bottom-right corner (rotated) */}
      <div style={{
        position: 'absolute', bottom: 5, right: 6,
        color: '#fff', fontWeight: 900, fontSize: cornerSize,
        lineHeight: 1, transform: 'rotate(180deg)',
      }}>
        {label}
      </div>

      {/* Playable glow ring */}
      {(playable || selected) && (
        <div style={{
          position: 'absolute', inset: -3, borderRadius: 13,
          boxShadow: shadow, pointerEvents: 'none',
        }} />
      )}
    </motion.div>
  );
}
