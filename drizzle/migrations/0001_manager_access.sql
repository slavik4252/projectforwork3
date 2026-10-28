CREATE TABLE public.managers (
  email text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.managers TO authenticated;
GRANT ALL ON public.managers TO service_role;
ALTER TABLE public.managers ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_manager()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.managers WHERE email = lower(auth.jwt()->>'email'))
$$;

CREATE POLICY managers_select ON public.managers FOR SELECT TO authenticated USING (public.is_manager());
CREATE POLICY managers_insert ON public.managers FOR INSERT TO authenticated WITH CHECK (public.is_manager() AND email = lower(email));
CREATE POLICY managers_delete ON public.managers FOR DELETE TO authenticated USING (public.is_manager() AND email <> lower(auth.jwt()->>'email'));

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['leads','deals','notes','activities','chat_sessions','chat_messages'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS public_select_%1$s ON public.%1$s', t);
    EXECUTE format('DROP POLICY IF EXISTS public_insert_%1$s ON public.%1$s', t);
    EXECUTE format('DROP POLICY IF EXISTS public_update_%1$s ON public.%1$s', t);
    EXECUTE format('DROP POLICY IF EXISTS public_delete_%1$s ON public.%1$s', t);
    EXECUTE format('CREATE POLICY manager_all_%1$s ON public.%1$s FOR ALL TO authenticated USING (public.is_manager()) WITH CHECK (public.is_manager())', t);
  END LOOP;
END $$;

-- Visitors may only submit new rows, with safe defaults
CREATE POLICY visitor_insert_leads ON public.leads FOR INSERT TO anon, authenticated
  WITH CHECK (status = 'new' AND length(contact) BETWEEN 1 AND 500 AND length(name) <= 200 AND length(note) <= 2000);
CREATE POLICY visitor_insert_chat_sessions ON public.chat_sessions FOR INSERT TO anon, authenticated
  WITH CHECK (status = 'active' AND lead_id IS NULL);
CREATE POLICY visitor_insert_chat_messages ON public.chat_messages FOR INSERT TO anon, authenticated
  WITH CHECK (role IN ('user','assistant') AND length(content) BETWEEN 1 AND 8000);
REVOKE SELECT, UPDATE, DELETE ON public.leads, public.deals, public.notes, public.activities, public.chat_sessions, public.chat_messages FROM anon;
REVOKE INSERT ON public.deals, public.notes, public.activities FROM anon;