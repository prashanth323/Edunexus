-- Enum values must be committed before use (Postgres requirement).
ALTER TYPE public.school_role ADD VALUE IF NOT EXISTS 'head_accountant';
ALTER TYPE public.school_role ADD VALUE IF NOT EXISTS 'hostel_manager';
