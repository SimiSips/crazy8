'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { subscribeToGame, playCard, drawCard, resetGame } from '@/lib/gameService';
import { fetchAllStats, type PlayerStats } from '@/lib/playerStats';
import { canPlayCard } from '@/lib/gameLogic';
import { PlayingCard, FaceDownCard, CardFan, CARD_BG } from '@/components/PlayingCard';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { ColorPicker } from '@/components/ColorPicker';
import type { GameState, Card, Color } from '@/lib/types';

// ─── Felt table background style ───────────────────────────────────────────────
const TABLE_BG: React.CSSProperties = {
  background: 'radial-gradient(ellipse at 45% 35%, #dc2626 0%, #b91c1c 45%, #991b1b 80%, #7f1d1d 100%)',
};

// ─── Opponent slot placed around the round table ──────────────────────────────
function TableOpponent({
  player, wins, isCurrent, playerIndex, isSkipped,
}: {
  player: { id: string; name: string; hand: Card[] };
  wins: number; isCurrent: boolean; playerIndex: number; isSkipped: boolean;
}) {
  return (
    <motion.div
      animate={isCurrent ? { scale: 1.1 } : { scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 22 }}
      className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-2xl relative
        ${isCurrent ? 'bg-white/15 ring-2 ring-white/40' : 'bg-black/25'}`}
      style={{ width: 56 }}
    >
      <PlayerAvatar name={player.name} index={playerIndex} wins={wins} isCurrentTurn={isCurrent} size="sm" />
      <span className="text-white text-[9px] font-bold w-full text-center truncate leading-tight">
        {player.name}
      </span>
      <span className="text-white/60 text-[9px] font-semibold leading-tight">
        {player.hand.length} cards
      </span>

      {/* Skip overlay */}
      <AnimatePresence>
        {isSkipped && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            style={{
              position: 'absolute', inset: 0,
              borderRadius: 16,
              background: 'rgba(220,38,38,0.55)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '2px solid #ef4444',
            }}
          >
            <span style={{ color: '#fff', fontSize: 22, fontWeight: 900, lineHeight: 1 }}>✕</span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Spread n opponents evenly on an arc centred at the top (0°) ──────────────
// Angles in degrees: 0=top (12 o'clock), clockwise positive.
// Arc width grows with player count so few players land near left/right,
// many players spread all the way round to the lower sides.
function getOpponentAngles(n: number): number[] {
  if (n === 0) return [];
  if (n === 1) return [0];
  const arcDeg = Math.min(180 + (n - 2) * 24, 300);
  const startDeg = -arcDeg / 2;
  return Array.from({ length: n }, (_, i) =>
    ((startDeg + (i * arcDeg) / (n - 1)) + 360) % 360,
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function GamePage() {
  const { gameId } = useParams<{ gameId: string }>();
  const router = useRouter();
  const [game, setGame] = useState<GameState | null>(null);
  const [stats, setStats] = useState<Record<string, PlayerStats>>({});
  const [myId, setMyId] = useState('');
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [error, setError] = useState('');
  const [actionMsg, setActionMsg] = useState('');
  const [skippedPlayerId, setSkippedPlayerId] = useState<string | null>(null);

  useEffect(() => {
    setMyId(localStorage.getItem('crazy8_playerId') ?? '');
  }, []);

  useEffect(() => {
    if (!gameId) return;
    const unsub = subscribeToGame(gameId, s => setGame(s));
    return unsub;
  }, [gameId]);

  useEffect(() => {
    if (!game) return;
    fetchAllStats().then(setStats).catch(() => {});
  }, [game?.status, game?.playerOrder.length]);

  useEffect(() => {
    if (!game?.lastAction) return;
    setActionMsg(game.lastAction);
    const t = setTimeout(() => setActionMsg(''), 3000);
    return () => clearTimeout(t);
  }, [game?.lastAction]);

  // Show skip overlay on the affected player for 1.8 s
  useEffect(() => {
    if (!game?.lastSkippedId) return;
    setSkippedPlayerId(game.lastSkippedId);
    const t = setTimeout(() => setSkippedPlayerId(null), 1800);
    return () => clearTimeout(t);
  }, [game?.lastSkippedId]);

  // When host resets the game, redirect all players back to the lobby
  useEffect(() => {
    if (game?.status === 'lobby') {
      router.replace(`/lobby/${gameId}`);
    }
  }, [game?.status, gameId, router]);

  // Table area dimensions — must be declared before any early return
  const tableRef = useRef<HTMLDivElement>(null);
  const [tableDims, setTableDims] = useState({ w: 390, h: 400 });
  useEffect(() => {
    const el = tableRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([entry]) => {
      setTableDims({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const isMyTurn = game ? game.playerOrder[game.currentPlayerIndex] === myId : false;
  const myHand = game?.players[myId]?.hand ?? [];
  const topCard = game?.discardPile[game.discardPile.length - 1] ?? null;

  const playable = useCallback((hand: Card[]) => {
    if (!game || !topCard || !isMyTurn) return new Set<string>();
    return new Set(hand.filter(c => canPlayCard(c, topCard, game.currentColor, game.pendingDraw)).map(c => c.id));
  }, [game, topCard, isMyTurn]);

  const playableSet = playable(myHand);

  function handleCardTap(card: Card) {
    if (!playableSet.has(card.id)) return;
    if (selectedCardId === card.id) {
      card.type === 'wild8' ? setShowColorPicker(true) : submitPlay(card.id);
    } else {
      setSelectedCardId(card.id);
    }
  }

  async function submitPlay(cardId: string, color?: Color) {
    setShowColorPicker(false);
    setSelectedCardId(null);
    setError('');
    try { await playCard(gameId, myId, cardId, color); }
    catch (e) { setError(e instanceof Error ? e.message : 'Error'); }
  }

  async function handleDraw() {
    setSelectedCardId(null);
    setError('');
    try { await drawCard(gameId, myId); }
    catch (e) { setError(e instanceof Error ? e.message : 'Error drawing'); }
  }

  async function handleReset() {
    try { await resetGame(gameId); router.replace(`/lobby/${gameId}`); }
    catch { setError('Error resetting'); }
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (!game) {
    return (
      <div className="h-full flex items-center justify-center" style={TABLE_BG}>
        <div className="w-8 h-8 rounded-full border-2 border-white border-t-transparent animate-spin" />
      </div>
    );
  }

  // ── Win screen ─────────────────────────────────────────────────────────────
  if (game.status === 'finished') {
    const winner = game.players[game.winner ?? ''];
    const iWon = game.winner === myId;
    const winnerIndex = game.playerOrder.indexOf(game.winner ?? '');
    const winnerWins = stats[game.winner ?? '']?.wins ?? 0;
    const winningCard = game.discardPile[game.discardPile.length - 1] ?? null;

    return (
      <div className="h-full flex flex-col items-center justify-center px-5" style={TABLE_BG}>
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          className="text-center w-full max-w-xs"
        >
          <div className="text-7xl mb-4">{iWon ? '🎉' : '😢'}</div>
          <div className="flex justify-center mb-3">
            <PlayerAvatar name={winner?.name ?? '?'} index={winnerIndex} wins={winnerWins} size="lg" />
          </div>
          <h1 className="text-3xl font-black text-white mb-1">
            {iWon ? 'You Win!' : `${winner?.name ?? '?'} Wins!`}
          </h1>

          {/* Winning card */}
          {winningCard && (
            <div className="flex flex-col items-center gap-1.5 my-4">
              <span className="text-white/60 text-xs font-semibold uppercase tracking-wider">
                {iWon ? 'You played' : `${winner?.name ?? '?'} played`}
              </span>
              <motion.div
                initial={{ y: -20, rotate: -12, opacity: 0 }}
                animate={{ y: 0, rotate: 0, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 280, damping: 18, delay: 0.15 }}
              >
                <PlayingCard
                  card={winningCard}
                  size="md"
                  chosenColor={winningCard.type === 'wild8' ? game.currentColor : undefined}
                />
              </motion.div>
            </div>
          )}
          {winnerWins > 0 && (
            <p className="text-yellow-300 font-bold mb-1 text-sm">
              {winnerWins} total win{winnerWins > 1 ? 's' : ''} 🏆
            </p>
          )}

          {/* All player scores */}
          <div className="flex justify-center gap-5 my-6">
            {game.playerOrder.map((pid, i) => (
              <div key={pid} className="flex flex-col items-center gap-1">
                <PlayerAvatar name={game.players[pid]?.name ?? '?'} index={i} wins={stats[pid]?.wins ?? 0} size="sm" />
                <span className="text-white/70 text-[10px]">{game.players[pid]?.name}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-3">
            {game.players[myId]?.isHost ? (
              <button onClick={handleReset} className="w-full py-4 rounded-2xl font-black bg-white text-gray-900 active:scale-95 transition-transform shadow-xl">
                Play Again
              </button>
            ) : (
              <button onClick={() => router.replace(`/lobby/${gameId}`)} className="w-full py-4 rounded-2xl font-black bg-white text-gray-900 active:scale-95 transition-transform shadow-xl">
                Play Again
              </button>
            )}
            <button onClick={() => router.replace('/')} className="w-full py-4 rounded-2xl font-bold border-2 border-white/30 text-white active:scale-95 transition-transform">
              Main Menu
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ── Game board ─────────────────────────────────────────────────────────────
  const currentPlayerId = game.playerOrder[game.currentPlayerIndex];
  const myIndex = game.playerOrder.indexOf(myId);
  const me = game.players[myId];

  // Rotate so my seat is index 0; opponents are in clockwise turn order from me.
  const opponents = myIndex >= 0
    ? [...game.playerOrder.slice(myIndex + 1), ...game.playerOrder.slice(0, myIndex)]
    : game.playerOrder.filter(id => id !== myId);

  const nextPlayerIndex = (game.currentPlayerIndex + game.direction + game.playerOrder.length) % game.playerOrder.length;
  const nextPlayerId = game.playerOrder[nextPlayerIndex];
  const nextPlayerName = game.players[nextPlayerId]?.name ?? '...';
  const currentPlayerName = game.players[currentPlayerId]?.name ?? '...';

  // Felt oval is sized to comfortably contain the center content.
  // Opponents sit on a ring outside it with explicit clearance.
  const cx = tableDims.w / 2;
  const cy = tableDims.h / 2;
  const feltRx = Math.max(tableDims.w * 0.30, 100);  // felt oval half-width
  const feltRy = Math.max(tableDims.h * 0.30, 110);  // felt oval half-height
  const SLOT_CLEAR_X = 44;  // half slot width + gap
  const SLOT_CLEAR_Y = 44;  // half slot height + gap
  const rx = Math.min(feltRx + SLOT_CLEAR_X, tableDims.w / 2 - 32);
  const ry = Math.min(feltRy + SLOT_CLEAR_Y, tableDims.h / 2 - 28);

  const opponentAngles = getOpponentAngles(opponents.length);

  const colorDotStyle: React.CSSProperties = {
    width: 14, height: 14, borderRadius: '50%',
    background: CARD_BG[game.currentColor],
    boxShadow: `0 0 8px ${CARD_BG[game.currentColor]}`,
    flexShrink: 0,
  };

  const twoRowHand = myHand.length >= 8;

  return (
    <div
      className="h-full flex flex-col overflow-hidden relative"
      style={TABLE_BG}
      onClick={() => setSelectedCardId(null)}
    >
      {/* ── Top bar ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 pt-3 flex-shrink-0">
        <div className="bg-black/30 backdrop-blur-sm rounded-full px-3 py-1.5 flex items-center gap-1.5">
          <div style={colorDotStyle} />
          <span className="text-white text-xs font-bold capitalize">{game.currentColor}</span>
          {game.pendingDraw > 0 && (
            <span className="bg-red-800 text-white text-[10px] font-black rounded-full px-1.5 py-0.5 ml-1">
              +{game.pendingDraw}
            </span>
          )}
        </div>
        <div className="bg-black/30 backdrop-blur-sm rounded-full px-3 py-1.5">
          <span className="text-white/70 text-[11px] font-bold tracking-wider">{gameId}</span>
        </div>
      </div>

      {/* ── Toast ───────────────────────────────────────────── */}
      <AnimatePresence>
        {actionMsg && (
          <motion.div
            key={actionMsg}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute top-14 left-4 right-4 z-40 flex justify-center pointer-events-none"
          >
            <div className="bg-black/70 backdrop-blur-sm rounded-full px-4 py-1.5 text-white text-xs font-semibold border border-white/10 max-w-[280px] text-center">
              {actionMsg}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Round table area ─────────────────────────────────── */}
      <div ref={tableRef} className="flex-1 relative min-h-0">

        {/* Oval felt surface — sized from feltRx/feltRy, always inside opponent ring */}
        <div style={{
          position: 'absolute',
          left: '50%', top: '50%',
          transform: 'translate(-50%, -50%)',
          width: feltRx * 2,
          height: feltRy * 2,
          borderRadius: '50%',
          background: 'radial-gradient(ellipse at 40% 35%, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.42) 100%)',
          border: '2.5px solid rgba(255,255,255,0.13)',
          boxShadow: 'inset 0 0 40px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.06)',
          pointerEvents: 'none',
        }} />

        {/* Center: draw + discard + turn info */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <div className="flex items-center gap-5">
            {/* Draw pile */}
            <button
              onClick={isMyTurn ? handleDraw : undefined}
              className={`flex flex-col items-center gap-1 ${isMyTurn ? 'active:scale-95' : ''} transition-transform`}
            >
              <div style={{ position: 'relative' }}>
                <FaceDownCard />
                <div style={{ position: 'absolute', top: -2, left: -2, zIndex: -1, transform: 'scale(0.97)', opacity: 0.6 }}>
                  <FaceDownCard />
                </div>
                <div style={{ position: 'absolute', top: -4, left: -4, zIndex: -2, transform: 'scale(0.94)', opacity: 0.3 }}>
                  <FaceDownCard />
                </div>
                <div style={{
                  position: 'absolute', top: -6, right: -6,
                  background: '#fff', color: '#111', fontSize: 9, fontWeight: 900,
                  borderRadius: '50%', width: 18, height: 18,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
                }}>
                  {game.drawPile.length}
                </div>
              </div>
              {isMyTurn && (
                <span className="text-white/80 text-[10px] font-bold">
                  {game.pendingDraw > 0 ? `Draw +${game.pendingDraw}` : 'Draw'}
                </span>
              )}
            </button>

            {/* Discard pile */}
            <div style={{
              padding: 5, borderRadius: 14,
              background: 'rgba(255,255,255,0.18)',
              boxShadow: '0 0 0 2px rgba(255,255,255,0.55), 0 6px 24px rgba(0,0,0,0.35)',
            }}>
              {topCard ? (
                <motion.div
                  key={topCard.id}
                  initial={{ scale: 0.7, rotate: -8, opacity: 0 }}
                  animate={{ scale: 1, rotate: 0, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                >
                  <PlayingCard card={topCard} size="md" chosenColor={topCard.type === 'wild8' ? game.currentColor : undefined} />
                </motion.div>
              ) : (
                <div style={{ width: 72, height: 104, borderRadius: 10, border: '2px dashed rgba(255,255,255,0.4)' }} />
              )}
            </div>
          </div>

          {/* Turn flow arrow */}
          <motion.div
            key={`${currentPlayerId}-${nextPlayerId}`}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="bg-black/30 backdrop-blur-sm rounded-full px-3 py-1.5 flex items-center gap-1.5"
          >
            <span className={`text-[11px] font-black truncate max-w-[60px] ${currentPlayerId === myId ? 'text-yellow-300' : 'text-white'}`}>
              {currentPlayerId === myId ? 'You' : currentPlayerName}
            </span>
            <span className="text-white/60 text-xs">→</span>
            <span className={`text-[11px] font-black truncate max-w-[60px] ${nextPlayerId === myId ? 'text-yellow-300' : 'text-white/80'}`}>
              {nextPlayerId === myId ? 'You' : nextPlayerName}
            </span>
          </motion.div>

          {/* Turn pill */}
          <div className={`rounded-full px-4 py-1.5 text-xs font-bold text-center max-w-[200px]
            ${isMyTurn ? 'bg-white text-gray-900 shadow-lg' : 'bg-black/40 text-white/80'}`}>
            {isMyTurn
              ? game.pendingDraw > 0 ? `Draw +${game.pendingDraw} or stack a +2/+4` : 'Your turn'
              : `${game.players[currentPlayerId]?.name ?? '...'}'s turn`}
          </div>

          {error && <p className="text-red-300 text-[11px] text-center">{error}</p>}
        </div>

        {/* Opponents around the ellipse */}
        {opponents.map((id, i) => {
          const angleDeg = opponentAngles[i];
          const angleRad = (angleDeg * Math.PI) / 180;
          const x = cx + rx * Math.sin(angleRad);
          const y = cy - ry * Math.cos(angleRad);
          return (
            <div
              key={id}
              style={{
                position: 'absolute',
                left: x,
                top: y,
                transform: 'translate(-50%, -50%)',
                zIndex: 10,
              }}
            >
              <TableOpponent
                player={game.players[id]}
                wins={stats[id]?.wins ?? 0}
                isCurrent={id === currentPlayerId}
                playerIndex={game.playerOrder.indexOf(id)}
                isSkipped={id === skippedPlayerId}
              />
            </div>
          );
        })}
      </div>

      {/* ── My area ─────────────────────────────────────────── */}
      <div className="flex-shrink-0 pb-2">
        <div className="flex justify-center mb-1">
          <div className="flex flex-col items-center gap-0.5 relative">
            <PlayerAvatar
              name={me?.name ?? ''}
              index={myIndex}
              wins={stats[myId]?.wins ?? 0}
              isCurrentTurn={isMyTurn}
              isYou
              size="sm"
            />
            <AnimatePresence>
              {skippedPlayerId === myId && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                  style={{
                    position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
                    width: 34, height: 34, borderRadius: '50%',
                    background: 'rgba(220,38,38,0.65)',
                    border: '2px solid #ef4444',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    pointerEvents: 'none',
                  }}
                >
                  <span style={{ color: '#fff', fontSize: 18, fontWeight: 900, lineHeight: 1 }}>✕</span>
                </motion.div>
              )}
            </AnimatePresence>
            <span className="text-white text-[11px] font-bold drop-shadow">{me?.name}</span>
          </div>
        </div>

        {/* Hand */}
        <div className="overflow-x-auto scrollbar-hide px-3" onClick={e => e.stopPropagation()}>
          {twoRowHand ? (
            <div style={{ display: 'grid', gridTemplateRows: 'repeat(2, auto)', gridAutoFlow: 'column', gap: 6, paddingTop: 32, paddingBottom: 12, width: 'max-content' }}>
              {myHand.map(card => (
                <PlayingCard key={card.id} card={card} playable={playableSet.has(card.id)} selected={selectedCardId === card.id} onClick={() => handleCardTap(card)} size="md" />
              ))}
            </div>
          ) : (
            <div className="flex min-w-max pb-3" style={{ gap: 6, paddingTop: 32 }}>
              {myHand.map(card => (
                <PlayingCard key={card.id} card={card} playable={playableSet.has(card.id)} selected={selectedCardId === card.id} onClick={() => handleCardTap(card)} size="md" />
              ))}
            </div>
          )}
        </div>
      </div>

      <ColorPicker
        open={showColorPicker}
        onSelect={color => { if (selectedCardId) submitPlay(selectedCardId, color); }}
      />
    </div>
  );
}
