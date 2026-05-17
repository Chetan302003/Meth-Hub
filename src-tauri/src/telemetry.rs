// src-tauri/src/telemetry.rs
// Synchronized with minimal aura_hub_telemetry.cpp + requested channels
// Shared Memory Version: 1

use serde::Serialize;
use std::ffi::OsStr;
use std::iter::once;
use std::os::windows::ffi::OsStrExt;
use windows::Win32::Foundation::CloseHandle;
use windows::Win32::System::Memory::{
    MapViewOfFile, OpenFileMappingW, UnmapViewOfFile, FILE_MAP_READ,
};

const SHARED_MEM_NAME: &str = "Local\\AuraHubTelemetry";
const SHARED_MEM_VERSION: u32 = 6;
const MAX_WHEELS: usize = 16;
const MAX_TRAILERS: usize = 3;
const MAX_HSHIFTER_SLOTS: usize = 32;

#[repr(C, packed)]
#[derive(Copy, Clone)]
struct AuraPlacementRaw {
    pub x: f32, pub y: f32, pub z: f32,
    pub heading: f32, pub pitch: f32, pub roll: f32,
}

#[repr(C)]
#[derive(Copy, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AuraPlacement {
    pub x: f32,
    pub y: f32,
    pub z: f32,
    pub heading: f32,
    pub pitch: f32,
    pub roll: f32,
}

impl From<AuraPlacementRaw> for AuraPlacement {
    fn from(raw: AuraPlacementRaw) -> Self {
        Self {
            x: raw.x,
            y: raw.y,
            z: raw.z,
            heading: raw.heading,
            pitch: raw.pitch,
            roll: raw.roll,
        }
    }
}

#[repr(C, packed)]
#[derive(Copy, Clone)]
struct AuraFVectorRaw {
    pub x: f32, pub y: f32, pub z: f32,
}

#[repr(C)]
#[derive(Copy, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AuraFVector {
    pub x: f32,
    pub y: f32,
    pub z: f32,
}

impl From<AuraFVectorRaw> for AuraFVector {
    fn from(raw: AuraFVectorRaw) -> Self {
        Self { x: raw.x, y: raw.y, z: raw.z }
    }
}

#[repr(C, packed)]
#[derive(Copy, Clone)]
struct AuraTelemetryRaw {
    // --- Meta ---
    version: u32,
    plugin_version: [u8; 16],
    sdk_active: u8,
    paused: u8,
    _pad: [u8; 2],

    // --- Game time ---
    game_time_minutes: u32,
    local_scale: f32,
    next_rest_stop: i32,
    mp_time_offset: i32,

    // --- Live map ---
    truck_placement: AuraPlacementRaw,
    trailer_placement: [AuraPlacementRaw; MAX_TRAILERS],
    cabin_placement: AuraPlacementRaw,
    head_placement: AuraPlacementRaw,
    hook_placement: AuraPlacementRaw,

    // --- Truck physics ---
    vel_linear: AuraFVectorRaw,
    vel_angular: AuraFVectorRaw,
    acc_linear: AuraFVectorRaw,
    acc_angular: AuraFVectorRaw,
    cabin_offset: AuraFVectorRaw,
    cabin_vel_angular: AuraFVectorRaw,
    cabin_acc_angular: AuraFVectorRaw,
    head_offset: AuraFVectorRaw,

    // --- Truck dashboard ---
    speed: f32,
    cruise_control_speed: f32,
    cruise_control_on: u8,
    engine_enabled: u8,
    electric_enabled: u8,
    wipers_on: u8,
    engine_rpm: f32,
    engine_rpm_max: f32,
    displayed_gear: i32,
    engine_gear: i32,
    odometer_km: f32,
    dashboard_backlight: f32,

    // --- Fuel & AdBlue ---
    fuel: f32,
    fuel_capacity: f32,
    fuel_avg_consumption: f32,
    fuel_range: f32,
    fuel_warning: u8,
    fuel_warning_factor: f32,
    adblue: f32,
    adblue_capacity: f32,
    adblue_warning: u8,
    adblue_warning_factor: f32,
    _pad2: [u8; 2],

    // --- Engine health ---
    oil_pressure: f32,
    oil_pressure_warning: u8,
    oil_pressure_warning_val: f32,
    oil_temperature: f32,
    water_temperature: f32,
    water_temp_warning: u8,
    water_temp_warning_val: f32,
    battery_voltage: f32,
    battery_warning: u8,
    battery_warning_val: f32,
    brake_air_pressure: f32,
    brake_air_warning: u8,
    brake_air_emergency: u8,
    brake_air_warning_val: f32,
    brake_air_emergency_val: f32,
    brake_temperature: f32,
    _pad3: [u8; 2],

    // --- Brakes & drivetrain ---
    parking_brake: u8,
    motor_brake: u8,
    retarder_level: u32,
    diff_lock: u8,
    lift_axle: u8,
    lift_axle_indicator: u8,
    trailer_lift_axle: u8,
    trailer_lift_axle_ind: u8,
    hshifter_slot: u32,
    hshifter_select: u8,
    _pad4: [u8; 3],

    // --- Driver inputs ---
    input_steering: f32,
    input_throttle: f32,
    input_brake: f32,
    input_clutch: f32,
    effective_steering: f32,
    effective_throttle: f32,
    effective_brake: f32,
    effective_clutch: f32,

    // --- Lights ---
    light_beam_low: u8,
    light_beam_high: u8,
    light_parking: u8,
    light_beacon: u8,
    light_brake: u8,
    light_reverse: u8,
    light_lblinker: u8,
    light_rblinker: u8,
    light_aux_front: u32,
    light_aux_roof: u32,
    lblinker: u8,
    rblinker: u8,
    hazard_warning: u8,

    // --- Wear ---
    wear_engine: f32,
    wear_transmission: f32,
    wear_cabin: f32,
    wear_chassis: f32,
    wear_wheels: f32,

    // --- Navigation ---
    navigation_time: f32,
    navigation_distance: f32,
    navigation_speed_limit: f32,

    // --- Truck identity ---
    truck_brand_id: [u8; 32],
    truck_brand: [u8; 64],
    truck_name: [u8; 64],
    license_plate: [u8; 16],
    plate_country: [u8; 32],
    plate_country_id: [u8; 16],
    gears_forward: u32,
    gears_reverse: u32,
    retarder_steps: u32,
    diff_ratio: f32,
    forward_ratio: f32,
    reverse_ratio: f32,
    shifter_type: [u8; 16],
    wheel_count: u32,
    selector_count: u32,

    // --- HShifter slots ---
    slot_gear: [i32; MAX_HSHIFTER_SLOTS],
    slot_handle_position: [u32; MAX_HSHIFTER_SLOTS],
    slot_selectors: [u32; MAX_HSHIFTER_SLOTS],

    // --- Per-wheel ---
    wheel_on_ground: [u8; MAX_WHEELS],
    wheel_substance: [u32; MAX_WHEELS],
    wheel_susp_deflection: [f32; MAX_WHEELS],
    wheel_velocity: [f32; MAX_WHEELS],
    wheel_rotation: [f32; MAX_WHEELS],
    wheel_steering: [f32; MAX_WHEELS],
    wheel_lift: [u8; MAX_WHEELS],
    wheel_lift_offset: [f32; MAX_WHEELS],

    // --- Trailers ---
    trailer_attached: [u8; MAX_TRAILERS],
    trailer_wear_chassis: [f32; MAX_TRAILERS],
    trailer_id: [[u8; 32]; MAX_TRAILERS],
    trailer_brand: [[u8; 64]; MAX_TRAILERS],
    trailer_body_type: [[u8; 32]; MAX_TRAILERS],
    trailer_chain_type: [[u8; 32]; MAX_TRAILERS],
    trailer_plate: [[u8; 16]; MAX_TRAILERS],
    trailer_vel_linear: [AuraFVectorRaw; MAX_TRAILERS],
    trailer_vel_angular: [AuraFVectorRaw; MAX_TRAILERS],
    trailer_acc_linear: [AuraFVectorRaw; MAX_TRAILERS],
    trailer_acc_angular: [AuraFVectorRaw; MAX_TRAILERS],

    // --- Trailer per-wheel ---
    trailer_wheel_on_ground: [u8; MAX_WHEELS],
    trailer_wheel_substance: [u32; MAX_WHEELS],
    trailer_wheel_susp: [f32; MAX_WHEELS],
    trailer_wheel_velocity: [f32; MAX_WHEELS],
    trailer_wheel_rotation: [f32; MAX_WHEELS],
    trailer_wheel_steering: [f32; MAX_WHEELS],

    // --- Job config ---
    job_active: u8,
    job_is_special: u8,
    job_finished_count: u32,
    job_event: u8, // 0=none, 1=delivered, 2=cancelled
    _pad5: [u8; 1],
    job_income: i64,
    job_delivery_time: u32,
    job_cargo_damage: f32,
    job_cargo_damage_initial: f32,
    job_cargo_mass: f32,
    job_cargo_unit_count: u32,
    job_cargo_unit_mass: f32,
    job_planned_distance_km: f32,
    job_cargo_id: [u8; 64],
    job_cargo_name: [u8; 64],
    cargo_accessory_id: [u8; 64],
    job_market: [u8; 32],
    job_source_city: [u8; 64],
    job_source_city_id: [u8; 32],
    job_source_company: [u8; 64],
    job_source_company_id: [u8; 32],
    job_destination_city: [u8; 64],
    job_destination_city_id: [u8; 32],
    job_destination_company: [u8; 64],
    job_destination_company_id: [u8; 32],

    // --- Delivery result ---
    job_revenue: u64,
    job_xp: u32,
    job_distance_driven_km: f32,
    job_auto_park_used: u8,
    job_auto_load_used: u8,
    _pad6: [u8; 2],

    // --- Event snapshots ---
    job_cancel_penalty: f32,
    last_fine_amount: f32,
    last_fine_offence: [u8; 64],
    last_toll_amount: f32,
    last_ferry_amount: f32,
    last_ferry_source: [u8; 64],
    last_ferry_dest: [u8; 64],
    last_ferry_source_id: [u8; 64],
    last_ferry_target_id: [u8; 64],
    last_train_amount: f32,
    last_train_source: [u8; 64],
    last_train_dest: [u8; 64],
    last_train_source_id: [u8; 64],
    last_train_target_id: [u8; 64],
    last_repair_cost: f32,
    last_refuel_amount: f32,

    // --- Finance cumulative ---
    event_fine_amount: i64,
    event_fine_count: u32,
    event_toll_amount: i64,
    event_toll_count: u32,
    event_fuel_amount: i64,
    event_fuel_count: u32,
    event_repair_amount: i64,
    event_repair_count: u32,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TelemetryData {
    pub game: GameInfo,
    pub truck: TruckInfo,
    pub trailer: Vec<TrailerInfo>, // Changed to array
    pub job: Option<JobInfo>,
    pub events: EventSummary,
    pub timestamp: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GameInfo {
    pub connected: bool,
    pub paused: bool,
    pub time: u32,
    pub plugin_version: String,
    pub mp_time_offset: i32,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TruckInfo {
    pub brand: String,
    pub name: String,
    pub speed: f32,
    pub rpm: f32,
    pub gear: i32,
    pub cruise_control: bool,
    pub fuel: f32,
    pub fuel_capacity: f32,
    pub odometer: f32,
    pub wear: TruckWear,
    pub dash: DashStats,
    pub lights: LightsInfo,
    pub inputs: InputInfo,
    pub geometry: GeometryInfo,
    pub pos: AuraPlacement, // Added main truck pos
    pub navigation: NavigationInfo,
    pub thresholds: ThresholdInfo,
    pub license_plate: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TruckWear {
    pub engine: f32,
    pub transmission: f32,
    pub cabin: f32,
    pub chassis: f32,
    pub wheels: f32,
    pub total: f32,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DashStats {
    pub speed: f32,
    pub cruise_control_speed: f32,
    pub cruise_control_on: bool,
    pub engine_enabled: bool,
    pub electric_enabled: bool,
    pub wipers_on: bool,
    pub rpm: f32,
    pub rpm_max: f32,
    pub gear: i32,
    pub odometer: f32,
    pub dashboard_backlight: f32,
    pub fuel: f32,
    pub fuel_capacity: f32,
    pub fuel_avg_consumption: f32,
    pub fuel_range: f32,
    pub fuel_warning: bool,
    pub adblue: f32,
    pub adblue_capacity: f32,
    pub adblue_warning: bool,
    pub oil_pressure: f32,
    pub oil_pressure_warning: bool,
    pub oil_temperature: f32,
    pub water_temperature: f32,
    pub water_temp_warning: bool,
    pub battery_voltage: f32,
    pub battery_warning: bool,
    pub brake_air_pressure: f32,
    pub brake_air_warning: bool,
    pub brake_air_emergency: bool,
    pub brake_temperature: f32,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InputInfo {
    pub steering: f32,
    pub throttle: f32,
    pub brake: f32,
    pub clutch: f32,
    pub effective_steering: f32,
    pub cruise_control: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LightsInfo {
    pub low_beam: bool,
    pub high_beam: bool,
    pub parking: bool,
    pub beacon: bool,
    pub brake: bool,
    pub reverse: bool,
    pub lblinker: bool,
    pub rblinker: bool,
    pub hazard: bool,
    pub aux_front: u32,
    pub aux_roof: u32,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GeometryInfo {
    pub cabin_pos: AuraPlacement,
    pub head_pos: AuraPlacement,
    pub hook_pos: AuraPlacement,
    pub wheel_count: u32,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ThresholdInfo {
    pub fuel_warning_factor: f32,
    pub adblue_warning_factor: f32,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrailerInfo {
    pub attached: bool,
    pub id: String,
    pub brand: String,
    pub body_type: String,
    pub chain_type: String,
    pub license_plate: String,
    pub damage: f32,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NavigationInfo {
    pub distance: f32,
    pub time: f32,
    pub speed_limit: f32,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JobInfo {
    pub active: bool,
    pub cargo: String,
    pub cargo_id: String,
    pub source: String,
    pub destination: String,
    pub distance_km: f32, // Added
    pub income: u64,
    pub cargo_damage: f32,
    pub cargo_damage_live: f32,
    pub cargo_mass: f32,
    pub cargo_event: u8,
    pub cargo_accessory_id: String,
    pub planned_distance: f32,
    pub market: String,
    pub is_special: bool,
    pub revenue: u64,
    pub xp: u32,
    pub auto_park: bool,
    pub auto_load: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EventSummary {
    pub job_finished_count: u32,
    pub last_ferry_source_id: String,
    pub last_ferry_target_id: String,
    pub last_train_source_id: String,
    pub last_train_target_id: String,
    pub fine_amount: i64,
    pub toll_amount: i64,
    pub fuel_amount: i64,
    pub repair_amount: i64,
    pub fine_count: u32,
    pub toll_count: u32,
    pub fuel_count: u32,
    pub repair_count: u32,
    pub job_event: u8,
}

fn read_cstr(bytes: &[u8]) -> String {
    let end = bytes.iter().position(|&b| b == 0).unwrap_or(bytes.len());
    String::from_utf8_lossy(&bytes[..end]).into_owned()
}

fn wide(s: &str) -> Vec<u16> {
    OsStr::new(s).encode_wide().chain(once(0)).collect()
}

#[tauri::command]
pub fn get_telemetry_data() -> Result<TelemetryData, String> {
    unsafe {
        let name = wide(SHARED_MEM_NAME);
        let hmap = OpenFileMappingW(FILE_MAP_READ.0, false, windows::core::PCWSTR(name.as_ptr()))
            .map_err(|e| format!("OpenFileMapping failed: {}", e))?;

        if hmap.is_invalid() {
            return Err("Shared memory not found".into());
        }

        let ptr = MapViewOfFile(hmap, FILE_MAP_READ, 0, 0, std::mem::size_of::<AuraTelemetryRaw>());
        if ptr.Value.is_null() {
            CloseHandle(hmap).ok();
            return Err("MapViewOfFile failed".into());
        }

        let raw = std::ptr::read_unaligned(ptr.Value as *const AuraTelemetryRaw);
        UnmapViewOfFile(ptr).ok();
        CloseHandle(hmap).ok();

        let got_version = raw.version;
        if got_version != SHARED_MEM_VERSION {
            return Err(format!("Version mismatch: got {}, need {}", got_version, SHARED_MEM_VERSION));
        }

        let mut trailers = Vec::new();
        for i in 0..MAX_TRAILERS {
            let id = read_cstr(&raw.trailer_id[i]);
            let attached_flag = { raw.trailer_attached[i] };
            
            // The C++ plugin doesn't always set trailer_attached and doesn't clear trailer_id when detached.
            // trailer_placement is also always zero. 
            // We check multiple physics indicators (substance, on_ground, suspension) to detect presence.
            let mut has_physics = false;
            // Check the first 6 wheels of this trailer slot
            for w in 0..6 {
                let wheel_idx = i * 6 + w;
                if wheel_idx < MAX_WHEELS {
                    if { raw.trailer_wheel_substance[wheel_idx] } > 0 
                        || { raw.trailer_wheel_on_ground[wheel_idx] } > 0 
                        || { raw.trailer_wheel_susp[wheel_idx] } > 0.0 {
                        has_physics = true;
                        break;
                    }
                }
            }

            // If we have an active job and this is the first trailer slot, it's definitely attached
            let is_first_trailer_with_job = i == 0 && raw.job_active == 1 && !id.is_empty();

            let is_attached = attached_flag == 1 || is_first_trailer_with_job || (has_physics && !id.is_empty());

            if is_attached {
                trailers.push(TrailerInfo {
                    attached: true,
                    id,
                    brand: read_cstr(&raw.trailer_brand[i]),
                    body_type: read_cstr(&raw.trailer_body_type[i]),
                    chain_type: read_cstr(&raw.trailer_chain_type[i]),
                    license_plate: read_cstr(&raw.trailer_plate[i]),
                    damage: { raw.trailer_wear_chassis[i] } * 100.0,
                });
            }
        }

        Ok(TelemetryData {
            timestamp: std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs(),
            game: GameInfo {
                connected: raw.sdk_active == 1,
                paused: raw.paused == 1,
                time: raw.game_time_minutes,
                plugin_version: read_cstr(&raw.plugin_version),
                mp_time_offset: raw.mp_time_offset,
            },
            truck: TruckInfo {
                brand: read_cstr(&raw.truck_brand),
                name: read_cstr(&raw.truck_name),
                speed: raw.speed * 3.6,
                rpm: raw.engine_rpm,
                gear: raw.displayed_gear,
                cruise_control: raw.cruise_control_on == 1,
                fuel: raw.fuel,
                fuel_capacity: raw.fuel_capacity,
                odometer: raw.odometer_km,
                wear: TruckWear {
                    engine: raw.wear_engine * 100.0,
                    transmission: raw.wear_transmission * 100.0,
                    cabin: raw.wear_cabin * 100.0,
                    chassis: raw.wear_chassis * 100.0,
                    wheels: raw.wear_wheels * 100.0,
                    total: (raw.wear_engine.max(raw.wear_transmission).max(raw.wear_cabin).max(raw.wear_chassis).max(raw.wear_wheels)) * 100.0,
                },
                dash: DashStats {
                    speed: raw.speed * 3.6,
                    cruise_control_speed: raw.cruise_control_speed * 3.6,
                    cruise_control_on: raw.cruise_control_on == 1,
                    engine_enabled: raw.engine_enabled == 1,
                    electric_enabled: raw.electric_enabled == 1,
                    wipers_on: raw.wipers_on == 1,
                    rpm: raw.engine_rpm,
                    rpm_max: raw.engine_rpm_max,
                    gear: raw.displayed_gear,
                    odometer: raw.odometer_km,
                    dashboard_backlight: raw.dashboard_backlight,
                    fuel: raw.fuel,
                    fuel_capacity: raw.fuel_capacity,
                    fuel_avg_consumption: raw.fuel_avg_consumption,
                    fuel_range: raw.fuel_range,
                    fuel_warning: raw.fuel_warning == 1,
                    adblue: raw.adblue,
                    adblue_capacity: raw.adblue_capacity,
                    adblue_warning: raw.adblue_warning == 1,
                    oil_pressure: raw.oil_pressure,
                    oil_pressure_warning: raw.oil_pressure_warning == 1,
                    oil_temperature: raw.oil_temperature,
                    water_temperature: raw.water_temperature,
                    water_temp_warning: raw.water_temp_warning == 1,
                    battery_voltage: raw.battery_voltage,
                    battery_warning: raw.battery_warning == 1,
                    brake_air_pressure: raw.brake_air_pressure,
                    brake_air_warning: raw.brake_air_warning == 1,
                    brake_air_emergency: raw.brake_air_emergency == 1,
                    brake_temperature: raw.brake_temperature,
                },
                license_plate: read_cstr(&raw.license_plate),
                lights: LightsInfo {
                    low_beam: raw.light_beam_low == 1,
                    high_beam: raw.light_beam_high == 1,
                    parking: raw.light_parking == 1,
                    beacon: raw.light_beacon == 1,
                    brake: raw.light_brake == 1,
                    reverse: raw.light_reverse == 1,
                    lblinker: raw.light_lblinker == 1 || raw.lblinker == 1,
                    rblinker: raw.light_rblinker == 1 || raw.rblinker == 1,
                    hazard: raw.hazard_warning == 1,
                    aux_front: raw.light_aux_front,
                    aux_roof: raw.light_aux_roof,
                },
                inputs: InputInfo {
                    steering: raw.input_steering * 100.0,
                    throttle: raw.input_throttle * 100.0,
                    brake: raw.input_brake * 100.0,
                    clutch: raw.input_clutch * 100.0,
                    effective_steering: raw.effective_steering * 100.0,
                    cruise_control: raw.cruise_control_on == 1,
                },
                geometry: GeometryInfo {
                    cabin_pos: AuraPlacement::from(raw.cabin_placement),
                    head_pos: AuraPlacement::from(raw.head_placement),
                    hook_pos: AuraPlacement::from(raw.hook_placement),
                    wheel_count: raw.wheel_count, 
                },
                pos: AuraPlacement::from(raw.truck_placement), // Map main truck pos
                navigation: NavigationInfo {
                    distance: raw.navigation_distance,
                    time: raw.navigation_time,
                    speed_limit: raw.navigation_speed_limit,
                },
                thresholds: ThresholdInfo {
                    fuel_warning_factor: raw.fuel_warning_factor,
                    adblue_warning_factor: raw.adblue_warning_factor,
                },
            },
            trailer: trailers,
            job: if raw.job_active == 1 || raw.job_event != 0 {
                Some(JobInfo {
                    active: raw.job_active == 1,
                    cargo: read_cstr(&raw.job_cargo_name),
                    cargo_id: read_cstr(&raw.job_cargo_id),
                    source: read_cstr(&raw.job_source_city),
                    destination: read_cstr(&raw.job_destination_city),
                    distance_km: raw.job_distance_driven_km, // Map precision distance
                    income: raw.job_income as u64,
                    cargo_damage: raw.job_cargo_damage_initial * 100.0,
                    cargo_damage_live: raw.job_cargo_damage * 100.0,
                    cargo_mass: raw.job_cargo_mass,
                    cargo_event: raw.job_event,
                    cargo_accessory_id: read_cstr(&raw.cargo_accessory_id),
                    planned_distance: raw.job_planned_distance_km,
                    market: read_cstr(&raw.job_market),
                    is_special: raw.job_is_special == 1,
                    revenue: raw.job_revenue,
                    xp: raw.job_xp,
                    auto_park: raw.job_auto_park_used == 1,
                    auto_load: raw.job_auto_load_used == 1,
                })
            } else { None },
            events: EventSummary {
                job_finished_count: raw.job_finished_count,
                last_ferry_source_id: read_cstr(&raw.last_ferry_source_id),
                last_ferry_target_id: read_cstr(&raw.last_ferry_target_id),
                last_train_source_id: read_cstr(&raw.last_train_source_id),
                last_train_target_id: read_cstr(&raw.last_train_target_id),
                fine_amount: raw.event_fine_amount,
                toll_amount: raw.event_toll_amount,
                fuel_amount: raw.event_fuel_amount,
                repair_amount: raw.event_repair_amount,
                fine_count: raw.event_fine_count,
                toll_count: raw.event_toll_count,
                fuel_count: raw.event_fuel_count,
                repair_count: raw.event_repair_count,
                job_event: raw.job_event,
            },
        })
    }
}
