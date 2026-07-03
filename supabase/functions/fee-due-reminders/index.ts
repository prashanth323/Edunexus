/** Daily cron: auto-remind parents on fee due dates. Uses service role. */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4"

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const cronSecret = Deno.env.get("CRON_SECRET")
    const provided = req.headers.get("x-cron-secret")
    const authHeader = req.headers.get("Authorization")
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

    const authorized =
      (cronSecret && provided === cronSecret) ||
      authHeader === `Bearer ${serviceKey}`

    if (!authorized) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const resendKey = Deno.env.get("RESEND_API_KEY")
    const fromEmail = Deno.env.get("OPERATIONAL_EMAIL_FROM") ?? "EduNexus <onboarding@resend.dev>"
    const admin = createClient(supabaseUrl, serviceKey)

    const { data: reminderCount, error: rpcErr } = await admin.rpc("process_automatic_fee_reminders")
    if (rpcErr) {
      return new Response(JSON.stringify({ error: rpcErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const today = new Date().toISOString().split("T")[0]
    const { data: notifications, error: notifErr } = await admin
      .from("school_notifications")
      .select("id, parent_email, title, body, metadata")
      .eq("type", "fee_due_parent")
      .is("email_sent_at", null)
      .gte("created_at", `${today}T00:00:00`)
      .filter("metadata->>auto_reminder", "eq", "true")

    if (notifErr) {
      return new Response(JSON.stringify({ error: notifErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    let emailsSent = 0
    if (resendKey) {
      for (const row of notifications ?? []) {
        if (!row.parent_email) continue
        const meta = (row.metadata ?? {}) as Record<string, unknown>
        const lastPay = meta.last_date_to_pay ? `\n\nLast date to pay: ${String(meta.last_date_to_pay)}` : ""
        const emailBody = `${row.body}${lastPay}`

        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: fromEmail,
            to: [row.parent_email],
            subject: row.title,
            text: emailBody,
          }),
        })

        if (res.ok) {
          await admin
            .from("school_notifications")
            .update({ email_sent_at: new Date().toISOString() })
            .eq("id", row.id)
          emailsSent++
        }
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        reminders_created: reminderCount ?? 0,
        emails_sent: emailsSent,
        skipped_email: !resendKey,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error"
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
