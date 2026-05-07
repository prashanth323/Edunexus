-- ============================================================
-- SCHOOL SAAS PLATFORM - SUPABASE POSTGRESQL SCHEMA
-- Migration 08: Transport & Hostel
-- ============================================================

-- ─── BUSES ────────────────────────────────────────────────────
CREATE TABLE public.buses (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id       UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  registration_no TEXT NOT NULL,
  make_model      TEXT,
  capacity        INT NOT NULL DEFAULT 40,
  driver_id       UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  attendant_id    UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  gps_device_id   TEXT,
  insurance_expiry DATE,
  fitness_expiry   DATE,
  permit_expiry    DATE,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(school_id, registration_no)
);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.buses
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE INDEX idx_buses_school_id ON public.buses(school_id);

-- ─── ROUTES ───────────────────────────────────────────────────
CREATE TABLE public.routes (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id   UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  bus_id      UUID REFERENCES public.buses(id) ON DELETE SET NULL,
  name        TEXT NOT NULL,
  description TEXT,
  fare        NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(school_id, name)
);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.routes
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE INDEX idx_routes_school_id ON public.routes(school_id);
CREATE INDEX idx_routes_bus_id    ON public.routes(bus_id);

-- Route stops (ordered)
CREATE TABLE public.route_stops (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id   UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  route_id    UUID NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  lat         NUMERIC(10,7),
  lng         NUMERIC(10,7),
  stop_order  INT NOT NULL,
  stop_type   stop_type NOT NULL DEFAULT 'both',
  eta_minutes INT,                 -- minutes from previous stop
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(route_id, stop_order)
);
CREATE INDEX idx_route_stops_route_id ON public.route_stops(route_id);

-- ─── ROUTE STUDENTS ───────────────────────────────────────────
CREATE TABLE public.route_students (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id       UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  route_id        UUID NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  student_id      UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  stop_id         UUID REFERENCES public.route_stops(id) ON DELETE SET NULL,
  academic_year_id UUID NOT NULL REFERENCES public.academic_years(id),
  pickup_address  TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(school_id, student_id, academic_year_id)
);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.route_students
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE INDEX idx_route_students_school_id  ON public.route_students(school_id);
CREATE INDEX idx_route_students_route_id   ON public.route_students(route_id);
CREATE INDEX idx_route_students_student_id ON public.route_students(student_id);

-- ─── HOSTEL ROOMS ─────────────────────────────────────────────
CREATE TABLE public.hostel_rooms (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id   UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  room_no     TEXT NOT NULL,
  block       TEXT,              -- Hostel block / building
  floor       INT,
  type        TEXT NOT NULL DEFAULT 'dormitory'
                CHECK (type IN ('single','double','triple','dormitory')),
  capacity    INT NOT NULL DEFAULT 4,
  monthly_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
  amenities   TEXT[],
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(school_id, room_no)
);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.hostel_rooms
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE INDEX idx_hostel_rooms_school_id ON public.hostel_rooms(school_id);

-- ─── HOSTEL ALLOCATIONS ───────────────────────────────────────
CREATE TABLE public.hostel_allocations (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id        UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  room_id          UUID NOT NULL REFERENCES public.hostel_rooms(id) ON DELETE CASCADE,
  student_id       UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  academic_year_id UUID NOT NULL REFERENCES public.academic_years(id),
  check_in_date    DATE NOT NULL,
  check_out_date   DATE,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(school_id, student_id, academic_year_id)
);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.hostel_allocations
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE INDEX idx_hostel_allocations_school_id  ON public.hostel_allocations(school_id);
CREATE INDEX idx_hostel_allocations_room_id    ON public.hostel_allocations(room_id);
CREATE INDEX idx_hostel_allocations_student_id ON public.hostel_allocations(student_id);

-- Guard: room capacity not exceeded
CREATE OR REPLACE FUNCTION check_room_capacity()
RETURNS TRIGGER AS $$
DECLARE
  _capacity INT;
  _current  INT;
BEGIN
  SELECT capacity INTO _capacity FROM public.hostel_rooms WHERE id = NEW.room_id;
  SELECT COUNT(*) INTO _current FROM public.hostel_allocations
  WHERE room_id = NEW.room_id AND is_active = true AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000');
  IF _current >= _capacity THEN
    RAISE EXCEPTION 'Room % is at full capacity (%)', NEW.room_id, _capacity;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_room_capacity
BEFORE INSERT OR UPDATE ON public.hostel_allocations
FOR EACH ROW WHEN (NEW.is_active = true)
EXECUTE FUNCTION check_room_capacity();
