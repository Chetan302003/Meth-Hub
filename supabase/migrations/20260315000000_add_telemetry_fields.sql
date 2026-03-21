-- Migration to add job_id and related fields to job_logs for telemetry auto-logging
ALTER TABLE public.job_logs 
ADD COLUMN IF NOT EXISTS job_id TEXT,
ADD COLUMN IF NOT EXISTS planned_distance_km DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'delivered';

-- Add unique constraint for idempotent upserts from telemetry
-- This allows the app to send the same job multiple times safely
ALTER TABLE public.job_logs
ADD CONSTRAINT job_logs_user_id_job_id_key UNIQUE (user_id, job_id);

-- Explicitly index job_id for performance
CREATE INDEX IF NOT EXISTS idx_job_logs_job_id ON public.job_logs(job_id);
