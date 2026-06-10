'use client';

import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import type { User, AuthChangeEvent } from '@supabase/supabase-js';

// ─── Types ────────────────────────────────────────────────────────────────
interface Match {
  id: string;
  home_dept: string;
  away_dept: string;
  home_score: number;
  away_score: number;
  status: 'scheduled' | 'first_half' | 'half_time' | 'second_half' | 'finished';
  played_at: string;
  half_started_at?: string | null;
}
interface MatchEvent {
  id: string;
  match_id: string;
  minute: number;
  event_type: string;
  player_name: string;
  dept: string;
  fantasy_points: number;
}
interface MatchLineup {
  id: string;
  match_id: string;
  player_id: string;
  player_name: string;
  team_side: 'home' | 'away';
  position: string;
  is_substitute: boolean;
}
interface Standing {
  dept: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
}
interface TopPlayer {
  player_name: string;
  department: string;
  goals: number;
  assists: number;
  clean_sheets: number;
  total_points: number;
}
interface FPLEntry {
  rank: number;
  manager_name: string;
  department: string;
  total_points: number;
  gw_points: number;
  user_id: string;
}

// ─── Department Constants ──────────────────────────────────────────────────
const DEPT_ABBR: Record<string, string> = {
  'Philosophy': 'PHI',
  'History and Strategic Studies': 'HSS',
  'English': 'EGL',
  'Religious Studies': 'REL',
  'Linguistics': 'LIN',
  'European Language': 'EUR',
  'Creative Art': 'ART',
};

const DEPT_COLOR: Record<string, string> = {
  'Philosophy': '#1a1aff',
  'History and Strategic Studies': '#9b1c1c',
  'English': '#1e3a8a',
  'Religious Studies': '#4b0082',
  'Linguistics': '#065f46',
  'European Language': '#ff1493',
  'Creative Art': '#cc0000',
};

const EVENT_META: Record<string, { icon: string; label: string; color: string }> = {
  goal:           { icon: '⚽', label: 'Goal',          color: '#00ff87' },
  assist:         { icon: '🎯', label: 'Assist',         color: '#00ccff' },
  yellow_card:    { icon: '🟨', label: 'Yellow Card',    color: '#facc15' },
  red_card:       { icon: '🟥', label: 'Red Card',       color: '#ef4444' },
  penalty_saved:  { icon: '🧤', label: 'Penalty Saved',  color: '#a855f7' },
  penalty_missed: { icon: '❌', label: 'Penalty Missed', color: '#f97316' },
  own_goal:       { icon: '😬', label: 'Own Goal',       color: '#f43f5e' },
  clean_sheet:    { icon: '🛡️', label: 'Clean Sheet',    color: '#818cf8' },
};

const POSITION_ORDER = ['GK', 'DEF', 'MID', 'FWD'];
const POSITION_LABELS: Record<string, string> = {
  GK: 'Goalkeepers',
  DEF: 'Defenders',
  MID: 'Midfielders',
  FWD: 'Forwards'
};

function abbr(dept: string) { return DEPT_ABBR[dept] || dept.slice(0, 3).toUpperCase(); }
function color(dept: string) { return DEPT_COLOR[dept] || '#555'; }

function DeptBadge({ dept, size = 'md' }: { dept: string; size?: 'sm' | 'md' }) {
  const sz = size === 'sm' ? 'w-6 h-6 text-[9px]' : 'w-8 h-8 text-[10px]';
  return (
    <span className={`inline-flex items-center justify-center ${sz} rounded-full text-white font-black shadow-lg shrink-0`}
      style={{ background: `linear-gradient(135deg, ${color(dept)}, ${color(dept)}cc)` }}>
      {abbr(dept)}
    </span>
  );
}

function computeStandings(matches: Match[]): Standing[] {
  const map: Record<string, Standing> = {};
  const ensure = (dept: string) => {
    if (!map[dept]) map[dept] = { dept, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0 };
  };
  matches.filter(m => m.status === 'finished').forEach(m => {
    ensure(m.home_dept); ensure(m.away_dept);
    const h = map[m.home_dept], a = map[m.away_dept];
    h.played++; a.played++;
    h.gf += m.home_score; h.ga += m.away_score;
    a.gf += m.away_score; a.ga += m.home_score;
    if (m.home_score > m.away_score) { h.won++; h.points += 3; a.lost++; }
    else if (m.home_score < m.away_score) { a.won++; a.points += 3; h.lost++; }
    else { h.drawn++; a.drawn++; h.points++; a.points++; }
  });
  return Object.values(map)
    .map(s => ({ ...s, gd: s.gf - s.ga }))
    .sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf);
}

type Tab = 'fpl' | 'standings' | 'scorers' | 'assists' | 'cleansheets' | 'results';

export default function LeaderboardPage() {
  const [tab, setTab] = useState<Tab>('fpl');
  const [user, setUser] = useState<User | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [lineups, setLineups] = useState<MatchLineup[]>([]);
  const [players, setPlayers] = useState<TopPlayer[]>([]);
  const [fpl, setFpl] = useState<FPLEntry[]>([]);
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const tabsRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    const u = session?.user ?? null;
    setUser(u);

    if (u) {
      const { data: adminRow } = await supabase
        .from('admin_users')
        .select('id')
        .eq('id', u.id)
        .maybeSingle();
      const isOwner = u.id === '5d7a7bda-c1cc-4878-8d23-362df8f70ef1';
      setIsAdmin(isOwner || !!adminRow);
    } else {
      setIsAdmin(false);
    }

    const { data: matchData } = await supabase
      .from('matches').select('*').order('played_at', { ascending: false });
    setMatches(matchData || []);

    const { data: evData } = await supabase
      .from('match_events').select('*').order('minute');
    setEvents(evData || []);

    const { data: lineupData } = await supabase
      .from('match_lineups').select('*');
    setLineups(lineupData || []);

    const { data: gwData } = await supabase
      .from('player_gameweek_points')
      .select('player_name, position, goals, assists, clean_sheet, total_points');

    if (gwData && gwData.length > 0) {
      const pmap: Record<string, TopPlayer & { dept_raw?: string }> = {};
      gwData.forEach((row: any) => {
        if (!pmap[row.player_name]) {
          pmap[row.player_name] = { player_name: row.player_name, department: '', goals: 0, assists: 0, clean_sheets: 0, total_points: 0 };
        }
        pmap[row.player_name].goals += row.goals || 0;
        pmap[row.player_name].assists += row.assists || 0;
        pmap[row.player_name].clean_sheets += row.clean_sheet ? 1 : 0;
        pmap[row.player_name].total_points += row.total_points || 0;
      });
      const { data: prices } = await supabase.from('player_prices').select('name, department');
      (prices || []).forEach((p: any) => { if (pmap[p.name]) pmap[p.name].department = p.department; });
      setPlayers(Object.values(pmap).filter(p => p.department));
    }

    const { data: teams } = await supabase
      .from('user_teams')
      .select('user_id, gw_points, total_points, captain_id, players, formation');
    const { data: usersData } = await supabase
      .from('users').select('id, name, department');
    const { data: tw } = await supabase.from('transfer_window').select('gameweek').eq('id', 1).single();
    const currentGw = tw?.gameweek || 1;
    const { data: allGwPts } = await supabase
      .from('player_gameweek_points')
      .select('player_name, total_points')
      .eq('gameweek', currentGw);
    const gwPtsMap: Record<string, number> = {};
    (allGwPts || []).forEach((r: any) => { gwPtsMap[r.player_name] = r.total_points || 0; });

    const userMap: Record<string, any> = {};
    (usersData || []).forEach((u: any) => { userMap[u.id] = u; });

    const entries: FPLEntry[] = (teams || [])
      .map((t: any) => {
        const u = userMap[t.user_id];
        const squadPlayers: any[] = t.players || [];
        const liveGwPoints = squadPlayers
          .filter((p: any) => !p.isBench)
          .reduce((sum: number, p: any) => {
            const raw = gwPtsMap[p.name] ?? 0;
            return sum + (t.captain_id === p.id ? raw * 2 : raw);
          }, 0);
        return {
          user_id: t.user_id,
          manager_name: u?.name || 'Unknown',
          department: u?.department || 'Unknown',
          total_points: t.total_points || 0,
          gw_points: liveGwPoints,
          rank: 0,
        };
      })
      .sort((a: FPLEntry, b: FPLEntry) => b.total_points - a.total_points || b.gw_points - a.gw_points)
      .map((e: FPLEntry, i: number) => ({ ...e, rank: i + 1 }));

    setFpl(entries);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const supabase = createClient();
    const matchSub = supabase.channel('lb-matches')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'match_events' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'match_lineups' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'player_gameweek_points' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_teams' }, load)
      .subscribe();
    // ✅ FIX: Explicitly type the '_' parameter as AuthChangeEvent
    const authSub = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session) => setUser(session?.user ?? null));
    return () => {
      supabase.removeChannel(matchSub);
      authSub.data.subscription.unsubscribe();
    };
  }, []);

  const standings = computeStandings(matches);
  const topScorers = [...players].sort((a, b) => b.goals - a.goals).filter(p => p.goals > 0).slice(0, 10);
  const topAssists = [...players].sort((a, b) => b.assists - a.assists).filter(p => p.assists > 0).slice(0, 10);
  const topClean   = [...players].sort((a, b) => b.clean_sheets - a.clean_sheets).filter(p => p.clean_sheets > 0).slice(0, 10);
  const liveMatches     = matches.filter(m => m.status === 'first_half' || m.status === 'half_time' || m.status === 'second_half');
  const finishedMatches = matches.filter(m => m.status === 'finished');
  const upcomingMatches = matches.filter(m => m.status === 'scheduled');

  const getMatchEvents = (matchId: string) => events.filter(e => e.match_id === matchId).sort((a, b) => a.minute - b.minute);
  const getMatchLineups = (matchId: string, side: 'home' | 'away') => 
    lineups
      .filter(l => l.match_id === matchId && l.team_side === side)
      .sort((a, b) => POSITION_ORDER.indexOf(a.position) - POSITION_ORDER.indexOf(b.position));

  const toggleMatchExpansion = (matchId: string) => {
    setExpandedMatchId(prev => prev === matchId ? null : matchId);
  };

  const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: 'fpl',         label: 'FPL Rankings', icon: '👑' },
    { key: 'standings',   label: 'Standings',     icon: '🏆' },
    { key: 'scorers',     label: 'Top Scorers',   icon: '⚽' },
    { key: 'assists',     label: 'Assists',        icon: '🎯' },
    { key: 'cleansheets', label: 'Clean Sheets',  icon: '🧤' },
    { key: 'results',     label: 'Results',        icon: '📋' },
  ];

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0a1128] via-[#0d1b3e] to-[#0a1128]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-14 h-14 rounded-full border-4 border-yellow-400/30 border-t-yellow-400 animate-spin" />
        <p className="text-yellow-300 font-bold text-sm tracking-widest uppercase">Loading Leaderboard</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen text-white relative" style={{ background: 'radial-gradient(ellipse at top, #0d1b3e, #0a1128)' }}>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 -left-20 w-72 h-72 bg-blue-900/30 rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-10 w-72 h-72 bg-yellow-900/10 rounded-full blur-3xl" />
      </div>

      {/* Nav */}
      <nav className="relative z-20 backdrop-blur-xl bg-[#0d1b3e]/70 border-b border-blue-500/10 shadow-lg">
        <div className="flex items-center justify-between px-5 py-3">
          <a href="/" className="flex items-center gap-2">
            <span className="text-2xl">⚽</span>
            <span className="font-extrabold text-base bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent">Dean&apos;s Cup Fantasy</span>
          </a>
          <div className="flex items-center gap-4">
            <a href="/team" className="text-blue-300/80 text-sm hover:text-yellow-400 transition-colors">My Team</a>
            <span className="text-yellow-400 text-sm font-semibold">Leaderboard</span>
            <a href="/profile" className="text-blue-300/80 text-sm hover:text-yellow-400 transition-colors">Profile</a>
            {isAdmin && (
              <a href="/admin" className="text-yellow-400/80 text-sm hover:text-yellow-400 transition-colors font-bold">
                Admin
              </a>
            )}
          </div>
        </div>
      </nav>

      {/* Live ticker */}
      {liveMatches.length > 0 && (
        <div className="relative z-10 px-4 py-2 border-b border-red-900/30 bg-red-950/10 backdrop-blur-sm">
          <div className="max-w-4xl mx-auto flex items-center gap-3 overflow-x-auto scrollbar-hide">
            <span className="flex items-center gap-1.5 text-xs font-black text-red-400 shrink-0 animate-pulse">
              <span className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_#ef4444]" /> LIVE
            </span>
            {liveMatches.map(m => (
              <button key={m.id} onClick={() => toggleMatchExpansion(m.id)}
                className="flex items-center gap-2 shrink-0 rounded-xl px-3 py-1.5 bg-white/5 hover:bg-white/10 transition-all border border-white/5">
                <span className="text-white text-xs font-bold">{abbr(m.home_dept)}</span>
                <span className="text-white font-black text-sm">{m.home_score} – {m.away_score}</span>
                <span className="text-white text-xs font-bold">{abbr(m.away_dept)}</span>
                <span className="text-red-300 text-[10px] font-semibold">▶</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 py-8 relative z-10">
        <div className="mb-6">
          <h1 className="text-white font-extrabold text-4xl tracking-tight">Leaderboard</h1>
          <p className="text-blue-400/70 text-sm mt-1">Dean&apos;s Cup 2025/26 · All Departments</p>
        </div>

        <div ref={tabsRef} className="flex gap-2 mb-6 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-2 -mx-1 px-1">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className="snap-center shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-full text-xs font-bold whitespace-nowrap transition-all duration-300 transform hover:scale-105"
              style={{
                background: tab === t.key ? 'linear-gradient(135deg, #eab308, #ca8a04)' : 'rgba(255,255,255,0.04)',
                color: tab === t.key ? '#0a1128' : '#93c5fd',
                border: tab === t.key ? 'none' : '1px solid rgba(255,255,255,0.06)',
                boxShadow: tab === t.key ? '0 4px 15px rgba(234,179,8,0.3)' : 'none'
              }}>
              <span>{t.icon}</span><span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* ── FPL RANKINGS ── */}
        {tab === 'fpl' && (
          <div className="space-y-4">
            {fpl.length === 0 ? (
              <EmptyState icon="👑" message="No fantasy teams submitted yet" sub="Users need to save their teams first" />
            ) : (
              <>
                {fpl.length >= 3 && (
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    {fpl.slice(0, 3).map((e, i) => (
                      <div key={e.user_id} className="rounded-3xl p-4 text-center relative overflow-hidden backdrop-blur-sm transition-transform hover:scale-105"
                        style={{
                          background: i === 0 ? 'linear-gradient(145deg, #fbbf24, #f59e0b)' : i === 1 ? 'linear-gradient(145deg, #94a3b8, #64748b)' : 'linear-gradient(145deg, #b45309, #92400e)',
                          border: i === 0 ? '1px solid #fcd34d' : i === 1 ? '1px solid #cbd5e1' : '1px solid #ea580c',
                          transform: i === 0 ? 'scale(1.05)' : 'scale(1)',
                          zIndex: i === 0 ? 2 : 1,
                          boxShadow: i === 0 ? '0 10px 30px -5px rgba(251,191,36,0.4)' : i === 1 ? '0 5px 15px rgba(0,0,0,0.3)' : '0 5px 15px rgba(0,0,0,0.3)'
                        }}>
                        <div className="text-3xl mb-1">{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</div>
                        <DeptBadge dept={e.department} size="sm" />
                        <div className="text-white font-extrabold text-sm mt-2 truncate drop-shadow">{e.manager_name}</div>
                        <div className="text-white/80 text-[10px] truncate">{e.department}</div>
                        <div className="font-black text-2xl mt-2 text-white drop-shadow-lg">{e.total_points}</div>
                        <div className="text-white/60 text-[10px]">total pts</div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="rounded-3xl overflow-hidden backdrop-blur-md bg-black/30 border border-white/5 shadow-2xl">
                  <div className="grid text-blue-300 text-[10px] font-black uppercase tracking-widest px-5 py-3 border-b border-blue-700/20 bg-white/[0.02]"
                    style={{ gridTemplateColumns: '2.5rem 1fr auto 3.5rem 3.5rem' }}>
                    <span>Rank</span><span>Manager</span><span className="pr-3">Dept</span>
                    <span className="text-right">GW</span><span className="text-right">Total</span>
                  </div>
                  {fpl.map((e, i) => {
                    const isMe = user?.id === e.user_id;
                    return (
                      <div key={e.user_id} className="grid items-center px-5 py-3 border-b border-blue-900/10 hover:bg-white/[0.02] transition-all"
                        style={{ gridTemplateColumns: '2.5rem 1fr auto 3.5rem 3.5rem', background: isMe ? 'linear-gradient(90deg, rgba(234,179,8,0.1), transparent)' : 'transparent', borderLeft: isMe ? '3px solid #eab308' : '3px solid transparent' }}>
                        <span className={`font-black text-sm ${i < 3 ? 'text-yellow-400' : 'text-blue-400'}`}>{i + 1}</span>
                        <div className="min-w-0 pr-2">
                          <div className="flex items-center gap-1.5">
                            <span className="text-white font-bold text-sm truncate">{e.manager_name}</span>
                            {isMe && <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-yellow-400/20 text-yellow-400 border border-yellow-400/30">YOU</span>}
                          </div>
                          <div className="text-blue-500/80 text-xs truncate">{e.department}</div>
                        </div>
                        <div className="pr-3"><DeptBadge dept={e.department} size="sm" /></div>
                        <div className="text-right text-blue-300/90 text-sm">{e.gw_points}</div>
                        <div className="text-right font-black text-base text-yellow-400">{e.total_points}</div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
            {!user && (
              <div className="rounded-3xl px-5 py-4 text-center border border-blue-500/20 bg-black/20 backdrop-blur-sm">
                <p className="text-blue-300 text-sm mb-3">Sign in to see your rank highlighted</p>
                <a href="/auth" className="inline-block px-6 py-2 rounded-full font-bold bg-yellow-400 text-black shadow-lg shadow-yellow-400/20 hover:shadow-yellow-400/40 transition-all">
                  Sign In
                </a>
              </div>
            )}
          </div>
        )}

        {/* ── STANDINGS ── */}
        {tab === 'standings' && (
          standings.length === 0 ? (
            <EmptyState icon="🏆" message="No finished matches yet" sub="Standings update automatically when matches end" />
          ) : (
            <div className="rounded-3xl overflow-hidden backdrop-blur-md bg-black/30 border border-white/5 shadow-2xl">
              <div className="grid text-blue-300 text-[10px] font-black uppercase tracking-widest px-5 py-3 border-b border-blue-700/20 bg-white/[0.02]"
                style={{ gridTemplateColumns: '2rem 1fr 2.5rem 2.5rem 2.5rem 2.5rem 2.5rem 2.5rem 2.5rem 3rem' }}>
                <span>#</span><span>Dept</span>
                <span className="text-center">P</span><span className="text-center">W</span>
                <span className="text-center">D</span><span className="text-center">L</span>
                <span className="text-center">GF</span><span className="text-center">GA</span>
                <span className="text-center">GD</span><span className="text-center">Pts</span>
              </div>
              {standings.map((s, i) => (
                <div key={s.dept} className="grid items-center px-5 py-3 border-b border-blue-900/10 hover:bg-white/[0.02] transition-all"
                  style={{ gridTemplateColumns: '2rem 1fr 2.5rem 2.5rem 2.5rem 2.5rem 2.5rem 2.5rem 2.5rem 3rem', borderLeft: i < 2 ? '3px solid #eab308' : i >= standings.length - 1 ? '3px solid #ef4444' : '3px solid transparent' }}>
                  <span className="text-blue-400 font-black text-sm">{i + 1}</span>
                  <div className="flex items-center gap-2 min-w-0">
                    <DeptBadge dept={s.dept} size="sm" />
                    <span className="text-white font-bold text-sm truncate hidden sm:block">{s.dept}</span>
                    <span className="text-white font-bold text-sm sm:hidden">{abbr(s.dept)}</span>
                  </div>
                  {[s.played, s.won, s.drawn, s.lost, s.gf, s.ga].map((v, vi) => (
                    <span key={vi} className="text-center text-blue-200 text-sm">{v}</span>
                  ))}
                  <span className={`text-center text-sm font-semibold ${s.gd > 0 ? 'text-yellow-400' : s.gd < 0 ? 'text-red-400' : 'text-blue-300'}`}>
                    {s.gd > 0 ? `+${s.gd}` : s.gd}
                  </span>
                  <span className="text-center font-black text-base text-yellow-400">{s.points}</span>
                </div>
              ))}
              <div className="flex gap-6 px-5 py-3">
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-yellow-400" /><span className="text-blue-400 text-xs">Promotion</span></div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-red-500" /><span className="text-blue-400 text-xs">Relegation</span></div>
              </div>
            </div>
          )
        )}

        {tab === 'scorers' && <StatTable players={topScorers} stat="goals" label="Top Scorers" icon="⚽" color="#eab308" />}
        {tab === 'assists' && <StatTable players={topAssists} stat="assists" label="Top Assists" icon="🎯" color="#3b82f6" />}
        {tab === 'cleansheets' && <StatTable players={topClean} stat="clean_sheets" label="Clean Sheets" icon="🧤" color="#818cf8" />}

        {/* ── RESULTS (Live & Lineups) ── */}
        {tab === 'results' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-blue-400 text-sm font-black uppercase tracking-widest">All Fixtures & Results</h2>
              <span className="text-blue-400/50 text-xs">{matches.length} matches</span>
            </div>

            {/* Live Matches */}
            {liveMatches.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                  <span className="text-red-400 text-xs font-black uppercase tracking-widest">Live Now</span>
                </div>
                {liveMatches.map(m => <ExpandableMatchCard key={m.id} match={m} events={getMatchEvents(m.id)} lineups={lineups} isExpanded={expandedMatchId === m.id} onToggle={toggleMatchExpansion} />)}
              </div>
            )}

            {/* Finished Matches */}
            {finishedMatches.length > 0 && (
              <div>
                <div className="text-blue-400 text-xs font-black uppercase tracking-widest mb-2">Recent Results</div>
                {finishedMatches.map(m => <ExpandableMatchCard key={m.id} match={m} events={getMatchEvents(m.id)} lineups={lineups} isExpanded={expandedMatchId === m.id} onToggle={toggleMatchExpansion} />)}
              </div>
            )}

            {/* Upcoming Matches */}
            {upcomingMatches.length > 0 && (
              <div>
                <div className="text-blue-400 text-xs font-black uppercase tracking-widest mb-2">Upcoming Fixtures</div>
                {upcomingMatches.map(m => <ExpandableMatchCard key={m.id} match={m} events={getMatchEvents(m.id)} lineups={lineups} isExpanded={expandedMatchId === m.id} onToggle={toggleMatchExpansion} />)}
              </div>
            )}

            {matches.length === 0 && <EmptyState icon="📋" message="No matches yet" sub="Matches will appear here once scheduled by admin" />}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Expandable Match Card ──────────────────────────────────────────────────
function ExpandableMatchCard({ match, events, lineups, isExpanded, onToggle }: { match: Match; events: MatchEvent[]; lineups: MatchLineup[]; isExpanded: boolean; onToggle: (id: string) => void }) {
  const isLive = ['first_half', 'half_time', 'second_half'].includes(match.status);
  const isScheduled = match.status === 'scheduled';
  const date = new Date(match.played_at);
  
  const homeLineup = lineups
    .filter(l => l.match_id === match.id && l.team_side === 'home')
    .sort((a, b) => POSITION_ORDER.indexOf(a.position) - POSITION_ORDER.indexOf(b.position));
  const awayLineup = lineups
    .filter(l => l.match_id === match.id && l.team_side === 'away')
    .sort((a, b) => POSITION_ORDER.indexOf(a.position) - POSITION_ORDER.indexOf(b.position));

  return (
    <div className="mb-3">
      <button onClick={() => onToggle(match.id)} className="w-full text-left group">
        <div className={`rounded-2xl px-4 py-3 transition-all duration-300 backdrop-blur-sm ${
          isExpanded ? 'bg-yellow-400/10 border-yellow-400/30 shadow-lg shadow-yellow-400/10' :
          isLive ? 'bg-red-950/20 border-red-500/20' : 'bg-black/20 border-white/5'
        } border`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-1 justify-end">
              <span className="text-white font-bold text-sm text-right hidden sm:block">{match.home_dept}</span>
              <span className="text-white font-bold text-xs sm:hidden">{abbr(match.home_dept)}</span>
              <DeptBadge dept={match.home_dept} size="sm" />
            </div>
            <div className="mx-3 text-center min-w-[90px]">
              {isScheduled ? (
                <div>
                  <div className="text-blue-300/80 text-xs">{date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</div>
                  <div className="font-black text-sm text-yellow-400">{date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
              ) : (
                <div>
                  <div className="font-black text-xl text-white">{match.home_score} – {match.away_score}</div>
                  {isLive ? (
                    <div className="flex items-center justify-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                      <span className="text-red-400 text-[10px] font-black">LIVE</span>
                    </div>
                  ) : (
                    <div className="text-blue-400 text-[10px]">FT</div>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 flex-1">
              <DeptBadge dept={match.away_dept} size="sm" />
              <span className="text-white font-bold text-sm hidden sm:block">{match.away_dept}</span>
              <span className="text-white font-bold text-xs sm:hidden">{abbr(match.away_dept)}</span>
            </div>
            <div className="shrink-0 pl-2">
              <span className={`text-xs transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
            </div>
          </div>
        </div>
      </button>

      {/* Expanded Detail Section */}
      {isExpanded && (
        <div className="mt-2 rounded-2xl border border-white/5 bg-black/40 backdrop-blur-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          <div className="p-4 space-y-6">
            {/* Lineups Section */}
            <div>
              <h3 className="text-blue-400 text-[10px] font-black uppercase tracking-widest mb-3">Lineups</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-white/60 text-xs font-bold mb-2">{match.home_dept}</p>
                  {homeLineup.length === 0 ? (
                    <p className="text-blue-400/40 text-xs italic">No lineup selected</p>
                  ) : (
                    <div className="space-y-2">
                      {POSITION_ORDER.map(pos => {
                        const players = homeLineup.filter(p => p.position === pos);
                        if (players.length === 0) return null;
                        return (
                          <div key={pos}>
                            <p className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-1">{POSITION_LABELS[pos]}</p>
                            <div className="flex flex-wrap gap-1">
                              {players.map(p => (
                                <span key={p.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white/5 text-white text-xs">
                                  <span className="text-[10px] font-black px-1 rounded bg-white/10">{p.position}</span>
                                  {p.player_name}
                                </span>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-white/60 text-xs font-bold mb-2">{match.away_dept}</p>
                  {awayLineup.length === 0 ? (
                    <p className="text-blue-400/40 text-xs italic">No lineup selected</p>
                  ) : (
                    <div className="space-y-2">
                      {POSITION_ORDER.map(pos => {
                        const players = awayLineup.filter(p => p.position === pos);
                        if (players.length === 0) return null;
                        return (
                          <div key={pos}>
                            <p className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-1">{POSITION_LABELS[pos]}</p>
                            <div className="flex flex-wrap gap-1">
                              {players.map(p => (
                                <span key={p.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white/5 text-white text-xs">
                                  <span className="text-[10px] font-black px-1 rounded bg-white/10">{p.position}</span>
                                  {p.player_name}
                                </span>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Match Events Section */}
            {!isScheduled && (
              <div>
                <h3 className="text-blue-400 text-[10px] font-black uppercase tracking-widest mb-3">Match Events</h3>
                {events.length === 0 ? (
                  <p className="text-blue-400/40 text-xs italic text-center py-2">No events recorded yet</p>
                ) : (
                  <div className="space-y-1">
                    {events.map(ev => {
                      const meta = EVENT_META[ev.event_type] || { icon: '•', label: ev.event_type, color: '#fff' };
                      const isHome = ev.dept === match.home_dept;
                      return (
                        <div key={ev.id} className={`flex items-center gap-3 ${isHome ? 'flex-row' : 'flex-row-reverse'}`}>
                          <div className="w-10 text-center shrink-0">
                            <span className="text-blue-400 text-xs font-black">{ev.minute}&apos;</span>
                          </div>
                          <div className={`flex items-center gap-2 rounded-2xl px-3 py-2 flex-1 backdrop-blur-sm ${isHome ? '' : 'justify-end'}`}
                            style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${meta.color}20` }}>
                            <span className="text-lg">{meta.icon}</span>
                            <div className={isHome ? 'text-left' : 'text-right'}>
                              <div className="text-white text-sm font-bold">{ev.player_name}</div>
                              <span className="text-xs font-semibold" style={{ color: meta.color }}>{meta.label}</span>
                              {ev.fantasy_points !== 0 && (
                                <span className="ml-2 text-[10px] font-black px-1.5 py-0.5 rounded-full"
                                  style={{ background: `${meta.color}20`, color: meta.color }}>
                                  {ev.fantasy_points > 0 ? '+' : ''}{ev.fantasy_points} pts
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="w-2 h-2 rounded-full shrink-0" style={{ background: meta.color, boxShadow: `0 0 6px ${meta.color}` }} />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────
function EmptyState({ icon, message, sub }: { icon: string; message: string; sub: string }) {
  return (
    <div className="rounded-3xl p-12 text-center backdrop-blur-sm bg-black/20 border border-dashed border-blue-500/20">
      <div className="text-5xl mb-4">{icon}</div>
      <p className="text-white font-bold text-xl mb-2">{message}</p>
      <p className="text-blue-400/80 text-sm">{sub}</p>
    </div>
  );
}

// ─── Stat Table ──────────────────────────────────────────────────────────────
function StatTable({ players, stat, label, icon, color }: { players: TopPlayer[]; stat: keyof TopPlayer; label: string; icon: string; color: string }) {
  if (players.length === 0) return <EmptyState icon={icon} message={`No ${label.toLowerCase()} logged yet`} sub="Stats appear after admin logs player data" />;
  return (
    <div className="rounded-3xl overflow-hidden backdrop-blur-md bg-black/30 border border-white/5 shadow-2xl">
      <div className="px-5 py-4 border-b border-blue-500/20 flex items-center gap-3 bg-white/[0.02]">
        <span className="text-2xl">{icon}</span>
        <div>
          <h2 className="text-white font-extrabold text-lg">{label}</h2>
          <p className="text-blue-400/70 text-xs">Dean&apos;s Cup 2025/26</p>
        </div>
      </div>
      <div className="grid text-blue-300 text-[10px] font-black uppercase tracking-widest px-5 py-2 border-b border-blue-900/20"
        style={{ gridTemplateColumns: '2rem 1fr auto auto' }}>
        <span>#</span><span>Player</span><span className="pr-4">Dept</span><span className="text-right">{label.split(' ').pop()}</span>
      </div>
      {players.map((p, i) => (
        <div key={p.player_name} className="grid items-center px-5 py-3 border-b border-blue-900/10 hover:bg-white/[0.02] transition-all"
          style={{ gridTemplateColumns: '2rem 1fr auto auto' }}>
          <span className={`font-black text-sm ${i === 0 ? 'text-yellow-400' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-amber-700' : 'text-blue-400'}`}>
            {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
          </span>
          <div>
            <div className="text-white font-bold text-sm">{p.player_name}</div>
            <div className="text-blue-400/70 text-xs">{p.department}</div>
          </div>
          <div className="pr-4"><DeptBadge dept={p.department} size="sm" /></div>
          <div className="text-right font-black text-2xl" style={{ color }}>{p[stat] as number}</div>
        </div>
      ))}
    </div>
  );
}