import { useState } from 'react';
import { GlassCard } from '@/components/layout/GlassCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useTelemetry, useAutoJobLogger } from '@/hooks/useTelemetry';
import { useGlobalTelemetry } from '@/contexts/TelemetryContext';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import {
  Truck,
  Fuel,
  Gauge,
  Navigation as NavIcon,
  Package,
  MapPin,
  WifiOff,
  Play,
  Pause,
  ArrowRight,
  Wrench,
  Activity,
  Zap,
  DollarSign,
  LampFloor,
  Lamp,
  Siren,
  TriangleAlert,
  Flashlight,
  SquareActivity
} from 'lucide-react';

export function TelemetryPanel() {
  const { telemetry, logger } = useGlobalTelemetry();
  const { data, connected, isJobActive, raw } = telemetry;
  const { hasRole } = useAuth();
  const { stickyPlannedDistance, usedFerryOrTrain, teleportDetected } = logger;
  const isDeveloper = hasRole('developer');
  const { toast } = useToast();
  const [isInstalling, setIsInstalling] = useState(false);
  const [showRaw, setShowRaw] = useState(false);

  const handleInstallPlugin = async () => {
    if (!isTauri()) {
      toast({ variant: 'destructive', title: 'Desktop Required', description: 'Use Aura Desktop to install plugins.' });
      return;
    }
    setIsInstalling(true);
    try {
      const response = await invoke('install_telemetry_plugin', { customPath: null });
      toast({ title: 'Success!', description: response as string });
    } catch (err: any) {
      if (err === 'GAME_NOT_FOUND') {
        const selected = await open({ directory: true, multiple: false, title: 'Select ETS2 Folder', notes: `Titan Omega V5.0 Auto-Log` });
        if (selected) {
          try {
            const response = await invoke('install_telemetry_plugin', { customPath: selected });
            toast({ title: 'Success!', description: response as string });
          } catch (retryErr) { toast({ variant: 'destructive', title: 'Failed', description: 'Installation failed.' }); }
        }
      }
    } finally { setIsInstalling(false); }
  };

  const formatSpeed = (speed: number) => Math.round(speed);
  const formatDistance = (m: number) => (m / 1000).toFixed(1);
  const formatFuel = (liters: number) => Math.round(liters);

  const formatDuration = (seconds: number) => {
    if (seconds <= 0) return "--:--";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h > 0 ? h + 'h ' : ''}${m}m`;
  };

  const jobPlannedKm = isJobActive && data.job ? (data.job.plannedDistance > 0 ? data.job.plannedDistance : (stickyPlannedDistance || 0)) : 0;
  const jobRemainingKm = data.truck.navigation.distance / 1000;
  const jobProgressPercent = jobPlannedKm > 0 ? Math.max(0, Math.min(100, ((jobPlannedKm - jobRemainingKm) / jobPlannedKm) * 100)) : 0;

  return (
    <div className="space-y-4">
      <GlassCard className="p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {connected ? (
            <Badge variant="outline" className={data.game.connected && !data.game.paused ? 'bg-primary/20 text-primary border-primary/40' : 'bg-yellow-500/20 text-yellow-500 border-yellow-500/40'}>
              {data.game.connected && !data.game.paused ? <><Play size={10} className="mr-1" /> Omega Live (V5.0)</> : <><Pause size={10} className="mr-1" /> Paused</>}
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20"><WifiOff size={10} className="mr-1" /> Disconnected</Badge>
          )}
          {connected && <Badge variant="outline" className="bg-muted text-[10px] uppercase font-mono tracking-widest px-3 py-1">{data.truck.brand} {data.truck.name}</Badge>}
        </div>
        {!connected && (
          <Button variant="default" size="sm" onClick={handleInstallPlugin} disabled={isInstalling} className="rounded-full neon-glow font-medium">
            {isInstalling ? <><div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" /> Mapping 168 Channels...</> : <><Wrench size={14} className="mr-1" /> Initialize Titan Omega</>}
          </Button>
        )}
      </GlassCard>

      <GlassCard>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/20"><Truck size={20} className="text-primary" /></div>
            <div>
              <p className="font-bold text-lg uppercase tracking-tight">{data.truck.brand} {data.truck.name}</p>
              <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">{data.truck.licensePlate || 'TITAN PROTOCOL'}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground uppercase font-bold tracking-widest">Odometer</p>
            <p className="text-xl font-black italic">{Math.round(data.truck.dash.odometer).toLocaleString()} km</p>
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatBox icon={<Gauge size={20} />} label="Speed" value={formatSpeed(data.truck.dash.speed)} unit="km/h" />
          <StatBox icon={<Fuel size={20} />} label="Fuel" value={`${formatFuel(data.truck.dash.fuel)} / ${formatFuel(data.truck.dash.fuelCapacity || 0)}`} unit="L" isCritical={data.truck.dash.fuelWarning} />
          <StatBox icon={<Activity size={20} className="text-primary" />} label="RPM" value={Math.round(data.truck.dash.rpm)} unit="R" />
          <StatBox icon={<Zap size={16} />} label="Gear" value={data.truck.dash.displayedGear === 0 ? 'N' : data.truck.dash.displayedGear < 0 ? `R${Math.abs(data.truck.dash.displayedGear)}` : data.truck.dash.displayedGear} unit="" />
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
          <StatBox icon={<Wrench size={18} />} label="Water Temp" value={Math.round(data.truck.dash.waterTemp)} unit="°C" isCritical={data.truck.dash.waterTemp > 100} />
          <StatBox icon={<Activity size={18} />} label="Oil Temp" value={Math.round(data.truck.dash.oilTemp)} unit="°C" isCritical={data.truck.dash.oilTemp > 110} />
          <StatBox icon={<Fuel size={18} />} label="Avg Fuel" value={data.truck.dash.avgFuelConsumption.toFixed(1)} unit="L/100" />
          <StatBox icon={<Zap size={18} />} label="Fuel Range" value={Math.round(data.truck.dash.fuelRange)} unit="km" isCritical={data.truck.dash.fuelRange < 100} />
        </div>
        <div className="mt-8 pt-6 border-t border-white/5 grid grid-cols-6 gap-2">
          <HealthItem label="Engine" value={data.truck.damage.engine} showPercent />
          <HealthItem label="Trans." value={data.truck.damage.transmission} showPercent />
          <HealthItem label="Cabin" value={data.truck.damage.cabin} showPercent />
          <HealthItem label="Chassis" value={data.truck.damage.chassis} showPercent />
          <HealthItem label="Wheels" value={data.truck.damage.wheels} showPercent />
          <HealthItem label="Total" value={data.truck.damage.total} showPercent isTotal />
        </div>
      </GlassCard>

      {isJobActive && data.job ? (
        <GlassCard className="bg-primary/5 border-primary/20">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/20"><Package size={20} className="text-primary" /></div>
              <div>
                <p className="font-bold text-sm uppercase tracking-tight">{data.job.cargo}</p>
                <p className="text-[10px] text-muted-foreground uppercase font-bold">Titan Direct Delivery</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {usedFerryOrTrain && (
                <Badge className="bg-blue-500/20 text-blue-500 border-blue-500/40 uppercase text-[9px] font-black" variant="outline">
                  Ferry Used
                </Badge>
              )}
              {teleportDetected && (
                <Badge className="bg-orange-500/20 text-orange-500 border-orange-500/40 uppercase text-[9px] font-black" variant="outline">
                  Jump Detected
                </Badge>
              )}
              <Badge className="bg-primary/20 text-primary uppercase text-[9px] font-black">Active</Badge>
            </div>
          </div>
          <div className="flex items-center gap-2 mb-6 text-sm font-bold italic">
            <MapPin size={14} className="text-primary" /><span>{data.job.source}</span>
            <ArrowRight size={14} className="text-muted-foreground mx-1" /><span>{data.job.destination}</span>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <JobStat label="Income" value={`$${data.job.income.toLocaleString()}`} />
            <JobStat label="Planned" value={`${(data.job.plannedDistance > 0 ? data.job.plannedDistance : (stickyPlannedDistance || 0)).toFixed(0)} km`} />
            <JobStat label="Weight" value={`${(data.job.cargoMass / 1000).toFixed(1)} t`} />
            <JobStat label="Cargo Damage" value={`${data.job.progress.toFixed(1)}%`} isCritical={data.job.progress > 2} />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="p-3 rounded-xl bg-black/20 border border-white/5 flex flex-col items-center justify-center">
              <p className="text-xs text-muted-foreground uppercase font-bold tracking-widest mb-1">Time to Destination</p>
              <div className="flex items-center gap-2">
                <NavIcon size={14} className="text-primary" />
                <p className="text-lg font-black italic">{formatDuration(data.truck.navigation.time)}</p>
              </div>
            </div>
            <div className="p-3 rounded-xl bg-black/20 border border-white/5 flex flex-col items-center justify-center">
              <p className="text-xs text-muted-foreground uppercase font-bold tracking-widest mb-1">Distance Remaining</p>
              <div className="flex items-center gap-2">
                <MapPin size={14} className="text-primary" />
                <p className="text-lg font-black italic">{(data.truck.navigation.distance / 1000).toFixed(1)} km</p>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <Progress value={jobProgressPercent} className="h-1.5" />
          </div>
        </GlassCard>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <GlassCard className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <DollarSign size={16} className="text-emerald-500" />
            <span className="text-[10px] uppercase font-black tracking-widest">Session Financials</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <MiniFinance label="Tolls" val={data.events.tollAmount.toLocaleString()} color="text-blue-400" />
            <MiniFinance label="Ferry/Train" val={(data.events.ferryAmount + data.events.trainAmount).toLocaleString()} color="text-indigo-400" />
            <MiniFinance label="Repairs" val={data.events.repairAmount.toLocaleString()} color="text-rose-400" />
          </div>
        </GlassCard>

        <GlassCard className="p-4 overflow-hidden relative group">
          <div className="flex items-center gap-2 mb-4 relative z-10">
            <div className="p-1.5 rounded-md bg-amber-500/20">
              <Package size={14} className="text-amber-500" />
            </div>
            <span className="text-[10px] uppercase font-black tracking-widest text-white/90">Trailer Configuration</span>
          </div>

          <div className="space-y-3 relative z-10">
            {data.trailer.length > 0 ? data.trailer.map((t, idx) => (
              <div key={idx} className="bg-black/30 rounded-xl p-3 border border-white/5 hover:border-amber-500/30 transition-all duration-300">
                <div className="flex justify-between items-start mb-2">
                  <div className="max-w-[70%]">
                    <h4 className="text-[11px] font-black uppercase italic tracking-tight truncate leading-none">
                      {t.brand && t.brand !== 'Standard' ? `${t.brand} ` : ''}{t.bodyType}
                    </h4>
                    <p className="text-[8px] text-muted-foreground font-mono uppercase tracking-tighter mt-1 truncate opacity-60">
                      {t.id.replace('vehicle.', '')}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-[8px] h-4 px-1.5 bg-white/5 border-white/10 text-white/60 font-mono tracking-tighter">
                    {t.licensePlate || 'NO PLATE'}
                  </Badge>
                </div>

                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 text-[8px] text-white/40 uppercase font-bold tracking-tight">
                      <Zap size={8} className="text-amber-500/50" />
                      <span>{t.chainType}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-[9px]">
                    <span className={`font-black italic ${t.damage > 5 ? 'text-rose-500' : 'text-primary'}`}>
                      {t.damage.toFixed(1)}%
                    </span>
                    <span className="text-[8px] text-white/30 uppercase font-bold tracking-widest">Wear</span>
                  </div>
                </div>

                <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${t.damage > 10 ? 'bg-rose-500' : 'bg-primary'}`}
                    style={{ width: `${Math.min(100, t.damage)}%` }}
                  />
                </div>
              </div>
            )) : (
              <div className="flex flex-col items-center justify-center py-8 border border-dashed border-white/5 rounded-xl bg-black/10 transition-all">
                <div className="p-3 rounded-full bg-white/5 mb-2 opacity-20">
                  <Package size={20} className="text-white" />
                </div>
                <p className="text-[10px] text-white/30 uppercase font-black tracking-widest animate-pulse">Awaiting Attachment</p>
              </div>
            )}
          </div>
        </GlassCard>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <GlassCard className="p-4">
          <div className="flex flex-wrap gap-2">
            <StatusIndicator label="Low" icon={<LampFloor size={14} />} active={data.truck.lights.lowBeam} />
            <StatusIndicator label="High" icon={<Lamp size={14} />} active={data.truck.lights.highBeam} />
            <StatusIndicator label="Beacon" icon={<Siren size={14} />} active={data.truck.lights.beacon} />
            <StatusIndicator label="Hazard" icon={<TriangleAlert size={14} />} active={data.truck.lights.hazard} />
            <StatusIndicator label="Aux F" icon={<Flashlight size={14} />} active={data.truck.lights.auxFront > 0} />
            <StatusIndicator label="Aux R" icon={<SquareActivity size={14} />} active={data.truck.lights.auxRoof > 0} />
          </div>
        </GlassCard>
        <GlassCard className="p-4 grid grid-cols-2 gap-2">
          <MiniVal label="Throttle" val={data.truck.inputs.throttle.toFixed(0)} unit="%" />
          <MiniVal label="Brake" val={data.truck.inputs.brake.toFixed(0)} unit="%" />
          <MiniVal
            label="Air"
            val={data.truck.dash.airPressure.toFixed(1)}
            unit="psi"
            isCritical={data.truck.dash.airPressure < 60}
          />
          <MiniVal
            label="Batt"
            val={data.truck.dash.batteryVoltage.toFixed(1)}
            unit="v"
            isCritical={data.truck.dash.batteryVoltage < 11.5 || data.truck.dash.batteryVoltage > 15.5}
          />
        </GlassCard>
      </div>

      <div className="flex justify-center mt-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowRaw(!showRaw)}
          className="text-[10px] uppercase font-bold tracking-widest opacity-50 hover:opacity-100"
        >
          {showRaw ? 'Hide Raw Stream' : 'Show Raw Stream'}
        </Button>
      </div>

      {showRaw && (
        <GlassCard className="p-4 bg-black/40 border-white/5 font-mono text-[10px] overflow-hidden">
          <div className="flex justify-between items-center mb-2">
            <span className="text-muted-foreground uppercase tracking-widest">Raw Telemetry Stream</span>
            <Badge variant="outline" className="text-[8px] bg-primary/10 border-primary/20 text-primary">Live</Badge>
          </div>
          <div className="max-h-[400px] overflow-auto custom-scrollbar">
            <pre className="text-primary/70 whitespace-pre-wrap break-all leading-relaxed">
              {raw ? JSON.stringify(raw, null, 2) : 'Awaiting data from Titan Protocol...'}
            </pre>
          </div>
        </GlassCard>
      )}
    </div>
  );
}

function StatBox({ icon, label, value, unit, isCritical = false }: { icon: React.ReactNode, label: string, value: string | number, unit: string, isCritical?: boolean }) {
  return (
    <div className="bg-white/5 border border-white/5 rounded-2xl p-4 text-center">
      <div className={`mx-auto mb-2 ${isCritical ? 'text-rose-500' : 'text-primary'}`}>{icon}</div>
      <p className="text-2xl font-black italic tracking-tighter">{value}<span className="text-xs ml-1 opacity-40">{unit}</span></p>
      <p className="text-[9px] uppercase font-bold text-muted-foreground tracking-widest">{label}</p>
    </div>
  );
}

function StatusIndicator({ label, icon, active }: { label: string, icon?: React.ReactNode, active: boolean }) {
  return (
    <div className={`flex flex-col items-center justify-center p-2 rounded flex-1 min-w-[60px] border transition-all ${active ? 'bg-primary/20 text-primary border-primary/40 shadow-[0_0_10px_rgba(0,255,136,0.3)]' : 'bg-black/20 text-white/20 border-white/5'}`}>
      {icon && <div className="mb-1.5">{icon}</div>}
      <span className="text-[8px] font-black uppercase tracking-widest">{label}</span>
    </div>
  );
}

function MiniVal({ label, val, unit, isCritical = false }: { label: string, val: string, unit: string, isCritical?: boolean }) {
  return (
    <div className={`flex justify-between text-[9px] uppercase font-bold ${isCritical ? 'text-rose-500' : ''}`}>
      <span className="text-muted-foreground">{label}</span>
      <span>{val}{unit}</span>
    </div>
  );
}

function MiniFinance({ label, val, color }: { label: string, val: string, color: string }) {
  return (
    <div className="flex flex-col items-center p-2 rounded-lg bg-black/20 border border-white/5">
      <span className="text-[8px] text-muted-foreground uppercase font-black">{label}</span>
      <span className={`text-[10px] font-bold ${color}`}>${val}</span>
    </div>
  );
}

function HealthItem({ label, value, showPercent = false, isTotal = false }: { label: string, value: number, showPercent?: boolean, isTotal?: boolean }) {
  return (
    <div className="text-center">
      <div className="h-1 bg-white/5 rounded-full overflow-hidden mb-1">
        <div
          className={`h-full ${isTotal ? 'bg-accent' : value > 50 ? 'bg-destructive' : 'bg-primary'}`}
          style={{ width: `${Math.min(100, value).toFixed(0)}%` }}
        />
      </div>
      <p className={`text-[8px] uppercase font-bold ${isTotal ? 'text-accent' : 'text-muted-foreground'}`}>{label}</p>
      {showPercent && <p className="text-[10px] font-black">{value.toFixed(1)}%</p>}
    </div>
  );
}

function JobStat({ label, value, isCritical = false }: { label: string, value: string, isCritical?: boolean }) {
  return (
    <div className={`text-center p-3 rounded-xl bg-black/20 border border-white/5 ${isCritical ? 'border-rose-500/50' : ''}`}>
      <p className={`text-sm font-black italic ${isCritical ? 'text-rose-500' : ''}`}>{value}</p>
      <p className="text-[9px] uppercase font-bold text-muted-foreground tracking-widest">{label}</p>
    </div>
  );
}