// @ts-nocheck — Deno edge function
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    const webhookSecret = Deno.env.get("LEAD_WEBHOOK_SECRET")
    const admin = createClient(supabaseUrl, serviceKey)

    if (webhookSecret && req.headers.get("x-webhook-secret") !== webhookSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders })
    }

    const body = await req.json()
    const { school_id, student_name, parent_name, parent_phone, parent_email, notes } = body

    if (!school_id || !student_name || !parent_name || !parent_phone) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400, headers: corsHeaders })
    }

    let { data: source } = await admin
      .from("lead_sources")
      .select("id")
      .eq("school_id", school_id)
      .eq("name", "Website")
      .maybeSingle()

    if (!source) {
      const { data: created } = await admin
        .from("lead_sources")
        .insert({ school_id, name: "Website" })
        .select("id")
        .single()
      source = created
    }

    const { data: lead, error } = await admin
      .from("leads")
      .insert({
        school_id,
        lead_source_id: source?.id,
        student_name,
        parent_name,
        parent_phone,
        parent_email: parent_email ?? null,
        notes: notes ?? "Website contact form",
        status: "new",
        priority: "medium",
      })
      .select("id")
      .single()

    if (error) throw error

    return new Response(JSON.stringify({ lead_id: lead.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
