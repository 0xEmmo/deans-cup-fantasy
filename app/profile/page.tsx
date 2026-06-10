"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";

const DEPT_COLORS: Record<string, string> = {
  Statistics: "#FF0000",
  Chemistry: "#00C853",
  Mathematics: "#2962FF",
  Physics: "#00E5FF",
  Geosciences: "#D84315",
  "Environmental Standards": "#1B4D3E",
};

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [team, setTeam] = useState<any>(null);
  const [authState, setAuthState] = useState<"loading" | "authed" | "guest">(
    "loading"
  );
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    const load = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        const {
          data: { user: u },
        } = await supabase.auth.getUser();
        if (!u) {
          setAuthState("guest");
          return;
        }
        setUser(u);
      } else {
        setUser(session.user);
      }

      const activeUser =
        session?.user ?? (await supabase.auth.getUser()).data.user;
      if (!activeUser) {
        setAuthState("guest");
        return;
      }

      setAuthState("authed");

      const { data: profileData } = await supabase
        .from("users")
        .select("*")
        .eq("id", activeUser.id)
        .single();

      setProfile(
        profileData ?? {
          name:
            activeUser.user_metadata?.name ||
            activeUser.email?.split("@")[0],
          department: activeUser.user_metadata?.department || "—",
          email: activeUser.email,
        }
      );

      const { data: teamData } = await supabase
        .from("user_teams")
        .select("*")
        .eq("user_id", activeUser.id)
        .single();

      setTeam(teamData);
    };

    load();

    // ✅ FIX: Explicitly typed parameters
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      if (event === "SIGNED_OUT") setAuthState("guest");
      if (event === "SIGNED_IN" && session) {
        setUser(session.user);
        setAuthState("authed");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/auth");
  };

  // ── Loading ───────────────────────────────────────────────────────────────
  if (authState === "loading")
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A1628] via-[#0F2240] to-[#0A1628] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-14 h-14 border-4 border-yellow-400/30 border-t-yellow-400 rounded-full animate-spin" />
          <p className="text-yellow-300 font-bold text-sm tracking-widest uppercase">
            Loading Profile
          </p>
        </div>
      </div>
    );

  // ── Guest ─────────────────────────────────────────────────────────────────
  if (authState === "guest")
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A1628] via-[#0F2240] to-[#0A1628] flex flex-col items-center justify-center gap-6 p-6">
        <div className="w-20 h-20 rounded-full bg-white/5 backdrop-blur-xl flex items-center justify-center border border-blue-500/20 shadow-2xl">
          <span className="text-4xl">🔒</span>
        </div>
        <h2 className="text-white font-black text-2xl uppercase tracking-tight">
          Sign In Required
        </h2>
        <p className="text-blue-200/80 text-sm text-center max-w-xs">
          You need to be logged in to view your manager profile.
        </p>
        <a
          href="/auth"
          className="mt-2 px-8 py-3 rounded-full font-black text-sm uppercase tracking-widest bg-yellow-400 text-black shadow-lg shadow-yellow-400/20 hover:shadow-yellow-400/40 transition-all transform hover:scale-105"
        >
          Sign In
        </a>
      </div>
    );

  // ── Authed ────────────────────────────────────────────────────────────────
  const displayName =
    profile?.name || user?.email?.split("@")[0] || "Manager";
  const department = profile?.department || "—";
  const initials = displayName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  const starters = team?.players?.filter((p: any) => !p.isBench) ?? [];
  const bench = team?.players?.filter((p: any) => p.isBench) ?? [];
  const deptColor = DEPT_COLORS[department] || "#1E3A8A";

  const POSITION_COLORS: Record<string, string> = {
    GK: "#f59e0b",
    DEF: "#3b82f6",
    MID: "#10b981",
    FWD: "#ef4444",
  };

  return (
    <div className="min-h-screen relative overflow-hidden font-sans" style={{ background: 'radial-gradient(ellipse at top, #0F2240, #0A1628)' }}>
      {/* Decorative background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 -left-20 w-72 h-72 bg-blue-900/30 rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-10 w-72 h-72 bg-yellow-900/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-2xl mx-auto p-6">
        {/* Nav */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => router.push("/team")}
            className="text-white/40 hover:text-yellow-400 text-[10px] font-black uppercase tracking-widest transition-all"
          >
            ← My Team
          </button>
          <h1 className="text-white font-black italic uppercase tracking-tighter text-xl drop-shadow-lg">
            Manager <span className="text-yellow-400">Card</span>
          </h1>
          <a
            href="/leaderboard"
            className="text-white/40 hover:text-yellow-400 text-[10px] font-black uppercase tracking-widest transition-all"
          >
            Leaderboard →
          </a>
        </div>

        {/* Profile Card */}
        <div className="rounded-3xl backdrop-blur-xl bg-white/5 border border-blue-500/20 shadow-2xl overflow-hidden transition-all duration-500 animate-in fade-in slide-in-from-bottom-4">
          {/* Banner */}
          <div className="relative p-10 text-center" style={{ background: `linear-gradient(135deg, ${deptColor}22, ${deptColor}44)` }}>
            {/* Glow effect */}
            <div className="absolute inset-0 opacity-20" style={{ background: `radial-gradient(circle at 50% 0%, ${deptColor}, transparent 70%)` }} />
            <div className="relative z-10">
              <div
                className="w-32 h-32 rounded-[2rem] mx-auto mb-6 flex items-center justify-center text-5xl font-black border-4 border-blue-300/20 shadow-2xl backdrop-blur-sm"
                style={{
                  background: `linear-gradient(135deg, #1E3A8A, #1E40AF)`,
                  color: "white",
                  textShadow: "0 2px 10px rgba(0,0,0,0.5)",
                }}
              >
                {initials}
              </div>
              <h2 className="text-white text-3xl font-black uppercase tracking-tighter leading-tight drop-shadow">
                {displayName}
              </h2>
              <div className="inline-flex items-center gap-2 mt-3 bg-black/30 backdrop-blur-md px-4 py-1.5 rounded-full border border-blue-400/20">
                <div
                  className="w-2.5 h-2.5 rounded-full animate-pulse shadow-[0_0_8px]"
                  style={{ backgroundColor: deptColor }}
                />
                <p className="text-blue-100 text-xs font-black uppercase tracking-widest">
                  {department}
                </p>
              </div>
            </div>
          </div>

          <div className="p-8 space-y-6">
            {/* Info grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-2xl bg-white/5 backdrop-blur-md border border-blue-500/20 p-5 shadow-lg transition-all hover:bg-white/10">
                <p className="text-[10px] font-black text-blue-300/70 uppercase tracking-widest mb-1">
                  Email
                </p>
                <p className="text-white font-bold text-sm truncate">
                  {user?.email}
                </p>
              </div>
              <div className="rounded-2xl bg-white/5 backdrop-blur-md border border-blue-500/20 p-5 shadow-lg transition-all hover:bg-white/10">
                <p className="text-[10px] font-black text-blue-300/70 uppercase tracking-widest mb-1">
                  Squad
                </p>
                <p className="text-white font-black text-2xl">
                  {starters.length + bench.length}
                  <span className="text-white/40 font-normal text-sm ml-1">
                    /15
                  </span>
                </p>
              </div>
              <div className="rounded-2xl bg-white/5 backdrop-blur-md border border-blue-500/20 p-5 shadow-lg transition-all hover:bg-white/10">
                <p className="text-[10px] font-black text-blue-300/70 uppercase tracking-widest mb-1">
                  Formation
                </p>
                <p className="text-white font-black text-2xl">
                  {team?.formation || "—"}
                </p>
              </div>
              <div className="rounded-2xl bg-white/5 backdrop-blur-md border border-blue-500/20 p-5 shadow-lg transition-all hover:bg-white/10">
                <p className="text-[10px] font-black text-blue-300/70 uppercase tracking-widest mb-1">
                  Budget Spent
                </p>
                <p className="text-white font-black text-2xl">
                  {team ? `£${Number(team.total_spent).toFixed(1)}m` : "—"}
                </p>
              </div>
            </div>

            {/* Squad list */}
            {team && starters.length > 0 && (
              <div>
                <p className="text-[10px] font-black text-blue-300/70 uppercase tracking-widest mb-3">
                  Starting XI
                </p>
                <div className="space-y-2">
                  {starters.map((p: any, i: number) => (
                    <div
                      key={i}
                      className="flex items-center justify-between py-3 px-4 rounded-xl bg-white/5 backdrop-blur-sm border border-blue-500/20 hover:bg-white/10 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className="text-[10px] font-black px-2.5 py-1 rounded-lg text-white shadow-md"
                          style={{
                            background: POSITION_COLORS[p.position] || "#666",
                          }}
                        >
                          {p.position}
                        </span>
                        <span className="text-white font-bold text-sm">
                          {p.name}
                          {p.id === team.captain_id && (
                            <span className="ml-2 text-yellow-400 text-[10px] font-black bg-yellow-400/20 px-1.5 py-0.5 rounded-full border border-yellow-400/30">
                              C
                            </span>
                          )}
                        </span>
                      </div>
                      <span className="text-yellow-400 font-black text-sm">
                        £{p.price.toFixed(1)}m
                      </span>
                    </div>
                  ))}
                </div>

                {bench.length > 0 && (
                  <>
                    <p className="text-[10px] font-black text-blue-300/70 uppercase tracking-widest mt-5 mb-3">
                      Bench
                    </p>
                    <div className="space-y-2">
                      {bench.map((p: any, i: number) => (
                        <div
                          key={i}
                          className="flex items-center justify-between py-3 px-4 rounded-xl bg-white/[0.02] backdrop-blur-sm border border-blue-500/20 opacity-60 hover:opacity-80 transition-all"
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className="text-[10px] font-black px-2.5 py-1 rounded-lg text-white shadow-md"
                              style={{
                                background: POSITION_COLORS[p.position] || "#666",
                              }}
                            >
                              {p.position}
                            </span>
                            <span className="text-white/80 font-bold text-sm">
                              {p.name}
                            </span>
                          </div>
                          <span className="text-yellow-400/80 font-black text-sm">
                            £{p.price.toFixed(1)}m
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {!team && (
              <div className="text-center py-8">
                <p className="text-white/60 text-sm mb-4">
                  No squad saved yet
                </p>
                <a
                  href="/team"
                  className="inline-block px-6 py-3 rounded-full font-black text-sm bg-yellow-400 text-black shadow-lg shadow-yellow-400/20 hover:shadow-yellow-400/40 transition-all transform hover:scale-105"
                >
                  Build My Team
                </a>
              </div>
            )}

            {/* Sign out */}
            <button
              onClick={handleSignOut}
              className="w-full bg-red-500/10 text-red-300 py-4 rounded-2xl font-black uppercase tracking-widest text-[11px] hover:bg-red-500/20 transition-all border border-red-500/20 backdrop-blur-sm"
            >
              Terminate Session
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}