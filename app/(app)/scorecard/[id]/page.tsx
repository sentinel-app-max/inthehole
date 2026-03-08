"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { getRound, saveRound, getMantra, getBag, getSwingSessions } from "@/lib/firebase/firestore";
import { getCourseById } from "@/lib/courses/data";
import { getHoleCoordinates } from "@/lib/courses/holes";
import { loadGoogleMaps } from "@/lib/maps/loader";
import { buildVisualHolePlan } from "@/lib/strategy/shotplan";
import MantraOverlay from "@/components/scorecard/MantraOverlay";
import HoleMapPreview from "@/components/scorecard/HoleMapPreview";
import {
  courseHcp,
  hcpStrokesOnHole,
  stablefordPoints,
  totalStableford,
  totalGross,
  toPar,
  netScore,
} from "@/lib/scoring/engine";
import type { Round, Player, PlayerResult, BagClub, SwingSession, HoleCoordinate } from "@/types";

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
  const { user } = useAuth();
  const roundId = params.id as string;

  const [round, setRound] = useState<Round | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentHole, setCurrentHole] = useState(0);
  const [scores, setScores] = useState<number[][]>([]);
  const [saving, setSaving] = useState(false);
  const [mantra, setMantra] = useState<string | null>(null);
  const [showMantra, setShowMantra] = useState(false);
  const mantraFetched = useRef(false);
  const [clubs, setClubs] = useState<BagClub[]>([]);
  const [sessions, setSessions] = useState<SwingSession[]>([]);
  const [holeCoords, setHoleCoords] = useState<HoleCoordinate[] | null>(null);
  const [mapsReady, setMapsReady] = useState(false);

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

  // Fetch mantra once on mount
  useEffect(() => {
    if (!user || mantraFetched.current) return;
    mantraFetched.current = true;
    getMantra(user.uid).then((m) => {
      if (m) {
        setMantra(m);
      }
    });
  }, [user]);

  // Fetch bag, sessions, hole coordinates for map preview
  useEffect(() => {
    if (!round || !user) return;

    const coords = getHoleCoordinates(round.course.id);
    setHoleCoords(coords);

    if (coords && coords.length > 0) {
      loadGoogleMaps()
        .then(() => setMapsReady(true))
        .catch(() => {});
    }

    Promise.all([getBag(user.uid), getSwingSessions(user.uid)]).then(
      ([bag, sess]) => {
        if (bag && bag.length > 0) setClubs(bag);
        setSessions(sess);
      }
    );
  }, [round, user]);

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

  // Use static course data for distances and tips (Firestore round may predate distance data)
  const staticCourse = getCourseById(round.course.id);
  const staticHole = staticCourse?.holes[currentHole] ?? hole;
  const playerTee = players[0]?.tee ?? "white";
  const holeDistance = staticHole.distances?.[playerTee] ?? hole.distances?.[playerTee];

  // Build visual plan for current hole (if coordinates exist)
  const currentHoleCoord = holeCoords?.find((hc) => hc.hole === hole.hole) ?? null;
  const visualPlan = mapsReady && currentHoleCoord
    ? buildVisualHolePlan({
        holeCoord: currentHoleCoord,
        holeInfo: staticHole,
        clubs,
        sessions,
        windDir: "N",
        windStr: "calm",
        tee: playerTee,
        handicap: players[0]?.handicap ?? 18,
      })
    : null;

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <style>{`.shot-pill{background:rgba(0,0,0,.85);padding:2px 8px;border-radius:8px;border:1px solid rgba(201,168,76,.3)}`}</style>
      {/* Mantra overlay — round start only */}
      {showMantra && mantra && (
        <MantraOverlay mantra={mantra} onDismiss={() => setShowMantra(false)} onUse={() => setShowMantra(false)} />
      )}

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
        <div className="w-12 flex items-center justify-end gap-1.5">
          {mantra && (
            <button
              onClick={() => setShowMantra(true)}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-[#c9a84c]/15 text-[#c9a84c] transition-colors active:bg-[#c9a84c]/30"
              aria-label="Show mantra"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </button>
          )}
          {saving && (
            <span className="text-[10px] text-[#c9a84c]/60">...</span>
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

      <div className="mx-auto max-w-lg px-4 pb-24 space-y-4 mt-4">
        {/* Hole card */}
        <div className="rounded-2xl bg-[#1e1e1e] p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-3xl font-black text-white">Hole {hole.hole}</p>
              <p className="text-xs font-semibold text-[#888888]">
                Par {hole.par}{holeDistance ? ` · ${holeDistance}m` : ""} · SI {hole.si}
              </p>
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

        {mantra && (
          <p className="text-xs font-thin uppercase tracking-[0.15em] text-[#c9a84c] text-center py-1 animate-mantra-glow">{mantra}</p>
        )}

        {/* Player scoring rows */}
        <div className="space-y-2">
          {players.map((player, pIdx) => {
            const score = scores[pIdx]?.[currentHole] ?? 0;
            const teeData = round.course.tees?.find((t) => t.colour === player.tee) ?? { cr: round.course.rating, slope: round.course.slope };
            const chcp = courseHcp(player.handicap, teeData.slope, teeData.cr, round.course.par);
            const strokes = hcpStrokesOnHole(chcp, hole.si);
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
                  {pts !== null ? pts : "·"}
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

        {/* Satellite map preview */}
        {visualPlan && <HoleMapPreview plan={visualPlan} />}

        {/* Coaching tip */}
        {staticHole.tip && (
          <div className="rounded-2xl bg-[#1e1e1e] border-t-2 border-[#c9a84c] px-5 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#c9a84c] mb-2">
              Tip
            </p>
            <p className="font-thin uppercase tracking-[0.25em] text-sm text-white/60 leading-relaxed">
              {staticHole.tip}
            </p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#0a0a0a] px-4 pb-4 pt-2">
        <div className="mx-auto max-w-lg flex gap-3">
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
