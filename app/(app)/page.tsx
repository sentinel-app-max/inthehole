"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { getUserRounds } from "@/lib/firebase/firestore";
import type { Round } from "@/types";

export default function HomePage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [rounds, setRounds] = useState<Round[]>([]);
  const [loadingRounds, setLoadingRounds] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    getUserRounds(user.uid).then((r) => {
      setRounds(r.slice(0, 8));
      setLoadingRounds(false);
    });
  }, [user]);

  const firstName = user?.displayName?.split(" ")[0] ?? "Golfer";

  const totalRounds = rounds.length;
  const bestStableford = rounds.reduce((best, r) => {
    const pts = r.playerResults?.[0]?.stableford ?? 0;
    return Math.max(best, pts);
  }, 0);
  const lastCourse = rounds[0]?.course?.name ?? "—";

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#c9a84c] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Hero */}
      <div className="relative overflow-hidden" style={{ minHeight: "50vh" }}>
        {/* Background video */}
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
        >
          <source src="/videos/V2.mp4" type="video/mp4" />
        </video>
        {/* Dark overlay */}
        <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.55)" }} />

        <div className="relative z-10 flex flex-col justify-center px-5" style={{ minHeight: "50vh" }}>
          <p className="text-sm font-medium text-white/50">
            Howzit, {firstName}! 👋
          </p>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-white">
            Ready to play?
          </h1>
          <Link
            href="/new-round"
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-base font-black tracking-wide shadow-lg transition-all hover:brightness-110 active:scale-[0.98] bg-[#c9a84c] text-[#0a0a0a]"
          >
            ⛳ Start New Round
          </Link>
        </div>
      </div>

      {/* Gold divider */}
      <div className="mx-auto max-w-lg px-4">
        <div className="h-px bg-[#c9a84c]/20" />
      </div>

      <div className="mx-auto max-w-lg px-4 space-y-5" style={{ paddingBottom: "80px" }}>
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3" style={{ marginTop: "24px" }}>
          <div className="rounded-2xl bg-[#1e1e1e] p-4 text-center">
            <p className="text-3xl font-black text-[#c9a84c]">{totalRounds}</p>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-[#888888]">
              Rounds
            </p>
          </div>
          <div className="rounded-2xl bg-[#1e1e1e] p-4 text-center">
            <p className="text-3xl font-black text-[#c9a84c]">
              {bestStableford || "—"}
            </p>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-[#888888]">
              Best Pts
            </p>
          </div>
          <div className="rounded-2xl bg-[#1e1e1e] p-4 text-center">
            <p className="truncate text-sm font-bold text-white">
              {lastCourse}
            </p>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-[#888888]">
              Last Course
            </p>
          </div>
        </div>

        {/* Recent Rounds */}
        <div>
          <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-[#888888]">
            Recent Rounds
          </h2>

          {loadingRounds ? (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#c9a84c] border-t-transparent" />
            </div>
          ) : rounds.length === 0 ? (
            <div className="rounded-2xl bg-[#1e1e1e] py-14 text-center">
              <p className="text-4xl">⛳</p>
              <p className="mt-3 text-base font-bold text-white">
                No rounds yet
              </p>
              <p className="mt-1 text-sm text-[#888888]">
                Tap Start Round to get going
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {rounds.map((round) => {
                const result = round.playerResults?.[0];
                const pts = result?.stableford ?? 0;
                const gross = result?.gross ?? 0;
                const date = new Date(round.date).toLocaleDateString("en-ZA", {
                  day: "numeric",
                  month: "short",
                });

                return (
                  <Link
                    key={round.id}
                    href={`/round/${round.id}`}
                    className="flex items-center gap-4 rounded-2xl bg-[#1e1e1e] p-4 transition-all hover:bg-[#252525] active:scale-[0.99]"
                  >
                    <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-[#c9a84c] text-xl font-black text-[#0a0a0a]">
                      {pts}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-white">
                        {round.course.name}
                      </p>
                      <p className="mt-0.5 text-xs text-[#888888]">
                        {date} · {round.players.length} player
                        {round.players.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <span className="rounded-full bg-[#c9a84c]/15 px-3 py-1 text-xs font-bold text-[#c9a84c]">
                        {pts} pts
                      </span>
                      <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-semibold text-[#888888]">
                        {gross} gross
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
