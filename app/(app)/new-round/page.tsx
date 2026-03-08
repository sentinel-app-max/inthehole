"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useNewRoundStore } from "@/lib/store";
import { SA_COURSES, PROVINCES } from "@/lib/courses/data";
import { saveRound } from "@/lib/firebase/firestore";
import { courseHcp } from "@/lib/scoring/engine";
import { getHandicapTier } from "@/lib/strategy/tiers";
import type { Course, Round, TeeColour } from "@/types";

const TEE_BG: Record<TeeColour, string> = {
  blue: "#2563eb",
  white: "#ffffff",
  yellow: "#eab308",
  red: "#dc2626",
};

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
      {/* Video background */}
      <video
        autoPlay
        muted
        loop
        playsInline
        className="pointer-events-none fixed inset-0 h-full w-full object-cover"
      >
        <source src="/videos/GC_moving.mp4" type="video/mp4" />
      </video>
      <div className="pointer-events-none fixed inset-0 bg-black/75" />

      {/* Content */}
      <div className="relative z-10">
        <div className="px-5 pb-6 pt-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#c9a84c]">
            Step 1 of 2
          </p>
          <h1 className="mt-1 text-2xl font-black text-white">Choose a Course</h1>
        </div>

        <div className="mx-auto max-w-lg px-4 -mt-1 pb-24 space-y-4">
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
        <div className="fixed bottom-0 left-0 right-0 bg-[#0a0a0a] px-4 pb-4 pt-2">
          <div className="mx-auto max-w-lg">
            <button
              disabled={!selected}
              onClick={() => setStep(2)}
              className="w-full rounded-2xl py-4 text-sm font-black shadow-lg transition-all disabled:opacity-40 bg-[#c9a84c] text-[#0a0a0a]"
            >
              Continue →
            </button>
          </div>
        </div>
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

// ─── Course Scorecard Table ─────────────────────────────────────────────────

const TEE_ROWS: { key: TeeColour; label: string; dot: string; text: string }[] = [
  { key: "yellow", label: "YEL", dot: "#f5d000", text: "#f5d000" },
  { key: "white",  label: "WHT", dot: "#ffffff", text: "rgba(255,255,255,0.9)" },
  { key: "blue",   label: "BLU", dot: "#4a90d9", text: "#6aabef" },
  { key: "red",    label: "RED", dot: "#e63946", text: "#ff6b7a" },
];

function CourseScorecard({
  course,
  highlightTee,
}: {
  course: Course;
  highlightTee: TeeColour;
}) {
  const front = course.holes.filter((h) => h.hole <= 9);
  const back = course.holes.filter((h) => h.hole > 9);
  const hasDistances = course.holes.some((h) => h.distances);

  const totalColCls = "bg-[#c9a84c]/8 border-l-2 border-l-[#c9a84c]/30";

  function renderNine(holes: typeof front, label: string) {
    const parTotal = holes.reduce((s, h) => s + h.par, 0);
    const totalLabel = label === "Front" ? "OUT" : "IN";

    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse min-w-[440px]" style={{ fontSize: "11px" }}>
          <tbody>
            {/* Hole numbers */}
            <tr className="bg-[#0a0a0a]">
              <td className="sticky left-0 z-10 bg-[#0a0a0a] pl-3 pr-2 py-2 text-[10px] font-bold uppercase tracking-widest text-[#c9a84c] w-14">
                Hole
              </td>
              {holes.map((h) => (
                <td key={h.hole} className="text-center py-2 text-white font-bold" style={{ fontSize: "14px" }}>
                  {h.hole}
                </td>
              ))}
              <td className={`text-center py-2 font-bold text-[#c9a84c] ${totalColCls}`} style={{ fontSize: "14px" }}>
                {totalLabel}
              </td>
            </tr>

            {/* Par */}
            <tr className="bg-[#1e1e1e]">
              <td className="sticky left-0 z-10 bg-[#1e1e1e] pl-3 pr-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white/50">
                Par
              </td>
              {holes.map((h) => (
                <td key={h.hole} className="text-center text-white font-bold py-1.5">
                  {h.par}
                </td>
              ))}
              <td className={`text-center text-[#c9a84c] font-bold py-1.5 ${totalColCls}`}>
                {parTotal}
              </td>
            </tr>

            {/* SI */}
            <tr className="bg-[#141414]">
              <td className="sticky left-0 z-10 bg-[#141414] pl-3 pr-2 py-1 text-[9px] font-bold uppercase tracking-wider text-white/30">
                SI
              </td>
              {holes.map((h) => (
                <td key={h.hole} className="text-center text-white/40 py-1" style={{ fontSize: "10px" }}>
                  {h.si}
                </td>
              ))}
              <td className={`text-center text-white/20 py-1 ${totalColCls}`}>—</td>
            </tr>

            {/* Tee distance rows */}
            {hasDistances &&
              TEE_ROWS.map((tee) => {
                const isHl = tee.key === highlightTee;
                const total = holes.reduce(
                  (s, h) => s + (h.distances?.[tee.key] ?? 0),
                  0
                );
                if (total === 0) return null;
                return (
                  <tr
                    key={tee.key}
                    className={
                      isHl
                        ? "bg-[#c9a84c]/10 border-t border-[#c9a84c]/30"
                        : "bg-[#1e1e1e] border-t border-white/5"
                    }
                  >
                    <td
                      className={`sticky left-0 z-10 pl-3 pr-2 py-1.5 ${
                        isHl ? "bg-[#c9a84c]/10" : "bg-[#1e1e1e]"
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: tee.dot }}
                        />
                        <span className="text-[9px] font-bold uppercase tracking-wider text-white/60">
                          {tee.label}
                        </span>
                      </span>
                    </td>
                    {holes.map((h) => (
                      <td
                        key={h.hole}
                        className={`text-center py-1.5 font-semibold ${isHl ? "font-bold" : ""}`}
                        style={{ color: tee.text, opacity: isHl ? 1 : 0.6 }}
                      >
                        {h.distances?.[tee.key] ?? ""}
                      </td>
                    ))}
                    <td
                      className={`text-center py-1.5 font-bold ${totalColCls}`}
                      style={{ color: isHl ? "#c9a84c" : tee.text, opacity: isHl ? 1 : 0.5 }}
                    >
                      {total}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-[#141414] border border-[#c9a84c]/20 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-[#0a0a0a] border-b border-[#c9a84c]/30">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-white">{course.name}</p>
            <p className="text-[10px] text-[#c9a84c] tracking-wider uppercase mt-0.5">
              {course.city} · {course.province}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[9px] uppercase tracking-wider text-white/40 font-semibold">Par</p>
            <p className="text-xl font-black text-[#c9a84c] leading-none">{course.par}</p>
          </div>
        </div>
      </div>

      {/* Front 9 */}
      {renderNine(front, "Front")}

      {/* Divider */}
      {back.length > 0 && (
        <div className="h-[3px] bg-[#0a0a0a]" />
      )}

      {/* Back 9 */}
      {back.length > 0 && renderNine(back, "Back")}

      {/* CR / Slope footer */}
      {course.tees && course.tees.length > 0 && (
        <div className="px-4 py-2.5 bg-[#0a0a0a] border-t border-white/5 flex flex-wrap gap-x-5 gap-y-1">
          {TEE_ROWS.map((tee) => {
            const td = course.tees.find((t) => t.colour === tee.key);
            if (!td) return null;
            const isHl = tee.key === highlightTee;
            return (
              <span key={tee.key} className="flex items-center gap-1.5">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: tee.dot }}
                />
                <span className={`text-[9px] uppercase tracking-wider font-semibold ${isHl ? "text-white/70" : "text-white/35"}`}>
                  CR/SL
                </span>
                <span className={`text-[10px] font-semibold ${isHl ? "text-white/80" : "text-white/40"}`}>
                  {td.cr} / {td.slope}
                </span>
              </span>
            );
          })}
        </div>
      )}
    </div>
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
  const [error, setError] = useState("");
  const [prefilled, setPrefilled] = useState(false);

  // Pre-fill first player name from logged-in user
  if (!prefilled && user?.displayName && players[0]?.name === "") {
    updatePlayer(0, "name", user.displayName.split(" ")[0]);
    setPrefilled(true);
  }

  const canSubmit =
    players.length > 0 &&
    players.every((p) => p.name.trim().length > 0) &&
    !submitting;

  const handleSubmit = async () => {
    if (!course || !user || !canSubmit) return;
    setSubmitting(true);
    setError("");

    const roundId = generateId();
    const round: Round = {
      id: roundId,
      userId: user.uid,
      date: new Date().toISOString(),
      course,
      players: players.map((p) => ({
        name: p.name.trim(),
        handicap: p.handicap,
        tee: p.tee,
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
    } catch (err) {
      console.error("Create round failed:", err);
      setError("Failed to create round. Check your connection and try again.");
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

      <div className="mx-auto max-w-5xl px-4 -mt-1 pb-24 md:flex md:gap-6 md:items-start">
        {/* Left column: settings */}
        <div className="max-w-lg space-y-4 md:flex-1 md:min-w-0">
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

          {/* Course scorecard (mobile only — shown stacked) */}
          {course && (
            <div className="md:hidden">
              <CourseScorecard course={course} highlightTee={players[0]?.tee ?? "white"} />
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
              {players.map((player, i) => {
                const teeData = course?.tees?.find((t) => t.colour === player.tee);
                return (
                  <div key={i} className="rounded-2xl bg-[#1e1e1e] p-4">
                    <div className="flex items-center gap-3">
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
                    {/* Tee selector */}
                    <div className="mt-3 flex items-center gap-2">
                      <p className="text-[10px] font-semibold text-[#888888] mr-1">Tee</p>
                      {(["blue", "white", "yellow", "red"] as TeeColour[]).map((tee) => (
                        <button
                          key={tee}
                          onClick={() => updatePlayer(i, "tee", tee)}
                          className={`h-7 w-7 rounded-full border-2 transition-all ${
                            player.tee === tee
                              ? "border-[#c9a84c] scale-110"
                              : "border-white/10 opacity-40"
                          }`}
                          style={{ backgroundColor: TEE_BG[tee] }}
                        />
                      ))}
                      {teeData && (
                        <p className="ml-auto text-[10px] text-[#888888]">
                          CR {teeData.cr} · Slope {teeData.slope}
                        </p>
                      )}
                    </div>
                    {teeData && course && (
                      <div className="mt-2 flex items-center gap-2 pl-1">
                        <p className="text-[10px] font-semibold text-[#888888]">
                          Course HCP:{" "}
                          <span className="text-white font-bold">
                            {courseHcp(player.handicap, teeData.slope, teeData.cr, course.par)}
                          </span>
                        </p>
                        <span className="rounded-full bg-[#c9a84c]/15 px-2 py-0.5 text-[9px] font-black text-[#c9a84c]">
                          {getHandicapTier(player.handicap)}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
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

        {/* Right column: scorecard (desktop only — side by side) */}
        {course && (
          <div className="hidden md:block md:flex-1 md:min-w-0 md:sticky md:top-4">
            <CourseScorecard course={course} highlightTee={players[0]?.tee ?? "white"} />
          </div>
        )}
      </div>

      {/* Submit */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#0a0a0a] px-4 pb-4 pt-2">
        <div className="mx-auto max-w-lg">
          {error && (
            <p className="mb-2 rounded-lg bg-[#e63946]/20 px-4 py-2 text-center text-sm text-[#e63946]">
              {error}
            </p>
          )}
          <button
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="w-full rounded-2xl py-4 text-base font-black shadow-lg transition-all disabled:opacity-40 bg-[#c9a84c] text-[#0a0a0a]"
          >
            {submitting ? "Creating..." : "⛳ Let's Play!"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main ───────────────────────────────────────────────────────────────────

export default function NewRoundPage() {
  const { step } = useNewRoundStore();
  return step === 1 ? <CourseSelection /> : <PlayersSettings />;
}
