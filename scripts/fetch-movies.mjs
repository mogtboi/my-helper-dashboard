/**
 * Refresh public/data/movies.json from Emperor's public schedule API.
 * Node native fetch only. One chain: Emperor (icirena). Each on-sale
 * date is requested with showDate. Coming films stay without invented
 * showtimes. Seat bands come only from saleCount and hallSeatCount.
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
];

/** Days from today, inclusive, requested with showDate. */
const DATE_SPAN = 14;

const NOTES = [];

function keep(reason) {
  console.log(`movies: kept existing file (${reason})`);
  if (NOTES.length) console.log(NOTES.map((n) => `movies: ${n}`).join("\n"));
  process.exit(0);
}

function addDays(date, days) {
  const next = new Date(`${date}T04:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
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

async function schedulesForFilm(wapid, filmUniqueId, today) {
  const rows = [];
  for (let offset = 0; offset < DATE_SPAN; offset += 1) {
    const showDate = addDays(today, offset);
    try {
      for (let page = 1; page <= 5; page += 1) {
        const batch = await callApi(wapid, "gop.alipic.icirena.own.filmschedule.list", {
          filmUniqueId,
          curPage: page,
          itemsPerPage: 100,
          showDate,
        });
        const list = Array.isArray(batch) ? batch : [];
        rows.push(...list);
        const count = list.reduce((n, row) => n + (Array.isArray(row?.schedules) ? row.schedules.length : 0), 0);
        if (list.length < 1 || count < 100) break;
      }
    } catch (err) {
      NOTES.push(`schedule ${filmUniqueId} ${showDate}: ${err.message || err}`);
    }
  }
  return rows;
}

/**
 * Band from the session's own saleCount and hallSeatCount.
 * Remaining share: >30% 充足, >10% 尚餘少量, >0 僅餘極少, otherwise 滿座.
 * No band when those counts are missing. Does not invent a seat plan.
 */
function seatOf(show) {
  const total = Number(show?.hallSeatCount);
  const sold = Number(show?.saleCount);
  if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(sold) || sold < 0) return "";
  const remaining = total - sold;
  if (remaining <= 0) return "soldout";
  const left = remaining / total;
  if (left <= 0.1) return "few";
  if (left <= 0.3) return "low";
  return "ok";
}

/** https Emperor URL already on the session. Never built from a session id. */
function bookingUrlOf(show) {
  const raw = String(show?.bookingUrl || show?.ticketUrl || show?.buyUrl || show?.scheduleUrl || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (url.protocol !== "https:" || url.username || url.password) return "";
    if (host !== "emperorcinemas.com" && !host.endsWith(".emperorcinemas.com")) return "";
    return url.href;
  } catch {
    return "";
  }
}

function listOf(film) {
  const type = String(film?.filmTypeName || "");
  if (type.split("|").some((part) => part.trim() === "特備節目")) return "special";
  if (film?.showStatus === "SOON_SHOW_NO_TICKET") return "coming";
  return "now";
}

function scoreOf(film) {
  const raw = film?.rating;
  if (raw == null || String(raw).trim() === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 10) return null;
  return Math.round(n * 10) / 10;
}

function posterOf(film) {
  const raw = String(film?.poster || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password) return "";
    return url.href;
  } catch {
    return "";
  }
}

function priceOf(show) {
  const raw = Number(show?.displayPrice ?? show?.standardPrice);
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  if (raw >= 500) return Math.round(raw / 100);
  return Math.round(raw);
}

function movieFrom(chain, film, showtimes) {
  const title = String(film.filmName || "").trim();
  if (!title) return null;
  const movie = {
    id: `${chain.id}-${film.filmUniqueId || title}`,
    title,
    list: listOf(film),
    rating: ratingOf(film),
    runtime: Number(film.duration) || 0,
    showtimes,
  };
  const score = scoreOf(film);
  if (score != null) movie.score = score;
  const posterUrl = posterOf(film);
  if (posterUrl) movie.posterUrl = posterUrl;
  return movie;
}

async function loadFilms(chain) {
  const byId = new Map();
  const add = (films) => {
    for (const film of Array.isArray(films) ? films : []) {
      const id = String(film?.filmUniqueId || "");
      if (!id || byId.has(id)) continue;
      byId.set(id, film);
    }
  };
  const showing = await callApi(chain.wapid, "gop.alipic.icirena.own.film.showing", { posterSize: "SMALL" });
  add(showing);
  try {
    const coming = await callApi(chain.wapid, "gop.alipic.icirena.own.film.coming", { posterSize: "SMALL" });
    add(coming);
  } catch (err) {
    NOTES.push(`${chain.id} coming list: ${err.message || err}`);
  }
  if (!byId.size) throw new Error("empty film list");
  return [...byId.values()];
}

async function fetchChain(chain, today) {
  const films = await loadFilms(chain);
  const ticketed = films.filter((film) => listOf(film) !== "coming");
  const pages = await mapPool(ticketed, 4, async (film) => {
    try {
      return { film, rows: await schedulesForFilm(chain.wapid, film.filmUniqueId, today) };
    } catch (err) {
      NOTES.push(`${chain.id} schedule ${film.filmUniqueId || film.filmName}: ${err.message || err}`);
      return { film, rows: [] };
    }
  });
  const scheduled = new Map(pages.map((page) => [String(page.film.filmUniqueId || ""), page.rows]));
  const cinemas = new Map();
  const movies = [];
  for (const film of films) {
    const rows = scheduled.get(String(film.filmUniqueId || "")) || [];
    const showtimes = [];
    const seen = new Set();
    for (const row of rows) {
      const info = row?.cinemaInfo || {};
      const region = regionOf(info.cityName);
      const cinemaLinkId = String(info.cinemaLinkId || "");
      const name = String(info.cinemaName || "").trim();
      if (!cinemaLinkId || !name) continue;
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
        if (when.date < today || !/^\d{2}:\d{2}$/.test(when.time)) continue;
        const item = { cinemaId, date: when.date, time: when.time };
        if (show.hallName) item.house = String(show.hallName);
        const format = formatOf(show);
        if (format) item.format = format;
        const price = priceOf(show);
        if (price > 0) item.price = price;
        const seat = seatOf(show);
        if (seat) item.seat = seat;
        const bookingUrl = bookingUrlOf(show);
        if (bookingUrl) item.bookingUrl = bookingUrl;
        const key = `${cinemaId}|${item.date}|${item.time}|${item.house || ""}|${item.format || ""}|${item.price || ""}`;
        if (seen.has(key)) continue;
        seen.add(key);
        showtimes.push(item);
      }
    }
    showtimes.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
    const movie = movieFrom(chain, film, showtimes);
    if (movie) movies.push(movie);
  }
  const used = new Set(movies.flatMap((movie) => movie.showtimes.map((show) => show.cinemaId)));
  return { cinemas: [...cinemas.values()].filter((cinema) => used.has(cinema.id)), movies };
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
      const key = `${movie.list}\n${movie.title}`;
      const prev = byTitle.get(key);
      if (!prev) {
        byTitle.set(key, {
          ...movie,
          showtimes: [...movie.showtimes],
        });
        continue;
      }
      if (!prev.rating && movie.rating) prev.rating = movie.rating;
      if (!prev.runtime && movie.runtime) prev.runtime = movie.runtime;
      if (prev.score == null && movie.score != null) prev.score = movie.score;
      if (!prev.posterUrl && movie.posterUrl) prev.posterUrl = movie.posterUrl;
      prev.showtimes.push(...movie.showtimes);
    }
  }
  const movies = [...byTitle.values()];
  const used = new Set(movies.flatMap((movie) => movie.showtimes.map((show) => show.cinemaId)));
  return { cinemas: cinemas.filter((cinema) => used.has(cinema.id)), movies };
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
  const merged = mergeChains(parts);
  if (!merged.movies.length) keep("no fetched films");
  // The written movie list is this refresh only. Titles absent from the source are not copied back from the old file.
  const sourceKeys = new Set(merged.movies.map((movie) => `${movie.list}\n${movie.title}`));
  const movies = merged.movies.filter((movie) => sourceKeys.has(`${movie.list}\n${movie.title}`));
  const next = {
    source: "live",
    sample: false,
    updated: today,
    note: "",
    cinemas: merged.cinemas,
    movies,
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
