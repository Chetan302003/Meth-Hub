-- Enhanced Telemetry Schema for high-detail job logging
ALTER TABLE public.job_logs
ADD COLUMN IF NOT EXISTS truck_id TEXT,
ADD COLUMN IF NOT EXISTS truck_name TEXT,
ADD COLUMN IF NOT EXISTS trailer_id TEXT,
ADD COLUMN IF NOT EXISTS engine_damage_percent DECIMAL(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS transmission_damage_percent DECIMAL(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS chassis_damage_percent DECIMAL(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS wheels_damage_percent DECIMAL(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS trailer_damage_percent DECIMAL(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS avg_fuel_consumption DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_special_transport BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS job_market TEXT;

-- Update the view or index if necessary
COMMENT ON COLUMN public.job_logs.engine_damage_percent IS 'Specific engine wear captured from DLL V2';
