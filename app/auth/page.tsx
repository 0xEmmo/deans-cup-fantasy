'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import type { Session } from '@supabase/supabase-js';

export default function AuthPage() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showPrizePopup, setShowPrizePopup] = useState(true);
  const [formData, setFormData] = useState({ name: '', email: '', password: '', department: '' });
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const departments = [
    { id: 1, name: 'Statistics',              abbr: 'ASSON'   },
    { id: 2, name: 'Chemistry',               abbr: 'SCSN'    },
    { id: 3, name: 'Mathematics',             abbr: 'NAMSSN'  },
    { id: 4, name: 'Environmental Standards', abbr: 'PESSA'   },
    { id: 5, name: 'Physics',                 abbr: 'PHY'     },
    { id: 6, name: 'Geosciences',             abbr: 'GEO'     },
  ];

  useEffect(() => {
    setMounted(true);
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }: { data: { session: Session | null } }) => {
      if (session) router.replace('/team');
    });
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    const supabase = createClient();

    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        });
        if (error) throw error;
        if (!data.session) throw new Error('Login succeeded but no session returned.');
        setMessage({ type: 'success', text: 'ACCESS GRANTED. REDIRECTING...' });
        await new Promise(r => setTimeout(r, 800));
        router.replace('/team');
      } else {
        if (!formData.name || !formData.department) throw new Error('PLEASE FILL IN ALL FIELDS');
        const selectedDept = departments.find(d => d.name === formData.department);
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: { data: { name: formData.name, department: formData.department } },
        });
        if (authError) throw authError;
        if (!authData.user) throw new Error('SIGNUP FAILED — TRY AGAIN');
        const { error: profileError } = await supabase.from('users').upsert([{
          id: authData.user.id, name: formData.name, email: formData.email,
          department: formData.department, department_id: selectedDept?.id || null,
        }], { onConflict: 'id', ignoreDuplicates: false });
        if (profileError) console.error('Profile sync error:', profileError);
        if (authData.session) {
          setMessage({ type: 'success', text: 'REGISTERED! ENTERING...' });
          await new Promise(r => setTimeout(r, 800));
          router.replace('/team');
        } else {
          setMessage({ type: 'success', text: `REGISTERED! CHECK ${formData.email.toUpperCase()} TO CONFIRM.` });
          setTimeout(() => setIsLogin(true), 3000);
        }
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message.toUpperCase() });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 font-sans relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #0a1628 0%, #0d1f3c 40%, #0a1628 100%)' }}>

      {/* ─── PRIZE POOL POPUP ─────────────────────────────────────────── */}
      {showPrizePopup && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
        >
          <div
            className="w-full max-w-sm rounded-2xl overflow-hidden relative"
            style={{
              background: 'linear-gradient(160deg, #0d1f3c 0%, #0a1628 100%)',
              border: '1px solid rgba(201,168,76,0.35)',
              boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
            }}
          >
            {/* Gold top bar */}
            <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg,#c9a84c,#a8863a,#c9a84c)' }} />

            {/* Close button */}
            <button
              onClick={() => setShowPrizePopup(false)}
              className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center transition-colors"
              style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.4)', fontSize: '18px', border: 'none', cursor: 'pointer' }}
            >
              ×
            </button>

            <div className="p-6">
              {/* Header */}
              <div className="flex items-center gap-3 mb-5">
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 text-xl"
                  style={{ background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.4)' }}
                >
                  🏆
                </div>
                <div>
                  <p
                    className="text-[10px] font-black uppercase tracking-[0.2em] mb-0.5"
                    style={{ color: 'rgba(201,168,76,0.6)' }}
                  >
                    Optional Entry
                  </p>
                  <p className="text-white font-black text-lg leading-tight">Win the Prize Pool</p>
                </div>
              </div>

              {/* Prize pool hero */}
              <div
                className="rounded-xl p-4 mb-4 text-center"
                style={{ background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)' }}
              >
                <p
                  className="text-[10px] font-black uppercase tracking-widest mb-2"
                  style={{ color: 'rgba(201,168,76,0.6)' }}
                >
                  🔥 Prize Pool
                </p>
                <p className="font-black text-white leading-tight" style={{ fontSize: '1.4rem' }}>
                  Top 3 managers win.
                </p>
                <p className="text-white/30 text-xs mt-2">The more who enter, the bigger it gets.</p>
              </div>

              {/* Winners breakdown */}
              <div
                className="rounded-xl p-4 mb-4 space-y-2.5"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(201,168,76,0.12)' }}
              >
                <p
                  className="text-[10px] font-black uppercase tracking-widest mb-3"
                  style={{ color: 'rgba(201,168,76,0.5)' }}
                >
                  Winners
                </p>
                {[
                  { place: '🥇 1st Place', desc: 'Biggest share of the pool', color: '#c9a84c' },
                  { place: '🥈 2nd Place', desc: 'Solid reward for finishing strong', color: 'rgba(255,255,255,0.6)' },
                  { place: '🥉 3rd Place', desc: 'Still walks away winning', color: '#cd7f32' },
                ].map(row => (
                  <div key={row.place} className="flex items-center justify-between gap-2">
                    <span className="text-sm font-black flex-shrink-0" style={{ color: row.color }}>{row.place}</span>
                    <span className="text-xs text-right" style={{ color: 'rgba(255,255,255,0.35)' }}>{row.desc}</span>
                  </div>
                ))}
              </div>

              {/* Description */}
              <p className="text-sm mb-4 leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>
                Lock in your spot for just{' '}
                <span className="font-black" style={{ color: 'rgba(255,255,255,0.85)' }}>₦1,000</span>.
                {' '}Every entry grows the prize pool — the more managers that join, the more there is to win.{' '}
                <span className="font-black" style={{ color: '#c9a84c' }}>Don&apos;t sleep on this.</span>{' '}
                Still completely optional — you can play for free.
              </p>

              {/* Account details */}
              <div
                className="rounded-xl p-4 mb-4 space-y-2.5"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                <p
                  className="text-[10px] font-black uppercase tracking-widest mb-3"
                  style={{ color: 'rgba(201,168,76,0.5)' }}
                >
                  Payment Details
                </p>
                {[
                  { label: 'Account number', value: '7674711232' },
                  { label: 'Bank',           value: 'PocketApp' },
                  { label: 'Account name',   value: 'Hezekiah Precious Nsikan' },
                ].map(row => (
                  <div key={row.label} className="flex items-center justify-between gap-2">
                    <span className="text-xs flex-shrink-0" style={{ color: 'rgba(255,255,255,0.35)' }}>
                      {row.label}
                    </span>
                    <span className="text-white font-black text-sm text-right">{row.value}</span>
                  </div>
                ))}
              </div>

              {/* WhatsApp CTA */}
              <a
                href="https://wa.me/2349077398038?text=Hi!%20Here%20is%20my%20Dean%27s%20Games%20Fantasy%20prize%20pool%20payment%20receipt.%20Please%20confirm%20my%20entry%20%F0%9F%8F%86"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl font-black text-sm text-white mb-3 transition-opacity hover:opacity-90"
                style={{ background: 'linear-gradient(135deg,#25D366,#128C7E)', textDecoration: 'none' }}
              >
                📲 Share receipt on WhatsApp
              </a>

              {/* Skip */}
              <button
                onClick={() => setShowPrizePopup(false)}
                className="w-full py-3 rounded-xl font-black text-xs uppercase tracking-wider transition-colors"
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: 'rgba(255,255,255,0.3)',
                  cursor: 'pointer',
                }}
              >
                Skip — play for free
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ─── END PRIZE POOL POPUP ─────────────────────────────────────── */}

      {/* Background pitch texture */}
      <div className="absolute inset-0 z-0 opacity-[0.04]"
        style={{ backgroundImage: 'repeating-linear-gradient(45deg, #c9a84c 0px, #c9a84c 1px, transparent 1px, transparent 60px)', backgroundSize: '84px 84px' }} />

      {/* Soft glow blobs */}
      <div className="absolute top-1/4 left-1/4 w-80 h-80 rounded-full blur-3xl opacity-10 pointer-events-none"
        style={{ background: '#c9a84c' }} />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full blur-3xl opacity-8 pointer-events-none"
        style={{ background: '#1a56db' }} />

      {/* Background image overlay */}
      <div className="absolute inset-0 z-0"
        style={{ backgroundImage: "url('/Loginpage.jpg')", backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.06 }} />

      <div className="w-full max-w-md relative z-10">

        {/* Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative mb-4">
            <img src="/PES LOGO.png" alt="PES Logo" className="w-40 h-40 object-contain drop-shadow-2xl" />
          </div>
          <h1 className="text-2xl font-black uppercase tracking-tight text-center leading-tight">
            <span className="text-white">Dean&apos;s Games</span>{' '}
            <span style={{ color: '#c9a84c' }}>Fantasy</span>
          </h1>
          <div className="flex items-center gap-2 mt-2">
            <div className="h-px w-12 opacity-30" style={{ background: '#c9a84c' }} />
            <p className="text-[10px] font-black uppercase tracking-[0.3em]" style={{ color: 'rgba(201,168,76,0.6)' }}>
              Physical &amp; Earth Sciences
            </p>
            <div className="h-px w-12 opacity-30" style={{ background: '#c9a84c' }} />
          </div>
        </div>

        {/* Card */}
        <div className="rounded-2xl overflow-hidden shadow-2xl"
          style={{ background: 'rgba(13,31,60,0.85)', border: '1px solid rgba(201,168,76,0.2)', backdropFilter: 'blur(20px)', boxShadow: '0 24px 64px rgba(0,0,0,0.5), inset 0 1px 0 rgba(201,168,76,0.1)' }}>

          {/* Tab switcher */}
          <div className="flex" style={{ borderBottom: '1px solid rgba(201,168,76,0.15)' }}>
            {[{ key: true, label: 'Sign In' }, { key: false, label: 'Register' }].map(t => (
              <button key={String(t.key)} onClick={() => { setIsLogin(t.key); setMessage(null); }}
                className="flex-1 py-4 text-[11px] font-black uppercase tracking-[0.2em] transition-all relative"
                style={{ color: isLogin === t.key ? '#c9a84c' : 'rgba(255,255,255,0.3)', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                {t.label}
                {isLogin === t.key && (
                  <div className="absolute bottom-0 left-6 right-6 h-0.5 rounded-full"
                    style={{ background: 'linear-gradient(90deg, transparent, #c9a84c, transparent)' }} />
                )}
              </button>
            ))}
          </div>

          {/* Message banner */}
          {message && (
            <div className={`mx-6 mt-5 py-2.5 px-4 rounded-xl text-center text-[9px] font-black uppercase tracking-widest border ${
              message.type === 'error'
                ? 'bg-red-900/30 border-red-500/30 text-red-400'
                : 'border-opacity-40 text-opacity-90'
            }`}
              style={message.type === 'success' ? { background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.35)', color: '#c9a84c' } : {}}>
              {message.text}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-6 pb-7 pt-5 space-y-4">

            {!isLogin && (
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest mb-1.5" style={{ color: 'rgba(201,168,76,0.7)' }}>
                  Manager Name
                </label>
                <input type="text" name="name" value={formData.name} onChange={handleInputChange} required={!isLogin}
                  placeholder="Your full name"
                  className="w-full px-4 py-3.5 rounded-xl text-white font-bold text-sm placeholder:text-white/20 outline-none transition-all"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                  onFocus={e => e.target.style.borderColor = 'rgba(201,168,76,0.5)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                />
              </div>
            )}

            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest mb-1.5" style={{ color: 'rgba(201,168,76,0.7)' }}>
                Email
              </label>
              <input type="email" name="email" value={formData.email} onChange={handleInputChange} required
                placeholder="your@email.com"
                className="w-full px-4 py-3.5 rounded-xl text-white font-bold text-sm placeholder:text-white/20 outline-none transition-all"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                onFocus={e => e.target.style.borderColor = 'rgba(201,168,76,0.5)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest mb-1.5" style={{ color: 'rgba(201,168,76,0.7)' }}>
                Password
              </label>
              <input type="password" name="password" value={formData.password} onChange={handleInputChange} required
                placeholder="••••••••"
                className="w-full px-4 py-3.5 rounded-xl text-white font-bold text-sm placeholder:text-white/20 outline-none transition-all"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                onFocus={e => e.target.style.borderColor = 'rgba(201,168,76,0.5)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
              />
            </div>

            {!isLogin && (
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest mb-1.5" style={{ color: 'rgba(201,168,76,0.7)' }}>
                  Department
                </label>
                <select name="department" value={formData.department} onChange={handleInputChange} required={!isLogin}
                  className="w-full px-4 py-3.5 rounded-xl text-white font-bold text-sm appearance-none cursor-pointer outline-none transition-all"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <option value="" style={{ background: '#0d1f3c' }}>Select your department</option>
                  {departments.map(d => (
                    <option key={d.id} value={d.name} style={{ background: '#0d1f3c' }}>
                      {d.name} ({d.abbr})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="h-px w-full opacity-10 my-1" style={{ background: '#c9a84c' }} />

            <button type="submit" disabled={loading}
              className="w-full py-4 rounded-xl font-black uppercase tracking-[0.15em] text-[12px] transition-all disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden group"
              style={{ background: 'linear-gradient(135deg, #c9a84c, #a8863a)', color: '#0d1f3c', boxShadow: '0 4px 20px rgba(201,168,76,0.25)' }}>
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.15), transparent)' }} />
              <span className="relative">
                {loading ? 'Processing...' : isLogin ? '→ Enter Technical Area' : '→ Register Official Club'}
              </span>
            </button>
          </form>
        </div>

        {/* Department quick reference */}
        {!isLogin && (
          <div className="mt-4 rounded-xl p-3 grid grid-cols-3 gap-1.5"
            style={{ background: 'rgba(13,31,60,0.5)', border: '1px solid rgba(201,168,76,0.1)' }}>
            {departments.map(d => (
              <div key={d.id} className="text-center py-1">
                <p className="text-[9px] font-black uppercase tracking-wide" style={{ color: '#c9a84c' }}>{d.abbr}</p>
                <p className="text-[8px] text-white/30 mt-0.5 truncate">{d.name.split(' ')[0]}</p>
              </div>
            ))}
          </div>
        )}

        <p className="text-center text-[9px] font-black mt-6 uppercase tracking-widest" style={{ color: 'rgba(201,168,76,0.3)' }}>
          Dean&apos;s Games Fantasy · Unilag · 2026
        </p>
      </div>
    </div>
  );
}