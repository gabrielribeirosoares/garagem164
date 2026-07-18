-- 1. Drop duplicate triggers from the first migration to prevent points from being added/subtracted twice
DROP TRIGGER IF EXISTS cars_add_points ON public.cars;
DROP TRIGGER IF EXISTS cars_subtract_points ON public.cars;
DROP TRIGGER IF EXISTS redemptions_deduct_points ON public.redemptions;
DROP TRIGGER IF EXISTS redemptions_status_update ON public.redemptions;

-- 2. Recalculate customer_points correctly for all users and stores
-- Formula: Points = (Sum of points of cars) - (Sum of cost of non-cancelled redemptions)
WITH calculated_points AS (
  SELECT 
    cp.user_id, 
    cp.store_id,
    COALESCE((
      SELECT SUM(c.points) 
      FROM public.cars c 
      WHERE c.user_id = cp.user_id AND c.store_id = cp.store_id
    ), 0) - COALESCE((
      SELECT SUM(r.cost) 
      FROM public.redemptions r 
      WHERE r.user_id = cp.user_id AND r.store_id = cp.store_id AND r.status <> 'cancelled'
    ), 0) as real_points
  FROM public.customer_points cp
)
UPDATE public.customer_points cp
SET points = GREATEST(cp_calc.real_points, 0)
FROM calculated_points cp_calc
WHERE cp.user_id = cp_calc.user_id AND cp.store_id = cp_calc.store_id;
