-- ============================================================
-- SCHOOL SAAS PLATFORM - SUPABASE POSTGRESQL SCHEMA
-- Migration 02: Platform Core Tables
-- ============================================================

-- ─── ORGANIZATIONS ────────────────────────────────────────────
-- Optional grouping: a trust or company that owns multiple schools
CREATE TABLE public.organizations (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name           TEXT NOT NULL,
  slug           TEXT UNIQUE NOT NULL,
  logo_url       TEXT,
  website        TEXT,
  address        JSONB,          -- { street, city, state, pincode, country }
  contact_email  TEXT,
  contact_phone  TEXT,
  is_active      BOOLEAN NOT NULL DEFAULT true,
  metadata       JSONB DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE INDEX idx_organizations_slug ON public.organizations(slug);

-- ─── SCHOOLS ──────────────────────────────────────────────────
CREATE TABLE public.schools (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id  UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  name             TEXT NOT NULL,
  slug             TEXT UNIQUE NOT NULL,
  code             TEXT UNIQUE,                 -- short internal code e.g. "DPS-HYD"
  logo_url         TEXT,
  cover_url        TEXT,
  address          JSONB,
  contact_email    TEXT,
  contact_phone    TEXT,
  board            TEXT,                        -- CBSE / ICSE / State
  established_year INT,
  affiliation_no   TEXT,
  timezone         TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  currency         TEXT NOT NULL DEFAULT 'INR',
  academic_start_month INT NOT NULL DEFAULT 6, -- 6 = June
  is_active        BOOLEAN NOT NULL DEFAULT true,
  settings         JSONB DEFAULT '{}',          -- school-specific config
  deleted_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.schools
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE INDEX idx_schools_organization_id ON public.schools(organization_id);
CREATE INDEX idx_schools_slug ON public.schools(slug);
CREATE INDEX idx_schools_is_active ON public.schools(is_active) WHERE deleted_at IS NULL;

-- ─── PROFILES ─────────────────────────────────────────────────
-- Linked 1:1 to auth.users via id
CREATE TABLE public.profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id       UUID REFERENCES public.schools(id) ON DELETE SET NULL,
  platform_role   platform_role,               -- NULL for school-only users
  first_name      TEXT NOT NULL,
  last_name       TEXT NOT NULL,
  email           TEXT UNIQUE NOT NULL,
  phone           TEXT,
  avatar_url      TEXT,
  gender          gender_type,
  date_of_birth   DATE,
  address         JSONB,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  last_login_at   TIMESTAMPTZ,
  metadata        JSONB DEFAULT '{}',
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE INDEX idx_profiles_school_id ON public.profiles(school_id);
CREATE INDEX idx_profiles_email ON public.profiles(email);
CREATE INDEX idx_profiles_platform_role ON public.profiles(platform_role) WHERE platform_role IS NOT NULL;

-- ─── ROLES ────────────────────────────────────────────────────
CREATE TABLE public.roles (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT UNIQUE NOT NULL,      -- matches enum value
  label       TEXT NOT NULL,             -- human-readable
  scope       TEXT NOT NULL CHECK (scope IN ('platform','school')),
  description TEXT,
  is_system   BOOLEAN NOT NULL DEFAULT false,  -- cannot be deleted
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.roles
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ─── PERMISSIONS ──────────────────────────────────────────────
CREATE TABLE public.permissions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  resource    TEXT NOT NULL,   -- e.g. 'students', 'leads', 'fees'
  action      TEXT NOT NULL,   -- e.g. 'read', 'create', 'update', 'delete'
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(resource, action)
);

-- ─── ROLE_PERMISSIONS ─────────────────────────────────────────
CREATE TABLE public.role_permissions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role_id       UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(role_id, permission_id)
);
CREATE INDEX idx_role_permissions_role_id ON public.role_permissions(role_id);

-- ─── USER_ROLES ───────────────────────────────────────────────
-- A user can have different roles in different schools
CREATE TABLE public.user_roles (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  school_id   UUID REFERENCES public.schools(id) ON DELETE CASCADE,  -- NULL for platform roles
  role        school_role NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  granted_by  UUID REFERENCES public.profiles(id),
  granted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, school_id, role)
);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_school_id ON public.user_roles(school_id);
CREATE INDEX idx_user_roles_role ON public.user_roles(role);

-- ─── AUDIT LOGS ───────────────────────────────────────────────
CREATE TABLE public.audit_logs (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id    UUID REFERENCES public.schools(id) ON DELETE SET NULL,
  actor_id     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action       TEXT NOT NULL,    -- CREATE, UPDATE, DELETE, LOGIN, etc.
  resource     TEXT NOT NULL,    -- table name
  resource_id  UUID,
  old_data     JSONB,
  new_data     JSONB,
  ip_address   INET,
  user_agent   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_logs_school_id   ON public.audit_logs(school_id);
CREATE INDEX idx_audit_logs_actor_id    ON public.audit_logs(actor_id);
CREATE INDEX idx_audit_logs_resource    ON public.audit_logs(resource, resource_id);
CREATE INDEX idx_audit_logs_created_at  ON public.audit_logs(created_at DESC);

-- Generic audit trigger function
CREATE OR REPLACE FUNCTION audit_trigger_fn()
RETURNS TRIGGER AS $$
DECLARE
  _school_id UUID;
BEGIN
  -- Try to extract school_id from the row
  BEGIN
    IF TG_OP = 'DELETE' THEN
      _school_id := (row_to_json(OLD)->>'school_id')::UUID;
    ELSE
      _school_id := (row_to_json(NEW)->>'school_id')::UUID;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    _school_id := NULL;
  END;

  INSERT INTO public.audit_logs(school_id, actor_id, action, resource, resource_id, old_data, new_data)
  VALUES (
    _school_id,
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    CASE TG_OP
      WHEN 'DELETE' THEN (row_to_json(OLD)->>'id')::UUID
      ELSE (row_to_json(NEW)->>'id')::UUID
    END,
    CASE TG_OP WHEN 'INSERT' THEN NULL ELSE row_to_json(OLD) END,
    CASE TG_OP WHEN 'DELETE' THEN NULL ELSE row_to_json(NEW) END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── RLS HELPER FUNCTIONS (require profiles + user_roles) ─────
-- Used inside RLS policies to avoid repeated subqueries
CREATE OR REPLACE FUNCTION get_my_school_id()
RETURNS UUID AS $$
  SELECT school_id FROM public.profiles WHERE id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_platform_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND platform_role IN ('super_admin','operations_admin','finance_admin','support_admin','analyst')
  )
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND platform_role = 'super_admin'
  )
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION has_school_role(required_role school_role)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.school_id = get_my_school_id()
      AND ur.role = required_role
      AND ur.is_active = true
  )
$$ LANGUAGE sql STABLE SECURITY DEFINER;
