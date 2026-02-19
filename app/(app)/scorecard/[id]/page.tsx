"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { getRound, saveRound } from "@/lib/firebase/firestore";
import {
  playingHcp,
  hcpStrokesOnHole,
  stablefordPoints,
  totalStableford,
  totalGross,
  toPar,
  netScore,
} from "@/lib/scoring/engine";
import type { Round, Player, PlayerResult } from "@/types";

const PTS_COLORS: Record<number, string> = {
  5: "bg-purple-500 text-white",
  4: "bg-amber-400 text-white",
  3: "bg-[#1a5c2a] text-white",
  2: "bg-[#888888] text-white",
  1: "bg-orange-400 text-white",
  0: "bg-[#e63946] text-white",
};

export default function ScorecardPage() {
  const params = useParams();
  const router = useRouter();
  const roundId = params.id as string;

  const [round, setRound] = useState<Round | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentHole, setCurrentHole] = useState(0);
  const [scores, setScores] = useState<number[][]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getRound(roundId).then((r) => {
      if (!r) {
        router.push("/");
        return;
      }
      setRound(r);
      const holeCount = r.holes;
      const initial = r.players.map((p) =>
        p.scores.length > 0
          ? [...p.scores, ...Array(Math.max(0, holeCount - p.scores.length)).fill(0)]
          : Array(holeCount).fill(0)
      );
      setScores(initial);
      const firstEmpty = r.players[0]?.scores?.length ?? 0;
      setCurrentHole(Math.min(firstEmpty, holeCount - 1));
      setLoading(false);
    });
  }, [roundId, router]);

  const updateScore = useCallback(
    (playerIdx: number, delta: number) => {
      setScores((prev) =>
        prev.map((playerScores, i) => {
          if (i !== playerIdx) return playerScores;
          const updated = [...playerScores];
          updated[currentHole] = Math.max(1, Math.min(15, updated[currentHole] + delta));
          return updated;
        })
      );
    },
    [currentHole]
  );

  const setScore = useCallback(
    (playerIdx: number, value: number) => {
      setScores((prev) =>
        prev.map((playerScores, i) => {
          if (i !== playerIdx) return playerScores;
          const updated = [...playerScores];
          updated[currentHole] = Math.max(1, Math.min(15, value));
          return updated;
        })
      );
    },
    [currentHole]
  );

  const saveProgress = useCallback(
    async (updatedRound: Round) => {
      setSaving(true);
      try {
        await saveRound(updatedRound);
      } catch (err) {
        console.error("Save failed:", err);
      } finally {
        setSaving(false);
      }
    },
    []
  );

  const buildPlayers = useCallback((): Player[] => {
    if (!round) return [];
    return round.players.map((p, i) => ({
      ...p,
      scores: scores[i] ?? [],
    }));
  }, [round, scores]);

  const navigateHole = useCallback(
    async (direction: "prev" | "next") => {
      if (!round) return;
      const updated: Round = { ...round, players: buildPlayers() };
      await saveProgress(updated);
      setRound(updated);

      if (direction === "prev" && currentHole > 0) {
        setCurrentHole(currentHole - 1);
      } else if (direction === "next" && currentHole < round.holes - 1) {
        setCurrentHole(currentHole + 1);
      }
    },
    [round, currentHole, buildPlayers, saveProgress]
  );

  const finishRound = useCallback(async () => {
    if (!round) return;
    const players = buildPlayers();
    const course = round.course;

    const playerResults: PlayerResult[] = players.map((p) => {
      const front9 = p.scores.slice(0, 9).reduce((a, b) => a + b, 0);
      const back9 = p.scores.slice(9).reduce((a, b) => a + b, 0);
      return {
        name: p.name,
        handicap: p.handicap,
        stableford: totalStableford(p, course),
        gross: totalGross(p),
        net: netScore(p, course),
        toPar: toPar(p, course) ?? 0,
        front9,
        back9,
        scores: p.scores,
      };
    });

    const finished: Round = {
      ...round,
      players,
      playerResults,
      complete: true,
    };

    await saveProgress(finished);
    router.push(`/results/${round.id}`);
  }, [round, buildPlayers, saveProgress, router]);

  const handleBack = () => {
    if (confirm("Leave scorecard? Progress is saved.")) {
      router.push("/");
    }
  };

  if (loading || !round) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#c9a84c] border-t-transparent" />
      </div>
    );
  }

  const holeCount = round.holes;
  const hole = round.course.holes[currentHole];
  const isFirst = currentHole === 0;
  const isLast = currentHole === holeCount - 1;
  const isFront = currentHole < 9;
  const players = buildPlayers();

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Top bar */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ background: "linear-gradient(160deg, #141414 0%, #0a0a0a 100%)" }}
      >
        <button onClick={handleBack} className="text-sm font-semibold text-white/40 hover:text-white">
          ← Back
        </button>
        <div className="text-center">
          <p className="text-sm font-bold text-white truncate max-w-[200px]">
            {round.course.name}
          </p>
          <p className="text-[10px] uppercase tracking-wider text-[#c9a84c]">
            {round.scoringType === "stableford" ? "Stableford" : "Stroke Play"}
          </p>
        </div>
        <div className="w-12 text-right">
          {saving && (
            <span className="text-[10px] text-[#c9a84c]/60">Saving...</span>
          )}
        </div>
      </div>

      {/* Hole progress dots */}
      <div className="flex justify-center gap-1.5 py-3 bg-[#141414] border-b border-white/5">
        {Array.from({ length: holeCount }, (_, i) => {
          const hasScore = scores[0]?.[i] > 0;
          const isCurrent = i === currentHole;
          return (
            <button
              key={i}
              onClick={() => setCurrentHole(i)}
              className={`h-3 w-3 rounded-full transition-all ${
                isCurrent
                  ? "bg-[#c9a84c] scale-125 shadow-sm"
                  : hasScore
                  ? "bg-white"
                  : "bg-white/15"
              }`}
            />
          );
        })}
      </div>

      <div className="mx-auto max-w-lg px-4 pb-28 space-y-4 mt-4">
        {/* Hole card */}
        <div className="rounded-2xl bg-[#1e1e1e] p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-3xl font-black text-white">Hole {hole.hole}</p>
              <p className="text-xs font-semibold text-[#888888]">SI {hole.si}</p>
            </div>
            <div className="text-center">
              <p className="text-4xl font-black text-[#c9a84c]">{hole.par}</p>
              <p className="text-xs font-semibold text-[#888888]">PAR</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-[#888888]">
                {isFront ? "Front 9" : "Back 9"}
              </p>
              <p className="text-xs text-white/30">
                {currentHole + 1} of {holeCount}
              </p>
            </div>
          </div>
        </div>

        {/* Player scoring rows */}
        <div className="space-y-2">
          {players.map((player, pIdx) => {
            const score = scores[pIdx]?.[currentHole] ?? 0;
            const phcp = playingHcp(player.handicap);
            const strokes = hcpStrokesOnHole(phcp, hole.si);
            const pts = score > 0 ? stablefordPoints(score, hole.par, strokes) : null;
            const ptsClass = pts !== null ? PTS_COLORS[pts] ?? PTS_COLORS[0] : "bg-white/5 text-[#888888]";

            return (
              <div
                key={pIdx}
                className="flex items-center gap-3 rounded-2xl bg-[#1e1e1e] p-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-white truncate">
                    {player.name}
                  </p>
                  <p className="text-[10px] text-[#888888]">
                    HCP {player.handicap}{strokes > 0 ? ` (+${strokes})` : ""}
                  </p>
                </div>

                {/* Stepper */}
                <div className="flex items-center gap-0">
                  <button
                    onClick={() => updateScore(pIdx, -1)}
                    disabled={score <= 1}
                    className="flex h-10 w-10 items-center justify-center rounded-l-xl bg-white/5 text-lg font-bold text-white transition-colors hover:bg-white/10 disabled:opacity-30"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={15}
                    value={score || ""}
                    onChange={(e) => setScore(pIdx, Number(e.target.value))}
                    className="h-10 w-14 border-y border-white/5 bg-[#1e1e1e] text-center text-lg font-black text-white outline-none"
                  />
                  <button
                    onClick={() => updateScore(pIdx, 1)}
                    disabled={score >= 15}
                    className="flex h-10 w-10 items-center justify-center rounded-r-xl bg-white/5 text-lg font-bold text-white transition-colors hover:bg-white/10 disabled:opacity-30"
                  >
                    +
                  </button>
                </div>

                {/* Points badge */}
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-black ${ptsClass}`}
                >
                  {pts !== null ? pts : "–"}
                </div>
              </div>
            );
          })}
        </div>

        {/* Live totals */}
        <div className="rounded-2xl bg-[#1e1e1e] p-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-[#888888]">
            Running Totals
          </p>
          <div className="space-y-2">
            {players.map((player, pIdx) => {
              const runPts = totalStableford(player, round.course);
              const runGross = totalGross(player);
              return (
                <div key={pIdx} className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-white">{player.name}</p>
                  <div className="flex gap-3">
                    <span className="rounded-full bg-[#c9a84c]/15 px-3 py-1 text-xs font-bold text-[#c9a84c]">
                      {runPts} pts
                    </span>
                    <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-semibold text-[#888888]">
                      {runGross} gross
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="fixed bottom-16 left-0 right-0 bg-[#0a0a0a] px-4 pb-4 pt-2">
        <div className="flex gap-3">
          <button
            onClick={() => navigateHole("prev")}
            disabled={isFirst}
            className="flex-1 rounded-2xl bg-white py-3.5 text-sm font-bold text-[#0a0a0a] transition-all disabled:opacity-30"
          >
            ← Prev
          </button>
          {isLast ? (
            <button
              onClick={finishRound}
              className="flex-1 rounded-2xl py-3.5 text-sm font-black shadow-lg bg-[#c9a84c] text-[#0a0a0a]"
            >
              🏁 Finish Round
            </button>
          ) : (
            <button
              onClick={() => navigateHole("next")}
              className="flex-1 rounded-2xl py-3.5 text-sm font-black shadow-lg bg-[#c9a84c] text-[#0a0a0a]"
            >
              Next →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
