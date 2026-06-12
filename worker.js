import HTML_TEMPLATE from "./index.html";
import CSS_TEMPLATE from "./style.css";
import JS_TEMPLATE from "./app.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 1. 메인 랜딩 페이지 서빙
    if (url.pathname === "/") {
      return new Response(HTML_TEMPLATE, {
        headers: { "content-type": "text/html;charset=UTF-8" },
      });
    }

    // 2. 이원화된 정적 자산(CSS, JS) 엣지 라우팅 주입
    if (url.pathname === "/style.css") {
      return new Response(CSS_TEMPLATE, {
        headers: { "content-type": "text/css;charset=UTF-8" },
      });
    }

    if (url.pathname === "/app.js") {
      return new Response(JS_TEMPLATE, {
        headers: { "content-type": "application/javascript;charset=UTF-8" },
      });
    }

    // 3. 로그인 비동기 API 처리 (KV DB 연산 + 보안 쿠키 발급)
    if (url.pathname === "/api/login" && request.method === "POST") {
      const clientIP = request.headers.get("cf-connecting-ip") || "unknown";
      const rateLimitKey = `rate_limit_${clientIP}`;

      // 무차별 대입(Brute-force) 방어 조치 (5회 실패 시 15분 차단)
      let currentAttempts = await env.DB.get(rateLimitKey);
      currentAttempts = currentAttempts ? parseInt(currentAttempts) : 0;

      if (currentAttempts >= 5) {
        return new Response("Too many login attempts. Blocked for 15 minutes.", { status: 429 });
      }

      const postData = await request.formData();
      const inputEmail = postData.get("email");
      const inputPassword = postData.get("password");

      // 대시보드에 설정한 Secrets 암호화 변수와 매칭 검증
      if (inputEmail === env.ADMIN_EMAIL && inputPassword === env.ADMIN_PASSWORD) {
        await env.DB.delete(rateLimitKey); // 성공 시 차단 카운트 리셋

        // 세션 토큰 생성 및 KV DB 등록 (24시간 유지)
        const sessionToken = crypto.randomUUID();
        await env.DB.put(`session_${sessionToken}`, "active", { expirationTtl: 86400 });

        // 철벽 보안 옵션 조합 쿠키 (HttpOnly, Secure, SameSite)
        const sessionCookie = `session=${sessionToken}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=86400`;
        
        return new Response("Success", {
          status: 200,
          headers: { "Set-Cookie": sessionCookie }
        });
      } else {
        // 실패 시 카운트 누적 (15분 잠금)
        await env.DB.put(rateLimitKey, (currentAttempts + 1).toString(), { expirationTtl: 900 });
        return new Response("Invalid credentials.", { status: 401 });
      }
    }

    // 4. 내 전용 대시보드 라우팅 및 Cloudflare 인프라 상태 연동 (sidelabs.net/dashboard)
    if (url.pathname === "/dashboard") {
      const cookieHeader = request.headers.get("Cookie") || "";
      const cookieMatch = cookieHeader.match(/session=([a-zA-Z0-9-]+)/);

      // 세션 쿠키가 없으면 메인 화면으로 튕겨냄
      if (!cookieMatch) return Response.redirect(`${url.origin}/`, 302);

      const userSessionToken = cookieMatch[1];
      const isSessionValid = await env.DB.get(`session_${userSessionToken}`);

      // 유효하지 않은 세션이면 퇴출
      if (!isSessionValid) return Response.redirect(`${url.origin}/`, 302);

      // 내부 엣지망을 통한 Cloudflare 인프라 상태 파싱
      let cloudflareStatusMarkup = "";
      try {
        const cloudflareApiResponse = await fetch(`https://api.cloudflare.com/client/v4/zones/${env.CF_ZONE_ID}`, {
          headers: {
            "Authorization": `Bearer ${env.CF_API_TOKEN}`,
            "content-type": "application/json"
          }
        });
        const cloudflareData = await cloudflareApiResponse.json();

        if (cloudflareData.success) {
          const zoneInfo = cloudflareData.result;
          cloudflareStatusMarkup = `
            <div class="card">
              <h3>Zone Name</h3>
              <p>${zoneInfo.name}</p>
            </div>
            <div class="card">
              <h3>Status</h3>
              <p style="color: #10b981;">${zoneInfo.status.toUpperCase()}</p>
            </div>
          `;
        } else {
          cloudflareStatusMarkup = `<p>API load failed.</p>`;
        }
      } catch (error) {
        cloudflareStatusMarkup = `<p>API connection error.</p>`;
      }

      return new Response(getDashboardHTML(cloudflareStatusMarkup), {
        headers: { "content-type": "text/html;charset=UTF-8" }
      });
    }

    return new Response("Not Found", { status: 404 });
  }
};

function getDashboardHTML(statusContent) {
  return `
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <title>SideLabs Dash</title>
    <style>
        body { margin: 0; background: #0b0f19; color: #fff; font-family: sans-serif; display: flex; flex-direction: column; align-items: center; min-height: 100vh; }
        .nav { width: 100%; padding: 1.5rem 3rem; border-bottom: 1px solid rgba(255,255,255,0.1); display: flex; justify-content: space-between; box-sizing: border-box; }
        .wrapper { width: 100%; max-width: 800px; padding: 3rem 1rem; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
        .card { background: rgba(30,35,45,0.8); border: 1px solid rgba(255,255,255,0.1); padding: 1.5rem; border-radius: 12px; }
        .card h3 { margin: 0 0 0.5rem 0; color: #888ea1; font-size: 0.8rem; }
        .card p { margin: 0; font-size: 1.4rem; font-weight: bold; }
    </style>
</head>
<body>
    <div class="nav"><h2>SideLabs Center</h2></div>
    <div class="wrapper">
        <h3 style="margin-bottom: 2rem;">Infrastructure Status</h3>
        <div class="grid">${statusContent}</div>
    </div>
</body>
</html>`;
}