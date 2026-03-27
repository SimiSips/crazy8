'use client';
import { motion } from 'framer-motion';
import type { Card } from '@/lib/types';

export const COLOR_BG: Record<string, string> = {
  red: 'bg-red-500',
  green: 'bg-green-500',
  blue: 'bg-blue-500',
  yellow: 'bg-yellow-400',
};

export const COLOR_DARK: Record<string, string> = {
  red: 'bg-red-700',
  green: 'bg-green-700',
  blue: 'bg-blue-700',
  yellow: 'bg-yellow-600',
};

export const COLOR_BORDER: Record<string, string> = {
  red: 'border-red-300',
  green: 'border-green-300',
  blue: 'border-blue-300',
  yellow: 'border-yellow-300',
};

export const COLOR_GLOW: Record<string, string> = {
  red: 'shadow-red-400/60',
  green: 'shadow-green-400/60',
  blue: 'shadow-blue-400/60',
  yellow: 'shadow-yellow-300/60',
};

const TYPE_SYMBOL: Record<string, string> = {
  skip: '⊘',
  reverse: '↺',
  draw2: '+2',
  wild8: '8',
};

function cardLabel(card: Card): string {
  if (card.type === 'number') return String(card.value);
  return TYPE_SYMBOL[card.type] ?? '?';
}

interface PlayingCardProps {
  card: Card;
  playable?: boolean;
  selected?: boolean;
  onClick?: () => void;
  size?: 'sm' | 'md';
}

export function PlayingCard({ card, playable, selected, onClick, size = 'md' }: PlayingCardProps) {
  const isWild = card.type === 'wild8';
  const label = cardLabel(card);
  const sm = size === 'sm';

  const bgClass = isWild
    ? '' // gradient applied inline
    : card.color
    ? COLOR_BG[card.color]
    : 'bg-gray-800';

  const glowClass = isWild ? 'shadow-purple-400/60' : card.color ? COLOR_GLOW[card.color] : '';

  return (
    <motion.div
      whileHover={playable ? { y: -16, scale: 1.06 } : {}}
      whileTap={playable ? { scale: 0.94 } : {}}
      animate={{ y: selected ? -20 : 0 }}
      transition={{ type: 'spring', stiffness: 420, damping: 26 }}
      onClick={playable ? onClick : undefined}
      className={[
        'relative rounded-2xl flex-shrink-0 overflow-hidden border-4',
        sm ? 'w-[46px] h-[64px]' : 'w-[72px] h-[100px]',
        bgClass,
        playable
          ? `cursor-pointer border-white shadow-xl ${glowClass}`
          : 'border-white/30 cursor-default',
        !playable && !selected ? 'opacity-50 saturate-50' : '',
        selected ? `border-white shadow-2xl ${glowClass} ring-4 ring-white/40` : '',
      ].join(' ')}
      style={
        isWild
          ? { background: 'linear-gradient(135deg, #ef4444 0%, #f59e0b 25%, #22c55e 50%, #3b82f6 75%, #a855f7 100%)' }
          : undefined
      }
    >
      {/* Inner oval */}
      <div
        className={`absolute inset-[6px] rounded-xl flex items-center justify-center
          ${isWild ? 'bg-black/30' : 'bg-black/20'}
        `}
      >
        <span
          className={[
            'font-black text-white drop-shadow',
            sm ? 'text-base' : card.type === 'number' ? 'text-3xl' : 'text-xl',
          ].join(' ')}
        >
          {label}
        </span>
      </div>

      {/* Corner top-left */}
      <div className={`absolute top-1 left-1.5 leading-none text-white`}>
        <div className={`font-black ${sm ? 'text-[9px]' : 'text-xs'}`}>{label}</div>
      </div>

      {/* Corner bottom-right rotated */}
      <div className={`absolute bottom-1 right-1.5 leading-none text-white rotate-180`}>
        <div className={`font-black ${sm ? 'text-[9px]' : 'text-xs'}`}>{label}</div>
      </div>
    </motion.div>
  );
}

interface FaceDownCardProps {
  size?: 'sm' | 'md';
  count?: number;
}

export function FaceDownCard({ size = 'md', count }: FaceDownCardProps) {
  const sm = size === 'sm';
  return (
    <div
      className={`relative rounded-2xl border-4 border-white/20 flex-shrink-0
        ${sm ? 'w-[46px] h-[64px]' : 'w-[72px] h-[100px]'}
      `}
      style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #1e1b4b 100%)' }}
    >
      <div className="absolute inset-[6px] rounded-xl border-2 border-white/10 flex items-center justify-center">
        <span className={`font-black text-white/40 ${sm ? 'text-sm' : 'text-2xl'}`}>8</span>
      </div>
      {count !== undefined && (
        <div className="absolute -top-2 -right-2 bg-white text-gray-900 text-[10px] font-black rounded-full w-5 h-5 flex items-center justify-center shadow-md">
          {count}
        </div>
      )}
    </div>
  );
}
