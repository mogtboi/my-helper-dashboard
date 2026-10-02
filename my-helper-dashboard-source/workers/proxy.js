/**
 * Optional Cloudflare Worker proxy stub.
 *
 * Current v1 does NOT need this: HKO + KMB Open APIs already send
 * Access-Control-Allow-Origin: *. Deploy only if an API drops CORS
 * or you want same-origin /api/* for future auth / rate limiting.
 *
 * Deploy: wrangler deploy (see ../README.md)
 */
export default {
  async fetch(request, _env, _ctx) {
    const url = new URL(request.url);

    const allowOrigin = request.headers.get("Origin") || "*";
    const cors = {
      "Access-Control-Allow-Origin": allowOrigin,
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Vary": "Origin",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    const routes = {
      "/api/weather":
        "https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=rhrread&lang=tc",
      "/api/bus/eta": null, // use query: stopId, route, serviceType
    };

    if (url.pathname === "/api/weather") {
      const upstream = await fetch(routes["/api/weather"], {
        headers: { Accept: "application/json" },
      });
      const body = await upstream.arrayBuffer();
      return new Response(body, {
        status: upstream.status,
        headers: {
          ...cors,
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "public, max-age=60",
        },
      });
    }

    if (url.pathname === "/api/bus/eta") {
      const stopId = url.searchParams.get("stopId");
      const route = url.searchParams.get("route") || "64K";
      const serviceType = url.searchParams.get("serviceType") || "1";
      if (!stopId || !/^[A-F0-9]+$/i.test(stopId)) {
        return new Response(JSON.stringify({ error: "invalid stopId" }), {
          status: 400,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      const target = `https://data.etabus.gov.hk/v1/transport/kmb/eta/${stopId}/${route}/${serviceType}`;
      const upstream = await fetch(target, {
        headers: { Accept: "application/json" },
      });
      const body = await upstream.arrayBuffer();
      return new Response(body, {
        status: upstream.status,
        headers: {
          ...cors,
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "public, max-age=15",
        },
      });
    }

    return new Response("Not found", { status: 404, headers: cors });
  },
};
