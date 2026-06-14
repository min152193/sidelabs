export async function POST({ request, locals }) {
  const env = locals.runtime?.env || process.env;
  const clientIP = request.headers.get("cf-connecting-ip") || "unknown";
  const rateLimitKey = `rate_limit_${clientIP}`;

  if (!env.DB) {
    console.error("KV DB namespace is not configured in locals.runtime.env.");
    return new Response("Server Config Error", { status: 500 });
  }

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
    return new Response("Success", { 
      status: 200, 
      headers: { "Set-Cookie": sessionCookie } 
    });
  } else {
    await env.DB.put(rateLimitKey, (currentAttempts + 1).toString(), { expirationTtl: 900 });
    return new Response("Fail", { status: 401 });
  }
}
