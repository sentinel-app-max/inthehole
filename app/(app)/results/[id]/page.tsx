"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getRound } from "@/lib/firebase/firestore";
import type { Round, PlayerResult } from "@/types";

function scoreColor(score: number, par: number): string {
  const diff = score - par;
  if (diff <= -2) return "bg-purple-500 text-white";
  if (diff === -1) return "bg-[#1a5c2a] text-white";
  if (diff === 0) return "text-white";
  if (diff === 1) return "bg-orange-400 text-white";
  return "bg-[#e63946] text-white";
}

export default function ResultsPage() {
  const params = useParams();
  const router = useRouter();
  const roundId = params.id as string;

  const [round, setRound] = useState<Round | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getRound(roundId).then((r) => {
      if (!r) {
        router.push("/");
        return;
      }
      setRound(r);
      setLoading(false);
    });
  }, [roundId, router]);

  if (loading || !round) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#c9a84c] border-t-transparent" />
      </div>
    );
  }

  const results = [...round.playerResults].sort((a, b) =>
    round.scoringType === "stableford"
      ? b.stableford - a.stableford
      : a.net - b.net
  );
  const winner = results[0];
  const date = new Date(round.date).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const dateShort = new Date(round.date).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
  });

  const podium = results.slice(0, 3);

  const buildShareText = () => {
    const holeScores = winner.scores
      .slice(0, round.holes)
      .map((s, i) => `H${i + 1}: ${s}`)
      .join("  ");
    return [
      `⛳ *inthehole · SA Golf Tracker*`,
      `📍 ${round.course.name} · ${dateShort}`,
      ``,
      `🥇 ${winner.name} — ${winner.stableford} pts (${winner.gross} gross, net ${winner.net})`,
      ``,
      `🏌️ Hole by hole:`,
      holeScores,
      `Front 9: ${winner.front9} | Back 9: ${winner.back9} | Total: ${winner.gross}`,
      ``,
      `Tracked with inthehole 🇿🇦 · cleanharry.world`,
    ].join("\n");
  };
  const shareText = buildShareText();

  const handleWhatsApp = () => {
    window.open(
      `https://wa.me/?text=${encodeURIComponent(shareText)}`,
      "_blank"
    );
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      const ta = document.createElement("textarea");
      ta.value = shareText;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a]" style={{ paddingBottom: "80px" }}>
      {/* Top bar */}
      <div className="flex items-center px-4 py-3 bg-[#0a0a0a]">
        <button
          onClick={() => router.push("/")}
          className="text-sm font-semibold text-white/40 hover:text-white"
        >
          ← Home
        </button>
      </div>

      {/* Results hero */}
      <div
        className="px-5 pb-8 pt-6 text-center"
        style={{ background: "linear-gradient(160deg, #141414 0%, #0a0a0a 100%)" }}
      >
        <p className="text-5xl">🏆</p>
        <h1 className="mt-3 text-2xl font-black text-white">
          {winner.name} Wins!
        </h1>
        <p className="mt-1 text-sm text-[#888888]">
          {round.course.name} · {date}
        </p>
        <p className="mt-1 text-xs text-[#c9a84c] font-bold">
          {winner.stableford} pts · {winner.gross} gross
        </p>
      </div>

      <div className="mx-auto max-w-lg px-4 space-y-5 mt-5">
        {/* Podium */}
        {podium.length > 1 && (
          <div className="flex items-end justify-center gap-3">
            {/* 2nd place */}
            <div className="flex flex-col items-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#1e1e1e] text-sm font-black text-[#888888]">
                {podium[1]?.name?.[0] ?? ""}
              </div>
              <div className="mt-2 h-20 w-20 rounded-t-xl bg-[#1e1e1e] flex flex-col items-center justify-center">
                <p className="text-lg font-black text-white">2nd</p>
                <p className="text-[10px] text-[#888888] truncate max-w-[72px]">{podium[1]?.name}</p>
                <p className="text-xs font-bold text-[#c9a84c]">{podium[1]?.stableford} pts</p>
              </div>
            </div>

            {/* 1st place */}
            <div className="flex flex-col items-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#c9a84c] text-lg font-black text-[#0a0a0a]">
                {podium[0]?.name?.[0] ?? ""}
              </div>
              <div className="mt-2 h-28 w-24 rounded-t-xl bg-[#c9a84c] flex flex-col items-center justify-center">
                <p className="text-xl font-black text-[#0a0a0a]">1st</p>
                <p className="text-[10px] text-[#0a0a0a]/70 truncate max-w-[88px]">{podium[0]?.name}</p>
                <p className="text-sm font-bold text-[#0a0a0a]">{podium[0]?.stableford} pts</p>
              </div>
            </div>

            {/* 3rd place */}
            {podium[2] && (
              <div className="flex flex-col items-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#1e1e1e] text-sm font-black text-[#888888]">
                  {podium[2]?.name?.[0] ?? ""}
                </div>
                <div className="mt-2 h-16 w-20 rounded-t-xl bg-[#1e1e1e] flex flex-col items-center justify-center">
                  <p className="text-lg font-black text-white">3rd</p>
                  <p className="text-[10px] text-[#888888] truncate max-w-[72px]">{podium[2]?.name}</p>
                  <p className="text-xs font-bold text-[#c9a84c]">{podium[2]?.stableford} pts</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Full results table */}
        <div className="rounded-2xl bg-[#1e1e1e] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-[#888888]">
                <th className="px-4 py-3 text-left font-semibold">#</th>
                <th className="px-2 py-3 text-left font-semibold">Player</th>
                <th className="px-2 py-3 text-center font-semibold">HCP</th>
                <th className="px-2 py-3 text-center font-semibold">Gross</th>
                <th className="px-2 py-3 text-center font-semibold">Net</th>
                <th className="px-4 py-3 text-center font-semibold">Pts</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r: PlayerResult, i: number) => (
                <tr
                  key={i}
                  className={`border-b border-white/5 ${
                    i === 0 ? "bg-[#c9a84c]/10" : ""
                  }`}
                >
                  <td className="px-4 py-3 font-bold text-white">{i + 1}</td>
                  <td className="px-2 py-3 font-semibold text-white truncate max-w-[100px]">
                    {r.name}
                    {i === 0 && <span className="ml-1 text-[#c9a84c]">🥇</span>}
                  </td>
                  <td className="px-2 py-3 text-center text-[#888888]">{r.handicap}</td>
                  <td className="px-2 py-3 text-center text-white">{r.gross}</td>
                  <td className="px-2 py-3 text-center text-white">{r.net}</td>
                  <td className="px-4 py-3 text-center font-black text-[#c9a84c]">{r.stableford}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Hole-by-hole */}
        <div className="-mx-4">
          <h2 className="mb-3 px-4 text-xs font-bold uppercase tracking-widest text-[#888888]">
            Hole by Hole
          </h2>
          <div className="flex">
            {/* Scrollable holes */}
            <div className="flex-1 overflow-x-auto">
              <table className="text-xs" style={{ minWidth: round.holes === 18 ? "680px" : "380px" }}>
                <thead>
                  <tr className="border-b border-white/5 text-[#888888]">
                    <th className="sticky left-0 z-10 bg-[#1e1e1e] px-3 py-2 text-left font-semibold min-w-[72px]">Hole</th>
                    {round.course.holes.slice(0, round.holes).map((h, i) => (
                      <th key={i} className="px-1.5 py-2 text-center font-semibold min-w-[32px]">
                        {h.hole}
                      </th>
                    ))}
                  </tr>
                  <tr className="border-b border-white/5">
                    <td className="sticky left-0 z-10 bg-[#1e1e1e] px-3 py-1.5 text-[#888888] font-semibold">Par</td>
                    {round.course.holes.slice(0, round.holes).map((h, i) => (
                      <td key={i} className="px-1.5 py-1.5 text-center text-[#888888]">{h.par}</td>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results.map((r: PlayerResult, pIdx: number) => (
                    <tr key={pIdx} className="border-b border-white/5">
                      <td className="sticky left-0 z-10 bg-[#1e1e1e] px-3 py-2 font-semibold text-white truncate max-w-[72px]">
                        {r.name}
                      </td>
                      {r.scores.slice(0, round.holes).map((score, hIdx) => {
                        const par = round.course.holes[hIdx]?.par ?? 4;
                        const color = score > 0 ? scoreColor(score, par) : "";
                        return (
                          <td key={hIdx} className="px-1 py-2 text-center">
                            <span className={`inline-block min-w-[24px] rounded px-1 py-0.5 text-xs font-bold ${color}`}>
                              {score || "–"}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pinned summary columns */}
            <div className="flex-shrink-0 border-l border-white/10 bg-[#141414]">
              <table className="text-xs">
                <thead>
                  <tr className="border-b border-white/5 text-[#c9a84c]">
                    {round.holes === 18 && (
                      <>
                        <th className="px-3 py-2 text-center font-semibold min-w-[36px]">F9</th>
                        <th className="px-3 py-2 text-center font-semibold min-w-[36px]">B9</th>
                      </>
                    )}
                    <th className="px-3 py-2 text-center font-semibold min-w-[40px]">Tot</th>
                  </tr>
                  <tr className="border-b border-white/5">
                    {round.holes === 18 && (
                      <>
                        <td className="px-3 py-1.5 text-center text-[#888888]">
                          {round.course.holes.slice(0, 9).reduce((s, h) => s + h.par, 0)}
                        </td>
                        <td className="px-3 py-1.5 text-center text-[#888888]">
                          {round.course.holes.slice(9, 18).reduce((s, h) => s + h.par, 0)}
                        </td>
                      </>
                    )}
                    <td className="px-3 py-1.5 text-center text-[#888888]">{round.course.par}</td>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r: PlayerResult, pIdx: number) => (
                    <tr key={pIdx} className="border-b border-white/5">
                      {round.holes === 18 && (
                        <>
                          <td className="px-3 py-2 text-center font-bold text-white">{r.front9}</td>
                          <td className="px-3 py-2 text-center font-bold text-white">{r.back9}</td>
                        </>
                      )}
                      <td className="px-3 py-2 text-center font-black text-[#c9a84c]">{r.gross}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Share section */}
        <div className="flex gap-3">
          <button
            onClick={handleWhatsApp}
            className="flex-1 rounded-2xl bg-[#25D366] py-3.5 text-sm font-bold text-white"
          >
            💬 Share on WhatsApp
          </button>
          <button
            onClick={handleCopy}
            className="flex-1 rounded-2xl bg-white py-3.5 text-sm font-bold text-[#0a0a0a]"
          >
            {copied ? "Copied!" : "📋 Copy Score"}
          </button>
        </div>

        {/* Clean Harry tip */}
        <div className="rounded-2xl bg-[#1e1e1e] p-4 border-l-4 border-[#c9a84c]">
          <p className="text-sm text-[#888888]">
            Keep your clubs clean between shots.{" "}
            <a
              href="https://cleanharry.world"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-[#c9a84c] underline"
            >
              cleanharry.world
            </a>
          </p>
        </div>

        {/* Back home */}
        <button
          onClick={() => router.push("/")}
          className="w-full rounded-2xl bg-white py-3.5 text-sm font-bold text-[#0a0a0a]"
        >
          ← Back Home
        </button>
      </div>
    </div>
  );
}
