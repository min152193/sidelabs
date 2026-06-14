export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/api/contact" && request.method === "POST") {
      try {
        const body = await request.json();
        const { name, email, message } = body;

        if (!name || !email || !message) {
          return new Response(JSON.stringify({ error: "Missing required fields" }), {
            status: 400,
            headers: { "content-type": "application/json" }
          });
        }

        // Example integration with Resend API:
        // const res = await fetch("https://api.resend.com/emails", {
        //   method: "POST",
        //   headers: {
        //     "Authorization": `Bearer ${env.RESEND_API_KEY}`,
        //     "Content-Type": "application/json"
        //   },
        //   body: JSON.stringify({
        //     from: "contact@sidelabs.net",
        //     to: "admin@sidelabs.net",
        //     subject: `New Contact Form Message from ${name}`,
        //     html: `<p><strong>Name:</strong> ${name}</p><p><strong>Email:</strong> ${email}</p><p><strong>Message:</strong> ${message}</p>`
        //   })
        // });

        return new Response(JSON.stringify({ success: true, message: "Email sent successfully (mock)" }), {
          status: 200,
          headers: {
            "content-type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { "content-type": "application/json" }
        });
      }
    }

    // CORS preflight options
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type"
        }
      });
    }

    return new Response("Not Found", { status: 404 });
  }
};