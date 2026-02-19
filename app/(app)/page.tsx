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
      <div className="flex min-h-screen items-center justify-center bg-[#f7f7f7]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#1a5c2a] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f7f7]">
      {/* Hero */}
      <div
        className="px-5 pb-8 pt-10"
        style={{ background: "linear-gradient(160deg, #1a5c2a 0%, #0f2d18 100%)" }}
      >
        <p className="text-sm font-medium text-white/60">
          Howzit, {firstName}! 👋
        </p>
        <h1 className="mt-1 text-3xl font-black tracking-tight text-white">
          Ready to play?
        </h1>
        <Link
          href="/new-round"
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-base font-black tracking-wide shadow-lg transition-all hover:brightness-110 active:scale-[0.98]"
          style={{ background: "#c9a84c", color: "#0f2d18" }}
        >
          ⛳ Start New Round
        </Link>
      </div>

      <div className="mx-auto max-w-lg px-4 -mt-1 space-y-5 pb-24">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-2xl bg-white p-4 text-center shadow-sm">
            <p className="text-3xl font-black text-[#1a5c2a]">{totalRounds}</p>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              Rounds
            </p>
          </div>
          <div className="rounded-2xl bg-white p-4 text-center shadow-sm">
            <p className="text-3xl font-black text-[#1a5c2a]">
              {bestStableford || "—"}
            </p>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              Best Pts
            </p>
          </div>
          <div className="rounded-2xl bg-white p-4 text-center shadow-sm">
            <p className="truncate text-sm font-bold text-[#1a5c2a]">
              {lastCourse}
            </p>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              Last Course
            </p>
          </div>
        </div>

        {/* Recent Rounds */}
        <div>
          <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-400">
            Recent Rounds
          </h2>

          {loadingRounds ? (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#1a5c2a] border-t-transparent" />
            </div>
          ) : rounds.length === 0 ? (
            <div className="rounded-2xl bg-white py-14 text-center shadow-sm">
              <p className="text-4xl">⛳</p>
              <p className="mt-3 text-base font-bold text-gray-700">
                No rounds yet
              </p>
              <p className="mt-1 text-sm text-gray-400">
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
                    className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm transition-shadow hover:shadow-md active:scale-[0.99]"
                  >
                    <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-[#1a5c2a] text-xl font-black text-white shadow-sm">
                      {pts}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-gray-800">
                        {round.course.name}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-400">
                        {date} · {round.players.length} player
                        {round.players.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <span className="rounded-full bg-[#1a5c2a]/10 px-3 py-1 text-xs font-bold text-[#1a5c2a]">
                        {pts} pts
                      </span>
                      <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-500">
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
