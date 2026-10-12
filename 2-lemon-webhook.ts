// ForensiDent: Supabase Edge Function "lemon-webhook"
// Supabase › Edge Functions › Deploy a new function › Via editor › name: lemon-webhook › paste this › Deploy
// Then: function settings › turn OFF "Enforce JWT verification"
// Secret needed (Edge Functions › Secrets): LEMON_SIGNING_SECRET = the signing secret you set in Lemon Squeezy
import { createClient } from "npm:@supabase/supabase-js@2";

const secret = Deno.env.get("LEMON_SIGNING_SECRET") ?? "";

async function validSignature(raw: string, signature: string): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw));
  const hex = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return secret.length > 0 && hex === signature;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("ok");
  const raw = await req.text();
  if (!(await validSignature(raw, req.headers.get("x-signature") ?? ""))) {
    return new Response("invalid signature", { status: 401 });
  }
  const body = JSON.parse(raw);
  const event = body?.meta?.event_name;
  const userId = body?.meta?.custom_data?.user_id;
  if (!userId) return new Response("no user id", { status: 200 });

  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  if (event === "order_created" && body?.data?.attributes?.status === "paid") {
    const { error } = await db.from("profiles").update({
      is_pro: true,
      pro_since: new Date().toISOString(),
      order_id: String(body.data.id),
    }).eq("id", userId);
    if (error) return new Response(error.message, { status: 500 });
  }

  if (event === "order_refunded") {
    const { error } = await db.from("profiles").update({ is_pro: false }).eq("id", userId);
    if (error) return new Response(error.message, { status: 500 });
  }

  return new Response("ok");
});
