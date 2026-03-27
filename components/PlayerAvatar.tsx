'use client';
import { motion } from 'framer-motion';

const GRADIENTS = [
  'from-purple-500 to-blue-500',
  'from-pink-500 to-red-500',
  'from-amber-500 to-orange-500',
  'from-teal-500 to-green-500',
  'from-cyan-400 to-blue-400',
  'from-rose-500 to-pink-400',
  'from-lime-500 to-green-400',
  'from-indigo-500 to-purple-400',
];

function medalEmoji(wins: number): string {
  if (wins >= 10) return '👑';
  if (wins >= 5) return '🏆';
  if (wins >= 3) return '🥇';
  if (wins >= 2) return '🥈';
  return '🥉';
}

interface PlayerAvatarProps {
  name: string;
  index: number;           // 0-3, used for gradient
  wins?: number;           // undefined = not loaded yet
  isCurrentTurn?: boolean;
  isYou?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function PlayerAvatar({
  name,
  index,
  wins,
  isCurrentTurn,
  isYou,
  size = 'md',
}: PlayerAvatarProps) {
  const gradient = GRADIENTS[index % GRADIENTS.length];
  const dim = size === 'sm' ? 'w-8 h-8 text-sm' : size === 'lg' ? 'w-14 h-14 text-xl' : 'w-10 h-10 text-base';

  return (
    <motion.div
      className="relative inline-flex flex-col items-center"
      animate={isCurrentTurn ? { scale: 1.08 } : { scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
    >
      {/* Avatar circle */}
      <div
        className={`${dim} rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center font-black text-white shadow-md flex-shrink-0
          ${isCurrentTurn ? 'ring-2 ring-white ring-offset-1 ring-offset-transparent shadow-lg' : ''}
        `}
      >
        {name[0]?.toUpperCase()}
      </div>

      {/* Medal badge — only shown if wins > 0 */}
      {wins !== undefined && wins > 0 && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute -top-1.5 -right-1.5 flex items-center gap-0.5 bg-gray-950 border border-yellow-400/60 rounded-full px-1 py-0.5 shadow"
        >
          <span className="text-[9px] leading-none">{medalEmoji(wins)}</span>
          <span className="text-yellow-300 text-[9px] font-black leading-none">{wins}</span>
        </motion.div>
      )}

      {/* "You" / current turn label */}
      {(isYou || isCurrentTurn) && (
        <div className={`mt-0.5 text-[9px] font-bold leading-none
          ${isCurrentTurn ? 'text-yellow-300 animate-pulse' : 'text-gray-500'}`}
        >
          {isCurrentTurn ? (isYou ? 'YOUR TURN' : 'THEIR TURN') : 'You'}
        </div>
      )}
    </motion.div>
  );
}
