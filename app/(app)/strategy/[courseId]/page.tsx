"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { getBag, getSwingSessions, getUserProfile } from "@/lib/firebase/firestore";
import { getCourseById } from "@/lib/courses/data";
import { getHoleCoordinates } from "@/lib/courses/holes";
import {
  buildVisualHolePlan,
  haversine,
  type VisualHolePlan,
} from "@/lib/strategy/shotplan";
import { buildStrategy, type CourseStrategy } from "@/lib/strategy/engine";
import { getHandicapTier } from "@/lib/strategy/tiers";
import { courseHcp as calcCourseHcp } from "@/lib/scoring/engine";
import { loadGoogleMaps } from "@/lib/maps/loader";
import type {
  BagClub,
  SwingSession,
  Course,
  HoleCoordinate,
  WindDirection,
  WindStrength,
  TeeColour,
} from "@/types";

// ── Hole Map Component ──────────────────────────────────────────────

function HoleMap({
  plan,
  holeIndex,
  totalHoles,
  onPrev,
  onNext,
  strategy,
}: {
  plan: VisualHolePlan;
  holeIndex: number;
  totalHoles: number;
  onPrev: () => void;
  onNext: () => void;
  strategy: CourseStrategy | null;
}) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const linesRef = useRef<google.maps.Polyline[]>([]);

  const clearOverlays = useCallback(() => {
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
    linesRef.current.forEach((l) => l.setMap(null));
    linesRef.current = [];
  }, []);

  // Init or update map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Bearing from tee to green (used for map heading)
    const toRad = (d: number) => (d * Math.PI) / 180;
    const φ1 = toRad(plan.tee.lat);
    const φ2 = toRad(plan.green.lat);
    const Δλ = toRad(plan.green.lng - plan.tee.lng);
    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x =
      Math.cos(φ1) * Math.sin(φ2) -
      Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    const headingDeg = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;

    // Include dogleg in center calculation
    const pts = [plan.tee, plan.green];
    if (plan.dogleg) pts.push(plan.dogleg);
    const center = {
      lat: pts.reduce((s, p) => s + p.lat, 0) / pts.length,
      lng: pts.reduce((s, p) => s + p.lng, 0) / pts.length,
    };

    if (!mapRef.current) {
      mapRef.current = new google.maps.Map(mapContainerRef.current, {
        center,
        zoom: 17,
        mapTypeId: "satellite",
        disableDefaultUI: true,
        zoomControl: false,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        gestureHandling: "greedy",
        heading: headingDeg,
        tilt: 45,
      });
    } else {
      clearOverlays();
      mapRef.current.setCenter(center);
      mapRef.current.setZoom(17);
      mapRef.current.setHeading(headingDeg);
      mapRef.current.setTilt(45);
    }

    const map = mapRef.current;

    // Tee marker — white circle
    markersRef.current.push(
      new google.maps.Marker({
        position: plan.tee,
        map,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 7,
          fillColor: "#ffffff",
          fillOpacity: 1,
          strokeColor: "#c9a84c",
          strokeWeight: 2,
        },
        title: "Tee",
      })
    );

    // Green marker — green flag SVG pin
    markersRef.current.push(
      new google.maps.Marker({
        position: plan.green,
        map,
        icon: {
          url: "data:image/svg+xml," + encodeURIComponent(
            `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36">` +
            `<line x1="8" y1="4" x2="8" y2="34" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round"/>` +
            `<path d="M8 4 L24 10 L8 16 Z" fill="#1a5c2a" stroke="#ffffff" stroke-width="1"/>` +
            `<circle cx="8" cy="34" r="3" fill="#1a5c2a" stroke="#ffffff" stroke-width="1.5"/>` +
            `</svg>`
          ),
          scaledSize: new google.maps.Size(28, 36),
          anchor: new google.maps.Point(8, 34),
        },
        title: "Green",
      })
    );

    // Route polyline — follows dogleg path via routePoints
    for (let i = 0; i < plan.routePoints.length - 1; i++) {
      const from = plan.routePoints[i];
      const to = plan.routePoints[i + 1];
      const isLastSegment = i === plan.routePoints.length - 2;
      const line = new google.maps.Polyline({
        path: [from, to],
        strokeColor: "#ffffff",
        strokeWeight: 2,
        strokeOpacity: plan.dots.length > 0 && isLastSegment ? 0.4 : 0.8,
        geodesic: true,
        map,
      });
      linesRef.current.push(line);
    }

    // Shot landing dots — proportional placement along route.
    // Cap at 85% so no dot overlaps the green flag.
    const hasDogleg = !!plan.dogleg && plan.routePoints.length > 2;
    const totalShots = plan.dots.length;

    if (hasDogleg) {
      const waypoint = plan.routePoints[1];
      const green = plan.routePoints[plan.routePoints.length - 1];

      plan.dots.forEach((dot, i) => {
        let pos: { lat: number; lng: number };
        if (i === 0) {
          pos = waypoint;
        } else {
          const frac = Math.min(i / (totalShots - 1), 0.85);
          pos = {
            lat: waypoint.lat + (green.lat - waypoint.lat) * frac,
            lng: waypoint.lng + (green.lng - waypoint.lng) * frac,
          };
        }

        markersRef.current.push(
          new google.maps.Marker({
            position: pos,
            map,
            zIndex: 5,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 6,
              fillColor: "#c9a84c",
              fillOpacity: 1,
              strokeColor: "#0a0a0a",
              strokeWeight: 1.5,
            },
          })
        );

        // Club label pill
        markersRef.current.push(
          new google.maps.Marker({
            position: pos,
            map,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 0,
              labelOrigin: new google.maps.Point(0, -18),
            },
            label: {
              text: `${dot.club} · ${dot.distance}m`,
              color: "#ffffff",
              fontSize: "11px",
              fontWeight: "700",
              className: "shot-pill",
            },
          })
        );
      });
    } else {
      const teePos = plan.routePoints[0];
      const greenPos = plan.routePoints[plan.routePoints.length - 1];
      let cumDist = 0;

      plan.dots.forEach((dot) => {
        cumDist += dot.distance;
        const frac = Math.min(cumDist / plan.totalDistance, 0.85);
        const pos = {
          lat: teePos.lat + (greenPos.lat - teePos.lat) * frac,
          lng: teePos.lng + (greenPos.lng - teePos.lng) * frac,
        };

        markersRef.current.push(
          new google.maps.Marker({
            position: pos,
            map,
            zIndex: 5,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 6,
              fillColor: "#c9a84c",
              fillOpacity: 1,
              strokeColor: "#0a0a0a",
              strokeWeight: 1.5,
            },
          })
        );

        // Club label pill
        markersRef.current.push(
          new google.maps.Marker({
            position: pos,
            map,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 0,
              labelOrigin: new google.maps.Point(0, -18),
            },
            label: {
              text: `${dot.club} · ${dot.distance}m`,
              color: "#ffffff",
              fontSize: "11px",
              fontWeight: "700",
              className: "shot-pill",
            },
          })
        );
      });
    }
  }, [plan, clearOverlays]);

  const holeStrategy = strategy?.holes.find((h) => h.hole === plan.hole);

  return (
    <div>
      {/* Hole header */}
      <div className="flex items-center justify-between px-1 mb-3">
        <button
          onClick={onPrev}
          disabled={holeIndex === 0}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1e1e1e] text-white/60 disabled:opacity-20"
        >
          ‹
        </button>
        <div className="text-center">
          <span className="text-lg font-black text-white">
            Hole {plan.hole}
          </span>
          <span className="ml-2 text-sm text-[#888888]">
            Par {plan.par} · {plan.totalDistance}m
          </span>
        </div>
        <button
          onClick={onNext}
          disabled={holeIndex === totalHoles - 1}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1e1e1e] text-white/60 disabled:opacity-20"
        >
          ›
        </button>
      </div>

      {/* Map */}
      <div className="mx-auto max-w-sm overflow-hidden rounded-xl border-2 border-[#c9a84c] bg-[#0a0a0a] relative">
        <div
          ref={mapContainerRef}
          className="h-[55vh] w-full bg-[#1e1e1e]"
        />
        <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
        {plan.dots.length > 0 && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 flex flex-col gap-2 pointer-events-none z-10">
            {[...plan.dots].reverse().map((dot, i) => (
              <div key={i} className="bg-black/70 rounded-lg px-3 py-1.5">
                <p className="text-lg font-bold text-white leading-tight">{dot.distance}m</p>
                <p className="text-xs text-[#c9a84c]">{dot.club}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Shot breakdown below map */}
      {plan.dots.length > 0 && (
        <div className="mt-3 mx-auto max-w-sm space-y-2">
          {plan.dots.map((dot, i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-xl bg-[#1e1e1e] p-4"
            >
              <div>
                <p className="text-sm font-semibold uppercase tracking-wider text-[#888888]">
                  {dot.label}
                </p>
                <p className="text-lg font-bold text-[#c9a84c]">{dot.club}</p>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold text-white">{dot.distance}m</p>
                {dot.missWarning && (
                  <p className="text-xs text-[#e63946]">
                    &#x26A0; {dot.missWarning}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Strategy notes */}
      {holeStrategy && (
        <div className="mt-2 mx-auto max-w-sm">
          {holeStrategy.strokes > 0 && (
            <p className="text-xs text-[#c9a84c] px-1">
              You get {holeStrategy.strokes} stroke
              {holeStrategy.strokes > 1 ? "s" : ""} · Target:{" "}
              {holeStrategy.targetScore}
            </p>
          )}
          {holeStrategy.goForIt && (
            <p className="text-xs font-bold text-[#2e8b47] px-1">
              Reachable in 2 — go for it!
            </p>
          )}
          {holeStrategy.notes && (
            <p className="text-[11px] text-[#888888] px-1 mt-0.5">
              {holeStrategy.notes}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Fallback text cards (no hole coords) ────────────────────────────

function TextStrategyView({
  strategy,
  courseName,
  handicapIndex,
}: {
  strategy: CourseStrategy;
  courseName: string;
  handicapIndex: number;
}) {
  return (
    <>
      <div className="px-5 pb-2 pt-6">
        <h1 className="text-2xl font-black text-white">{courseName}</h1>
        <p className="mt-1 text-sm text-[#888888]">
          HCP Index {handicapIndex} · Course HCP {strategy.courseHcp} ·{" "}
          <span className="font-bold text-[#c9a84c]">{strategy.tier}</span> strategy ·{" "}
          {strategy.tee} tees
        </p>
        <div className="mt-3 rounded-xl border border-[#c9a84c]/20 bg-[#c9a84c]/5 px-4 py-3">
          <p className="text-xs text-[#c9a84c]">
            Visual shot plan coming soon — text strategy shown below
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-lg px-4 pb-8 space-y-3 mt-3">
        {strategy.holes.map((hole) => {
          const targetLabel =
            hole.targetScore === hole.par
              ? "par"
              : hole.targetScore === hole.par + 1
                ? "bogey"
                : `+${hole.targetScore - hole.par}`;

          return (
            <div key={hole.hole} className="rounded-2xl bg-[#1e1e1e] p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-lg font-black text-white">
                    Hole {hole.hole}
                  </span>
                  <span className="rounded-lg bg-white/5 px-2 py-0.5 text-xs font-bold text-[#888888]">
                    Par {hole.par}
                  </span>
                </div>
                <span className="text-xs font-bold text-[#888888]">
                  SI {hole.si}
                </span>
              </div>
              {hole.strokes > 0 && (
                <div className="mt-2 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-[#c9a84c]" />
                  <span className="text-xs font-bold text-[#c9a84c]">
                    You get {hole.strokes} stroke
                    {hole.strokes > 1 ? "s" : ""}
                  </span>
                </div>
              )}
              {hole.shots.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {hole.shots.map((shot, i) => (
                    <div key={i}>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-[#888888]">
                        {shot.label}
                      </p>
                      <div className="mt-0.5 flex items-center gap-2">
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
                  Set up your bag for club recommendations
                </p>
              )}
              <div className="mt-3 border-t border-white/5 pt-2">
                <p className="text-xs text-[#888888]">
                  Target:{" "}
                  <span className="font-bold text-white">
                    {targetLabel} ({hole.targetScore})
                  </span>
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ── Main Page ───────────────────────────────────────────────────────

export default function VisualStrategyPage() {
  const router = useRouter();
  const params = useParams();
  const courseId = params.courseId as string;
  const { user, loading } = useAuth();

  const [clubs, setClubs] = useState<BagClub[]>([]);
  const [sessions, setSessions] = useState<SwingSession[]>([]);
  const [mapsReady, setMapsReady] = useState(false);
  const [holeIndex, setHoleIndex] = useState(0);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [handicap, setHandicap] = useState(18);

  const course = getCourseById(courseId);
  const holeCoords = getHoleCoordinates(courseId);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      getBag(user.uid),
      getSwingSessions(user.uid),
      getUserProfile(user.uid),
    ]).then(([bag, sess, profile]) => {
      if (bag && bag.length > 0) setClubs(bag);
      setSessions(sess);
      if (profile?.handicap != null) setHandicap(profile.handicap);
      setDataLoaded(true);
    });
  }, [user]);

  useEffect(() => {
    if (holeCoords && holeCoords.length > 0) {
      loadGoogleMaps()
        .then(() => setMapsReady(true))
        .catch(() => {});
    }
  }, [holeCoords]);

  // Build ordered list of all 18 holes — mapped or not
  const allHoles = (course?.holes ?? []).map((h) => {
    const coord = holeCoords?.find((hc) => hc.hole === h.hole) ?? null;
    return { holeInfo: h, coord };
  });

  // Swipe handling
  const touchStartRef = useRef<number>(0);
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStartRef.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      if (diff > 0 && holeIndex < allHoles.length - 1) {
        setHoleIndex((i) => i + 1);
      } else if (diff < 0 && holeIndex > 0) {
        setHoleIndex((i) => i - 1);
      }
    }
  };

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#c9a84c] border-t-transparent" />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#0a0a0a] px-4">
        <p className="text-lg font-bold text-white">Course not found</p>
        <button
          onClick={() => router.push("/strategy")}
          className="mt-4 rounded-xl bg-[#c9a84c] px-6 py-2 text-sm font-bold text-[#0a0a0a]"
        >
          Back to Strategy
        </button>
      </div>
    );
  }

  // Build strategy for both views
  const strategy: CourseStrategy | null = dataLoaded
    ? buildStrategy({
        course,
        tee: "white" as TeeColour,
        handicap,
        clubs,
        sessions,
        windDir: "N" as WindDirection,
        windStr: "calm" as WindStrength,
      })
    : null;

  // No hole coordinates — show text fallback
  if (!holeCoords || holeCoords.length === 0) {
    return (
      <div className="min-h-screen" style={{ paddingBottom: "100px" }}>
        <video
          autoPlay
          loop
          muted
          playsInline
          className="fixed inset-0 w-full h-full object-cover pointer-events-none"
        >
          <source src="/videos/Swing_1.mp4" type="video/mp4" />
        </video>
        <div className="fixed inset-0 bg-black/75 pointer-events-none" />
        <div className="relative z-10">
          <div className="px-5 pt-6">
            <button
              onClick={() => router.push("/strategy")}
              className="text-xs font-semibold text-white/40 hover:text-white/70"
            >
              ← Back
            </button>
          </div>
          {strategy ? (
            <TextStrategyView strategy={strategy} courseName={course.name} handicapIndex={handicap} />
          ) : (
            <div className="flex justify-center py-20">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#c9a84c] border-t-transparent" />
            </div>
          )}
        </div>
      </div>
    );
  }

  // Current hole
  const current = allHoles[holeIndex];
  const currentCoord = current?.coord ?? null;
  const currentHoleInfo = current?.holeInfo ?? null;

  if (!mapsReady || !currentHoleInfo) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#c9a84c] border-t-transparent" />
      </div>
    );
  }

  const plan =
    currentCoord
      ? buildVisualHolePlan({
          holeCoord: currentCoord,
          holeInfo: currentHoleInfo,
          clubs,
          sessions,
          windDir: "N",
          windStr: "calm",
          tee: "white",
          handicap,
        })
      : null;

  const holeStrategy = strategy?.holes.find(
    (h) => h.hole === currentHoleInfo.hole
  );

  return (
    <div className="min-h-screen" style={{ paddingBottom: "100px" }}>
      <style>
        {`.shot-pill{background:rgba(0,0,0,.85);padding:2px 8px;border-radius:8px;border:1px solid rgba(201,168,76,.3)}`}
      </style>
      <video
        autoPlay
        loop
        muted
        playsInline
        className="fixed inset-0 w-full h-full object-cover pointer-events-none"
      >
        <source src="/videos/Swing_1.mp4" type="video/mp4" />
      </video>
      <div className="fixed inset-0 bg-black/75 pointer-events-none" />

      <div className="relative z-10 px-4 pt-6">
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => router.push("/strategy")}
            className="text-xs font-semibold text-white/40 hover:text-white/70"
          >
            ← Back
          </button>
          <p className="text-xs text-[#888888] truncate ml-2">
            {course.name}
          </p>
        </div>

        {/* Handicap + tier info */}
        {course && dataLoaded && (
          <p className="text-center text-xs text-[#888888] mb-3">
            HCP Index {handicap} · Course HCP{" "}
            {calcCourseHcp(handicap, course.tees?.find((t) => t.colour === "white")?.slope ?? course.slope, course.tees?.find((t) => t.colour === "white")?.cr ?? course.rating, course.par)}{" "}
            · <span className="font-bold text-[#c9a84c]">{getHandicapTier(handicap)}</span> strategy · white tees
          </p>
        )}

        {/* Hole dots navigation — all 18 */}
        <div className="flex justify-center gap-1.5 mb-4 flex-wrap">
          {allHoles.map((h, i) => (
            <button
              key={h.holeInfo.hole}
              onClick={() => setHoleIndex(i)}
              className={`h-7 w-7 rounded-full text-[10px] font-bold transition-all ${
                i === holeIndex
                  ? "bg-[#c9a84c] text-[#0a0a0a] scale-110"
                  : h.coord
                    ? "bg-[#1e1e1e] text-[#888888]"
                    : "bg-[#1e1e1e] text-[#888888]/40"
              }`}
            >
              {h.holeInfo.hole}
            </button>
          ))}
        </div>

        <div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
          {plan ? (
            <HoleMap
              plan={plan}
              holeIndex={holeIndex}
              totalHoles={allHoles.length}
              onPrev={() => setHoleIndex((i) => Math.max(0, i - 1))}
              onNext={() =>
                setHoleIndex((i) => Math.min(allHoles.length - 1, i + 1))
              }
              strategy={strategy}
            />
          ) : (
            /* Unmapped hole — show text card */
            <div>
              <div className="flex items-center justify-between px-1 mb-3">
                <button
                  onClick={() =>
                    setHoleIndex((i) => Math.max(0, i - 1))
                  }
                  disabled={holeIndex === 0}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1e1e1e] text-white/60 disabled:opacity-20"
                >
                  ‹
                </button>
                <div className="text-center">
                  <span className="text-lg font-black text-white">
                    Hole {currentHoleInfo.hole}
                  </span>
                  <span className="ml-2 text-sm text-[#888888]">
                    Par {currentHoleInfo.par}
                  </span>
                </div>
                <button
                  onClick={() =>
                    setHoleIndex((i) =>
                      Math.min(allHoles.length - 1, i + 1)
                    )
                  }
                  disabled={holeIndex === allHoles.length - 1}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1e1e1e] text-white/60 disabled:opacity-20"
                >
                  ›
                </button>
              </div>

              <div className="mx-auto max-w-sm rounded-xl border-2 border-[#c9a84c]/30 bg-[#1e1e1e] p-8 text-center">
                <p className="text-sm text-[#888888]">
                  Visual shot plan data coming soon
                </p>
              </div>

              {/* Show text strategy for unmapped holes */}
              {holeStrategy && (
                <div className="mt-3 mx-auto max-w-sm rounded-2xl bg-[#1e1e1e] p-4">
                  {holeStrategy.strokes > 0 && (
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="h-2 w-2 rounded-full bg-[#c9a84c]" />
                      <span className="text-xs font-bold text-[#c9a84c]">
                        You get {holeStrategy.strokes} stroke
                        {holeStrategy.strokes > 1 ? "s" : ""}
                      </span>
                    </div>
                  )}
                  {holeStrategy.shots.map((shot, i) => (
                    <div key={i} className="mt-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-[#888888]">
                        {shot.label}
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-[#c9a84c]">
                          {shot.club}
                        </span>
                        <span className="text-xs text-[#888888]">—</span>
                        <span className="text-sm font-bold text-white">
                          {shot.distance}m
                        </span>
                      </div>
                      {shot.missWarning && (
                        <p className="text-[10px] text-[#e63946]">
                          &#x26A0; {shot.missWarning}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
