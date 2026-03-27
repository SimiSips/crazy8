'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { subscribeToGame, startGame } from '@/lib/gameService';
import { fetchAllStats, type PlayerStats } from '@/lib/playerStats';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import type { GameState } from '@/lib/types';

export default function LobbyPage() {
  const { gameId } = useParams<{ gameId: string }>();
  const router = useRouter();
  const [game, setGame] = useState<GameState | null>(null);
  const [stats, setStats] = useState<Record<string, PlayerStats>>({});
  const [myId, setMyId] = useState('');
  const [copied, setCopied] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setMyId(localStorage.getItem('crazy8_playerId') ?? '');
  }, []);

  useEffect(() => {
    if (!gameId) return;
    const unsub = subscribeToGame(gameId, (state) => {
      setGame(state);
      if (state.status === 'playing') router.replace(`/game/${gameId}`);
    });
    return unsub;
  }, [gameId, router]);

  // Fetch win stats whenever players change
  useEffect(() => {
    fetchAllStats().then(setStats).catch(() => {});
  }, [game?.playerOrder.length]);

  async function handleStart() {
    setStarting(true); setError('');
    try {
      await startGame(gameId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start');
      setStarting(false);
    }
  }

  function copyCode() {
    navigator.clipboard.writeText(gameId).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!game) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-950">
        <div className="w-8 h-8 rounded-full border-2 border-white border-t-transparent animate-spin" />
      </div>
    );
  }

  const isHost = game.players[myId]?.isHost;
  const playerList = game.playerOrder.map((id, i) => ({ ...game.players[id], index: i })).filter(Boolean);
  const canStart = isHost && playerList.length >= 2;

  return (
    <div
      className="h-full flex flex-col items-center justify-between px-5"
      style={{ background: 'linear-gradient(160deg, #0a0a0a 0%, #111827 60%, #0a0a0a 100%)' }}
    >
      {/* Room code */}
      <div className="w-full max-w-sm pt-12">
        <p className="text-gray-400 text-sm text-center mb-1">Room Code</p>
        <motion.button whileTap={{ scale: 0.97 }} onClick={copyCode} className="w-full">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl py-4 px-5 text-center mb-1">
            <span className="text-3xl font-black tracking-[0.3em] text-white">{gameId}</span>
          </div>
          <p className="text-xs text-gray-500 text-center">
            {copied ? '✓ Copied!' : 'Tap to copy · Share with friends'}
          </p>
        </motion.button>
      </div>

      {/* Player list */}
      <div className="w-full max-w-sm flex-1 mt-8">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Players ({playerList.length}/4)
        </p>
        <div className="space-y-2">
          <AnimatePresence>
            {playerList.map((player) => {
              const wins = stats[player.id]?.wins ?? 0;
              const isMe = player.id === myId;
              return (
                <motion.div
                  key={player.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="flex items-center gap-3 bg-gray-900 rounded-2xl px-4 py-3 border border-gray-800"
                >
                  <PlayerAvatar
                    name={player.name}
                    index={player.index}
                    wins={wins}
                    size="md"
                    isYou={isMe}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold text-sm truncate">{player.name}</p>
                    <p className="text-gray-500 text-xs">
                      {player.isHost ? '👑 Host' : isMe ? 'You' : 'Player'}
                      {wins > 0 ? ` · ${wins} win${wins > 1 ? 's' : ''}` : ''}
                    </p>
                  </div>
                  <div className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {playerList.length < 2 && (
          <p className="text-gray-600 text-sm text-center mt-6">
            Waiting for at least 1 more player…
          </p>
        )}
      </div>

      {/* Bottom actions */}
      <div className="w-full max-w-sm pb-10">
        {error && <p className="text-red-400 text-sm text-center mb-3">{error}</p>}
        {isHost ? (
          <button
            onClick={handleStart}
            disabled={!canStart || starting}
            className="w-full py-4 rounded-2xl font-black text-base bg-white text-gray-900 disabled:opacity-30 active:scale-95 transition-transform shadow-xl"
          >
            {starting ? 'Starting…' : 'Start Game'}
          </button>
        ) : (
          <div className="flex items-center justify-center gap-2 py-4">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <p className="text-gray-400 text-sm">Waiting for host to start…</p>
          </div>
        )}
      </div>
    </div>
  );
}
