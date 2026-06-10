'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

const DEPT_COLORS: Record<string, string> = {
  'Statistics':              '#1a5c1a',
  'Chemistry':               '#2d6a2d',
  'Mathematics':             '#0d1b4b',
  'Environmental Standards': '#1a4a1a',
  'Physics':                 '#cc0000',
  'Geosciences':             '#8b4513',
};

const POSITION_COLORS: Record<string, string> = {
  GK: '#f59e0b', DEF: '#3b82f6', MID: '#10b981', FWD: '#ef4444',
};

interface Profile {
  id: string;
  nickname: string;
  full_name: string;
  shirt_number: number;
  position: string;
  department: string;
  strong_foot: string;
  price: number;
}

interface GWRow {
  gameweek: number;
  minutes_played: number;
  goals: number;
  assists: number;
  clean_sheet: boolean;
  yellow_cards: number;
  red_cards: number;
  penalty_saves: number;
  shots_saved: number;
  goals_conceded: number;
  own_goals: number;
  cbit: number;
  bonus: number;
  total_points: number;
}

// Jersey SVG for profile page
function JerseyLarge({ dept, isGK }: { dept: string; isGK: boolean }) {
  const colors: Record<string, { shirt: string; sleeve: string; collar: string }> = {
    'Statistics':              { shirt: '#1a5c1a', sleeve: '#0f3d0f', collar: '#ffd700' },
    'Chemistry':               { shirt: '#f0f0f0', sleeve: '#1a5c1a', collar: '#1a5c1a' },
    'Mathematics':             { shirt: '#0d1b4b', sleeve: '#091230', collar: '#00d4c8' },
    'Environmental Standards': { shirt: '#1a5c1a', sleeve: '#000000', collar: '#000000' },
    'Physics':                 { shirt: '#cc0000', sleeve: '#990000', collar: '#ffffff' },
    'Geosciences':             { shirt: '#8b4513', sleeve: '#6b3410', collar: '#ffd700' },
  };
  const c = colors[dept] || { shirt: '#555', sleeve: '#333', collar: '#fff' };
  const shirt = isGK ? '#3d9970' : c.shirt;
  const sleeve = isGK ? '#2ecc71' : c.sleeve;

  return (
    <svg width="110" height="120" viewBox="0 0 80 90" fill="none" className="drop-shadow-2xl">
      <ellipse cx="40" cy="86" rx="24" ry="4" fill="rgba(0,0,0,0.3)" />
      <path d="M8 24 L20 18 L24 38 L12 42 Z" fill={sleeve} stroke="rgba(0,0,0,0.1)" strokeWidth="0.5"/>
      <path d="M72 24 L60 18 L56 38 L68 42 Z" fill={sleeve} stroke="rgba(0,0,0,0.1)" strokeWidth="0.5"/>
      <path d="M20 18 L20 80 L60 80 L60 18 L52 14 C50 20 45 23 40 23 C35 23 30 20 28 14 Z" fill={shirt} stroke="rgba(0,0,0,0.1)" strokeWidth="0.5"/>
      <path d="M34 14 Q40 10 46 14 Q44 20 40 21 Q36 20 34 14 Z" fill={c.collar} opacity="0.9"/>
      <path d="M26 20 Q30 18 34 18 L34 35 Q30 35 26 37 Z" fill="rgba(255,255,255,0.15)"/>
      {isGK && (<><rect x="6" y="38" width="8" height="7" rx="2" fill="#e67e22"/><rect x="66" y="38" width="8" height="7" rx="2" fill="#e67e22"/></>)}
    </svg>
  );
}

export default function PlayerProfilePage() {
  const params = useParams();
  const id = params?.id as string;
  const supabase = createClient();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [gwHistory, setGwHistory] = useState<GWRow[]>([]);
  const [ownerCount, setOwnerCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    const load = async () => {
      // 1. Try player_profiles table first (has full name, nickname, shirt number)
      const { data: profileData } = await supabase
        .from('player_profiles')
        .select('*')
        .eq('id', id)
        .single();

      if (profileData) {
        setProfile(profileData);
      } else {
        // Fallback: try player_prices table
        const { data: priceData } = await supabase
          .from('player_prices')
          .select('*')
          .eq('id', id)
          .single();
        if (priceData) {
          setProfile({
            id: priceData.id,
            nickname: priceData.name,
            full_name: priceData.name,
            shirt_number: 0,
            position: priceData.position,
            department: priceData.department,
            strong_foot: 'Unknown',
            price: priceData.price,
          });
        }
      }

      // 2. GW history — try both player_id and player_name
      const { data: historyById } = await supabase
        .from('player_gameweek_points')
        .select('*')
        .eq('player_id', id)
        .order('gameweek');

      if (historyById && historyById.length > 0) {
        setGwHistory(historyById);
      } else if (profileData) {
        // Try by nickname (player_name column)
        const { data: historyByName } = await supabase
          .from('player_gameweek_points')
          .select('*')
          .eq('player_name', profileData.nickname)
          .order('gameweek');
        setGwHistory(historyByName || []);
      }

      // 3. Ownership count
      const { data: teams } = await supabase.from('user_teams').select('players');
      if (teams) {
        const count = teams.filter((t: any) =>
          Array.isArray(t.players) && t.players.some((p: any) => p.id === id)
        ).length;
        setOwnerCount(count);
      }

      setLoading(false);
    };

    load();

    const sub = supabase.channel(`player-profile-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'player_gameweek_points' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'player_profiles' }, load)
      .subscribe();

    return () => { supabase.removeChannel(sub); };
  }, [id]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0d0015' }}>
      <div className="w-8 h-8 rounded-full border-4 animate-spin" style={{ borderColor: '#00ff87', borderTopColor: 'transparent' }} />
    </div>
  );

  if (!profile) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0d0015' }}>
      <div className="text-center">
        <div className="text-4xl mb-3">🔍</div>
        <p className="text-white font-bold">Player not found</p>
        <a href="/players" className="mt-4 inline-block text-sm font-bold px-4 py-2 rounded-full text-black" style={{ background: '#00ff87' }}>← All Players</a>
      </div>
    </div>
  );

  const totalPts     = gwHistory.reduce((s, r) => s + (r.total_points || 0), 0);
  const totalGoals   = gwHistory.reduce((s, r) => s + (r.goals || 0), 0);
  const totalAssists = gwHistory.reduce((s, r) => s + (r.assists || 0), 0);
  const totalMins    = gwHistory.reduce((s, r) => s + (r.minutes_played || 0), 0);
  const cleanSheets  = gwHistory.filter(r => r.clean_sheet).length;
  const maxPts       = Math.max(...gwHistory.map(r => r.total_points || 0), 1);
  const deptColor    = DEPT_COLORS[profile.department] || '#555';
  const posColor     = POSITION_COLORS[profile.position] || '#888';

  return (
    <div className="min-h-screen pb-16" style={{ background: 'radial-gradient(ellipse at top,#1a0030,#0d0015)', fontFamily: "'Segoe UI',sans-serif", color: 'white' }}>

      {/* Nav */}
      <nav className="flex items-center justify-between px-5 py-3 border-b border-purple-800/30 backdrop-blur-xl" style={{ background: 'rgba(13,0,21,0.8)' }}>
        <a href="/" className="flex items-center gap-2">
          <span className="text-xl">⚽</span>
          <span className="text-white font-extrabold text-base">Dean&apos;s Games Fantasy</span>
        </a>
        <div className="flex gap-4">
          <a href="/players" className="text-purple-300 text-sm hover:text-white">← Players</a>
          <a href="/team" className="text-purple-300 text-sm hover:text-white">My Team</a>
        </div>
      </nav>

      {/* Hero banner */}
      <div className="relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${deptColor}44, rgba(0,0,0,0.6))`, borderBottom: `2px solid ${deptColor}66` }}>
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(circle at 70% 50%, white 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <div className="max-w-2xl mx-auto px-6 py-8 flex items-end gap-6 relative">
          <div className="shrink-0">
            <JerseyLarge dept={profile.department} isGK={profile.position === 'GK'} />
            {profile.shirt_number > 0 && (
              <div className="text-center -mt-2">
                <span className="font-black text-2xl text-white/80">#{profile.shirt_number}</span>
              </div>
            )}
          </div>
          <div className="pb-2 flex-1">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full uppercase text-white" style={{ background: posColor }}>
                {profile.position}
              </span>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full uppercase text-white" style={{ background: deptColor + '99', border: `1px solid ${deptColor}` }}>
                {profile.department}
              </span>
            </div>
            {/* Nickname large */}
            <h1 className="font-black text-4xl text-white leading-tight">{profile.nickname}</h1>
            {/* Full name smaller */}
            {profile.full_name !== profile.nickname && (
              <p className="text-white/50 text-sm mt-1">{profile.full_name}</p>
            )}
            <div className="flex items-center gap-6 mt-4 flex-wrap">
              <div>
                <p className="font-black text-2xl" style={{ color: '#00ff87' }}>£{profile.price.toFixed(1)}m</p>
                <p className="text-[9px] text-white/40 uppercase">Price</p>
              </div>
              <div className="w-px h-8 bg-white/10" />
              <div>
                <p className="font-black text-2xl text-white">{totalPts}</p>
                <p className="text-[9px] text-white/40 uppercase">Total Pts</p>
              </div>
              <div className="w-px h-8 bg-white/10" />
              <div>
                <p className="font-black text-2xl text-white">{gwHistory.length}</p>
                <p className="text-[9px] text-white/40 uppercase">Apps</p>
              </div>
              {profile.strong_foot && profile.strong_foot !== 'Unknown' && (
                <>
                  <div className="w-px h-8 bg-white/10" />
                  <div>
                    <p className="font-black text-xl text-white">{profile.strong_foot}</p>
                    <p className="text-[9px] text-white/40 uppercase">Strong Foot</p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 mt-6 space-y-5">

        {/* Season stats */}
        <div className="rounded-2xl overflow-hidden border border-purple-800/30" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="px-4 py-3 border-b border-purple-900/30">
            <p className="text-[10px] font-black uppercase text-purple-400 tracking-widest">Season Stats</p>
          </div>
          {gwHistory.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-3xl mb-2">📊</p>
              <p className="text-white font-bold mb-1">No stats yet</p>
              <p className="text-purple-400 text-sm">Stats appear when gameweeks are played</p>
            </div>
          ) : (
            <div className="grid grid-cols-4 divide-x divide-white/5">
              {[
                { label: 'Goals',   value: totalGoals,   icon: '⚽', color: '#00ff87'  },
                { label: 'Assists', value: totalAssists, icon: '🎯', color: '#00ccff'  },
                { label: (profile.position === 'GK' || profile.position === 'DEF') ? 'Clean Sheets' : 'Apps',
                  value: (profile.position === 'GK' || profile.position === 'DEF') ? cleanSheets : gwHistory.length,
                  icon: (profile.position === 'GK' || profile.position === 'DEF') ? '🛡️' : '⏱️',
                  color: '#818cf8' },
                { label: 'Mins',    value: totalMins,    icon: '⏱️', color: '#fbbf24'  },
              ].map(s => (
                <div key={s.label} className="px-3 py-4 text-center">
                  <p className="text-xl mb-1">{s.icon}</p>
                  <p className="font-black text-2xl" style={{ color: s.value > 0 ? s.color : 'rgba(255,255,255,0.2)' }}>{s.value}</p>
                  <p className="text-[9px] text-purple-500 uppercase mt-1">{s.label}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Ownership */}
        <div className="rounded-xl p-4 border border-purple-800/30 flex items-center justify-between" style={{ background: 'rgba(0,0,0,0.3)' }}>
          <div>
            <p className="text-white font-bold text-sm">Fantasy Ownership</p>
            <p className="text-purple-400 text-xs mt-0.5">How many managers picked this player</p>
          </div>
          <div className="text-right">
            <p className="text-white font-black text-2xl">{ownerCount}</p>
            <p className="text-purple-400 text-xs">teams</p>
          </div>
        </div>

        {/* GW points bar chart */}
        {gwHistory.length > 0 && (
          <div className="rounded-2xl overflow-hidden border border-purple-800/30" style={{ background: 'rgba(0,0,0,0.4)' }}>
            <div className="px-5 py-4 border-b border-purple-900/30">
              <p className="text-white font-extrabold text-base">Gameweek Points</p>
            </div>
            <div className="p-5">
              <div className="flex items-end gap-2 h-28">
                {gwHistory.map(row => (
                  <div key={row.gameweek} className="flex-1 flex flex-col items-center gap-1">
                    <div className="text-white text-[10px] font-bold">{row.total_points}</div>
                    <div className="w-full rounded-t-md transition-all"
                      style={{ height: `${((row.total_points || 0) / maxPts) * 96}px`, background: row.total_points === maxPts ? '#00ff87' : 'rgba(0,255,135,0.3)' }} />
                    <div className="text-purple-500 text-[9px]">GW{row.gameweek}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* GW history table */}
        {gwHistory.length > 0 && (
          <div className="rounded-2xl overflow-hidden border border-purple-800/30" style={{ background: 'rgba(0,0,0,0.4)' }}>
            <div className="px-5 py-4 border-b border-purple-900/30">
              <p className="text-white font-extrabold text-base">Match History</p>
            </div>
            <div className="grid text-purple-500 text-[9px] font-black uppercase tracking-widest px-5 py-2 border-b border-purple-900/30"
              style={{ gridTemplateColumns: '3rem 3rem 2rem 2rem 4rem 2rem 2rem 3rem' }}>
              <span>GW</span><span>Mins</span><span>G</span><span>A</span><span>CS</span><span>YC</span><span>RC</span><span className="text-right">Pts</span>
            </div>
            {gwHistory.map(row => (
              <div key={row.gameweek} className="grid items-center px-5 py-2.5 border-b border-purple-900/20 hover:bg-white/5"
                style={{ gridTemplateColumns: '3rem 3rem 2rem 2rem 4rem 2rem 2rem 3rem' }}>
                <span className="text-purple-300 text-sm font-bold">GW{row.gameweek}</span>
                <span className="text-purple-200 text-sm">{row.minutes_played}&apos;</span>
                <span className="font-bold text-sm" style={{ color: row.goals > 0 ? '#00ff87' : 'rgba(255,255,255,0.2)' }}>{row.goals}</span>
                <span className="font-bold text-sm" style={{ color: row.assists > 0 ? '#00ccff' : 'rgba(255,255,255,0.2)' }}>{row.assists}</span>
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${row.clean_sheet ? 'bg-green-900/40 text-green-400' : 'text-purple-600'}`}>
                  {row.clean_sheet ? 'Yes' : 'No'}
                </span>
                <span className="text-sm">{row.yellow_cards > 0 ? '🟨' : '—'}</span>
                <span className="text-sm">{row.red_cards > 0 ? '🟥' : '—'}</span>
                <span className="text-right font-black text-sm" style={{ color: (row.total_points||0) > 0 ? '#00ff87' : (row.total_points||0) < 0 ? '#f87171' : 'rgba(255,255,255,0.3)' }}>{row.total_points}</span>
              </div>
            ))}
            {/* Totals */}
            <div className="grid items-center px-5 py-3 border-t border-purple-800/50"
              style={{ gridTemplateColumns: '3rem 3rem 2rem 2rem 4rem 2rem 2rem 3rem', background: 'rgba(0,255,135,0.04)' }}>
              <span className="text-purple-400 text-xs font-black uppercase">Total</span>
              <span className="text-purple-200 text-xs">{totalMins}&apos;</span>
              <span className="text-xs font-black" style={{ color: '#00ff87' }}>{totalGoals}</span>
              <span className="text-xs font-black" style={{ color: '#00ccff' }}>{totalAssists}</span>
              <span></span><span></span><span></span>
              <span className="text-right font-black text-base" style={{ color: '#00ff87' }}>{totalPts}</span>
            </div>
          </div>
        )}

        {/* Player info */}
        <div className="rounded-2xl p-4 border border-purple-800/30" style={{ background: 'rgba(0,0,0,0.3)' }}>
          <p className="text-[10px] font-black uppercase text-purple-400 tracking-widest mb-3">Player Info</p>
          <div className="space-y-2">
            {[
              { label: 'Full Name',     value: profile.full_name },
              { label: 'Nickname',      value: profile.nickname },
              { label: 'Shirt Number',  value: profile.shirt_number > 0 ? `#${profile.shirt_number}` : '—' },
              { label: 'Position',      value: profile.position },
              { label: 'Department',    value: profile.department },
              { label: 'Strong Foot',   value: profile.strong_foot || '—' },
              { label: 'Current Price', value: `£${profile.price.toFixed(1)}m` },
              { label: 'Total Points',  value: `${totalPts} pts` },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
                <p className="text-sm text-purple-400">{item.label}</p>
                <p className="text-sm font-bold text-white">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        <a href="/players" className="block text-center py-3 rounded-full text-sm font-bold text-purple-300 border border-purple-700 hover:bg-purple-800/30 transition-all">
          ← Back to All Players
        </a>
      </div>
    </div>
  );
}