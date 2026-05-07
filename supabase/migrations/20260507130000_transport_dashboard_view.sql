-- Migration: Transport Dashboard View

CREATE OR REPLACE VIEW public.v_transport_dashboard AS
SELECT
  s.id AS school_id,
  COUNT(DISTINCT b.id) AS total_buses,
  COUNT(DISTINCT b.id) FILTER (WHERE b.is_active = true) AS active_buses,
  COUNT(DISTINCT r.id) AS total_routes,
  COUNT(DISTINCT r.id) FILTER (WHERE r.is_active = true) AS active_routes,
  COUNT(DISTINCT rs.id) AS total_route_students
FROM
  public.schools s
  LEFT JOIN public.buses b ON b.school_id = s.id
  LEFT JOIN public.routes r ON r.school_id = s.id
  LEFT JOIN public.route_students rs ON rs.school_id = s.id AND rs.is_active = true
GROUP BY
  s.id;

-- Grant permissions
GRANT SELECT ON public.v_transport_dashboard TO authenticated;
