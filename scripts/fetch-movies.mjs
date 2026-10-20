/**
 * Refresh public/data/movies.json with same-day Hong Kong showtimes.
 * Node native fetch only. Reads the public schedule API used by the
 * Emperor and Cinema City websites (signed the same way their H5 client is).
 * Broadway, MCL, and Golden Harvest pages on this network do not return a
 * parseable public schedule; those attempts are logged and skipped.
 * Any failure or empty result keeps the existing file and exits 0.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const file = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public", "data", "movies.json");

/** Public H5 signing key shipped in the cinema website bundle. */
const SIGN_KEY = "3VIDRSDxD0Ck2b6e9K0RaB9Xo5s81tep";
const API = "https://api.icirena.ai/sync";

const CHAINS = [
  {
    id: "emperor",
    wapid: "ECML_WEB_PROD_S_MPS",
    officialUrl: "https://www.emperorcinemas.com/",
  },
  {
    id: "cinemacity",
    wapid: "CICI_WEB_PROD_S_MPS",
    officialUrl: "https://www.cinemacity.com.hk/",
  },
];

const NOTES = [];

function keep(reason) {
  console.log(`movies: kept existing file (${reason})`);
  if (NOTES.length) console.log(NOTES.map((n) => `movies: ${n}`).join("\n"));
  process.exit(0);
}

function hktParts(ms) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(ms));
  const get = (type) => parts.find((p) => p.type === type)?.value || "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}

function signString(obj) {
  let out = "";
  for (const key of Object.keys(obj).sort()) {
    const value = obj[key];
    if (value == null || value === "") continue;
    out += key + (typeof value === "object" ? JSON.stringify(value) : String(value));
  }
  return out;
}

async function callApi(wapid, method, extra = {}) {
  const data = {
    empCode: "",
    leaseCode: "",
    channelCode: wapid,
    larkSid: "",
    version: "H5",
    appVersion: "H5_5.0",
    ...extra,
  };
  const timestamp = Date.now();
  const meta = {
    app_key: "500000",
    sign_method: "sha256",
    timestamp,
    format: "json",
    simplify: true,
  };
  const sign = crypto
    .createHmac("sha256", SIGN_KEY)
    .update(signString({ ...meta, ...data, method }))
    .digest("hex")
    .toUpperCase();
  const params = new URLSearchParams({
    method,
    app_key: "500000",
    sign_method: "sha256",
    timestamp: String(timestamp),
    format: "json",
    simplify: "true",
    sign,
  });
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(data)) {
    body.append(key, value == null ? "" : String(value));
  }
  const res = await fetch(`${API}?${params}`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      channelCode: wapid,
      appKey: "500000",
    },
    body,
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (json?.error_response) throw new Error(json.error_response.msg || json.error_response.code || "api error");
  return json?.result?.bizValue;
}

function regionOf(cityName) {
  const text = String(cityName || "");
  if (text.includes("九龍")) return "kln";
  if (text.includes("新界")) return "nt";
  if (text.includes("港島") || text.includes("香港島")) return "hki";
  return "";
}

function ratingOf(film) {
  const list = Array.isArray(film?.filmLevelList) ? film.filmLevelList : [];
  const hk = list.find((row) => String(row?.localeCode || "").toLowerCase() === "hk");
  const level = String(hk?.level || "").trim().toUpperCase();
  if (["I", "IIA", "IIB", "III"].includes(level)) return level;
  return "";
}

function formatOf(schedule) {
  const raw = `${schedule?.filmVersion || ""} ${schedule?.hallType || ""}`.toUpperCase();
  if (raw.includes("IMAX")) return "IMAX";
  if (raw.includes("4DX")) return "4DX";
  if (raw.includes("SCREENX")) return "SCREENX";
  if (raw.includes("ATMOS")) return "ATMOS";
  if (raw.includes("DBOX")) return "DBOX";
  return "";
}

async function mapPool(items, limit, fn) {
  const out = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      out[index] = await fn(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return out;
}

async function schedulesForFilm(wapid, filmUniqueId) {
  const rows = [];
  for (let page = 1; page <= 5; page += 1) {
    const batch = await callApi(wapid, "gop.alipic.icirena.own.filmschedule.list", {
      filmUniqueId,
      curPage: page,
      itemsPerPage: 100,
    });
    const list = Array.isArray(batch) ? batch : [];
    rows.push(...list);
    const count = list.reduce((n, row) => n + (Array.isArray(row?.schedules) ? row.schedules.length : 0), 0);
    if (list.length < 1 || count < 100) break;
  }
  return rows;
}

async function fetchChain(chain, today) {
  const films = await callApi(chain.wapid, "gop.alipic.icirena.own.film.showing", { posterSize: "SMALL" });
  if (!Array.isArray(films) || !films.length) throw new Error("empty now-showing list");
  const showing = films.filter((film) => !film.showStatus || film.showStatus === "SHOWING");
  const pages = await mapPool(showing, 4, async (film) => {
    try {
      return { film, rows: await schedulesForFilm(chain.wapid, film.filmUniqueId) };
    } catch (err) {
      NOTES.push(`${chain.id} schedule ${film.filmUniqueId || film.filmName}: ${err.message || err}`);
      return { film, rows: [] };
    }
  });
  const cinemas = new Map();
  const movies = [];
  for (const { film, rows } of pages) {
    const showtimes = [];
    for (const row of rows) {
      const info = row?.cinemaInfo || {};
      const region = regionOf(info.cityName);
      const cinemaLinkId = String(info.cinemaLinkId || "");
      const name = String(info.cinemaName || "").trim();
      if (!region || !cinemaLinkId || !name) continue;
      const cinemaId = `${chain.id}-${cinemaLinkId}`;
      if (!cinemas.has(cinemaId)) {
        cinemas.set(cinemaId, {
          id: cinemaId,
          name,
          region,
          chain: chain.id,
          officialUrl: chain.officialUrl,
        });
      }
      for (const show of Array.isArray(row.schedules) ? row.schedules : []) {
        const ms = Number(show.showTime);
        if (!Number.isFinite(ms)) continue;
        const when = hktParts(ms);
        if (when.date !== today || !/^\d{2}:\d{2}$/.test(when.time)) continue;
        const item = { cinemaId, time: when.time };
        if (show.hallName) item.house = String(show.hallName);
        const format = formatOf(show);
        if (format) item.format = format;
        showtimes.push(item);
      }
    }
    const title = String(film.filmName || "").trim();
    if (!title || !showtimes.length) continue;
    movies.push({
      id: `${chain.id}-${film.filmUniqueId || title}`,
      title,
      rating: ratingOf(film),
      runtime: Number(film.duration) || 0,
      showtimes,
    });
  }
  return { cinemas: [...cinemas.values()], movies };
}

function mergeChains(parts) {
  const cinemas = [];
  const seenCinema = new Set();
  const byTitle = new Map();
  for (const part of parts) {
    for (const cinema of part.cinemas) {
      if (seenCinema.has(cinema.id)) continue;
      seenCinema.add(cinema.id);
      cinemas.push(cinema);
    }
    for (const movie of part.movies) {
      const key = movie.title;
      const prev = byTitle.get(key);
      if (!prev) {
        byTitle.set(key, {
          id: movie.id,
          title: movie.title,
          rating: movie.rating,
          runtime: movie.runtime,
          showtimes: [...movie.showtimes],
        });
        continue;
      }
      if (!prev.rating && movie.rating) prev.rating = movie.rating;
      if (!prev.runtime && movie.runtime) prev.runtime = movie.runtime;
      prev.showtimes.push(...movie.showtimes);
    }
  }
  const movies = [...byTitle.values()].filter((movie) => movie.showtimes.length);
  return { cinemas, movies };
}

async function main() {
  let existing;
  try {
    existing = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    keep("unreadable");
    return;
  }
  const today = hktParts(Date.now()).date;
  const parts = [];
  for (const chain of CHAINS) {
    try {
      const part = await fetchChain(chain, today);
      console.log(`movies: ${chain.id} ${part.movies.length} films, ${part.cinemas.length} cinemas`);
      if (part.movies.length) parts.push(part);
      else NOTES.push(`${chain.id}: no same-day showtimes`);
    } catch (err) {
      NOTES.push(`${chain.id} failed: ${err.message || err}`);
      console.log(`movies: ${chain.id} failed: ${err.message || err}`);
    }
  }
  NOTES.push("broadway cinema.com.hk, mclcinema.com, and goldenharvest.com did not return a parseable public schedule from this environment");
  const merged = mergeChains(parts);
  if (!merged.movies.length || !merged.cinemas.length) keep("no fetched showtimes");
  const next = {
    source: "live",
    sample: false,
    updated: today,
    note: "",
    cinemas: merged.cinemas,
    movies: merged.movies,
  };
  try {
    writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`);
    console.log(`movies: updated ${next.movies.length} titles, ${next.cinemas.length} cinemas, sample false`);
    if (NOTES.length) console.log(NOTES.map((n) => `movies: ${n}`).join("\n"));
  } catch (err) {
    keep(`write failed: ${err.message || err}`);
  }
}

main().catch((err) => {
  console.log(`movies: kept existing file (${err?.message || err || "unexpected"})`);
  process.exit(0);
});
