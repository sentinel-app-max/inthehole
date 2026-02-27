"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { getBag, getSwingSessions } from "@/lib/firebase/firestore";
import { enrichBagWithSwingData } from "@/lib/golf/distance";
import { getClubBreakdown } from "@/lib/swing/analyser";
import { SA_COURSES, PROVINCES } from "@/lib/courses/data";
import { hasHoleCoordinates } from "@/lib/courses/holes";
import {
  buildStrategy,
  type CourseStrategy,
  type HoleStrategy,
} from "@/lib/strategy/engine";
import type { Course, BagClub, SwingSession, TeeColour, WindDirection, WindStrength } from "@/types";

const PROVINCE_TABS = ["All", ...PROVINCES];

const TEE_BG: Record<TeeColour, string> = {
  blue: "#2563eb",
  white: "#ffffff",
  yellow: "#eab308",
  red: "#dc2626",
};

const DIRECTIONS: WindDirection[] = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
const STRENGTHS: WindStrength[] = ["calm", "light", "moderate", "strong"];

// ── Step 1: Setup ────────────────────────────────────────────────────

function SetupStep({
  onGenerate,
}: {
  onGenerate: (course: Course, tee: TeeColour, handicap: number, windDir: WindDirection, windStr: WindStrength) => void;
}) {
  const [search, setSearch] = useState("");
  const [province, setProvince] = useState("All");
  const [selected, setSelected] = useState<Course | null>(null);
  const [tee, setTee] = useState<TeeColour>("white");
  const [handicap, setHandicap] = useState(18);
  const [windDir, setWindDir] = useState<WindDirection>("N");
  const [windStr, setWindStr] = useState<WindStrength>("calm");

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return SA_COURSES.filter((c) => {
      const matchProvince = province === "All" || c.province === province;
      const matchSearch =
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.city.toLowerCase().includes(q);
      return matchProvince && matchSearch;
    });
  }, [search, province]);

  const teeDatum = selected?.tees?.find((t) => t.colour === tee);

  return (
    <>
      <div className="px-5 pb-4 pt-6">
        <h1 className="text-2xl font-black text-white">Pre-Round Strategy</h1>
        <p className="mt-1 text-sm text-[#888888]">
          Your hole-by-hole game plan
        </p>
      </div>

      <div className="mx-auto max-w-lg px-4 pb-24 space-y-4">
        {/* Course search */}
        <input
          type="text"
          placeholder="Search courses..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-[#1e1e1e] px-4 py-3 text-sm text-white placeholder-white/30 outline-none focus:border-[#c9a84c]"
        />

        {/* Province tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 no-scrollbar">
          {PROVINCE_TABS.map((p) => (
            <button
              key={p}
              onClick={() => setProvince(p)}
              className={`flex-shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
                province === p
                  ? "bg-[#c9a84c] text-[#0a0a0a]"
                  : "bg-[#1e1e1e] text-[#888888] border border-white/10"
              }`}
            >
              {p === "KwaZulu-Natal" ? "KZN" : p}
            </button>
          ))}
        </div>

        {/* Course list */}
        <div className="space-y-2">
          {filtered.map((c) => (
            <div key={c.id}>
              <button
                onClick={() => setSelected(c)}
                className={`flex w-full items-center gap-3 rounded-2xl bg-[#1e1e1e] p-4 text-left transition-all ${
                  selected?.id === c.id
                    ? "border-2 border-[#c9a84c] ring-2 ring-[#c9a84c]/20"
                    : "border border-white/5"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-white">{c.name}</p>
                  <p className="mt-0.5 text-xs text-[#888888]">
                    {c.city}, {c.province}
                  </p>
                </div>
                <span className="rounded-lg bg-[#c9a84c]/15 px-2 py-1 text-xs font-bold text-[#c9a84c]">
                  Par {c.par}
                </span>
                {selected?.id === c.id && (
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#c9a84c] text-xs text-[#0a0a0a] font-bold">
                    ✓
                  </span>
                )}
              </button>
              {hasHoleCoordinates(c.id) && (
                <Link
                  href={`/strategy/${c.id}`}
                  className="mt-1 block rounded-xl bg-[#c9a84c]/10 border border-[#c9a84c]/20 px-4 py-2 text-center text-xs font-bold text-[#c9a84c] transition-colors hover:bg-[#c9a84c]/20"
                >
                  Visual Shot Planner →
                </Link>
              )}
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="py-8 text-center text-sm text-[#888888]">
              No courses found
            </p>
          )}
        </div>

        {/* Settings (shown after course selected) */}
        {selected && (
          <>
            {/* Tee selector */}
            <div className="rounded-2xl bg-[#1e1e1e] p-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-widest text-[#888888]">
                Tee
              </p>
              <div className="flex items-center gap-3">
                {(["blue", "white", "yellow", "red"] as TeeColour[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTee(t)}
                    className={`h-8 w-8 rounded-full border-2 transition-all ${
                      tee === t
                        ? "border-[#c9a84c] scale-110"
                        : "border-white/10 opacity-40"
                    }`}
                    style={{ backgroundColor: TEE_BG[t] }}
                  />
                ))}
                {teeDatum && (
                  <p className="ml-auto text-xs text-[#888888]">
                    CR {teeDatum.cr} · Slope {teeDatum.slope}
                  </p>
                )}
              </div>
            </div>

            {/* Handicap */}
            <div className="rounded-2xl bg-[#1e1e1e] p-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-widest text-[#888888]">
                Handicap
              </p>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={54}
                value={handicap}
                onChange={(e) =>
                  setHandicap(Math.min(54, Math.max(0, Number(e.target.value))))
                }
                className="w-20 rounded-xl border border-white/10 bg-[#0a0a0a] px-3 py-2 text-center text-lg font-bold text-white outline-none focus:border-[#c9a84c]/50"
              />
            </div>

            {/* Wind */}
            <div className="rounded-2xl bg-[#1e1e1e] p-4">
              <label className="text-xs font-bold uppercase tracking-widest text-[#888888]">
                Wind direction
              </label>
              <div className="mt-2 flex flex-wrap justify-center gap-2">
                {DIRECTIONS.map((dir) => (
                  <button
                    key={dir}
                    onClick={() => setWindDir(dir)}
                    className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold transition-all ${
                      windDir === dir
                        ? "bg-[#c9a84c] text-[#0a0a0a] scale-110"
                        : "bg-[#0a0a0a] text-[#888888] hover:bg-[#252525]"
                    }`}
                  >
                    {dir}
                  </button>
                ))}
              </div>

              <div className="mt-4">
                <label className="text-xs font-bold uppercase tracking-widest text-[#888888]">
                  Strength
                </label>
                <div className="mt-2 flex gap-2">
                  {STRENGTHS.map((s) => (
                    <button
                      key={s}
                      onClick={() => setWindStr(s)}
                      className={`flex-1 rounded-full py-2 text-xs font-bold capitalize transition-all ${
                        windStr === s
                          ? "bg-[#c9a84c] text-[#0a0a0a]"
                          : "bg-[#0a0a0a] text-[#888888] hover:bg-[#252525]"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Generate button */}
      <div className="fixed bottom-0 left-0 right-0 z-20 bg-[#0a0a0a]/90 backdrop-blur px-4 pb-4 pt-2">
        <button
          disabled={!selected}
          onClick={() => selected && onGenerate(selected, tee, handicap, windDir, windStr)}
          className="w-full rounded-2xl py-4 text-sm font-black shadow-lg transition-all disabled:opacity-40 bg-[#c9a84c] text-[#0a0a0a]"
        >
          Generate Strategy
        </button>
      </div>
    </>
  );
}

// ── Step 2: Strategy View ────────────────────────────────────────────

function HoleCard({ hole }: { hole: HoleStrategy }) {
  const targetLabel =
    hole.targetScore === hole.par
      ? "par"
      : hole.targetScore === hole.par + 1
        ? "bogey"
        : hole.targetScore === hole.par + 2
          ? "double bogey"
          : `+${hole.targetScore - hole.par}`;

  return (
    <div className="rounded-2xl bg-[#1e1e1e] p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-lg font-black text-white">
            Hole {hole.hole}
          </span>
          <span className="rounded-lg bg-white/5 px-2 py-0.5 text-xs font-bold text-[#888888]">
            Par {hole.par}
          </span>
        </div>
        <span className="text-xs font-bold text-[#888888]">SI {hole.si}</span>
      </div>

      {/* Stroke allocation */}
      {hole.strokes > 0 && (
        <div className="mt-2 flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#c9a84c]" />
          <span className="text-xs font-bold text-[#c9a84c]">
            You get {hole.strokes} stroke{hole.strokes > 1 ? "s" : ""}
          </span>
        </div>
      )}

      {/* Go for it flag */}
      {hole.goForIt && (
        <div className="mt-2 flex items-center gap-1.5">
          <span className="text-xs font-bold text-[#2e8b47]">
            Reachable in 2 — go for it!
          </span>
        </div>
      )}

      {/* Shot plans */}
      {hole.shots.length > 0 ? (
        <div className="mt-3 space-y-3">
          {hole.shots.map((shot, i) => (
            <div key={i}>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#888888]">
                {shot.label}
              </p>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-sm font-black text-[#c9a84c]">
                  {shot.club}
                </span>
                <span className="text-xs text-[#888888]">—</span>
                <span className="text-sm font-bold text-white">
                  {shot.distance}m
                </span>
              </div>
              {shot.missWarning && (
                <p className="mt-0.5 text-xs text-[#e63946]">
                  &#x26A0; {shot.missWarning}
                </p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-xs text-[#888888]">
          Set up your bag to get club recommendations
        </p>
      )}

      {/* Target score */}
      <div className="mt-3 border-t border-white/5 pt-3">
        <p className="text-xs text-[#888888]">
          Target:{" "}
          <span className="font-bold text-white">
            {targetLabel} ({hole.targetScore})
          </span>
        </p>
      </div>

      {/* Notes */}
      {hole.notes && (
        <p className="mt-1 text-[11px] text-[#c9a84c]">{hole.notes}</p>
      )}
    </div>
  );
}

function StrategyView({
  strategy,
  onBack,
}: {
  strategy: CourseStrategy;
  onBack: () => void;
}) {
  return (
    <>
      <div className="px-5 pb-4 pt-6">
        <button
          onClick={onBack}
          className="text-xs font-semibold text-white/40 hover:text-white/70"
        >
          ← Change course
        </button>
        <h1 className="mt-2 text-2xl font-black text-white">
          {strategy.courseName}
        </h1>
        <p className="mt-1 text-sm text-[#888888]">
          Playing off {strategy.courseHcp} · {strategy.tee} tees
        </p>
      </div>

      <div className="mx-auto max-w-lg px-4 pb-8 space-y-3">
        {strategy.holes.map((hole) => (
          <HoleCard key={hole.hole} hole={hole} />
        ))}
      </div>
    </>
  );
}

// ── Main ─────────────────────────────────────────────────────────────

export default function StrategyPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [clubs, setClubs] = useState<BagClub[]>([]);
  const [sessions, setSessions] = useState<SwingSession[]>([]);
  const [strategy, setStrategy] = useState<CourseStrategy | null>(null);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    Promise.all([getBag(user.uid), getSwingSessions(user.uid)]).then(
      ([bag, sess]) => {
        if (bag && bag.length > 0) setClubs(bag);
        setSessions(sess);
      }
    );
  }, [user]);

  const handleGenerate = (
    course: Course,
    tee: TeeColour,
    handicap: number,
    windDir: WindDirection,
    windStr: WindStrength
  ) => {
    const result = buildStrategy({
      course,
      tee,
      handicap,
      clubs,
      sessions,
      windDir,
      windStr,
    });
    setStrategy(result);
  };

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#c9a84c] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ paddingBottom: "100px" }}>
      <video
        autoPlay
        loop
        muted
        playsInline
        className="fixed inset-0 w-full h-full object-cover"
      >
        <source src="/videos/Swing_1.mp4" type="video/mp4" />
      </video>
      <div className="fixed inset-0 bg-black/75" />

      <div className="relative z-10">
        {strategy ? (
          <StrategyView
            strategy={strategy}
            onBack={() => setStrategy(null)}
          />
        ) : (
          <SetupStep onGenerate={handleGenerate} />
        )}
      </div>
    </div>
  );
}
