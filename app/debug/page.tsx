'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';

export default function DebugPage() {
  const [log, setLog] = useState<string[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const addLog = (msg: string) => setLog(prev => [`[${new Date().toISOString().slice(11,19)}] ${msg}`, ...prev]);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data: { user: u }, error: authErr } = await supabase.auth.getUser();
      if (authErr) { addLog('AUTH ERROR: ' + authErr.message); return; }
      if (!u) { addLog('NOT LOGGED IN'); return; }
      setUser(u);
      addLog('Logged in as: ' + u.email);
      addLog('User ID: ' + u.id);

      const { data: adminRow, error: adminErr } = await supabase
        .from('admin_users').select('id').eq('id', u.id).single();
      if (adminErr) addLog('ADMIN CHECK ERROR: ' + adminErr.message);
      else if (!adminRow) addLog('NOT IN admin_users table');
      else { addLog('IS ADMIN: YES'); setIsAdmin(true); }

      const { data: matchData, error: matchErr } = await supabase
        .from('matches').select('*').order('played_at', { ascending: false }).limit(10);
      if (matchErr) addLog('LOAD MATCHES ERROR: ' + matchErr.message);
      else {
        addLog('Matches found: ' + (matchData?.length || 0));
        setMatches(matchData || []);
      }
    })();
  }, []);

  const testUpdate = async (matchId: string, currentStatus: string) => {
    const supabase = createClient();
    addLog('--- Testing UPDATE on: ' + matchId.slice(0,8) + '... ---');
    addLog('Current status: ' + currentStatus);

    const payload = {
      status: 'first_half',
      half_started_at: new Date().toISOString(),
      home_score: 0,
      away_score: 0,
    };

    const { data, error } = await supabase
      .from('matches')
      .update(payload)
      .eq('id', matchId)
      .select();

    if (error) {
      addLog('DB ERROR: ' + error.message);
      addLog('CODE: ' + error.code);
    } else if (!data || data.length === 0) {
      addLog('BLOCKED: 0 rows updated - RLS policy issue');
    } else {
      addLog('SUCCESS! Status is now: ' + data[0].status);
      const { data: fresh } = await supabase.from('matches').select('*').order('played_at', { ascending: false }).limit(10);
      setMatches(fresh || []);
    }
  };

  const resetMatch = async (matchId: string) => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('matches')
      .update({ status: 'scheduled', home_score: 0, away_score: 0, half_started_at: null })
      .eq('id', matchId)
      .select();
    if (error) addLog('RESET ERROR: ' + error.message);
    else if (!data || data.length === 0) addLog('RESET BLOCKED');
    else {
      addLog('Reset to scheduled OK');
      const { data: fresh } = await supabase.from('matches').select('*').order('played_at', { ascending: false }).limit(10);
      setMatches(fresh || []);
    }
  };

  const statusColor: Record<string, string> = {
    scheduled: '#a78bfa', first_half: '#f87171',
    half_time: '#fbbf24', second_half: '#f87171', finished: '#4ade80'
  };

  return (
    <div style={{ background: '#0a001a', minHeight: '100vh', padding: '24px', fontFamily: 'monospace', color: 'white' }}>
      <h1 style={{ color: '#00ff87', fontSize: '22px', marginBottom: '16px' }}>Admin Debug Panel</h1>

      {user && (
        <div style={{ background: 'rgba(0,255,135,0.08)', border: '1px solid rgba(0,255,135,0.3)', borderRadius: '12px', padding: '14px', marginBottom: '16px' }}>
          <p style={{ margin: '2px 0' }}>User: {user.email}</p>
          <p style={{ margin: '2px 0', fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>ID: {user.id}</p>
          <p style={{ margin: '6px 0 0', fontWeight: 'bold', color: isAdmin ? '#4ade80' : '#f87171' }}>
            Admin: {isAdmin ? 'YES' : 'NO'}
          </p>
        </div>
      )}

      {matches.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <p style={{ color: '#fbbf24', marginBottom: '10px', fontWeight: 'bold' }}>Click START to test the UPDATE:</p>
          {matches.map(m => (
            <div key={m.id} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '12px 16px', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <p style={{ fontWeight: 'bold', margin: 0, fontSize: '13px' }}>{m.home_dept} vs {m.away_dept}</p>
                <p style={{ fontSize: '11px', color: statusColor[m.status] || '#fff', margin: '3px 0 0' }}>Status: {m.status}</p>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={() => testUpdate(m.id, m.status)}
                  style={{ background: '#00ff87', color: '#0a001a', border: 'none', padding: '7px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>
                  START
                </button>
                <button onClick={() => resetMatch(m.id)}
                  style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.15)', padding: '7px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px' }}>
                  Reset
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '16px', maxHeight: '500px', overflowY: 'auto' }}>
        <p style={{ color: '#fbbf24', marginBottom: '8px', fontSize: '11px', fontWeight: 'bold' }}>LOG:</p>
        {log.length === 0 && <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>Loading...</p>}
        {log.map((l, i) => (
          <p key={i} style={{
            color: l.includes('ERROR') || l.includes('FAIL') || l.includes('BLOCKED') ? '#f87171'
                 : l.includes('SUCCESS') || l.includes('YES') || l.includes('OK') ? '#4ade80'
                 : l.includes('---') ? '#fbbf24'
                 : 'rgba(255,255,255,0.65)',
            fontSize: '12px', marginBottom: '3px', wordBreak: 'break-all'
          }}>{l}</p>
        ))}
      </div>
    </div>
  );
}