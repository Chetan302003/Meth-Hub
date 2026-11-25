import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface FleetStats {
  total_distance: number;
  total_deliveries: number;
  total_fuel: number;
  total_income: number;
  total_expenses: number;
  total_profit: number;
  active_drivers: number;
  total_load_weight: number;
}

export interface MonthlyDataPoint {
  month: string;
  monthKey: string;
  distance: number;
  income: number;
  expenses: number;
  profit: number;
  trips: number;
}

export interface CargoDistributionItem {
  name: string;
  category?: string;
  value: number; // percentage share
  count: number; // delivery count
  weight: number; // total load weight in tonnes
  color: string;
  fleetRank?: number; // persistent global rank in fleet
}

export interface RouteDataPoint {
  route: string;
  trips: number;
  distance: number; // average distance in km
}

export interface FleetAnalyticsResult {
  stats: FleetStats;
  monthlyData: MonthlyDataPoint[];
  cargoDistribution: CargoDistributionItem[];
  allCargos: CargoDistributionItem[];
  categoryDistribution: CargoDistributionItem[];
  allCategories: CargoDistributionItem[];
  routeData: RouteDataPoint[];
}

export interface LeaderboardEntry {
  user_id: string;
  username: string;
  avatar_url: string | null;
  total_distance: number;
  total_deliveries: number;
  total_earnings: number;
}

// 20 high-contrast, distinct HSL colors for persistent cargo assignment
export const CARGO_COLOR_PALETTE = [
  'hsl(150, 100%, 45%)', // Vibrant Emerald
  'hsl(195, 100%, 48%)', // Electric Cyan
  'hsl(235, 95%, 65%)',  // Bright Indigo
  'hsl(280, 90%, 65%)',  // Vivid Purple
  'hsl(35, 100%, 52%)',  // Amber / Gold
  'hsl(340, 90%, 60%)',  // Rose / Coral
  'hsl(175, 95%, 45%)',  // Aqua Marine
  'hsl(85, 90%, 48%)',   // Lime
  'hsl(15, 100%, 58%)',  // Tangerine / Orange
  'hsl(260, 95%, 65%)',  // Violet
  'hsl(320, 85%, 60%)',  // Magenta
  'hsl(210, 100%, 55%)', // Azure
  'hsl(45, 100%, 50%)',  // Yellow
  'hsl(165, 100%, 42%)', // Mint Emerald
  'hsl(300, 85%, 55%)',  // Orchid
  'hsl(190, 95%, 45%)',  // Sky Blue
  'hsl(10, 95%, 58%)',   // Crimson
  'hsl(70, 95%, 45%)',   // Chartreuse
  'hsl(245, 90%, 68%)',  // Periwinkle
  'hsl(330, 90%, 55%)',  // Pink
];

// Curated persistent colors for common commodities so they are immediately recognizable
export const KNOWN_CARGO_COLORS: Record<string, string> = {
  diesel: 'hsl(35, 100%, 52%)',
  petrol: 'hsl(45, 100%, 50%)',
  gasoline: 'hsl(40, 100%, 50%)',
  apples: 'hsl(150, 100%, 45%)',
  cars: 'hsl(195, 100%, 48%)',
  trucks: 'hsl(210, 100%, 55%)',
  medical: 'hsl(340, 90%, 60%)',
  medicines: 'hsl(340, 90%, 60%)',
  vaccines: 'hsl(340, 90%, 60%)',
  electronics: 'hsl(280, 90%, 65%)',
  passengers: 'hsl(235, 95%, 65%)',
  cattle: 'hsl(85, 90%, 48%)',
  gravel: 'hsl(215, 30%, 65%)',
  steel: 'hsl(205, 40%, 65%)',
  wood: 'hsl(25, 75%, 50%)',
  milk: 'hsl(180, 80%, 75%)',
  wheat: 'hsl(50, 90%, 55%)',
  chemicals: 'hsl(290, 85%, 60%)',
  others: 'hsl(215, 20%, 55%)',
};

// Generates persistent, deterministic HSL color for any arbitrary or modded cargo string
export function getPersistentCargoColor(rawName: string): string {
  if (!rawName) return CARGO_COLOR_PALETTE[0];
  const normalized = rawName.trim().toLowerCase();
  if (normalized === 'others') return 'hsl(215, 20%, 55%)';
  if (KNOWN_CARGO_COLORS[normalized]) {
    return KNOWN_CARGO_COLORS[normalized];
  }
  // djb2 hash algorithm
  let hash = 5381;
  for (let i = 0; i < normalized.length; i++) {
    hash = ((hash << 5) + hash) + normalized.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % CARGO_COLOR_PALETTE.length;
  return CARGO_COLOR_PALETTE[index];
}

// Backward-compatibility alias
export const getDeterministicColor = getPersistentCargoColor;

// Legacy palette export for backward compatibility
export const CARGO_PALETTE = CARGO_COLOR_PALETTE;

// Dedicated semantic colors for Industry Categories
export const CATEGORY_COLORS: Record<string, string> = {
  'Machinery & Vehicles': 'hsl(195, 100%, 50%)',    // Cyan
  'Chemicals & Fuel': 'hsl(35, 100%, 55%)',          // Amber
  'Food & Agriculture': 'hsl(150, 100%, 50%)',       // Neon Emerald
  'Construction & Building': 'hsl(215, 30%, 65%)',   // Cool Slate
  'Electronics & High-Tech': 'hsl(280, 100%, 65%)',  // Vivid Purple
  'Medical & Pharma': 'hsl(340, 90%, 60%)',          // Rose
  'Passengers & Transit': 'hsl(235, 100%, 65%)',     // Bright Indigo
  'Heavy & Oversized': 'hsl(15, 100%, 60%)',         // Tangerine / Orange
  'Livestock & Feed': 'hsl(85, 90%, 50%)',           // Lime
  'General & Logistics': 'hsl(175, 95%, 45%)',       // Aqua Marine
  'Unclassified': 'hsl(215, 15%, 50%)',              // Slate Gray
  'Others': 'hsl(215, 20%, 55%)',                    // Neutral Slate
};

// ── Tier 1: Comprehensive ETS2 / ATS / Bus cargo ID dictionary ──
export const ETS2_CARGO_MAP: Record<string, string> = {
  // Passengers / Bus Transit
  passengers: 'Passengers & Transit',
  passenger: 'Passengers & Transit',
  tourists: 'Passengers & Transit',
  tourist: 'Passengers & Transit',
  commuters: 'Passengers & Transit',
  commuter: 'Passengers & Transit',
  charter: 'Passengers & Transit',
  coach: 'Passengers & Transit',
  transit: 'Passengers & Transit',
  students: 'Passengers & Transit',
  student: 'Passengers & Transit',
  vip: 'Passengers & Transit',

  // Chemicals, Fuel & ADR Hazardous
  diesel: 'Chemicals & Fuel',
  petrol: 'Chemicals & Fuel',
  gasoline: 'Chemicals & Fuel',
  fuel: 'Chemicals & Fuel',
  oil: 'Chemicals & Fuel',
  motor_oil: 'Chemicals & Fuel',
  crude_oil: 'Chemicals & Fuel',
  chemicals: 'Chemicals & Fuel',
  acid: 'Chemicals & Fuel',
  chlorine: 'Chemicals & Fuel',
  propane: 'Chemicals & Fuel',
  lpg: 'Chemicals & Fuel',
  kerosene: 'Chemicals & Fuel',
  nitrogen: 'Chemicals & Fuel',
  liquid_nitrogen: 'Chemicals & Fuel',
  sodium_hypochlorite: 'Chemicals & Fuel',
  sodium: 'Chemicals & Fuel',
  solvents: 'Chemicals & Fuel',
  solvent: 'Chemicals & Fuel',
  toxic: 'Chemicals & Fuel',
  toxic_waste: 'Chemicals & Fuel',
  cyanide: 'Chemicals & Fuel',
  sulfur: 'Chemicals & Fuel',
  pesticides: 'Chemicals & Fuel',
  pesticide: 'Chemicals & Fuel',
  fertilizer: 'Chemicals & Fuel',
  fertilizers: 'Chemicals & Fuel',
  hydrochloric_acid: 'Chemicals & Fuel',
  sulfuric_acid: 'Chemicals & Fuel',
  acetylene: 'Chemicals & Fuel',
  fluorine: 'Chemicals & Fuel',
  oxygen: 'Chemicals & Fuel',
  hydrogen: 'Chemicals & Fuel',
  paint: 'Chemicals & Fuel',
  paints: 'Chemicals & Fuel',
  explosives: 'Chemicals & Fuel',
  explosive: 'Chemicals & Fuel',
  dynamite: 'Chemicals & Fuel',
  fireworks: 'Chemicals & Fuel',
  adr: 'Chemicals & Fuel',

  // Machinery & Vehicles
  cars: 'Machinery & Vehicles',
  car: 'Machinery & Vehicles',
  trucks: 'Machinery & Vehicles',
  truck: 'Machinery & Vehicles',
  truck_batteries: 'Machinery & Vehicles',
  truck_rims: 'Machinery & Vehicles',
  truck_tyres: 'Machinery & Vehicles',
  tractors: 'Machinery & Vehicles',
  tractor: 'Machinery & Vehicles',
  excavator: 'Machinery & Vehicles',
  excavators: 'Machinery & Vehicles',
  bulldozer: 'Machinery & Vehicles',
  bulldozers: 'Machinery & Vehicles',
  machinery: 'Machinery & Vehicles',
  forklift: 'Machinery & Vehicles',
  forklifts: 'Machinery & Vehicles',
  motor: 'Machinery & Vehicles',
  motors: 'Machinery & Vehicles',
  engine: 'Machinery & Vehicles',
  engines: 'Machinery & Vehicles',
  generator: 'Machinery & Vehicles',
  generators: 'Machinery & Vehicles',
  boat: 'Machinery & Vehicles',
  boats: 'Machinery & Vehicles',
  tyres: 'Machinery & Vehicles',
  tires: 'Machinery & Vehicles',
  auto: 'Machinery & Vehicles',
  vehicles: 'Machinery & Vehicles',
  vehicle: 'Machinery & Vehicles',
  harvester: 'Machinery & Vehicles',
  combine_harvester: 'Machinery & Vehicles',
  digger: 'Machinery & Vehicles',
  wheel_loader: 'Machinery & Vehicles',
  backhoe_loader: 'Machinery & Vehicles',
  motorcycles: 'Machinery & Vehicles',
  motorcycle: 'Machinery & Vehicles',
  scooters: 'Machinery & Vehicles',
  dumper: 'Machinery & Vehicles',
  chassis: 'Machinery & Vehicles',

  // Heavy & Oversized
  heavy_cargo: 'Heavy & Oversized',
  oversize: 'Heavy & Oversized',
  oversized: 'Heavy & Oversized',
  locomotive: 'Heavy & Oversized',
  boiler: 'Heavy & Oversized',
  transformer: 'Heavy & Oversized',
  transformers: 'Heavy & Oversized',
  wind_blade: 'Heavy & Oversized',
  wind_turbine_blade: 'Heavy & Oversized',
  wind_turbine_nacelle: 'Heavy & Oversized',
  wind_turbine_tower: 'Heavy & Oversized',
  turbine: 'Heavy & Oversized',
  turbines: 'Heavy & Oversized',
  crawler: 'Heavy & Oversized',
  crawler_tractor: 'Heavy & Oversized',
  yacht: 'Heavy & Oversized',
  silo: 'Heavy & Oversized',
  crane: 'Heavy & Oversized',
  mobile_crane: 'Heavy & Oversized',
  haul_truck: 'Heavy & Oversized',
  haul_truck_chassis: 'Heavy & Oversized',
  pilot_boat: 'Heavy & Oversized',
  industrial_condenser: 'Heavy & Oversized',
  concrete_beams: 'Heavy & Oversized',

  // Food & Agriculture
  food: 'Food & Agriculture',
  apples: 'Food & Agriculture',
  apple: 'Food & Agriculture',
  milk: 'Food & Agriculture',
  cheese: 'Food & Agriculture',
  meat: 'Food & Agriculture',
  beef: 'Food & Agriculture',
  pork: 'Food & Agriculture',
  chicken: 'Food & Agriculture',
  fish: 'Food & Agriculture',
  potatoes: 'Food & Agriculture',
  potato: 'Food & Agriculture',
  tomatoes: 'Food & Agriculture',
  tomato: 'Food & Agriculture',
  onions: 'Food & Agriculture',
  onion: 'Food & Agriculture',
  fruit: 'Food & Agriculture',
  fruits: 'Food & Agriculture',
  vegetables: 'Food & Agriculture',
  vegetable: 'Food & Agriculture',
  beverages: 'Food & Agriculture',
  beverage: 'Food & Agriculture',
  beer: 'Food & Agriculture',
  wine: 'Food & Agriculture',
  water: 'Food & Agriculture',
  mineral_water: 'Food & Agriculture',
  juice: 'Food & Agriculture',
  bread: 'Food & Agriculture',
  flour: 'Food & Agriculture',
  sugar: 'Food & Agriculture',
  sugar_beet: 'Food & Agriculture',
  wheat: 'Food & Agriculture',
  grain: 'Food & Agriculture',
  barley: 'Food & Agriculture',
  corn: 'Food & Agriculture',
  rice: 'Food & Agriculture',
  coffee: 'Food & Agriculture',
  tea: 'Food & Agriculture',
  chocolate: 'Food & Agriculture',
  ice_cream: 'Food & Agriculture',
  frozen_food: 'Food & Agriculture',
  frozen_fruits: 'Food & Agriculture',
  oranges: 'Food & Agriculture',
  orange: 'Food & Agriculture',
  lemons: 'Food & Agriculture',
  lemon: 'Food & Agriculture',
  grapes: 'Food & Agriculture',
  hops: 'Food & Agriculture',
  yogurt: 'Food & Agriculture',
  butter: 'Food & Agriculture',
  pasta: 'Food & Agriculture',
  cereal: 'Food & Agriculture',
  crops: 'Food & Agriculture',
  soybeans: 'Food & Agriculture',
  sunflower_seeds: 'Food & Agriculture',

  // Construction, Building & Metals
  gravel: 'Construction & Building',
  sand: 'Construction & Building',
  cement: 'Construction & Building',
  concrete: 'Construction & Building',
  bricks: 'Construction & Building',
  brick: 'Construction & Building',
  steel: 'Construction & Building',
  steel_pipes: 'Construction & Building',
  steel_plates: 'Construction & Building',
  iron: 'Construction & Building',
  iron_pipes: 'Construction & Building',
  copper: 'Construction & Building',
  metal: 'Construction & Building',
  pipes: 'Construction & Building',
  pipe: 'Construction & Building',
  timber: 'Construction & Building',
  wood: 'Construction & Building',
  wood_bark: 'Construction & Building',
  wood_shavings: 'Construction & Building',
  lumber: 'Construction & Building',
  logs: 'Construction & Building',
  log: 'Construction & Building',
  glass: 'Construction & Building',
  tiles: 'Construction & Building',
  tile: 'Construction & Building',
  marble: 'Construction & Building',
  stone: 'Construction & Building',
  granite: 'Construction & Building',
  asphalt: 'Construction & Building',
  scaffolding: 'Construction & Building',
  beams: 'Construction & Building',
  sheet_metal: 'Construction & Building',
  ore: 'Construction & Building',
  iron_ore: 'Construction & Building',
  coal: 'Construction & Building',
  quartz: 'Construction & Building',
  limestone: 'Construction & Building',
  slabs: 'Construction & Building',
  insulation: 'Construction & Building',
  roof_tiles: 'Construction & Building',

  // Electronics & High-Tech
  electronics: 'Electronics & High-Tech',
  electronic: 'Electronics & High-Tech',
  computers: 'Electronics & High-Tech',
  computer: 'Electronics & High-Tech',
  hardware: 'Electronics & High-Tech',
  appliances: 'Electronics & High-Tech',
  tech: 'Electronics & High-Tech',
  microchips: 'Electronics & High-Tech',
  microchip: 'Electronics & High-Tech',
  circuits: 'Electronics & High-Tech',
  circuit: 'Electronics & High-Tech',
  cables: 'Electronics & High-Tech',
  cable: 'Electronics & High-Tech',
  battery: 'Electronics & High-Tech',
  batteries: 'Electronics & High-Tech',
  precision_tools: 'Electronics & High-Tech',
  optical_instruments: 'Electronics & High-Tech',
  telecom: 'Electronics & High-Tech',
  displays: 'Electronics & High-Tech',
  smartphones: 'Electronics & High-Tech',
  phones: 'Electronics & High-Tech',
  servers: 'Electronics & High-Tech',
  semiconductors: 'Electronics & High-Tech',
  wire: 'Electronics & High-Tech',

  // Medical & Pharmaceuticals
  medical: 'Medical & Pharma',
  pharma: 'Medical & Pharma',
  pharmaceuticals: 'Medical & Pharma',
  vaccines: 'Medical & Pharma',
  vaccine: 'Medical & Pharma',
  medicines: 'Medical & Pharma',
  medicine: 'Medical & Pharma',
  drugs: 'Medical & Pharma',
  hospital_supplies: 'Medical & Pharma',
  surgical_equipment: 'Medical & Pharma',
  first_aid: 'Medical & Pharma',
  bandages: 'Medical & Pharma',
  syringes: 'Medical & Pharma',
  disinfectant: 'Medical & Pharma',
  sanitary: 'Medical & Pharma',

  // Livestock & Animal Feed
  livestock: 'Livestock & Feed',
  cattle: 'Livestock & Feed',
  pigs: 'Livestock & Feed',
  pig: 'Livestock & Feed',
  cows: 'Livestock & Feed',
  cow: 'Livestock & Feed',
  sheep: 'Livestock & Feed',
  horses: 'Livestock & Feed',
  horse: 'Livestock & Feed',
  animal_feed: 'Livestock & Feed',
  feed: 'Livestock & Feed',
  hay: 'Livestock & Feed',
  poultry: 'Livestock & Feed',
  straw: 'Livestock & Feed',

  // General & Logistics
  general_cargo: 'General & Logistics',
  packaged_goods: 'General & Logistics',
  pallets: 'General & Logistics',
  mail: 'General & Logistics',
  parcels: 'General & Logistics',
  postage: 'General & Logistics',
  consumer_goods: 'General & Logistics',
  cardboard: 'General & Logistics',
  paper: 'General & Logistics',
  waste_paper: 'General & Logistics',
  empty_pallets: 'General & Logistics',
  used_packaging: 'General & Logistics',
  plastic: 'General & Logistics',
};

// ── Tier 2: Whole-word keyword regex matchers as fallback ──
const TIER2_CATEGORY_REGEX: Array<{ category: string; regex: RegExp }> = [
  {
    category: 'Passengers & Transit',
    regex: /\b(passengers?|commuters?|tourists?|charter|coach|transit|students?|vip)\b/i,
  },
  {
    category: 'Heavy & Oversized',
    regex: /\b(heavy|oversize|oversized|locomotive|boiler|transformer|turbines?|crawler|yacht|silo|cranes?|haul\s+truck|pilot\s+boat)\b/i,
  },
  {
    category: 'Chemicals & Fuel',
    regex: /\b(diesel|petrol|gasoline|fuels?|oils?|chemicals?|acids?|chlorine|propane|gas|petroleum|nitrogen|sodium|solvents?|toxic|cyanide|kerosene|sulfur|pesticides?|fertilizers?|hydrochloric|sulfuric|acetylene|fluorine|adr|oxygen|hydrogen|paints?|explosives?|dynamite)\b/i,
  },
  {
    category: 'Machinery & Vehicles',
    regex: /\b(trucks?|cars?|vehicles?|tractors?|excavators?|bulldozers?|machinery|forklifts?|motors?|engines?|generators?|boats?|tyres?|tires?|auto|harvesters?|diggers?|wheels?|axles?|scooters?|motorcycles?|combines?|equipment|dumper|chassis)\b/i,
  },
  {
    category: 'Food & Agriculture',
    regex: /\b(foods?|milks?|cheese|meats?|beef|pork|chicken|fish|apples?|potatoes?|tomatoes?|onions?|fruits?|vegetables?|beverages?|beer|wines?|water|juice|bread|flour|sugar|wheat|grains?|barley|corn|rice|coffee|tea|chocolate|ice\s+cream|frozen|oranges?|lemons?|grapes?|hops|yogurt|butter|pasta|cereals?|crops?|soybeans?)\b/i,
  },
  {
    category: 'Construction & Building',
    regex: /\b(gravel|sand|cement|concrete|bricks?|steels?|irons?|copper|metals?|pipes?|timber|wood|lumber|logs?|glass|tiles?|marble|stones?|granite|asphalt|scaffolds?|scaffolding|beams?|sheets?|ores?|coal|quartz|limestone|slabs?|insulation|roof)\b/i,
  },
  {
    category: 'Electronics & High-Tech',
    regex: /\b(electronics?|computers?|hardware|appliances?|tech|microchips?|circuits?|cables?|batter(y|ies)|precision|optical|instruments?|telecom|displays?|phones?|servers?|wires?|semiconductors?)\b/i,
  },
  {
    category: 'Medical & Pharma',
    regex: /\b(medical|pharma|vaccines?|medicines?|drugs?|hospitals?|surgical|first\s+aid|bandages?|syringes?|sanitary|disinfectants?)\b/i,
  },
  {
    category: 'Livestock & Feed',
    regex: /\b(livestock|cattle|pigs?|cows?|sheep|horses?|animals?|feeds?|hay|poultry|straw)\b/i,
  },
  {
    category: 'General & Logistics',
    regex: /\b(logistics|parcels?|packages?|pallets?|postal|mail|cartons?|cardboard|paper|packaging|plastics?|goods)\b/i,
  },
];

// 3-Tier cargo categorizer: ETS2 ID map -> Whole-word regex -> 'Unclassified'
export function getCargoCategory(cargoName: string): string {
  if (!cargoName || !cargoName.trim()) return 'Unclassified';

  const clean = cargoName.trim().toLowerCase();
  const underscoreKey = clean.replace(/[\s-]+/g, '_');
  const spaceKey = clean.replace(/[_-]+/g, ' ');

  // Tier 1: Exact ETS2 / ATS cargo ID dictionary mapping
  if (ETS2_CARGO_MAP[clean]) return ETS2_CARGO_MAP[clean];
  if (ETS2_CARGO_MAP[underscoreKey]) return ETS2_CARGO_MAP[underscoreKey];
  if (ETS2_CARGO_MAP[spaceKey]) return ETS2_CARGO_MAP[spaceKey];

  // Tier 2: Whole-word keyword matching
  for (const { category, regex } of TIER2_CATEGORY_REGEX) {
    if (regex.test(spaceKey)) {
      return category;
    }
  }

  // Tier 3: Unclassified category for unknown cargoes
  return 'Unclassified';
}

// Normalizes cargo weights across Telemetry, SQLite and Supabase to tonnes without premature rounding
export function normalizeWeightToTonnes(rawWeight: any, rawMass?: any): number {
  if (rawMass !== undefined && rawMass !== null) {
    const m = Number(rawMass);
    if (!isNaN(m) && m > 0) {
      return Number((m / 1000).toFixed(2));
    }
  }
  const w = Number(rawWeight);
  if (isNaN(w) || w <= 0) return 0;
  // In ETS2/ATS, maximum possible cargo weight in tonnes is ~70-100t (Special Transport locomotive).
  // Any value > 100 represents raw kilograms (e.g. 400 kg -> 0.4 t, 24000 kg -> 24.0 t).
  // For values <= 100, it is already stored in tonnes (e.g. 0.4 t, 24 t).
  return w > 100 ? Number((w / 1000).toFixed(2)) : Number(w.toFixed(2));
}

function parseJobDate(job: any): Date | null {
  const raw = job.delivery_date || job.completed_at || job.created_at;
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

export function generateEmptyMonthlyData(): MonthlyDataPoint[] {
  const now = new Date();
  const result: MonthlyDataPoint[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleString('en-US', { month: 'short' });
    result.push({
      month: label,
      monthKey: key,
      distance: 0,
      income: 0,
      expenses: 0,
      profit: 0,
      trips: 0,
    });
  }
  return result;
}

function formatCargoName(rawCargo: string | null | undefined): string {
  if (!rawCargo || !rawCargo.trim()) return 'General Cargo';
  const trimmed = rawCargo.trim();
  const spaced = trimmed.replace(/[_-]+/g, ' ');
  return spaced
    .split(' ')
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

export function useFleetStats() {
  const {
    data,
    isLoading: loadingStats,
    error: statsError,
    refetch: refetchStats
  } = useQuery<FleetAnalyticsResult>({
    queryKey: ['fleetStats'],
    queryFn: async (): Promise<FleetAnalyticsResult> => {
      // 1. Fetch delivered jobs from Supabase using pagination to bypass the default 1000-row limit
      const rawJobs: any[] = [];
      const PAGE_SIZE = 1000;
      let from = 0;
      let hasMore = true;

      while (hasMore) {
        const { data: pageData, error } = await (supabase as any)
          .from('job_logs')
          .select('*')
          .or('status.eq.delivered,status.is.null')
          .range(from, from + PAGE_SIZE - 1);

        if (error) {
          console.error('Failed to fetch job_logs from Supabase:', error);
          throw new Error(error.message || 'Failed to fetch job logs');
        }

        if (pageData && pageData.length > 0) {
          rawJobs.push(...pageData);
          if (pageData.length < PAGE_SIZE) {
            hasMore = false;
          } else {
            from += PAGE_SIZE;
          }
        } else {
          hasMore = false;
        }
      }

      // 2. Fetch local SQLite queue (offline or recently logged jobs) with bidirectional deduplication
      const existingIds = new Set<string>();
      rawJobs.forEach((j: any) => {
        if (j.id) existingIds.add(String(j.id).trim().toLowerCase());
        if (j.job_id) existingIds.add(String(j.job_id).trim().toLowerCase());
      });

      if (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__) {
        try {
          const Database = (await import('@tauri-apps/plugin-sql')).default;
          const db = await Database.load('sqlite:meth_logs.db');
          const localRows = await db.select<any[]>('SELECT * FROM job_logs_queue');
          if (localRows && localRows.length > 0) {
            for (const row of localRows) {
              try {
                const parsed = typeof row.job_data === 'string' ? JSON.parse(row.job_data) : row.job_data;
                const id = row.id || parsed?.id || parsed?.job_id;
                const normId = id ? String(id).trim().toLowerCase() : null;
                const normJobId = parsed?.job_id ? String(parsed.job_id).trim().toLowerCase() : null;

                const isDuplicate = (normId && existingIds.has(normId)) || (normJobId && existingIds.has(normJobId));

                if (!isDuplicate) {
                  const status = parsed?.status;
                  const isCompleted = status === 'delivered' || status === null || status === undefined;
                  const isNotExcluded = status !== 'cancelled' && status !== 'failed' && status !== 'aborted' && status !== 'active';

                  if (isCompleted && isNotExcluded) {
                    rawJobs.push({ ...parsed, id: id || crypto.randomUUID() });
                    if (normId) existingIds.add(normId);
                    if (normJobId) existingIds.add(normJobId);
                  }
                }
              } catch {
                // ignore corrupted row
              }
            }
          }
        } catch {
          // SQLite probe not available or in web mode
        }
      }

      // Filter strictly for delivered or legacy completed jobs, excluding cancelled/failed/aborted
      const eligibleJobs = rawJobs.filter((job: any) => {
        const s = job.status;
        const isCompleted = s === 'delivered' || s === null || s === undefined;
        const isNotExcluded = s !== 'cancelled' && s !== 'failed' && s !== 'aborted' && s !== 'active';
        return isCompleted && isNotExcluded;
      });

      const baseStats: FleetStats = {
        total_distance: 0,
        total_deliveries: 0,
        total_fuel: 0,
        total_income: 0,
        total_expenses: 0,
        total_profit: 0,
        active_drivers: 0,
        total_load_weight: 0,
      };

      if (!eligibleJobs || eligibleJobs.length === 0) {
        return {
          stats: baseStats,
          monthlyData: generateEmptyMonthlyData(),
          cargoDistribution: [],
          allCargos: [],
          categoryDistribution: [],
          allCategories: [],
          routeData: [],
        };
      }

      // Aggregate Fleet Totals
      const activeDriversSet = new Set<string>();

      eligibleJobs.forEach((job: any) => {
        if (job.user_id) activeDriversSet.add(job.user_id);
        const income = Number(job.income) || Number(job.revenue) || 0;
        const fuelConsumed = Number(job.fuel_consumed) || 0;
        const fuelCost = Number(job.fuel_cost) || (fuelConsumed * 1.5);
        const otherExpense = Number(job.other_expenses) || 0;
        const totalJobExpense = Number(job.expenses) || (fuelCost + otherExpense);
        const distance = Number(job.distance_km) || 0;
        const weight = normalizeWeightToTonnes(job.cargo_weight, job.cargo_mass);

        baseStats.total_distance += distance;
        baseStats.total_deliveries += 1;
        baseStats.total_fuel += fuelConsumed;
        baseStats.total_income += income;
        baseStats.total_expenses += totalJobExpense;
        baseStats.total_profit += (income - totalJobExpense);
        baseStats.total_load_weight += weight;
      });

      baseStats.active_drivers = activeDriversSet.size;
      baseStats.total_load_weight = Number(baseStats.total_load_weight.toFixed(1));

      // ── 1. Monthly Performance & Distance Trend ──
      const now = new Date();
      const validJobDates = eligibleJobs.map(parseJobDate).filter((d): d is Date => d !== null);

      let minDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      let maxDate = new Date(now.getFullYear(), now.getMonth(), 1);

      if (validJobDates.length > 0) {
        const earliestJob = new Date(Math.min(...validJobDates.map(d => d.getTime())));
        const latestJob = new Date(Math.max(...validJobDates.map(d => d.getTime())));
        const earliestMonth = new Date(earliestJob.getFullYear(), earliestJob.getMonth(), 1);
        const latestMonth = new Date(latestJob.getFullYear(), latestJob.getMonth(), 1);

        if (earliestMonth < minDate) {
          minDate = earliestMonth;
        }
        if (latestMonth > maxDate) {
          maxDate = latestMonth;
        }
      }

      const monthlyBuckets: Record<string, MonthlyDataPoint> = {};
      const orderedKeys: string[] = [];

      let curr = new Date(minDate);
      while (curr <= maxDate) {
        const key = `${curr.getFullYear()}-${String(curr.getMonth() + 1).padStart(2, '0')}`;
        const monthName = curr.toLocaleString('en-US', { month: 'short' });
        const label = (minDate.getFullYear() !== maxDate.getFullYear())
          ? `${monthName} '${String(curr.getFullYear()).slice(-2)}`
          : monthName;

        monthlyBuckets[key] = {
          month: label,
          monthKey: key,
          distance: 0,
          income: 0,
          expenses: 0,
          profit: 0,
          trips: 0,
        };
        orderedKeys.push(key);
        curr = new Date(curr.getFullYear(), curr.getMonth() + 1, 1);
      }

      eligibleJobs.forEach((job: any) => {
        const d = parseJobDate(job);
        if (!d) return;
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (!monthlyBuckets[key]) {
          const monthName = d.toLocaleString('en-US', { month: 'short' });
          monthlyBuckets[key] = {
            month: monthName,
            monthKey: key,
            distance: 0,
            income: 0,
            expenses: 0,
            profit: 0,
            trips: 0,
          };
          orderedKeys.push(key);
        }

        const income = Number(job.income) || Number(job.revenue) || 0;
        const fuelConsumed = Number(job.fuel_consumed) || 0;
        const fuelCost = Number(job.fuel_cost) || (fuelConsumed * 1.5);
        const otherExpense = Number(job.other_expenses) || 0;
        const expenses = Number(job.expenses) || (fuelCost + otherExpense);
        const distance = Number(job.distance_km) || 0;

        monthlyBuckets[key].income += income;
        monthlyBuckets[key].expenses += expenses;
        monthlyBuckets[key].profit += (income - expenses);
        monthlyBuckets[key].distance += distance;
        monthlyBuckets[key].trips += 1;
      });

      orderedKeys.sort();
      const monthlyData = (orderedKeys.length > 12 ? orderedKeys.slice(-12) : orderedKeys).map(k => ({
        ...monthlyBuckets[k],
        distance: Math.round(monthlyBuckets[k].distance),
        income: Math.round(monthlyBuckets[k].income),
        expenses: Math.round(monthlyBuckets[k].expenses),
        profit: Math.round(monthlyBuckets[k].profit),
      }));

      // ── 2. Cargo Distribution & Categorization ──
      const cargoMap: Record<string, { count: number; weight: number; category: string }> = {};
      const categoryMap: Record<string, { count: number; weight: number }> = {};
      let totalCargoJobs = 0;

      eligibleJobs.forEach((job: any) => {
        const name = formatCargoName(job.cargo_type || job.cargo_name || job.cargo);
        const category = getCargoCategory(name);
        const weight = normalizeWeightToTonnes(job.cargo_weight, job.cargo_mass);

        if (!cargoMap[name]) {
          cargoMap[name] = { count: 0, weight: 0, category };
        }
        cargoMap[name].count += 1;
        cargoMap[name].weight += weight;

        if (!categoryMap[category]) {
          categoryMap[category] = { count: 0, weight: 0 };
        }
        categoryMap[category].count += 1;
        categoryMap[category].weight += weight;

        totalCargoJobs += 1;
      });

      // 1. All Cargos list (untruncated, sorted descending by count, then weight)
      // Requirement 1: Persistent colors by name/ID, NOT ranking
      // Requirement 6: Persistent fleetRank
      // Requirement 7: Improved percentage precision
      const sortedCargos = Object.entries(cargoMap).sort((a, b) => b[1].count - a[1].count || b[1].weight - a[1].weight);
      const allCargos: CargoDistributionItem[] = sortedCargos.map(([name, val], idx) => {
        const rawShare = totalCargoJobs > 0 ? (val.count / totalCargoJobs) * 100 : 0;
        const value = rawShare < 0.1 && rawShare > 0 ? Number(rawShare.toFixed(2)) : Number(rawShare.toFixed(1));
        return {
          name,
          category: val.category,
          count: val.count,
          weight: Number(val.weight.toFixed(1)),
          value,
          color: getPersistentCargoColor(name),
          fleetRank: idx + 1,
        };
      });

      // 2. Cargo Distribution (Top 8 + Others segment)
      let cargoDistribution: CargoDistributionItem[] = [];
      if (allCargos.length <= 8) {
        cargoDistribution = allCargos;
      } else {
        const top8 = allCargos.slice(0, 8);
        const rest = allCargos.slice(8);
        const otherCount = rest.reduce((sum, item) => sum + item.count, 0);
        const otherWeight = rest.reduce((sum, item) => sum + item.weight, 0);
        const rawOtherShare = totalCargoJobs > 0 ? (otherCount / totalCargoJobs) * 100 : 0;
        const otherPercentage = rawOtherShare < 0.1 && rawOtherShare > 0
          ? Number(rawOtherShare.toFixed(2))
          : Number(rawOtherShare.toFixed(1));

        cargoDistribution = [
          ...top8,
          {
            name: 'Others',
            category: 'Miscellaneous',
            count: otherCount,
            weight: Number(otherWeight.toFixed(1)),
            value: otherPercentage,
            color: 'hsl(215, 20%, 55%)', // Neutral slate for Others
            fleetRank: 9,
          },
        ];
      }

      // 3. All Categories list (untruncated, sorted descending by count, then weight)
      const sortedCategories = Object.entries(categoryMap).sort((a, b) => b[1].count - a[1].count || b[1].weight - a[1].weight);
      const allCategories: CargoDistributionItem[] = sortedCategories.map(([catName, val], idx) => {
        const rawShare = totalCargoJobs > 0 ? (val.count / totalCargoJobs) * 100 : 0;
        const value = rawShare < 0.1 && rawShare > 0 ? Number(rawShare.toFixed(2)) : Number(rawShare.toFixed(1));
        return {
          name: catName,
          category: catName,
          count: val.count,
          weight: Number(val.weight.toFixed(1)),
          value,
          color: CATEGORY_COLORS[catName] || CARGO_COLOR_PALETTE[idx % CARGO_COLOR_PALETTE.length],
          fleetRank: idx + 1,
        };
      });

      // 4. Category Distribution (Requirement 4: Display ALL active industry categories, no Top 8 + Others restriction)
      const categoryDistribution: CargoDistributionItem[] = allCategories;

      // ── 3. Popular Routes ──
      const routeMap: Record<string, { route: string; trips: number; totalDistance: number }> = {};

      eligibleJobs.forEach((job: any) => {
        const origin = (job.origin_city || job.source_city || '').trim();
        const dest = (job.destination_city || job.dest_city || '').trim();
        if (!origin && !dest) return;

        const o = origin || 'Unknown';
        const d = dest || 'Unknown';
        const routeKey = `${o} → ${d}`;

        if (!routeMap[routeKey]) {
          routeMap[routeKey] = { route: routeKey, trips: 0, totalDistance: 0 };
        }
        routeMap[routeKey].trips += 1;
        routeMap[routeKey].totalDistance += Number(job.distance_km) || 0;
      });

      const routeData: RouteDataPoint[] = Object.values(routeMap)
        .sort((a, b) => b.trips - a.trips || b.totalDistance - a.totalDistance)
        .slice(0, 6)
        .map(r => ({
          route: r.route,
          trips: r.trips,
          distance: Math.round(r.totalDistance / r.trips),
        }));

      return {
        stats: baseStats,
        monthlyData,
        cargoDistribution,
        allCargos,
        categoryDistribution,
        allCategories,
        routeData,
      };
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  const {
    data: leaderboard = [],
    isLoading: loadingLeaderboard,
    error: leaderboardError,
    refetch: refetchLeaderboard
  } = useQuery({
    queryKey: ['fleetLeaderboard'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_leaderboard', { limit_count: 10 });
      if (error) throw error;
      return data as unknown as LeaderboardEntry[];
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  const refresh = async () => {
    await Promise.all([refetchStats(), refetchLeaderboard()]);
  };

  return {
    stats: data?.stats || null,
    monthlyData: data?.monthlyData || generateEmptyMonthlyData(),
    cargoDistribution: data?.cargoDistribution || [],
    allCargos: data?.allCargos || [],
    categoryDistribution: data?.categoryDistribution || [],
    allCategories: data?.allCategories || [],
    routeData: data?.routeData || [],
    leaderboard,
    loading: loadingStats || loadingLeaderboard,
    error: statsError?.message || leaderboardError?.message || null,
    refresh
  };
}

export function usePersonalStats(userId: string | undefined) {
  const {
    data,
    isLoading: loading,
    refetch
  } = useQuery({
    queryKey: ['personalStats', userId],
    queryFn: async () => {
      if (!userId) return null;
      
      const { data: allJobs, error } = await (supabase as any)
        .from('job_logs')
        .select('*')
        .eq('user_id', userId)
        .order('delivery_date', { ascending: false });

      if (error) throw error;

      if (allJobs && allJobs.length > 0) {
        const deliveredJobs = allJobs.filter((j: any) => j.status === 'delivered' || !j.status);
        const total_distance = deliveredJobs.reduce((sum: number, j: any) => sum + Number(j.distance_km || 0), 0);
        const total_income = deliveredJobs.reduce((sum: number, j: any) => sum + Number(j.income || 0), 0);
        const total_fuel = deliveredJobs.reduce((sum: number, j: any) => sum + Number(j.fuel_consumed || 0), 0);
        const avg_damage = deliveredJobs.length > 0
          ? deliveredJobs.reduce((sum: number, j: any) => sum + Number(j.damage_percent || 0), 0) / deliveredJobs.length
          : 0;

        return {
          stats: {
            total_distance,
            total_deliveries: deliveredJobs.length,
            total_income,
            total_fuel,
            avg_damage
          },
          recentJobs: allJobs.slice(0, 100)
        };
      }
      return {
        stats: {
          total_distance: 0,
          total_deliveries: 0,
          total_income: 0,
          total_fuel: 0,
          avg_damage: 0
        },
        recentJobs: []
      };
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  return { 
    stats: data?.stats || null, 
    recentJobs: data?.recentJobs || [], 
    loading, 
    refresh: refetch 
  };
}

export function useWeeklyData() {
  const {
    data: weeklyData = [
      { day: 'Mon', distance: 0, income: 0 },
      { day: 'Tue', distance: 0, income: 0 },
      { day: 'Wed', distance: 0, income: 0 },
      { day: 'Thu', distance: 0, income: 0 },
      { day: 'Fri', distance: 0, income: 0 },
      { day: 'Sat', distance: 0, income: 0 },
      { day: 'Sun', distance: 0, income: 0 },
    ],
    isLoading: loading,
  } = useQuery({
    queryKey: ['weeklyData'],
    queryFn: async () => {
      const today = new Date();
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

      const { data: jobs, error } = await (supabase as any)
        .from('job_logs')
        .select('delivery_date, distance_km, income')
        .eq('status', 'delivered')
        .gte('delivery_date', sevenDaysAgo.toISOString())
        .order('delivery_date', { ascending: true });

      if (error) throw error;

      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const dailyData: Record<string, { distance: number; income: number }> = {};

      for (let i = 0; i < 7; i++) {
        const date = new Date(sevenDaysAgo);
        date.setDate(date.getDate() + i);
        const dayName = dayNames[date.getDay()];
        dailyData[dayName] = { distance: 0, income: 0 };
      }

      (jobs || []).forEach((job: any) => {
        if (job.delivery_date) {
          const date = new Date(job.delivery_date);
          const dayName = dayNames[date.getDay()];
          if (dailyData[dayName]) {
            dailyData[dayName].distance += Number(job.distance_km || 0);
            dailyData[dayName].income += Number(job.income || 0);
          }
        }
      });

      const orderedData = [];
      for (let i = 0; i < 7; i++) {
        const date = new Date(sevenDaysAgo);
        date.setDate(date.getDate() + i);
        const dayName = dayNames[date.getDay()];
        orderedData.push({
          day: dayName,
          ...dailyData[dayName],
        });
      }

      return orderedData;
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  return { weeklyData, loading };
}