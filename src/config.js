/**
 * Plain config — no secrets.
 * Bus / weather / MTR selections live in localStorage on this device only.
 */
export const config = {
  locale: "zh-HK",
  timeZone: "Asia/Hong_Kong",

  weather: {
    /** HKO Open Data — CORS * */
    url: "https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=rhrread&lang=tc",
    refreshMs: 20 * 60 * 1000,
    iconBase: "https://www.hko.gov.hk/images/HKOWxIconOutline/pic",
  },

  /**
   * Radio: RTHK official HLS + Commercial Radio best-effort.
   * CR streams are geo/token gated — player tries urls then degrades with homepage link.
   * Requires user gesture to play.
   */
  radio: {
    stations: [
      {
        id: "rthk1",
        name: "港台第一台",
        url: "https://rthkradio1-live.akamaized.net/hls/live/2035313/radio1/master.m3u8",
      },
      {
        id: "rthk2",
        name: "港台第二台",
        url: "https://rthkradio2-live.akamaized.net/hls/live/2040078/radio2/master.m3u8",
      },
      {
        id: "rthk3",
        name: "Radio 3",
        url: "https://rthkradio3-live.akamaized.net/hls/live/2040079/radio3/master.m3u8",
      },
      {
        id: "rthk5",
        name: "港台第五台",
        url: "https://rthkradio5-live.akamaized.net/hls/live/2040081/radio5/master.m3u8",
      },
      {
        id: "cr881",
        name: "雷霆881",
        homepage: "https://www.881903.com/",
        urls: [
          "https://d2agljdoug3z0j.cloudfront.net/radio-HTTP/cr1-hd.3gp/playlist.m3u8",
          "https://stream-redirect.hktoolbar.com/radio-HTTP/cr1-hd.3gp/playlist.m3u8",
        ],
      },
      {
        id: "cr903",
        name: "叱咤903",
        homepage: "https://www.881903.com/",
        urls: [
          "https://d2agljdoug3z0j.cloudfront.net/radio-HTTP/cr2-hd.3gp/playlist.m3u8",
          "https://stream-redirect.hktoolbar.com/radio-HTTP/cr2-hd.3gp/playlist.m3u8",
        ],
      },
    ],
  },
};
