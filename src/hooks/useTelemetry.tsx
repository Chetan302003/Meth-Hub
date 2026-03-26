import { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { isTauri } from '@/lib/tauri';
import { useAuth } from './useAuth';
import { sendDiscordWebhook } from '@/lib/discord';

export interface AuraPlacement {
  x: number;
  y: number;
  z: number;
  heading: number;
  pitch: number;
  roll: number;
}

export interface TelemetryData {
  game: {
    connected: boolean;
    paused: boolean;
    time: number;
    scale: number;
    nextRestStop: number;
    pluginVersion: string;
    mpTimeOffset: number; // Added
  };
  truck: {
    brand: string;
    name: string;
    licensePlate: string;
    pos: AuraPlacement;
    dash: {
      speed: number;
      rpm: number;
      gear: number;
      displayedGear: number;
      odometer: number;
      fuel: number;
      fuelCapacity: number;
      fuelRange: number;
      fuelWarning: boolean;
      adblue: number;
      adblueWarning: boolean;
      waterTemp: number;
      oilTemp: number;
      batteryVoltage: number;
      airPressure: number;
      avgFuelConsumption: number; // Added
    };
    lights: {
      lowBeam: boolean;
      highBeam: boolean;
      parking: boolean;
      beacon: boolean;
      hazard: boolean;
      lblinker: boolean;
      rblinker: boolean;
      auxFront: number;
      auxRoof: number;
    };
    inputs: {
      steering: number;
      throttle: number;
      brake: number;
      clutch: number;
      effectiveSteering: number;
      cruiseControl: boolean;
    };
    damage: {
      engine: number;
      transmission: number;
      cabin: number;
      chassis: number;
      wheels: number;
      total: number;
    };
    navigation: {
      distance: number;
      time: number;
      speedLimit: number;
    };
    geometry: {
      cabinPos: AuraPlacement;
      headPos: AuraPlacement;
      hookPos: AuraPlacement;
      wheelCount: number;
    };
  };
  trailer: Array<{
    attached: boolean;
    id: string;
    brand: string;
    bodyType: string;
    chainType: string;
    licensePlate: string;
    damage: number;
  }>;
  job: {
    active: boolean;
    cargo: string;
    cargoId: string;
    source: string;
    destination: string;
    distanceKm: number; // Added
    income: number;
    plannedDistance: number;
    progress: number;
    cargoMass: number;
    cargoEvent: number;
    cargoAccessoryId: string;
    market: string;
    isSpecial: boolean;
    revenue: number;
    xp: number;
    autoPark: boolean;
    autoLoad: boolean;
  } | null;
  events: {
    delivered: number;
    cancelled: number;
    fined: number;
    fineAmount: number;
    toll: number;
    tollAmount: number;
    jobEvent: number; // Added: 0=none, 1=delivered, 2=cancelled
    ferryAmount: number;
    trainAmount: number;
    fuelAmount: number; // Added
    repairAmount: number; // Added
  };
  timestamp: number;
}

const defaultTelemetry: TelemetryData = {
  game: { connected: false, paused: false, time: 0, scale: 1, nextRestStop: 0, pluginVersion: '0.0', mpTimeOffset: 0 },
  truck: {
    brand: '', name: '', licensePlate: '',
    pos: { x: 0, y: 0, z: 0, heading: 0, pitch: 0, roll: 0 },
    dash: { speed: 0, rpm: 0, gear: 0, displayedGear: 0, odometer: 0, fuel: 0, fuelCapacity: 0, fuelRange: 0, fuelWarning: false, adblue: 0, adblueWarning: false, waterTemp: 0, oilTemp: 0, batteryVoltage: 0, airPressure: 0, avgFuelConsumption: 0 },
    lights: { lowBeam: false, highBeam: false, parking: false, beacon: false, hazard: false, lblinker: false, rblinker: false, auxFront: 0, auxRoof: 0 },
    inputs: { steering: 0, throttle: 0, brake: 0, clutch: 0, effectiveSteering: 0, cruiseControl: false },
    damage: { engine: 0, transmission: 0, cabin: 0, chassis: 0, wheels: 0, total: 0 },
    navigation: { distance: 0, time: 0, speedLimit: 0 },
    geometry: {
      cabinPos: { x: 0, y: 0, z: 0, heading: 0, pitch: 0, roll: 0 },
      headPos: { x: 0, y: 0, z: 0, heading: 0, pitch: 0, roll: 0 },
      hookPos: { x: 0, y: 0, z: 0, heading: 0, pitch: 0, roll: 0 },
      wheelCount: 0
    },
  },
  trailer: [],
  job: null,
  events: { delivered: 0, cancelled: 0, fined: 0, fineAmount: 0, toll: 0, tollAmount: 0, jobEvent: 0, ferryAmount: 0, trainAmount: 0, fuelAmount: 0, repairAmount: 0 },
  timestamp: 0,
};

export function useTelemetry() {
  const [data, setData] = useState<TelemetryData>(defaultTelemetry);
  const [connected, setConnected] = useState(false);
  const [raw, setRaw] = useState<any>(null);

  const parseTelemetryResponse = useCallback((rawObj: any): TelemetryData => {
    try {
      return {
        game: {
          connected: rawObj.game.connected,
          paused: rawObj.game.paused,
          time: rawObj.game.time,
          scale: rawObj.game.scale || 1.0,
          nextRestStop: rawObj.game.nextRestStop || 0,
          pluginVersion: rawObj.game.pluginVersion || 'none',
          mpTimeOffset: rawObj.game.mpTimeOffset || 0,
        },
        truck: {
          brand: rawObj.truck.brand,
          name: rawObj.truck.name,
          licensePlate: rawObj.truck.licensePlate || '',
          pos: rawObj.truck.pos || { x: 0, y: 0, z: 0, heading: 0, pitch: 0, roll: 0 },
          dash: {
            speed: rawObj.truck.speed,
            rpm: rawObj.truck.rpm,
            gear: rawObj.truck.gear,
            displayedGear: rawObj.truck.gear,
            odometer: rawObj.truck.odometer,
            fuel: rawObj.truck.fuel,
            fuelCapacity: rawObj.truck.fuelCapacity || 0,
            fuelRange: rawObj.truck.dash.fuelRange || 0,
            fuelWarning: rawObj.truck.fuel < (rawObj.truck.fuelCapacity * 0.15),
            adblue: 0,
            adblueWarning: false,
            waterTemp: rawObj.truck.dash.waterTemp || 0,
            oilTemp: rawObj.truck.dash.oilTemp || 0,
            batteryVoltage: rawObj.truck.dash.batteryVoltage || 0,
            airPressure: rawObj.truck.dash.airPressure || 0,
            avgFuelConsumption: rawObj.truck.dash.avgFuelConsumption || 0,
          },
          lights: {
            lowBeam: rawObj.truck.lights.lowBeam,
            highBeam: rawObj.truck.lights.highBeam,
            parking: false,
            beacon: rawObj.truck.lights.beacon || false,
            hazard: rawObj.truck.lights.hazard || false,
            lblinker: rawObj.truck.lights.lblinker,
            rblinker: rawObj.truck.lights.rblinker,
            auxFront: rawObj.truck.lights.auxFront || 0,
            auxRoof: rawObj.truck.lights.auxRoof || 0,
          },
          inputs: {
            steering: rawObj.truck.inputs?.steering || 0,
            throttle: rawObj.truck.inputs?.throttle || 0,
            brake: rawObj.truck.inputs?.brake || 0,
            clutch: rawObj.truck.inputs?.clutch || 0,
            effectiveSteering: rawObj.truck.inputs?.steering || 0,
            cruiseControl: rawObj.truck.cruiseControl,
          },
          damage: {
            engine: rawObj.truck.wear?.engine || 0,
            transmission: rawObj.truck.wear?.transmission || 0,
            cabin: rawObj.truck.wear?.cabin || 0,
            chassis: rawObj.truck.wear?.chassis || 0,
            wheels: rawObj.truck.wear?.wheels || 0,
            total: rawObj.truck.wear?.total || 0,
          },
          navigation: {
            distance: rawObj.truck.navigation?.distance || 0,
            time: rawObj.truck.navigation?.time || 0,
            speedLimit: rawObj.truck.navigation?.speedLimit || 0,
          },
          geometry: {
            cabinPos: rawObj.truck.geometry?.cabinPos || { x: 0, y: 0, z: 0, heading: 0, pitch: 0, roll: 0 },
            headPos: rawObj.truck.geometry?.head_pos || { x: 0, y: 0, z: 0, heading: 0, pitch: 0, roll: 0 },
            hookPos: rawObj.truck.geometry?.hook_pos || { x: 0, y: 0, z: 0, heading: 0, pitch: 0, roll: 0 },
            wheelCount: rawObj.truck.geometry?.wheel_count || 0,
          },
        },
        trailer: (rawObj.trailer || []).map((t: any) => ({
          attached: t.attached,
          id: t.id || 'none',
          brand: t.brand || 'none',
          bodyType: t.bodyType || 'none',
          chainType: t.chainType || 'none',
          licensePlate: t.licensePlate || 'none',
          damage: t.damage || 0,
        })),
        job: rawObj.job ? {
          active: rawObj.job.active,
          cargo: rawObj.job.cargo,
          cargoId: rawObj.job.cargoId,
          source: rawObj.job.source,
          destination: rawObj.job.destination,
          distanceKm: rawObj.job.distance_km || 0,
          income: rawObj.job.income,
          plannedDistance: rawObj.job.plannedDistance || 0,
          progress: rawObj.job.cargoDamageLive || 0,
          cargoMass: rawObj.job.cargoMass || 0,
          cargoEvent: rawObj.job.cargoEvent || 0,
          cargoAccessoryId: rawObj.job.cargoAccessoryId || "",
          market: rawObj.job.market || "",
          isSpecial: rawObj.job.isSpecial || false,
          revenue: rawObj.job.revenue || 0,
          xp: rawObj.job.xp || 0,
          autoPark: rawObj.job.autoPark || false,
          autoLoad: rawObj.job.autoLoad || false,
        } : null,
        events: {
          delivered: rawObj.events?.jobFinishedCount || 0,
          cancelled: rawObj.events?.jobCancelledCount || 0,
          fined: rawObj.events?.fineCount || 0,
          fineAmount: rawObj.events?.fineAmount || 0,
          toll: rawObj.events?.tollCount || 0,
          tollAmount: rawObj.events?.tollAmount || 0,
          jobEvent: rawObj.events?.jobEvent || 0,
          ferryAmount: rawObj.events?.ferryAmount || 0,
          trainAmount: rawObj.events?.trainAmount || 0,
          fuelAmount: rawObj.events?.fuelAmount || 0,
          repairAmount: rawObj.events?.repairAmount || 0,
        },
        timestamp: rawObj.timestamp,
      };
    } catch (err) {
      console.error('Titan Omega Hook Parser Error:', err);
      return defaultTelemetry;
    }
  }, []);

  useEffect(() => {
    if (!isTauri()) return;
    let isMounted = true;
    let timerId: ReturnType<typeof setTimeout>;

    const poll = async () => {
      if (!isMounted) return;
      try {
        const rawObj = await invoke<any>('get_telemetry_data');
        setRaw(rawObj);
        if (!rawObj.game?.connected) {
          setData(defaultTelemetry);
          setConnected(false);
          timerId = setTimeout(poll, 2000);
        } else {
          setData(parseTelemetryResponse(rawObj));
          setConnected(true);
          timerId = setTimeout(poll, 100);
        }
      } catch (err) {
        setConnected(false);
        timerId = setTimeout(poll, 5000);
      }
    };

    poll();
    return () => { isMounted = false; clearTimeout(timerId); };
  }, [parseTelemetryResponse]);

  return {
    data,
    connected,
    isJobActive: !!data.job?.active,
    raw: raw // Explicitly return the full raw buffer for the SDK viewer
  };
}

export function useAutoJobLogger() {
  const { user } = useAuth();
  const { data, connected, isJobActive } = useTelemetry();
  const [pendingJob, setPendingJob] = useState<TelemetryData['job'] | null>(null);
  const [startOdometer, setStartOdometer] = useState<number | null>(null);
  const [startFuel, setStartFuel] = useState<number | null>(null); // Kept for reference
  const [accumulatedFuel, setAccumulatedFuel] = useState<number>(0);
  const [prevFuelTrack, setPrevFuelTrack] = useState<number | null>(null);
  const [stickyPlannedDistance, setStickyPlannedDistance] = useState<number>(0);
  const [startExpenses, setStartExpenses] = useState<{ fines: number; tolls: number; repairs: number } | null>(null);
  const [isLogging, setIsLogging] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [prevTruckBrand, setPrevTruckBrand] = useState<string>('');
  const [prevTruckName, setPrevTruckName] = useState<string>('');
  const [startEvents, setStartEvents] = useState<{ delivered: number; cancelled: number } | null>(null);
  const [jobStartedAt, setJobStartedAt] = useState<string | null>(null);
  const [finalStatusOverride, setFinalStatusOverride] = useState<'delivered' | 'cancelled' | null>(null);
  const lastDiscordCargoId = useRef<string | null>(null);

  // Track start/end of jobs
  useEffect(() => {
    // START: Job detected - Make it sticky if the cargo is the same
    if (isJobActive && data.job) {
      const isNewCargo = pendingJob?.cargoId !== data.job.cargoId;
      const isNewTruck = data.truck.brand !== prevTruckBrand || data.truck.name !== prevTruckName;

      // Reset if it's a new job, a new truck, or if we just haven't set it yet
      if (!startOdometer || isNewCargo || isNewTruck) {
        setStartOdometer(data.truck.dash.odometer);
        setStartFuel(data.truck.dash.fuel);
        setAccumulatedFuel(0);
        setPrevFuelTrack(data.truck.dash.fuel);
        setPrevTruckBrand(data.truck.brand);
        setPrevTruckName(data.truck.name);

        const initialPlanned = data.job.plannedDistance > 0
          ? data.job.plannedDistance
          : (data.truck.navigation.distance / 1000);
        setStickyPlannedDistance(initialPlanned);

        setStartExpenses({
          fines: data.events.fineAmount || 0,
          tolls: (data.events.tollAmount || 0) + (data.events.ferryAmount || 0) + (data.events.trainAmount || 0),
          repairs: data.events.repairAmount || 0
        });

        setStartEvents({
          delivered: data.events.delivered || 0,
          cancelled: data.events.cancelled || 0,
        });
        const startedAt = new Date().toISOString();
        setJobStartedAt(startedAt);

        if (isNewCargo || !jobId) {
          const newJobId = crypto.randomUUID();
          setJobId(newJobId);
        }

        setPendingJob(data.job);
        console.log(' Titan Omega: New Job Detected or Cargo Changed.');
      } else {
        // Continuous tracking while job is active

        // If sticky planned distance locked at 0 while GPS was calculating, wait for it to populate
        let currentPlanned = stickyPlannedDistance;
        if (stickyPlannedDistance === 0) {
          const gpsDist = data.truck.navigation.distance / 1000;
          if (data.job.plannedDistance > 0) {
            setStickyPlannedDistance(data.job.plannedDistance);
            currentPlanned = data.job.plannedDistance;
          } else if (gpsDist > 0) {
            setStickyPlannedDistance(gpsDist);
            currentPlanned = gpsDist;
          }
        }

        // Delay webhook until GPS actually establishes the route to prevent "0 km (Planned)"
        if (currentPlanned > 0 && jobId && user?.user_metadata?.username && lastDiscordCargoId.current !== data.job.cargoId) {
          lastDiscordCargoId.current = data.job.cargoId;
          const avatarUrl = user.user_metadata.avatar_url || "https://postimg.cc/G9xHn83L";

          sendDiscordWebhook('job_started', {
            username: user.user_metadata.username,
            avatar_url: avatarUrl,
            job_id: jobId,
            origin_city: data.job.source,
            destination_city: data.job.destination,
            planned_distance_km: currentPlanned,
            cargo_weight: Math.round(data.job.cargoMass / 1000),
            cargo_type: data.job.cargo,
            truck_name: `${data.truck.brand} ${data.truck.name}`,
            started_at: jobStartedAt || new Date().toISOString()
          });
        }

        if (prevFuelTrack !== null && data.truck.dash.fuel && data.truck.dash.fuel < prevFuelTrack) {
          // If fuel went down, add difference
          setAccumulatedFuel(prev => prev + (prevFuelTrack - data.truck.dash.fuel));
        }
        if (data.truck.dash.fuel) {
          setPrevFuelTrack(data.truck.dash.fuel);
        }
      }
    }

    // END: Job finished — detect by two reliable signals:
    // 1. DELIVERED: jobFinishedCount increments (game engine confirms delivery)
    // 2. CANCELLED: The tracked job disappears (isJobActive goes false OR cargo changes)
    //    WITHOUT jobFinishedCount incrementing
    if (pendingJob && startEvents && !isLogging) {
      const deliveredInc = (data.events.delivered || 0) > startEvents.delivered;
      
      // Job disappeared: was active, now it's not (or cargo changed away from our tracked one)
      const jobDisappeared = !isJobActive && pendingJob.cargoId;
      const cargoSwapped = isJobActive && data.job && data.job.cargoId !== pendingJob.cargoId;
      
      if (deliveredInc) {
        // Genuine delivery confirmed by game engine
        console.log(' Titan Omega: Engine Job Completion Signal Detected. (Delivered)');
        setIsLogging(true);
        setFinalStatusOverride('delivered');

        const timer = setTimeout(() => {
          setIsLogging(false);
          setStartOdometer(null);
          setStartFuel(null);
          setAccumulatedFuel(0);
          setPrevFuelTrack(null);
          setPendingJob(null);
          setJobId(null);
          setStartEvents(null);
          setJobStartedAt(null);
          setFinalStatusOverride(null);
        }, 5000);
        return () => clearTimeout(timer);
      } else if (jobDisappeared || cargoSwapped) {
        // Job vanished without a delivery increment = CANCELLED
        console.log(' Titan Omega: Job Disappearance Detected WITHOUT delivery. (Cancelled)');
        setIsLogging(true);
        setFinalStatusOverride('cancelled');

        const timer = setTimeout(() => {
          setIsLogging(false);
          setStartOdometer(null);
          setStartFuel(null);
          setAccumulatedFuel(0);
          setPrevFuelTrack(null);
          setPendingJob(null);
          setJobId(null);
          setStartEvents(null);
          setJobStartedAt(null);
          setFinalStatusOverride(null);
        }, 5000);
        return () => clearTimeout(timer);
      }
    }
  }, [isJobActive, data.truck.dash.odometer, data.truck.navigation.distance, data.job, pendingJob, data.job?.cargoId, data.truck.brand, data.truck.name, startOdometer, jobId, data.truck.dash.fuel, data.events, startExpenses, startEvents, isLogging]);

  const prepareJobData = useCallback(() => {
    // For terminal state (cancelled/delivered), we must look at data.job for final outcome (penalty/xp/event)
    // but pendingJob for original source/dest if data.job is already cleared.
    const job = data.job && !data.job.active ? data.job : (pendingJob || data.job);
    if (!job) return null;

    // Prefer job.distanceKm from SCS (high precision for finished jobs) if it's > 0
    let driven = data.job?.distanceKm || (startOdometer ? data.truck.dash.odometer - startOdometer : 0);

    // Safety
    if (driven < 0 || driven > 20000) {
      driven = stickyPlannedDistance || 0;
    }

    // Status Logic
    const isCancelled = job.cargoEvent === 2 || data.events.jobEvent === 2 || finalStatusOverride === 'cancelled';
    const finalStatus = isCancelled ? 'cancelled' : (finalStatusOverride || 'delivered');

    // Use the continuous live fuel accumulator so refueling doesn't reset it
    const fuelConsumed = accumulatedFuel;

    // Expenses Delta
    const currentTolls = (data.events.tollAmount || 0) + (data.events.ferryAmount || 0) + (data.events.trainAmount || 0);
    const finesDelta = Math.max(0, (data.events.fineAmount || 0) - (startExpenses?.fines || 0));
    const tollsDelta = Math.max(0, currentTolls - (startExpenses?.tolls || 0));
    const repairsDelta = Math.max(0, (data.events.repairAmount || 0) - (startExpenses?.repairs || 0));
    const totalExpenses = finesDelta + tollsDelta + repairsDelta;

    // Fallback chain for planned distance: SCS config > sticky value > live GPS
    let plannedKm = job.plannedDistance > 0 ? job.plannedDistance : stickyPlannedDistance;
    if (plannedKm === 0 && data.truck.navigation.distance > 0) {
      plannedKm = data.truck.navigation.distance / 1000;
    }
    // Also try pendingJob's original planned distance
    if (plannedKm === 0 && pendingJob?.plannedDistance && pendingJob.plannedDistance > 0) {
      plannedKm = pendingJob.plannedDistance;
    }

    const damagePercent = data.job?.progress || job.progress || 0;
    const durationSeconds = jobStartedAt ? Math.round((Date.now() - new Date(jobStartedAt).getTime()) / 1000) : 0;

    // Cancelled jobs: zero out all financial/performance stats
    if (isCancelled) {
      return {
        job_id: jobId || crypto.randomUUID(),
        origin_city: pendingJob?.source || job.source,
        destination_city: pendingJob?.destination || job.destination,
        planned_distance_km: Math.round(plannedKm),
        distance_km: 0,
        cargo_type: job.cargo,
        cargo_weight: Math.round(job.cargoMass / 1000),
        fuel_consumed: 0,
        avg_fuel_consumption: 0,
        income: 0,
        revenue: 0,
        xp_earned: 0,
        expenses: 0,
        fine_amount: 0,
        damage_percent: 0,
        truck_name: `${data.truck.brand} ${data.truck.name}`,
        truck_id: data.truck.brand,
        trailer_id: data.trailer[0]?.id || 'none',
        status: 'cancelled',
        auto_park: job.autoPark || false,
        auto_load: job.autoLoad || false,
        job_market: job.market || 'freight',
        mp_time_offset: data.game.mpTimeOffset || 0,
        is_special_transport: job.isSpecial || false,
        delivery_date: new Date().toISOString(),
        started_at: jobStartedAt || new Date().toISOString(),
        duration_seconds: durationSeconds,
      };
    }

    // Manual XP Calculation Fallback (delivered jobs only)
    let calculatedXp = Math.round(job.xp || 0);
    if (calculatedXp === 0 && driven > 0) {
      const baseDistanceXp = driven;
      const specialBonus = job.isSpecial ? driven * 0.2 : 0;
      const parkingBonus = !job.autoPark ? 45 : 0;
      let rawCalculate = baseDistanceXp + specialBonus + parkingBonus;

      // Damage penalty: -5 XP per 1% of damage, capped to never go below 10 XP
      const damagePenalty = damagePercent * 5;
      calculatedXp = Math.max(Math.round(rawCalculate - damagePenalty), 10);
    }

    let fuelEconomy = data.truck.dash.avgFuelConsumption || 0;
    if (fuelEconomy === 0 && fuelConsumed > 0 && driven > 0) {
      fuelEconomy = (fuelConsumed / driven) * 100;
    }

    return {
      job_id: jobId || crypto.randomUUID(),
      origin_city: job.source,
      destination_city: job.destination,
      planned_distance_km: Math.round(plannedKm),
      distance_km: driven > 0 ? Math.round(driven) : 0,
      cargo_type: job.cargo,
      cargo_weight: Math.round(job.cargoMass / 1000),
      fuel_consumed: Math.round(fuelConsumed),
      avg_fuel_consumption: Number(fuelEconomy.toFixed(2)),
      income: Math.round(job.income),
      revenue: Math.round(job.revenue || job.income),
      xp_earned: calculatedXp,
      expenses: Math.round(totalExpenses),
      fine_amount: Math.round(finesDelta),
      damage_percent: Math.round(damagePercent),
      truck_name: `${data.truck.brand} ${data.truck.name}`,
      truck_id: data.truck.brand,
      trailer_id: data.trailer[0]?.id || 'none',
      status: finalStatus,
      auto_park: job.autoPark || false,
      auto_load: job.autoLoad || false,
      job_market: job.market || 'freight',
      mp_time_offset: data.game.mpTimeOffset || 0,
      is_special_transport: job.isSpecial || false,
      delivery_date: new Date().toISOString(),
      started_at: jobStartedAt || new Date().toISOString(),
      duration_seconds: durationSeconds
    };
  }, [data, pendingJob, startOdometer, isJobActive, jobId, stickyPlannedDistance, startExpenses, startFuel, finalStatusOverride, jobStartedAt, accumulatedFuel]);

  return {
    telemetryConnected: connected,
    currentJob: data.job,
    truckData: data.truck,
    pendingJob,
    prepareJobData,
    isLogging,
    startOdometer,
    stickyPlannedDistance,
  };
}