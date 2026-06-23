import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useTelemetry, useAutoJobLogger } from '@/hooks/useTelemetry';
import { useLocalDb } from '@/hooks/useLocalDb';
import { sendDiscordWebhook } from '@/lib/discord';
import { trackEvent } from "@/lib/aptabase";
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useQueryClient } from '@tanstack/react-query';
import * as Sentry from '@sentry/react';

const TelemetryContext = createContext<any>(null);

export function TelemetryProvider({ children }: { children: React.ReactNode }) {
  const { user, isApproved } = useAuth();
  const telemetry = useTelemetry();
  const logger = useAutoJobLogger();
  const queryClient = useQueryClient();

  const { saveJobLocally, syncJobsToSupabase } = useLocalDb();
  const isSavingRef = useRef(false);
  const lastSyncedJobId = useRef<string | null>(null);
  const lastWebhookSentId = useRef<string | null>(null);

  useEffect(() => {
    const autoSync = async () => {
      if (logger.isLogging && user && isApproved && !isSavingRef.current) {
        isSavingRef.current = true;
        const jobData = logger.prepareJobData();

        if (!jobData || lastSyncedJobId.current === jobData.job_id) {
          isSavingRef.current = false;
          return;
        }

        try {
          console.log(' Titan Omega: Finalizing Sync for Job:', jobData.job_id, 'Status:', jobData.status);
          lastSyncedJobId.current = jobData.job_id;

          // Sentry: Capture diagnostic snapshot when a delivered job logs with 0 distance
          if (jobData.distance_km === 0 && jobData.status === 'delivered') {
            Sentry.captureMessage('Zero Distance Job Logged (AutoSync)', {
              level: 'warning',
              extra: {
                job_id: jobData.job_id,
                origin: jobData.origin_city,
                destination: jobData.destination_city,
                planned_distance_km: jobData.planned_distance_km,
                distance_km: jobData.distance_km,
                cargo_type: jobData.cargo_type,
                fuel_consumed: jobData.fuel_consumed,
                duration_seconds: jobData.duration_seconds,
                had_reconnect: jobData.had_reconnect,
                reconnect_count: jobData.reconnect_count,
                used_ferry: jobData.used_ferry,
                startOdometer: logger.startOdometer,
                stickyPlannedDistance: logger.stickyPlannedDistance,
                pendingJob: logger.pendingJob,
                liveOdometer: telemetry.data?.truck?.dash?.odometer,
                liveJobActive: telemetry.data?.job?.active,
                liveJobDistanceKm: telemetry.data?.job?.distanceKm,
                liveNavDistance: telemetry.data?.truck?.navigation?.distance,
                gameConnected: telemetry.connected,
              }
            });
            console.warn('Titan Omega: SENTRY WARNING — Zero distance delivered job detected. Snapshot sent.');
          }

          const payload = {
            user_id: user.id,
            job_id: jobData.job_id,
            origin_city: jobData.origin_city,
            destination_city: jobData.destination_city,
            planned_distance_km: jobData.planned_distance_km,
            distance_km: jobData.distance_km,
            cargo_type: jobData.cargo_type,
            cargo_weight: jobData.cargo_weight,
            fuel_consumed: jobData.fuel_consumed,
            income: jobData.income,
            revenue: jobData.revenue,
            xp_earned: jobData.xp_earned,
            expenses: jobData.expenses,
            damage_percent: jobData.damage_percent,
            status: jobData.status,
            delivery_date: jobData.delivery_date,
            fine_amount: jobData.fine_amount,
            job_market: jobData.job_market,
            mp_time_offset: jobData.mp_time_offset,
            truck_id: jobData.truck_id,
            truck_name: jobData.truck_name,
            trailer_id: jobData.trailer_id,
            avg_fuel_consumption: jobData.avg_fuel_consumption,
            is_special_transport: jobData.is_special_transport,
            auto_park: jobData.auto_park,
            auto_load: jobData.auto_load,
            had_reconnect: jobData.had_reconnect || false,
            reconnect_count: jobData.reconnect_count || 0,
            used_ferry: jobData.used_ferry || false,
            toll_amount: jobData.toll_amount || 0,
            repair_amount: jobData.repair_amount || 0,
            ferry_amount: jobData.ferry_amount || 0,
            train_amount: jobData.train_amount || 0,
            notes: `Titan Omega V7.0 Auto-Log (${jobData.status})`,
          };

          const savedLocally = await saveJobLocally(payload);

          if (!savedLocally) {
            throw new Error('Failed to save to SQLite blockchain');
          }

          console.log(' Titan Omega: Job Offline Save Success:', jobData.job_id);
          toast.success(`Job Saved Locally: ${jobData.origin_city} to ${jobData.destination_city}`);

          trackEvent(`job_${jobData.status === 'delivered' ? 'completed' : 'cancelled'}`, {
            job_id: jobData.job_id,
            origin: jobData.origin_city,
            destination: jobData.destination_city,
            distance: jobData.distance_km,
            revenue: jobData.revenue
          });

          if (user?.user_metadata?.username && lastWebhookSentId.current !== jobData.job_id) {
            lastWebhookSentId.current = jobData.job_id;
            const avatarUrl = user.user_metadata.avatar_url || "https://i.ibb.co/wNRBF3zj/logo-png.png";

            sendDiscordWebhook('job_completed', {
              username: user.user_metadata.username,
              avatar_url: avatarUrl,
              job_id: jobData.job_id,
              origin_city: jobData.origin_city,
              destination_city: jobData.destination_city,
              cargo_type: jobData.cargo_type,
              cargo_weight: jobData.cargo_weight,
              truck_name: `${telemetry.data?.truck?.brand || jobData.truck_name} ${telemetry.data?.truck?.name || ''}`.trim(),
              planned_distance_km: jobData.planned_distance_km,
              started_at: jobData.started_at,
              duration_seconds: jobData.duration_seconds,
              distance_km: jobData.distance_km,
              revenue: jobData.revenue,
              fuel_consumed: jobData.fuel_consumed,
              avg_fuel_consumption: jobData.avg_fuel_consumption,
              expenses: jobData.expenses,
              xp_earned: jobData.xp_earned,
              damage_percent: jobData.damage_percent,
              status: jobData.status,
            });
          }

          await syncJobsToSupabase();

          queryClient.invalidateQueries({ queryKey: ['personalStats'] });
          queryClient.invalidateQueries({ queryKey: ['fleetStats'] });
          queryClient.invalidateQueries({ queryKey: ['weeklyData'] });
          queryClient.invalidateQueries({ queryKey: ['fleetLeaderboard'] });
        } catch (err) {
          console.error('Auto-Log Error:', err);
          toast.error('Auto-sync failed. Please check My Stats later.');
        } finally {
          isSavingRef.current = false;
        }
      }
    };
    autoSync();
  }, [logger.isLogging, user, isApproved, logger.prepareJobData, telemetry.data, saveJobLocally, syncJobsToSupabase, queryClient]);

  return (
    <TelemetryContext.Provider value={{ telemetry, logger }}>
      {children}
    </TelemetryContext.Provider>
  );
}

export const useGlobalTelemetry = () => useContext(TelemetryContext);
