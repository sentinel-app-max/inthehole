"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { getUserRounds } from "@/lib/firebase/firestore";
import type { Round } from "@/types";

interface CourseGroup {
  courseId: string;
  courseName: string;
  rounds: Round[];
  bestPoints: number;
  lastPlayed: string;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function groupByCourse(rounds: Round[]): CourseGroup[] {
  const map = new Map<string, Round[]>();

  for (const r of rounds) {
    const id = r.course.id;
    if (!map.has(id)) map.set(id, []);
    map.get(id)!.push(r);
  }

  const groups: CourseGroup[] = [];
  for (const [courseId, courseRounds] of map) {
    const bestPoints = courseRounds.reduce((best, r) => {
      const pts = r.playerResults?.[0]?.stableford ?? 0;
      return Math.max(best, pts);
    }, 0);

    groups.push({
      courseId,
      courseName: courseRounds[0].course.name,
      rounds: courseRounds,
      bestPoints,
      lastPlayed: courseRounds[0].date,
    });
  }

  // Sort by last played descending
  groups.sort(
    (a, b) => new Date(b.lastPlayed).getTime() - new Date(a.lastPlayed).getTime()
  );

  return groups;
}

export default function HistoryPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [groups, setGroups] = useState<CourseGroup[]>([]);
  const [loadingRounds, setLoadingRounds] = useState(true);
  const [expandedCourse, setExpandedCourse] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;

    getUserRounds(user.uid)
      .then((rounds) => {
        const complete = rounds.filter((r) => r.complete);
        setGroups(groupByCourse(complete));
      })
      .catch((err) => console.error("Failed to load history:", err))
      .finally(() => setLoadingRounds(false));
  }, [user]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#c9a84c] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen -mt-16">
      {/* Background video */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="fixed inset-0 w-full h-full object-cover"
      >
        <source src="/videos/Home_1.mp4" type="video/mp4" />
      </video>
      <div className="fixed inset-0 bg-black/75" />

      {/* Content */}
      <div className="relative z-10 px-4 pt-24 pb-8 mx-auto max-w-lg">
        <h1 className="text-xl font-bold text-[#c9a84c] uppercase tracking-widest mb-6">
          History
        </h1>

        {loadingRounds ? (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#c9a84c] border-t-transparent" />
          </div>
        ) : groups.length === 0 ? (
          <div className="rounded-2xl bg-[#1e1e1e] py-14 text-center">
            <p className="text-4xl">⛳</p>
            <p className="mt-3 text-base font-bold text-white">
              No completed rounds yet
            </p>
            <p className="mt-1 text-sm text-[#888888]">
              Play your first round and it&apos;ll show up here.
            </p>
            <Link
              href="/new-round"
              className="mt-5 inline-block rounded-xl bg-[#c9a84c] px-6 py-3 text-sm font-bold uppercase tracking-wider text-[#0a0a0a]"
            >
              Start a Round
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {groups.map((group) => {
              const isExpanded = expandedCourse === group.courseId;

              return (
                <div key={group.courseId}>
                  {/* Course card */}
                  <button
                    onClick={() =>
                      setExpandedCourse(isExpanded ? null : group.courseId)
                    }
                    className="w-full rounded-xl bg-[#1e1e1e] border border-[#c9a84c]/20 p-4 text-left transition-all active:scale-[0.99]"
                  >
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-white">
                          {group.courseName}
                        </p>
                        <p className="mt-1 text-xs text-[#888888]">
                          {group.rounds.length} round
                          {group.rounds.length !== 1 ? "s" : ""} · Last played{" "}
                          {formatDate(group.lastPlayed)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-lg font-black text-[#c9a84c]">
                            {group.bestPoints}
                          </p>
                          <p className="text-[10px] uppercase tracking-wider text-[#888888]">
                            Best pts
                          </p>
                        </div>
                        <span
                          className={`text-white/30 text-lg transition-transform ${
                            isExpanded ? "rotate-90" : ""
                          }`}
                        >
                          ›
                        </span>
                      </div>
                    </div>
                  </button>

                  {/* Expanded round list */}
                  {isExpanded && (
                    <div className="mt-1 ml-3 space-y-1">
                      {group.rounds.map((round) => {
                        const result = round.playerResults?.[0];
                        const pts = result?.stableford ?? 0;
                        const gross = result?.gross ?? 0;
                        const isStableford = round.scoringType === "stableford";

                        return (
                          <Link
                            key={round.id}
                            href={`/results/${round.id}`}
                            className="flex items-center justify-between rounded-lg bg-[#1e1e1e]/60 border border-white/5 px-4 py-3 transition-all hover:bg-[#252525] active:scale-[0.99]"
                          >
                            <div>
                              <p className="text-xs font-medium text-white/80">
                                {formatDate(round.date)}
                              </p>
                              <p className="text-[10px] uppercase tracking-wider text-[#888888]">
                                {isStableford ? "Stableford" : "Stroke Play"}
                              </p>
                            </div>
                            <span className="rounded-full bg-[#c9a84c]/15 px-3 py-1 text-xs font-bold text-[#c9a84c]">
                              {isStableford ? `${pts} pts` : `${gross} gross`}
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
