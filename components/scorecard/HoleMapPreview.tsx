"use client";

import { useEffect, useRef, useCallback } from "react";
import { type VisualHolePlan, haversine } from "@/lib/strategy/shotplan";

interface HoleMapPreviewProps {
  plan: VisualHolePlan;
}

export default function HoleMapPreview({ plan }: HoleMapPreviewProps) {
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

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Build bounds that include tee, green, dogleg, and every dot
    const bounds = new google.maps.LatLngBounds();
    bounds.extend(plan.tee);
    bounds.extend(plan.green);
    if (plan.dogleg) bounds.extend(plan.dogleg);
    for (const dot of plan.dots) bounds.extend({ lat: dot.lat, lng: dot.lng });

    if (!mapRef.current) {
      mapRef.current = new google.maps.Map(mapContainerRef.current, {
        center: bounds.getCenter(),
        zoom: 17,
        mapTypeId: "satellite",
        disableDefaultUI: true,
        zoomControl: false,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        gestureHandling: "none",
      });
    } else {
      clearOverlays();
    }

    const map = mapRef.current;
    map.fitBounds(bounds, 60);

    // Tee marker — always at plan.tee
    markersRef.current.push(
      new google.maps.Marker({
        position: plan.tee,
        map,
        zIndex: 1,
        icon: plan.hole === 1
          ? {
              url: '/images/icons/Ball_Tee.svg',
              scaledSize: new google.maps.Size(24, 36),
              anchor: new google.maps.Point(12, 34),
            }
          : {
              url:
                "data:image/svg+xml," +
                encodeURIComponent(
                  `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="28" viewBox="0 0 20 28">` +
                    `<line x1="10" y1="6" x2="10" y2="26" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round"/>` +
                    `<circle cx="10" cy="6" r="4" fill="#ffffff" stroke="#c9a84c" stroke-width="1.5"/>` +
                    `</svg>`
                ),
              scaledSize: new google.maps.Size(20, 28),
              anchor: new google.maps.Point(10, 26),
            },
        title: "Tee",
      })
    );

    // Green flag — always at plan.green
    markersRef.current.push(
      new google.maps.Marker({
        position: plan.green,
        map,
        zIndex: 1,
        icon: plan.hole === 1
          ? {
              url: '/images/icons/Flag.svg',
              scaledSize: new google.maps.Size(28, 40),
              anchor: new google.maps.Point(4, 40),
            }
          : {
              url:
                "data:image/svg+xml," +
                encodeURIComponent(
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

    // Route polyline
    for (let i = 0; i < plan.routePoints.length - 1; i++) {
      const from = plan.routePoints[i];
      const to = plan.routePoints[i + 1];
      const isLastSegment = i === plan.routePoints.length - 2;
      linesRef.current.push(
        new google.maps.Polyline({
          path: [from, to],
          strokeColor: "#ffffff",
          strokeWeight: 2,
          strokeOpacity: plan.dots.length > 0 && isLastSegment ? 0.4 : 0.8,
          geodesic: true,
          map,
        })
      );
    }

    // ── Diagnostic ─────────────────────────────────────────────────────
    console.error("[HoleMapPreview] Hole", plan.hole, "dots:", plan.dots.length, "routePoints:", plan.routePoints.length, "dogleg:", !!plan.dogleg, "totalDist:", plan.totalDistance);
    plan.dots.forEach((d, i) => console.error("  dot", i, d.label, d.club, d.distance + "m"));

    // ── Place red landing dots proportionally along the route ─────────
    // Shot distances (from course data) can exceed haversine route length,
    // so we place dots proportionally instead of by absolute metres.
    const hasDogleg = !!plan.dogleg && plan.routePoints.length > 2;
    const totalShots = plan.dots.length;

    if (hasDogleg) {
      // Dogleg: dot 0 at waypoint, subsequent dots proportionally toward green.
      // Cap at 85% so no dot overlaps the green flag.
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
              scale: 4,
              fillColor: "#ff0000",
              fillOpacity: 1,
              strokeWeight: 0,
            },
          })
        );
      });
    } else {
      // Straight: place dots proportionally along tee→green. Cap at 85%.
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
              scale: 4,
              fillColor: "#ff0000",
              fillOpacity: 1,
              strokeWeight: 0,
            },
          })
        );
      });
    }
  }, [plan, clearOverlays]);

  return (
    <div>
      <div className="rounded-2xl overflow-hidden border border-[#c9a84c]/30 bg-[#0a0a0a] relative">
        <div ref={mapContainerRef} className="h-[45vh] w-full bg-[#1e1e1e]" />
        <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
        {plan.dots.length > 0 && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 flex flex-col gap-2 pointer-events-none">
            {[...plan.dots].reverse().map((dot, i) => (
              <div key={i} className="bg-black/70 rounded-lg px-3 py-1.5">
                <p className="text-lg font-bold text-white leading-tight">{dot.distance}m</p>
                <p className="text-xs text-[#c9a84c]">{dot.club}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Shot breakdown — horizontal row */}
      {plan.dots.length > 0 && (
        <div className="mt-3 flex rounded-xl bg-[#1e1e1e] divide-x divide-white/20">
          {plan.dots.map((dot, i) => (
            <div key={i} className="flex-1 px-3 py-2 text-center">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#888888]">
                {dot.label}
              </p>
              <p className="text-sm font-bold text-[#c9a84c]">{dot.club}</p>
              <p className="text-sm font-bold text-white">{dot.distance}m</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
