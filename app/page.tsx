'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import type { User, AuthChangeEvent, Session } from '@supabase/supabase-js';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

// ─── Swipeable Card Stack with hint animation ──────────────────────────────
const CARDS = [
  {
    title: 'Scout Talent',
    icon: '🧩',
    desc: 'Pick your 15‑man squad from all departments',
    href: '/team',
  },
  {
    title: 'Captaincy',
    icon: '👑',
    desc: 'Double points from your chosen team leader',
    href: '/team',
  },
  {
    title: 'Live Rankings',
    icon: '📊',
    desc: 'Real‑time updates as matches are played',
    href: '/leaderboard',
  },
];

function SwipeableCardStack() {
  const router = useRouter();
  const [cards, setCards] = useState([...CARDS]);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [exitDirection, setExitDirection] = useState<'left' | 'right' | null>(null);
  const [showHint, setShowHint] = useState(true);
  const startPos = useRef(0);
  const didDrag = useRef(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setShowHint(true), 2000);
    return () => clearTimeout(timer);
  }, [cards]);

  const handleDragStart = (clientX: number) => {
    setShowHint(false);
    startPos.current = clientX;
    setIsDragging(true);
    didDrag.current = false;
  };

  const handleDragMove = useCallback((clientX: number) => {
    if (!isDragging) return;
    const delta = clientX - startPos.current;
    if (Math.abs(delta) > 5) didDrag.current = true;
    setDragOffset(delta);
  }, [isDragging]);

  const handleDragEnd = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);
    if (Math.abs(dragOffset) > 100) {
      const dir = dragOffset > 0 ? 'right' : 'left';
      setExitDirection(dir);
      setTimeout(() => {
        setCards(prev => [...prev.slice(1), prev[0]]);
        setExitDirection(null);
        setDragOffset(0);
        setShowHint(false);
      }, 300);
    } else {
      setDragOffset(0);
    }
  }, [isDragging, dragOffset]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => handleDragMove(e.clientX);
    const handleMouseUp = () => handleDragEnd();
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  useEffect(() => {
    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging) return;
      e.preventDefault();
      handleDragMove(e.touches[0].clientX);
    };
    const handleTouchEnd = () => handleDragEnd();
    if (isDragging) {
      window.addEventListener('touchmove', handleTouchMove, { passive: false });
      window.addEventListener('touchend', handleTouchEnd);
    }
    return () => {
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  const resetDrag = () => {
    setDragOffset(0);
    setExitDirection(null);
  };

  useEffect(() => {
    resetDrag();
  }, [cards]);

  const handleClick = (href: string) => {
    if (!didDrag.current) {
      router.push(href);
    }
  };

  return (
    <div className="relative w-full max-w-sm mx-auto" style={{ height: '260px' }}>
      {cards.map((card, i) => {
        const isTop = i === 0;
        const scale = 1 - i * 0.05;
        const translateY = i * 8;
        const zIndex = cards.length - i;

        let transform = `scale(${scale}) translateY(${translateY}px)`;
        if (isTop) {
          const rotate = dragOffset * 0.1;
          const hintTransform = showHint && !isDragging ? 'translateX(12px)' : '';
          transform = `translateX(${dragOffset}px) rotate(${rotate}deg) ` + transform;
          if (exitDirection) {
            const exitX = exitDirection === 'left' ? -500 : 500;
            const exitRotate = exitDirection === 'left' ? -30 : 30;
            transform = `translateX(${exitX}px) rotate(${exitRotate}deg) scale(0.8)`;
          } else if (hintTransform) {
            transform = `translateX(${dragOffset}px) rotate(${rotate}deg) ${hintTransform} ` + `scale(${scale}) translateY(${translateY}px)`;
          }
        }

        return (
          <div
            key={card.title}
            ref={isTop ? cardRef : undefined}
            className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ease-out ${
              isTop ? 'cursor-grab active:cursor-grabbing' : ''
            }`}
            style={{
              transform,
              zIndex,
              opacity: isTop ? 1 : 0.6 + i * 0.1,
            }}
            onMouseDown={isTop ? (e) => handleDragStart(e.clientX) : undefined}
            onTouchStart={isTop ? (e) => handleDragStart(e.touches[0].clientX) : undefined}
            onClick={() => isTop && handleClick(card.href)}
          >
            <div className="w-full h-full rounded-[2rem] p-8 border border-yellow-400/10 bg-white/5 backdrop-blur-xl hover:bg-white/10 transition-colors group flex flex-col justify-center text-left shadow-2xl hover:shadow-[0_0_30px_rgba(234,179,8,0.2)] relative overflow-hidden">
              {isTop && showHint && !isDragging && (
                <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
                  <div className="flex items-center gap-2 text-yellow-400/40 animate-swipe-hint">
                    <span className="text-2xl font-light">➤</span>
                    <span className="text-xs font-black uppercase tracking-widest">swipe</span>
                  </div>
                </div>
              )}
              <div className="text-5xl mb-4 group-hover:scale-110 transition-transform duration-500">
                {card.icon}
              </div>
              <h3 className="font-black text-sm uppercase tracking-widest mb-2 text-white group-hover:text-yellow-400 transition-colors">
                {card.title}
              </h3>
              <p className="text-blue-200/80 text-xs font-bold uppercase leading-relaxed">
                {card.desc}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Home Page ─────────────────────────────────────────────────────────────
export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }: { data: { user: User | null } }) => {
      setUser(user);
      setLoading(false);
    });

    // ✅ FIX: Both parameters are now explicitly typed
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setDropdownOpen(false);
    setUser(null);
  };

  const shortEmail = user?.email?.split('@')[0] || '';
  const initials = shortEmail.slice(0, 2).toUpperCase();

  return (
    <div className="relative min-h-screen flex flex-col font-sans selection:bg-yellow-400 selection:text-[#0a1128]">
      
      {/* ─── TEAM PHOTO WALLPAPER ─── */}
      <div 
        className="absolute inset-0 z-0 bg-fixed bg-cover bg-center"
        style={{ backgroundImage: "url('/pessabackground.jpg')" }} 
      />
      
      {/* ─── DARK OVERLAY (Stronger for readability) ─── */}
      <div className="absolute inset-0 z-10 bg-gradient-to-br from-[#0a1128]/90 via-[#0d1b3e]/80 to-[#0a1128]/90" />

      {/* ─── CONTENT WRAPPER ─── */}
      <div className="relative z-20 flex flex-col min-h-screen">
        
        {/* Navigation Bar */}
        <nav className="flex items-center justify-between px-6 py-4 border-b border-blue-800/40 bg-[#0d1b3e]/60 backdrop-blur-md sticky top-0">
          <div className="flex items-center gap-3">
            <Image src="/PES LOGO.png" alt="PES Logo" width={38} height={38} />
            <h1 className="text-white text-lg font-black tracking-tighter uppercase italic">
              Dean&apos;s Cup <span className="text-yellow-400">Fantasy</span>
            </h1>
          </div>

          <div className="flex items-center gap-4">
            {!loading && (
              <>
                {user ? (
                  <>
                    <a href="/team" className="text-xs font-black uppercase tracking-widest hover:text-white transition-colors hidden sm:block text-yellow-400">
                      My Team
                    </a>
                    <a href="/leaderboard" className="text-blue-300 text-xs font-black uppercase tracking-widest hover:text-white transition-colors hidden sm:block">
                      Leaderboard
                    </a>

                    <div className="relative" ref={dropdownRef}>
                      <button
                        onClick={() => setDropdownOpen(!dropdownOpen)}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all hover:border-yellow-400/60"
                        style={{ background: 'rgba(234,179,8,0.1)', borderColor: 'rgba(234,179,8,0.3)' }}
                      >
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black" style={{ background: '#eab308', color: '#0a1128' }}>
                          {initials}
                        </div>
                        <span className="text-sm font-bold max-w-[120px] truncate text-yellow-400">
                          {shortEmail}
                        </span>
                        <svg className={`w-3 h-3 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>

                      {dropdownOpen && (
                        <div className="absolute right-0 mt-2 w-52 rounded-2xl shadow-2xl overflow-hidden z-50 bg-[#0a1128] border border-blue-500/20 backdrop-blur-xl">
                          <div className="px-4 py-3 border-b border-blue-800/50 bg-white/5">
                            <div className="text-white font-bold text-sm truncate">{user.email}</div>
                            <div className="text-blue-300 text-[10px] font-black uppercase tracking-widest mt-0.5">Manager Active</div>
                          </div>
                          <div className="py-1 text-white">
                            <a href="/team" className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-yellow-400/10 transition-colors"><span>🧩</span> My Team</a>
                            <a href="/leaderboard" className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-yellow-400/10 transition-colors"><span>🏆</span> Leaderboard</a>
                            <a href="/profile" className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-yellow-400/10 transition-colors"><span>👤</span> Profile</a>
                            <div className="border-t border-blue-800/50 my-1" />
                            <button onClick={handleSignOut} className="w-full text-left flex items-center gap-3 px-4 py-3 text-sm text-red-400 hover:bg-red-500/10"><span>🚪</span> Sign Out</button>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <a href="/auth" className="text-xs font-black uppercase tracking-widest px-6 py-2.5 rounded-full text-[#0a1128] transition-all hover:scale-105 active:scale-95 shadow-lg shadow-yellow-400/20" style={{ background: '#eab308' }}>
                    Sign In
                  </a>
                )}
              </>
            )}
          </div>
        </nav>

        {/* Hero Section */}
        <main className="flex-1 flex flex-col items-center justify-center px-4 text-center py-16">
          
          {/* ─── LOGO LAYOUT ─── */}
          <div className="mb-10 flex items-center justify-center gap-1 md:gap-2">
            {/* Only the PES Logo */}
            <div className="relative w-28 h-28 md:w-40 md:h-40 transition-transform hover:scale-110 duration-500">
               <Image src="/PES LOGO.png" alt="PES Logo" fill className="object-contain drop-shadow-[0_0_30px_rgba(255,255,255,0.1)]" />
            </div>
          </div>

          <h2 className="text-6xl md:text-9xl font-black text-white mb-2 leading-[0.8] tracking-tighter uppercase italic drop-shadow-2xl">
            Dean&apos;s Cup
          </h2>
          <h3 className="text-4xl md:text-7xl font-black mb-8 leading-none tracking-tighter uppercase italic text-yellow-400">
            Fantasy League
          </h3>
          
          <p className="text-blue-200 text-lg md:text-xl font-bold max-w-xl mb-12 uppercase tracking-tight opacity-90 leading-tight">
            Scout the best talent, choose your captain, <br className="hidden md:block" /> and dominate the league table.
          </p>

          {!loading && (
            <div className="flex flex-col sm:flex-row gap-5">
              <button 
                onClick={() => router.push(user ? '/team' : '/auth')}
                className="font-black text-xs uppercase tracking-[0.2em] px-14 py-5 rounded-2xl text-[#0a1128] shadow-2xl hover:scale-105 transition-all shadow-yellow-400/20" 
                style={{ background: '#eab308' }}
              >
                🧩 {user ? 'My Stadium' : 'Get Started'}
              </button>
              <button 
                onClick={() => router.push('/leaderboard')}
                className="font-black text-xs uppercase tracking-[0.2em] px-14 py-5 rounded-2xl text-white border-2 border-yellow-400/30 backdrop-blur-md hover:bg-white hover:text-[#0a1128] transition-all"
              >
                🏆 The Table
              </button>
            </div>
          )}
        </main>

        {/* ─── SWIPEABLE FEATURE CARDS ─── */}
        <section className="px-6 pb-16 max-w-6xl mx-auto w-full relative z-20">
          <SwipeableCardStack />
        </section>

        {/* Partnership Footer */}
        <footer className="mt-auto py-12 flex flex-col items-center border-t border-blue-500/10 bg-black/20 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-6 max-w-2xl px-6 w-full">
            
            <div className="flex items-center justify-center gap-6 md:gap-10">
               {/* PES Logo */}
               <div className="relative w-16 h-16 md:w-20 md:h-20">
                 <Image src="/PES LOGO.png" alt="PES Logo" fill className="object-contain" />
               </div>
               
               <div className="h-10 w-[1px] bg-blue-500/20" />
               
               {/* UNILAG Logo */}
               <div className="relative w-16 h-16 md:w-20 md:h-20">
                 <Image src="/UNILAG.png" alt="UNILAG" fill className="object-contain" />
               </div>
            </div>

            <div className="text-center space-y-2">
              <p className="text-white/80 text-[10px] md:text-xs font-black uppercase tracking-[0.3em]">
                In Collaboration With: <span className="text-yellow-400">PESSA UNILAG</span>
              </p>
              <p className="text-white/30 text-[9px] font-medium tracking-tight">
                © 2026 Dean&apos;s Cup Fantasy Official Portal. All rights reserved.
              </p>
            </div>
          </div>
          <div className="w-full max-w-md h-[1px] bg-gradient-to-r from-transparent via-yellow-400/30 to-transparent mt-8 blur-[0.5px]" />
        </footer>

      </div>
    </div>
  );
}