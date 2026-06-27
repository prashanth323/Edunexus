/** Send operational notification email (fee due, hostel status). Requires RESEND_API_KEY. */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4"

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    const resendKey = Deno.env.get("RESEND_API_KEY")
    const fromEmail = Deno.env.get("OPERATIONAL_EMAIL_FROM") ?? "EduNexus <onboarding@resend.dev>"

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData, error: userErr } = await userClient.auth.getUser()
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const body = await req.json() as { notification_id?: string; to_email?: string; title?: string; body?: string }
    const admin = createClient(supabaseUrl, serviceKey)

    let toEmail = body.to_email
    let title = body.title
    let emailBody = body.body
    let notificationId = body.notification_id

    if (notificationId) {
      const { data: row, error } = await admin
        .from("school_notifications")
        .select("id, parent_email, title, body, email_sent_at, metadata")
        .eq("id", notificationId)
        .maybeSingle()
      if (error || !row) {
        return new Response(JSON.stringify({ error: "Notification not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }
      if (row.email_sent_at) {
        return new Response(JSON.stringify({ ok: true, skipped: "already_sent" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }
      toEmail = row.parent_email ?? toEmail
      title = row.title
      const meta = (row.metadata ?? {}) as Record<string, unknown>
      const feeLines = Array.isArray(meta.fee_lines) ? meta.fee_lines : null
      if (feeLines?.length) {
        const breakdown = feeLines
          .map((line: Record<string, unknown>) => {
            const name = String(line.name ?? "Fee")
            const amount = line.amount != null ? `₹${Number(line.amount).toLocaleString()}` : ""
            const due = line.due_date ? ` (due ${String(line.due_date)})` : ""
            return `  • ${name}: ${amount}${due}`
          })
          .join("\n")
        const lastPay = meta.last_date_to_pay
          ? `\n\nLast date to pay: ${String(meta.last_date_to_pay)}`
          : ""
        emailBody = `${row.body}\n\nFee breakdown:\n${breakdown}${lastPay}`
      } else {
        emailBody = row.body
      }
    }

    if (!toEmail || !title || !emailBody) {
      return new Response(JSON.stringify({ error: "Missing email recipient or content" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    if (!resendKey) {
      return new Response(JSON.stringify({ ok: true, skipped: "no_resend_key" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [toEmail],
        subject: title,
        text: emailBody,
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      return new Response(JSON.stringify({ error: errText }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    if (notificationId) {
      await admin
        .from("school_notifications")
        .update({ email_sent_at: new Date().toISOString() })
        .eq("id", notificationId)
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error"
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
