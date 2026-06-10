'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';

interface Match {
  id: string;
  home_dept: string;
  away_dept: string;
  home_score: number;
  away_score: number;
  status: 'scheduled'|'first_half'|'half_time'|'second_half'|'finished';
  played_at: string;
}
interface MatchLineup {
  id: string;
  match_id: string;
  player_name: string;
  position: string;
  team_side: 'home'|'away';
}

const STATUS_CONFIG = {
  scheduled:   { label:'Scheduled', bg:'rgba(139,92,246,0.15)', color:'#a78bfa', dot:'⬜' },
  first_half:  { label:'1st Half',  bg:'rgba(239,68,68,0.15)',  color:'#f87171', dot:'🔴' },
  half_time:   { label:'Half Time', bg:'rgba(234,179,8,0.15)',  color:'#fbbf24', dot:'⏸'  },
  second_half: { label:'2nd Half',  bg:'rgba(239,68,68,0.15)',  color:'#f87171', dot:'🔴' },
  finished:    { label:'Full Time', bg:'rgba(34,197,94,0.15)',   color:'#4ade80', dot:'✓'  },
};

const sBadge = (pos: string) => ({ GK:'#f59e0b',DEF:'#3b82f6',MID:'#10b981',FWD:'#ef4444' }[pos]||'#888');

export default function FixturesPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [lineups, setLineups] = useState<Record<string, MatchLineup[]>>({});
  const supabase = createClient();

  useEffect(() => {
    const load = async () => {
      const { data: m } = await supabase.from('matches').select('*').order('played_at', { ascending: false });
      setMatches(m || []);

      const { data: l } = await supabase.from('match_lineups').select('*');
      const grouped: Record<string, MatchLineup[]> = {};
      // ✅ FIX: Added explicit type (item: MatchLineup)
      l?.forEach((item: MatchLineup) => {
        if (!grouped[item.match_id]) grouped[item.match_id] = [];
        grouped[item.match_id].push(item);
      });
      setLineups(grouped);
    };
    load();

    // Subscribe to real-time changes
    const matchSub = supabase.channel('fixtures-matches')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => load())
      .subscribe();
    const lineupSub = supabase.channel('fixtures-lineups')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'match_lineups' }, () => load())
      .subscribe();

    return () => {
      supabase.removeChannel(matchSub);
      supabase.removeChannel(lineupSub);
    };
  }, []);

  return (
    <div className="min-h-screen p-4 md:p-6" style={{ background: 'radial-gradient(ellipse at top,#0d0020 0%,#080010 60%,#040008 100%)' }}>
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl md:text-4xl font-black text-white mb-2">📋 Fixtures &amp; Line-ups</h1>
        <p className="text-white/30 text-sm mb-8 font-medium">{matches.length} matches scheduled</p>

        <div className="space-y-6">
          {matches.length === 0 && (
            <div className="text-center py-20 text-white/20">
              <p className="text-6xl mb-3">⚽</p>
              <p className="font-bold">No matches scheduled yet.</p>
            </div>
          )}

          {matches.map(m => {
            const homeLineup = (lineups[m.id] || []).filter(l => l.team_side === 'home');
            const awayLineup = (lineups[m.id] || []).filter(l => l.team_side === 'away');
            const sortedHome = homeLineup.sort((a,b) => ['GK','DEF','MID','FWD'].indexOf(a.position) - ['GK','DEF','MID','FWD'].indexOf(b.position));
            const sortedAway = awayLineup.sort((a,b) => ['GK','DEF','MID','FWD'].indexOf(a.position) - ['GK','DEF','MID','FWD'].indexOf(b.position));
            const cfg = STATUS_CONFIG[m.status];

            return (
              <div key={m.id} className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))' }}>
                <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <p className="font-black text-white text-base md:text-lg">
                      {m.home_dept} <span className="text-yellow-400">vs</span> {m.away_dept}
                    </p>
                    <p className="text-white/40 text-xs">{new Date(m.played_at).toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-black px-3 py-1 rounded-full" style={{ background: cfg.bg, color: cfg.color }}>
                      {cfg.dot} {cfg.label}
                    </span>
                    {(m.status === 'finished' || m.status === 'first_half' || m.status === 'second_half' || m.status === 'half_time') && (
                      <span className="font-black text-lg text-white">{m.home_score} – {m.away_score}</span>
                    )}
                  </div>
                </div>

                <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <p className="text-white/40 text-[10px] font-black uppercase tracking-widest mb-3">{m.home_dept} (Home)</p>
                    <div className="space-y-1">
                      {sortedHome.length === 0 && <p className="text-white/20 text-xs italic">No line-up selected yet</p>}
                      {sortedHome.map(p => (
                        <div key={p.id} className="flex items-center gap-2 px-3 py-1.5 rounded" style={{ background: 'rgba(255,255,255,0.03)' }}>
                          <span className="text-[10px] font-black px-1.5 py-0.5 rounded text-white" style={{ background: sBadge(p.position) }}>{p.position}</span>
                          <span className="text-white text-sm font-bold">{p.player_name}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-white/40 text-[10px] font-black uppercase tracking-widest mb-3">{m.away_dept} (Away)</p>
                    <div className="space-y-1">
                      {sortedAway.length === 0 && <p className="text-white/20 text-xs italic">No line-up selected yet</p>}
                      {sortedAway.map(p => (
                        <div key={p.id} className="flex items-center gap-2 px-3 py-1.5 rounded" style={{ background: 'rgba(255,255,255,0.03)' }}>
                          <span className="text-[10px] font-black px-1.5 py-0.5 rounded text-white" style={{ background: sBadge(p.position) }}>{p.position}</span>
                          <span className="text-white text-sm font-bold">{p.player_name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}