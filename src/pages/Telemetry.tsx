import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { GlassCard } from '@/components/layout/GlassCard';
import { TelemetryPanel } from '@/components/telemetry/TelemetryPanel';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useGlobalTelemetry } from '@/contexts/TelemetryContext';
import { useAuth } from '@/hooks/useAuth';
import { useLocalDb } from '@/hooks/useLocalDb';
import { supabase } from '@/integrations/supabase/client';
import { sendDiscordWebhook } from '@/lib/discord';
import { toast } from 'sonner';
import {
  Activity,
  Truck,
  Package,
  ArrowRight,
  CheckCircle,
  Zap,
  AlertTriangle,
  MapPin,
  DollarSign,
  Wrench
} from 'lucide-react';

export default function Telemetry() {
  const { user, isApproved, hasRole } = useAuth();
  const isDeveloper = hasRole('developer');
  const navigate = useNavigate();
  
  const { telemetry, logger } = useGlobalTelemetry();
  const { data, connected, isJobActive, raw } = telemetry;
  const { prepareJobData, currentJob, isLogging, startOdometer, stickyPlannedDistance } = logger;
  
  const { saveJobLocally, syncJobsToSupabase } = useLocalDb();
  const [saving, setSaving] = useState(false);
  const lastSyncedJobId = useRef<string | null>(null);
  const lastWebhookSentId = useRef<string | null>(null);

  const handleAutoLogJob = useCallback(async () => {
    if (!user || !isApproved) {
      toast.error('Approval required to log jobs');
      return;
    }

    const jobData = prepareJobData();
    if (!jobData) {
      toast.error('No active job data to log');
      return;
    }
    
    // Prevent duplicate syncs by tracking the jobId
    if (lastSyncedJobId.current === jobData.job_id) {
      toast.info('Job already logged or currently syncing.');
      return;
    }

    lastSyncedJobId.current = jobData.job_id;
    setSaving(true);
    try {
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
        notes: `Titan Omega V7.0 Auto-Log (Manual: ${jobData.status})`,
      };

      const savedLocally = await saveJobLocally(payload);
      if (!savedLocally) throw new Error('Local save failed');
      
      toast.success(`Manual push triggered. Saved as Offline Job!`);
      
      if (user?.user_metadata?.username && lastWebhookSentId.current !== jobData.job_id) {
        lastWebhookSentId.current = jobData.job_id;
        const avatarUrl = user.user_metadata.avatar_url || "https://i.imgur.com/34M1f0S.png";

        sendDiscordWebhook('job_completed', {
          username: user.user_metadata.username,
          avatar_url: avatarUrl,
          job_id: jobData.job_id,
          origin_city: jobData.origin_city,
          destination_city: jobData.destination_city,
          cargo_type: jobData.cargo_type,
          cargo_weight: jobData.cargo_weight,
          truck_name: `${data?.truck?.brand || jobData.truck_name} ${data?.truck?.name || ''}`.trim(),
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

      syncJobsToSupabase();
    } catch (err) {
      console.error('Manual Log Error:', err);
      toast.error('Failed to log job locally.');
    } finally {
      setSaving(false);
    }
  }, [user, isApproved, prepareJobData]);

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold gradient-text flex items-center gap-3">
              <Activity size={32} className="text-primary" />
              Titan Omega
            </h1>
            <p className="text-muted-foreground mt-1">
              {connected ? `${data.truck.brand} ${data.truck.name} Dashboard Ready` : 'Awaiting Titan DLL Connection...'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className={connected ? 'bg-primary/20 text-primary border-primary/40' : 'bg-muted'}>
              {connected ? <><div className="w-2 h-2 rounded-full bg-primary mr-2 animate-pulse" /> 186 Channels Active</> : 'Offline'}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <TelemetryPanel />
          </div>

          <div className="space-y-4">
            <GlassCard className="relative overflow-hidden">
              {isJobActive && <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 animate-pulse" />}
              <div className="flex items-center gap-3 mb-4 relative z-10">
                <div className="p-2 rounded-lg bg-accent/20"><Zap size={20} className="text-accent" /></div>
                <div>
                  <h3 className="font-semibold">VTC Auto-Logger</h3>
                  <p className="text-xs text-muted-foreground">Direct-to-Database Sync</p>
                </div>
              </div>

              {!connected ? (
                <div className="text-center py-6 text-muted-foreground opacity-50"><AlertTriangle size={32} className="mx-auto mb-2" /><p className="text-sm">Connect Game</p></div>
              ) : !isJobActive ? (
                <div className="text-center py-6 text-muted-foreground opacity-50"><Package size={32} className="mx-auto mb-2" /><p className="text-sm">Ready for Job</p></div>
              ) : (
                <div className="space-y-4 relative z-10">
                  <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 space-y-2">
                    <div className="flex items-center gap-2 text-sm font-bold">
                      <MapPin size={14} className="text-primary" />
                      <span className="truncate">{currentJob?.source || 'Origin'}</span>
                      <ArrowRight size={14} className="mx-1" />
                      <span className="truncate">{currentJob?.destination || 'Destination'}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-[10px] uppercase font-bold text-muted-foreground">
                      <div className="flex items-center gap-1"><Package size={10} /><span className="truncate">{currentJob?.cargo}</span></div>
                      <div className="flex items-center gap-1"><DollarSign size={10} /><span>${currentJob?.income?.toLocaleString()}</span></div>
                      <div className="flex items-center gap-1 text-primary"><Zap size={10} /><span>{((data.truck.dash.odometer - (startOdometer || data.truck.dash.odometer)) || 0).toFixed(1)} km</span></div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Button onClick={() => navigate('/log-job', { state: { telemetryData: prepareJobData() } })} variant="outline" className="w-full rounded-full gap-2 border-primary/30"><Truck size={16} /> Fill Form</Button>
                    <Button onClick={handleAutoLogJob} disabled={saving || !isApproved} className="w-full rounded-full neon-glow gap-2">
                      {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <CheckCircle size={16} />}
                      Log to VTC
                    </Button>
                  </div>
                </div>
              )}
            </GlassCard>
            
            {isDeveloper && connected && (
              <GlassCard className="max-h-[500px] flex flex-col">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-primary/20"><Wrench size={20} className="text-primary" /></div>
                  <div>
                    <h3 className="font-semibold">Raw SDK Buffer</h3>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold">{data.game.pluginVersion} // 186 CHANNELS</p>
                  </div>
                </div>
                <div className="flex-1 overflow-auto bg-black/40 rounded-xl p-3 border border-white/5 font-mono text-[10px] text-green-500/80 custom-scrollbar">
                  <pre>{JSON.stringify(raw || data, null, 2)}</pre>
                </div>
              </GlassCard>
            )}
          </div>
        </div>
      </div>
    </>
  );
}