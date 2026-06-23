import { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { isTauri } from '@/lib/tauri';
import { useAuth } from './useAuth';
import { sendDiscordWebhook } from '@/lib/discord';
import { trackEvent } from "@/lib/aptabase";

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
    finalIncome?: number;
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
            fuelRange: rawObj.truck.fuelRange ?? rawObj.truck.dash?.fuelRange ?? 0,
            fuelWarning: rawObj.truck.fuel < (rawObj.truck.fuelCapacity * 0.15),
            adblue: rawObj.truck.dash?.adblue ?? 0,
            adblueWarning: rawObj.truck.dash?.adblueWarning ?? rawObj.truck.dash?.adblue_warning ?? false,
            waterTemp: rawObj.truck.waterTemp ?? rawObj.truck.dash?.waterTemperature ?? rawObj.truck.dash?.waterTemp ?? 0,
            oilTemp: rawObj.truck.oilTemp ?? rawObj.truck.dash?.oilTemperature ?? rawObj.truck.dash?.oilTemp ?? 0,
            batteryVoltage: rawObj.truck.batteryVoltage ?? rawObj.truck.dash?.batteryVoltage ?? 0,
            airPressure: rawObj.truck.airPressure ?? rawObj.truck.dash?.brakeAirPressure ?? rawObj.truck.dash?.airPressure ?? 0,
            avgFuelConsumption: rawObj.truck.avgFuelConsumption ?? rawObj.truck.dash?.fuelAvgConsumption ?? rawObj.truck.dash?.avgFuelConsumption ?? 0,
          },
          lights: {
            lowBeam: rawObj.truck.lights.lowBeam,
            highBeam: rawObj.truck.lights.highBeam,
            parking: rawObj.truck.lights?.parking ?? false,
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
            cabinPos: rawObj.truck.geometry?.cabinPos ?? rawObj.truck.geometry?.cabin_pos ?? { x: 0, y: 0, z: 0, heading: 0, pitch: 0, roll: 0 },
            headPos: rawObj.truck.geometry?.headPos ?? rawObj.truck.geometry?.head_pos ?? { x: 0, y: 0, z: 0, heading: 0, pitch: 0, roll: 0 },
            hookPos: rawObj.truck.geometry?.hookPos ?? rawObj.truck.geometry?.hook_pos ?? { x: 0, y: 0, z: 0, heading: 0, pitch: 0, roll: 0 },
            wheelCount: rawObj.truck.geometry?.wheel_count ?? rawObj.truck.geometry?.wheelCount ?? 0,
          },
        },
        trailer: (() => {
          // Support multiple telemetry shapes: array, object, or nested in truck
          const rawTrailerData = rawObj.trailer ?? rawObj.trailers ?? rawObj.truck?.trailer ?? rawObj.truck?.trailers ?? [];
          const trailerArray = Array.isArray(rawTrailerData) ? rawTrailerData : [rawTrailerData];

          return trailerArray.filter(t => t && typeof t === 'object').map((t: any, idx: number) => {
            if (idx === 0) console.debug('Titan SDK: Trailer Normalization:', t);
            return {
              attached: t.attached ?? t.connected ?? t.isAttached ?? false,
              id: t.id ?? t.trailerId ?? t.trailer_id ?? t.accessoryId ?? t.accessory_id ?? t.licensePlate ?? t.license_plate ?? 'none',
              brand: t.brand ?? t.brandId ?? t.brand_id ?? 'none',
              bodyType: t.bodyType ?? t.body_type ?? 'none',
              chainType: t.chainType ?? t.chain_type ?? 'none',
              licensePlate: t.licensePlate ?? t.license_plate ?? 'none',
              damage: t.damage ?? t.wear ?? 0,
            };
          });
        })(),
        job: rawObj.job ? {
          active: rawObj.job.active,
          cargo: rawObj.job.cargo,
          cargoId: rawObj.job.cargoId,
          source: rawObj.job.source,
          destination: rawObj.job.destination,
          distanceKm: rawObj.job.distanceKm ?? rawObj.job.distance_km ?? 0,
          income: rawObj.job.income,
          plannedDistance: rawObj.job.plannedDistance ?? rawObj.job.planned_distance ?? 0,
          progress: rawObj.job.cargoDamageLive ?? rawObj.job.cargo_damage ?? rawObj.job.liveDamage ?? 0,
          cargoMass: rawObj.job.cargoMass || 0,
          cargoEvent: rawObj.job.cargoEvent || 0,
          cargoAccessoryId: rawObj.job.cargoAccessoryId || "",
          market: rawObj.job.market || "",
          isSpecial: rawObj.job.isSpecial || false,
          revenue: rawObj.job.revenue || rawObj.job.finalIncome || 0,
          finalIncome: rawObj.job.finalIncome || 0,
          xp: rawObj.job.xp || 0,
          autoPark: rawObj.job.autoPark || false,
          autoLoad: rawObj.job.autoLoad || false,
        } : null,
        events: {
          delivered: rawObj.events?.jobFinishedCount ?? rawObj.events?.delivered ?? 0,
          cancelled: rawObj.events?.jobCancelledCount ?? rawObj.events?.cancelled ?? 0,
          fined: rawObj.events?.fineCount ?? rawObj.events?.fined ?? 0,
          fineAmount: rawObj.events?.fineAmount ?? rawObj.events?.fine_amount ?? 0,
          toll: rawObj.events?.tollCount ?? rawObj.events?.toll ?? 0,
          tollAmount: rawObj.events?.tollAmount ?? rawObj.events?.toll_amount ?? 0,
          jobEvent: rawObj.events?.jobEvent ?? 0,
          ferryAmount: rawObj.events?.ferryAmount ?? rawObj.events?.ferryPay ?? rawObj.events?.ferry_pay ?? 0,
          trainAmount: rawObj.events?.trainAmount ?? rawObj.events?.trainPay ?? rawObj.events?.train_pay ?? 0,
          fuelAmount: rawObj.events?.fuelAmount ?? rawObj.events?.refuelAmount ?? 0,
          repairAmount: rawObj.events?.repairAmount ?? rawObj.events?.repairCost ?? 0,
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
        if (rawObj.game?.connected) {
          setData(parseTelemetryResponse(rawObj));
          setConnected(true);
          timerId = setTimeout(poll, 100);
        } else {
          setData((prev) => ({
            ...prev,
            game: {
              ...prev.game,
              connected: false,
              paused: false,
            },
            truck: {
              ...prev.truck,
              dash: {
                ...prev.truck.dash,
                speed: 0,
                rpm: 0,
                gear: 0,
                displayedGear: 0,
              },
              inputs: {
                ...prev.truck.inputs,
                throttle: 0,
                brake: 0,
                clutch: 0,
                cruiseControl: false,
              },
            },
            timestamp: Date.now(),
          }));
          setConnected(false);
          timerId = setTimeout(poll, 2000);

        }
      } catch (err) {
        if (!String(err).includes('OpenFileMapping failed')) {
          console.error('Titan Omega: Telemetry polling failed:', err);
        }
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
  const prevFuelTrackRef = useRef<number | null>(null);
  const [stickyPlannedDistance, setStickyPlannedDistance] = useState<number>(0);
  const [startExpenses, setStartExpenses] = useState<{
    ferry: number; train: number; fines: number; tolls: number; repairs: number
  } | null>(null);
  const [isLogging, setIsLogging] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const jobIdRef = useRef<string | null>(null);
  const prevTruckBrandRef = useRef<string>('');
  const prevTruckNameRef = useRef<string>('');
  const [startEvents, setStartEvents] = useState<{ delivered: number; cancelled: number } | null>(null);
  const [jobStartedAt, setJobStartedAt] = useState<string | null>(null);
  const [finalStatusOverride, setFinalStatusOverride] = useState<'delivered' | 'cancelled' | null>(null);
  const lastDiscordCargoId = useRef<string | null>(null);
  const latestJobRef = useRef<TelemetryData['job'] | null>(null);
  const wasDisconnectedRef = useRef(false);
  const reconnectCountRef = useRef(0);
  const prevConnectedRef = useRef(connected);
  const jobMissingSinceRef = useRef<number | null>(null);

  const usedFerryOrTrainRef = useRef(false);
  const startFerryAmount = useRef(0);
  const startTrainAmount = useRef(0);
  const prevOdometerRef = useRef<number | null>(null);
  const teleportDetectedRef = useRef(false);
  const liveOdometerRef = useRef<number>(0);
  const startOdometerRef = useRef<number | null>(null);
  const ferryDistanceRef = useRef<number>(0);
  const actualDrivenDistanceRef = useRef<number>(0);
  const movingFuelTrackRef = useRef<number>(0);

  // Track start/end of jobs
  useEffect(() => {
    // Track disconnection/reconnection during active job
    if (pendingJob) {
      if (prevConnectedRef.current && !connected) {
        wasDisconnectedRef.current = true;
      }
      if (!prevConnectedRef.current && connected) {
        reconnectCountRef.current += 1;
      }
    }
    prevConnectedRef.current = connected;

    // Grace period: when connected, job data may take time to re-appear after reconnect.
    if (!connected || isJobActive) {
      jobMissingSinceRef.current = null;
    } else if (pendingJob && !isJobActive && jobMissingSinceRef.current === null) {
      jobMissingSinceRef.current = Date.now();
    }

    // START: Job detected - Make it sticky if the cargo is the same
    if (isJobActive && data.job) {
      // Fix for TruckersMP Job Dispatcher: Rely on source/dest/cargo instead of just cargoId
      // because TMP's new dispatcher sometimes fluctuates or blanks the cargoId.
      let isNewCargo = false;
      if (pendingJob && data.job) {
        // If we have source/destination, use them as primary keys (more stable than cargoId)
        if (data.job.source && data.job.destination && pendingJob.source && pendingJob.destination) {
          isNewCargo = pendingJob.source !== data.job.source || pendingJob.destination !== data.job.destination;
        } else if (data.job.cargoId && pendingJob.cargoId) {
          isNewCargo = pendingJob.cargoId !== data.job.cargoId;
        }
        // If one is missing details, don't assume it's a "new" cargo yet to prevent double-logging
      } else if (!pendingJob && data.job) {
        isNewCargo = true;
      }

      const isNewTruck = (data.truck.brand && data.truck.brand !== prevTruckBrandRef.current) ||
        (data.truck.name && data.truck.name !== prevTruckNameRef.current);

      if (!startOdometer || isNewCargo || isNewTruck) {
        // Force-close previous job's logging window if still active (back-to-back jobs)
        if (isLogging) {
          setIsLogging(false);
          setFinalStatusOverride(null);
        }

        wasDisconnectedRef.current = false;
        reconnectCountRef.current = 0;

        usedFerryOrTrainRef.current = false;
        teleportDetectedRef.current = false;
        ferryDistanceRef.current = 0;
        startFerryAmount.current = data.events.ferryAmount || 0;
        startTrainAmount.current = data.events.trainAmount || 0;
        prevOdometerRef.current = data.truck.dash.odometer;
        liveOdometerRef.current = data.truck.dash.odometer;
        startOdometerRef.current = data.truck.dash.odometer;
        actualDrivenDistanceRef.current = 0;
        movingFuelTrackRef.current = 0;

        const newJobId = crypto.randomUUID();
        jobIdRef.current = newJobId;
        setJobId(newJobId);

        setStartOdometer(data.truck.dash.odometer);
        setStartFuel(data.truck.dash.fuel);
        setAccumulatedFuel(0);
        prevFuelTrackRef.current = data.truck.dash.fuel;
        prevTruckBrandRef.current = data.truck.brand;
        prevTruckNameRef.current = data.truck.name;

        const initialPlanned = data.job.plannedDistance > 0
          ? data.job.plannedDistance
          : (data.truck.navigation.distance / 1000);
        setStickyPlannedDistance(initialPlanned);

        setStartExpenses({
          fines: data.events.fineAmount || 0,
          tolls: data.events.tollAmount || 0,
          repairs: data.events.repairAmount || 0,
          ferry: data.events.ferryAmount || 0,
          train: data.events.trainAmount || 0
        });

        setStartEvents({
          delivered: data.events.delivered || 0,
          cancelled: data.events.cancelled || 0,
        });
        const startedAt = new Date().toISOString();
        setJobStartedAt(startedAt);

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
        if (currentPlanned > 0 && jobIdRef.current && user?.user_metadata?.username && lastDiscordCargoId.current !== data.job.cargoId) {
          lastDiscordCargoId.current = data.job.cargoId;
          const avatarUrl = user.user_metadata.avatar_url || "https://i.ibb.co/wNRBF3zj/logo-png.png";

          trackEvent('job_started', {
            job_id: jobIdRef.current,
            origin: data.job.source,
            destination: data.job.destination
          });

          sendDiscordWebhook('job_started', {
            username: user.user_metadata.username,
            avatar_url: avatarUrl,
            job_id: jobIdRef.current,
            origin_city: data.job.source,
            destination_city: data.job.destination,
            planned_distance_km: currentPlanned,
            cargo_weight: Math.round(data.job.cargoMass / 1000),
            cargo_type: data.job.cargo,
            truck_name: `${data.truck.brand} ${data.truck.name}`,
            started_at: jobStartedAt || new Date().toISOString()
          });
        }

        if (prevFuelTrackRef.current !== null && data.truck.dash.fuel !== undefined && data.truck.dash.fuel < prevFuelTrackRef.current) {
          // If fuel went down, add difference
          const consumed = prevFuelTrackRef.current! - data.truck.dash.fuel;
          setAccumulatedFuel(prev => prev + consumed);
          if (data.truck.dash.speed > 0) {
            movingFuelTrackRef.current += consumed;
          }
        }
        if (data.truck.dash.fuel !== undefined) {
          prevFuelTrackRef.current = data.truck.dash.fuel;
        }

        // Cache the exact live data so we don't lose the final precise distanceKm if the SDK resets it.
        if (data.job) {
          latestJobRef.current = data.job;
        }

        // Ferry/train detection (Bug #8 secondary check)
        const ferryDeltaLive = (data.events.ferryAmount || 0) - startFerryAmount.current;
        const trainDeltaLive = (data.events.trainAmount || 0) - startTrainAmount.current;
        if (ferryDeltaLive > 0 || trainDeltaLive > 0) {
          usedFerryOrTrainRef.current = true;
        }

        // Track actual driven distance, perfectly ignoring teleports and ferry gaps
        if (prevOdometerRef.current !== null) {
          const odometerDelta = data.truck.dash.odometer - prevOdometerRef.current;
          if (odometerDelta > 0 && odometerDelta < 50) {
            actualDrivenDistanceRef.current += odometerDelta;
          } else if (Math.abs(odometerDelta) >= 50) {
            teleportDetectedRef.current = true;
            console.log('Titan Omega: Teleport detected. Odometer jump:', odometerDelta, 'km');
          }
        }
        prevOdometerRef.current = data.truck.dash.odometer;
        liveOdometerRef.current = data.truck.dash.odometer;
      }
    }

    // END: Job finished — detect by two reliable signals plus direct event mapping:
    // 1. DELIVERED: jobFinishedCount increments OR jobEvent === 1
    // 2. CANCELLED: jobEvent === 2 OR The tracked job disappears
    if (pendingJob && startEvents && !isLogging) {
      const deliveredInc = (data.events.delivered || 0) > startEvents.delivered;
      const isEventDelivered = data.events.jobEvent === 1;
      const isEventCancelled = data.events.jobEvent === 2;

      const isDelivery = deliveredInc || isEventDelivered;

      // Job disappeared: was active, now it's not (or cargo changed away from our tracked one)
      const jobDisappeared = connected
        && !isJobActive
        && jobMissingSinceRef.current !== null
        && (Date.now() - jobMissingSinceRef.current) >= 3000;
      const cargoSwapped = isJobActive && data.job && data.job.cargoId !== pendingJob.cargoId;

      if (isDelivery) {
        // Genuine delivery confirmed by game engine or job event
        console.log(' Titan Omega: Engine Job Completion Signal Detected. (Delivered)');
        setIsLogging(true);
        setFinalStatusOverride('delivered');

        const timer = setTimeout(() => {
          setIsLogging(false);
          setStartOdometer(null);
          setStartFuel(null);
          setAccumulatedFuel(0);
          prevFuelTrackRef.current = null;
          setPendingJob(null);
          setJobId(null);
          jobIdRef.current = null;
          setStartEvents(null);
          setJobStartedAt(null);
          setFinalStatusOverride(null);
          latestJobRef.current = null;
          wasDisconnectedRef.current = false;
          reconnectCountRef.current = 0;
          liveOdometerRef.current = 0;
          startOdometerRef.current = null;
          ferryDistanceRef.current = 0;
          actualDrivenDistanceRef.current = 0;
          usedFerryOrTrainRef.current = false;
          teleportDetectedRef.current = false;
        }, 5000);
      } else if (isEventCancelled || jobDisappeared || cargoSwapped) {
        // Check for TruckersMP dropped delivery bug
        const drivenDist = startOdometer ? data.truck.dash.odometer - startOdometer : 0;
        let pDist = stickyPlannedDistance || pendingJob.plannedDistance || 0;
        if (pDist === 0 && data.truck.navigation.distance > 0) {
          pDist = data.truck.navigation.distance / 1000;
        }

        // Ferry jobs: exempt from 90% check (odometer doesn't tick during ferry)
        // Teleport jobs: distance unreliable, also exempt
        const isLikelyBuggedDelivery = !isEventCancelled && (
          usedFerryOrTrainRef.current ||
          teleportDetectedRef.current ||
          (drivenDist > 0 && pDist > 0 && (drivenDist >= pDist * 0.9))
        );

        if (isLikelyBuggedDelivery) {
          console.log(' Titan Omega: Job Disappearance but Distance Match. Assuming Delivered (TMP Drop)');
          setIsLogging(true);
          setFinalStatusOverride('delivered');
        } else {
          console.log(' Titan Omega: Job Disappearance Detected WITHOUT delivery. (Cancelled)');
          setIsLogging(true);
          setFinalStatusOverride('cancelled');
        }

        const timer = setTimeout(() => {
          setIsLogging(false);
          setStartOdometer(null);
          setStartFuel(null);
          setAccumulatedFuel(0);
          prevFuelTrackRef.current = null;
          setPendingJob(null);
          setJobId(null);
          jobIdRef.current = null;
          setStartEvents(null);
          setJobStartedAt(null);
          setFinalStatusOverride(null);
          latestJobRef.current = null;
          wasDisconnectedRef.current = false;
          reconnectCountRef.current = 0;
          liveOdometerRef.current = 0;
          startOdometerRef.current = null;
          ferryDistanceRef.current = 0;
          actualDrivenDistanceRef.current = 0;
          usedFerryOrTrainRef.current = false;
          teleportDetectedRef.current = false;
        }, 5000);
      }
    }
  }, [user, connected, stickyPlannedDistance, jobStartedAt, finalStatusOverride, isJobActive, data.truck.dash.odometer, data.truck.navigation.distance, data.job, pendingJob, data.job?.cargoId, data.truck.brand, data.truck.name, startOdometer, jobId, data.truck.dash.fuel, data.events, startExpenses, startEvents, isLogging]);

  const prepareJobData = useCallback(() => {
    // Priority: Live Data -> Final Cached Snapshot -> Original Padding Snapshot
    // This stops SDK wipes from erasing the exact final distanceKm/income 
    const job = data.job && !data.job.active && data.events.jobEvent !== 0 ? data.job
      : (data.job || latestJobRef.current || pendingJob);
    if (!job) return null;

    // Exact Actual Distance: derived from continuous tick-by-tick odometer accumulator
    // This perfectly ignores ferry gaps and teleport jumps naturally.
    let driven = actualDrivenDistanceRef.current;

    // Failsafe fallback if for some reason the accumulator didn't tick
    if (driven <= 0 && data.job?.distanceKm) {
      driven = data.job.distanceKm;
      // Only if we fallback to SCS distance do we need to estimate and subtract ferry distance
      if (usedFerryOrTrainRef.current && startOdometerRef.current !== null) {
        const odomDelta = liveOdometerRef.current - startOdometerRef.current;
        const pDist = stickyPlannedDistance || data.job?.plannedDistance || 0;
        if (pDist > 0 && odomDelta >= 0 && odomDelta < pDist) {
          const estFerry = pDist - odomDelta;
          driven = Math.max(0, driven - estFerry);
        }
      }
    }

    // Safety: cap to sane range
    if (driven < 0 || driven > 20000) {
      driven = stickyPlannedDistance || 0;
    }

    // Status Logic
    const isCancelled = job.cargoEvent === 2 || data.events.jobEvent === 2 || finalStatusOverride === 'cancelled';
    const finalStatus = isCancelled ? 'cancelled' : (finalStatusOverride || 'delivered');

    // Use the continuous live fuel accumulator so refueling doesn't reset it
    const fuelConsumed = accumulatedFuel;

    // Expenses Delta (Phase 2 Split Breakdown)
    const finesDelta = Math.max(0, (data.events.fineAmount || 0) - (startExpenses?.fines || 0));
    const tollsDelta = Math.max(0, (data.events.tollAmount || 0) - (startExpenses?.tolls || 0));
    const repairsDelta = Math.max(0, (data.events.repairAmount || 0) - (startExpenses?.repairs || 0));
    const ferryDelta = Math.max(0, (data.events.ferryAmount || 0) - (startExpenses?.ferry || 0));
    const trainDelta = Math.max(0, (data.events.trainAmount || 0) - (startExpenses?.train || 0));
    const totalExpenses = finesDelta + tollsDelta + repairsDelta + ferryDelta + trainDelta;

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
        job_id: jobIdRef.current || jobId || crypto.randomUUID(),
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
        toll_amount: 0,
        repair_amount: 0,
        ferry_amount: 0,
        train_amount: 0,
        damage_percent: 0,
        truck_name: `${data.truck.brand} ${data.truck.name}`,
        truck_id: data.truck.brand,
        trailer_id: (data.trailer[0]?.id && data.trailer[0].id !== 'none') ? data.trailer[0].id : (pendingJob?.cargoAccessoryId || job.cargoAccessoryId || 'none'),
        status: 'cancelled',
        auto_park: job.autoPark || false,
        auto_load: job.autoLoad || false,
        job_market: job.market || 'freight',
        mp_time_offset: data.game.mpTimeOffset || 0,
        is_special_transport: job.isSpecial || false,
        delivery_date: new Date().toISOString(),
        started_at: jobStartedAt || new Date().toISOString(),
        duration_seconds: durationSeconds,
        had_reconnect: wasDisconnectedRef.current,
        reconnect_count: reconnectCountRef.current,
        used_ferry: usedFerryOrTrainRef.current,
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
    if (fuelEconomy === 0 && movingFuelTrackRef.current > 0 && driven > 0) {
      fuelEconomy = (movingFuelTrackRef.current / driven) * 100;
    } else if (fuelEconomy > 0) {
      // Convert SDK L/km to L/100km if it relies on SCS average
      fuelEconomy = fuelEconomy * 100;
    }

    return {
      job_id: jobIdRef.current || jobId || crypto.randomUUID(),
      origin_city: job.source,
      destination_city: job.destination,
      planned_distance_km: Math.round(plannedKm),
      distance_km: driven > 0 ? Math.round(driven) : 0,
      cargo_type: job.cargo,
      cargo_weight: Math.floor(job.cargoMass / 1000),
      fuel_consumed: Math.round(fuelConsumed),
      avg_fuel_consumption: Number(fuelEconomy.toFixed(2)),
      income: Math.round(job.income),
      revenue: Math.round(job.revenue || job.finalIncome || job.income || 0),
      xp_earned: calculatedXp,
      expenses: Math.round(totalExpenses),
      fine_amount: Math.round(finesDelta),
      toll_amount: Math.round(tollsDelta),
      repair_amount: Math.round(repairsDelta),
      ferry_amount: Math.round(ferryDelta),
      train_amount: Math.round(trainDelta),
      damage_percent: Math.floor(damagePercent * 10) / 10,
      truck_name: `${data.truck.brand || prevTruckBrandRef.current} ${data.truck.name || prevTruckNameRef.current}`.trim(),
      truck_id: data.truck.brand || prevTruckBrandRef.current || 'unknown',
      trailer_id: (data.trailer[0]?.id && data.trailer[0].id !== 'none') ? data.trailer[0].id : (pendingJob?.cargoAccessoryId || job.cargoAccessoryId || 'none'),
      status: finalStatus,
      auto_park: job.autoPark || false,
      auto_load: job.autoLoad || false,
      job_market: job.market || 'freight',
      mp_time_offset: data.game.mpTimeOffset || 0,
      is_special_transport: job.isSpecial || false,
      delivery_date: new Date().toISOString(),
      started_at: jobStartedAt || new Date().toISOString(),
      duration_seconds: durationSeconds,
      had_reconnect: wasDisconnectedRef.current,
      reconnect_count: reconnectCountRef.current,
      used_ferry: usedFerryOrTrainRef.current,
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
    usedFerryOrTrain: usedFerryOrTrainRef.current,
    teleportDetected: teleportDetectedRef.current,
  };
}
