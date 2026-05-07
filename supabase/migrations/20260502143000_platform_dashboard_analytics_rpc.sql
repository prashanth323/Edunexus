-- Aggregated analytics for Platform Overview (Charts). Platform admins only inside function body.

CREATE OR REPLACE FUNCTION public.get_platform_dashboard_analytics(p_days integer DEFAULT 14)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  days integer := 14;
BEGIN
  IF NOT is_platform_admin() THEN
    RAISE EXCEPTION 'not allowed'
      USING ERRCODE = '42501';
  END IF;

  IF p_days IS NOT NULL AND p_days >= 1 AND p_days <= 366 THEN
    days := p_days;
  END IF;

  RETURN jsonb_build_object(
    'attendance_by_day',
    COALESCE(
      (
        SELECT jsonb_agg(
                 jsonb_build_object('date', d::text, 'count', cnt)
                 ORDER BY d
               )
        FROM (
          SELECT date AS d,
                 count(*)::bigint AS cnt
          FROM attendance
          WHERE date >= CURRENT_DATE - days
          GROUP BY date
        ) daily
      ),
      '[]'::jsonb
    ),
    'top_schools_by_students',
    COALESCE(
      (
        SELECT jsonb_agg(row_json ORDER BY student_count DESC)
        FROM (
          SELECT jsonb_build_object(
                   'school_id', s.id::text,
                   'name', s.name,
                   'student_count', agg.cnt
                 ) AS row_json,
                 agg.cnt AS student_count
          FROM (
            SELECT st.school_id,
                   count(*)::bigint AS cnt
            FROM students st
            WHERE st.deleted_at IS NULL
            GROUP BY st.school_id
          ) agg
          JOIN schools s ON s.id = agg.school_id AND s.deleted_at IS NULL
          ORDER BY agg.cnt DESC
          LIMIT 12
        ) top_schools
      ),
      '[]'::jsonb
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_platform_dashboard_analytics(integer) TO authenticated;
