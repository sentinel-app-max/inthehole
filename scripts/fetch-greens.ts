/**
 * Fetch golf course greens in Gauteng from OpenStreetMap via Overpass API.
 * Run: npx tsx scripts/fetch-greens.ts
 */

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

// Gauteng bounding box: south, west, north, east
const BBOX = "-26.5,27.5,-25.5,28.5";

const query = `
[out:json][timeout:60];
(
  node["golf"="green"](${BBOX});
  way["golf"="green"](${BBOX});
  node["leisure"="golf_course"](${BBOX});
  way["leisure"="golf_course"](${BBOX});
  relation["leisure"="golf_course"](${BBOX});
);
out center tags;
`;

interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface Green {
  id: number;
  type: string;
  name: string;
  lat: number;
  lng: number;
  hole: string | null;
  tags: Record<string, string>;
}

async function main() {
  console.log("Fetching golf data from Overpass API...");

  const res = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `data=${encodeURIComponent(query)}`,
  });

  if (!res.ok) {
    console.error(`Overpass API error: ${res.status} ${res.statusText}`);
    process.exit(1);
  }

  const data = await res.json();
  const elements: OverpassElement[] = data.elements ?? [];

  console.log(`Got ${elements.length} elements from Overpass`);

  const greens: Green[] = elements.map((el) => {
    const lat = el.lat ?? el.center?.lat ?? 0;
    const lng = el.lon ?? el.center?.lon ?? 0;
    const tags = el.tags ?? {};

    return {
      id: el.id,
      type: el.type,
      name: tags.name ?? tags["golf:course"] ?? "Unknown",
      lat,
      lng,
      hole: tags.ref ?? tags.hole ?? null,
      tags,
    };
  });

  const path = await import("path");
  const fs = await import("fs");
  const outPath = path.join(process.cwd(), "scripts", "greens-data.json");
  fs.writeFileSync(outPath, JSON.stringify(greens, null, 2));

  console.log(`Wrote ${greens.length} results to scripts/greens-data.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
