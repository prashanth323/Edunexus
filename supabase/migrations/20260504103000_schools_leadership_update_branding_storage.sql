-- Allow principal / school admin / vice principal to update their own school's row (not slug/org/delete flags via app).

CREATE POLICY "schools_select_leadership" ON public.schools FOR SELECT
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.school_id = schools.id
        AND ur.is_active = true
        AND ur.role = ANY (
          ARRAY[
            'principal'::public.school_role,
            'school_admin'::public.school_role,
            'vice_principal'::public.school_role
          ]
        )
    )
  );

CREATE POLICY "schools_update_leadership" ON public.schools FOR UPDATE
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.school_id = schools.id
        AND ur.is_active = true
        AND ur.role = ANY (
          ARRAY[
            'principal'::public.school_role,
            'school_admin'::public.school_role,
            'vice_principal'::public.school_role
          ]
        )
    )
  )
  WITH CHECK (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.school_id = schools.id
        AND ur.is_active = true
        AND ur.role = ANY (
          ARRAY[
            'principal'::public.school_role,
            'school_admin'::public.school_role,
            'vice_principal'::public.school_role
          ]
        )
    )
  );

COMMENT ON POLICY "schools_update_leadership" ON public.schools IS
  'School leadership may update branding and contact fields for schools they belong to (matched via user_roles.school_id).';

-- Bucket for school logos/covers; paths must start with {school_id}/...
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'school-branding',
  'school-branding',
  true,
  5242880,
  ARRAY['image/jpeg','image/png','image/webp','image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "school_branding_select" ON storage.objects FOR SELECT
  USING (bucket_id = 'school-branding');

CREATE POLICY "school_branding_insert" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'school-branding'
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.is_active = true
        AND ur.school_id = (storage.foldername(name))[1]::uuid
        AND ur.role = ANY (
          ARRAY[
            'principal'::public.school_role,
            'school_admin'::public.school_role,
            'vice_principal'::public.school_role
          ]
        )
    )
  );

CREATE POLICY "school_branding_update" ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'school-branding'
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.is_active = true
        AND ur.school_id = (storage.foldername(name))[1]::uuid
        AND ur.role = ANY (
          ARRAY[
            'principal'::public.school_role,
            'school_admin'::public.school_role,
            'vice_principal'::public.school_role
          ]
        )
    )
  );

CREATE POLICY "school_branding_delete" ON storage.objects FOR DELETE
  USING (
    bucket_id = 'school-branding'
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.is_active = true
        AND ur.school_id = (storage.foldername(name))[1]::uuid
        AND ur.role = ANY (
          ARRAY[
            'principal'::public.school_role,
            'school_admin'::public.school_role,
            'vice_principal'::public.school_role
          ]
        )
    )
  );
