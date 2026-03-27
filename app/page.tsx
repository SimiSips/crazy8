'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { createGame, joinGame } from '@/lib/gameService';

function getOrCreatePlayerId(): string {
  let id = localStorage.getItem('crazy8_playerId');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('crazy8_playerId', id);
  }
  return id;
}

export default function Home() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [tab, setTab] = useState<'create' | 'join'>('create');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleCreate() {
    if (!name.trim()) { setError('Enter your name first'); return; }
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
    if (!name.trim()) { setError('Enter your name first'); return; }
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

  return (
    <div
      className="h-full flex flex-col items-center justify-center px-5"
      style={{ background: 'linear-gradient(160deg, #0a0a0a 0%, #111827 60%, #0a0a0a 100%)' }}
    >
      {/* Logo */}
      <motion.div
        initial={{ y: -40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 24 }}
        className="text-center mb-10"
      >
        <div className="flex gap-1 justify-center mb-3">
          {['bg-red-500', 'bg-yellow-400', 'bg-green-500', 'bg-blue-500'].map((c, i) => (
            <motion.div
              key={c}
              className={`w-7 h-10 ${c} rounded-lg flex items-center justify-center text-white font-black text-sm shadow-lg`}
              initial={{ rotate: -20 + i * 13, y: 10 }}
              animate={{ rotate: -15 + i * 10, y: 0 }}
              transition={{ delay: i * 0.06, type: 'spring', stiffness: 200 }}
            >
              8
            </motion.div>
          ))}
        </div>
        <h1 className="text-4xl font-black tracking-tight text-white">Crazy 8s</h1>
        <p className="text-gray-400 text-sm mt-1">Play with anyone, anywhere</p>
      </motion.div>

      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 280, damping: 24, delay: 0.12 }}
        className="w-full max-w-sm"
      >
        {/* Name input */}
        <div className="mb-4">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5 block">
            Your Name
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (tab === 'create' ? handleCreate() : handleJoin())}
            placeholder="Enter your name"
            maxLength={20}
            className="w-full bg-gray-900 border border-gray-700 rounded-2xl px-4 py-3.5 text-white placeholder-gray-600 text-base focus:outline-none focus:border-gray-500 transition-colors"
          />
        </div>

        {/* Tab switcher */}
        <div className="flex bg-gray-900 rounded-2xl p-1 mb-4 border border-gray-800">
          {(['create', 'join'] as const).map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setError(''); }}
              className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition-all
                ${tab === t ? 'bg-white text-gray-900 shadow' : 'text-gray-400'}`}
            >
              {t === 'create' ? 'Create Game' : 'Join Game'}
            </button>
          ))}
        </div>

        {/* Room code input for join */}
        {tab === 'join' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mb-4 overflow-hidden"
          >
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5 block">
              Room Code
            </label>
            <input
              type="text"
              value={roomCode}
              onChange={e => setRoomCode(e.target.value.toUpperCase().slice(0, 6))}
              onKeyDown={e => e.key === 'Enter' && handleJoin()}
              placeholder="ABC123"
              maxLength={6}
              className="w-full bg-gray-900 border border-gray-700 rounded-2xl px-4 py-3.5 text-white placeholder-gray-600 text-xl tracking-[0.3em] font-black uppercase text-center focus:outline-none focus:border-gray-500 transition-colors"
            />
          </motion.div>
        )}

        {/* Error */}
        {error && <p className="text-red-400 text-sm text-center mb-3">{error}</p>}

        {/* CTA */}
        <button
          onClick={tab === 'create' ? handleCreate : handleJoin}
          disabled={loading}
          className="w-full py-4 rounded-2xl font-black text-base bg-white text-gray-900 disabled:opacity-40 active:scale-95 transition-transform shadow-xl"
        >
          {loading ? 'Loading…' : tab === 'create' ? 'Create Game' : 'Join Game'}
        </button>

        <p className="text-center text-gray-600 text-xs mt-5">
          Share the room code — works on iOS &amp; Android
        </p>
      </motion.div>
    </div>
  );
}
