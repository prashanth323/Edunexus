-- Track staff/teacher self-service onboarding completion (first-login profile essentials).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.onboarding_completed_at IS
  'Set when the user has completed required profile fields after invite (phone, gender, DOB).';
