/**
 * Best-effort refresh of public/data/movies.json.
 * Node native fetch only. Any failure, empty parse, or non-official host
 * keeps the existing file and exits 0 so Pages CI never fails on this step.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const file = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public", "data", "movies.json");

const SOURCES = [
  "https://www.cinema.com.hk/",
  "https://www.mclcinema.com/",
  "https://www.emperorcinemas.com/",
  "https://www.goldenharvest.com/",
  "https://www.cinemacity.com.hk/",
];

const OFFICIAL_HOSTS = [
  "cinema.com.hk",
  "mclcinema.com",
  "emperorcinemas.com",
  "goldenharvest.com",
  "cinemacity.com.hk",
];

function hostOk(url) {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    return OFFICIAL_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
  } catch {
    return false;
  }
}

function keep(reason) {
  console.log(`movies: kept existing file (${reason})`);
  process.exit(0);
}

async function fetchText(url) {
  const res = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(8000),
    headers: { accept: "text/html,application/json" },
  });
  if (!res.ok) return "";
  if (!hostOk(res.url || url)) return "";
  return await res.text();
}

function extractMovies(text) {
  if (!text) return null;
  const chunks = [];
  const jsonLd = text.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const hit of jsonLd) chunks.push(hit[1]);
  const embedded = text.matchAll(/<script[^>]*id=["']showtimes["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const hit of embedded) chunks.push(hit[1]);
  if (text.trim().startsWith("{")) chunks.push(text);
  for (const raw of chunks) {
    try {
      const json = JSON.parse(raw);
      const movies = Array.isArray(json?.movies) ? json.movies : null;
      if (movies?.length) return json;
    } catch {
      /* try the next blob */
    }
  }
  return null;
}

function sanitize(existing, parsed) {
  const cinemas = Array.isArray(existing?.cinemas) ? existing.cinemas : [];
  const ids = new Set(cinemas.map((c) => c?.id).filter(Boolean));
  if (!ids.size || !parsed || !Array.isArray(parsed.movies)) return null;
  const movies = [];
  for (const movie of parsed.movies) {
    const title = String(movie?.title || "").trim();
    const id = String(movie?.id || "").trim();
    if (!title || !id) continue;
    const showtimes = (Array.isArray(movie.showtimes) ? movie.showtimes : [])
      .filter((show) => ids.has(show?.cinemaId) && /^\d{1,2}:\d{2}$/.test(String(show?.time || "").trim()))
      .map((show) => {
        const row = { cinemaId: show.cinemaId, time: String(show.time).trim() };
        if (show.house) row.house = String(show.house);
        if (show.format) row.format = String(show.format);
        return row;
      });
    if (!showtimes.length) continue;
    movies.push({
      id,
      title,
      rating: String(movie.rating || ""),
      runtime: Number(movie.runtime) || 0,
      showtimes,
    });
  }
  if (!movies.length) return null;
  return {
    source: "live",
    sample: false,
    updated: new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Hong_Kong",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date()),
    note: "",
    cinemas,
    movies,
  };
}

async function main() {
  let existing;
  try {
    existing = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    keep("unreadable");
    return;
  }
  if (!Array.isArray(existing?.cinemas) || !existing.cinemas.length) keep("no cinemas");

  let parsed = null;
  try {
    const pages = await Promise.all(SOURCES.map((url) => fetchText(url).catch(() => "")));
    for (const page of pages) {
      parsed = extractMovies(page);
      if (parsed) break;
    }
  } catch {
    keep("fetch failed");
    return;
  }

  const next = sanitize(existing, parsed);
  if (!next) keep("empty parse");
  try {
    writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`);
    console.log(`movies: updated ${next.movies.length} titles`);
  } catch {
    keep("write failed");
  }
}

main().catch(() => {
  console.log("movies: kept existing file (unexpected)");
  process.exit(0);
});
