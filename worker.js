import HTML_TEMPLATE from "./index.html";
import CSS_TEMPLATE from "./style.css";
import JS_TEMPLATE from "./app.txt";
import FAV_32 from "./ico/fav_32.png";
import FAV_180 from "./ico/fav_180.png";
import FAV_192 from "./ico/fav_192.png";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 1. ASTRO BYPASS GUARD
    if (url.pathname === '/blog' || url.pathname.startsWith('/blog/')) {
      return fetch(request);
    }

    // 정적 자산 라우팅
    if (url.pathname === "/") {
      return new Response(HTML_TEMPLATE, { headers: { "content-type": "text/html;charset=UTF-8" } });
    }
    if (url.pathname === "/style.css") {
      return new Response(CSS_TEMPLATE, { headers: { "content-type": "text/css;charset=UTF-8" } });
    }
    if (url.pathname === "/app.js") {
      return new Response(JS_TEMPLATE, { headers: { "content-type": "application/javascript;charset=UTF-8" } });
    }
    if (url.pathname === "/ico/fav_32.png") {
      return new Response(FAV_32, {
        headers: { "content-type": "image/png" },
      });
    }

    if (url.pathname === "/ico/fav_180.png") {
      return new Response(FAV_180, {
        headers: { "content-type": "image/png" },
      });
    }

    if (url.pathname === "/ico/fav_192.png") {
      return new Response(FAV_192, {
        headers: { "content-type": "image/png" },
      });
    }

    // /favicon.ico 대비 예외처리
    if (url.pathname === "/favicon.ico") {
      return new Response(FAV_32, {
        headers: { "content-type": "image/png" },
      });
    }

    // 2. 로그인 인증 처리
    if (url.pathname === "/api/login" && request.method === "POST") {
      const clientIP = request.headers.get("cf-connecting-ip") || "unknown";
      const rateLimitKey = `rate_limit_${clientIP}`;

      let currentAttempts = await env.DB.get(rateLimitKey);
      currentAttempts = currentAttempts ? parseInt(currentAttempts) : 0;

      if (currentAttempts >= 5) {
        return new Response("Blocked", { status: 429 });
      }

      const postData = await request.formData();
      const inputEmail = postData.get("email");
      const inputPassword = postData.get("password");

      if (inputEmail === env.ADMIN_EMAIL && inputPassword === env.ADMIN_PASSWORD) {
        await env.DB.delete(rateLimitKey);
        const sessionToken = crypto.randomUUID();
        await env.DB.put(`session_${sessionToken}`, "active", { expirationTtl: 86400 });
        const sessionCookie = `session=${sessionToken}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=86400`;
        return new Response("Success", { status: 200, headers: { "Set-Cookie": sessionCookie } });
      } else {
        await env.DB.put(rateLimitKey, (currentAttempts + 1).toString(), { expirationTtl: 900 });
        return new Response("Fail", { status: 401 });
      }
    }

    // 대시보드
    if (url.pathname === "/dashboard") {
      const cookieHeader = request.headers.get("Cookie") || "";
      const cookieMatch = cookieHeader.match(/session=([a-zA-Z0-9-]+)/);

      if (!cookieMatch) return Response.redirect(`${url.origin}/`, 302);
      const isSessionValid = await env.DB.get(`session_${cookieMatch[1]}`);
      if (!isSessionValid) return Response.redirect(`${url.origin}/`, 302);

      // 인프라 데이터 기본 초기값
      let metrics = {
        zoneName: "sidelabs.net",
        status: "UNKNOWN",
        requests: 0,
        bytes: "0 B",
        cachedRatio: "0%",
        threats: 0
      };

      try {
        // 도메인 상태 조회
        const zoneRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${env.CF_ZONE_ID}`, {
          headers: { "Authorization": `Bearer ${env.CF_API_TOKEN}`, "content-type": "application/json" }
        });
        const zoneData = await zoneRes.json();
        if (zoneData.success) {
          metrics.zoneName = zoneData.result.name;
          metrics.status = zoneData.result.status.toUpperCase();
        }

        // 트래픽 GraphQL 쿼리 송신
        const query = JSON.stringify({
          query: `query {
            viewer {
              zones(filter: {zoneTag: "${env.CF_ZONE_ID}"}) {
                httpRequests1dGroups(limit: 1) {
                  sum {
                    requests
                    bytes
                    cachedBytes
                    threats
                  }
                }
              }
            }
          }`
        });

        const analyticsRes = await fetch("https://api.cloudflare.com/client/v4/graphql", {
          method: "POST",
          headers: { "Authorization": `Bearer ${env.CF_API_TOKEN}`, "content-type": "application/json" },
          body: query
        });
        
        const analyticsData = await analyticsRes.json();
        const dataGroup = analyticsData?.data?.viewer?.zones?.[0]?.httpRequests1dGroups?.[0]?.sum;

        if (dataGroup) {
          metrics.requests = dataGroup.requests || 0;
          metrics.threats = dataGroup.threats || 0;
          
          // 대역폭 데이터 파싱 및 단위 변환
          const rawBytes = dataGroup.bytes || 0;
          if (rawBytes > 1024 * 1024 * 1024) {
            metrics.bytes = `${(rawBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
          } else {
            metrics.bytes = `${(rawBytes / (1024 * 1024)).toFixed(2)} MB`;
          }

          // 캐시 히트율 계산
          const cachedBytes = dataGroup.cachedBytes || 0;
          if (rawBytes > 0) {
            metrics.cachedRatio = `${((cachedBytes / rawBytes) * 100).toFixed(1)}%`;
          }
        }
      } catch (err) {
        console.error("Cloudflare Analytics Sync Error", err);
      }

      return new Response(getDashboardHTML(metrics), { headers: { "content-type": "text/html;charset=UTF-8" } });
    }

    return new Response("Not Found", { status: 404 });
  }
};

function getDashboardHTML(m) {
  return `
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SideLabs Control Tower</title>
    <style>
        body { margin: 0; background: #070a13; color: #fff; font-family: -apple-system, BlinkMacSystemFont, sans-serif; display: flex; flex-direction: column; align-items: center; min-height: 100vh; }
        .nav { width: 100%; padding: 1.5rem 3rem; border-bottom: 1px solid rgba(255,255,255,0.06); display: flex; justify-content: space-between; align-items: center; box-sizing: border-box; background: rgba(11, 15, 25, 0.8); backdrop-filter: blur(10px); }
        .nav h2 { margin: 0; font-size: 1.3rem; letter-spacing: -0.02em; font-weight: 600; color: #f3f4f6; }
        .domain-tag { background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.3); padding: 0.3rem 0.8rem; border-radius: 20px; font-size: 0.75rem; font-weight: bold; color: #60a5fa; }
        .wrapper { width: 100%; max-width: 1000px; padding: 3rem 1.5rem; box-sizing: border-box; }
        .section-header { font-size: 1.1rem; font-weight: 600; color: #888ea1; margin-bottom: 1.5rem; letter-spacing: 0.05em; text-transform: uppercase; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1.5rem; margin-bottom: 3rem; }
        .card { background: rgba(17, 24, 39, 0.7); border: 1px solid rgba(255,255,255,0.05); padding: 1.8rem; border-radius: 14px; box-shadow: 0 10px 30px rgba(0,0,0,0.25); position: relative; overflow: hidden; }
        .card h3 { margin: 0 0 0.8rem 0; color: #6b7280; font-size: 0.8rem; font-weight: 600; letter-spacing: 0.02em; }
        .card p { margin: 0; font-size: 1.8rem; font-weight: 700; color: #f3f4f6; font-family: 'Poppins', sans-serif; }
        .status-active { color: #10b981 !important; }
        .status-danger { color: #ef4444 !important; }
        .footer { font-size: 0.7rem; color: rgba(255,255,255,0.2); text-align: center; margin-top: auto; padding: 2rem 0; }
    </style>
</head>
<body>
    <div class="nav">
        <h2>SideLabs Control Tower</h2>
        <div class="domain-tag">${m.zoneName}</div>
    </div>
    <div class="wrapper">
        <div class="section-header">Cloudflare Real-time Account Analytics (24h)</div>
        <div class="grid">
            <div class="card">
                <h3>Infrastructure Status</h3>
                <p class="${m.status === 'ACTIVE' ? 'status-active' : 'status-danger'}">${m.status}</p>
            </div>
            <div class="card">
                <h3>Total HTTP Requests</h3>
                <p>${m.requests.toLocaleString()} <span style="font-size: 0.9rem; font-weight: 400; color:#6b7280;">건</span></p>
            </div>
            <div class="card">
                <h3>Bandwidth Served</h3>
                <p>${m.bytes}</p>
            </div>
            <div class="card">
                <h3>Cache Efficiency Ratio</h3>
                <p style="color: #3b82f6;">${m.cachedRatio}</p>
            </div>
            <div class="card">
                <h3>Security Blocked (Threats)</h3>
                <p class="${m.threats > 0 ? 'status-danger' : ''}">${m.threats} <span style="font-size: 0.9rem; font-weight: 400; color:#6b7280;">건</span></p>
            </div>
        </div>
    </div>
    <div class="footer">© SideLabs Terminal. Systems operational.</div>
</body>
</html>`;
}