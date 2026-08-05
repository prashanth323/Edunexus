-- Allow auth user deletion from Supabase dashboard: when auth.users is deleted,
-- profiles CASCADE deletes; all optional profile FKs must SET NULL instead of blocking.

DO $$
DECLARE
  r RECORD;
  _def TEXT;
BEGIN
  FOR r IN
    SELECT
      c.oid,
      c.conname,
      c.conrelid::regclass AS tbl,
      a.attname AS col,
      a.attnotnull AS col_not_null
    FROM pg_constraint c
    JOIN pg_class ref ON ref.oid = c.confrelid
    JOIN pg_namespace nsp ON nsp.oid = ref.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    WHERE c.contype = 'f'
      AND nsp.nspname = 'public'
      AND ref.relname = 'profiles'
      AND array_length(c.conkey, 1) = 1
  LOOP
    _def := pg_get_constraintdef(r.oid);

    -- Keep explicit CASCADE (user_roles, message threads, etc.)
    IF _def LIKE '%ON DELETE CASCADE%' THEN
      CONTINUE;
    END IF;

    -- Already SET NULL — nothing to do
    IF _def LIKE '%ON DELETE SET NULL%' THEN
      CONTINUE;
    END IF;

    -- NOT NULL + SET NULL requires a nullable column
    IF r.col_not_null THEN
      EXECUTE format('ALTER TABLE %s ALTER COLUMN %I DROP NOT NULL', r.tbl, r.col);
    END IF;

    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.tbl, r.conname);
    EXECUTE format(
      'ALTER TABLE %s ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.profiles(id) ON DELETE SET NULL',
      r.tbl,
      r.conname,
      r.col
    );
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
