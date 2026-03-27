'use client';
import { motion, AnimatePresence } from 'framer-motion';
import type { Color } from '@/lib/types';

const COLORS: { color: Color; bg: string; label: string }[] = [
  { color: 'red', bg: 'bg-red-500', label: 'Red' },
  { color: 'green', bg: 'bg-green-500', label: 'Green' },
  { color: 'blue', bg: 'bg-blue-500', label: 'Blue' },
  { color: 'yellow', bg: 'bg-yellow-400', label: 'Yellow' },
];

interface ColorPickerProps {
  open: boolean;
  onSelect: (color: Color) => void;
}

export function ColorPicker({ open, onSelect }: ColorPickerProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.75, y: 50 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.75, y: 50 }}
            transition={{ type: 'spring', stiffness: 420, damping: 28 }}
            className="bg-gray-950 rounded-3xl p-6 mx-4 w-full max-w-xs shadow-2xl border border-white/10"
          >
            <h2 className="text-white text-center text-xl font-black mb-1">Choose a Color</h2>
            <p className="text-gray-400 text-center text-sm mb-5">Your Wild 8 sets the new color</p>
            <div className="grid grid-cols-2 gap-3">
              {COLORS.map(({ color, bg, label }) => (
                <button
                  key={color}
                  onClick={() => onSelect(color)}
                  className={`${bg} rounded-2xl py-5 flex items-center justify-center font-black text-white text-lg shadow-lg active:scale-95 transition-transform`}
                >
                  {label}
                </button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
