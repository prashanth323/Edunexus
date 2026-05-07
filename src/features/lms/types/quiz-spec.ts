/** Matches LMS quiz_spec JSON stored on assignments.quiz_spec (DB v1). */

export type QuizQuestionMcq = {
  id: string
  type?: "mcq"
  prompt: string
  choices: string[]
  /** Zero-based index into choices */
  correctIndex: number
  /** Points toward quiz total before scaling to assignment.max_marks */
  points?: number
}

export type QuizSpec = {
  version: 1
  questions: QuizQuestionMcq[]
}

export function emptyQuizSpec(): QuizSpec {
  return {
    version: 1,
    questions: [],
  }
}

export function validateQuizSpec(raw: unknown): QuizSpec | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>
  if (o.version !== 1) return null
  const qs = o.questions
  if (!Array.isArray(qs)) return null
  const questions: QuizQuestionMcq[] = []
  for (const q of qs) {
    if (!q || typeof q !== "object" || Array.isArray(q)) continue
    const row = q as Record<string, unknown>
    const id = typeof row.id === "string" ? row.id : null
    const prompt = typeof row.prompt === "string" ? row.prompt : ""
    const choices = Array.isArray(row.choices) ? row.choices.filter((c): c is string => typeof c === "string") : []
    const ci = typeof row.correctIndex === "number" ? row.correctIndex : Number(row.correctIndex)
    if (!id || choices.length < 2 || !Number.isFinite(ci)) continue
    questions.push({
      id,
      type: "mcq",
      prompt,
      choices,
      correctIndex: Math.trunc(ci),
      points: typeof row.points === "number" ? row.points : undefined,
    })
  }
  return { version: 1, questions }
}
