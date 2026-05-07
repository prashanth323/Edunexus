-- LMS-oriented teacher metadata on staff + self-update RPC (authenticated teachers/librarians, own row only).

ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS experience_years integer,
  ADD COLUMN IF NOT EXISTS specialization text,
  ADD COLUMN IF NOT EXISTS biography text,
  ADD COLUMN IF NOT EXISTS lms_teacher_profile jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.staff.experience_years IS 'Years of professional teaching-related experience.';
COMMENT ON COLUMN public.staff.specialization IS 'Primary area of specialization for LMS / roster display.';
COMMENT ON COLUMN public.staff.biography IS 'Short professional bio visible to admins and LMS surfaces.';
COMMENT ON COLUMN public.staff.lms_teacher_profile IS 'JSON (camelCase): secondarySubjectIds, secondarySubjectRefs, languagesSpoken, gradeLevelsTaught, officeHours, studentSupportNotes, teachingLicense{}, professionalCertifications[], professionalWebsiteUrl, linkedinUrl, preferredContactMethod.';

CREATE OR REPLACE FUNCTION public.update_my_staff_professional_profile(
  p_school_id uuid,
  p_primary_subject_id uuid,
  p_experience_years integer,
  p_specialization text,
  p_biography text,
  p_qualifications jsonb,
  p_lms_teacher_profile jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staff uuid;
  v_arr jsonb;
BEGIN
  IF p_school_id IS NULL THEN
    RAISE EXCEPTION 'School is required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.school_id = p_school_id
      AND ur.is_active = true
      AND ur.role IN (
        'teacher'::public.school_role,
        'class_teacher'::public.school_role,
        'librarian'::public.school_role
      )
  ) THEN
    RAISE EXCEPTION 'Your role cannot update professional profile for this school';
  END IF;

  SELECT id INTO v_staff
  FROM public.staff
  WHERE school_id = p_school_id
    AND profile_id = auth.uid()
    AND deleted_at IS NULL
  LIMIT 1;

  IF v_staff IS NULL THEN
    RAISE EXCEPTION 'No staff record linked to your profile for this school';
  END IF;

  IF p_primary_subject_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.subjects s
      WHERE s.id = p_primary_subject_id
        AND s.school_id = p_school_id
        AND s.is_active = true
    ) THEN
      RAISE EXCEPTION 'Primary subject not found or inactive for this school';
    END IF;
  END IF;

  IF p_lms_teacher_profile IS NOT NULL THEN
    v_arr := p_lms_teacher_profile->'secondarySubjectIds';
    IF v_arr IS NOT NULL AND jsonb_typeof(v_arr) = 'array' AND jsonb_array_length(v_arr) > 0 THEN
      IF EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(v_arr) AS elem(val)
        WHERE NOT EXISTS (
          SELECT 1 FROM public.subjects s
          WHERE s.id = elem.val::uuid AND s.school_id = p_school_id AND s.is_active = true
        )
      ) THEN
        RAISE EXCEPTION 'One or more secondary subjects are invalid for this school';
      END IF;
    END IF;

    IF p_primary_subject_id IS NOT NULL THEN
      v_arr := p_lms_teacher_profile->'secondarySubjectIds';
      IF v_arr IS NOT NULL AND jsonb_typeof(v_arr) = 'array' THEN
        IF EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(v_arr) AS elem(val)
          WHERE elem.val::uuid = p_primary_subject_id
        ) THEN
          RAISE EXCEPTION 'Secondary subjects cannot include the primary teaching subject';
        END IF;
      END IF;
    END IF;
  END IF;

  UPDATE public.staff
  SET
    primary_subject_id = p_primary_subject_id,
    experience_years = p_experience_years,
    specialization = NULLIF(trim(p_specialization), ''),
    biography = NULLIF(trim(p_biography), ''),
    qualifications = COALESCE(p_qualifications, '[]'::jsonb),
    lms_teacher_profile = CASE
      WHEN p_lms_teacher_profile IS NULL THEN lms_teacher_profile
      ELSE p_lms_teacher_profile
    END,
    updated_at = now()
  WHERE id = v_staff;
END;
$$;

REVOKE ALL ON FUNCTION public.update_my_staff_professional_profile(uuid, uuid, integer, text, text, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_my_staff_professional_profile(uuid, uuid, integer, text, text, jsonb, jsonb) TO authenticated;
