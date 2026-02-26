/**
 * Test GolfCourseAPI.com search endpoint.
 * Run: node scripts/test-golf-api.mjs
 */

const API_KEY = "MNZEUYEC7MWDNMVWBFT7OVY5N4";
const BASE = "https://api.golfcourseapi.com/v1/search";

const queries = ["glendower", "royal johannesburg", "randpark"];

async function search(query) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Search: "${query}"`);
  console.log("=".repeat(60));

  const url = `${BASE}?search_query=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Key ${API_KEY}` },
  });

  if (!res.ok) {
    console.error(`Error: ${res.status} ${res.statusText}`);
    const body = await res.text();
    console.error(body);
    return;
  }

  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

async function main() {
  for (const q of queries) {
    await search(q);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
