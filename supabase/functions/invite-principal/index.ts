/** Invite a new auth user by email as principal — requires SUPER_ADMIN JWT and env SUPABASE_SERVICE_ROLE_KEY. */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4"

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

interface Body {
  email?: string
  school_id?: string
  first_name?: string
  last_name?: string
}

async function verifySuperAdmin(
  authHeader: string | null,
  supabaseUrl: string,
  anonKey: string,
  serviceKey: string,
): Promise<{ userId: string } | Response> {
  if (!authHeader) {
    return new Response(JSON.stringify({ ok: false, error: "Missing Authorization" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  const sb = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authHeader } },
  })

  const { data, error } = await sb.auth.getUser()
  if (error || !data.user?.id) {
    return new Response(JSON.stringify({ ok: false, error: "Invalid session" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  const sbAdmin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: profile, error: profileErr } = await sbAdmin
    .from("profiles")
    .select("platform_role")
    .eq("id", data.user.id)
    .maybeSingle()

  if (profileErr || profile?.platform_role !== "super_admin") {
    return new Response(JSON.stringify({ ok: false, error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  return { userId: data.user.id }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")

  if (!supabaseUrl || !serviceKey || !anonKey) {
    return new Response(JSON.stringify({ ok: false, error: "Missing server env" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  const gate = await verifySuperAdmin(req.headers.get("Authorization"), supabaseUrl, anonKey, serviceKey)
  if (gate instanceof Response) return gate
  const callerId = gate.userId

  let body: Body
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  const email = body.email?.trim().toLowerCase()
  const schoolId = body.school_id?.trim()
  const first_name = body.first_name?.trim() ?? ""
  const last_name = body.last_name?.trim() ?? ""

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return new Response(JSON.stringify({ ok: false, error: "Valid email required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  if (!schoolId) {
    return new Response(JSON.stringify({ ok: false, error: "school_id required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: sch, error: schErr } = await admin.from("schools").select("id").eq("id", schoolId).maybeSingle()

  if (schErr || !sch) {
    return new Response(JSON.stringify({ ok: false, error: "School not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  const site = Deno.env.get("SITE_URL") ?? Deno.env.get("PUBLIC_SITE_URL")
  const redirectTo = site ? `${site.replace(/\/$/, "")}/login` : undefined

  const { data: invited, error: invErr } = await admin.auth.admin.inviteUserByEmail(email, {
    data: {
      first_name,
      last_name,
      school_id: schoolId,
    },
    redirectTo,
  })

  if (invErr || !invited?.user?.id) {
    const msg = invErr?.message ?? "Could not send invite (user may already exist)."
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  const userId = invited.user.id

  for (let i = 0; i < 8; i++) {
    const { data: pf } = await admin.from("profiles").select("id").eq("id", userId).maybeSingle()
    if (pf) break
    await new Promise((r) => setTimeout(r, 200 + i * 100))
  }

  await admin.from("profiles").update({ school_id: schoolId }).eq("id", userId)

  const { error: roleErr } = await admin.from("user_roles").insert({
    user_id: userId,
    school_id: schoolId,
    role: "principal",
    granted_by: callerId,
    is_active: true,
  })

  if (roleErr?.code === "23505") {
    return new Response(JSON.stringify({ ok: true, reused: true, user_id: userId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  if (roleErr) {
    return new Response(JSON.stringify({ ok: false, error: roleErr.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  return new Response(JSON.stringify({ ok: true, user_id: userId }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
})
