'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';

type Position = 'GK' | 'DEF' | 'MID' | 'FWD';
type Department =
  | 'Statistics'
  | 'Chemistry'
  | 'Mathematics'
  | 'Physics'
  | 'Geosciences'
  | 'Environmental Standards';
type Formation = '4-4-2' | '4-3-3' | '3-5-2' | '3-4-3' | '5-3-2';
type PageTab = 'squad' | 'transfers' | 'points';
type InteractionMode = 'building' | 'swapping' | 'locked' | 'freeTransfer';

interface Player { 
  id: string; 
  name: string; 
  jersey_name?: string; 
  number?: number; 
  position: Position; 
  department: Department; 
  price: number; 
}
interface SelectedPlayer extends Player { slot: number; isBench: boolean; }

const FORMATIONS: Record<Formation, { GK: number; DEF: number; MID: number; FWD: number }> = {
  '4-4-2': { GK: 1, DEF: 4, MID: 4, FWD: 2 },
  '4-3-3': { GK: 1, DEF: 4, MID: 3, FWD: 3 },
  '3-5-2': { GK: 1, DEF: 3, MID: 5, FWD: 2 },
  '3-4-3': { GK: 1, DEF: 3, MID: 4, FWD: 3 },
  '5-3-2': { GK: 1, DEF: 5, MID: 3, FWD: 2 },
};

const BUDGET_CAP = 100.0;
const MIN_PLAYER_PRICE = 4.0;
const MAX_PER_DEPT = 4;
const MAX_TRANSFERS = 5;

const POS_COLOR_MAP: Record<string, string> = { GK: '#f59e0b', DEF: '#3b82f6', MID: '#10b981', FWD: '#ef4444' };

const DEPT_COLORS: Record<string, { shirt: string; sleeve: string; collar: string; patternColor: string }> = {
  'Statistics': { shirt: '#FF0000', sleeve: '#B30000', collar: '#000000', patternColor: '#000000' },
  'Chemistry': { shirt: '#E8F5E9', sleeve: '#C8E6C9', collar: '#00C853', patternColor: '#00C853' },
  'Mathematics': { shirt: '#2962FF', sleeve: '#1E3A8A', collar: '#FFFFFF', patternColor: '#FFFFFF' },
  'Physics': { shirt: '#0A192F', sleeve: '#020813', collar: '#00E5FF', patternColor: '#00E5FF' },
  'Geosciences': { shirt: '#D84315', sleeve: '#A1320E', collar: '#263238', patternColor: '#263238' },
  'Environmental Standards': { shirt: '#1B4D3E', sleeve: '#102B23', collar: '#1A1A1A', patternColor: '#1A1A1A' },
};

function deptCount(players: SelectedPlayer[], dept: string) {
  return players.filter(p => p.department === dept).length;
}

// ─── REVAMPED JERSEY WITH DISTINCT PATTERNS AND NUMBER ────────────────
function Jersey({ dept, isGK, isCaptain, isVice, isSelected, size = 72, number }: {
  dept: string; isGK?: boolean; isCaptain?: boolean; isVice?: boolean; isSelected?: boolean; size?: number; number?: number;
}) {
  const c = DEPT_COLORS[dept] || { shirt: '#555', sleeve: '#333', collar: '#fff', patternColor: '#fff' };
  const shirtColor = isGK ? '#3d9970' : c.shirt;
  const sleeveColor = isGK ? '#2ecc71' : c.sleeve;
  const patternColor = c.patternColor;

  const renderPattern = () => {
    switch (dept) {
      case 'Statistics': return <path d="M40 14 Q40 40 40 68 L60 68 Q60 40 40 14 Z" fill={patternColor} opacity="0.9" />;
      case 'Chemistry': {
        const stripes = [];
        for (let x = 25; x <= 55; x += 8) {
          stripes.push(<rect key={x} x={x} y="18" width="3" height="50" fill={patternColor} opacity="0.7" />);
        }
        return <>{stripes}</>;
      }
      case 'Mathematics': {
        const hoops = [];
        for (let y = 25; y <= 55; y += 10) {
          hoops.push(<path key={y} d={`M20 ${y} L60 ${y}`} stroke={patternColor} strokeWidth="5" opacity="0.8" />);
        }
        return <>{hoops}</>;
      }
      case 'Physics': {
        return <path d="M12 14 Q40 40 68 68" stroke={patternColor} strokeWidth="8" fill="none" opacity="0.9" strokeLinecap="round" />;
      }
      case 'Geosciences': {
        return (
          <>
            <polygon points="20,30 30,22 40,30 30,38" fill={patternColor} opacity="0.5" />
            <polygon points="40,30 50,22 60,30 50,38" fill={patternColor} opacity="0.5" />
            <polygon points="30,40 40,32 50,40 40,48" fill={patternColor} opacity="0.5" />
            <polygon points="20,48 30,40 40,48 30,56" fill={patternColor} opacity="0.5" />
          </>
        );
      }
      case 'Environmental Standards': {
        return (
          <>
            <path d="M8 40 Q30 30 40 60 Q20 70 8 50 Z" fill={patternColor} opacity="0.45" />
            <path d="M40 20 Q60 10 70 40 Q55 60 45 30 Z" fill={patternColor} opacity="0.45" />
            <path d="M25 55 Q40 70 55 55 L45 68 Z" fill={patternColor} opacity="0.3" />
          </>
        );
      }
      default: return null;
    }
  };

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      {isSelected && <div className="absolute inset-0 rounded-full animate-ping opacity-30" style={{ background: '#fbbf24' }} />}
      <svg width={size} height={size} viewBox="0 0 80 80" fill="none" className="drop-shadow-lg">
        <ellipse cx="40" cy="72" rx="22" ry="4" fill="rgba(0,0,0,0.3)" />
        <path d="M8 24 L20 18 L24 34 L12 38 Z" fill={sleeveColor} stroke="rgba(0,0,0,0.15)" strokeWidth="0.5" />
        <path d="M72 24 L60 18 L56 34 L68 38 Z" fill={sleeveColor} stroke="rgba(0,0,0,0.15)" strokeWidth="0.5" />
        <path d="M20 18 L20 68 L60 68 L60 18 L52 14 C50 20 45 23 40 23 C35 23 30 20 28 14 Z" fill={shirtColor} stroke="rgba(0,0,0,0.15)" strokeWidth="0.5" />
        <g clipPath="url(#shirtClip)">{renderPattern()}</g>
        <path d="M26 20 Q30 18 34 18 L34 32 Q30 32 26 34 Z" fill="rgba(255,255,255,0.12)" />
        <path d="M10 26 L18 22 L20 28 L12 32 Z" fill="rgba(255,255,255,0.1)" />
        <path d="M70 26 L62 22 L60 28 L68 32 Z" fill="rgba(255,255,255,0.1)" />
        <path d="M34 14 Q40 10 46 14 Q44 20 40 21 Q36 20 34 14 Z" fill={c.collar} opacity="0.9" />
        {isGK && (
          <>
            <rect x="6" y="36" width="8" height="6" rx="2" fill="#e67e22" opacity="0.9" />
            <rect x="66" y="36" width="8" height="6" rx="2" fill="#e67e22" opacity="0.9" />
          </>
        )}
        {/* JERSEY NUMBER ON THE BACK (displayed on front for visual) */}
{number && number > 0 && (
  <text x="40" y="50" textAnchor="middle" fontSize="18" fontWeight="900" fill="white" opacity="0.9" style={{ filter: 'drop-shadow(0 0 4px rgba(0,0,0,0.8))' }}>{number}</text>
)}
        {isCaptain && (
          <>
            <circle cx="58" cy="24" r="8" fill="#fbbf24" stroke="white" strokeWidth="1.5" />
            <text x="58" y="28.5" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#000">C</text>
          </>
        )}
        {isVice && !isCaptain && (
          <>
            <circle cx="58" cy="24" r="8" fill="#9ca3af" stroke="white" strokeWidth="1.5" />
            <text x="58" y="28.5" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#000">V</text>
          </>
        )}
        {isSelected && (
          <path d="M20 18 L20 68 L60 68 L60 18 L52 14 C50 20 45 23 40 23 C35 23 30 20 28 14 Z" fill="none" stroke="#fbbf24" strokeWidth="3" opacity="0.9" />
        )}
        <defs>
          <clipPath id="shirtClip">
            <path d="M20 18 L20 68 L60 68 L60 18 L52 14 C50 20 45 23 40 23 C35 23 30 20 28 14 Z" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}

// ─── PLAYER CARD ─────────────────────────────────────────────────────────────
function PlayerCard({ player, isCaptain, isVice, isBench, isSelected, mode, gwPoints, isGameweekActive, transferWindowOpen,
  onTap, onCaptain, onVice, onSell }: {
  player: SelectedPlayer; isCaptain: boolean; isVice: boolean; isBench: boolean;
  isSelected: boolean; mode: InteractionMode; gwPoints?: number; isGameweekActive: boolean;
  transferWindowOpen: boolean;
  onTap: () => void; onCaptain: () => void; onVice: () => void; onSell: () => void;
}) {
  const displayName = player.jersey_name || player.name.length > 9 ? player.name.split(' ').pop()! : player.name;
  const showPoints = isGameweekActive;
  const pts = gwPoints ?? 0;
  const displayPts = isCaptain ? pts * 2 : pts;
  const canAct = mode !== 'locked';
  const showSell = (mode === 'swapping' || mode === 'freeTransfer') && !isSelected && transferWindowOpen;
  const jerseySize = isBench ? 60 : 72;

  return (
    <div className={`flex flex-col items-center relative select-none transition-all duration-300 ${isSelected ? 'scale-110 z-10' : 'hover:scale-105'}`} style={{ minWidth: isBench ? 64 : 72 }}>
      {showSell && (
        <button onClick={e => { e.stopPropagation(); onSell(); }}
          className="absolute -top-1 -right-1 z-20 w-6 h-6 rounded-full bg-red-500 text-white text-xs font-black flex items-center justify-center shadow-lg hover:bg-red-400 hover:shadow-red-500/50 transition-all transform hover:scale-110">
          ×
        </button>
      )}

      <div onClick={canAct ? onTap : undefined} className={`transition-all duration-300 ${canAct ? 'cursor-pointer active:scale-95' : 'cursor-default'} ${isSelected ? 'ring-4 ring-yellow-400/50 rounded-full' : ''}`}>
        <Jersey dept={player.department} isGK={player.position === 'GK'} isCaptain={isCaptain} isVice={isVice} isSelected={isSelected} size={jerseySize} number={player.number} />
      </div>

      <div className={`mt-1 rounded-lg px-2 py-1 text-center w-full max-w-[80px] backdrop-blur-md transition-all duration-300 ${isSelected ? 'bg-yellow-400/30 border-yellow-400 shadow-lg shadow-yellow-400/20' : 'bg-blue-950/80 border-blue-500/10'}`}
        style={{ border: isSelected ? '1px solid #fbbf24' : '1px solid rgba(255,255,255,0.08)' }}>
        <p className="text-white font-black text-[11px] truncate leading-tight">{displayName}</p>
        {showPoints
          ? <p className={`text-[10px] font-black ${displayPts > 0 ? 'text-yellow-400' : 'text-white/40'}`}>{displayPts} pts</p>
          : <p className="text-[10px] font-semibold text-yellow-400">£{player.price.toFixed(1)}m</p>
        }
      </div>

      {!isBench && (
        <div className="flex gap-1.5 mt-1">
          <button onClick={e => { e.stopPropagation(); onCaptain(); }}
            className={`text-[9px] font-black px-2 py-0.5 rounded-full transition-all duration-300 border ${
              isCaptain
                ? 'bg-yellow-400 text-black border-yellow-400 shadow-md shadow-yellow-400/30'
                : 'bg-white/5 text-white/40 border-white/10 hover:bg-yellow-400/20 hover:text-yellow-300 hover:border-yellow-400/40'
            }`}>
            {isCaptain ? '★ C' : 'C'}
          </button>
          <button onClick={e => { e.stopPropagation(); onVice(); }}
            className={`text-[9px] font-black px-2 py-0.5 rounded-full transition-all duration-300 border ${
              isVice
                ? 'bg-gray-400 text-black border-gray-400 shadow-md shadow-gray-400/30'
                : 'bg-white/5 text-white/40 border-white/10 hover:bg-gray-400/20 hover:text-gray-300 hover:border-gray-400/40'
            }`}>
            {isVice ? '★ V' : 'V'}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── EMPTY SLOT ──────────────────────────────────────────────────────────────
function EmptySlot({ position, onClick, disabled, size = 72, transferWindowOpen, interactionMode }: {
  position: Position; onClick: () => void; disabled?: boolean; size?: number;
  transferWindowOpen: boolean; interactionMode: InteractionMode;
}) {
  const isDisabled = disabled || (interactionMode === 'swapping' && !transferWindowOpen);
  return (
    <button onClick={isDisabled ? undefined : onClick} disabled={isDisabled}
      className={`flex flex-col items-center gap-1 group transition-all duration-300 ${isDisabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer hover:scale-110'}`}
      style={{ minWidth: size }}>
      <div className={`rounded-2xl border-2 border-dashed flex flex-col items-center justify-center transition-all duration-300 ${isDisabled ? 'border-white/10 bg-transparent' : 'border-blue-200/30 bg-white/5 hover:bg-white/10 hover:border-yellow-400/50 group-hover:shadow-lg group-hover:shadow-yellow-400/20'}`}
        style={{ width: size, height: size }}>
        <span className={`text-3xl font-light transition-colors ${isDisabled ? 'text-white/20' : 'text-white/50 group-hover:text-yellow-400'}`}>+</span>
        <span className={`text-[9px] font-black uppercase tracking-widest ${isDisabled ? 'text-white/20' : 'text-white/40 group-hover:text-yellow-300'}`}>{position}</span>
      </div>
    </button>
  );
}

// ─── MAIN PAGE ──────────────────────────────────────────────────────────────
export default function TeamPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [pageTab, setPageTab] = useState<PageTab>('squad');
  const [formation, setFormation] = useState<Formation>('4-4-2');
  const [selectedPlayers, setSelectedPlayers] = useState<SelectedPlayer[]>([]);
  const [captainId, setCaptainId] = useState<string | null>(null);
  const [viceCaptainId, setViceCaptainId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentSlot, setCurrentSlot] = useState<{ slot: number; position: Position; isBench: boolean } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [transferWindowOpen, setTransferWindowOpen] = useState(false);
  const [freeTransfers, setFreeTransfers] = useState(false);
  const [isAutoPicking, setIsAutoPicking] = useState(false);
  const [selectedForSwap, setSelectedForSwap] = useState<SelectedPlayer | null>(null);
  const [showTransferConfirm, setShowTransferConfirm] = useState(false);
  const [popupPlayer, setPopupPlayer] = useState<SelectedPlayer | null>(null);

  const [freeTransfersAvailable, setFreeTransfersAvailable] = useState(1);
  const [transfersThisWindow, setTransfersThisWindow] = useState(0);
  const [originalPlayers, setOriginalPlayers] = useState<SelectedPlayer[]>([]);

  const [gwPoints, setGwPoints] = useState<Record<string, number>>({});
  const [teamGwPoints, setTeamGwPoints] = useState(0);
  const [teamTotalPoints, setTeamTotalPoints] = useState(0);
  const [currentGw, setCurrentGw] = useState(1);
  const [isGameweekActive, setIsGameweekActive] = useState(false);
  const [gwRank, setGwRank] = useState<number | null>(null);

  const [allPlayers, setAllPlayers] = useState<Player[]>([]);

  const supabase = createClient();

  // Helper to sync squad prices with latest player list (called on load, realtime, and polling)
  const syncSquadPrices = useCallback((latestPlayers: Player[]) => {
    setAllPlayers(latestPlayers);
    setSelectedPlayers(prev =>
      prev.map(player => {
        const updated = latestPlayers.find(p => p.id === player.id);
        return updated ? { ...player, price: updated.price } : player;
      })
    );
    setOriginalPlayers(prev =>
      prev.map(player => {
        const updated = latestPlayers.find(p => p.id === player.id);
        return updated ? { ...player, price: updated.price } : player;
      })
    );
    console.log('✅ Squad prices synced');
  }, []);

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      if (session?.user) {
        const { data: team } = await supabase.from('user_teams').select('*').eq('user_id', session.user.id).single();
        if (team) {
          setFormation(team.formation || '4-4-2');
          setSelectedPlayers(team.players || []);
          setOriginalPlayers(team.players || []);
          setCaptainId(team.captain_id || null);
          setViceCaptainId(team.vice_captain_id || null);
          setIsLocked(team.transfer_locked ?? false);
          setTeamGwPoints(team.gw_points || 0);
          setTeamTotalPoints(team.total_points || 0);
          setFreeTransfersAvailable(team.free_transfers_available ?? 1);
          setTransfersThisWindow(team.transfers_this_window ?? 0);
        }
      }
      const { data: tw } = await supabase.from('transfer_window').select('*').eq('id', 1).single();
      if (tw) {
        setTransferWindowOpen(tw.is_open ?? false);
        setCurrentGw(tw.gameweek || 1);
        setIsGameweekActive(tw.gameweek_locked ?? false);
        setFreeTransfers(tw.free_transfers ?? false);
      }

      // Fetch all players from the database
      const { data: dbPlayers } = await supabase
        .from('player_prices')
        .select('id, name, jersey_name, number, position, department, price')
        .order('price', { ascending: false });

      if (dbPlayers) {
        const mapped: Player[] = dbPlayers.map((p: any) => ({
          id: p.id,
          name: p.name,
          jersey_name: p.jersey_name,
          number: p.number,
          position: p.position as Position,
          department: p.department as Department,
          price: p.price,
        }));
        syncSquadPrices(mapped);
      }
    };
    load();

    // Real‑time: update players when admin changes a price
    const priceSub = supabase
      .channel('team-price-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'player_prices' }, () => {
        console.log('🔥 Realtime player_prices change detected');
        supabase
          .from('player_prices')
          .select('id, name, jersey_name, number, position, department, price')
          .order('price', { ascending: false })
          .then(({ data }) => {
            if (data) {
              const mapped: Player[] = data.map((p: any) => ({
                id: p.id,
                name: p.name,
                jersey_name: p.jersey_name,
                number: p.number,
                position: p.position as Position,
                department: p.department as Department,
                price: p.price,
              }));
              syncSquadPrices(mapped);
            }
          });
      })
      .subscribe();

    // Fallback polling every 10 seconds
    const interval = setInterval(() => {
      supabase
        .from('player_prices')
        .select('id, name, jersey_name, number, position, department, price')
        .order('price', { ascending: false })
        .then(({ data }) => {
          if (data) {
            const mapped: Player[] = data.map((p: any) => ({
              id: p.id,
              name: p.name,
              jersey_name: p.jersey_name,
              number: p.number,
              position: p.position as Position,
              department: p.department as Department,
              price: p.price,
            }));
            syncSquadPrices(mapped);
          }
        });
    }, 10000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => setUser(s?.user ?? null));
    return () => {
      subscription.unsubscribe();
      supabase.removeChannel(priceSub);
      clearInterval(interval);
    };
  }, [syncSquadPrices]);

  // Load GW points
  useEffect(() => {
    if (selectedPlayers.length === 0) return;
    const loadPts = async () => {
      const { data: tw } = await supabase.from('transfer_window').select('gameweek, gameweek_locked').eq('id', 1).single();
      const gwActive = tw?.gameweek_locked ?? false;
      const gw = tw?.gameweek || 1;
      setIsGameweekActive(gwActive);
      setCurrentGw(gw);
      if (!gwActive) return;

      const { data } = await supabase.from('player_gameweek_points')
        .select('player_name, total_points')
        .in('player_name', selectedPlayers.map(p => p.name))
        .eq('gameweek', gw);
      if (data) {
        const map: Record<string, number> = {};
        data.forEach((r: any) => { map[r.player_name] = r.total_points || 0; });
        setGwPoints(map);
      }
    };
    loadPts();
    const sub = supabase.channel('team-pts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'player_gameweek_points' }, loadPts)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_teams' }, async () => {
        if (!user) return;
        const { data: t } = await supabase.from('user_teams').select('gw_points,total_points').eq('user_id', user.id).single();
        if (t) { setTeamGwPoints(t.gw_points || 0); setTeamTotalPoints(t.total_points || 0); }
      })
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [selectedPlayers.length, isGameweekActive]);

  useEffect(() => {
    if (!user || !isGameweekActive) return;
    const calc = async () => {
      const { data } = await supabase.from('user_teams').select('user_id,gw_points').order('gw_points', { ascending: false });
      if (data) { const i = data.findIndex((t: any) => t.user_id === user.id); setGwRank(i >= 0 ? i + 1 : null); }
    };
    calc();
  }, [user, isGameweekActive, teamGwPoints]);

  const formationConfig = FORMATIONS[formation];
  const startingPlayers = selectedPlayers.filter(p => !p.isBench);
  const benchPlayers = selectedPlayers.filter(p => p.isBench);
  const totalSpent = useMemo(() => selectedPlayers.reduce((s, p) => s + p.price, 0), [selectedPlayers]);
  const remainingBudget = BUDGET_CAP - totalSpent;

  const deptUsage = useMemo(() => {
    const m: Record<string, number> = {};
    selectedPlayers.forEach(p => { m[p.department] = (m[p.department] || 0) + 1; });
    return m;
  }, [selectedPlayers]);

  const validation = useMemo(() => {
    if (startingPlayers.length !== 11) return { valid: false, message: `Need 11 starters (${startingPlayers.length}/11)` };
    if (benchPlayers.length !== 4)     return { valid: false, message: `Need 4 bench (${benchPlayers.length}/4)` };
    if (!captainId)                    return { valid: false, message: 'Tap C under a player to set captain' };
    if (totalSpent > BUDGET_CAP)       return { valid: false, message: 'Over budget!' };
    const over = Object.entries(deptUsage).find(([, c]) => c > MAX_PER_DEPT);
    if (over) return { valid: false, message: `Max ${MAX_PER_DEPT} from ${over[0]}` };
    return { valid: true, message: '' };
  }, [startingPlayers.length, benchPlayers.length, captainId, totalSpent, deptUsage]);

  const interactionMode: InteractionMode = useMemo(() => {
    if (freeTransfers) return 'freeTransfer';
    if (!isLocked) return 'building';
    if (isGameweekActive) return 'locked';
    return 'swapping';
  }, [freeTransfers, isLocked, isGameweekActive]);

  const newPlayers = useMemo(() => {
    if (interactionMode === 'building' || interactionMode === 'freeTransfer') return [];
    const ids = new Set(originalPlayers.map(p => p.id));
    return selectedPlayers.filter(p => !ids.has(p.id));
  }, [selectedPlayers, originalPlayers, interactionMode]);
  const transfersUsed = newPlayers.length;
  const transfersRemaining = MAX_TRANSFERS - transfersThisWindow;
  const overLimit = transfersThisWindow + transfersUsed > MAX_TRANSFERS;
  const freeUsed = Math.min(transfersUsed, freeTransfersAvailable);
  const paidTransfers = Math.max(0, transfersUsed - freeUsed);
  const pointCost = paidTransfers * 4;

  const handleFormationChange = async (f: Formation) => {
    if (isGameweekActive && !freeTransfers) return;
    if (isLocked && !transferWindowOpen && !freeTransfers) return;
    const nc = FORMATIONS[f], oc = FORMATIONS[formation];
    let updated = [...selectedPlayers];
    (['GK','DEF','MID','FWD'] as Position[]).forEach(pos => {
      if (nc[pos] < oc[pos]) {
        const starters = updated.filter(p => p.position === pos && !p.isBench).sort((a,b) => b.slot - a.slot);
        const toRemove = starters.slice(0, oc[pos] - nc[pos]).map(p => p.id);
        updated = updated.filter(p => !toRemove.includes(p.id));
      }
    });
    const reSlotted: SelectedPlayer[] = [];
    const bench = updated.filter(p => p.isBench);
    const starters = updated.filter(p => !p.isBench);
    (['FWD','MID','DEF','GK'] as Position[]).forEach((pos, pi) => {
      const posPlayers = starters.filter(p => p.position === pos);
      const startSlot = pi === 0 ? 0 : pi === 1 ? nc.FWD : pi === 2 ? nc.FWD + nc.MID : nc.FWD + nc.MID + nc.DEF;
      posPlayers.forEach((p, i) => reSlotted.push({ ...p, slot: startSlot + i }));
    });
    bench.forEach((p, i) => reSlotted.push({ ...p, slot: i, isBench: true }));
    setFormation(f);
    setSelectedPlayers(reSlotted);
    if (isLocked && user) {
      await supabase.from('user_teams').update({
        formation: f,
        players: reSlotted,
      }).eq('user_id', user.id);
    }
  };

  const autoPick = useCallback(() => {
    if (allPlayers.length === 0) {
      setSaveMessage({ type: 'error', text: 'No players loaded yet' });
      setTimeout(() => setSaveMessage(null), 3000);
      return;
    }
    setIsAutoPicking(true);
    const config = FORMATIONS[formation];
    const picked: SelectedPlayer[] = [];
    const usedIds = new Set<string>();
    const deptCounts: Record<string, number> = {};
    const plan: { pos: Position; isBench: boolean }[] = [
      ...Array(config.GK).fill(null).map(() => ({ pos: 'GK' as Position, isBench: false })),
      ...Array(config.DEF).fill(null).map(() => ({ pos: 'DEF' as Position, isBench: false })),
      ...Array(config.MID).fill(null).map(() => ({ pos: 'MID' as Position, isBench: false })),
      ...Array(config.FWD).fill(null).map(() => ({ pos: 'FWD' as Position, isBench: false })),
      { pos: 'GK' as Position, isBench: true },
      { pos: 'DEF' as Position, isBench: true },
      { pos: 'MID' as Position, isBench: true },
      { pos: 'FWD' as Position, isBench: true },
    ];
    let budgetLeft = BUDGET_CAP;
    for (let i = 0; i < plan.length; i++) {
      const { pos, isBench } = plan[i];
      const slotsAfter = 15 - picked.length - 1;
      const maxHere = budgetLeft - slotsAfter * MIN_PLAYER_PRICE;
      let pool = allPlayers.filter(p => p.position === pos && !usedIds.has(p.id) && p.price <= maxHere && (deptCounts[p.department] || 0) < MAX_PER_DEPT).sort((a,b) => b.price - a.price);
      if (pool.length === 0) pool = allPlayers.filter(p => p.position === pos && !usedIds.has(p.id) && (deptCounts[p.department] || 0) < MAX_PER_DEPT).sort((a,b) => a.price - b.price);
      if (pool.length === 0) continue;
      const choice = pool[Math.floor(Math.random() * Math.min(pool.length, 3))];
      let slotIdx: number;
      if (isBench) { slotIdx = picked.filter(x => x.isBench).length; }
      else {
        const spc = picked.filter(x => !x.isBench && x.position === pos).length;
        if (pos === 'FWD') slotIdx = spc;
        else if (pos === 'MID') slotIdx = config.FWD + spc;
        else if (pos === 'DEF') slotIdx = config.FWD + config.MID + spc;
        else slotIdx = config.FWD + config.MID + config.DEF + spc;
      }
      picked.push({ ...choice, slot: slotIdx, isBench });
      usedIds.add(choice.id);
      deptCounts[choice.department] = (deptCounts[choice.department] || 0) + 1;
      budgetLeft -= choice.price;
    }
    if (picked.length === 15) {
      setSelectedPlayers(picked);
      const cap = picked.filter(p => !p.isBench && (p.position === 'FWD' || p.position === 'MID')).sort((a,b) => b.price - a.price);
      if (cap[0]) setCaptainId(cap[0].id);
      if (cap[1]) setViceCaptainId(cap[1].id);
      const spent = picked.reduce((s,p) => s + p.price, 0);
      setSaveMessage({ type: 'success', text: `Auto-pick done · £${spent.toFixed(1)}m used` });
    } else {
      setSaveMessage({ type: 'error', text: 'Auto-pick failed — try again' });
    }
    setIsAutoPicking(false);
    setTimeout(() => setSaveMessage(null), 4000);
  }, [formation, allPlayers]);

  const handleSetCaptain = (player: SelectedPlayer) => {
    if (isGameweekActive && !freeTransfers) return;
    let newCap = captainId;
    let newVice = viceCaptainId;
    if (captainId === player.id) { newCap = null; }
    else { if (viceCaptainId === player.id) newVice = null; newCap = player.id; }
    setCaptainId(newCap);
    setViceCaptainId(newVice);
  };

  const handleSetVice = (player: SelectedPlayer) => {
    if (isGameweekActive && !freeTransfers) return;
    let newCap = captainId;
    let newVice = viceCaptainId;
    if (viceCaptainId === player.id) { newVice = null; }
    else { if (captainId === player.id) newCap = null; newVice = player.id; }
    setCaptainId(newCap);
    setViceCaptainId(newVice);
  };

  const handlePlayerTap = (player: SelectedPlayer) => {
    if (interactionMode === 'locked') return;
    if (interactionMode === 'building') {
      setPopupPlayer(player);
      return;
    }
    if (selectedForSwap && selectedForSwap.id !== player.id) {
      const a = selectedForSwap, b = player;
      if (a.position !== b.position) {
        setSaveMessage({ type: 'error', text: `Can't swap ${a.position} ↔ ${b.position}` });
        setTimeout(() => setSaveMessage(null), 3000);
        setSelectedForSwap(null);
        return;
      }
      setSelectedPlayers(prev => prev.map(p => {
        if (p.id === a.id) return { ...p, slot: b.slot, isBench: b.isBench };
        if (p.id === b.id) return { ...p, slot: a.slot, isBench: a.isBench };
        return p;
      }));
      setSelectedForSwap(null);
      setSaveMessage({ type: 'success', text: `↔ ${a.name} ↔ ${b.name} swapped` });
      setTimeout(() => setSaveMessage(null), 2500);
      return;
    }
    setPopupPlayer(player);
  };

  const handleSell = (player: SelectedPlayer) => {
    if (transfersThisWindow + newPlayers.length >= MAX_TRANSFERS) {
      setSaveMessage({ type: 'error', text: `Max ${MAX_TRANSFERS} transfers reached` });
      setTimeout(() => setSaveMessage(null), 3000); return;
    }
    setSelectedPlayers(prev => prev.filter(p => p.id !== player.id));
    setSelectedForSwap(null);
  };

  const saveTeam = async () => {
    if (!user) { setSaveMessage({ type: 'error', text: 'Please log in first' }); return; }
    if (!captainId) { setSaveMessage({ type: 'error', text: 'Please select a captain first (tap C under a player)' }); return; }
    if (!isLocked && !validation.valid) { setSaveMessage({ type: 'error', text: validation.message }); return; }
    setIsSaving(true);
    try {
      const { error } = await supabase.from('user_teams').upsert({
        user_id: user.id, formation, players: selectedPlayers,
        captain_id: captainId, vice_captain_id: viceCaptainId,
        total_spent: parseFloat(totalSpent.toFixed(2)), transfer_locked: true,
      }, { onConflict: 'user_id' });
      if (error) throw error;
      setOriginalPlayers(selectedPlayers);
      setIsLocked(true);
      setSaveMessage({ type: 'success', text: isLocked ? '✓ Squad saved!' : '✓ Squad submitted!' });
    } catch (e: any) {
      setSaveMessage({ type: 'error', text: e.message });
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveMessage(null), 4000);
    }
  };

  const saveTransfers = async () => {
    if (!user || overLimit) return;
    setIsSaving(true);
    try {
      const removed = originalPlayers.filter(p => !selectedPlayers.find(s => s.id === p.id));
      for (let i = 0; i < newPlayers.length; i++) {
        const pIn = newPlayers[i], pOut = removed[i];
        if (!pOut) continue;
        await supabase.from('transfer_history').insert({
          user_id: user.id, gameweek: currentGw,
          player_out_id: pOut.id, player_out_name: pOut.name,
          player_in_id: pIn.id, player_in_name: pIn.name,
          was_free: i < freeTransfersAvailable, point_cost: i < freeTransfersAvailable ? 0 : 4,
        });
      }
      const newFree = Math.max(0, freeTransfersAvailable - transfersUsed);
      const newUsed = transfersThisWindow + transfersUsed;
      const { error } = await supabase.from('user_teams').update({
        players: selectedPlayers, formation, captain_id: captainId, vice_captain_id: viceCaptainId,
        total_spent: parseFloat(totalSpent.toFixed(2)),
        free_transfers_available: newFree, transfers_this_window: newUsed,
        total_points: Math.max(0, teamTotalPoints - pointCost),
      }).eq('user_id', user.id);
      if (error) throw error;
      setOriginalPlayers(selectedPlayers);
      setFreeTransfersAvailable(newFree);
      setTransfersThisWindow(newUsed);
      setTeamTotalPoints(p => Math.max(0, p - pointCost));
      setSaveMessage({ type: 'success', text: pointCost > 0 ? `✓ Saved · -${pointCost} pts` : `✓ Free transfer saved` });
      setShowTransferConfirm(false);
    } catch (e: any) {
      setSaveMessage({ type: 'error', text: e.message });
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveMessage(null), 5000);
    }
  };

  const modalPlayers = useMemo(() => {
    if (!currentSlot) return [];
    return allPlayers.filter(p => {
      if (p.position !== currentSlot.position) return false;
      if (selectedPlayers.find(s => s.id === p.id)) return false;
      if (p.price > remainingBudget + 0.1) return false;
      if (deptCount(selectedPlayers, p.department) >= MAX_PER_DEPT) return false;
      return true;
    }).sort((a, b) => b.price - a.price);
  }, [currentSlot, selectedPlayers, remainingBudget, allPlayers]);

  const renderRow = (position: Position, count: number, startSlot: number) => (
    <div className="flex justify-center items-end gap-2 sm:gap-4 my-3">
      {Array.from({ length: count }, (_, i) => {
        const slot = startSlot + i;
        const player = selectedPlayers.find(p => p.slot === slot && !p.isBench);
        return player ? (
          <PlayerCard key={slot} player={player}
            isCaptain={captainId === player.id}
            isVice={viceCaptainId === player.id && captainId !== player.id}
            isBench={false} isSelected={selectedForSwap?.id === player.id}
            mode={interactionMode} isGameweekActive={isGameweekActive} transferWindowOpen={transferWindowOpen}
            gwPoints={gwPoints[player.name]}
            onTap={() => handlePlayerTap(player)}
            onCaptain={() => handleSetCaptain(player)}
            onVice={() => handleSetVice(player)}
            onSell={() => handleSell(player)}
          />
        ) : (
          <EmptySlot key={slot} position={position}
            disabled={interactionMode === 'locked'} transferWindowOpen={transferWindowOpen} interactionMode={interactionMode}
            onClick={() => { setCurrentSlot({ slot, position, isBench: false }); setIsModalOpen(true); }}
          />
        );
      })}
    </div>
  );

  const positionCounts = {
    GK: selectedPlayers.filter(p => p.position === 'GK').length,
    DEF: selectedPlayers.filter(p => p.position === 'DEF').length,
    MID: selectedPlayers.filter(p => p.position === 'MID').length,
    FWD: selectedPlayers.filter(p => p.position === 'FWD').length,
  };
  const targetCounts = {
    GK: 2, DEF: formationConfig.DEF + 1, MID: formationConfig.MID + 1, FWD: formationConfig.FWD + 1,
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#0a1128] text-white font-sans relative">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-900/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-yellow-900/10 rounded-full blur-3xl" />
      </div>

      <header className="relative z-20 backdrop-blur-xl bg-[#0d1b3e]/90 border-b border-blue-800/40 shadow-lg shadow-blue-900/30">
        <div className="flex items-center justify-between px-4 py-3">
          <a href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <span className="text-2xl drop-shadow-lg">⚽</span>
            <span className="font-black text-base tracking-tight bg-gradient-to-r from-yellow-400 to-white bg-clip-text text-transparent">
              Dean&apos;s Cup <span className="text-yellow-400">Fantasy</span>
            </span>
          </a>
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase backdrop-blur-md transition-all ${
              isGameweekActive ? 'bg-yellow-400/10 text-yellow-400 border border-yellow-400/30 shadow-[0_0_15px_rgba(234,179,8,0.3)]' : 'bg-white/5 text-white/40 border border-white/10'
            }`}>
              {isGameweekActive && <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse shadow-[0_0_8px_#eab308]" />}
              GW{currentGw} {isGameweekActive ? 'Live' : ''}
            </div>
            <a href="/leaderboard" className="text-blue-200/70 text-xs font-semibold hover:text-white transition-colors duration-300 hover:underline underline-offset-4 decoration-blue-400/50">
              Leaderboard
            </a>
            {user ? (
              <a href="/profile" className="text-[10px] font-black px-3 py-1 rounded-full bg-yellow-400/10 text-yellow-400 border border-yellow-400/20 shadow-sm hover:bg-yellow-400/20 transition-all">
                {user.email?.split('@')[0]}
              </a>
            ) : (
              <a href="/auth" className="text-xs font-black px-4 py-1.5 rounded-full bg-gradient-to-r from-yellow-400 to-yellow-600 text-black shadow-md shadow-yellow-400/20 hover:shadow-lg hover:scale-105 transition-all">
                Login
              </a>
            )}
          </div>
        </div>
      </header>

      <div className="relative z-10 flex border-b border-blue-800/30 bg-[#0d1b3e]/60 backdrop-blur-md">
        {(['squad', 'transfers', 'points'] as PageTab[]).map(t => (
          <button key={t} onClick={() => setPageTab(t)}
            className={`flex-1 py-3 text-xs font-black uppercase tracking-widest transition-all duration-300 relative ${
              pageTab === t ? 'text-yellow-400' : 'text-white/30 hover:text-white/60'
            }`}>
            {t}
            {pageTab === t && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-yellow-400 to-yellow-600 rounded-full shadow-[0_0_10px_#eab308]" />
            )}
          </button>
        ))}
      </div>

      {/* ── SQUAD TAB ── */}
      {pageTab === 'squad' && (
        <div className="flex flex-1 flex-col lg:flex-row">
          <aside className="lg:w-56 shrink-0 border-b lg:border-b-0 lg:border-r border-blue-800/20 p-4 space-y-4 bg-[#0d1b3e]/30 backdrop-blur-md">
            {isGameweekActive && (
              <div className="rounded-2xl p-4 border border-yellow-400/20 bg-yellow-400/5 backdrop-blur-sm shadow-lg shadow-yellow-400/5 text-center">
                <p className="text-[9px] font-black uppercase text-blue-300/80 mb-2 tracking-widest">Gameweek {currentGw}</p>
                {(() => {
                  const liveGwPts = selectedPlayers.filter(p => !p.isBench).reduce((sum, p) => {
                    const raw = gwPoints[p.name] ?? 0;
                    return sum + (captainId === p.id ? raw * 2 : raw);
                  }, 0);
                  return (
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <p className="font-black text-2xl text-yellow-400 drop-shadow-md">{liveGwPts}</p>
                        <p className="text-[9px] text-blue-400/70 uppercase">GW pts</p>
                      </div>
                      <div>
                        <p className="font-black text-2xl text-white">{teamTotalPoints}</p>
                        <p className="text-[9px] text-blue-400/70 uppercase">Total</p>
                      </div>
                      <div>
                        <p className="font-black text-2xl text-yellow-400 drop-shadow">{gwRank ? `#${gwRank}` : '—'}</p>
                        <p className="text-[9px] text-blue-400/70 uppercase">Rank</p>
                      </div>
                    </div>
                  );
                })()}
                <div className="mt-3 flex gap-2 justify-center flex-wrap">
                  {captainId && (() => {
                    const cap = selectedPlayers.find(p => p.id === captainId);
                    return cap ? (
                      <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-yellow-400/20 text-yellow-300 border border-yellow-400/40">© {cap.name.split(' ').pop()}</span>
                    ) : null;
                  })()}
                  {viceCaptainId && captainId !== viceCaptainId && (() => {
                    const vc = selectedPlayers.find(p => p.id === viceCaptainId);
                    return vc ? (
                      <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-gray-400/20 text-gray-300 border border-gray-400/30">V {vc.name.split(' ').pop()}</span>
                    ) : null;
                  })()}
                </div>
              </div>
            )}

            {(!isGameweekActive || freeTransfers) && (
              <div className="rounded-2xl p-4 border border-blue-700/30 bg-white/[0.02] backdrop-blur-sm transition-all hover:bg-white/[0.04]">
                <p className="text-[10px] font-black uppercase text-blue-300 mb-1">Budget</p>
                <p className={`font-black text-2xl ${remainingBudget < 0 ? 'text-red-400' : 'text-white'}`}>£{remainingBudget.toFixed(1)}m</p>
                <div className="mt-3 h-2 rounded-full bg-white/5 overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-700 ${totalSpent > BUDGET_CAP ? 'bg-gradient-to-r from-red-500 to-red-400' : 'bg-gradient-to-r from-yellow-400 to-yellow-600'}`}
                    style={{ width: `${Math.min((totalSpent / BUDGET_CAP) * 100, 100)}%` }} />
                </div>
                <p className="text-[9px] text-blue-400/60 mt-2">£{totalSpent.toFixed(1)}m of £{BUDGET_CAP}m</p>
              </div>
            )}

            {(!isGameweekActive || transferWindowOpen || freeTransfers) && (
              <div className="rounded-2xl p-4 border border-blue-700/30 bg-white/[0.02] backdrop-blur-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-[10px] font-black uppercase text-blue-300">Free Transfers</p>
                    <p className="font-black text-2xl text-white">{freeTransfersAvailable}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black uppercase text-blue-300">Cost</p>
                    <p className={`font-black text-sm ${pointCost > 0 ? 'text-red-400' : 'text-white/30'}`}>{pointCost > 0 ? `-${pointCost} pts` : '0 pts'}</p>
                  </div>
                </div>
                {transferWindowOpen && (
                  <p className="text-[9px] text-blue-400/60 mt-2">{MAX_TRANSFERS - transfersThisWindow} transfers left this window</p>
                )}
              </div>
            )}

            <div className="rounded-2xl p-4 border border-blue-700/30 bg-white/[0.02] backdrop-blur-sm">
              <p className="text-[10px] font-black uppercase text-blue-300 mb-2">Formation</p>
              {(() => {
                const canChange = (!isLocked) || (transferWindowOpen && !isGameweekActive) || freeTransfers;
                return (
                  <>
                    <select value={formation}
                      onChange={e => canChange ? handleFormationChange(e.target.value as Formation) : undefined}
                      className={`w-full bg-transparent text-white font-black text-sm px-3 py-2 rounded-xl border outline-none transition-all duration-300 ${
                        canChange ? 'border-blue-500/40 cursor-pointer hover:border-yellow-400/50 focus:border-yellow-400' : 'border-blue-800/20 opacity-40 cursor-not-allowed'
                      }`}>
                      {Object.keys(FORMATIONS).map(f => <option key={f} value={f} className="bg-[#0d1b3e]">{f}</option>)}
                    </select>
                    <p className={`text-[9px] mt-2 ${canChange ? 'text-yellow-400/70' : 'text-white/20'}`}>
                      {canChange ? 'Tap to change formation' : isGameweekActive ? 'GW live — locked' : 'Opens with transfer window'}
                    </p>
                  </>
                );
              })()}
            </div>

            {!isGameweekActive && (
              <div className="rounded-2xl p-4 border border-blue-700/30 bg-white/[0.02] backdrop-blur-sm">
                <p className="text-[10px] font-black uppercase text-blue-300 mb-3">Team Overview</p>
                {(['GK','DEF','MID','FWD'] as Position[]).map(pos => (
                  <div key={pos} className="flex items-center gap-2 py-2 border-b border-white/5 last:border-0">
                    <span className="text-sm">{pos === 'GK' ? '🧤' : pos === 'DEF' ? '🛡️' : pos === 'MID' ? '⚙️' : '⚡'}</span>
                    <span className="text-xs text-blue-200/70 flex-1">{pos === 'GK' ? 'Goalkeepers' : pos === 'DEF' ? 'Defenders' : pos === 'MID' ? 'Midfielders' : 'Forwards'}</span>
                    <span className={`text-xs font-black ${positionCounts[pos] === targetCounts[pos] ? 'text-yellow-400' : 'text-white/50'}`}>{positionCounts[pos]}/{targetCounts[pos]}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="rounded-2xl p-4 border border-blue-700/30 bg-white/[0.02] backdrop-blur-sm overflow-hidden">
              <p className="text-[10px] font-black uppercase text-blue-300 mb-3 tracking-widest">Dept Limits</p>
              <div className="space-y-3">
                {Object.entries(deptUsage).map(([dept, count]) => {
                  const pct = (count / MAX_PER_DEPT) * 100;
                  const full = count >= MAX_PER_DEPT;
                  const abbr = dept.split(' ')[0].slice(0, 3).toUpperCase();
                  const deptColor = DEPT_COLORS[dept]?.shirt || '#555';
                  return (
                    <div key={dept} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full shrink-0 shadow-lg" style={{ background: deptColor, boxShadow: `0 0 8px ${deptColor}` }} />
                      <span className={`text-[9px] font-black w-7 shrink-0 ${full ? 'text-red-400' : 'text-white/60'}`}>{abbr}</span>
                      <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${pct}%`, background: full ? 'linear-gradient(90deg,#f87171,#ef4444)' : `linear-gradient(90deg,${deptColor},${deptColor}cc)`, boxShadow: full ? '0 0 8px #f87171' : `0 0 4px ${deptColor}66` }} />
                      </div>
                      <span className={`text-[9px] font-black w-6 text-right ${full ? 'text-red-400' : 'text-blue-400/80'}`}>{count}/{MAX_PER_DEPT}</span>
                    </div>
                  );
                })}
                {Object.keys(deptUsage).length === 0 && (
                  <p className="text-[9px] text-blue-500 text-center py-1">No players selected yet</p>
                )}
              </div>
            </div>

            {!isLocked && (
              <button onClick={autoPick} disabled={isAutoPicking}
                className="w-full py-3 rounded-xl font-black text-sm uppercase tracking-wider transition-all disabled:opacity-40 bg-yellow-400/10 text-yellow-400 border border-yellow-400/30 hover:bg-yellow-400/20 hover:shadow-lg hover:shadow-yellow-400/10 active:scale-95">
                {isAutoPicking ? 'Picking...' : '🎲 Auto Pick'}
              </button>
            )}

            <div className={`text-center py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border backdrop-blur-sm ${
              freeTransfers ? 'text-yellow-300 border-yellow-500/40 bg-yellow-500/5' : isLocked ? 'text-red-300 border-red-500/30 bg-red-500/5' : 'text-green-300 border-green-500/30 bg-green-500/5'
            }`}>
              {freeTransfers ? '🔓 Free Transfers ON' : isLocked ? '🔒 Locked' : '🟢 Building'}
            </div>
          </aside>

          <main className="flex-1 flex flex-col relative z-10">
            {transferWindowOpen && isLocked && !freeTransfers && (
              <div className="sticky top-0 z-30 backdrop-blur-xl bg-[#0a1128]/90 border-b border-yellow-400/20 px-4 py-3 flex items-center gap-4 flex-wrap shadow-lg">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase text-blue-300">Transfer Window</span>
                  {selectedForSwap && (
                    <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-yellow-400/20 text-yellow-300 border border-yellow-400/40 animate-pulse">
                      {selectedForSwap.name} selected — tap to swap
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 ml-auto">
                  <span className="text-[10px] text-blue-300/80">{freeTransfersAvailable} free · {MAX_TRANSFERS - transfersThisWindow} left</span>
                  {transfersUsed > 0 && (
                    <span className={`text-[10px] font-black ${pointCost > 0 ? 'text-red-400' : 'text-yellow-400'}`}>
                      {transfersUsed} pending {pointCost > 0 ? `(-${pointCost}pts)` : '(free)'}
                    </span>
                  )}
                  {newPlayers.length > 0 && !overLimit && (
                    <>
                      {!showTransferConfirm
                        ? <button onClick={() => setShowTransferConfirm(true)}
                            className={`px-4 py-2 rounded-xl font-black text-xs uppercase transition-all ${
                              pointCost > 0 ? 'bg-yellow-400/10 text-yellow-300 border border-yellow-400/30 hover:bg-yellow-400/20' : 'bg-yellow-400/10 text-yellow-400 border border-yellow-400/30 hover:bg-yellow-400/20'
                            }`}>
                            Save{pointCost > 0 ? ` (-${pointCost}pts)` : ' Free'}
                          </button>
                        : <div className="flex gap-2">
                            <button onClick={() => setShowTransferConfirm(false)} className="px-4 py-2 rounded-xl text-xs font-black border border-white/10 text-white/40 hover:bg-white/5">Cancel</button>
                            <button onClick={saveTransfers} disabled={isSaving} className="px-4 py-2 rounded-xl text-xs font-black disabled:opacity-50 bg-yellow-400 text-black hover:bg-yellow-300 transition-colors">
                              {isSaving ? '...' : 'Confirm'}
                            </button>
                          </div>
                      }
                    </>
                  )}
                  {overLimit && <span className="text-red-400 text-xs font-bold animate-pulse">❌ Max {MAX_TRANSFERS} reached</span>}
                </div>
              </div>
            )}

            {saveMessage && (
              <div className={`mx-4 mt-4 px-4 py-3 rounded-xl text-sm font-bold text-center backdrop-blur-md ${
                saveMessage.type === 'success' ? 'bg-green-500/10 text-green-300 border border-green-500/20' : 'bg-red-500/10 text-red-300 border border-red-500/20'
              }`}>
                {saveMessage.text}
              </div>
            )}

            {/* ─── PITCH WITH BLUE & GOLD BANNER ─── */}
            <div className="flex-1 relative m-3 rounded-3xl overflow-hidden shadow-2xl shadow-blue-900/50 border border-yellow-400/10 min-h-[600px]"
              style={{ background: 'linear-gradient(180deg, #1a5c1a 0%, #145014 30%, #1a5c1a 50%, #145014 70%, #1a5c1a 100%)' }}
              onClick={e => { if (e.target === e.currentTarget) setSelectedForSwap(null); }}>
              <div className="absolute top-0 left-0 right-0 h-10 bg-gradient-to-r from-blue-900 via-blue-700 to-yellow-600 flex items-center justify-center z-20">
                <span className="text-white font-black text-sm tracking-widest uppercase drop-shadow">Fantasy</span>
              </div>
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,_rgba(255,255,255,0.03)_0%,_transparent_70%)]" />
              <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 600" preserveAspectRatio="none" style={{ opacity: 0.2 }}>
                <rect x="2" y="2" width="396" height="596" fill="none" stroke="white" strokeWidth="2"/>
                <line x1="2" y1="300" x2="398" y2="300" stroke="white" strokeWidth="1.5"/>
                <circle cx="200" cy="300" r="50" fill="none" stroke="white" strokeWidth="1.5"/>
                <circle cx="200" cy="300" r="3" fill="white"/>
                <rect x="100" y="2" width="200" height="80" fill="none" stroke="white" strokeWidth="1.5"/>
                <rect x="150" y="2" width="100" height="35" fill="none" stroke="white" strokeWidth="1.5"/>
                <rect x="100" y="518" width="200" height="80" fill="none" stroke="white" strokeWidth="1.5"/>
                <rect x="150" y="563" width="100" height="35" fill="none" stroke="white" strokeWidth="1.5"/>
                <circle cx="200" cy="90" r="3" fill="white"/>
                <circle cx="200" cy="510" r="3" fill="white"/>
              </svg>

              <div className="relative z-10 flex flex-col justify-around h-full py-6 px-2">
                {isGameweekActive && (
                  <div className="text-center mb-2">
                    <span className="text-[11px] font-black px-4 py-1 rounded-full bg-yellow-400/20 text-yellow-300 border border-yellow-400/30 shadow-md">
                      ★ GW{currentGw} Points Live
                    </span>
                  </div>
                )}
                {renderRow('FWD', formationConfig.FWD, 0)}
                {renderRow('MID', formationConfig.MID, formationConfig.FWD)}
                {renderRow('DEF', formationConfig.DEF, formationConfig.FWD + formationConfig.MID)}
                {renderRow('GK',  formationConfig.GK,  formationConfig.FWD + formationConfig.MID + formationConfig.DEF)}
              </div>
            </div>

            {/* ─── BENCH ─── */}
            <div className="mx-3 mb-4 rounded-2xl border border-blue-700/30 overflow-hidden bg-blue-900/30 backdrop-blur-md shadow-lg">
              <div className="px-4 py-2.5 border-b border-blue-800/20 bg-blue-900/20 flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-blue-300/90 tracking-widest">Substitutes</span>
                {(interactionMode === 'swapping' || interactionMode === 'building' || interactionMode === 'freeTransfer') && (
                  <span className="text-[9px] text-blue-400/60">Tap player to swap · × to sell</span>
                )}
              </div>
              <div className="flex justify-around py-5 px-2">
                {(['GK','DEF','MID','FWD'] as Position[]).map((pos, i) => {
                  const player = selectedPlayers.find(p => p.slot === i && p.isBench);
                  return player ? (
                    <PlayerCard key={i} player={player} isCaptain={false} isVice={false}
                      isBench={true} isSelected={selectedForSwap?.id === player.id}
                      mode={interactionMode} isGameweekActive={isGameweekActive} transferWindowOpen={transferWindowOpen}
                      gwPoints={gwPoints[player.name]}
                      onTap={() => handlePlayerTap(player)}
                      onCaptain={() => {}}
                      onVice={() => {}}
                      onSell={() => handleSell(player)}
                    />
                  ) : (
                    <EmptySlot key={i} position={pos} size={60}
                      disabled={interactionMode === 'locked'} transferWindowOpen={transferWindowOpen} interactionMode={interactionMode}
                      onClick={() => { setCurrentSlot({ slot: i, position: pos, isBench: true }); setIsModalOpen(true); }}
                    />
                  );
                })}
              </div>
              <div className="text-center pb-2">
                <span className="text-white/70 text-[10px] font-medium">Substitutes</span>
              </div>
            </div>

            <div className="px-4 pb-6 text-center">
              {!validation.valid && (interactionMode === 'building' || interactionMode === 'freeTransfer') && (
                <p className="text-yellow-200/90 text-xs font-semibold mb-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-4 py-2 backdrop-blur-sm">
                  ⚠ {validation.message}
                </p>
              )}

              {isLocked && !isGameweekActive && !freeTransfers && newPlayers.length === 0 && (
                <div className="space-y-3">
                  <p className="text-blue-300/70 text-[10px] uppercase tracking-widest">
                    {transferWindowOpen ? 'Save captain, bench order or formation changes' : 'Change captain, bench order or formation then save'}
                  </p>
                  <button onClick={saveTeam} disabled={isSaving}
                    className="w-full max-w-sm py-4 rounded-2xl font-black text-base uppercase tracking-widest transition-all disabled:opacity-40 bg-gradient-to-r from-yellow-400 to-yellow-600 text-black shadow-lg shadow-yellow-400/20 hover:shadow-xl hover:scale-[1.02] active:scale-95">
                    {isSaving ? 'Saving...' : '💾 Save Squad'}
                  </button>
                </div>
              )}

              {!isLocked && interactionMode === 'building' && (
                <button onClick={saveTeam} disabled={isSaving || !validation.valid}
                  className={`w-full max-w-sm py-4 rounded-2xl font-black text-base uppercase tracking-widest transition-all disabled:opacity-40 ${
                    validation.valid ? 'bg-gradient-to-r from-yellow-400 to-yellow-600 text-black shadow-lg shadow-yellow-400/20 hover:shadow-xl hover:scale-[1.02]' : 'bg-gray-700 text-gray-400'
                  }`}>
                  {isSaving ? 'Saving...' : 'Submit Squad'}
                </button>
              )}

              {interactionMode === 'freeTransfer' && (
                <div className="space-y-3">
                  <p className="text-yellow-300 text-[10px] font-black uppercase tracking-widest animate-pulse">🔓 Free Transfers Active</p>
                  <button onClick={saveTransfers} disabled={isSaving || !validation.valid}
                    className={`w-full max-w-sm py-4 rounded-2xl font-black text-base uppercase tracking-widest transition-all disabled:opacity-40 ${
                      validation.valid ? 'bg-gradient-to-r from-yellow-400 to-amber-500 text-black shadow-lg shadow-yellow-400/20 hover:shadow-xl hover:scale-[1.02]' : 'bg-gray-700 text-gray-400'
                    }`}>
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              )}

              {interactionMode === 'locked' && !transferWindowOpen && (
                <p className="text-blue-400/60 text-xs font-black uppercase tracking-widest backdrop-blur-sm bg-black/20 rounded-lg py-2 px-4 inline-block">
                  {isGameweekActive ? `GW${currentGw} Live · Squad Locked` : 'Squad Locked · Transfer Window Closed'}
                </p>
              )}

              {interactionMode === 'swapping' && newPlayers.length === 0 && transferWindowOpen && (
                <p className="text-blue-400/60 text-xs font-black uppercase tracking-widest">
                  Use × to sell a player · tap + to buy replacement
                </p>
              )}
            </div>
          </main>
        </div>
      )}

      {/* ── TRANSFERS TAB ── */}
      {pageTab === 'transfers' && (
        <div className="max-w-2xl mx-auto w-full px-4 py-8 space-y-6">
          <div className="rounded-3xl p-6 border border-blue-700/30 bg-white/[0.02] backdrop-blur-md shadow-xl">
            <h2 className="font-black text-2xl mb-6 bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent">Transfer Summary · GW{currentGw}</h2>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="text-center rounded-xl p-4 border border-blue-700/30 bg-white/[0.03]">
                <p className="font-black text-3xl text-yellow-400">{freeTransfersAvailable}</p>
                <p className="text-[10px] text-blue-400/80 uppercase mt-1">Free transfers</p>
              </div>
              <div className="text-center rounded-xl p-4 border border-blue-700/30 bg-white/[0.03]">
                <p className="font-black text-3xl text-white">{MAX_TRANSFERS - transfersThisWindow}</p>
                <p className="text-[10px] text-blue-400/80 uppercase mt-1">Remaining</p>
              </div>
              <div className="text-center rounded-xl p-4 border border-blue-700/30 bg-white/[0.03]">
                <p className={`font-black text-3xl ${pointCost > 0 ? 'text-red-400' : 'text-white/30'}`}>
                  {pointCost > 0 ? `-${pointCost}` : '0'}
                </p>
                <p className="text-[10px] text-blue-400/80 uppercase mt-1">Pending cost</p>
              </div>
            </div>
            <div className="text-sm text-blue-300/80 space-y-2 border-t border-white/5 pt-5">
              <p>• Each gameweek you get <strong className="text-white">1 free transfer</strong></p>
              <p>• Unused transfers roll over — max <strong className="text-white">2 banked</strong></p>
              <p>• Extra transfers cost <strong className="text-red-400">-4 points</strong> each</p>
              <p>• Max <strong className="text-white">5 transfers</strong> per window</p>
              <p>• Free emergency transfers can be enabled by admin</p>
            </div>
          </div>
          <button onClick={() => setPageTab('squad')}
            className="w-full py-4 rounded-2xl font-black text-sm uppercase tracking-wider bg-yellow-400/10 text-yellow-400 border border-yellow-400/30 hover:bg-yellow-400/20 transition-all">
            Go to Squad to Make Transfers
          </button>
        </div>
      )}

      {/* ── POINTS TAB ── */}
      {pageTab === 'points' && (
        <div className="max-w-2xl mx-auto w-full px-4 py-8 space-y-6">
          <div className="rounded-3xl p-6 border border-blue-700/30 bg-white/[0.02] backdrop-blur-md shadow-xl">
            <h2 className="font-black text-2xl mb-6">Points · GW{currentGw}</h2>
            {(() => {
              const liveGwTotal = selectedPlayers
                .filter(p => !p.isBench)
                .reduce((sum, p) => {
                  const raw = gwPoints[p.name] ?? 0;
                  return sum + (captainId === p.id ? raw * 2 : raw);
                }, 0);
              return (
                <>
                  <div className="grid grid-cols-2 gap-6 mb-8">
                    <div className="rounded-2xl p-5 text-center border border-yellow-400/20 bg-yellow-400/5">
                      <p className="font-black text-4xl text-yellow-400">{liveGwTotal}</p>
                      <p className="text-blue-300/80 text-xs uppercase mt-2 tracking-widest">This Gameweek</p>
                    </div>
                    <div className="rounded-2xl p-5 text-center border border-white/10 bg-white/[0.03]">
                      <p className="font-black text-4xl text-white">{teamTotalPoints}</p>
                      <p className="text-blue-300/80 text-xs uppercase mt-2 tracking-widest">Total Points</p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    {selectedPlayers
                      .sort((a, b) => {
                        if (!a.isBench && b.isBench) return -1;
                        if (a.isBench && !b.isBench) return 1;
                        const ap = (gwPoints[a.name] ?? 0) * (captainId === a.id ? 2 : 1);
                        const bp = (gwPoints[b.name] ?? 0) * (captainId === b.id ? 2 : 1);
                        return bp - ap;
                      })
                      .map(p => {
                        const raw = gwPoints[p.name] ?? 0;
                        const actual = captainId === p.id ? raw * 2 : raw;
                        const displayName = p.jersey_name || p.name;
                        return (
                          <div key={p.id} className={`flex items-center gap-4 py-3 px-2 rounded-xl transition-all hover:bg-white/[0.02] ${p.isBench ? 'opacity-50' : ''}`}>
                            <Jersey dept={p.department} isGK={p.position === 'GK'} isCaptain={captainId === p.id} size={40} number={p.number} />
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-sm text-white truncate">{displayName}
                                {captainId === p.id && <span className="ml-1 text-[10px] text-yellow-400 font-black">©</span>}
                                {viceCaptainId === p.id && captainId !== p.id && <span className="ml-1 text-[10px] text-gray-400 font-black">V</span>}
                                {p.isBench && <span className="ml-2 text-[9px] text-blue-500 font-black">BENCH</span>}
                              </p>
                              <p className="text-[10px] text-blue-400/70">{p.position} · {p.department.split(' ')[0]}</p>
                            </div>
                            <div className="text-right">
                              <p className={`font-black text-xl ${actual > 0 ? 'text-yellow-400' : actual < 0 ? 'text-red-400' : 'text-white/20'}`}>{actual}</p>
                              {captainId === p.id && raw > 0 && <p className="text-[9px] text-yellow-400">×2</p>}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* ── PLAYER POPUP ── */}
      {popupPlayer && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md p-0 sm:p-4 transition-all animate-in fade-in"
          onClick={() => setPopupPlayer(null)}>
          <div className="w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl shadow-blue-900/50 border border-blue-500/20 bg-[#0a1128]/95 backdrop-blur-xl"
            onClick={e => e.stopPropagation()}>
            <div className="px-6 py-5 flex items-center gap-4 border-b border-white/5"
              style={{ background: `linear-gradient(135deg, ${DEPT_COLORS[popupPlayer.department]?.shirt || '#555'}33, transparent 80%)` }}>
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 shadow-lg"
                style={{ background: DEPT_COLORS[popupPlayer.department]?.shirt + '44', backdropFilter: 'blur(10px)' }}>
                <Jersey dept={popupPlayer.department} isGK={popupPlayer.position === 'GK'} size={56} number={popupPlayer.number} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-black text-2xl text-white tracking-tight">{popupPlayer.jersey_name || popupPlayer.name}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full" style={{ background: POS_COLOR_MAP[popupPlayer.position] + '33', color: POS_COLOR_MAP[popupPlayer.position] }}>{popupPlayer.position}</span>
                  <span className="text-[10px] text-blue-300/80">{popupPlayer.department.split(' ')[0]}</span>
                  <span className="text-[11px] font-black text-yellow-400">£{popupPlayer.price.toFixed(1)}m</span>
                  {popupPlayer.number && <span className="text-[10px] text-white/60">#{popupPlayer.number}</span>}
                </div>
              </div>
              <button onClick={() => setPopupPlayer(null)} className="text-white/30 hover:text-white transition-colors text-2xl font-light">×</button>
            </div>
            {isGameweekActive && (
              <div className="px-6 py-4 flex items-center justify-between border-b border-white/5 bg-yellow-400/5">
                <p className="text-blue-300/80 text-xs uppercase tracking-wider">GW{currentGw} Points</p>
                <p className="font-black text-3xl text-yellow-400">
                  {(() => {
                    const raw = gwPoints[popupPlayer.name] ?? 0;
                    return captainId === popupPlayer.id ? raw * 2 : raw;
                  })()}
                  {captainId === popupPlayer.id && <span className="text-sm text-yellow-400 ml-1">©×2</span>}
                </p>
              </div>
            )}
            <div className="p-5 space-y-3">
              {interactionMode !== 'locked' && (
                <button
                  onClick={() => {
                    if (selectedForSwap?.id === popupPlayer.id) {
                      setSelectedForSwap(null);
                      setPopupPlayer(null);
                    } else {
                      setSelectedForSwap(popupPlayer);
                      setPopupPlayer(null);
                      setSaveMessage({ type: 'success', text: `${popupPlayer.name} selected — tap another ${popupPlayer.position} to swap` });
                      setTimeout(() => setSaveMessage(null), 4000);
                    }
                  }}
                  className={`w-full py-3.5 rounded-xl font-black text-sm uppercase tracking-wider transition-all ${
                    selectedForSwap?.id === popupPlayer.id
                      ? 'bg-yellow-400/20 text-yellow-300 border border-yellow-400/40'
                      : 'bg-white/5 text-white/80 border border-white/10 hover:bg-white/10'
                  }`}>
                  {selectedForSwap?.id === popupPlayer.id ? '✦ Selected — tap another to swap' : '↔ Select for Swap'}
                </button>
              )}
              {(interactionMode === 'swapping' || interactionMode === 'freeTransfer') && transferWindowOpen && (
                <button onClick={() => { handleSell(popupPlayer); setPopupPlayer(null); }}
                  className="w-full py-3.5 rounded-xl font-black text-sm uppercase tracking-wider bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all">
                  × Sell Player
                </button>
              )}
              {interactionMode === 'building' && (
                <button onClick={() => { setSelectedPlayers(prev => prev.filter(p => p.id !== popupPlayer.id)); setPopupPlayer(null); }}
                  className="w-full py-3.5 rounded-xl font-black text-sm uppercase tracking-wider bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all">
                  × Remove from Squad
                </button>
              )}
              <a href={`/players/${popupPlayer.id}`}
                className="w-full py-3.5 rounded-xl font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 bg-yellow-400/10 text-yellow-400 border border-yellow-400/20 hover:bg-yellow-400/20 transition-all">
                📊 View Full Profile & Stats
              </a>
            </div>
          </div>
        </div>
      )}

      {/* PLAYER PICKER MODAL */}
      {isModalOpen && currentSlot && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/85 backdrop-blur-md p-0 sm:p-4 animate-in fade-in"
          onClick={() => setIsModalOpen(false)}>
          <div className="w-full sm:max-w-xl rounded-t-3xl sm:rounded-3xl flex flex-col max-h-[88vh] overflow-hidden border border-blue-500/20 bg-[#0a1128]/95 backdrop-blur-xl shadow-2xl"
            onClick={e => e.stopPropagation()}>
            <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-black text-2xl">Pick <span className="text-yellow-400">{currentSlot.position}</span></h3>
                <p className="text-blue-400/80 text-xs mt-1">£{remainingBudget.toFixed(1)}m available · max {MAX_PER_DEPT}/dept</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-white/30 hover:text-white text-2xl font-light transition-colors">×</button>
            </div>
            <div className="overflow-y-auto flex-1 divide-y divide-white/5">
              {modalPlayers.length === 0 ? (
                <div className="text-center py-16">
                  <p className="text-4xl mb-3">💸</p>
                  <p className="text-blue-300 font-bold text-lg">No players available</p>
                  <p className="text-blue-500/80 text-sm mt-2">Check budget or department limits</p>
                </div>
              ) : modalPlayers.map(p => {
                const dc = deptCount(selectedPlayers, p.department);
                return (
                  <button key={p.id}
                    onClick={() => { setSelectedPlayers(prev => [...prev, { ...p, slot: currentSlot.slot, isBench: currentSlot.isBench }]); setIsModalOpen(false); }}
                    className="w-full flex items-center gap-4 px-6 py-4 hover:bg-white/[0.03] text-left transition-all group">
                    <Jersey dept={p.department} isGK={p.position === 'GK'} size={48} number={p.number} />
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-base text-white group-hover:text-yellow-400 transition-colors">{p.jersey_name || p.name}</p>
                      <p className="text-[10px] text-blue-400/80">{p.department} · {p.position}</p>
                      <p className="text-[9px] text-blue-500">{dc}/{MAX_PER_DEPT} in squad</p>
                    </div>
                    <p className="font-black text-xl text-yellow-400 group-hover:scale-110 transition-transform">£{p.price.toFixed(1)}m</p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}