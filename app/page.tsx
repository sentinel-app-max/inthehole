"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { getUserRounds } from "@/lib/firebase/firestore";
import type { Round } from "@/types";

export default function HomePage() {
  const { user, loading } = useAuth();
  const [rounds, setRounds] = useState<Round[]>([]);
  const [loadingRounds, setLoadingRounds] = useState(true);

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
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-green-700 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-6 space-y-6">
      {/* Hero */}
      <div className="rounded-2xl p-6 text-white" style={{ background: "linear-gradient(135deg, #1a5c2a 0%, #0f2d18 100%)" }}>
        <p className="text-sm text-white/70">Howzit, {firstName}! 👋</p>
        <h1 className="mt-1 text-2xl font-bold">Ready to play?</h1>
        <Link
          href="/round/new"
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-[#0f2d18] transition-opacity hover:opacity-90"
          style={{ background: "#c9a84c" }}
        >
          ⛳ Start New Round
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-gray-50 p-3 text-center">
          <p className="text-xl font-bold text-green-700">{totalRounds}</p>
          <p className="text-xs text-gray-500">Rounds</p>
        </div>
        <div className="rounded-xl bg-gray-50 p-3 text-center">
          <p className="text-xl font-bold text-green-700">{bestStableford || "—"}</p>
          <p className="text-xs text-gray-500">Best Stableford</p>
        </div>
        <div className="rounded-xl bg-gray-50 p-3 text-center">
          <p className="truncate text-sm font-semibold text-green-700">{lastCourse}</p>
          <p className="text-xs text-gray-500">Last Course</p>
        </div>
      </div>

      {/* Recent Rounds */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-gray-500 uppercase tracking-wide">
          Recent Rounds
        </h2>

        {loadingRounds ? (
          <div className="flex justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-4 border-green-700 border-t-transparent" />
          </div>
        ) : rounds.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 py-12 text-center">
            <p className="text-3xl">⛳</p>
            <p className="mt-2 text-sm font-semibold text-gray-600">No rounds yet</p>
            <p className="mt-1 text-xs text-gray-400">Start your first round to see it here</p>
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
                  className="flex items-center gap-3 rounded-xl bg-white p-4 shadow-sm border border-gray-100 transition-shadow hover:shadow-md"
                >
                  <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-green-700 text-sm font-bold text-white">
                    {pts}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-800">
                      {round.course.name}
                    </p>
                    <p className="text-xs text-gray-400">
                      {date} · {round.players.length} player{round.players.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700">
                      {pts} pts
                    </span>
                    <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600">
                      {gross}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
