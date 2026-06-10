'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';

export default function ResetLeaderboardPage() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const checkAdmin = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/auth');
        return;
      }

      const { data: profile } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profile?.role !== 'admin') {
        router.push('/');
        return;
      }

      setIsAdmin(true);
      setChecking(false);
    };

    checkAdmin();
  }, [router]);

  const handleReset = async () => {
    setLoading(true);
    setMessage(null);
    const supabase = createClient();

    try {
      // Reset all users' total_points to 0
      const { error } = await supabase
        .from('users')
        .update({ total_points: 0 })
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Update all rows

      if (error) throw error;

      // If you have a points history table, delete those entries instead:
      // const { error: pointsError } = await supabase
      //   .from('points_history')
      //   .delete()
      //   .neq('id', '00000000-0000-0000-0000-000000000000');

      setMessage({ 
        type: 'success', 
        text: '✅ Leaderboard reset to 0 for all users. Accounts kept safe.' 
      });
      
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a1128' }}>
        <div className="text-yellow-400 font-black uppercase tracking-widest text-sm">
          Verifying admin access...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#0a1128' }}>
      <div className="max-w-md w-full p-8 rounded-2xl border border-blue-500/30 bg-blue-900/10 backdrop-blur-md">
        <h1 className="text-2xl font-black text-white mb-2">🔄 Reset Leaderboard</h1>
        <p className="text-blue-400 text-sm font-medium mb-6">
          This resets all user points to 0. <br />
          <span className="text-yellow-400">User accounts are NOT deleted.</span>
        </p>

        {message && (
          <div className={`p-4 rounded-xl mb-6 text-sm font-bold ${
            message.type === 'error' 
              ? 'bg-red-900/30 border border-red-500/50 text-red-400' 
              : 'bg-green-900/30 border border-green-500/50 text-green-400'
          }`}>
            {message.text}
          </div>
        )}

        <div className="mb-6 p-4 rounded-xl bg-black/30 border border-blue-500/20">
          <p className="text-white/60 text-xs font-medium">
            You will <span className="text-red-400 font-bold">lose all leaderboard data</span>, but all user accounts will remain active.
          </p>
        </div>

        <button
          onClick={handleReset}
          disabled={loading}
          className="w-full py-4 rounded-xl font-black uppercase tracking-[0.15em] text-sm transition-all bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Resetting...' : '🔄 Reset Points to 0'}
        </button>

        <div className="mt-6 text-center">
          <button
            onClick={() => router.push('/')}
            className="text-xs text-white/50 hover:text-white transition-colors"
          >
            ← Return to App
          </button>
        </div>
      </div>
    </div>
  );
}