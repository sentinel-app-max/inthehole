"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import {
  getSwingSessions,
  deleteSwingSession,
} from "@/lib/firebase/firestore";
import type { SwingSession } from "@/types";

const PAGE_SIZE = 20;

function timeAgo(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = now - then;

  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;

  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;

  return new Date(iso).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
  });
}

const RESULT_DOT: Record<string, string> = {
  good: "bg-[#2e8b47]",
  ok: "bg-[#c9a84c]",
  miss: "bg-[#e63946]",
};

interface ShotCardProps {
  session: SwingSession;
  onDelete: (id: string) => void;
}

function ShotCard({ session, onDelete }: ShotCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const startX = useRef(0);
  const currentX = useRef(0);
  const [offset, setOffset] = useState(0);
  const [swiping, setSwiping] = useState(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    currentX.current = startX.current;
    setSwiping(true);
  }, []);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!swiping) return;
      currentX.current = e.touches[0].clientX;
      const dx = currentX.current - startX.current;
      // Only allow swipe left
      const clamped = Math.min(0, Math.max(-80, dx));
      setOffset(clamped);
    },
    [swiping]
  );

  const handleTouchEnd = useCallback(() => {
    setSwiping(false);
    // Snap open if swiped past halfway, otherwise snap shut
    setOffset(offset < -40 ? -80 : 0);
  }, [offset]);

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Delete button behind the card */}
      <button
        onClick={() => onDelete(session.id)}
        className="absolute right-0 top-0 bottom-0 w-20 bg-red-500 flex items-center justify-center"
      >
        <svg
          className="w-5 h-5 text-white"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
          />
        </svg>
      </button>

      {/* Card content */}
      <div
        ref={cardRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="relative bg-[#1e1e1e] border border-white/5 p-4 z-10"
        style={{
          transform: `translateX(${offset}px)`,
          transition: swiping ? "none" : "transform 0.2s ease-out",
        }}
      >
        {/* Top row: club + date + result dot */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <p className="font-bold text-white">{session.club}</p>
            <span
              className={`w-2.5 h-2.5 rounded-full ${RESULT_DOT[session.result]}`}
            />
          </div>
          <p className="text-xs text-white/40">{timeAgo(session.createdAt)}</p>
        </div>

        {/* Distance */}
        <p className="text-sm text-white/70 mb-2">
          {session.targetDistance}m{" "}
          <span className="text-white/30">→</span>{" "}
          {session.actualDistance}m
          <span className="text-white/40 ml-1">
            ({session.actualDistance >= session.targetDistance ? "+" : ""}
            {session.actualDistance - session.targetDistance}m)
          </span>
        </p>

        {/* Badges */}
        <div className="flex gap-2">
          <span className="text-xs bg-white/5 border border-white/10 text-white/60 px-2 py-0.5 rounded-full capitalize">
            {session.shotShape}
          </span>
          <span className="text-xs bg-white/5 border border-white/10 text-white/60 px-2 py-0.5 rounded-full capitalize">
            {session.contactQuality}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function SwingHistoryPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [sessions, setSessions] = useState<SwingSession[]>([]);
  const [fetching, setFetching] = useState(true);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [clubFilter, setClubFilter] = useState("All");

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    getSwingSessions(user.uid)
      .then(setSessions)
      .finally(() => setFetching(false));
  }, [user]);

  // Unique clubs for filter bar
  const clubs = ["All", ...Array.from(new Set(sessions.map((s) => s.club)))];

  // Filtered + paginated
  const filtered =
    clubFilter === "All"
      ? sessions
      : sessions.filter((s) => s.club === clubFilter);
  const shown = filtered.slice(0, visible);
  const hasMore = visible < filtered.length;

  // Reset pagination when filter changes
  useEffect(() => {
    setVisible(PAGE_SIZE);
  }, [clubFilter]);

  async function handleDelete(id: string) {
    if (!user) return;
    try {
      await deleteSwingSession(user.uid, id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
    } catch (error) {
      console.error("Failed to delete shot:", error);
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
    <div className="min-h-screen bg-[#0a0a0a] text-white pb-8">
      {/* Header */}
      <div className="px-4 pt-6 pb-2">
        <h1 className="text-2xl font-black">Shot History</h1>
        <p className="text-sm text-white/50 mt-1">
          {filtered.length} shot{filtered.length !== 1 ? "s" : ""} logged
        </p>
      </div>

      {/* Club filter bar */}
      {sessions.length > 0 && (
        <div className="px-4 py-3 overflow-x-auto scrollbar-hide">
          <div className="flex gap-2 w-max">
            {clubs.map((c) => (
              <button
                key={c}
                onClick={() => setClubFilter(c)}
                className={`px-3 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition-colors ${
                  clubFilter === c
                    ? "bg-[#c9a84c] text-black"
                    : "bg-[#1e1e1e] text-white/60 border border-white/10"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Loading skeleton */}
      {fetching && (
        <div className="px-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="bg-[#1e1e1e] rounded-xl p-4 animate-pulse"
            >
              <div className="h-4 w-20 bg-white/10 rounded mb-3" />
              <div className="h-3 w-32 bg-white/10 rounded mb-2" />
              <div className="flex gap-2">
                <div className="h-5 w-16 bg-white/10 rounded-full" />
                <div className="h-5 w-16 bg-white/10 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!fetching && sessions.length === 0 && (
        <div className="px-4 flex flex-col items-center text-center mt-16">
          <div className="w-16 h-16 rounded-full bg-[#1e1e1e] border border-white/10 flex items-center justify-center text-3xl mb-4">
            🏌️
          </div>
          <p className="text-white/50 text-sm max-w-[260px]">
            No shots logged yet. Get to the range and start building your data.
          </p>
          <Link
            href="/swing/log"
            className="mt-6 bg-[#c9a84c] text-black font-bold py-4 px-8 rounded-xl text-lg active:bg-[#b8973b] transition-colors"
          >
            Log Your First Shot
          </Link>
        </div>
      )}

      {/* Shot list */}
      {!fetching && shown.length > 0 && (
        <div className="px-4 space-y-3">
          {shown.map((session) => (
            <ShotCard
              key={session.id}
              session={session}
              onDelete={handleDelete}
            />
          ))}

          {/* Load more */}
          {hasMore && (
            <button
              onClick={() => setVisible((v) => v + PAGE_SIZE)}
              className="w-full py-3 text-sm font-semibold text-[#c9a84c] bg-[#1e1e1e] border border-white/10 rounded-xl active:bg-white/5 transition-colors"
            >
              Load more ({filtered.length - visible} remaining)
            </button>
          )}
        </div>
      )}

      {/* No results for filter */}
      {!fetching && sessions.length > 0 && filtered.length === 0 && (
        <div className="px-4 text-center mt-16">
          <p className="text-white/50 text-sm">
            No shots with {clubFilter} yet.
          </p>
        </div>
      )}
    </div>
  );
}
