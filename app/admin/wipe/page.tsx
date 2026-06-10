'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';

export default function AdminWipePage() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);
  const router = useRouter();

  // ─── ADMIN CHECK ──────────────────────────────────────────────────────────
  useEffect(() => {
    const checkAdmin = async () => {
      const supabase = createClient();
      
      // 1. Check if user is logged in
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/auth');
        return;
      }

      // 2. Check if user has admin role
      const { data: profile, error } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();

      if (error || profile?.role !== 'admin') {
        router.push('/'); // Redirect non-admins to home
        return;
      }

      // 3. User is admin
      setIsAdmin(true);
      setChecking(false);
    };

    checkAdmin();
  }, [router]);

  // ─── WIPE FUNCTION ──────────────────────────────────────────────────────
  const handleWipe = async () => {
    if (confirmText !== 'WIPE ALL DATA') {
      setMessage({ type: 'error', text: 'Type "WIPE ALL DATA" to confirm.' });
      return;
    }

    setLoading(true);
    setMessage(null);
    const supabase = createClient();

    try {
      // Delete all users (keeps auth accounts but removes profiles)
      const { error: usersError } = await supabase
        .from('users')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (usersError) throw usersError;

      setMessage({ 
        type: 'success', 
        text: '✅ All test data wiped clean. Ready for fresh testing.' 
      });
      
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  // ─── LOADING STATE ──────────────────────────────────────────────────────
  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a1128' }}>
        <div className="text-yellow-400 font-black uppercase tracking-widest text-sm">
          Verifying admin access...
        </div>
      </div>
    );
  }

  // ─── RENDER PAGE ────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#0a1128' }}>
      <div className="max-w-md w-full p-8 rounded-2xl border border-red-500/30 bg-red-900/10 backdrop-blur-md">
        <h1 className="text-2xl font-black text-white mb-2">⚠️ Admin Wipe Tool</h1>
        <p className="text-red-400 text-sm font-medium mb-6">
          This will permanently delete all test user data from the database.
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

        <div className="mb-6">
          <label className="block text-xs font-black uppercase tracking-widest text-white/50 mb-2">
            Type <span className="text-red-400">WIPE ALL DATA</span> to confirm
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="WIPE ALL DATA"
            className="w-full px-4 py-3 rounded-xl bg-black/30 border border-red-500/30 text-white font-bold outline-none focus:border-red-500 transition-colors"
          />
        </div>

        <button
          onClick={handleWipe}
          disabled={loading || confirmText !== 'WIPE ALL DATA'}
          className={`w-full py-4 rounded-xl font-black uppercase tracking-[0.15em] text-sm transition-all ${
            confirmText === 'WIPE ALL DATA'
              ? 'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-500/20'
              : 'bg-gray-700 text-gray-400 cursor-not-allowed'
          }`}
        >
          {loading ? 'Wiping...' : '🗑️ Wipe All Test Data'}
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