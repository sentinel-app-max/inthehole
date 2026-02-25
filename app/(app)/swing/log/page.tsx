"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { getBag, saveSwingSession } from "@/lib/firebase/firestore";
import type { ShotShape, ContactQuality, ShotResult } from "@/types";

const DEFAULT_CLUBS = [
  "Driver",
  "3 Wood",
  "5 Hybrid",
  "6i",
  "7i",
  "8i",
  "9i",
  "PW",
  "SW",
  "52",
  "56",
  "60",
];

const SHOT_SHAPES: ShotShape[] = [
  "straight",
  "fade",
  "draw",
  "slice",
  "hook",
  "push",
  "pull",
];

const CONTACT_QUALITIES: ContactQuality[] = [
  "pure",
  "thin",
  "fat",
  "topped",
  "toe",
  "heel",
];

const RESULTS: { value: ShotResult; label: string; colour: string }[] = [
  { value: "good", label: "Good", colour: "border-[#2e8b47] text-[#2e8b47]" },
  { value: "ok", label: "OK", colour: "border-[#c9a84c] text-[#c9a84c]" },
  { value: "miss", label: "Miss", colour: "border-[#e63946] text-[#e63946]" },
];

export default function SwingLogPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [clubs, setClubs] = useState<string[]>(DEFAULT_CLUBS);
  const [club, setClub] = useState("");
  const [targetDistance, setTargetDistance] = useState("");
  const [actualDistance, setActualDistance] = useState("");
  const [shotShape, setShotShape] = useState<ShotShape>("straight");
  const [contactQuality, setContactQuality] = useState<ContactQuality | null>(
    null
  );
  const [result, setResult] = useState<ShotResult | null>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    getBag(user.uid).then((bag) => {
      if (bag && bag.length > 0) {
        setClubs(bag.map((c) => c.name));
      }
    });
  }, [user]);

  const canSubmit =
    club !== "" &&
    targetDistance !== "" &&
    actualDistance !== "" &&
    contactQuality !== null &&
    result !== null &&
    !saving;

  async function handleSubmit() {
    if (!canSubmit || !user) return;
    setSaving(true);

    const id =
      Date.now().toString(36) + Math.random().toString(36).substring(2, 8);

    try {
      await saveSwingSession(user.uid, {
        id,
        userId: user.uid,
        date: new Date().toISOString(),
        club,
        targetDistance: Number(targetDistance),
        actualDistance: Number(actualDistance),
        shotShape,
        contactQuality: contactQuality!,
        result: result!,
        notes: notes || "",
        createdAt: new Date().toISOString(),
      });

      // Reset form for next shot
      setTargetDistance("");
      setActualDistance("");
      setShotShape("straight");
      setContactQuality(null);
      setResult(null);
      setNotes("");

      // Toast
      setToast(true);
      setTimeout(() => setToast(false), 1500);
    } catch (error) {
      console.error("Failed to log shot:", error);
    } finally {
      setSaving(false);
    }
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#c9a84c] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white pb-36">
      {/* Header */}
      <div className="px-4 pt-6 pb-4">
        <h1 className="text-2xl font-black">Log Shot</h1>
        <p className="text-sm text-white/50 mt-1">
          Tap, log, repeat. Build your data.
        </p>
      </div>

      <div className="px-4 space-y-5">
        {/* Club Selector */}
        <div>
          <label className="text-xs font-semibold text-white/50 uppercase tracking-wider">
            Club
          </label>
          <select
            value={club}
            onChange={(e) => setClub(e.target.value)}
            className="mt-1 w-full bg-[#1e1e1e] border border-white/10 rounded-xl px-4 py-3 text-white appearance-none"
          >
            <option value="">Select club</option>
            {clubs.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* Distance Inputs */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-white/50 uppercase tracking-wider">
              Target
            </label>
            <input
              type="number"
              inputMode="numeric"
              placeholder="Target (m)"
              value={targetDistance}
              onChange={(e) => setTargetDistance(e.target.value)}
              className="mt-1 w-full bg-[#1e1e1e] border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-white/50 uppercase tracking-wider">
              Actual
            </label>
            <input
              type="number"
              inputMode="numeric"
              placeholder="Actual (m)"
              value={actualDistance}
              onChange={(e) => setActualDistance(e.target.value)}
              className="mt-1 w-full bg-[#1e1e1e] border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30"
            />
          </div>
        </div>

        {/* Shot Shape */}
        <div>
          <label className="text-xs font-semibold text-white/50 uppercase tracking-wider">
            Shot Shape
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            {SHOT_SHAPES.map((shape) => (
              <button
                key={shape}
                onClick={() => setShotShape(shape)}
                className={`px-3 py-1.5 rounded-full text-sm font-semibold capitalize transition-colors ${
                  shotShape === shape
                    ? "bg-[#c9a84c] text-black"
                    : "bg-[#1e1e1e] text-white/60 border border-white/10"
                }`}
              >
                {shape}
              </button>
            ))}
          </div>
        </div>

        {/* Contact Quality */}
        <div>
          <label className="text-xs font-semibold text-white/50 uppercase tracking-wider">
            Contact
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            {CONTACT_QUALITIES.map((quality) => (
              <button
                key={quality}
                onClick={() => setContactQuality(quality)}
                className={`px-3 py-1.5 rounded-full text-sm font-semibold capitalize transition-colors ${
                  contactQuality === quality
                    ? "bg-[#c9a84c] text-black"
                    : "bg-[#1e1e1e] text-white/60 border border-white/10"
                }`}
              >
                {quality}
              </button>
            ))}
          </div>
        </div>

        {/* Result */}
        <div>
          <label className="text-xs font-semibold text-white/50 uppercase tracking-wider">
            Result
          </label>
          <div className="mt-2 grid grid-cols-3 gap-3">
            {RESULTS.map(({ value, label, colour }) => (
              <button
                key={value}
                onClick={() => setResult(value)}
                className={`py-4 rounded-xl text-center font-bold text-lg border-2 transition-colors ${
                  result === value
                    ? colour + " bg-white/5"
                    : "border-white/10 text-white/40"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="text-xs font-semibold text-white/50 uppercase tracking-wider">
            Notes
          </label>
          <input
            type="text"
            placeholder="Optional — wind, lie, feel..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-1 w-full bg-[#1e1e1e] border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30"
          />
        </div>
      </div>

      {/* Submit Button */}
      <div className="fixed bottom-16 left-0 right-0 px-4 pb-4 pt-2 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a] to-transparent">
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className={`w-full py-4 rounded-xl text-lg font-bold transition-colors ${
            canSubmit
              ? "bg-[#c9a84c] text-black active:bg-[#b8973b]"
              : "bg-[#1e1e1e] text-white/20"
          }`}
        >
          {saving ? "Saving..." : "Log Shot"}
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 bg-[#1e1e1e] border border-[#c9a84c] text-white px-6 py-3 rounded-xl text-sm font-semibold shadow-lg animate-fade-in z-50">
          Shot logged
        </div>
      )}
    </div>
  );
}
