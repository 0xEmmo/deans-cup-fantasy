'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import type { User } from '@supabase/supabase-js';

interface Match {
  id: string; home_dept: string; away_dept: string;
  home_score: number; away_score: number;
  status: 'scheduled'|'first_half'|'half_time'|'second_half'|'finished';
  played_at: string; half_started_at?: string|null;
}
interface MatchEvent {
  id?: string; match_id: string; minute: number;
  event_type: string; player_name: string; dept: string; fantasy_points: number;
}
interface TransferWindow {
  is_open: boolean; gameweek: number; gameweek_locked: boolean; free_transfers: boolean;
}
interface PlayerPrice { id: string; name: string; position: string; department: string; price: number; }
interface PlayerPoints {
  player_id: string; player_name: string; gameweek: number;
  minutes_played: number; goals: number; assists: number; clean_sheet: boolean;
  yellow_cards: number; red_cards: number; penalty_saves: number; penalty_misses: number;
  shots_saved: number; goals_conceded: number; own_goals: number; cbit: number; bonus: number;
  total_points?: number;
}
interface RegisteredUser { id: string; name?: string; email?: string; department?: string; }
interface MatchLineup {
  id: string; match_id: string; player_id: string; player_name: string;
  team_side: 'home'|'away'; position: string; is_substitute: boolean;
}

// ─── CONSTANTS ─────────────────────────────────────────────────────────────
const DEPARTMENTS = ['Statistics','Chemistry','Mathematics','Environmental Standards','Physics','Geosciences'];
const POSITIONS = ['GK','DEF','MID','FWD'];

const EVENT_TYPES = [
  { value:'goal',           label:'Goal',           icon:'⚽', points:4  },
  { value:'assist',         label:'Assist',         icon:'🎯', points:3  },
  { value:'yellow_card',    label:'Yellow Card',    icon:'🟨', points:-1 },
  { value:'red_card',       label:'Red Card',       icon:'🟥', points:-3 },
  { value:'penalty_saved',  label:'Penalty Saved',  icon:'🧤', points:5  },
  { value:'penalty_missed', label:'Penalty Missed', icon:'❌', points:-2 },
  { value:'own_goal',       label:'Own Goal',       icon:'😬', points:-2 },
  { value:'clean_sheet',    label:'Clean Sheet',    icon:'🛡️', points:4  },
];

const SCORING_RULES = [
  { category:'Playing Time', rules:[{label:'Playing 60+ minutes',pts:'+2'},{label:'Playing up to 60 minutes',pts:'+1'}]},
  { category:'Goals Scored', rules:[{label:'Goal (GK or Defender)',pts:'+6'},{label:'Goal (Midfielder)',pts:'+5'},{label:'Goal (Forward)',pts:'+4'},{label:'Assist',pts:'+3'}]},
  { category:'Clean Sheet', rules:[{label:'Clean sheet (GK or DEF)',pts:'+4'},{label:'Clean sheet (MID)',pts:'+1'},{label:'Clean sheet (FWD)',pts:'0'}]},
  { category:'Goalkeeping', rules:[{label:'Penalty save',pts:'+5'},{label:'Every 3 shots saved',pts:'+1'},{label:'Every 2 goals conceded',pts:'-1'}]},
  { category:'Discipline', rules:[{label:'Yellow card',pts:'-1'},{label:'Red card',pts:'-3'},{label:'Penalty miss',pts:'-2'},{label:'Own goal',pts:'-2'}]},
  { category:'CBIT', rules:[{label:'DEF: 10+ clearances/blocks/interceptions',pts:'+2'},{label:'MID/FWD: 12+ CBIT + recoveries',pts:'+2'}]},
  { category:'Bonus Points', rules:[{label:'1st place — best player in match',pts:'+3'},{label:'2nd place',pts:'+2'},{label:'3rd place',pts:'+1'}]},
];

function calcPoints(p: PlayerPoints, position: string): number {
  let pts = 0;
  if (p.minutes_played >= 60) pts += 2; else if (p.minutes_played > 0) pts += 1;
  if (position==='GK'||position==='DEF') pts += p.goals*6;
  else if (position==='MID') pts += p.goals*5; else pts += p.goals*4;
  pts += p.assists*3;
  if (p.clean_sheet) { if (position==='GK'||position==='DEF') pts+=4; else if (position==='MID') pts+=1; }
  if (position==='GK') { pts+=p.penalty_saves*5; pts+=Math.floor(p.shots_saved/3); }
  if (position==='GK'||position==='DEF') pts-=Math.floor(p.goals_conceded/2);
  pts-=p.yellow_cards; pts-=p.red_cards*3; pts-=p.penalty_misses*2; pts-=p.own_goals*2;
  if (position==='DEF'&&p.cbit>=10) pts+=2;
  if ((position==='MID'||position==='FWD')&&p.cbit>=12) pts+=2;
  pts+=p.bonus; return pts;
}

const STATUS_CONFIG = {
  scheduled:   { label:'Scheduled', bg:'rgba(139,92,246,0.15)', color:'#a78bfa', dot:'⬜' },
  first_half:  { label:'1st Half',  bg:'rgba(239,68,68,0.15)',  color:'#f87171', dot:'🔴' },
  half_time:   { label:'Half Time', bg:'rgba(234,179,8,0.15)',  color:'#fbbf24', dot:'⏸'  },
  second_half: { label:'2nd Half',  bg:'rgba(239,68,68,0.15)',  color:'#f87171', dot:'🔴' },
  finished:    { label:'Full Time', bg:'rgba(34,197,94,0.15)',   color:'#4ade80', dot:'✓'  },
};

function formatTimer(seconds: number, half: 'first'|'second'): string {
  const base = half==='second'?45:0;
  const mins = base+Math.floor(seconds/60);
  const secs = seconds%60;
  return `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
}

const iCls = 'w-full bg-black/40 border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 outline-none focus:border-[#00ff87]/50 placeholder-white/20 transition-colors';
const sBadge = (pos: string) => ({ GK:'#f59e0b',DEF:'#3b82f6',MID:'#10b981',FWD:'#ef4444' }[pos]||'#888');

// ─── LIVE MATCH CONTROL ──────────────────────────────────────────────────
function LiveMatchControl({ match, onUpdate, showMsg }: { match: Match; onUpdate:()=>void; showMsg:(t:'success'|'error',m:string)=>void }) {
  const supabase = createClient();
  const [elapsed, setElapsed] = useState(0);
  const [saving, setSaving] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval>|null>(null);

  useEffect(()=>{
    if ((match.status==='first_half'||match.status==='second_half')&&match.half_started_at) {
      const startMs = new Date(match.half_started_at).getTime();
      setElapsed(Math.max(0,Math.floor((Date.now()-startMs)/1000)));
      timerRef.current = setInterval(()=>setElapsed(Math.floor((Date.now()-startMs)/1000)),1000);
    }
    return ()=>{ if(timerRef.current) clearInterval(timerRef.current); };
  },[match.status,match.half_started_at]);

  const stopTimer = ()=>{ if(timerRef.current){clearInterval(timerRef.current);timerRef.current=null;} setElapsed(0); };

  const updateScore = async (side:'home'|'away', delta:number)=>{
    const cur = side==='home'?match.home_score:match.away_score;
    const val = Math.max(0,cur+delta);
    const {error,data} = await supabase.from('matches').update(side==='home'?{home_score:val}:{away_score:val}).eq('id',match.id).select();
    if(error) showMsg('error','Score error: '+error.message);
    else if(!data||data.length===0) showMsg('error','Blocked by RLS');
    else onUpdate();
  };

  const doUpdate = async (payload: Partial<Match>)=>{
    setSaving(true);
    const {error,data} = await supabase.from('matches').update(payload).eq('id',match.id).select();
    if(error) showMsg('error','DB error: '+error.message);
    else if(!data||data.length===0) showMsg('error','Update blocked — check RLS policies');
    else { const labels: Record<string,string>={first_half:'▶ 1st Half started',half_time:'⏸ Half Time',second_half:'▶ 2nd Half started',finished:'⏹ Full Time',scheduled:'↺ Reset'}; if(payload.status) showMsg('success',labels[payload.status]||'Updated'); onUpdate(); }
    setSaving(false);
  };

  const cfg = STATUS_CONFIG[match.status];
  const isLive = match.status==='first_half'||match.status==='second_half';
  const half: 'first'|'second' = match.status==='first_half'?'first':'second';

  return (
    <div className="rounded-2xl overflow-hidden" style={{border:`1px solid ${isLive?'rgba(239,68,68,0.4)':'rgba(255,255,255,0.08)'}`,background:'linear-gradient(135deg,rgba(0,0,0,0.6),rgba(30,0,40,0.8))'}}>
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
        <div className="text-white font-black text-sm">{match.home_dept.split(' ')[0].toUpperCase()} <span style={{color:'#00ff87'}}>VS</span> {match.away_dept.split(' ')[0].toUpperCase()}</div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-black px-3 py-1 rounded-full" style={{background:cfg.bg,color:cfg.color}}>{cfg.dot} {cfg.label}</span>
          {isLive&&<span className="text-red-400 font-black text-sm font-mono animate-pulse">{formatTimer(elapsed,half)}&apos;</span>}
        </div>
      </div>
      <div className="py-6 px-4" style={{background:'rgba(0,0,0,0.3)'}}>
        <div className="flex items-center justify-center gap-8">
          {(['home','away'] as const).map(side=>(
            <div key={side} className="flex flex-col items-center gap-2">
              <span className="text-white/60 text-xs font-bold uppercase tracking-widest">{side==='home'?match.home_dept.split(' ')[0]:match.away_dept.split(' ')[0]}</span>
              <div className="flex items-center gap-3">
                <button onClick={()=>updateScore(side,-1)} disabled={match.status==='scheduled'||match.status==='finished'} className="w-8 h-8 rounded-full font-black text-xl flex items-center justify-center disabled:opacity-20 hover:scale-110 transition-all" style={{background:'rgba(239,68,68,0.3)',color:'#f87171'}}>−</button>
                <span className="font-black text-5xl text-white w-14 text-center tabular-nums">{side==='home'?match.home_score:match.away_score}</span>
                <button onClick={()=>updateScore(side,1)} disabled={match.status==='scheduled'||match.status==='finished'} className="w-8 h-8 rounded-full font-black text-xl flex items-center justify-center disabled:opacity-20 hover:scale-110 transition-all" style={{background:'rgba(0,255,135,0.2)',color:'#00ff87'}}>+</button>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="px-5 py-4 flex flex-wrap gap-2 justify-center border-t border-white/5">
        {match.status==='scheduled'&&<button onClick={()=>doUpdate({status:'first_half',half_started_at:new Date().toISOString(),home_score:0,away_score:0})} disabled={saving} className="px-6 py-2.5 rounded-full font-black text-sm disabled:opacity-50 hover:scale-105 transition-all" style={{background:'linear-gradient(135deg,#00ff87,#00cc6a)',color:'#0a001a'}}>▶ START 1ST HALF</button>}
        {match.status==='first_half'&&<button onClick={()=>{stopTimer();doUpdate({status:'half_time',half_started_at:null});}} disabled={saving} className="px-6 py-2.5 rounded-full font-black text-sm bg-yellow-500 hover:bg-yellow-400 text-black disabled:opacity-50">⏸ HALF TIME</button>}
        {match.status==='half_time'&&<button onClick={()=>doUpdate({status:'second_half',half_started_at:new Date().toISOString()})} disabled={saving} className="px-6 py-2.5 rounded-full font-black text-sm disabled:opacity-50 hover:scale-105 transition-all" style={{background:'linear-gradient(135deg,#00ff87,#00cc6a)',color:'#0a001a'}}>▶ START 2ND HALF</button>}
        {match.status==='second_half'&&<button onClick={()=>{stopTimer();doUpdate({status:'finished',half_started_at:null});}} disabled={saving} className="px-6 py-2.5 rounded-full font-black text-sm bg-red-600 hover:bg-red-500 text-white disabled:opacity-50">⏹ FULL TIME</button>}
        {match.status!=='scheduled'&&<button onClick={()=>{if(!confirm('Reset match?'))return;stopTimer();doUpdate({status:'scheduled',home_score:0,away_score:0,half_started_at:null});}} disabled={saving} className="px-4 py-2.5 rounded-full font-bold text-xs border disabled:opacity-50" style={{borderColor:'rgba(255,255,255,0.15)',color:'rgba(255,255,255,0.4)'}}>↺ Reset</button>}
      </div>
      {isLive&&<div className="mx-4 mb-4 px-4 py-2 rounded-xl text-center text-xs font-bold text-red-300" style={{background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.2)'}}>🔴 {match.status==='first_half'?'1st Half':'2nd Half'} · {formatTimer(elapsed,half)}&apos; played</div>}
      {match.status==='half_time'&&<div className="mx-4 mb-4 px-4 py-2 rounded-xl text-center text-xs font-bold text-yellow-300" style={{background:'rgba(234,179,8,0.1)',border:'1px solid rgba(234,179,8,0.2)'}}>⏸ Half Time — click &quot;Start 2nd Half&quot; when ready</div>}
      {match.status==='finished'&&<div className="mx-4 mb-4 px-4 py-2 rounded-xl text-center text-xs font-bold text-green-300" style={{background:'rgba(34,197,94,0.1)',border:'1px solid rgba(34,197,94,0.2)'}}>✓ Full Time — {match.home_dept.split(' ')[0]} {match.home_score}–{match.away_score} {match.away_dept.split(' ')[0]}</div>}
    </div>
  );
}

function SectionHeader({icon,title,sub}:{icon:string;title:string;sub?:string}){
  return(<div className="flex items-center gap-3 mb-5"><div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0" style={{background:'rgba(0,255,135,0.12)',border:'1px solid rgba(0,255,135,0.2)'}}>{icon}</div><div><h2 className="text-white font-black text-lg tracking-tight">{title}</h2>{sub&&<p className="text-white/40 text-xs mt-0.5">{sub}</p>}</div></div>);
}
function Card({children,className=''}:{children:React.ReactNode;className?:string}){
  return(<div className={`rounded-2xl p-5 ${className}`} style={{background:'linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))',border:'1px solid rgba(255,255,255,0.07)',backdropFilter:'blur(10px)'}}>{children}</div>);
}

type AdminTab = 'overview'|'matches'|'events'|'transfer'|'players'|'points'|'users'|'lineups';

export default function AdminPage() {
  const [user, setUser] = useState<User|null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<AdminTab>('overview');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{type:'success'|'error';text:string}|null>(null);

  const [transferWindow, setTransferWindow] = useState<TransferWindow>({is_open:false,gameweek:1,gameweek_locked:false,free_transfers:false});
  const [matches, setMatches] = useState<Match[]>([]);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [users, setUsers] = useState<RegisteredUser[]>([]);
  const [stats, setStats] = useState({totalUsers:0,teamsSubmitted:0,currentGW:1});
  const [players, setPlayers] = useState<PlayerPrice[]>([]);
  const [matchForm, setMatchForm] = useState({home_dept:'',away_dept:'',status:'scheduled' as Match['status'],played_at:new Date().toISOString().slice(0,16)});
  const [editingMatch, setEditingMatch] = useState<Match|null>(null);
  const [eventForm, setEventForm] = useState({match_id:'',minute:1,event_type:'goal',player_name:'',dept:'',fantasy_points:4});
  const [priceFilter, setPriceFilter] = useState({dept:'',pos:''});
  const [editedPrices, setEditedPrices] = useState<Record<string,number>>({});
  const [pointsForm, setPointsForm] = useState<PlayerPoints>({player_id:'',player_name:'',gameweek:1,minutes_played:90,goals:0,assists:0,clean_sheet:false,yellow_cards:0,red_cards:0,penalty_saves:0,penalty_misses:0,shots_saved:0,goals_conceded:0,own_goals:0,cbit:0,bonus:0});
  const [pointsSearch, setPointsSearch] = useState('');

  const [selectedLineup, setSelectedLineup] = useState<Record<string, { player_id: string; player_name: string; position: string; team_side: 'home' | 'away' }[]>>({});
  const [existingLineups, setExistingLineups] = useState<MatchLineup[]>([]);

  const supabase = createClient();
  const showMsg = useCallback((type:'success'|'error',text:string)=>{ setMsg({type,text}); setTimeout(()=>setMsg(null),4000); },[]);

  const loadAll = useCallback(async()=>{
    const [twRes,matchRes,evRes,userRes,uCount,tCount,lineupRes] = await Promise.all([
      supabase.from('transfer_window').select('*').eq('id',1).single(),
      supabase.from('matches').select('*').order('played_at',{ascending:false}),
      supabase.from('match_events').select('*').order('minute'),
      supabase.from('users').select('id,name,email,department'),
      supabase.from('users').select('*',{count:'exact',head:true}),
      supabase.from('user_teams').select('*',{count:'exact',head:true}),
      supabase.from('match_lineups').select('*'),
    ]);
    if(twRes.data) setTransferWindow(twRes.data);
    setMatches(matchRes.data||[]);
    setEvents(evRes.data||[]);
    setUsers(userRes.data||[]);
    setStats({totalUsers:uCount.count||0,teamsSubmitted:tCount.count||0,currentGW:twRes.data?.gameweek||1});
    const {data:priceData} = await supabase.from('player_prices').select('*').order('department').order('position').order('name');
    if(priceData&&priceData.length>0) setPlayers(priceData as PlayerPrice[]);
    if(lineupRes.data) setExistingLineups(lineupRes.data);
  },[supabase]);

  useEffect(() => {
    if (existingLineups.length === 0) return;
    
    setSelectedLineup(prev => {
      const newState = { ...prev };
      const grouped: Record<string, { player_id: string; player_name: string; position: string; team_side: 'home' | 'away' }[]> = {};
      
      existingLineups.forEach(l => {
        const key = `${l.match_id}-${l.team_side}`;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push({
          player_id: l.player_id,
          player_name: l.player_name,
          position: l.position,
          team_side: l.team_side,
        });
      });

      Object.keys(grouped).forEach(key => {
        if (!newState[key] || newState[key].length === 0) {
          newState[key] = grouped[key];
        }
      });
      
      return newState;
    });
  }, [existingLineups]);

  useEffect(()=>{
    (async()=>{
      const {data:{user:authUser}} = await supabase.auth.getUser();
      setUser(authUser);
      if(!authUser){setLoading(false);return;}
      const {data:adminRow} = await supabase.from('admin_users').select('id').eq('id',authUser.id).single();
      if(!adminRow){setLoading(false);return;}
      setIsAdmin(true);
      await loadAll();
      setLoading(false);
    })();

    const priceSub = supabase.channel('admin-prices').on('postgres_changes',{event:'*',schema:'public',table:'player_prices'},()=>{
      supabase.from('player_prices').select('*').then(({ data }: { data: PlayerPrice[] | null }) => {
        if(data && data.length > 0) setPlayers(data as PlayerPrice[]);
      });
    }).subscribe();

    const matchSub = supabase.channel('admin-matches').on('postgres_changes',{event:'*',schema:'public',table:'matches'},()=>loadAll()).subscribe();
    const lineupSub = supabase.channel('admin-lineups').on('postgres_changes',{event:'*',schema:'public',table:'match_lineups'},()=>loadAll()).subscribe();
    return()=>{supabase.removeChannel(priceSub);supabase.removeChannel(matchSub);supabase.removeChannel(lineupSub);};
  },[supabase,loadAll]);

  const toggleLineupPlayer = (matchId: string, player: PlayerPrice, side: 'home' | 'away') => {
    setSelectedLineup(prev => {
      const key = `${matchId}-${side}`;
      const current = prev[key] || [];
      const exists = current.some(p => p.player_id === player.id);
      const updated = exists
        ? current.filter(p => p.player_id !== player.id)
        : [...current, { player_id: player.id, player_name: player.name, position: player.position, team_side: side }];
      return { ...prev, [key]: updated };
    });
  };

  const saveLineups = async (matchId: string) => {
    if (!matchId) return;
    setSaving(true);
    try {
      const entries = Object.entries(selectedLineup).filter(([key]) =>
        key.startsWith(matchId)
      );

      for (const [key, players] of entries) {
        const side = key.slice(matchId.length + 1) as 'home' | 'away';

        if (side !== 'home' && side !== 'away') {
          showMsg('error', `Invalid side parsed: "${side}" — skipping`);
          continue;
        }

        const { error: deleteError } = await supabase
          .from('match_lineups')
          .delete()
          .eq('match_id', matchId)
          .eq('team_side', side);

        if (deleteError) throw deleteError;

        if (players.length > 0) {
          const insertData = players.map(p => ({
            match_id: matchId,
            player_id: p.player_id,
            player_name: p.player_name,
            position: p.position,
            team_side: side,
          }));

          const { error: insertError } = await supabase
            .from('match_lineups')
            .insert(insertData);

          if (insertError) throw insertError;
        }
      }

      showMsg('success', 'Line-ups saved!');
    } catch (error: any) {
      showMsg('error', error.message || 'Failed to save lineups');
    } finally {
      setSaving(false);
      await loadAll();
    }
  };

  const getLineupForMatch = (matchId: string, side: 'home' | 'away') => {
    return existingLineups.filter(l => l.match_id === matchId && l.team_side === side);
  };

  const toggleTransferWindow = async()=>{
    setSaving(true);
    const next=!transferWindow.is_open;
    const {error} = await supabase.from('transfer_window').update({is_open:next,opened_at:next?new Date().toISOString():transferWindow.is_open,closed_at:!next?new Date().toISOString():null}).eq('id',1);
    if(error) showMsg('error',error.message);
    else{setTransferWindow(p=>({...p,is_open:next}));showMsg('success',`Transfer window ${next?'OPENED':'CLOSED'}`);}
    setSaving(false);
  };

  // ─── FIXED toggleGWLock ────────────────────────────────────────────
  // BUG FIX: Now accumulates GW points into total_points before locking
  const toggleGWLock = async()=>{
    setSaving(true);
    const next=!transferWindow.gameweek_locked;
    
    if(next){
      // ✅ LOCKING GAMEWEEK: Accumulate points before locking
      try {
        const currentGw = transferWindow.gameweek;
        
        // Fetch all teams
        const { data: teams } = await supabase.from('user_teams').select('id, user_id, total_points, players, captain_id');
        const { data: gwPoints } = await supabase.from('player_gameweek_points').select('player_name, total_points').eq('gameweek', currentGw);
        
        // Map player points by name
        const gwPtsMap: Record<string, number> = {};
        (gwPoints || []).forEach((r: any) => { gwPtsMap[r.player_name] = r.total_points || 0; });
        
        // For each team, calculate GW points and add to total_points
        const updates = (teams || []).map((t: any) => {
          const squadPlayers: any[] = t.players || [];
          const gwPoints = squadPlayers
            .filter((p: any) => !p.isBench)
            .reduce((sum: number, p: any) => {
              const raw = gwPtsMap[p.name] ?? 0;
              return sum + (t.captain_id === p.id ? raw * 2 : raw);
            }, 0);
          
          const newTotal = (t.total_points || 0) + gwPoints;
          return { id: t.id, total_points: newTotal };
        });
        
        // Update all teams with accumulated points
        for (const update of updates) {
          await supabase.from('user_teams').update({ total_points: update.total_points }).eq('id', update.id);
        }
        
        showMsg('success', `✓ GW${currentGw} points locked! Moving to GW${currentGw + 1}`);
      } catch (err: any) {
        showMsg('error', 'Failed to accumulate points: ' + err.message);
        setSaving(false);
        return;
      }
    }
    
    const {error} = await supabase.from('transfer_window').update({gameweek_locked:next}).eq('id',1);
    if(error) showMsg('error',error.message);
    else{
      setTransferWindow(p=>({...p,gameweek_locked:next}));
      if(!next){await supabase.rpc('grant_free_transfers_all');showMsg('success','Gameweek UNLOCKED · 1 free transfer granted to all');}
      else{await supabase.from('user_teams').update({transfers_this_window:0,transfer_cost_this_window:0}).neq('user_id','00000000-0000-0000-0000-000000000000');}
    }
    setSaving(false);
  };

  const toggleFreeTransfers = async()=>{
    setSaving(true);
    const next=!transferWindow.free_transfers;
    const {error} = await supabase.from('transfer_window').update({free_transfers:next}).eq('id',1);
    if(error) showMsg('error',error.message);
    else{setTransferWindow(p=>({...p,free_transfers:next}));showMsg('success',`Free transfers ${next?'ENABLED':'DISABLED'}`);}
    setSaving(false);
  };

  const updateGW = async(gw:number)=>{ await supabase.from('transfer_window').update({gameweek:gw}).eq('id',1); setTransferWindow(p=>({...p,gameweek:gw})); };

  const saveMatch = async()=>{
    if(!matchForm.home_dept||!matchForm.away_dept){showMsg('error','Select both departments');return;}
    if(matchForm.home_dept===matchForm.away_dept){showMsg('error','Teams must be different');return;}
    setSaving(true);
    const payload={...matchForm,played_at:new Date(matchForm.played_at).toISOString()};
    const {error} = editingMatch?await supabase.from('matches').update(payload).eq('id',editingMatch.id):await supabase.from('matches').insert(payload);
    if(error) showMsg('error',error.message);
    else{showMsg('success',editingMatch?'Match updated!':'Match scheduled!');setEditingMatch(null);setMatchForm({home_dept:'',away_dept:'',status:'scheduled',played_at:new Date().toISOString().slice(0,16)});}
    await loadAll();setSaving(false);
  };

  const deleteMatch = async(id:string)=>{
    if(!confirm('Delete this match?'))return;
    await supabase.from('match_events').delete().eq('match_id',id);
    await supabase.from('matches').delete().eq('id',id);
    await supabase.from('match_lineups').delete().eq('match_id',id);
    await loadAll();showMsg('success','Match deleted');
  };

  const addEvent = async()=>{
    if(!eventForm.match_id||!eventForm.player_name||!eventForm.dept){showMsg('error','Fill all event fields');return;}
    setSaving(true);
    const {error} = await supabase.from('match_events').insert({...eventForm});
    if(error) showMsg('error',error.message);
    else{showMsg('success','Event logged!');setEventForm(p=>({...p,player_name:'',minute:p.minute+1}));await loadAll();}
    setSaving(false);
  };

  const deleteEvent = async(id:string)=>{ await supabase.from('match_events').delete().eq('id',id); await loadAll(); showMsg('success','Event deleted'); };

  const handlePriceChange = (id:string,val:string)=>{ const n=parseFloat(val); if(!isNaN(n)) setEditedPrices(p=>({...p,[id]:n})); };
  const savePriceOnBlur = async(player:PlayerPrice)=>{
    const newPrice=editedPrices[player.id];
    if(newPrice===undefined||newPrice===player.price)return;
    const final=Math.max(1.0,Math.min(20.0,parseFloat(newPrice.toFixed(1))));
    setSaving(true);
    const {error} = await supabase.from('player_prices').upsert({id:player.id,name:player.name,position:player.position,department:player.department,price:final},{onConflict:'id'});
    if(error) showMsg('error',error.message);
    else{setPlayers(p=>p.map(x=>x.id===player.id?{...x,price:final}:x));setEditedPrices(p=>{const n={...p};delete n[player.id];return n;});showMsg('success',`${player.name} → £${final.toFixed(1)}m`);}
    setSaving(false);
  };

  const submitPoints = async()=>{
    if(!pointsForm.player_id){showMsg('error','Select a player');return;}
    setSaving(true);
    const position=players.find(p=>p.id===pointsForm.player_id)?.position||'FWD';
    const total=calcPoints(pointsForm,position);
    const {error} = await supabase.from('player_gameweek_points').upsert({...pointsForm,total_points:total,position},{onConflict:'player_id,gameweek'});
    if(error) showMsg('error',error.message);
    else{showMsg('success',`✓ ${pointsForm.player_name} GW${pointsForm.gameweek}: ${total} pts`);setPointsForm(p=>({...p,player_id:'',player_name:'',minutes_played:90,goals:0,assists:0,clean_sheet:false,yellow_cards:0,red_cards:0,penalty_saves:0,penalty_misses:0,shots_saved:0,goals_conceded:0,own_goals:0,cbit:0,bonus:0}));setPointsSearch('');}
    setSaving(false);
  };

  const filteredPlayers = players.filter(p=>(!priceFilter.dept||p.department===priceFilter.dept)&&(!priceFilter.pos||p.position===priceFilter.pos));
  const searchedPlayers = pointsSearch.length>1?players.filter(p=>p.name.toLowerCase().includes(pointsSearch.toLowerCase())||p.department.toLowerCase().includes(pointsSearch.toLowerCase())):[];
  const eventsForMatch = events.filter(e=>e.match_id===eventForm.match_id);
  const previewPoints = pointsForm.player_id?calcPoints(pointsForm,players.find(p=>p.id===pointsForm.player_id)?.position||'FWD'):null;

  const TABS: {key:AdminTab;icon:string;label:string}[] = [
    {key:'overview',icon:'◈',label:'Overview'},
    {key:'transfer',icon:'⊛',label:'Gameweek'},
    {key:'matches', icon:'◉',label:'Matches'},
    {key:'lineups', icon:'▦',label:'Line-ups'},
    {key:'events',  icon:'≡',label:'Events'},
    {key:'players', icon:'◎',label:'Prices'},
    {key:'points',  icon:'★',label:'Points'},
    {key:'users',   icon:'◷',label:'Users'},
  ];

  if(loading) return(<div className="min-h-screen flex items-center justify-center" style={{background:'#0a001a'}}><div className="text-center space-y-4"><div className="w-12 h-12 rounded-full border-2 animate-spin mx-auto" style={{borderColor:'#00ff87',borderTopColor:'transparent'}}/><p className="text-white/40 text-sm font-bold tracking-widest uppercase">Loading Admin</p></div></div>);
  if(!user) return(<div className="min-h-screen flex items-center justify-center" style={{background:'#0a001a'}}><div className="text-center space-y-4"><div className="text-5xl">🔒</div><p className="text-white font-black text-xl">Authentication Required</p><a href="/auth" className="inline-block px-8 py-3 rounded-full font-black text-sm text-black" style={{background:'#00ff87'}}>Sign In</a></div></div>);
  if(!isAdmin) return(<div className="min-h-screen flex items-center justify-center px-4" style={{background:'#0a001a'}}><div className="text-center max-w-md space-y-4"><div className="text-5xl">🚫</div><p className="text-white font-black text-2xl">Access Denied</p><div className="rounded-2xl p-4 text-left" style={{background:'rgba(0,255,135,0.06)',border:'1px solid rgba(0,255,135,0.15)'}}><p className="text-white/50 text-xs mb-2 font-bold uppercase tracking-widest">Run in Supabase SQL Editor</p><code className="text-yellow-300 text-xs font-mono break-all">INSERT INTO admin_users (id) VALUES (&apos;{user.id}&apos;);</code></div><a href="/" className="inline-block px-6 py-2 rounded-full font-bold text-sm text-black" style={{background:'#00ff87'}}>← Go Home</a></div></div>);

  return (
    <div className="min-h-screen" style={{background:'radial-gradient(ellipse at top,#0d0020 0%,#080010 60%,#040008 100%)',fontFamily:"'Segoe UI',system-ui,sans-serif"}}>
      <nav className="sticky top-0 z-50 border-b" style={{background:'rgba(10,0,26,0.95)',borderColor:'rgba(255,255,255,0.06)',backdropFilter:'blur(20px)'}}>
        <div className="max-w-6xl mx-auto px-5 py-0 flex items-center justify-between h-14">
          <div className="flex items-center gap-4">
            <a href="/" className="flex items-center gap-2"><div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm" style={{background:'rgba(0,255,135,0.15)'}}>⚽</div><span className="text-white font-black text-sm tracking-tight">Dean&apos;s Games</span></a>
            <div className="w-px h-4 bg-white/10"/>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full" style={{background:'linear-gradient(135deg,rgba(0,255,135,0.2),rgba(0,200,100,0.1))',border:'1px solid rgba(0,255,135,0.3)'}}><span className="text-[10px] font-black tracking-widest uppercase" style={{color:'#00ff87'}}>⬡ ADMIN</span></div>
          </div>
          <div className="flex items-center gap-3">
            {transferWindow.gameweek_locked&&<span className="text-xs font-black px-3 py-1 rounded-full" style={{background:'rgba(239,68,68,0.15)',color:'#f87171',border:'1px solid rgba(239,68,68,0.3)'}}>🔒 GW{transferWindow.gameweek} LOCKED</span>}
            <span className="text-white/30 text-xs hidden sm:block">{user.email}</span>
          </div>
        </div>
      </nav>

      {msg&&(<div className={`px-5 py-3 text-sm font-bold text-center border-b ${msg.type==='success'?'text-green-300 border-green-900/30':'text-red-300 border-red-900/30'}`} style={{background:msg.type==='success'?'rgba(0,255,135,0.08)':'rgba(239,68,68,0.08)'}}>{msg.type==='success'?'✓':'✗'} {msg.text}</div>)}

      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="mb-8">
          <p className="text-white/30 text-xs font-black uppercase tracking-[0.2em] mb-1">Control Centre</p>
          <h1 className="font-black text-4xl text-white tracking-tight leading-none">Admin<span style={{color:'#00ff87'}}>.</span></h1>
          <p className="text-white/20 text-sm mt-1">{new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'})}</p>
        </div>

        <div className="flex gap-1 mb-7 overflow-x-auto pb-0.5">
          {TABS.map(t=>(
            <button key={t.key} onClick={()=>setTab(t.key)} className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black whitespace-nowrap transition-all shrink-0 tracking-wider"
              style={tab===t.key?{background:'linear-gradient(135deg,rgba(0,255,135,0.2),rgba(0,200,100,0.1))',color:'#00ff87',border:'1px solid rgba(0,255,135,0.3)'}:{background:'rgba(255,255,255,0.04)',color:'rgba(255,255,255,0.3)',border:'1px solid rgba(255,255,255,0.05)'}}>
              <span>{t.icon}</span>{t.label.toUpperCase()}
            </button>
          ))}
        </div>

        {/* OVERVIEW */}
        {tab==='overview'&&(
          <div className="space-y-5">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[{label:'Total Users',value:stats.totalUsers,accent:'#00ff87',icon:'◈'},{label:'Teams Built',value:stats.teamsSubmitted,accent:'#00ccff',icon:'◉'},{label:'Gameweek',value:`GW ${stats.currentGW}`,accent:'#fbbf24',icon:'⊛'},{label:'Status',value:transferWindow.gameweek_locked?'LOCKED':'OPEN',accent:transferWindow.gameweek_locked?'#f87171':'#00ff87',icon:transferWindow.gameweek_locked?'🔒':'🔓'}].map(s=>(
                <div key={s.label} className="rounded-2xl p-5 relative overflow-hidden" style={{background:'linear-gradient(135deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))',border:'1px solid rgba(255,255,255,0.07)'}}>
                  <div className="absolute top-3 right-4 text-2xl opacity-20">{s.icon}</div>
                  <p className="text-white/30 text-[10px] font-black uppercase tracking-widest mb-2">{s.label}</p>
                  <p className="font-black text-3xl leading-none" style={{color:s.accent}}>{s.value}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="flex items-center justify-between">
                <div>
                  <p className="text-white/30 text-[10px] font-black uppercase tracking-widest mb-1">Reset Leaderboard</p>
                  <p className="text-white/40 text-xs">Set all users total points to 0. Accounts remain intact.</p>
                </div>
                <button
                  onClick={async () => {
                    if (!confirm('⚠️ Reset all leaderboard points to 0? This cannot be undone.')) return;
                    setSaving(true);
                    const { error } = await supabase
                      .from('users')
                      .update({ total_points: 0 })
                      .neq('id', '00000000-0000-0000-0000-000000000000');
                    if (error) showMsg('error', error.message);
                    else showMsg('success', '✅ Leaderboard reset to 0 for all users.');
                    setSaving(false);
                  }}
                  disabled={saving}
                  className="px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all disabled:opacity-50 bg-yellow-600/30 text-yellow-400 border border-yellow-600/40 hover:bg-yellow-600/50"
                >
                  {saving ? '...' : '🔄 Reset Points'}
                </button>
              </Card>
            </div>
            {matches.filter(m=>m.status!=='finished'&&m.status!=='scheduled').length>0&&(
              <div className="space-y-3"><p className="text-white/30 text-[10px] font-black uppercase tracking-widest">Live Matches</p>
                {matches.filter(m=>m.status!=='finished'&&m.status!=='scheduled').map(m=>(<LiveMatchControl key={m.id} match={m} onUpdate={loadAll} showMsg={showMsg}/>))}
              </div>
            )}
          </div>
        )}

        {/* GAMEWEEK */}
        {tab==='transfer'&&(
          <div className="space-y-4">
            <SectionHeader icon="⊛" title="Gameweek Control" sub="Lock squads and manage transfer windows"/>
            <div className="grid sm:grid-cols-2 gap-4">
              <Card>
                <p className="text-white/30 text-[10px] font-black uppercase tracking-widest mb-4">Gameweek Lock</p>
                <div className="flex items-center gap-4 mb-5">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl" style={{background:transferWindow.gameweek_locked?'rgba(239,68,68,0.2)':'rgba(0,255,135,0.15)',border:`1px solid ${transferWindow.gameweek_locked?'rgba(239,68,68,0.3)':'rgba(0,255,135,0.3)'}`}}>{transferWindow.gameweek_locked?'🔒':'🔓'}</div>
                  <div><p className="font-black text-2xl text-white">{transferWindow.gameweek_locked?'LOCKED':'OPEN'}</p><p className="text-white/30 text-xs mt-0.5">GW{transferWindow.gameweek} · Editing {transferWindow.gameweek_locked?'disabled':'enabled'}</p></div>
                </div>
                <div className="mb-4"><label className="text-white/30 text-[10px] font-black uppercase tracking-widest block mb-2">Gameweek Number</label><input type="number" min={1} max={38} value={transferWindow.gameweek} onChange={e=>updateGW(parseInt(e.target.value)||1)} className={`${iCls} max-w-[100px]`}/></div>
                <button onClick={toggleGWLock} disabled={saving} className={`px-6 py-2.5 rounded-xl font-black text-sm uppercase tracking-wider transition-all disabled:opacity-50 ${transferWindow.gameweek_locked?'bg-green-600/30 text-green-300 border border-green-600/40':'bg-red-600/30 text-red-300 border border-red-600/40'}`}>{saving?'...':transferWindow.gameweek_locked?'🔓 Unlock':'🔒 Lock'}</button>
              </Card>
              <Card>
                <p className="text-white/30 text-[10px] font-black uppercase tracking-widest mb-4">Transfer Window</p>
                <div className="flex items-center gap-4 mb-5">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl" style={{background:transferWindow.is_open?'rgba(0,255,135,0.15)':'rgba(239,68,68,0.2)',border:`1px solid ${transferWindow.is_open?'rgba(0,255,135,0.3)':'rgba(239,68,68,0.3)'}`}}>{transferWindow.is_open?'🔓':'🔒'}</div>
                  <div><p className="font-black text-2xl text-white">{transferWindow.is_open?'OPEN':'CLOSED'}</p><p className="text-white/30 text-xs mt-0.5">Transfer Window · GW{transferWindow.gameweek}</p></div>
                </div>
                <button onClick={toggleTransferWindow} disabled={saving} className="px-6 py-2.5 rounded-xl font-black text-sm uppercase tracking-wider transition-all disabled:opacity-50"
                  style={transferWindow.is_open?{background:'rgba(239,68,68,0.2)',color:'#f87171',border:'1px solid rgba(239,68,68,0.3)'}:{background:'linear-gradient(135deg,rgba(0,255,135,0.2),rgba(0,200,100,0.1))',color:'#00ff87',border:'1px solid rgba(0,255,135,0.3)'}}>
                  {saving?'...':transferWindow.is_open?'🔒 Close Window':'🔓 Open Window'}
                </button>
              </Card>
              <Card>
                <p className="text-white/30 text-[10px] font-black uppercase tracking-widest mb-4">Emergency — Free Transfers</p>
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl" style={{background:transferWindow.free_transfers?'rgba(251,191,36,0.15)':'rgba(255,255,255,0.05)',border:`1px solid ${transferWindow.free_transfers?'rgba(251,191,36,0.4)':'rgba(255,255,255,0.1)'}`}}>{transferWindow.free_transfers?'🔓':'⛔'}</div>
                  <div><p className="font-black text-2xl text-white">{transferWindow.free_transfers?'FREE TRANSFERS ON':'RESTRICTED'}</p><p className="text-white/30 text-xs mt-0.5">{transferWindow.free_transfers?'All users can freely edit squads':'Normal transfer rules apply'}</p></div>
                </div>
                {transferWindow.free_transfers&&<div className="mb-4 px-3 py-2 rounded-lg text-xs font-bold text-yellow-300 border border-yellow-500/30 animate-pulse" style={{background:'rgba(251,191,36,0.08)'}}>⚠ Free transfers active — unlimited squad changes for all users</div>}
                <button onClick={toggleFreeTransfers} disabled={saving} className="px-6 py-2.5 rounded-xl font-black text-sm uppercase tracking-wider transition-all disabled:opacity-50"
                  style={transferWindow.free_transfers?{background:'rgba(239,68,68,0.2)',color:'#f87171',border:'1px solid rgba(239,68,68,0.3)'}:{background:'rgba(251,191,36,0.15)',color:'#fbbf24',border:'1px solid rgba(251,191,36,0.3)'}}>
                  {saving?'...':transferWindow.free_transfers?'⛔ Restrict Transfers':'🔓 Enable Free Transfers'}
                </button>
              </Card>
            </div>
          </div>
        )}

        {/* MATCHES */}
        {tab==='matches'&&(
          <div className="space-y-5">
            <SectionHeader icon="◉" title="Match Management" sub="Schedule, start and control live matches"/>
            <Card>
              <p className="text-white/30 text-[10px] font-black uppercase tracking-widest mb-4">{editingMatch?'Edit Match':'Schedule New Match'}</p>
              <div className="grid sm:grid-cols-2 gap-3 mb-4">
                {[['Home Department','home_dept'],['Away Department','away_dept']].map(([label,key])=>(
                  <div key={key}><label className="text-white/30 text-[10px] font-black uppercase tracking-widest block mb-1.5">{label}</label>
                    <select value={(matchForm as any)[key]} onChange={e=>setMatchForm(p=>({...p,[key]:e.target.value}))} className={iCls}>
                      <option value="">Select department</option>
                      {DEPARTMENTS.map(d=><option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                ))}
                <div><label className="text-white/30 text-[10px] font-black uppercase tracking-widest block mb-1.5">Date & Time</label><input type="datetime-local" value={matchForm.played_at} onChange={e=>setMatchForm(p=>({...p,played_at:e.target.value}))} className={iCls}/></div>
              </div>
              <div className="flex gap-2">
                <button onClick={saveMatch} disabled={saving} className="px-6 py-2.5 rounded-xl font-black text-sm uppercase tracking-wider disabled:opacity-50 hover:scale-105 transition-all" style={{background:'linear-gradient(135deg,#00ff87,#00cc6a)',color:'#0a001a'}}>{saving?'...':editingMatch?'Update Match':'Schedule Match'}</button>
                {editingMatch&&<button onClick={()=>{setEditingMatch(null);setMatchForm({home_dept:'',away_dept:'',status:'scheduled',played_at:new Date().toISOString().slice(0,16)});}} className="px-5 py-2.5 rounded-xl font-bold text-sm text-white/40 border border-white/10 hover:border-white/20">Cancel</button>}
              </div>
            </Card>
            {matches.map(m=>(
              <div key={m.id} className="space-y-2">
                <LiveMatchControl match={m} onUpdate={loadAll} showMsg={showMsg}/>
                <div className="flex gap-2 px-1">
                  <button onClick={()=>{setEditingMatch(m);setMatchForm({home_dept:m.home_dept,away_dept:m.away_dept,status:m.status,played_at:m.played_at.slice(0,16)});window.scrollTo(0,0);}} className="px-3 py-1 rounded-lg font-bold text-xs text-white/30 border border-white/10 hover:text-white/60 transition-all">✎ Edit</button>
                  <button onClick={()=>deleteMatch(m.id)} className="px-3 py-1 rounded-lg font-bold text-xs text-red-400/40 border border-red-800/20 hover:text-red-400 transition-all">× Delete</button>
                </div>
              </div>
            ))}
            {matches.length===0&&<div className="text-center py-16 text-white/20"><p className="text-4xl mb-3">◉</p><p className="font-bold">No matches yet. Schedule one above.</p></div>}
          </div>
        )}

        {/* LINE-UPS TAB */}
        {tab==='lineups'&&(
          <div className="space-y-5">
            <SectionHeader icon="▦" title="Match Line-ups" sub="Select starting players for each match"/>
            {matches.filter(m => m.status !== 'finished').length === 0 && (
              <div className="text-center py-12 text-white/30">
                <p className="text-3xl mb-2">📋</p>
                <p className="font-bold">No upcoming matches to assign line-ups for.</p>
              </div>
            )}
            {matches.filter(m => m.status !== 'finished').map(m => {
              return (
                <Card key={m.id} className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white font-black text-sm">{m.home_dept} vs {m.away_dept}</p>
                      <p className="text-white/40 text-xs">{new Date(m.played_at).toLocaleString()}</p>
                    </div>
                    <span className="text-xs font-black px-3 py-1 rounded-full" style={{background:STATUS_CONFIG[m.status]?.bg,color:STATUS_CONFIG[m.status]?.color}}>
                      {STATUS_CONFIG[m.status]?.label}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {(['home', 'away'] as const).map(side => (
                      <div key={side}>
                        <p className="text-white/60 text-[10px] font-black uppercase tracking-widest mb-2">
                          {side === 'home' ? m.home_dept : m.away_dept} ({(selectedLineup[`${m.id}-${side}`] || []).length} selected)
                        </p>
                        <div className="max-h-60 overflow-y-auto space-y-1">
                          {players
                            .filter(p => p.department === (side === 'home' ? m.home_dept : m.away_dept))
                            .map(p => {
                              const key = `${m.id}-${side}`;
                              const isSelected = (selectedLineup[key] || []).some(s => s.player_id === p.id);
                              return (
                                <label key={p.id} className="flex items-center gap-2 p-1.5 rounded bg-white/5 hover:bg-white/10 cursor-pointer transition-colors">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => toggleLineupPlayer(m.id, p, side)}
                                  />
                                  <span className="text-white text-xs font-bold">{p.name}</span>
                                  <span className="text-[10px] px-1.5 rounded text-white font-black" style={{background:sBadge(p.position)}}>{p.position}</span>
                                </label>
                              );
                            })}
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => saveLineups(m.id)}
                    disabled={saving}
                    className="w-full py-3 rounded-xl font-black text-sm uppercase tracking-wider transition-all disabled:opacity-50 hover:scale-105"
                    style={{background:'linear-gradient(135deg,#00ff87,#00cc6a)',color:'#0a001a'}}
                  >
                    {saving ? 'Saving...' : `Save Line-ups for ${m.home_dept.split(' ')[0]} vs ${m.away_dept.split(' ')[0]}`}
                  </button>
                </Card>
              );
            })}
          </div>
        )}

        {/* EVENTS */}
        {tab==='events'&&(
          <div className="space-y-5">
            <SectionHeader icon="≡" title="Match Events" sub="Log goals, cards and other match events"/>
            <Card>
              <p className="text-white/30 text-[10px] font-black uppercase tracking-widest mb-4">Log New Event</p>
              <div className="grid sm:grid-cols-2 gap-3 mb-4">
                <div><label className="text-white/30 text-[10px] font-black uppercase tracking-widest block mb-1.5">Match</label>
                  <select value={eventForm.match_id} onChange={e=>{const m=matches.find(x=>x.id===e.target.value);setEventForm(p=>({...p,match_id:e.target.value,dept:m?.home_dept||''}));}} className={iCls}>
                    <option value="">Select a match</option>
                    {matches.filter(m=>m.status!=='scheduled').map(m=><option key={m.id} value={m.id}>{m.home_dept.split(' ')[0]} vs {m.away_dept.split(' ')[0]} — {STATUS_CONFIG[m.status]?.label}</option>)}
                  </select>
                </div>
                <div><label className="text-white/30 text-[10px] font-black uppercase tracking-widest block mb-1.5">Event Type</label>
                  <select value={eventForm.event_type} onChange={e=>{const et=EVENT_TYPES.find(x=>x.value===e.target.value);setEventForm(p=>({...p,event_type:e.target.value,fantasy_points:et?.points||0}));}} className={iCls}>
                    {EVENT_TYPES.map(et=><option key={et.value} value={et.value}>{et.icon} {et.label} ({et.points>0?'+':''}{et.points} pts)</option>)}
                  </select>
                </div>
                <div><label className="text-white/30 text-[10px] font-black uppercase tracking-widest block mb-1.5">Player Name</label><input type="text" value={eventForm.player_name} onChange={e=>setEventForm(p=>({...p,player_name:e.target.value}))} placeholder="e.g. Legzy" className={iCls}/></div>
                <div><label className="text-white/30 text-[10px] font-black uppercase tracking-widest block mb-1.5">Department</label>
                  <select value={eventForm.dept} onChange={e=>setEventForm(p=>({...p,dept:e.target.value}))} className={iCls}>
                    <option value="">Select department</option>
                    {DEPARTMENTS.map(d=><option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div><label className="text-white/30 text-[10px] font-black uppercase tracking-widest block mb-1.5">Minute</label><input type="number" min={1} max={120} value={eventForm.minute} onChange={e=>setEventForm(p=>({...p,minute:parseInt(e.target.value)||1}))} className={iCls}/></div>
                <div><label className="text-white/30 text-[10px] font-black uppercase tracking-widest block mb-1.5">Fantasy Points</label><input type="number" value={eventForm.fantasy_points} onChange={e=>setEventForm(p=>({...p,fantasy_points:parseInt(e.target.value)||0}))} className={iCls}/></div>
              </div>
              <button onClick={addEvent} disabled={saving} className="px-6 py-2.5 rounded-xl font-black text-sm uppercase tracking-wider disabled:opacity-50 hover:scale-105 transition-all" style={{background:'linear-gradient(135deg,#00ff87,#00cc6a)',color:'#0a001a'}}>{saving?'...':'+ Add Event'}</button>
            </Card>
            {eventForm.match_id&&eventsForMatch.length>0&&(
              <Card><p className="text-white/30 text-[10px] font-black uppercase tracking-widest mb-3">Events ({eventsForMatch.length})</p>
                <div className="space-y-1">
                  {eventsForMatch.sort((a,b)=>a.minute-b.minute).map(ev=>{const et=EVENT_TYPES.find(x=>x.value===ev.event_type);return(
                    <div key={ev.id} className="flex items-center justify-between py-2.5 px-4 rounded-xl" style={{background:'rgba(255,255,255,0.03)'}}>
                      <div className="flex items-center gap-3"><span className="font-black text-xs w-8 text-white/30">{ev.minute}&apos;</span><span className="text-base">{et?.icon}</span><div><p className="text-white text-sm font-bold">{ev.player_name}</p><p className="text-white/30 text-xs">{ev.dept}</p></div></div>
                      <div className="flex items-center gap-3"><span className="text-xs font-black px-2 py-1 rounded-lg" style={{background:ev.fantasy_points>=0?'rgba(0,255,135,0.12)':'rgba(239,68,68,0.12)',color:ev.fantasy_points>=0?'#00ff87':'#f87171'}}>{ev.fantasy_points>0?'+':''}{ev.fantasy_points} pts</span><button onClick={()=>ev.id&&deleteEvent(ev.id)} className="text-red-400/40 hover:text-red-400 font-black text-lg">×</button></div>
                    </div>
                  );})}
                </div>
              </Card>
            )}
          </div>
        )}

        {/* PRICES */}
        {tab==='players'&&(
          <div className="space-y-4">
            <SectionHeader icon="◎" title="Player Prices" sub={`${filteredPlayers.length} of ${players.length} players · edit price and click away to save`}/>
            <div className="flex flex-wrap gap-2">
              <select value={priceFilter.dept} onChange={e=>setPriceFilter(p=>({...p,dept:e.target.value}))} className="bg-black/40 border border-white/10 text-white text-sm rounded-xl px-3 py-2 outline-none"><option value="">All Departments</option>{DEPARTMENTS.map(d=><option key={d} value={d}>{d}</option>)}</select>
              <select value={priceFilter.pos} onChange={e=>setPriceFilter(p=>({...p,pos:e.target.value}))} className="bg-black/40 border border-white/10 text-white text-sm rounded-xl px-3 py-2 outline-none"><option value="">All Positions</option>{POSITIONS.map(p=><option key={p} value={p}>{p}</option>)}</select>
              <button onClick={()=>setPriceFilter({dept:'',pos:''})} className="px-4 py-2 rounded-xl text-xs font-bold text-white/40 border border-white/10 hover:border-white/20">Clear</button>
            </div>
            <div className="rounded-2xl overflow-hidden" style={{border:'1px solid rgba(255,255,255,0.07)'}}>
              <div className="px-5 py-3 flex justify-between items-center" style={{background:'rgba(0,0,0,0.4)',borderBottom:'1px solid rgba(255,255,255,0.05)'}}><p className="text-white font-black text-sm">Player Prices <span className="text-white/30 font-normal">({filteredPlayers.length})</span></p><p className="text-white/20 text-xs">Edit · auto-saves on blur</p></div>
              {filteredPlayers.map((p,i)=>{const cur=editedPrices[p.id]!==undefined?editedPrices[p.id]:p.price;const changed=editedPrices[p.id]!==undefined&&editedPrices[p.id]!==p.price;return(
                <div key={p.id} className="flex items-center justify-between px-5 py-3 flex-wrap gap-2" style={{background:i%2===0?'rgba(255,255,255,0.02)':'transparent',borderBottom:'1px solid rgba(255,255,255,0.04)'}}>
                  <div className="flex items-center gap-3"><span className="text-[10px] font-black px-2 py-0.5 rounded-lg text-white" style={{background:sBadge(p.position)}}>{p.position}</span><div><p className="text-white font-bold text-sm">{p.name}</p><p className="text-white/30 text-xs">{p.department}</p></div></div>
                  <div className="flex items-center gap-2">
                    <input type="number" step="0.1" min="1.0" max="20.0" value={cur} onChange={e=>handlePriceChange(p.id,e.target.value)} onBlur={()=>savePriceOnBlur(p)} className="w-20 bg-white/10 border border-white/20 text-white font-bold text-center rounded-lg px-2 py-1 text-sm outline-none focus:border-[#00ff87]/50" style={{color:changed?'#fbbf24':'#00ff87'}}/>
                    {changed&&<span className="text-xs text-yellow-400 font-bold">✎</span>}
                  </div>
                </div>
              );})}
            </div>
          </div>
        )}

        {/* POINTS */}
        {tab==='points'&&(
          <div className="space-y-5">
            <SectionHeader icon="★" title="Player Points" sub="Log match stats — FPL points auto-calculate"/>
            <Card>
              <p className="text-white/30 text-[10px] font-black uppercase tracking-widest mb-4">Log Points — GW{pointsForm.gameweek}</p>
              <div className="mb-4">
                <label className="text-white/30 text-[10px] font-black uppercase tracking-widest block mb-1.5">Search Player</label>
                <input type="text" value={pointsSearch} onChange={e=>setPointsSearch(e.target.value)} placeholder="Type player name or department…" className={iCls}/>
                {searchedPlayers.length>0&&(
                  <div className="mt-1 rounded-xl overflow-hidden" style={{border:'1px solid rgba(255,255,255,0.1)',background:'#0a001a'}}>
                    {searchedPlayers.slice(0,8).map(p=>(
                      <button key={p.id} onClick={()=>{setPointsForm(prev=>({...prev,player_id:p.id,player_name:p.name}));setPointsSearch('');}} className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-white/5 text-left border-b border-white/5 last:border-0">
                        <span className="text-white text-sm font-bold">{p.name}</span>
                        <span className="flex items-center gap-2"><span className="text-[10px] font-black px-2 py-0.5 rounded text-white" style={{background:sBadge(p.position)}}>{p.position}</span><span className="text-white/30 text-xs">{p.department}</span></span>
                      </button>
                    ))}
                  </div>
                )}
                {pointsForm.player_name&&(
                  <div className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-xl" style={{background:'rgba(0,255,135,0.08)',border:'1px solid rgba(0,255,135,0.2)'}}>
                    <span style={{color:'#00ff87'}} className="font-black text-sm">{pointsForm.player_name}</span>
                    <span className="text-white/30 text-xs">{players.find(p=>p.id===pointsForm.player_id)?.position} · {players.find(p=>p.id===pointsForm.player_id)?.department}</span>
                    <button onClick={()=>setPointsForm(p=>({...p,player_id:'',player_name:''}))} className="text-white/30 hover:text-white ml-1 font-black text-base leading-none">×</button>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {[{label:'Gameweek',key:'gameweek',min:1,max:38},{label:'Minutes Played',key:'minutes_played',min:0,max:120},{label:'Goals',key:'goals',min:0,max:10},{label:'Assists',key:'assists',min:0,max:10},{label:'Goals Conceded',key:'goals_conceded',min:0,max:20},{label:'Shots Saved (GK)',key:'shots_saved',min:0,max:20},{label:'Penalty Saves',key:'penalty_saves',min:0,max:5},{label:'Penalty Misses',key:'penalty_misses',min:0,max:5},{label:'Yellow Cards',key:'yellow_cards',min:0,max:2},{label:'Red Cards',key:'red_cards',min:0,max:1},{label:'Own Goals',key:'own_goals',min:0,max:5},{label:'CBIT',key:'cbit',min:0,max:30},{label:'Bonus (0–3)',key:'bonus',min:0,max:3}].map(f=>(
                  <div key={f.key}><label className="text-white/30 text-[10px] font-black uppercase tracking-widest block mb-1.5">{f.label}</label><input type="number" min={f.min} max={f.max} value={(pointsForm as any)[f.key]} onChange={e=>setPointsForm(p=>({...p,[f.key]:parseInt(e.target.value)||0}))} className={iCls}/></div>
                ))}
                <div className="flex flex-col justify-center gap-2">
                  <label className="text-white/30 text-[10px] font-black uppercase tracking-widest">Clean Sheet</label>
                  <button onClick={()=>setPointsForm(p=>({...p,clean_sheet:!p.clean_sheet}))} className="w-14 h-7 rounded-full transition-all relative flex-shrink-0" style={{background:pointsForm.clean_sheet?'#00ff87':'rgba(255,255,255,0.1)'}}>
                    <span className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-lg transition-all ${pointsForm.clean_sheet?'left-[calc(100%-26px)]':'left-0.5'}`}/>
                  </button>
                  <span className="text-xs font-black" style={{color:pointsForm.clean_sheet?'#00ff87':'rgba(255,255,255,0.2)'}}>{pointsForm.clean_sheet?'YES':'NO'}</span>
                </div>
              </div>
              {pointsForm.player_id&&previewPoints!==null&&(
                <div className="mt-5 p-5 rounded-2xl" style={{background:'linear-gradient(135deg,rgba(0,255,135,0.08),rgba(0,200,100,0.04))',border:'1px solid rgba(0,255,135,0.2)'}}>
                  <p className="text-white/40 text-[10px] font-black uppercase tracking-widest mb-1">Points Preview</p>
                  <p className="font-black leading-none" style={{fontSize:'3.5rem',color:'#00ff87'}}>{previewPoints}</p>
                  <p className="text-white/30 text-xs mt-1">{pointsForm.player_name} · GW{pointsForm.gameweek}</p>
                </div>
              )}
              <button onClick={submitPoints} disabled={saving||!pointsForm.player_id} className="mt-4 px-8 py-3 rounded-xl font-black text-sm uppercase tracking-wider disabled:opacity-40 hover:scale-105 transition-all" style={{background:'linear-gradient(135deg,#00ff87,#00cc6a)',color:'#0a001a'}}>{saving?'Saving...':'★ Submit Points'}</button>
            </Card>
            <Card>
              <p className="text-white/30 text-[10px] font-black uppercase tracking-widest mb-4">Scoring Rules 2025/26</p>
              <div className="space-y-4">
                {SCORING_RULES.map(section=>(
                  <div key={section.category}><p className="text-white/50 text-[9px] font-black uppercase tracking-widest mb-2 pb-1 border-b border-white/5">{section.category}</p>
                    <div className="space-y-1">{section.rules.map(r=>(<div key={r.label} className="flex items-center justify-between py-1.5 px-3 rounded-lg" style={{background:'rgba(255,255,255,0.02)'}}><span className="text-white/50 text-xs">{r.label}</span><span className="text-xs font-black ml-4 shrink-0" style={{color:r.pts.startsWith('+')?'#00ff87':r.pts==='0'?'rgba(255,255,255,0.2)':'#f87171'}}>{r.pts}</span></div>))}</div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* USERS */}
        {tab==='users'&&(
          <div className="space-y-4">
            <SectionHeader icon="◷" title="User Management" sub={`${users.length} registered accounts`}/>
            <div className="rounded-2xl overflow-hidden" style={{border:'1px solid rgba(255,255,255,0.07)'}}>
              <div className="px-5 py-3" style={{background:'rgba(0,0,0,0.4)',borderBottom:'1px solid rgba(255,255,255,0.05)'}}><p className="text-white font-black text-sm">Registered Users <span className="text-white/30 font-normal">({users.length})</span></p></div>
              {users.map((u,i)=>(
                <div key={u.id} className="flex items-center justify-between px-5 py-3 flex-wrap gap-2" style={{background:i%2===0?'rgba(255,255,255,0.02)':'transparent',borderBottom:'1px solid rgba(255,255,255,0.04)'}}>
                  <div><p className="text-white font-bold text-sm">{u.name||'(no name)'}</p><p className="text-white/30 text-xs">{u.email}</p><p className="text-white/30 text-xs">{u.department}</p></div>
                  <button onClick={async()=>{const{error}=await supabase.from('admin_users').insert({id:u.id});if(error)showMsg('error',error.message);else showMsg('success',`Admin granted to ${u.name||u.email}`);}} className="px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all" style={{background:'rgba(251,191,36,0.1)',color:'#fbbf24',border:'1px solid rgba(251,191,36,0.2)'}}>Grant Admin</button>
                </div>
              ))}
              {users.length===0&&<div className="px-5 py-10 text-white/20 text-sm text-center">No users registered yet</div>}
            </div>
            <Card><p className="text-white/30 text-[10px] font-black uppercase tracking-widest mb-2">Your Admin ID</p><code className="text-white/40 text-xs bg-black/40 px-4 py-3 rounded-xl block font-mono break-all">{user.id}</code></Card>
          </div>
        )}
      </div>
    </div>
  );
}