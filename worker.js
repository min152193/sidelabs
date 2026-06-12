import HTML_TEMPLATE from "./index.html";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 1. 메인 랜딩 페이지 라우팅
    if (url.pathname === "/") {
      return new Response(HTML_TEMPLATE, {
        headers: { "content-type": "text/html;charset=UTF-8" },
      });
    }

    // 2. 로그인 API 라우팅 (KV DB를 통한 횟수 제약 및 세션 구현)
    if (url.pathname === "/api/login" && request.method === "POST") {
      const clientIP = request.headers.get("cf-connecting-ip") || "unknown";
      const rateLimitKey = `rate_limit_${clientIP}`;

      // Brute-force 방어 조치 (5회 실패 시 15분 차단)
      let currentAttempts = await env.DB.get(rateLimitKey);
      currentAttempts = currentAttempts ? parseInt(currentAttempts) : 0;

      if (currentAttempts >= 5) {
        return new Response("Too many login attempts. Blocked for 15 minutes.", { status: 429 });
      }

      const postData = await request.formData();
      const inputEmail = postData.get("email");
      const inputPassword = postData.get("password");

      // env Private 변수 기능을 이용 자격 증명
      if (inputEmail === env.ADMIN_EMAIL && inputPassword === env.ADMIN_PASSWORD) {
        // 인증 통과 시 차단 카운트 리셋
        await env.DB.delete(rateLimitKey);

        // UUID 세션 키 생성 및 KV 동기화 (24시간)
        const sessionToken = crypto.randomUUID();
        await env.DB.put(`session_${sessionToken}`, "active", { expirationTtl: 86400 });

        // 클라이언트 조작 불가능한 HttpOnly / Secure 쿠키 릴리즈
        const sessionCookie = `session=${sessionToken}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=86400`;
        
        return new Response("Success", {
          status: 200,
          headers: { "Set-Cookie": sessionCookie }
        });
      } else {
        // 틀릴 때마다 카운트 누적 및 15분 만료 처리
        await env.DB.put(rateLimitKey, (currentAttempts + 1).toString(), { expirationTtl: 900 });
        return new Response("Invalid credentials.", { status: 401 });
      }
    }

    // 3. 내 전용 대시보드 라우팅 (sidelabs.net/dashboard)
    if (url.pathname === "/dashboard") {
      const cookieHeader = request.headers.get("Cookie") || "";
      const cookieMatch = cookieHeader.match(/session=([a-zA-Z0-9-]+)/);

      if (!cookieMatch) return Response.redirect(`${url.origin}/`, 302);

      const userSessionToken = cookieMatch[1];
      const isSessionValid = await env.DB.get(`session_${userSessionToken}`);

      if (!isSessionValid) return Response.redirect(`${url.origin}/`, 302);

      // 프라이빗 환경 변수를 이용한 안전한 Cloudflare API 상태 호출
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

// 전용 대시보드용 내부 가상 마크업 빌더
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