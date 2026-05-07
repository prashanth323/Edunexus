-- Principal / school admin attendance analytics (daily rows only: subject_id IS NULL per schema).
-- SECURITY INVOKER: respects RLS on public.attendance.
CREATE OR REPLACE FUNCTION public.get_principal_attendance_stats(
  p_school_id uuid,
  p_days integer DEFAULT 14
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH bounds AS (
    SELECT GREATEST(1, LEAST(COALESCE(p_days, 14), 90))::int AS d
  ),
  today_stats AS (
    SELECT
      count(*)::int AS total,
      count(*) FILTER (WHERE a.status = 'present')::int AS present,
      count(*) FILTER (WHERE a.status = 'absent')::int AS absent,
      count(*) FILTER (WHERE a.status = 'late')::int AS late,
      count(*) FILTER (WHERE a.status = 'half_day')::int AS half_day,
      count(*) FILTER (WHERE a.status IN ('holiday', 'excused'))::int AS other
    FROM public.attendance a
    WHERE a.school_id = p_school_id
      AND a.subject_id IS NULL
      AND a.date = CURRENT_DATE
  ),
  daily AS (
    SELECT
      a.date,
      count(*)::int AS total,
      count(*) FILTER (WHERE a.status = 'present')::int AS present
    FROM public.attendance a, bounds b
    WHERE a.school_id = p_school_id
      AND a.subject_id IS NULL
      AND a.date >= CURRENT_DATE - (b.d - 1)
    GROUP BY a.date
  ),
  daily_json AS (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'date', daily.date::text,
          'total', daily.total,
          'present', daily.present,
          'rate_pct', CASE WHEN daily.total > 0
            THEN round(daily.present::numeric * 100.0 / daily.total, 1)
            ELSE 0 END
        )
        ORDER BY daily.date
      ),
      '[]'::jsonb
    ) AS arr
    FROM daily
  ),
  status_rows AS (
    SELECT a.status, count(*)::int AS cnt
    FROM public.attendance a, bounds b
    WHERE a.school_id = p_school_id
      AND a.subject_id IS NULL
      AND a.date >= CURRENT_DATE - (b.d - 1)
    GROUP BY a.status
  ),
  status_json AS (
    SELECT COALESCE(jsonb_object_agg(sr.status::text, sr.cnt), '{}'::jsonb) AS obj
    FROM status_rows sr
  )
  SELECT jsonb_build_object(
    'today',
    (SELECT jsonb_build_object(
      'total', COALESCE(ts.total, 0),
      'present', COALESCE(ts.present, 0),
      'absent', COALESCE(ts.absent, 0),
      'late', COALESCE(ts.late, 0),
      'half_day', COALESCE(ts.half_day, 0),
      'other', COALESCE(ts.other, 0),
      'rate_pct',
        CASE WHEN COALESCE(ts.total, 0) > 0
          THEN round(ts.present::numeric * 100.0 / ts.total, 1)
          ELSE 0 END
    )
    FROM today_stats ts),
    'by_day', (SELECT arr FROM daily_json),
    'status_breakdown', (SELECT obj FROM status_json),
    'period_days', (SELECT d FROM bounds)
  );
$$;

REVOKE ALL ON FUNCTION public.get_principal_attendance_stats(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_principal_attendance_stats(uuid, integer) TO authenticated;
