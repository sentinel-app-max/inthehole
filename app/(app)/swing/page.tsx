"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { getSwingSessions } from "@/lib/firebase/firestore";
import { analyseSwings, getClubBreakdown } from "@/lib/swing/analyser";
import type { SwingSession, SwingAnalysis } from "@/types";
import type { ClubBreakdown } from "@/lib/swing/analyser";

function pureRateColour(rate: number): string {
  if (rate > 60) return "text-[#2e8b47]";
  if (rate >= 40) return "text-[#c9a84c]";
  return "text-[#e63946]";
}

function pureRateBarColour(rate: number): string {
  if (rate > 60) return "bg-[#2e8b47]";
  if (rate >= 40) return "bg-[#c9a84c]";
  return "bg-[#e63946]";
}

function SkeletonCard() {
  return (
    <div className="bg-[#1e1e1e] rounded-xl p-4 animate-pulse">
      <div className="h-3 w-16 bg-white/10 rounded mb-3" />
      <div className="h-6 w-12 bg-white/10 rounded" />
    </div>
  );
}

function SkeletonClubCard() {
  return (
    <div className="bg-[#1e1e1e] rounded-xl p-4 animate-pulse">
      <div className="h-4 w-20 bg-white/10 rounded mb-3" />
      <div className="h-3 w-full bg-white/10 rounded mb-2" />
      <div className="h-3 w-32 bg-white/10 rounded" />
    </div>
  );
}

export default function SwingDashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [sessions, setSessions] = useState<SwingSession[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    getSwingSessions(user.uid)
      .then(setSessions)
      .finally(() => setFetching(false));
  }, [user]);

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#c9a84c] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Loading skeleton
  if (fetching) {
    return (
      <div className="min-h-screen text-white pb-8">
        <video autoPlay loop muted playsInline className="fixed inset-0 w-full h-full object-cover">
          <source src="/videos/Swing_1.mp4" type="video/mp4" />
        </video>
        <div className="fixed inset-0 bg-black/75" />
        <div className="relative z-10">
        <div className="px-4 pt-6 pb-4">
          <h1 className="text-2xl font-black">Swing Analyser</h1>
          <p className="text-sm text-white/50 mt-1">Loading your data...</p>
        </div>
        <div className="px-4 grid grid-cols-2 gap-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <div className="px-4 mt-6 space-y-3">
          <SkeletonClubCard />
          <SkeletonClubCard />
          <SkeletonClubCard />
        </div>
        </div>
      </div>
    );
  }

  const analysis: SwingAnalysis = analyseSwings(sessions);
  const clubs: ClubBreakdown[] = getClubBreakdown(sessions);
  const hasEnoughData = sessions.length >= 5;

  // Empty / not enough data state
  if (!hasEnoughData) {
    return (
      <div className="min-h-screen text-white pb-8">
        <video autoPlay loop muted playsInline className="fixed inset-0 w-full h-full object-cover">
          <source src="/videos/Swing_1.mp4" type="video/mp4" />
        </video>
        <div className="fixed inset-0 bg-black/75" />
        <div className="relative z-10">
        <div className="px-4 pt-6 pb-4">
          <h1 className="text-2xl font-black">Swing Analyser</h1>
        </div>

        <div className="px-4 mb-4">
          <div className="border border-[#c9a84c] bg-[#0a0a0a] rounded-xl px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-1 h-10 bg-[#c9a84c] rounded-full flex-shrink-0" />
              <p className="text-white/60 text-xs leading-relaxed">
                Log at least <span className="text-[#c9a84c] font-bold">5 shots</span> to unlock personalised coaching from the AI Coach. The more you log, the smarter your Coach gets.
              </p>
            </div>
            <Link
              href="/swing/log"
              className="bg-[#c9a84c] text-black text-xs font-bold uppercase tracking-wider px-3 py-2 rounded-lg whitespace-nowrap ml-3"
            >
              Log a Shot →
            </Link>
          </div>
        </div>

        {sessions.length > 0 && (
          <div className="px-4 mb-6 grid grid-cols-2 gap-3">
            <div className="bg-[#1e1e1e] rounded-xl p-4 border border-white/5">
              <p className="text-xs text-white/50 font-semibold uppercase tracking-wider">
                Total Shots
              </p>
              <p className="text-2xl font-black text-[#c9a84c] mt-1">
                {analysis.totalShots}
              </p>
            </div>
            <div className="bg-[#1e1e1e] rounded-xl p-4 border border-white/5">
              <p className="text-xs text-white/50 font-semibold uppercase tracking-wider">
                Pure Rate
              </p>
              <p
                className={`text-2xl font-black mt-1 ${pureRateColour(analysis.pureRate)}`}
              >
                {analysis.pureRate}%
              </p>
            </div>
          </div>
        )}

        <div className="px-4 flex flex-col items-center text-center mt-12">
          <div className="w-16 h-16 rounded-full bg-[#1e1e1e] border border-white/10 flex items-center justify-center text-3xl mb-4">
            🏌️
          </div>
          <p className="text-white/50 text-sm max-w-[260px]">
            Hit the range and start logging shots to see your swing patterns
            here.
          </p>
          <Link
            href="/swing/log"
            className="mt-6 bg-[#c9a84c] text-black font-bold py-4 px-8 rounded-xl text-lg active:bg-[#b8973b] transition-colors"
          >
            Log Your First Shot
          </Link>
        </div>
        </div>
      </div>
    );
  }

  // Full dashboard
  return (
    <div className="min-h-screen text-white pb-24">
      <video autoPlay loop muted playsInline className="fixed inset-0 w-full h-full object-cover">
        <source src="/videos/Swing_1.mp4" type="video/mp4" />
      </video>
      <div className="fixed inset-0 bg-black/75" />
      <div className="relative z-10">
      {/* Header */}
      <div className="px-4 pt-6 pb-4">
        <h1 className="text-2xl font-black">Swing Analyser</h1>
        <p className="text-sm text-white/50 mt-1">
          {analysis.totalShots} shots tracked
        </p>
      </div>

      {/* Summary Cards */}
      <div className="px-4 grid grid-cols-2 gap-3">
        <div className="bg-[#1e1e1e] rounded-xl p-4 border border-white/5">
          <p className="text-xs text-white/50 font-semibold uppercase tracking-wider">
            Total Shots
          </p>
          <p className="text-2xl font-black text-[#c9a84c] mt-1">
            {analysis.totalShots}
          </p>
        </div>
        <div className="bg-[#1e1e1e] rounded-xl p-4 border border-white/5">
          <p className="text-xs text-white/50 font-semibold uppercase tracking-wider">
            Pure Rate
          </p>
          <p
            className={`text-2xl font-black mt-1 ${pureRateColour(analysis.pureRate)}`}
          >
            {analysis.pureRate}%
          </p>
        </div>
        <div className="bg-[#1e1e1e] rounded-xl p-4 border border-white/5">
          <p className="text-xs text-white/50 font-semibold uppercase tracking-wider">
            Common Miss
          </p>
          <p className="text-lg font-bold mt-1 capitalize">
            {analysis.mostCommonMiss}
          </p>
        </div>
        <div className="bg-[#1e1e1e] rounded-xl p-4 border border-white/5">
          <p className="text-xs text-white/50 font-semibold uppercase tracking-wider">
            Contact Issue
          </p>
          <p className="text-lg font-bold mt-1 capitalize">
            {analysis.mostCommonBadContact}
          </p>
        </div>
      </div>

      {/* Club Breakdown */}
      <div className="mt-6 px-4">
        <h2 className="text-lg font-bold mb-3">Club Breakdown</h2>
        <div className="space-y-3">
          {clubs.map((club) => (
            <div
              key={club.club}
              className="bg-[#1e1e1e] rounded-xl p-4 border border-white/5"
            >
              <div className="flex items-center justify-between mb-2">
                <p className="font-bold">{club.club}</p>
                <p className="text-xs text-white/50">
                  {club.totalShots} shot{club.totalShots !== 1 ? "s" : ""}
                </p>
              </div>

              {/* Pure rate bar */}
              <div className="flex items-center gap-3 mb-2">
                <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${pureRateBarColour(club.pureRate)}`}
                    style={{ width: `${club.pureRate}%` }}
                  />
                </div>
                <span
                  className={`text-sm font-semibold w-10 text-right ${pureRateColour(club.pureRate)}`}
                >
                  {club.pureRate}%
                </span>
              </div>

              <div className="flex items-center gap-4 text-xs text-white/50">
                <span>
                  Miss:{" "}
                  <span className="text-white/70 capitalize">
                    {club.commonMiss}
                  </span>
                </span>
                <span>
                  Variance:{" "}
                  <span className="text-white/70">
                    {club.avgVariance}m
                  </span>
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Buttons */}
      <div className="fixed bottom-0 left-0 right-0 px-4 pb-4 pt-2 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a] to-transparent">
        <div className="flex gap-3">
          <Link
            href="/swing/log"
            className="flex-1 bg-[#c9a84c] text-black font-bold py-4 rounded-xl text-center text-lg active:bg-[#b8973b] transition-colors"
          >
            Log Shot
          </Link>
          <Link
            href="/swing/history"
            className="flex-1 border-2 border-white/20 text-white font-bold py-4 rounded-xl text-center text-lg active:bg-white/5 transition-colors"
          >
            Shot History
          </Link>
        </div>
      </div>
      </div>
    </div>
  );
}
