-- ============================================================================
-- Fix payments idempotency and admin stats status filter
-- ============================================================================

-- Add updated_at for payment processing state tracking
ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Deduplicate provider order id to avoid unique index failure
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY provider, provider_order_id
      ORDER BY
        CASE WHEN UPPER(status) IN ('SUCCESS', 'COMPLETED', 'PAID') THEN 0 ELSE 1 END,
        created_at DESC,
        id DESC
    ) AS rn
  FROM public.payments
  WHERE provider_order_id IS NOT NULL
)
UPDATE public.payments AS p
SET provider_order_id = NULL,
    updated_at = NOW()
FROM ranked AS r
WHERE p.id = r.id
  AND r.rn > 1;

-- Ensure provider order id is unique per provider
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_provider_order_unique
ON public.payments (provider, provider_order_id)
WHERE provider_order_id IS NOT NULL;

-- Refresh payment stats view to include PAID/COMPLETED/SUCCESS
CREATE OR REPLACE VIEW public.v_payment_stats AS
SELECT
  source,
  DATE(created_at) as stat_date,
  COUNT(*) as payment_count,
  COUNT(DISTINCT user_id) as paying_users,
  SUM(amount) as total_amount,
  AVG(amount) as avg_amount,
  currency
FROM public.payments
WHERE UPPER(status) IN ('SUCCESS', 'COMPLETED', 'PAID')
GROUP BY source, DATE(created_at), currency
ORDER BY stat_date DESC;

-- Refresh admin stats function to align payment status filter
CREATE OR REPLACE FUNCTION public.get_admin_stats(
  p_source TEXT DEFAULT 'all',
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_start DATE;
  v_end DATE;
BEGIN
  v_start := COALESCE(p_start_date, CURRENT_DATE - INTERVAL '30 days');
  v_end := COALESCE(p_end_date, CURRENT_DATE);

  SELECT jsonb_build_object(
    'users', (
      SELECT jsonb_build_object(
        'total', COUNT(*),
        'new_today', COUNT(*) FILTER (WHERE DATE(created_at) = CURRENT_DATE),
        'new_this_week', COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'),
        'new_this_month', COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '30 days')
      )
      FROM public.profiles
      WHERE (p_source = 'all' OR source = p_source)
    ),
    'payments', (
      SELECT jsonb_build_object(
        'total_amount', COALESCE(SUM(amount), 0),
        'total_count', COUNT(*),
        'paying_users', COUNT(DISTINCT user_id),
        'today_amount', COALESCE(SUM(amount) FILTER (WHERE DATE(created_at) = CURRENT_DATE), 0)
      )
      FROM public.payments
      WHERE UPPER(status) IN ('SUCCESS', 'COMPLETED', 'PAID')
        AND (p_source = 'all' OR source = p_source)
    ),
    'subscriptions', (
      SELECT jsonb_build_object(
        'total', COUNT(*),
        'active', COUNT(*) FILTER (WHERE status = 'active'),
        'by_plan', (
          SELECT jsonb_object_agg(plan, cnt)
          FROM (
            SELECT plan, COUNT(*) as cnt
            FROM public.user_wallets
            WHERE (p_source = 'all' OR source = p_source)
            GROUP BY plan
          ) sub
        )
      )
      FROM public.subscriptions
      WHERE (p_source = 'all' OR source = p_source)
    ),
    'builds', (
      SELECT jsonb_build_object(
        'total', COUNT(*),
        'today', COUNT(*) FILTER (WHERE DATE(created_at) = CURRENT_DATE),
        'completed', COUNT(*) FILTER (WHERE status = 'completed'),
        'failed', COUNT(*) FILTER (WHERE status = 'failed')
      )
      FROM public.builds
      WHERE (p_source = 'all' OR source = p_source)
    ),
    'query_params', jsonb_build_object(
      'source', p_source,
      'start_date', v_start,
      'end_date', v_end,
      'generated_at', NOW()
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
