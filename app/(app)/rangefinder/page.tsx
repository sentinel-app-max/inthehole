"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { getBag, getSwingSessions } from "@/lib/firebase/firestore";
import {
  haversineDistance,
  adjustDistance,
  recommendClub,
  enrichBagWithSwingData,
  type Recommendation,
} from "@/lib/golf/distance";
import type { BagClub, WindDirection, WindStrength } from "@/types";

const DIRECTIONS: WindDirection[] = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
const STRENGTHS: WindStrength[] = ["calm", "light", "moderate", "strong"];
const DEFAULT_ZOOM = 18;

/** Bearing in degrees from `from` to `to` (0 = north, 90 = east). */
function computeBearing(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const φ1 = toRad(from.lat);
  const φ2 = toRad(to.lat);
  const Δλ = toRad(to.lng - from.lng);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

// ── Google Maps Loader ──────────────────────────────────────────────

let mapsPromise: Promise<void> | null = null;

function loadGoogleMaps(): Promise<void> {
  if (mapsPromise) return mapsPromise;

  mapsPromise = new Promise<void>((resolve, reject) => {
    if (typeof google !== "undefined" && google.maps) {
      resolve();
      return;
    }

    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
    if (!key) {
      reject(new Error("Google Maps API key not configured"));
      return;
    }

    const callbackName = "__initGoogleMaps";
    (window as unknown as Record<string, unknown>)[callbackName] = () => {
      resolve();
      delete (window as unknown as Record<string, unknown>)[callbackName];
    };

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&callback=${callbackName}`;
    script.async = true;
    script.defer = true;
    script.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(script);
  });

  return mapsPromise;
}

// ── Component ───────────────────────────────────────────────────────

export default function RangefinderPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const playerMarkerRef = useRef<google.maps.Marker | null>(null);
  const targetMarkerRef = useRef<google.maps.Marker | null>(null);
  const distLabelRef = useRef<google.maps.Marker | null>(null);
  const lineRef = useRef<google.maps.Polyline | null>(null);

  const [mapsReady, setMapsReady] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [playerPos, setPlayerPos] = useState<{ lat: number; lng: number } | null>(null);
  const [targetPos, setTargetPos] = useState<{ lat: number; lng: number } | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [clubs, setClubs] = useState<BagClub[]>([]);
  const [windDir, setWindDir] = useState<WindDirection>("N");
  const [windStr, setWindStr] = useState<WindStrength>("calm");
  const [rec, setRec] = useState<Recommendation | null>(null);
  const [loadingData, setLoadingData] = useState(true);

  // Auth guard
  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  // Load bag + swing data
  useEffect(() => {
    if (!user) return;
    async function loadData() {
      try {
        console.log("[rangefinder] loading bag for uid:", user!.uid);
        const [bag, sessions] = await Promise.all([
          getBag(user!.uid),
          getSwingSessions(user!.uid),
        ]);
        console.log("[rangefinder] getBag result:", bag);
        console.log("[rangefinder] bag is", bag && bag.length > 0 ? `populated (${bag.length} clubs)` : "empty or null");
        if (bag && bag.length > 0) {
          const enriched = enrichBagWithSwingData(bag, sessions);
          console.log("[rangefinder] enriched clubs:", enriched.length);
          setClubs(enriched);
        }
      } catch (err) {
        console.error("[rangefinder] loadData failed:", err);
      } finally {
        setLoadingData(false);
      }
    }
    loadData();
  }, [user]);

  // Load Google Maps
  useEffect(() => {
    loadGoogleMaps()
      .then(() => setMapsReady(true))
      .catch((err) => setGpsError(err.message));
  }, []);

  // Get GPS position — wait for map to load, then request location
  useEffect(() => {
    if (!mapsReady) return;
    if (!navigator.geolocation) {
      setGpsError("Geolocation not supported by your browser");
      return;
    }

    const watchIds: number[] = [];
    let fellBack = false;

    const onSuccess = (pos: GeolocationPosition) => {
      setPlayerPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      setGpsError(null);
    };

    const onError = (err: GeolocationPositionError) => {
      if (fellBack) return;
      // Permission denied — no fallback will help
      if (err.code === 1) {
        setGpsError("Location access denied. Enable GPS in your browser settings.");
        return;
      }
      // Position unavailable or timeout — fall back to low accuracy
      fellBack = true;
      setGpsError("Getting approximate location...");
      const fallbackId = navigator.geolocation.watchPosition(
        onSuccess,
        () => {
          setGpsError("Location unavailable. Check your GPS signal.");
        },
        { enableHighAccuracy: false, maximumAge: 30000, timeout: 15000 }
      );
      watchIds.push(fallbackId);
    };

    const mainId = navigator.geolocation.watchPosition(
      onSuccess,
      onError,
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );
    watchIds.push(mainId);

    return () => watchIds.forEach((id) => navigator.geolocation.clearWatch(id));
  }, [mapsReady]);

  // Initialise map
  useEffect(() => {
    if (!mapsReady || !mapContainerRef.current || mapRef.current) return;

    const center = playerPos ?? { lat: -26.2, lng: 28.0 };

    const map = new google.maps.Map(mapContainerRef.current, {
      center,
      zoom: DEFAULT_ZOOM,
      mapTypeId: "satellite",
      disableDefaultUI: true,
      zoomControl: true,
      gestureHandling: "greedy",
      tilt: 0,
    });
    mapRef.current = map;

    if (playerPos) {
      playerMarkerRef.current = new google.maps.Marker({
        position: playerPos,
        map,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: "#4285F4",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
        },
        title: "You",
      });
    }

    map.addListener("click", (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return;
      const target = { lat: e.latLng.lat(), lng: e.latLng.lng() };
      setTargetPos(target);

      const crosshairIcon = {
        path: "M -8 0 L -3 0 M 3 0 L 8 0 M 0 -8 L 0 -3 M 0 3 L 0 8",
        strokeColor: "#c9a84c",
        strokeWeight: 2.5,
        fillOpacity: 0,
        scale: 1.5,
        anchor: new google.maps.Point(0, 0),
      };

      if (targetMarkerRef.current) {
        targetMarkerRef.current.setPosition(target);
      } else {
        targetMarkerRef.current = new google.maps.Marker({
          position: target,
          map,
          icon: crosshairIcon,
          title: "Target",
        });
      }

      const currentPlayer = playerMarkerRef.current?.getPosition();
      if (currentPlayer) {
        const pPos = { lat: currentPlayer.lat(), lng: currentPlayer.lng() };
        if (lineRef.current) {
          lineRef.current.setPath([pPos, target]);
        } else {
          lineRef.current = new google.maps.Polyline({
            path: [pPos, target],
            strokeColor: "#ffffff",
            strokeWeight: 2,
            strokeOpacity: 1,
            geodesic: true,
            map,
          });
        }
        const dist = haversineDistance(pPos, target);
        setDistance(dist);

        // Floating distance label on map
        const labelText = `${dist}m`;
        if (distLabelRef.current) {
          distLabelRef.current.setPosition(target);
          distLabelRef.current.setLabel({
            text: labelText,
            color: "#ffffff",
            fontSize: "13px",
            fontWeight: "700",
            className: "dist-pill",
          });
        } else {
          distLabelRef.current = new google.maps.Marker({
            position: target,
            map,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 0,
              labelOrigin: new google.maps.Point(0, -20),
            },
            label: {
              text: labelText,
              color: "#ffffff",
              fontSize: "13px",
              fontWeight: "700",
              className: "dist-pill",
            },
          });
        }

        // Rotate to classic golf view: player at bottom, flag at top
        const bearing = computeBearing(pPos, target);
        map.setHeading(bearing);
        map.setTilt(45);
        map.setCenter({
          lat: (pPos.lat + target.lat) / 2,
          lng: (pPos.lng + target.lng) / 2,
        });
      }
    });
  }, [mapsReady, playerPos]);

  // Update player marker on GPS change
  useEffect(() => {
    if (!playerPos || !playerMarkerRef.current) return;
    playerMarkerRef.current.setPosition(playerPos);

    if (targetPos && lineRef.current) {
      lineRef.current.setPath([playerPos, targetPos]);
      const dist = haversineDistance(playerPos, targetPos);
      setDistance(dist);

      // Update floating distance label
      if (distLabelRef.current) {
        distLabelRef.current.setLabel({
          text: `${dist}m`,
          color: "#ffffff",
          fontSize: "13px",
          fontWeight: "700",
          className: "dist-pill",
        });
      }

      // Re-rotate to keep golf-hole view aligned
      if (mapRef.current) {
        mapRef.current.setHeading(computeBearing(playerPos, targetPos));
        mapRef.current.setCenter({
          lat: (playerPos.lat + targetPos.lat) / 2,
          lng: (playerPos.lng + targetPos.lng) / 2,
        });
      }
    }
  }, [playerPos, targetPos]);

  // Update recommendation reactively
  useEffect(() => {
    if (distance === null || clubs.length === 0) {
      setRec(null);
      return;
    }
    setRec(recommendClub(distance, clubs, windStr, windDir));
  }, [distance, clubs, windStr, windDir]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#c9a84c] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ paddingBottom: "100px" }}>
      <style>{`.dist-pill{background:rgba(0,0,0,.85);padding:2px 10px;border-radius:10px;border:1px solid rgba(255,255,255,.2)}`}</style>
      <video autoPlay loop muted playsInline className="fixed inset-0 w-full h-full object-cover pointer-events-none">
        <source src="/videos/Swing_1.mp4" type="video/mp4" />
      </video>
      <div className="fixed inset-0 bg-black/75 pointer-events-none" />
      <div className="relative z-10 px-4 pt-6">
        <h1 className="text-2xl font-black text-white">Rangefinder</h1>
        <p className="mt-1 text-sm text-[#888888]">
          Tap the map to measure distance to the pin
        </p>

        {/* GPS Error */}
        {gpsError && (
          <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
            <p className="text-sm text-red-400">{gpsError}</p>
          </div>
        )}

        {/* Map */}
        <div className="mt-4 mx-auto max-w-sm overflow-hidden rounded-xl border-2 border-[#c9a84c] bg-[#0a0a0a] relative">
          <div ref={mapContainerRef} className="h-[65vh] w-full bg-[#1e1e1e]">
            {!mapsReady && (
              <div className="flex h-full items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#c9a84c] border-t-transparent" />
              </div>
            )}
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
        </div>

        {/* Distance Display */}
        <div className="mt-4 rounded-2xl bg-[#1e1e1e] p-5 text-center">
          {distance !== null ? (
            <>
              <p className="text-xs font-bold uppercase tracking-widest text-[#888888]">
                Distance to target
              </p>
              <p className="mt-2 text-5xl font-black text-[#c9a84c]">
                {distance}<span className="text-2xl">m</span>
              </p>
            </>
          ) : (
            <p className="text-sm text-[#888888]">
              Tap a point on the map to measure distance
            </p>
          )}
        </div>

        {/* Club Recommendation */}
        {rec && (
          <div className="mt-4 rounded-2xl border border-[#c9a84c]/30 bg-[#c9a84c]/10 p-4">
            {rec.between && rec.secondary ? (
              <>
                <p className="text-base font-black text-white">Between two clubs</p>
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
                <p className="mt-3 text-xs text-[#c9a84c]">{rec.message}</p>
              </>
            ) : (
              <>
                <p className="text-xs text-[#888888]">Recommended</p>
                <p className="mt-1 text-2xl font-black text-[#c9a84c]">{rec.primary.name}</p>
                <div className="mt-2 flex gap-4 text-sm text-white/70">
                  <span>Base: <span className="font-bold text-white">{rec.primary.base}m</span></span>
                  <span>Adjusted: <span className="font-bold text-[#c9a84c]">{rec.primary.adjusted}m</span></span>
                </div>
                <p className="mt-2 text-xs text-[#c9a84c]">{rec.message}</p>
              </>
            )}
          </div>
        )}

        {/* Wind Controls */}
        <div className="mt-4 rounded-2xl bg-[#1e1e1e] p-4">
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

        {/* No Bag Warning */}
        {!loadingData && clubs.length === 0 && (
          <div className="mt-4 rounded-xl border border-[#c9a84c]/30 bg-[#c9a84c]/5 p-4 text-center">
            <p className="text-sm text-[#888888]">
              No clubs in your bag yet.{" "}
              <a href="/bag" className="font-bold text-[#c9a84c] underline">
                Set up your bag
              </a>{" "}
              to get club recommendations.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
