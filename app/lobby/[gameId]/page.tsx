'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { subscribeToGame, startGame, removePlayer, updateSettings, setReady } from '@/lib/gameService';
import { Wordmark, Watermark8 } from '@/components/Wordmark';
import type { CardLook, GameMode, GameState, Player } from '@/lib/types';

const LOOKS: CardLook[] = ['solid', 'framed', 'glass'];
const HAND_SIZES = [5, 8, 10];
const MODES: GameMode[] = ['classic', 'quickfire'];

function initials(name: string): string {
  return name.slice(0, 2).toUpperCase();
}

// ─── Seat row (glass card / dashed open seat) ─────────────────────────────────
function SeatRow({
  player,
  isMe,
  canRemove,
  onRemove,
  compact,
}: {
  player: Player | null;
  isMe?: boolean;
  canRemove?: boolean;
  onRemove?: () => void;
  compact?: boolean;
}) {
  const av: React.CSSProperties = {
    width: compact ? 32 : 40,
    height: compact ? 32 : 40,
    flex: 'none',
    borderRadius: compact ? 9 : 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'var(--font-heading)',
    fontWeight: 800,
    fontSize: compact ? 12 : 14,
  };

  if (!player) {
    return (
      <div
        style={{
          padding: compact ? '11px 13px' : '14px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: compact ? 10 : 12,
          border: '1.5px dashed rgba(248,244,244,.25)',
          borderRadius: 12,
          opacity: 0.6,
        }}
      >
        <span style={{ ...av, border: '1.5px dashed rgba(248,244,244,.3)', color: 'color-mix(in srgb,#f4efe7 55%,transparent)' }}>+</span>
        <span className="heading" style={{ fontSize: compact ? 13 : 15, color: 'color-mix(in srgb,#f4efe7 55%,transparent)' }}>
          OPEN SEAT
        </span>
        <span
          style={{
            marginLeft: 'auto',
            fontSize: compact ? 10 : 11,
            letterSpacing: '.08em',
            color: 'color-mix(in srgb,#f4efe7 45%,transparent)',
            fontWeight: 700,
          }}
        >
          WAITING…
        </span>
      </div>
    );
  }

  const ready = player.ready !== false;
  return (
    <div
      className="glass"
      style={{
        padding: compact ? '11px 13px' : '14px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: compact ? 10 : 12,
        opacity: ready ? 1 : 0.65,
      }}
    >
      <span style={{ ...av, background: isMe ? 'var(--color-accent)' : '#3a332c', color: '#f8f4f4' }}>
        {initials(player.name)}
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <span className="heading" style={{ fontSize: compact ? 13 : 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {player.name.toUpperCase()}
        </span>
        <span style={{ fontSize: 11, letterSpacing: '.06em', fontWeight: 700, color: 'color-mix(in srgb,#f4efe7 60%,transparent)' }}>
          {ready ? 'READY' : 'NOT READY'}
        </span>
      </div>
      <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
        {player.isHost && <span className="tag tag-accent">HOST</span>}
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="btn btn-ghost"
            style={{ padding: '2px 6px', color: 'var(--color-accent)', fontSize: 14 }}
            aria-label={`Remove ${player.name}`}
          >
            ✕
          </button>
        )}
      </span>
    </div>
  );
}

// ─── Segmented control row ────────────────────────────────────────────────────
function Seg<T extends string | number>({
  options,
  value,
  onChange,
  disabled,
  format,
}: {
  options: T[];
  value: T;
  onChange: (v: T) => void;
  disabled?: boolean;
  format?: (v: T) => string;
}) {
  return (
    <div className="seg">
      {options.map(opt => (
        <button
          key={String(opt)}
          type="button"
          disabled={disabled}
          className={opt === value ? 'seg-active' : undefined}
          onClick={() => onChange(opt)}
        >
          {format ? format(opt) : String(opt)}
        </button>
      ))}
    </div>
  );
}

export default function LobbyPage() {
  const { gameId } = useParams<{ gameId: string }>();
  const router = useRouter();
  const [game, setGame] = useState<GameState | null>(null);
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

  async function handleRemove(targetId: string) {
    try { await removePlayer(gameId, myId, targetId); }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to remove player'); }
  }

  async function handleStart() {
    setStarting(true); setError('');
    try {
      await startGame(gameId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start');
      setStarting(false);
    }
  }

  async function handleSetting(partial: Parameters<typeof updateSettings>[2]) {
    setError('');
    try { await updateSettings(gameId, myId, partial); }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to update settings'); }
  }

  async function handleToggleReady() {
    if (!game) return;
    const ready = game.players[myId]?.ready !== false;
    try { await setReady(gameId, myId, !ready); } catch { /* best-effort */ }
  }

  function copyCode() {
    navigator.clipboard.writeText(gameId).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!game) {
    return (
      <div className="h-full flex items-center justify-center">
        <div
          className="w-8 h-8 rounded-full border-2 animate-spin"
          style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }}
        />
      </div>
    );
  }

  const isHost = game.players[myId]?.isHost ?? false;
  const iAmReady = game.players[myId]?.ready !== false;
  const maxPlayers = game.maxPlayers ?? 8;
  const cardLook = game.cardLook ?? 'solid';
  const startingHand = game.startingHand ?? 8;
  const gameMode = game.gameMode ?? 'classic';
  const playerList = game.playerOrder.map(id => game.players[id]).filter(Boolean);
  const canStart = isHost && playerList.length >= 2;

  const seats: (Player | null)[] = Array.from(
    { length: maxPlayers },
    (_, i) => playerList[i] ?? null,
  );

  const settingsFields = (compact: boolean) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 10 : 16 }}>
      <div>
        <label className="field-label">PLAYERS</label>
        <Seg
          options={[2, 3, 4, 5, 6, 7, 8]}
          value={maxPlayers}
          disabled={!isHost}
          onChange={v => handleSetting({ maxPlayers: v })}
        />
      </div>
      <div>
        <label className="field-label">GAME MODE</label>
        <Seg
          options={MODES}
          value={gameMode}
          disabled={!isHost}
          onChange={v => handleSetting({ gameMode: v })}
          format={v => (v === 'quickfire' ? '⚡ QUICK FIRE' : 'CLASSIC')}
        />
        {gameMode === 'quickfire' && (
          <p className="text-muted" style={{ fontSize: 12, marginTop: 6, marginBottom: 0 }}>
            6 seconds to act on your turn — run out and you draw and the turn moves on.
          </p>
        )}
      </div>
      <div>
        <label className="field-label">CARD LOOK</label>
        <Seg
          options={LOOKS}
          value={cardLook}
          disabled={!isHost}
          onChange={v => handleSetting({ cardLook: v })}
          format={v => v.toUpperCase()}
        />
      </div>
      <div>
        <label className="field-label">STARTING HAND</label>
        <Seg
          options={HAND_SIZES}
          value={startingHand}
          disabled={!isHost}
          onChange={v => handleSetting({ startingHand: v })}
        />
      </div>
    </div>
  );

  const readyToggle = (
    <button
      type="button"
      onClick={handleToggleReady}
      className="btn btn-secondary btn-block"
      style={{ justifyContent: 'space-between', padding: '13px 16px', fontSize: 13 }}
    >
      <span>{iAmReady ? "YOU'RE READY" : 'MARK READY'}</span>
      <span style={{ color: 'var(--color-accent)' }}>{iAmReady ? '✓' : ''}</span>
    </button>
  );

  const startButton = (
    <button
      type="button"
      className="btn btn-primary btn-block"
      onClick={handleStart}
      disabled={!canStart || starting}
      style={{ padding: '15px 16px', fontSize: 15 }}
    >
      <span style={{ flex: 1, textAlign: 'left' }}>
        {starting ? 'STARTING…' : isHost ? 'START GAME' : 'HOST STARTS THE GAME'}
      </span>
      <span>▸</span>
    </button>
  );

  return (
    <div className="h-full relative overflow-hidden">
      <Watermark8 />

      {/* ─── Desktop lobby ────────────────────────────────────────── */}
      <div className="hidden lg:flex absolute inset-0 flex-col">
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
          <span className="tag tag-neutral">LOBBY</span>
          <button type="button" className="btn btn-ghost" onClick={() => router.push('/')} style={{ marginLeft: 'auto' }}>
            ← LEAVE
          </button>
        </div>

        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '340px 1fr', minHeight: 0 }}>
          {/* Settings rail */}
          <div
            style={{
              padding: 32,
              borderRight: '2px solid var(--color-divider)',
              display: 'flex',
              flexDirection: 'column',
              gap: 22,
              overflow: 'auto',
            }}
          >
            <div>
              <div className="field-label">Room code</div>
              <button
                type="button"
                onClick={copyCode}
                style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', color: 'inherit', textAlign: 'left' }}
              >
                <div className="heading" style={{ fontSize: 52, letterSpacing: '.04em', lineHeight: 1 }}>{gameId}</div>
              </button>
              <p className="text-muted" style={{ fontSize: 13, marginTop: 6 }}>
                {copied ? '✓ Copied to clipboard.' : 'Share this code — anyone can drop in until you start.'}
              </p>
            </div>
            <hr className="hr" style={{ margin: 0 }} />
            {settingsFields(false)}
            <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {error && <p style={{ color: 'var(--color-accent)', fontSize: 13, margin: 0 }}>{error}</p>}
              {readyToggle}
              {startButton}
            </div>
          </div>

          {/* Seats grid */}
          <div style={{ padding: '32px 40px', overflow: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 20 }}>
              <h4 className="heading" style={{ margin: 0, fontSize: 22 }}>Players</h4>
              <span className="text-muted" style={{ fontSize: 13 }}>
                {playerList.length} / {maxPlayers} seated
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {seats.map((p, i) => (
                <SeatRow
                  key={p?.id ?? `open-${i}`}
                  player={p}
                  isMe={p?.id === myId}
                  canRemove={isHost && !!p && p.id !== myId}
                  onRemove={p ? () => handleRemove(p.id) : undefined}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Mobile lobby ─────────────────────────────────────────── */}
      <div className="lg:hidden absolute inset-0 flex flex-col" style={{ padding: '28px 26px 44px', gap: 16, overflow: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Wordmark size={16} />
          <button type="button" className="btn btn-ghost" onClick={() => router.push('/')} style={{ marginLeft: 'auto' }}>
            ← LEAVE
          </button>
        </div>
        <div>
          <span className="field-label" style={{ marginBottom: 0 }}>Room code</span>
          <button
            type="button"
            onClick={copyCode}
            style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', color: 'inherit', textAlign: 'left' }}
          >
            <div className="heading" style={{ fontSize: 44, lineHeight: 1, letterSpacing: '.05em' }}>{gameId}</div>
          </button>
          <p className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>
            {copied ? '✓ Copied to clipboard.' : 'Tap to copy · share with friends.'}
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {seats.map((p, i) => (
            <SeatRow
              key={p?.id ?? `open-${i}`}
              player={p}
              isMe={p?.id === myId}
              canRemove={isHost && !!p && p.id !== myId}
              onRemove={p ? () => handleRemove(p.id) : undefined}
              compact
            />
          ))}
        </div>
        {settingsFields(true)}
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 8 }}>
          {error && <p style={{ color: 'var(--color-accent)', fontSize: 13, margin: 0, textAlign: 'center' }}>{error}</p>}
          {readyToggle}
          {startButton}
        </div>
      </div>
    </div>
  );
}
