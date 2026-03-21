import { useCallback, useState, useRef } from 'react';
import Database from '@tauri-apps/plugin-sql';
import { supabase } from '@/integrations/supabase/client';

export interface LocalJob {
  id: string; // The job_id or a local guid
  job_data: string; // JSON string of the prepared job data
  synced: number; // 0 for false, 1 for true
  completed_at: string;
}

// Ensure unique instance of DB
let dbInstance: Database | null = null;

export function useLocalDb() {
  const [isSyncing, setIsSyncing] = useState(false);

  const initDb = async () => {
    if (dbInstance) return dbInstance;
    try {
      const db = await Database.load('sqlite:aura_logs.db');
      await db.execute(`
        CREATE TABLE IF NOT EXISTS job_logs_queue (
          id TEXT PRIMARY KEY,
          job_data TEXT,
          synced INTEGER DEFAULT 0,
          completed_at TEXT
        )
      `);
      dbInstance = db;
      return db;
    } catch (e) {
      console.error('Titan Omega: Failed to initialize local SQLite DB:', e);
      return null;
    }
  };

  const saveJobLocally = useCallback(async (jobData: Record<string, any>) => {
    const db = await initDb();
    if (!db) return false;

    try {
      const jobId = jobData.job_id;
      const jobJson = JSON.stringify(jobData);
      const timestamp = new Date().toISOString();

      await db.execute(
        `INSERT OR REPLACE INTO job_logs_queue (id, job_data, synced, completed_at) 
         VALUES ($1, $2, 0, $3)`,
        [jobId, jobJson, timestamp]
      );
      
      console.log(`[Offline Sync] Job ${jobId} saved securely to local DB.`);
      return true;
    } catch (e) {
      console.error('Titan Omega: Failed to save job locally:', e);
      return false;
    }
  }, []);

  const isSyncingRef = useRef(false);

  const syncJobsToSupabase = useCallback(async () => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;
    setIsSyncing(true);

    const db = await initDb();
    if (!db) {
      setIsSyncing(false);
      return;
    }

    try {
      const pendingJobs = await db.select<LocalJob[]>(
        'SELECT * FROM job_logs_queue WHERE synced = 0'
      );

      if (pendingJobs.length === 0) {
        setIsSyncing(false);
        return; // Nothing to sync
      }

      console.log(`[Offline Sync] Found ${pendingJobs.length} jobs to push to Supabase.`);

      for (const job of pendingJobs) {
        try {
          // Auto-cleanup legacy non-UUID jobs that are stuck in the SQLite queue
          if (job.id.length !== 36) {
            console.warn(`[Offline Sync] Dropping stuck legacy job: ${job.id}`);
            await db.execute('DELETE FROM job_logs_queue WHERE id = $1', [job.id]);
            continue;
          }

          const rawJob = JSON.parse(job.job_data);
          
          const supabasePayload = {
            id: rawJob.job_id,
            user_id: rawJob.user_id,
            origin_city: rawJob.origin_city,
            destination_city: rawJob.destination_city,
            distance_km: rawJob.distance_km,
            cargo_type: rawJob.cargo_type,
            cargo_weight: rawJob.cargo_weight,
            fuel_consumed: rawJob.fuel_consumed,
            income: rawJob.income,
            expenses: rawJob.expenses,
            damage_percent: rawJob.damage_percent,
            notes: rawJob.notes,
            delivery_date: rawJob.delivery_date,
            job_id: rawJob.job_id,
            planned_distance_km: rawJob.planned_distance_km,
            status: rawJob.status,
            revenue: rawJob.revenue,
            xp_earned: rawJob.xp_earned,
            auto_park: rawJob.auto_park,
            auto_load: rawJob.auto_load,
            fine_amount: rawJob.fine_amount,
            job_market: rawJob.job_market,
            mp_time_offset: rawJob.mp_time_offset,
            truck_id: rawJob.truck_id,
            truck_name: rawJob.truck_name,
            trailer_id: rawJob.trailer_id,
            avg_fuel_consumption: rawJob.avg_fuel_consumption,
            is_special_transport: rawJob.is_special_transport
          };
          
          const { error } = await supabase
            .from('job_logs')
            .upsert(supabasePayload, { onConflict: 'id' });

          if (error) {
            console.error(`Failed to sync job ${job.id} to Supabase:`, error);
          } else {
            console.log(`Job ${job.id} synced successfully.`);
            // Mark as synced locally
            await db.execute(
              'UPDATE job_logs_queue SET synced = 1 WHERE id = $1',
              [job.id]
            );
          }
        } catch (jobErr) {
          console.error(`Error processing local job ${job.id}:`, jobErr);
        }
      }
    } catch (e) {
      console.error('Titan Omega: Batch sync failed:', e);
    } finally {
      isSyncingRef.current = false;
      setIsSyncing(false);
    }
  }, []);

  return {
    saveJobLocally,
    syncJobsToSupabase,
    isSyncing
  };
}
