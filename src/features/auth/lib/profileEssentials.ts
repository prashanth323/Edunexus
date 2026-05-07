import { z } from "zod"

/** Phone, gender, DOB — same rules as first-login onboarding. */
export const profileEssentialsSchema = z.object({
  phone: z.string().min(5, "Phone is required"),
  gender: z.enum(["male", "female", "other", "prefer_not_to_say"]),
  date_of_birth: z.string().min(1, "Date of birth is required"),
})

export type ProfileEssentialsFormValues = z.infer<typeof profileEssentialsSchema>

/** Settings: essentials + display name (self-service under profiles_update_self). */
export const profileSettingsSchema = profileEssentialsSchema.extend({
  first_name: z.string().min(1, "First name is required").max(120),
  last_name: z.string().min(1, "Last name is required").max(120),
})

export type ProfileSettingsFormValues = z.infer<typeof profileSettingsSchema>
