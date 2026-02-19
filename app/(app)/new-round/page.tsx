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
    <div className="min-h-screen bg-[#f7f7f7]">
      <div
        className="px-5 pb-6 pt-8"
        style={{ background: "linear-gradient(160deg, #1a5c2a 0%, #0f2d18 100%)" }}
      >
        <p className="text-xs font-semibold uppercase tracking-widest text-white/50">
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
          className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#1a5c2a] shadow-sm"
        />

        {/* Province tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 no-scrollbar">
          {PROVINCE_TABS.map((p) => (
            <button
              key={p}
              onClick={() => setProvince(p)}
              className={`flex-shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
                province === p
                  ? "bg-[#1a5c2a] text-white"
                  : "bg-white text-gray-500 border border-gray-200"
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
            <p className="py-8 text-center text-sm text-gray-400">
              No courses found
            </p>
          )}
        </div>
      </div>

      {/* Continue button */}
      <div className="fixed bottom-16 left-0 right-0 bg-[#f7f7f7] px-4 pb-4 pt-2">
        <button
          disabled={!selected}
          onClick={() => setStep(2)}
          className="w-full rounded-2xl py-4 text-sm font-black text-white shadow-lg transition-all disabled:opacity-40"
          style={{ background: "#1a5c2a" }}
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
      className={`flex w-full items-center gap-3 rounded-2xl bg-white p-4 text-left shadow-sm transition-all ${
        isSelected
          ? "border-2 border-[#1a5c2a] ring-2 ring-[#1a5c2a]/20"
          : "border border-transparent"
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-gray-800">{course.name}</p>
        <p className="mt-0.5 text-xs text-gray-400">
          {course.city}, {course.province}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400">CR {course.rating}</span>
        <span className="rounded-lg bg-[#1a5c2a]/10 px-2 py-1 text-xs font-bold text-[#1a5c2a]">
          Par {course.par}
        </span>
        {isSelected && (
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#1a5c2a] text-xs text-white">
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
    <div className="min-h-screen bg-[#f7f7f7]">
      <div
        className="px-5 pb-6 pt-8"
        style={{ background: "linear-gradient(160deg, #1a5c2a 0%, #0f2d18 100%)" }}
      >
        <button
          onClick={() => setStep(1)}
          className="text-xs font-semibold text-white/50 hover:text-white/80"
        >
          ← Back
        </button>
        <p className="mt-2 text-xs font-semibold uppercase tracking-widest text-white/50">
          Step 2 of 2
        </p>
        <h1 className="mt-1 text-2xl font-black text-white">Set Up Round</h1>
      </div>

      <div className="mx-auto max-w-lg px-4 -mt-1 pb-28 space-y-4">
        {/* Course summary */}
        {course && (
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-sm font-bold text-gray-800">{course.name}</p>
            <p className="mt-0.5 text-xs text-gray-400">
              {course.city} · Par {course.par} · CR {course.rating} · Slope{" "}
              {course.slope}
            </p>
          </div>
        )}

        {/* Scoring toggle */}
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-gray-400">
            Scoring
          </p>
          <div className="flex gap-2">
            {(["stableford", "strokeplay"] as const).map((type) => (
              <button
                key={type}
                onClick={() => setScoringType(type)}
                className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-colors ${
                  scoringType === type
                    ? "bg-[#1a5c2a] text-white"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                {type === "stableford" ? "Stableford" : "Stroke Play"}
              </button>
            ))}
          </div>
        </div>

        {/* Holes toggle */}
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-gray-400">
            Holes
          </p>
          <div className="flex gap-2">
            {([18, 9] as const).map((h) => (
              <button
                key={h}
                onClick={() => setHoles(h)}
                className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-colors ${
                  holes === h
                    ? "bg-[#1a5c2a] text-white"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                {h === 18 ? "18 Holes" : "9 Holes (Front)"}
              </button>
            ))}
          </div>
        </div>

        {/* Players */}
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-gray-400">
            Players
          </p>
          <div className="space-y-2">
            {players.map((player, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm"
              >
                <div
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-black text-white"
                  style={{ background: "#1a5c2a" }}
                >
                  {player.name ? player.name[0].toUpperCase() : `P${i + 1}`}
                </div>
                <div className="flex flex-1 gap-2">
                  <input
                    type="text"
                    placeholder={`Player ${i + 1}`}
                    value={player.name}
                    onChange={(e) => updatePlayer(i, "name", e.target.value)}
                    className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#1a5c2a]"
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
                    className="w-16 rounded-lg border border-gray-200 px-3 py-2 text-center text-sm outline-none focus:border-[#1a5c2a]"
                  />
                </div>
                {players.length > 1 && (
                  <button
                    onClick={() => removePlayer(i)}
                    className="text-lg text-gray-300 hover:text-red-400"
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
              className="mt-2 w-full rounded-2xl border-2 border-dashed border-gray-200 py-3 text-sm font-semibold text-gray-400 transition-colors hover:border-[#1a5c2a] hover:text-[#1a5c2a]"
            >
              + Add Player
            </button>
          )}
        </div>
      </div>

      {/* Submit */}
      <div className="fixed bottom-16 left-0 right-0 bg-[#f7f7f7] px-4 pb-4 pt-2">
        <button
          disabled={!canSubmit}
          onClick={handleSubmit}
          className="w-full rounded-2xl py-4 text-base font-black shadow-lg transition-all disabled:opacity-40"
          style={{ background: "#c9a84c", color: "#0f2d18" }}
        >
          {submitting ? "Creating..." : "⛳ Let\u2019s Play!"}
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
