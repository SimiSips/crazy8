'use client';
import { AnimatePresence, motion } from 'framer-motion';
import { CARD_COLORS } from './PlayingCard';
import type { Color } from '@/lib/types';

const ORDER: Color[] = ['red', 'blue', 'green', 'yellow'];

interface WildPickerProps {
  open: boolean;
  onSelect: (color: Color) => void;
  onCancel: () => void;
  subtitle?: string;
}

// "Choose a color" modal — shown after playing a wild 8, or to request a
// colour after playing a +4
export function WildPicker({ open, onSelect, onCancel, subtitle = 'Wild card played' }: WildPickerProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          style={{
            position: 'fixed',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            background: 'rgba(15,12,10,.6)',
            zIndex: 200,
            padding: 20,
          }}
        >
          <div
            className="glass"
            style={{
              width: '100%',
              maxWidth: 380,
              padding: '22px 22px 18px',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
              boxShadow: '0 20px 50px rgba(0,0,0,.5)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
              <h4 className="heading" style={{ margin: 0, fontSize: 20 }}>Choose a color</h4>
              <span className="text-muted" style={{ fontSize: 12 }}>{subtitle}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {ORDER.map(key => {
                const c = CARD_COLORS[key];
                return (
                  <motion.button
                    key={key}
                    type="button"
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => onSelect(key)}
                    style={{
                      background: c.bg,
                      color: key === 'yellow' ? '#201e1d' : '#f8f4f4',
                      border: 0,
                      cursor: 'pointer',
                      height: 104,
                      display: 'flex',
                      alignItems: 'flex-end',
                      padding: 14,
                      fontFamily: 'var(--font-heading)',
                      fontWeight: 800,
                      fontSize: 16,
                      letterSpacing: '.03em',
                      borderRadius: 8,
                    }}
                  >
                    {c.name}
                  </motion.button>
                );
              })}
            </div>
            <button type="button" className="btn btn-ghost" onClick={onCancel} style={{ alignSelf: 'flex-start', marginTop: 4 }}>
              ← Cancel
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
