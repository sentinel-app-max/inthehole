"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { getBag, saveBag } from "@/lib/firebase/firestore";
import {
  adjustDistance,
  recommendClub,
  type Recommendation,
} from "@/lib/golf/distance";
import type { BagClub, WindDirection, WindStrength } from "@/types";

const DEFAULT_BAG: BagClub[] = [
  { name: "5 Hybrid", distance: 175 },
  { name: "8i", distance: 140 },
  { name: "9i", distance: 120 },
  { name: "SW", distance: 130 },
  { name: "52\u00B0", distance: 75 },
  { name: "54\u00B0", distance: 90 },
  { name: "56\u00B0", distance: 75 },
  { name: "60\u00B0", distance: 65 },
];

const DIRECTIONS: WindDirection[] = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
const STRENGTHS: WindStrength[] = ["calm", "light", "moderate", "strong"];

const DIRECTION_ANGLES: Record<WindDirection, number> = {
  N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315,
};

export default function BagPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [clubs, setClubs] = useState<BagClub[]>(DEFAULT_BAG);
  const [loadingBag, setLoadingBag] = useState(true);
  const [windDir, setWindDir] = useState<WindDirection>("N");
  const [windStr, setWindStr] = useState<WindStrength>("calm");
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editVal, setEditVal] = useState("");
  const [saving, setSaving] = useState(false);
  const [pinDist, setPinDist] = useState("");
  const [rec, setRec] = useState<Recommendation | null>(null);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    getBag(user.uid).then((bag) => {
      if (bag && bag.length > 0) setClubs(bag);
      setLoadingBag(false);
    });
  }, [user]);

  const persistBag = async (updated: BagClub[]) => {
    if (!user) return;
    setSaving(true);
    try {
      await saveBag(user.uid, updated);
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (idx: number) => {
    setEditIdx(idx);
    setEditVal(String(clubs[idx].distance));
  };

  const commitEdit = () => {
    if (editIdx === null) return;
    const dist = parseInt(editVal, 10);
    if (isNaN(dist) || dist <= 0) {
      setEditIdx(null);
      return;
    }
    const updated = clubs.map((c, i) =>
      i === editIdx ? { ...c, distance: dist } : c
    );
    setClubs(updated);
    setEditIdx(null);
    persistBag(updated);
  };

  const handleSuggest = () => {
    const target = parseInt(pinDist, 10);
    if (isNaN(target) || target <= 0) return;
    setRec(recommendClub(target, clubs, windStr, windDir));
  };

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#c9a84c] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 pt-6" style={{ paddingBottom: "100px" }}>
      <video autoPlay loop muted playsInline className="fixed inset-0 w-full h-full object-cover">
        <source src="/videos/Bag_1.mp4" type="video/mp4" />
      </video>
      <div className="fixed inset-0 bg-black/75" />
      <div className="relative z-10">
      <h1 className="text-2xl font-black text-white">My Bag</h1>
      <p className="mt-1 text-sm text-[#888888]">Club selector &amp; wind calculator</p>

      {/* ── Club Recommender ── */}
      <div className="mt-5 rounded-2xl bg-[#1e1e1e] p-4">
        {/* Distance input */}
        <label className="text-xs font-bold uppercase tracking-widest text-[#888888]">
          Distance to pin
        </label>
        <div className="mt-2 flex gap-2">
          <input
            type="number"
            inputMode="numeric"
            placeholder="e.g. 135"
            value={pinDist}
            onChange={(e) => setPinDist(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSuggest(); }}
            className="flex-1 rounded-xl border border-white/10 bg-[#0a0a0a] px-4 py-3 text-lg font-bold text-white placeholder-white/30 outline-none focus:border-[#c9a84c]/50"
          />
          <span className="flex items-center text-sm font-bold text-[#888888]">m</span>
        </div>

        {/* Compact compass */}
        <div className="mt-4">
          <label className="text-xs font-bold uppercase tracking-widest text-[#888888]">
            Wind direction
          </label>
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            {DIRECTIONS.map((dir) => {
              const active = windDir === dir;
              return (
                <button
                  key={dir}
                  onClick={() => { setWindDir(dir); setRec(null); }}
                  className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold transition-all ${
                    active
                      ? "bg-[#c9a84c] text-[#0a0a0a] scale-110"
                      : "bg-[#0a0a0a] text-[#888888] hover:bg-[#252525]"
                  }`}
                >
                  {dir}
                </button>
              );
            })}
          </div>
        </div>

        {/* Wind strength */}
        <div className="mt-4">
          <label className="text-xs font-bold uppercase tracking-widest text-[#888888]">
            Strength
          </label>
          <div className="mt-2 flex gap-2">
            {STRENGTHS.map((s) => (
              <button
                key={s}
                onClick={() => { setWindStr(s); setRec(null); }}
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

        {/* Suggest button */}
        <button
          onClick={handleSuggest}
          className="mt-4 mx-auto w-1/4 rounded-2xl bg-[#c9a84c] py-3 text-sm font-black text-[#0a0a0a] shadow-lg transition-all hover:brightness-110 active:scale-[0.98] block"
        >
          Suggest Club
        </button>

        {/* Result card */}
        {rec && (
          <div className="mt-4 rounded-xl border border-[#c9a84c]/30 bg-[#c9a84c]/10 p-4">
            {rec.between && rec.secondary ? (
              <>
                <p className="text-base font-black text-white">
                  Between two clubs
                </p>
                <div className="mt-2 flex gap-3">
                  <div className="flex-1 rounded-lg bg-[#0a0a0a] p-3 text-center">
                    <p className="text-lg font-black text-[#c9a84c]">{rec.primary.name}</p>
                    <p className="text-xs text-[#888888]">Base: {rec.primary.base}m</p>
                    <p className="text-xs text-white">Adjusted: {rec.primary.adjusted}m</p>
                  </div>
                  <div className="flex-1 rounded-lg bg-[#0a0a0a] p-3 text-center">
                    <p className="text-lg font-black text-[#c9a84c]">{rec.secondary.name}</p>
                    <p className="text-xs text-[#888888]">Base: {rec.secondary.base}m</p>
                    <p className="text-xs text-white">Adjusted: {rec.secondary.adjusted}m</p>
                  </div>
                </div>
                <p className="mt-3 text-xs text-[#c9a84c]">
                  {rec.message}
                </p>
              </>
            ) : (
              <>
                <p className="text-xs text-[#888888]">Recommended</p>
                <p className="mt-1 text-2xl font-black text-[#c9a84c]">
                  {rec.primary.name}
                </p>
                <div className="mt-2 flex gap-4 text-sm text-white/70">
                  <span>Base: <span className="font-bold text-white">{rec.primary.base}m</span></span>
                  <span>Adjusted: <span className="font-bold text-[#c9a84c]">{rec.primary.adjusted}m</span></span>
                </div>
                <p className="mt-2 text-xs text-[#c9a84c]">
                  {rec.message}
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── My Bag ── */}
      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-widest text-[#888888]">
            My Clubs
          </h2>
          {saving && (
            <span className="text-xs text-[#c9a84c]">Saving...</span>
          )}
        </div>

        {loadingBag ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#c9a84c] border-t-transparent" />
          </div>
        ) : (
          <div className="space-y-2">
            {clubs.map((club, idx) => {
              const adj = adjustDistance(club.distance, windStr, windDir);
              const isEditing = editIdx === idx;

              return (
                <div
                  key={club.name}
                  className="flex items-center justify-between rounded-2xl bg-[#1e1e1e] px-4 py-3"
                >
                  <span className="text-sm font-bold text-white">{club.name}</span>

                  <div className="flex items-center gap-3">
                    {/* Wind-adjusted distance */}
                    {windStr !== "calm" && adj.type !== "calm" && (
                      <span className="flex items-center gap-1">
                        {adj.type === "cross" ? (
                          <span className="text-sm text-yellow-400" title="Crosswind">
                            &#x26A0;
                          </span>
                        ) : (
                          <span
                            className={`text-sm font-bold ${
                              adj.type === "head" ? "text-red-400" : "text-green-400"
                            }`}
                          >
                            {adj.distance}m
                            <span className="ml-1 text-[10px] font-normal">
                              {adj.type === "head" ? "\u2191" : "\u2193"}
                            </span>
                          </span>
                        )}
                      </span>
                    )}

                    {/* Base distance (editable) */}
                    {isEditing ? (
                      <input
                        type="number"
                        value={editVal}
                        onChange={(e) => setEditVal(e.target.value)}
                        onBlur={commitEdit}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitEdit();
                        }}
                        autoFocus
                        className="w-16 rounded-lg bg-[#0a0a0a] px-2 py-1 text-center text-sm font-bold text-[#c9a84c] outline-none border border-[#c9a84c]/50"
                      />
                    ) : (
                      <button
                        onClick={() => startEdit(idx)}
                        className="rounded-full bg-[#c9a84c]/15 px-3 py-1 text-xs font-bold text-[#c9a84c] transition-colors hover:bg-[#c9a84c]/25"
                      >
                        {club.distance}m
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Wind Reference ── */}
      <div className="mt-6 rounded-2xl bg-[#1e1e1e] p-4">
        <h2 className="text-xs font-bold uppercase tracking-widest text-[#888888]">
          Wind adjustments
        </h2>
        <div className="mt-3 space-y-2 text-xs text-white/60">
          <div className="flex justify-between">
            <span className="text-red-400">Headwind (N)</span>
            <span>-5% light &middot; -10% moderate &middot; -15% strong</span>
          </div>
          <div className="flex justify-between">
            <span className="text-green-400">Tailwind (S)</span>
            <span>+5% light &middot; +8% moderate &middot; +12% strong</span>
          </div>
          <div className="flex justify-between">
            <span className="text-yellow-400">Crosswind</span>
            <span>No distance change &middot; &#x26A0; warning</span>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
