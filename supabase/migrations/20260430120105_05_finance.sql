-- ============================================================
-- SCHOOL SAAS PLATFORM - SUPABASE POSTGRESQL SCHEMA
-- Migration 05: Finance Module
-- ============================================================

-- ─── FEE STRUCTURES ───────────────────────────────────────────
CREATE TABLE public.fee_structures (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id        UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  academic_year_id UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
  class_id         UUID REFERENCES public.classes(id) ON DELETE SET NULL,  -- NULL = all classes
  name             TEXT NOT NULL,      -- "Tuition Fee", "Transport Fee"
  amount           NUMERIC(12,2) NOT NULL,
  frequency        TEXT NOT NULL DEFAULT 'annual'
                     CHECK (frequency IN ('one_time','monthly','quarterly','semi_annual','annual')),
  due_day          INT,                -- day of month due
  late_fine_per_day NUMERIC(8,2) DEFAULT 0,
  is_optional      BOOLEAN NOT NULL DEFAULT false,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.fee_structures
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE INDEX idx_fee_structures_school_id        ON public.fee_structures(school_id);
CREATE INDEX idx_fee_structures_academic_year_id ON public.fee_structures(academic_year_id);

-- ─── STUDENT INVOICES ─────────────────────────────────────────
CREATE TABLE public.student_invoices (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id        UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id       UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  academic_year_id UUID NOT NULL REFERENCES public.academic_years(id),
  fee_structure_id UUID REFERENCES public.fee_structures(id) ON DELETE SET NULL,
  invoice_no       TEXT NOT NULL,
  description      TEXT,
  amount           NUMERIC(12,2) NOT NULL,
  discount         NUMERIC(12,2) NOT NULL DEFAULT 0,
  fine             NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_amount     NUMERIC(12,2) GENERATED ALWAYS AS (amount - discount + fine) STORED,
  paid_amount      NUMERIC(12,2) NOT NULL DEFAULT 0,
  due_amount       NUMERIC(12,2) GENERATED ALWAYS AS (amount - discount + fine - paid_amount) STORED,
  status           fee_status NOT NULL DEFAULT 'pending',
  due_date         DATE NOT NULL,
  notes            TEXT,
  deleted_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(school_id, invoice_no)
);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.student_invoices
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE INDEX idx_student_invoices_school_id   ON public.student_invoices(school_id);
CREATE INDEX idx_student_invoices_student_id  ON public.student_invoices(student_id);
CREATE INDEX idx_student_invoices_status      ON public.student_invoices(school_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_student_invoices_due_date    ON public.student_invoices(school_id, due_date) WHERE deleted_at IS NULL;

-- ─── PAYMENTS ─────────────────────────────────────────────────
CREATE TABLE public.payments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id       UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  invoice_id      UUID NOT NULL REFERENCES public.student_invoices(id) ON DELETE RESTRICT,
  student_id      UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  receipt_no      TEXT NOT NULL,
  amount          NUMERIC(12,2) NOT NULL,
  method          payment_method NOT NULL,
  transaction_ref TEXT,               -- cheque no / UTR / card last4
  gateway_ref     TEXT,               -- payment gateway reference
  paid_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  collected_by    UUID REFERENCES public.profiles(id),
  bank_name       TEXT,
  notes           TEXT,
  receipt_url     TEXT,
  is_refunded     BOOLEAN NOT NULL DEFAULT false,
  refunded_at     TIMESTAMPTZ,
  refund_reason   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(school_id, receipt_no)
);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE INDEX idx_payments_school_id   ON public.payments(school_id);
CREATE INDEX idx_payments_invoice_id  ON public.payments(invoice_id);
CREATE INDEX idx_payments_student_id  ON public.payments(student_id);
CREATE INDEX idx_payments_paid_at     ON public.payments(school_id, paid_at DESC);
CREATE INDEX idx_payments_method      ON public.payments(school_id, method);

-- Update invoice paid_amount on payment insert/update/delete (and when invoice_id changes)
CREATE OR REPLACE FUNCTION update_invoice_paid_amount()
RETURNS TRIGGER AS $$
DECLARE
  _ids UUID[];
  _inv_id UUID;
  _paid NUMERIC;
BEGIN
  IF TG_OP = 'DELETE' THEN
    _ids := ARRAY[OLD.invoice_id];
  ELSIF TG_OP = 'UPDATE' AND OLD.invoice_id IS DISTINCT FROM NEW.invoice_id THEN
    _ids := ARRAY[OLD.invoice_id, NEW.invoice_id];
  ELSE
    _ids := ARRAY[NEW.invoice_id];
  END IF;

  FOREACH _inv_id IN ARRAY _ids LOOP
    SELECT COALESCE(SUM(amount), 0) INTO _paid
    FROM public.payments
    WHERE invoice_id = _inv_id AND is_refunded = false;

    UPDATE public.student_invoices
    SET paid_amount = _paid,
        status = CASE
          WHEN _paid <= 0 THEN 'pending'::fee_status
          WHEN _paid >= amount - discount + fine THEN 'paid'::fee_status
          ELSE 'partial'::fee_status
        END
    WHERE id = _inv_id;
  END LOOP;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_invoice_on_payment
AFTER INSERT OR UPDATE OR DELETE ON public.payments
FOR EACH ROW EXECUTE FUNCTION update_invoice_paid_amount();

-- ─── EXPENSES ─────────────────────────────────────────────────
CREATE TABLE public.expenses (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id    UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  category     expense_category NOT NULL,
  description  TEXT NOT NULL,
  amount       NUMERIC(12,2) NOT NULL,
  date         DATE NOT NULL,
  paid_to      TEXT,
  method       payment_method,
  approved_by  UUID REFERENCES public.profiles(id),
  receipt_url  TEXT,
  notes        TEXT,
  deleted_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE INDEX idx_expenses_school_id ON public.expenses(school_id);
CREATE INDEX idx_expenses_date      ON public.expenses(school_id, date DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_expenses_category  ON public.expenses(school_id, category);

-- ─── PAYROLL ──────────────────────────────────────────────────
CREATE TABLE public.payroll (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id       UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  staff_id        UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  month           INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  year            INT NOT NULL,
  basic_salary    NUMERIC(12,2) NOT NULL,
  allowances      JSONB DEFAULT '{}',   -- { hra: 0, ta: 0, da: 0 }
  deductions      JSONB DEFAULT '{}',   -- { pf: 0, tds: 0, loan: 0 }
  gross_salary    NUMERIC(12,2) NOT NULL DEFAULT 0,
  net_salary      NUMERIC(12,2) NOT NULL,
  status          payroll_status NOT NULL DEFAULT 'draft',
  paid_at         TIMESTAMPTZ,
  payment_method  payment_method,
  transaction_ref TEXT,
  processed_by    UUID REFERENCES public.profiles(id),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(school_id, staff_id, month, year)
);
CREATE OR REPLACE FUNCTION set_payroll_gross_salary()
RETURNS TRIGGER AS $$
BEGIN
  NEW.gross_salary := NEW.basic_salary + COALESCE((
    SELECT SUM(v::numeric) FROM jsonb_each_text(NEW.allowances) AS t(k,v) WHERE v ~ '^\d'
  ), 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_payroll_gross
  BEFORE INSERT OR UPDATE OF basic_salary, allowances ON public.payroll
  FOR EACH ROW EXECUTE FUNCTION set_payroll_gross_salary();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.payroll
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE INDEX idx_payroll_school_id ON public.payroll(school_id);
CREATE INDEX idx_payroll_staff_id  ON public.payroll(staff_id);
CREATE INDEX idx_payroll_month_year ON public.payroll(school_id, year, month);
