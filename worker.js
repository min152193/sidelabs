import HTML_TEMPLATE from "./index.html";
import CSS_TEMPLATE from "./style.css";
import JS_TEMPLATE from "./app.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 1. 메인 페이지 요청 처리
    if (url.pathname === "/") {
      return new Response(HTML_TEMPLATE, {
        headers: { "content-type": "text/html;charset=UTF-8" },
      });
    }

    // 2. CSS 파일 요청 처리 (이게 핵심입니다!)
    if (url.pathname === "/style.css") {
      return new Response(CSS_TEMPLATE, {
        headers: { "content-type": "text/css;charset=UTF-8" },
      });
    }

    // 3. JS 파일 요청 처리 (이게 핵심입니다!)
    if (url.pathname === "/app.js") {
      return new Response(JS_TEMPLATE, {
        headers: { "content-type": "application/javascript;charset=UTF-8" },
      });
    }

    // 4. API 로그인 처리
    if (url.pathname === "/api/login" && request.method === "POST") {
      const postData = await request.formData();
      const inputEmail = postData.get("email");
      const inputPassword = postData.get("password");

      if (inputEmail === env.ADMIN_EMAIL && inputPassword === env.ADMIN_PASSWORD) {
        const sessionToken = crypto.randomUUID();
        await env.DB.put(`session_${sessionToken}`, "active", { expirationTtl: 86400 });
        const sessionCookie = `session=${sessionToken}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=86400`;
        return new Response("Success", {
          status: 200,
          headers: { "Set-Cookie": sessionCookie }
        });
      }
      return new Response("Unauthorized", { status: 401 });
    }

    // 5. 대시보드 처리 (생략)
    return new Response("Not Found", { status: 404 });
  }
};