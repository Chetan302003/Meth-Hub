import { useState } from 'react';
import { GlassCard } from '@/components/layout/GlassCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useTelemetry, useAutoJobLogger } from '@/hooks/useTelemetry';
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
  AlertTriangle,
  WifiOff,
  Play,
  Pause,
  ArrowRight,
  Wrench,
  Activity,
  Zap
} from 'lucide-react';

export function TelemetryPanel() {
  const { data, connected, isJobActive, raw } = useTelemetry();
  const { hasRole } = useAuth();
  const { stickyPlannedDistance } = useAutoJobLogger();
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
          <StatBox icon={<Zap size={16} />} label="Gear" value={data.truck.dash.displayedGear === 0 ? 'N' : data.truck.dash.displayedGear < 0 ? 'R' : data.truck.dash.displayedGear} unit="" />
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
            <Badge className="bg-primary/20 text-primary uppercase text-[9px] font-black">Active</Badge>
          </div>
          <div className="flex items-center gap-2 mb-6 text-sm font-bold italic">
            <MapPin size={14} className="text-primary" /><span>{data.job.source}</span>
            <ArrowRight size={14} className="text-muted-foreground mx-1" /><span>{data.job.destination}</span>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <JobStat label="Income" value={`$${data.job.income.toLocaleString()}`} />
            <JobStat label="Planned" value={`${(data.job.plannedDistance > 0 ? data.job.plannedDistance : (stickyPlannedDistance || 0)).toFixed(0)} km`} />
            <JobStat label="Cargo Weight" value={`${(data.job.cargoMass / 1000).toFixed(1)} t`} />
          </div>
          <div className="mt-6">
            <div className="flex justify-between text-[10px] font-black uppercase mb-1">
              <span className="text-muted-foreground">Cargo Damage</span>
              <span className={data.job.progress > 0.1 ? 'text-destructive' : 'text-primary'}>{(data.job.progress).toFixed(1)}%</span>
            </div>
            <Progress value={data.job.progress} className="h-1.5" />
          </div>
        </GlassCard>
      ) : null}

      <div className="grid grid-cols-2 gap-4">
        <GlassCard className="p-4">
          <div className="flex flex-wrap gap-2">
            <StatusIndicator label="Low" active={data.truck.lights.lowBeam} />
            <StatusIndicator label="High" active={data.truck.lights.highBeam} />
            <StatusIndicator label="Beacon" active={data.truck.lights.beacon} />
            <StatusIndicator label="Hazard" active={data.truck.lights.hazard} />
            <StatusIndicator label="Aux F" active={data.truck.lights.auxFront > 0} />
            <StatusIndicator label="Aux R" active={data.truck.lights.auxRoof > 0} />
          </div>
        </GlassCard>
        <GlassCard className="p-4 grid grid-cols-2 gap-2">
          <MiniVal label="Throttle" val={data.truck.inputs.throttle.toFixed(0)} unit="%" />
          <MiniVal label="Brake" val={data.truck.inputs.brake.toFixed(0)} unit="%" />
          <MiniVal label="Air" val={data.truck.dash.airPressure.toFixed(1)} unit="psi" />
          <MiniVal label="Batt" val={data.truck.dash.batteryVoltage.toFixed(1)} unit="v" />
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
      <div className={`mx-auto mb-2 ${isCritical ? 'text-rose-500 animate-pulse' : 'text-primary'}`}>{icon}</div>
      <p className="text-2xl font-black italic tracking-tighter">{value}<span className="text-xs ml-1 opacity-40">{unit}</span></p>
      <p className="text-[9px] uppercase font-bold text-muted-foreground tracking-widest">{label}</p>
    </div>
  );
}

function StatusIndicator({ label, active }: { label: string, active: boolean }) {
  return <div className={`px-2 py-1 rounded text-[8px] font-black uppercase border transition-all ${active ? 'bg-primary/20 text-primary border-primary/40' : 'bg-black/20 text-white/5 border-white/5'}`}>{label}</div>;
}

function MiniVal({ label, val, unit }: { label: string, val: string, unit: string }) {
  return <div className="flex justify-between text-[9px] uppercase font-bold"><span className="text-muted-foreground">{label}</span><span>{val}{unit}</span></div>;
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

function JobStat({ label, value }: { label: string, value: string }) {
  return <div className="text-center p-3 rounded-xl bg-black/20 border border-white/5"><p className="text-sm font-black italic">{value}</p><p className="text-[9px] uppercase font-bold text-muted-foreground tracking-widest">{label}</p></div>;
}