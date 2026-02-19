"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useNewRoundStore } from "@/lib/store";
import { SA_COURSES, PROVINCES } from "@/lib/courses/data";
import { saveRound } from "@/lib/firebase/firestore";
import type { Course, Round } from "@/types";

const PROVINCE_TABS = ["All", ...PROVINCES];

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ─── Step 1: Course Selection ───────────────────────────────────────────────

function CourseSelection() {
  const { course: selected, setCourse, setStep } = useNewRoundStore();
  const [search, setSearch] = useState("");
  const [province, setProvince] = useState("All");

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

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <div
        className="px-5 pb-6 pt-8"
        style={{ background: "linear-gradient(160deg, #141414 0%, #0a0a0a 100%)" }}
      >
        <p className="text-xs font-semibold uppercase tracking-widest text-[#c9a84c]">
          Step 1 of 2
        </p>
        <h1 className="mt-1 text-2xl font-black text-white">Choose a Course</h1>
      </div>

      <div className="mx-auto max-w-lg px-4 -mt-1 pb-28 space-y-4">
        {/* Search */}
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
            <CourseCard
              key={c.id}
              course={c}
              isSelected={selected?.id === c.id}
              onSelect={() => setCourse(c)}
            />
          ))}
          {filtered.length === 0 && (
            <p className="py-8 text-center text-sm text-[#888888]">
              No courses found
            </p>
          )}
        </div>
      </div>

      {/* Continue button */}
      <div className="fixed bottom-16 left-0 right-0 bg-[#0a0a0a] px-4 pb-4 pt-2">
        <button
          disabled={!selected}
          onClick={() => setStep(2)}
          className="w-full rounded-2xl py-4 text-sm font-black shadow-lg transition-all disabled:opacity-40 bg-[#c9a84c] text-[#0a0a0a]"
        >
          Continue →
        </button>
      </div>
    </div>
  );
}

function CourseCard({
  course,
  isSelected,
  onSelect,
}: {
  course: Course;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`flex w-full items-center gap-3 rounded-2xl bg-[#1e1e1e] p-4 text-left transition-all ${
        isSelected
          ? "border-2 border-[#c9a84c] ring-2 ring-[#c9a84c]/20"
          : "border border-white/5"
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-white">{course.name}</p>
        <p className="mt-0.5 text-xs text-[#888888]">
          {course.city}, {course.province}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-[#888888]">CR {course.rating}</span>
        <span className="rounded-lg bg-[#c9a84c]/15 px-2 py-1 text-xs font-bold text-[#c9a84c]">
          Par {course.par}
        </span>
        {isSelected && (
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#c9a84c] text-xs text-[#0a0a0a] font-bold">
            ✓
          </span>
        )}
      </div>
    </button>
  );
}

// ─── Step 2: Players & Settings ─────────────────────────────────────────────

function PlayersSettings() {
  const router = useRouter();
  const { user } = useAuth();
  const {
    course,
    scoringType,
    holes,
    players,
    setScoringType,
    setHoles,
    setStep,
    addPlayer,
    removePlayer,
    updatePlayer,
    reset,
  } = useNewRoundStore();
  const [submitting, setSubmitting] = useState(false);

  const canSubmit =
    players.length > 0 &&
    players.every((p) => p.name.trim().length > 0) &&
    !submitting;

  const handleSubmit = async () => {
    if (!course || !user || !canSubmit) return;
    setSubmitting(true);

    const roundId = generateId();
    const round: Round = {
      id: roundId,
      userId: user.uid,
      date: new Date().toISOString(),
      course,
      players: players.map((p) => ({
        name: p.name.trim(),
        handicap: p.handicap,
        scores: [],
      })),
      playerResults: [],
      scoringType,
      holes,
      complete: false,
    };

    try {
      await saveRound(round);
      reset();
      router.push(`/scorecard/${roundId}`);
    } catch {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <div
        className="px-5 pb-6 pt-8"
        style={{ background: "linear-gradient(160deg, #141414 0%, #0a0a0a 100%)" }}
      >
        <button
          onClick={() => setStep(1)}
          className="text-xs font-semibold text-white/40 hover:text-white/70"
        >
          ← Back
        </button>
        <p className="mt-2 text-xs font-semibold uppercase tracking-widest text-[#c9a84c]">
          Step 2 of 2
        </p>
        <h1 className="mt-1 text-2xl font-black text-white">Set Up Round</h1>
      </div>

      <div className="mx-auto max-w-lg px-4 -mt-1 pb-28 space-y-4">
        {/* Course summary */}
        {course && (
          <div className="rounded-2xl bg-[#1e1e1e] p-4">
            <p className="text-sm font-bold text-white">{course.name}</p>
            <p className="mt-0.5 text-xs text-[#888888]">
              {course.city} · Par {course.par} · CR {course.rating} · Slope{" "}
              {course.slope}
            </p>
          </div>
        )}

        {/* Scoring toggle */}
        <div className="rounded-2xl bg-[#1e1e1e] p-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-[#888888]">
            Scoring
          </p>
          <div className="flex gap-2">
            {(["stableford", "strokeplay"] as const).map((type) => (
              <button
                key={type}
                onClick={() => setScoringType(type)}
                className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-colors ${
                  scoringType === type
                    ? "bg-[#c9a84c] text-[#0a0a0a]"
                    : "bg-white/5 text-[#888888]"
                }`}
              >
                {type === "stableford" ? "Stableford" : "Stroke Play"}
              </button>
            ))}
          </div>
        </div>

        {/* Holes toggle */}
        <div className="rounded-2xl bg-[#1e1e1e] p-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-[#888888]">
            Holes
          </p>
          <div className="flex gap-2">
            {([18, 9] as const).map((h) => (
              <button
                key={h}
                onClick={() => setHoles(h)}
                className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-colors ${
                  holes === h
                    ? "bg-[#c9a84c] text-[#0a0a0a]"
                    : "bg-white/5 text-[#888888]"
                }`}
              >
                {h === 18 ? "18 Holes" : "9 Holes (Front)"}
              </button>
            ))}
          </div>
        </div>

        {/* Players */}
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-[#888888]">
            Players
          </p>
          <div className="space-y-2">
            {players.map((player, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-2xl bg-[#1e1e1e] p-4"
              >
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-black bg-[#c9a84c] text-[#0a0a0a]">
                  {player.name ? player.name[0].toUpperCase() : `P${i + 1}`}
                </div>
                <div className="flex flex-1 gap-2">
                  <input
                    type="text"
                    placeholder={`Player ${i + 1}`}
                    value={player.name}
                    onChange={(e) => updatePlayer(i, "name", e.target.value)}
                    className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-[#c9a84c]"
                  />
                  <input
                    type="number"
                    min={0}
                    max={36}
                    value={player.handicap}
                    onChange={(e) =>
                      updatePlayer(
                        i,
                        "handicap",
                        Math.min(36, Math.max(0, Number(e.target.value)))
                      )
                    }
                    className="w-16 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-center text-sm text-white outline-none focus:border-[#c9a84c]"
                  />
                </div>
                {players.length > 1 && (
                  <button
                    onClick={() => removePlayer(i)}
                    className="text-lg text-[#888888] hover:text-[#e63946]"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>

          {players.length < 4 && (
            <button
              onClick={addPlayer}
              className="mt-2 w-full rounded-2xl border-2 border-dashed border-white/10 py-3 text-sm font-semibold text-[#888888] transition-colors hover:border-[#c9a84c] hover:text-[#c9a84c]"
            >
              + Add Player
            </button>
          )}
        </div>
      </div>

      {/* Submit */}
      <div className="fixed bottom-16 left-0 right-0 bg-[#0a0a0a] px-4 pb-4 pt-2">
        <button
          disabled={!canSubmit}
          onClick={handleSubmit}
          className="w-full rounded-2xl py-4 text-base font-black shadow-lg transition-all disabled:opacity-40 bg-[#c9a84c] text-[#0a0a0a]"
        >
          {submitting ? "Creating..." : "⛳ Let's Play!"}
        </button>
      </div>
    </div>
  );
}

// ─── Main ───────────────────────────────────────────────────────────────────

export default function NewRoundPage() {
  const { step } = useNewRoundStore();
  return step === 1 ? <CourseSelection /> : <PlayersSettings />;
}
