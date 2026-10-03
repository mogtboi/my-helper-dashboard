/**
 * Play radio streams with user gesture.
 * Native HLS (Safari / Samsung Internet) first; else hls.js for .m3u8;
 * direct audio for progressive/mp3/aac. Supports urls[] fallbacks.
 */
export function createRadio(root, radioConfig) {
  const stations = radioConfig.stations;
  let activeId = stations[0]?.id;
  let playing = false;
  let hls = null;

  root.innerHTML = `
    <div class="radio-row" role="group" aria-label="電台頻道"></div>
    <button type="button" class="play-btn" data-playing="false" aria-pressed="false">播放</button>
    <p class="radio-status muted" aria-live="polite">撳播放先連線（唔會自動播）</p>
    <audio id="radio-audio" preload="none" playsinline crossorigin="anonymous"></audio>
  `;

  const stationRow = root.querySelector(".radio-row");
  const playBtn = root.querySelector(".play-btn");
  const status = root.querySelector(".radio-status");
  const audio = root.querySelector("#radio-audio");

  stationRow.innerHTML = stations
    .map(
      (s) => `
      <button type="button" class="station-btn" data-station="${s.id}"
        aria-pressed="${s.id === activeId}">${s.name}</button>`
    )
    .join("");

  const destroyHls = () => {
    if (hls) {
      hls.destroy();
      hls = null;
    }
  };

  const stationUrls = (station) => {
    if (Array.isArray(station.urls) && station.urls.length) return station.urls;
    if (station.url) return [station.url];
    return [];
  };

  const isHls = (url) => /\.m3u8(\?|$)/i.test(url);

  const attachHls = async (url) => {
    destroyHls();
    audio.removeAttribute("src");
    if (audio.canPlayType("application/vnd.apple.mpegurl")) {
      audio.src = url;
      return "native";
    }
    const { default: Hls } = await import("hls.js");
    if (!Hls.isSupported()) {
      throw new Error("no-hls");
    }
    await new Promise((resolve, reject) => {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
      });
      const onFatal = (_e, data) => {
        if (data.fatal) {
          hls?.off(Hls.Events.ERROR, onFatal);
          reject(new Error(data.type || "hls-error"));
        }
      };
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        hls.off(Hls.Events.ERROR, onFatal);
        resolve();
      });
      hls.on(Hls.Events.ERROR, onFatal);
      hls.loadSource(url);
      hls.attachMedia(audio);
      setTimeout(() => reject(new Error("hls-timeout")), 8000);
    });
    return "hls.js";
  };

  const attachDirect = (url) =>
    new Promise((resolve, reject) => {
      destroyHls();
      const onCanPlay = () => {
        cleanup();
        resolve("direct");
      };
      const onError = () => {
        cleanup();
        reject(new Error("audio-error"));
      };
      const cleanup = () => {
        audio.removeEventListener("canplay", onCanPlay);
        audio.removeEventListener("error", onError);
      };
      audio.addEventListener("canplay", onCanPlay);
      audio.addEventListener("error", onError);
      audio.src = url;
      audio.load();
      setTimeout(() => {
        cleanup();
        reject(new Error("direct-timeout"));
      }, 8000);
    });

  const attachSource = async (url) => {
    if (isHls(url)) return attachHls(url);
    return attachDirect(url);
  };

  const setPlaying = (next) => {
    playing = next;
    playBtn.dataset.playing = String(playing);
    playBtn.setAttribute("aria-pressed", String(playing));
    playBtn.textContent = playing ? "暫停" : "播放";
  };

  const currentStation = () => stations.find((s) => s.id === activeId);

  const failMessage = (station) => {
    const home = station.homepage
      ? ` · <a class="radio-home-link" href="${station.homepage}" target="_blank" rel="noopener noreferrer">去官方聽</a>`
      : "";
    return `暫時播唔到「${station.name}」（串流限制／跨域）${home} · 可試其他台`;
  };

  const play = async () => {
    const station = currentStation();
    if (!station) return;
    status.classList.remove("error");
    status.textContent = `連線 ${station.name}…`;
    const urls = stationUrls(station);
    if (!urls.length) {
      status.innerHTML = failMessage(station);
      status.classList.add("error");
      return;
    }

    let lastErr = null;
    for (const url of urls) {
      try {
        await attachSource(url);
        await audio.play();
        setPlaying(true);
        status.textContent = `播放中 · ${station.name}`;
        status.classList.remove("error");
        return;
      } catch (e) {
        lastErr = e;
        destroyHls();
        audio.removeAttribute("src");
      }
    }

    setPlaying(false);
    status.innerHTML = failMessage(station);
    status.classList.add("error");
    console.warn("radio play failed", station.id, lastErr);
  };

  const pause = () => {
    audio.pause();
    setPlaying(false);
    status.textContent = "已暫停";
  };

  stationRow.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-station]");
    if (!btn) return;
    activeId = btn.dataset.station;
    stationRow.querySelectorAll(".station-btn").forEach((b) => {
      b.setAttribute("aria-pressed", String(b.dataset.station === activeId));
    });
    if (playing) {
      await play();
    } else {
      status.textContent = `已選 ${currentStation()?.name} · 撳播放`;
      status.classList.remove("error");
    }
  });

  playBtn.addEventListener("click", async () => {
    if (playing) pause();
    else await play();
  });

  audio.addEventListener("error", () => {
    if (!playing) return;
    status.textContent = "音訊中斷，可再撳播放重試或換台";
    status.classList.add("error");
    setPlaying(false);
  });

  return () => {
    pause();
    destroyHls();
  };
}
