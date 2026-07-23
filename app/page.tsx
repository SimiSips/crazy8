'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { createGame, joinGame } from '@/lib/gameService';
import { firebaseConfigured } from '@/lib/firebase';
import { CardFace } from '@/components/PlayingCard';
import { Wordmark, Watermark8 } from '@/components/Wordmark';
import type { Card } from '@/lib/types';

function getOrCreatePlayerId(): string {
  let id = localStorage.getItem('crazy8_playerId');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('crazy8_playerId', id);
  }
  return id;
}

// Decorative cards for the menu fans
const fan = (color: Card['color'], type: Card['type'], value: number | null = null): Card =>
  ({ id: `${color}-${type}-${value}`, color, type, value });

const DESKTOP_FAN: Card[] = [
  fan('red', 'number', 7),
  fan('blue', 'skip'),
  fan('green', 'number', 2),
  fan('yellow', 'reverse'),
  fan(null, 'wild8'),
];

const MOBILE_FAN: Card[] = [
  fan('red', 'number', 8 as number),
  fan('blue', 'draw2'),
  fan('yellow', 'reverse'),
];

export default function Home() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [joinOpen, setJoinOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setName(localStorage.getItem('crazy8_playerName') ?? '');
  }, []);

  function preflight(): boolean {
    if (!name.trim()) { setError('Enter your name first'); return false; }
    if (!firebaseConfigured) {
      setError('Firebase is not configured — add your NEXT_PUBLIC_FIREBASE_* keys to .env.local');
      return false;
    }
    return true;
  }

  async function handleCreate() {
    if (!preflight()) return;
    setLoading(true); setError('');
    try {
      const playerId = getOrCreatePlayerId();
      localStorage.setItem('crazy8_playerName', name.trim());
      const gameId = await createGame(playerId, name.trim());
      router.push(`/lobby/${gameId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create game');
      setLoading(false);
    }
  }

  async function handleJoin() {
    if (!preflight()) return;
    if (!roomCode.trim()) { setError('Enter a room code'); return; }
    setLoading(true); setError('');
    try {
      const playerId = getOrCreatePlayerId();
      localStorage.setItem('crazy8_playerName', name.trim());
      const code = roomCode.trim().toUpperCase();
      await joinGame(code, playerId, name.trim());
      router.push(`/lobby/${code}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to join game');
      setLoading(false);
    }
  }

  function openJoin() {
    if (!name.trim()) { setError('Enter your name first'); return; }
    setError('');
    setJoinOpen(true);
  }

  const nameInputStyle: React.CSSProperties = {
    width: '100%',
    background: 'rgba(0,0,0,.3)',
    border: '1.5px solid rgba(248,244,244,.25)',
    borderRadius: 10,
    padding: '12px 16px',
    color: '#f4efe7',
    fontFamily: 'var(--font-heading)',
    fontWeight: 800,
    fontSize: 15,
    letterSpacing: '.08em',
    textTransform: 'uppercase',
    outline: 'none',
  };

  return (
    <div className="h-full relative overflow-hidden">
      <Watermark8 />

      {/* ─── Desktop menu ─────────────────────────────────────────── */}
      <div className="hidden lg:flex absolute inset-0 flex-col">
        {/* Header bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            padding: '24px 40px',
            borderBottom: '2px solid var(--color-divider)',
          }}
        >
          <Wordmark size={20} />
          <span className="tag tag-outline">CRAZY EIGHTS · ONLINE</span>
          <span className="text-muted" style={{ marginLeft: 'auto', fontSize: 13 }}>v2.0 · 2–8 PLAYERS</span>
        </div>

        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1.05fr 1fr' }}>
          {/* Left — pitch + actions */}
          <div
            style={{
              padding: '64px 40px 40px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              borderRight: '2px solid var(--color-divider)',
            }}
          >
            <div className="kicker" style={{ marginBottom: 18 }}>Deal it · Match it · Call it</div>
            <div
              className="heading"
              style={{ fontSize: 'clamp(64px, 7.2vw, 104px)', lineHeight: 0.86, letterSpacing: '-.03em', marginBottom: 8 }}
            >
              CUZCRAZY<span style={{ color: 'var(--color-accent)' }}>8</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 340, marginTop: 28 }}>
              <div>
                <label className="field-label">YOUR NAME</label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="PLAYER 1"
                  maxLength={20}
                  style={nameInputStyle}
                />
              </div>
              <button
                type="button"
                className="btn btn-primary btn-block"
                onClick={openJoin}
                style={{ fontSize: 15, padding: '14px 16px' }}
              >
                <span style={{ flex: 1, textAlign: 'left' }}>PLAY NOW</span>
                <span>→</span>
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-block"
                onClick={handleCreate}
                disabled={loading}
                style={{ fontSize: 14, padding: '12px 16px' }}
              >
                <span style={{ flex: 1, textAlign: 'left' }}>CREATE PRIVATE ROOM</span>
                <span>#</span>
              </button>
              {error && !joinOpen && (
                <p style={{ color: 'var(--color-accent)', fontSize: 13, margin: 0 }}>{error}</p>
              )}
            </div>
          </div>

          {/* Right — card fan */}
          <div
            style={{
              position: 'relative',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'color-mix(in srgb,#f8f4f4 4%,transparent)',
            }}
          >
            <div style={{ position: 'relative', width: 440, height: 300 }}>
              {DESKTOP_FAN.map((card, i) => (
                <CardFace
                  key={card.id}
                  card={card}
                  w={132}
                  h={196}
                  style={{
                    position: 'absolute',
                    left: i * 62,
                    top: i % 2 ? 28 : 0,
                    transform: `rotate(${(i - 2) * 7}deg)`,
                    zIndex: i,
                    transformOrigin: 'bottom center',
                    boxShadow: '0 12px 30px rgba(0,0,0,.5)',
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Mobile menu ──────────────────────────────────────────── */}
      <div className="lg:hidden absolute inset-0 flex flex-col" style={{ padding: '64px 28px 46px' }}>
        <div className="kicker" style={{ fontSize: 11, marginBottom: 10 }}>Deal it · Match it · Call it</div>
        <div className="heading" style={{ fontSize: 38, lineHeight: 0.9, letterSpacing: '-.02em' }}>
          CUZCRAZY<span style={{ color: 'var(--color-accent)' }}>8</span>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ display: 'flex' }}>
            {MOBILE_FAN.map((card, i) => (
              <CardFace
                key={card.id}
                card={card}
                w={84}
                h={124}
                style={{
                  marginLeft: i ? -20 : 0,
                  zIndex: i + 1,
                  transformOrigin: 'bottom center',
                  transform: `rotate(${(i - 1) * 10}deg) translateY(${Math.abs(i - 1) * 6}px)`,
                }}
              />
            ))}
          </div>
        </div>
        {error && !joinOpen && (
          <p style={{ color: 'var(--color-accent)', fontSize: 13, textAlign: 'center', marginBottom: 10 }}>{error}</p>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <label className="field-label">YOUR NAME</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="PLAYER 1"
              maxLength={20}
              style={nameInputStyle}
            />
          </div>
          <button
            type="button"
            onClick={openJoin}
            style={{
              height: 52,
              border: 0,
              borderRadius: 14,
              background: 'var(--color-accent)',
              color: '#f8f4f4',
              fontFamily: 'var(--font-heading)',
              fontWeight: 800,
              fontSize: 15,
              letterSpacing: '.04em',
              cursor: 'pointer',
            }}
          >
            PLAY NOW
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={loading}
            style={{
              height: 48,
              border: '1.5px solid rgba(248,244,244,.28)',
              borderRadius: 14,
              background: 'transparent',
              color: '#f4efe7',
              fontFamily: 'var(--font-heading)',
              fontWeight: 800,
              fontSize: 13,
              letterSpacing: '.04em',
              cursor: 'pointer',
              opacity: loading ? 0.5 : 1,
            }}
          >
            CREATE ROOM
          </button>
        </div>
      </div>

      {/* ─── Join a room dialog ───────────────────────────────────── */}
      <AnimatePresence>
        {joinOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'absolute',
              inset: 0,
              display: 'grid',
              placeItems: 'center',
              background: 'rgba(15,12,10,.62)',
              zIndex: 210,
              padding: 20,
            }}
          >
            <div
              className="glass"
              style={{
                background: 'rgba(27,23,20,.94)',
                width: '100%',
                maxWidth: 360,
                padding: '22px 22px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
                boxShadow: '0 20px 50px rgba(0,0,0,.5)',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <h4 className="heading" style={{ margin: 0, fontSize: 20 }}>Join a room</h4>
                <span className="text-muted" style={{ fontSize: 12 }}>
                  Enter the code your host shared — or start a fresh room.
                </span>
              </div>
              <input
                value={roomCode}
                onChange={e => setRoomCode(e.target.value.toUpperCase().slice(0, 6))}
                onKeyDown={e => e.key === 'Enter' && handleJoin()}
                placeholder="K7Q2M4"
                maxLength={6}
                style={{
                  width: '100%',
                  background: 'rgba(0,0,0,.3)',
                  border: '1.5px solid rgba(248,244,244,.25)',
                  borderRadius: 10,
                  padding: '14px 16px',
                  color: '#f4efe7',
                  fontFamily: 'var(--font-heading)',
                  fontWeight: 800,
                  fontSize: 26,
                  letterSpacing: '.3em',
                  textAlign: 'center',
                  textTransform: 'uppercase',
                  outline: 'none',
                }}
              />
              {error && <p style={{ color: 'var(--color-accent)', fontSize: 13, textAlign: 'center', margin: 0 }}>{error}</p>}
              <button
                type="button"
                className="btn btn-primary btn-block"
                onClick={handleJoin}
                disabled={loading}
                style={{ padding: '13px 16px', justifyContent: 'center', fontSize: 14 }}
              >
                JOIN ROOM →
              </button>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setJoinOpen(false)} style={{ padding: '6px 2px' }}>
                  ← Cancel
                </button>
                <button type="button" className="btn btn-ghost" onClick={handleCreate} disabled={loading} style={{ padding: '6px 2px' }}>
                  CREATE NEW ROOM
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
