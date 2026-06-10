'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

const ALL_PLAYERS = [
  { id: 'p1',  name: 'Ariyo',       position: 'GK',  department: 'Philosophy', price: 5.0 },
  { id: 'p2',  name: 'Dee Joe',     position: 'GK',  department: 'Philosophy', price: 4.5 },
  { id: 'p3',  name: 'Akinpelu',    position: 'DEF', department: 'Philosophy', price: 5.0 },
  { id: 'p4',  name: 'Balogun',     position: 'DEF', department: 'Philosophy', price: 4.5 },
  { id: 'p5',  name: 'Daniel',      position: 'DEF', department: 'Philosophy', price: 4.5 },
  { id: 'p6',  name: 'Dexter',      position: 'DEF', department: 'Philosophy', price: 4.0 },
  { id: 'p7',  name: 'Chizoba',     position: 'DEF', department: 'Philosophy', price: 5.5 },
  { id: 'p8',  name: 'Ogunyemi',    position: 'DEF', department: 'Philosophy', price: 4.5 },
  { id: 'p9',  name: 'Shabalaky',   position: 'DEF', department: 'Philosophy', price: 4.5 },
  { id: 'p10', name: 'Dotun',       position: 'MID', department: 'Philosophy', price: 6.0 },
  { id: 'p11', name: 'Olise',       position: 'MID', department: 'Philosophy', price: 7.0 },
  { id: 'p12', name: 'Mustapha',    position: 'MID', department: 'Philosophy', price: 5.5 },
  { id: 'p13', name: 'Simon',       position: 'MID', department: 'Philosophy', price: 5.5 },
  { id: 'p14', name: 'Mubarak',     position: 'MID', department: 'Philosophy', price: 5.0 },
  { id: 'p15', name: 'Remedy',      position: 'MID', department: 'Philosophy', price: 5.0 },
  { id: 'p16', name: 'Sulaimon',    position: 'MID', department: 'Philosophy', price: 5.5 },
  { id: 'p17', name: 'Bolaji',      position: 'FWD', department: 'Philosophy', price: 7.0 },
  { id: 'p18', name: 'Chuks',       position: 'FWD', department: 'Philosophy', price: 7.5 },
  { id: 'p19', name: 'Prime',       position: 'FWD', department: 'Philosophy', price: 8.5 },
  { id: 'p20', name: 'James',       position: 'FWD', department: 'Philosophy', price: 6.0 },
  { id: 'p21', name: 'Ogo',         position: 'FWD', department: 'Philosophy', price: 6.5 },
  { id: 'p22', name: 'Zion',        position: 'FWD', department: 'Philosophy', price: 6.0 },
  { id: 'h1',  name: 'Alisson B',   position: 'GK',  department: 'History and Strategic Studies', price: 5.0 },
  { id: 'h2',  name: 'Van Dijk',    position: 'DEF', department: 'History and Strategic Studies', price: 5.5 },
  { id: 'h3',  name: 'S. Ramos',    position: 'DEF', department: 'History and Strategic Studies', price: 5.0 },
  { id: 'h4',  name: 'T. Silva',    position: 'DEF', department: 'History and Strategic Studies', price: 5.0 },
  { id: 'h5',  name: 'De Bruyne',   position: 'MID', department: 'History and Strategic Studies', price: 8.0 },
  { id: 'h6',  name: 'Modric',      position: 'MID', department: 'History and Strategic Studies', price: 6.5 },
  { id: 'h7',  name: 'Kroos',       position: 'MID', department: 'History and Strategic Studies', price: 6.0 },
  { id: 'h8',  name: 'Lewandowski', position: 'FWD', department: 'History and Strategic Studies', price: 8.0 },
  { id: 'h9',  name: 'Benzema',     position: 'FWD', department: 'History and Strategic Studies', price: 7.5 },
  { id: 'c1',  name: 'Donnarumma',  position: 'GK',  department: 'Creative Art', price: 5.0 },
  { id: 'c2',  name: 'Marquinhos',  position: 'DEF', department: 'Creative Art', price: 5.5 },
  { id: 'c3',  name: 'Hakimi',      position: 'DEF', department: 'Creative Art', price: 5.5 },
  { id: 'c4',  name: 'Vinicius',    position: 'FWD', department: 'Creative Art', price: 8.5 },
  { id: 'c5',  name: 'Neymar',      position: 'FWD', department: 'Creative Art', price: 8.0 },
  { id: 'c6',  name: 'Leao',        position: 'FWD', department: 'Creative Art', price: 7.0 },
  { id: 'c7',  name: 'Pedri',       position: 'MID', department: 'Creative Art', price: 6.5 },
  { id: 'c8',  name: 'Gavi',        position: 'MID', department: 'Creative Art', price: 6.0 },
  { id: 'e1',  name: 'Pickford',    position: 'GK',  department: 'English', price: 4.5 },
  { id: 'e2',  name: 'Maguire',     position: 'DEF', department: 'English', price: 4.5 },
  { id: 'e3',  name: 'Stones',      position: 'DEF', department: 'English', price: 5.0 },
  { id: 'e4',  name: 'Saka',        position: 'MID', department: 'English', price: 7.5 },
  { id: 'e5',  name: 'Foden',       position: 'MID', department: 'English', price: 7.5 },
  { id: 'e6',  name: 'Bellingham',  position: 'MID', department: 'English', price: 8.0 },
  { id: 'e7',  name: 'Kane',        position: 'FWD', department: 'English', price: 8.5 },
  { id: 'e8',  name: 'Rashford',    position: 'FWD', department: 'English', price: 6.5 },
  { id: 'l1',  name: 'Courtois',    position: 'GK',  department: 'Linguistic', price: 5.0 },
  { id: 'l2',  name: 'Rudiger',     position: 'DEF', department: 'Linguistic', price: 5.0 },
  { id: 'l3',  name: 'Alaba',       position: 'DEF', department: 'Linguistic', price: 5.0 },
  { id: 'l4',  name: 'Gundogan',    position: 'MID', department: 'Linguistic', price: 6.5 },
  { id: 'l5',  name: 'Rodri',       position: 'MID', department: 'Linguistic', price: 7.0 },
  { id: 'l6',  name: 'Mbappe',      position: 'FWD', department: 'Linguistic', price: 9.0 },
  { id: 'l7',  name: 'Haaland',     position: 'FWD', department: 'Linguistic', price: 9.0 },
  { id: 'r1',  name: 'Alisson',     position: 'GK',  department: 'Religious Studies', price: 5.0 },
  { id: 'r2',  name: 'T. SilvaR',   position: 'DEF', department: 'Religious Studies', price: 5.0 },
  { id: 'r3',  name: 'Koulibaly',   position: 'DEF', department: 'Religious Studies', price: 5.0 },
  { id: 'r4',  name: 'Salah',       position: 'FWD', department: 'Religious Studies', price: 9.0 },
  { id: 'r5',  name: 'Mane',        position: 'FWD', department: 'Religious Studies', price: 7.0 },
  { id: 'r6',  name: 'Messi',       position: 'FWD', department: 'Religious Studies', price: 9.0 },
  { id: 'r7',  name: 'Pogba',       position: 'MID', department: 'Religious Studies', price: 6.5 },
  { id: 'r8',  name: 'Kante',       position: 'MID', department: 'Religious Studies', price: 6.0 },
];

const DEPT_COLORS: Record<string, { shirt: string; sleeve: string }> = {
  'Philosophy':                    { shirt: '#1a3aff', sleeve: '#0022cc' },
  'History and Strategic Studies': { shirt: '#cc0000', sleeve: '#990000' },
  'Creative Art':                  { shirt: '#ff6600', sleeve: '#cc5200' },
  'English':                       { shirt: '#e8e8e8', sleeve: '#cccccc' },
  'Linguistic':                     { shirt: '#006400', sleeve: '#004d00' },
  'Religious Studies':             { shirt: '#7b0000', sleeve: '#5a0000' },
};

const POS_COLOR: Record<string, string> = { GK: '#f59e0b', DEF: '#3b82f6', MID: '#10b981', FWD: '#ef4444' };

function JerseyBig({ dept, isGK }: { dept: string; isGK?: boolean }) {
  const c = DEPT_COLORS[dept] || { shirt: '#555', sleeve: '#333' };
  const shirt = isGK ? '#3d9970' : c.shirt;
  const sleeve = isGK ? '#2ecc71' : c.sleeve;
  return (
    <svg width="120" height="130" viewBox="0 0 80 90" fill="none" className="drop-shadow-2xl">
      <ellipse cx="40" cy="86" rx="24" ry="4" fill="rgba(0,0,0,0.3)" />
      <path d="M8 24 L20 18 L24 38 L12 42 Z" fill={sleeve} stroke="rgba(0,0,0,0.1)" strokeWidth="0.5"/>
      <path d="M72 24 L60 18 L56 38 L68 42 Z" fill={sleeve} stroke="rgba(0,0,0,0.1)" strokeWidth="0.5"/>
      <path d="M20 18 L20 80 L60 80 L60 18 L52 14 C50 20 45 23 40 23 C35 23 30 20 28 14 Z" fill={shirt} stroke="rgba(0,0,0,0.1)" strokeWidth="0.5"/>
      <path d="M34 14 Q40 10 46 14 Q44 20 40 21 Q36 20 34 14 Z" fill="rgba(255,255,255,0.7)"/>
      <path d="M26 20 Q30 18 34 18 L34 35 Q30 35 26 37 Z" fill="rgba(255,255,255,0.15)"/>
      {isGK && (<><rect x="6" y="38" width="8" height="7" rx="2" fill="#e67e22"/><rect x="66" y="38" width="8" height="7" rx="2" fill="#e67e22"/></>)}
    </svg>
  );
}

export default function PlayerProfilePage() {
  const params = useParams();
  const router = useRouter();
  const playerId = params?.id as string;
  const supabase = createClient();

  const player = ALL_PLAYERS.find(p => p.id === playerId);
  const [stats, setStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);

  useEffect(() => {
    if (!player) return;
    const load = async () => {
      // Load all GW stats from player_gameweek_points
      const { data: gwData } = await supabase
        .from('player_gameweek_points')
        .select('*')
        .eq('player_name', player.name)
        .order('gameweek', { ascending: true });
      setStats(gwData || []);

      // Load current price from player_prices
      const { data: priceData } = await supabase
        .from('player_prices')
        .select('price')
        .eq('name', player.name)
        .single();
      if (priceData) setCurrentPrice(priceData.price);

      setLoading(false);
    };
    load();

    // Realtime
    const sub = supabase.channel('player-profile')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'player_gameweek_points' }, load)
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [playerId]);

  if (!player) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#1a0020' }}>
      <div className="text-center">
        <p className="text-white text-2xl font-black mb-4">Player not found</p>
        <button onClick={() => router.back()} className="text-purple-400 hover:text-white">← Go back</button>
      </div>
    </div>
  );

  const deptColor = DEPT_COLORS[player.department]?.shirt || '#555';
  const posColor = POS_COLOR[player.position] || '#fff';

  // Aggregate totals across all GWs
  const totals = stats.reduce((acc, s) => ({
    goals: acc.goals + (s.goals || 0),
    assists: acc.assists + (s.assists || 0),
    clean_sheets: acc.clean_sheets + (s.clean_sheet ? 1 : 0),
    yellow_cards: acc.yellow_cards + (s.yellow_cards || 0),
    red_cards: acc.red_cards + (s.red_cards || 0),
    minutes: acc.minutes + (s.minutes_played || 0),
    total_points: acc.total_points + (s.total_points || 0),
    appearances: acc.appearances + (s.minutes_played > 0 ? 1 : 0),
  }), { goals: 0, assists: 0, clean_sheets: 0, yellow_cards: 0, red_cards: 0, minutes: 0, total_points: 0, appearances: 0 });

  const price = currentPrice ?? player.price;

  return (
    <div className="min-h-screen pb-16" style={{ background: '#1a0020', fontFamily: "'Segoe UI', sans-serif", color: 'white' }}>

      {/* Header */}
      <div className="relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${deptColor}33, rgba(0,0,0,0.8))`, borderBottom: `1px solid ${deptColor}44` }}>
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(circle at 70% 50%, white 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <div className="relative px-4 pt-4 pb-0 flex items-center gap-3">
          <button onClick={() => router.back()} className="text-white/60 hover:text-white transition-colors text-sm font-bold flex items-center gap-1">
            ← Back
          </button>
        </div>
        <div className="relative px-6 pb-6 flex items-end gap-6">
          <div className="shrink-0 -mb-4">
            <JerseyBig dept={player.department} isGK={player.position === 'GK'} />
          </div>
          <div className="pb-2 flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full uppercase" style={{ background: posColor + '33', color: posColor, border: `1px solid ${posColor}44` }}>
                {player.position}
              </span>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full uppercase" style={{ background: deptColor + '33', color: 'white', border: `1px solid ${deptColor}66` }}>
                {player.department.split(' ')[0]}
              </span>
            </div>
            <h1 className="font-black text-3xl text-white leading-tight">{player.name}</h1>
            <p className="text-white/50 text-sm mt-0.5">{player.department}</p>
            <div className="flex items-center gap-4 mt-3">
              <div>
                <p className="font-black text-2xl" style={{ color: '#00ff87' }}>£{price.toFixed(1)}m</p>
                <p className="text-[9px] text-white/40 uppercase">Price</p>
              </div>
              <div className="w-px h-8 bg-white/10" />
              <div>
                <p className="font-black text-2xl text-white">{totals.total_points}</p>
                <p className="text-[9px] text-white/40 uppercase">Total Pts</p>
              </div>
              <div className="w-px h-8 bg-white/10" />
              <div>
                <p className="font-black text-2xl text-white">{totals.appearances}</p>
                <p className="text-[9px] text-white/40 uppercase">Apps</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 mt-6 space-y-5 max-w-2xl mx-auto">

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 rounded-full border-4 animate-spin" style={{ borderColor: '#00ff87', borderTopColor: 'transparent' }} />
          </div>
        ) : (
          <>
            {/* Season Stats Grid */}
            <div className="rounded-2xl overflow-hidden border border-purple-800/40" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <div className="px-4 py-3 border-b border-purple-900/40">
                <p className="text-[10px] font-black uppercase text-purple-400 tracking-widest">Season Stats</p>
              </div>
              {stats.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <p className="text-purple-600 text-sm">No stats recorded yet</p>
                  <p className="text-purple-700 text-xs mt-1">Stats appear after admin logs player performance</p>
                </div>
              ) : (
                <div className="grid grid-cols-4 divide-x divide-white/5">
                  {[
                    { label: 'Goals', value: totals.goals, icon: '⚽', color: '#00ff87' },
                    { label: 'Assists', value: totals.assists, icon: '🎯', color: '#00ccff' },
                    { label: player.position === 'GK' || player.position === 'DEF' ? 'Clean Sheets' : 'Mins/90', value: player.position === 'GK' || player.position === 'DEF' ? totals.clean_sheets : Math.round(totals.minutes / 90), icon: player.position === 'GK' || player.position === 'DEF' ? '🛡️' : '⏱️', color: '#818cf8' },
                    { label: 'Yellows', value: totals.yellow_cards, icon: '🟨', color: '#facc15' },
                  ].map(stat => (
                    <div key={stat.label} className="px-3 py-4 text-center">
                      <p className="text-xl mb-1">{stat.icon}</p>
                      <p className="font-black text-2xl" style={{ color: stat.value > 0 ? stat.color : 'rgba(255,255,255,0.2)' }}>{stat.value}</p>
                      <p className="text-[9px] text-purple-500 uppercase mt-1">{stat.label}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* GW by GW breakdown */}
            {stats.length > 0 && (
              <div className="rounded-2xl overflow-hidden border border-purple-800/40" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <div className="px-4 py-3 border-b border-purple-900/40 flex items-center justify-between">
                  <p className="text-[10px] font-black uppercase text-purple-400 tracking-widest">Gameweek History</p>
                  <p className="text-[10px] text-purple-500">{stats.length} GW{stats.length > 1 ? 's' : ''}</p>
                </div>
                <div className="divide-y divide-white/5">
                  {stats.map((s, i) => (
                    <div key={i} className="px-4 py-3 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-black text-xs" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}>
                        GW{s.gameweek}
                      </div>
                      <div className="flex-1 grid grid-cols-5 gap-1 text-center text-xs">
                        <div><p className="font-black text-white">{s.minutes_played || 0}'</p><p className="text-purple-600 text-[9px]">mins</p></div>
                        <div><p className="font-black" style={{ color: s.goals > 0 ? '#00ff87' : 'rgba(255,255,255,0.2)' }}>{s.goals || 0}</p><p className="text-purple-600 text-[9px]">G</p></div>
                        <div><p className="font-black" style={{ color: s.assists > 0 ? '#00ccff' : 'rgba(255,255,255,0.2)' }}>{s.assists || 0}</p><p className="text-purple-600 text-[9px]">A</p></div>
                        <div><p className="font-black" style={{ color: s.clean_sheet ? '#818cf8' : 'rgba(255,255,255,0.2)' }}>{s.clean_sheet ? '✓' : '—'}</p><p className="text-purple-600 text-[9px]">CS</p></div>
                        <div><p className="font-black" style={{ color: s.total_points > 6 ? '#00ff87' : s.total_points > 2 ? 'white' : s.total_points < 0 ? '#f87171' : 'rgba(255,255,255,0.4)' }}>{s.total_points || 0}</p><p className="text-purple-600 text-[9px]">pts</p></div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="px-4 py-3 border-t border-purple-900/40 flex items-center justify-between" style={{ background: 'rgba(0,255,135,0.04)' }}>
                  <p className="text-[10px] font-black uppercase text-purple-400">Season Total</p>
                  <p className="font-black text-lg" style={{ color: '#00ff87' }}>{totals.total_points} pts</p>
                </div>
              </div>
            )}

            {/* Ownership info */}
            <div className="rounded-2xl p-4 border border-purple-800/40" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <p className="text-[10px] font-black uppercase text-purple-400 tracking-widest mb-3">Player Info</p>
              <div className="space-y-2">
                {[
                  { label: 'Department', value: player.department },
                  { label: 'Position', value: player.position },
                  { label: 'Current Price', value: `£${price.toFixed(1)}m` },
                  { label: 'Total Points', value: `${totals.total_points} pts` },
                  { label: 'Minutes Played', value: `${totals.minutes}'` },
                  { label: 'Goals + Assists', value: `${totals.goals + totals.assists}` },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
                    <p className="text-sm text-purple-400">{item.label}</p>
                    <p className="text-sm font-bold text-white">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}