/** Invite staff/students by email from principal (service role). */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4"

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const INVITER_ROLES = new Set(["principal", "school_admin", "vice_principal", "hr_manager", "accountant"])

const INVITABLE_ROLES = new Set([
  "school_admin",
  "admission_manager",
  "counselor",
  "accountant",
  "hr_manager",
  "teacher",
  "class_teacher",
  "librarian",
  "transport_manager",
  "receptionist",
  "student",
  "parent",
])

type ParentInviteRow = {
  email?: string
  first_name?: string
  last_name?: string
  phone?: string
  relation?: string
  is_primary?: boolean
}

type InviteRow = {
  email?: string
  first_name?: string
  last_name?: string
  role?: string
  admission_no?: string
  auto_admission_no?: boolean
  student_id?: string
  parent_id?: string
  skip_enrollment?: boolean
  skip_fee_invoices?: boolean
  /** Required when role is parent (DB constraint). */
  phone?: string
  /** When role is student, optional guardians to invite and link. */
  parents?: ParentInviteRow[]
  /** When role is student, optional section placement for current academic year. */
  section_id?: string
  /** When role is student, optional fee structure IDs to auto-generate invoices. */
  fee_structure_ids?: string[]
}

interface Body {
  school_id?: string
  invitations?: InviteRow[]
}

async function verifySchoolInviter(
  authHeader: string | null,
  supabaseUrl: string,
  anonKey: string,
  serviceKey: string,
  schoolId: string,
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

  const callerId = data.user.id
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: rows, error: roleErr } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", callerId)
    .eq("school_id", schoolId)
    .eq("is_active", true)

  if (roleErr) {
    return new Response(JSON.stringify({ ok: false, error: roleErr.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  const ok = (rows ?? []).some((r) => INVITER_ROLES.has(r.role as string))
  if (!ok) {
    return new Response(JSON.stringify({ ok: false, error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  return { userId: callerId }
}

function humanDesignation(role: string): string {
  return role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

async function getCurrentAcademicYearIdForSchool(
  admin: ReturnType<typeof createClient>,
  schoolId: string,
): Promise<string | null> {
  const { data: cur } = await admin
    .from("academic_years")
    .select("id")
    .eq("school_id", schoolId)
    .eq("is_current", true)
    .maybeSingle()

  if (cur?.id) return cur.id as string

  const { data: latest } = await admin
    .from("academic_years")
    .select("id")
    .eq("school_id", schoolId)
    .order("start_date", { ascending: false })
    .limit(1)
    .maybeSingle()

  return (latest?.id as string) ?? null
}

async function enrollStudentInSchoolSectionForCurrentYear(
  admin: ReturnType<typeof createClient>,
  schoolId: string,
  studentId: string,
  sectionId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!studentId) return { ok: false, error: "Student record missing for enrollment" }
  const ayId = await getCurrentAcademicYearIdForSchool(admin, schoolId)
  if (!ayId) return { ok: false, error: "No current academic year for this school" }

  const { data: sec, error: secErr } = await admin
    .from("sections")
    .select("id, school_id, academic_year_id")
    .eq("id", sectionId)
    .maybeSingle()

  if (secErr) return { ok: false, error: secErr.message }
  if (!sec || sec.school_id !== schoolId) return { ok: false, error: "Section not found for this school" }
  if (sec.academic_year_id !== ayId) {
    return { ok: false, error: "Section is not tied to the current academic year" }
  }

  const { data: existing, error: exErr } = await admin
    .from("enrollments")
    .select("id")
    .eq("school_id", schoolId)
    .eq("student_id", studentId)
    .eq("academic_year_id", ayId)
    .maybeSingle()

  if (exErr) return { ok: false, error: exErr.message }

  if (existing?.id) {
    const { error: upErr } = await admin
      .from("enrollments")
      .update({ section_id: sectionId, status: "active" })
      .eq("id", existing.id)

    if (upErr) return { ok: false, error: upErr.message }
    return { ok: true }
  }

  const { error: insErr } = await admin.from("enrollments").insert({
    school_id: schoolId,
    student_id: studentId,
    section_id: sectionId,
    academic_year_id: ayId,
    status: "active",
  })

  if (insErr) return { ok: false, error: insErr.message }
  return { ok: true }
}

async function waitForProfile(admin: ReturnType<typeof createClient>, userId: string) {
  for (let i = 0; i < 8; i++) {
    const { data: pf } = await admin.from("profiles").select("id").eq("id", userId).maybeSingle()
    if (pf) return
    await new Promise((r) => setTimeout(r, 200 + i * 100))
  }
}

async function inviteParentsForStudent(
  admin: ReturnType<typeof createClient>,
  schoolId: string,
  studentId: string,
  studentEmail: string,
  parents: ParentInviteRow[],
  callerId: string,
  redirectTo: string | undefined,
  results: { email: string; ok: boolean; error?: string; user_id?: string }[],
) {
  const seen = new Set<string>()
  let primaryAssigned = false

  for (const raw of parents) {
    const pemail = raw.email?.trim().toLowerCase()
    const phone = raw.phone?.trim()

    if (!pemail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(pemail)) {
      results.push({ email: pemail ?? "", ok: false, error: "Parent: valid email required" })
      continue
    }
    if (pemail === studentEmail) {
      results.push({
        email: pemail,
        ok: false,
        error: "Parent email must differ from student email",
      })
      continue
    }
    if (seen.has(pemail)) {
      results.push({ email: pemail, ok: false, error: "Duplicate parent email in request" })
      continue
    }
    seen.add(pemail)

    if (!phone) {
      results.push({ email: pemail, ok: false, error: "Parent: phone is required" })
      continue
    }

    let isPrimary = !!raw.is_primary
    if (isPrimary) {
      if (primaryAssigned) isPrimary = false
      else primaryAssigned = true
    }

    const pfn = raw.first_name?.trim() ?? ""
    const pln = raw.last_name?.trim() ?? ""
    const relation = (raw.relation?.trim() || "guardian").toLowerCase()

    let pUserId: string | null = null

    const { data: pinvited, error: pinvErr } = await admin.auth.admin.inviteUserByEmail(pemail, {
      data: {
        first_name: pfn,
        last_name: pln,
        school_id: schoolId,
        invite_role: "parent",
      },
      redirectTo,
    })

    if (pinvErr || !pinvited?.user?.id) {
      const msg = (pinvErr?.message ?? "").toLowerCase()
      if (msg.includes("already") || msg.includes("registered")) {
        const { data: existing } = await admin.from("profiles").select("id").eq("email", pemail).maybeSingle()
        if (existing?.id) {
          pUserId = existing.id
        } else {
          results.push({
            email: pemail,
            ok: false,
            error: pinvErr?.message ?? "Could not invite parent",
          })
          continue
        }
      } else {
        results.push({
          email: pemail,
          ok: false,
          error: pinvErr?.message ?? "Could not send parent invite",
        })
        continue
      }
    } else {
      pUserId = pinvited!.user!.id
    }

    if (!pUserId) {
      results.push({ email: pemail, ok: false, error: "No parent user id" })
      continue
    }

    await waitForProfile(admin, pUserId)

    await admin.from("profiles").update({ school_id: schoolId }).eq("id", pUserId)

    const { error: proleErr } = await admin.from("user_roles").insert({
      user_id: pUserId,
      school_id: schoolId,
      role: "parent",
      granted_by: callerId,
      is_active: true,
    })

    if (proleErr && proleErr.code !== "23505") {
      results.push({ email: pemail, ok: false, error: proleErr.message })
      continue
    }

    const fn = pfn || pemail.split("@")[0]
    const ln = pln

    const { data: existingPar } = await admin
      .from("parents")
      .select("id")
      .eq("school_id", schoolId)
      .eq("profile_id", pUserId)
      .maybeSingle()

    let parentRowId: string | undefined = existingPar?.id

    if (!parentRowId) {
      const { data: ins, error: parInsErr } = await admin
        .from("parents")
        .insert({
          school_id: schoolId,
          profile_id: pUserId,
          first_name: fn,
          last_name: ln,
          email: pemail,
          phone,
        })
        .select("id")
        .single()

      if (parInsErr) {
        results.push({ email: pemail, ok: false, error: parInsErr.message })
        continue
      }
      parentRowId = ins?.id
    }

    if (!parentRowId) {
      results.push({ email: pemail, ok: false, error: "Could not resolve parent record" })
      continue
    }

    const { error: spErr } = await admin.from("student_parents").insert({
      school_id: schoolId,
      student_id: studentId,
      parent_id: parentRowId,
      relation,
      is_primary: isPrimary,
    })

    if (spErr?.code === "23505") {
      results.push({ email: pemail, ok: true, user_id: pUserId, error: "Link already exists" })
      continue
    }
    if (spErr) {
      results.push({ email: pemail, ok: false, error: spErr.message })
      continue
    }

    results.push({ email: pemail, ok: true, user_id: pUserId })
  }
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

  let body: Body
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  const schoolId = body.school_id?.trim()
  const invitations = body.invitations
  if (!schoolId || !invitations?.length) {
    return new Response(JSON.stringify({ ok: false, error: "school_id and invitations required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  const gate = await verifySchoolInviter(req.headers.get("Authorization"), supabaseUrl, anonKey, serviceKey, schoolId)
  if (gate instanceof Response) return gate
  const callerId = gate.userId

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

  const results: { email: string; ok: boolean; error?: string; user_id?: string }[] = []

  for (const inv of invitations) {
    const email = inv.email?.trim().toLowerCase()
    const role = inv.role?.trim()
    const first_name = inv.first_name?.trim() ?? ""
    const last_name = inv.last_name?.trim() ?? ""

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      results.push({ email: email ?? "", ok: false, error: "Valid email required" })
      continue
    }
    if (!role || !INVITABLE_ROLES.has(role)) {
      results.push({ email, ok: false, error: "Invalid or disallowed role" })
      continue
    }
    if (role === "parent" && !inv.phone?.trim()) {
      results.push({ email, ok: false, error: "Phone required for parent invites" })
      continue
    }

    let userId: string | null = null

    const { data: invited, error: invErr } = await admin.auth.admin.inviteUserByEmail(email, {
      data: {
        first_name,
        last_name,
        school_id: schoolId,
        invite_role: role,
      },
      redirectTo,
    })

    if (invErr || !invited?.user?.id) {
      const msg = (invErr?.message ?? "").toLowerCase()
      if (msg.includes("already") || msg.includes("registered")) {
        const { data: existing } = await admin.from("profiles").select("id").eq("email", email).maybeSingle()
        if (existing?.id) {
          userId = existing.id
        } else {
          results.push({
            email,
            ok: false,
            error: invErr?.message ?? "Could not invite user",
          })
          continue
        }
      } else {
        results.push({
          email,
          ok: false,
          error: invErr?.message ?? "Could not send invite",
        })
        continue
      }
    } else {
      userId = invited!.user!.id
    }

    if (!userId) {
      results.push({ email, ok: false, error: "No user id" })
      continue
    }

    await waitForProfile(admin, userId)

    await admin.from("profiles").update({ school_id: schoolId }).eq("id", userId)

    const { error: roleInsertErr } = await admin.from("user_roles").insert({
      user_id: userId,
      school_id: schoolId,
      role,
      granted_by: callerId,
      is_active: true,
    })

    if (roleInsertErr?.code === "23505") {
      results.push({ email, ok: true, user_id: userId, error: "Role already assigned" })
      if (role !== "student") continue
    } else if (roleInsertErr) {
      results.push({ email, ok: false, error: roleInsertErr.message })
      continue
    }

    if (role !== "student" && role !== "parent") {
      const { data: existingStaff } = await admin
        .from("staff")
        .select("id")
        .eq("school_id", schoolId)
        .eq("profile_id", userId)
        .maybeSingle()

      if (!existingStaff) {
        const { error: stErr } = await admin.from("staff").insert({
          school_id: schoolId,
          profile_id: userId,
          designation: humanDesignation(role),
          joining_date: new Date().toISOString().slice(0, 10),
          is_active: true,
        })
        if (stErr) {
          results.push({ email, ok: false, error: stErr.message })
          continue
        }
      }
    }

    if (role === "student") {
      const linkStudentId = inv.student_id?.trim()

      if (linkStudentId) {
        const { data: linkedStu, error: linkStuErr } = await admin
          .from("students")
          .select("id, profile_id")
          .eq("id", linkStudentId)
          .eq("school_id", schoolId)
          .maybeSingle()

        if (linkStuErr || !linkedStu) {
          results.push({ email, ok: false, error: linkStuErr?.message ?? "Student record not found" })
          continue
        }
        if (linkedStu.profile_id && linkedStu.profile_id !== userId) {
          results.push({ email, ok: false, error: "Student already linked to another login" })
          continue
        }
        const { error: upStuErr } = await admin
          .from("students")
          .update({ profile_id: userId, email })
          .eq("id", linkStudentId)
        if (upStuErr) {
          results.push({ email, ok: false, error: upStuErr.message })
          continue
        }
      } else {
        let admissionNo = inv.admission_no?.trim()
        if (!admissionNo && inv.auto_admission_no) {
          const { data: gen, error: genErr } = await admin.rpc("generate_admission_no", {
            p_school_id: schoolId,
          })
          if (genErr || gen == null) {
            results.push({ email, ok: false, error: genErr?.message ?? "Could not generate admission number" })
            continue
          }
          admissionNo = String(gen)
        }
        if (!admissionNo) {
          results.push({ email, ok: false, error: "admission_no or auto_admission_no required for students" })
          continue
        }

        const { data: existingStu } = await admin
          .from("students")
          .select("id")
          .eq("school_id", schoolId)
          .eq("profile_id", userId)
          .maybeSingle()

        if (!existingStu) {
          const fn = first_name || email.split("@")[0]
          const ln = last_name || "—"
          const { error: stuErr } = await admin.from("students").insert({
            school_id: schoolId,
            profile_id: userId,
            admission_no: admissionNo,
            first_name: fn,
            last_name: ln,
            is_active: true,
          })
          if (stuErr) {
            results.push({ email, ok: false, error: stuErr.message })
            continue
          }
        }
      }

      // Auto-generate invoices for selected fee structures
      if (!inv.skip_fee_invoices && inv.fee_structure_ids && inv.fee_structure_ids.length > 0) {
        const { data: stuForFee } = await admin
          .from("students")
          .select("id")
          .eq("school_id", schoolId)
          .eq("profile_id", userId)
          .maybeSingle()

        if (stuForFee?.id) {
          const ayId = await getCurrentAcademicYearIdForSchool(admin, schoolId)
          if (ayId) {
            for (const fsId of inv.fee_structure_ids) {
              const { data: fs } = await admin
                .from("fee_structures")
                .select("id, amount, name")
                .eq("id", fsId)
                .eq("school_id", schoolId)
                .maybeSingle()

              if (fs) {
                // Generate invoice number
                const invNo = `INV-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`
                const dueDate = new Date()
                dueDate.setDate(dueDate.getDate() + 30) // 30-day due

                await admin.from("student_invoices").insert({
                  school_id: schoolId,
                  student_id: stuForFee.id,
                  academic_year_id: ayId,
                  fee_structure_id: fs.id,
                  invoice_no: invNo,
                  description: fs.name,
                  amount: fs.amount,
                  due_date: dueDate.toISOString().slice(0, 10),
                  status: "pending",
                })
              }
            }
          }
        }
      }
    }

    if (role === "parent") {
      const phone = (inv as InviteRow).phone?.trim()
      const fn = first_name || email.split("@")[0]
      const ln = last_name || ""
      const { data: existingPar } = await admin
        .from("parents")
        .select("id")
        .eq("school_id", schoolId)
        .eq("profile_id", userId)
        .maybeSingle()

      if (!existingPar) {
        const { error: parErr } = await admin.from("parents").insert({
          school_id: schoolId,
          profile_id: userId,
          first_name: fn,
          last_name: ln,
          email,
          phone: phone!,
        })
        if (parErr) {
          results.push({ email, ok: false, error: parErr.message })
          continue
        }
      }
    }

    if (role === "student" && inv.parents && inv.parents.length > 0) {
      const { data: stuRow } = await admin
        .from("students")
        .select("id")
        .eq("school_id", schoolId)
        .eq("profile_id", userId)
        .maybeSingle()
      if (stuRow?.id) {
        await inviteParentsForStudent(
          admin,
          schoolId,
          stuRow.id,
          email,
          inv.parents,
          callerId,
          redirectTo,
          results,
        )
      }
    }

    if (role === "student" && !inv.skip_enrollment) {
      const sid = typeof inv.section_id === "string" ? inv.section_id.trim() : ""
      if (sid) {
        const { data: stuForClass } = await admin
          .from("students")
          .select("id")
          .eq("school_id", schoolId)
          .eq("profile_id", userId)
          .maybeSingle()
        const en = await enrollStudentInSchoolSectionForCurrentYear(admin, schoolId, stuForClass?.id ?? "", sid)
        if (!en.ok) {
          results.push({ email, ok: false, error: en.error })
          continue
        }
      }
    }

    results.push({ email, ok: true, user_id: userId })
  }

  const allOk = results.every((r) => r.ok)
  return new Response(JSON.stringify({ ok: allOk, results }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
})
