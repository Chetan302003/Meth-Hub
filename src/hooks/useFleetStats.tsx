import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface FleetStats {
  total_distance: number;
  total_deliveries: number;
  total_fuel: number;
  total_income: number;
  total_expenses: number;
  total_profit: number;
  active_drivers: number;
  total_load_weight: number;
}

interface LeaderboardEntry {
  user_id: string;
  username: string;
  avatar_url: string | null;
  total_distance: number;
  total_deliveries: number;
  total_earnings: number;
}

export function useFleetStats() {
  const {
    data: stats,
    isLoading: loadingStats,
    error: statsError,
    refetch: refetchStats
  } = useQuery({
    queryKey: ['fleetStats'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('job_logs')
        .select('*')
        .eq('status', 'delivered');
        
      if (error) throw error;
      const rawJobs = (data || []) as any[];

      if (!rawJobs || rawJobs.length === 0) {
        return {
          total_distance: 0,
          total_deliveries: 0,
          total_fuel: 0,
          total_income: 0,
          total_expenses: 0,
          total_profit: 0,
          active_drivers: 0,
          total_load_weight: 0
        };
      }

      const aggregated = rawJobs.reduce((acc, job: any) => {
        const income = Number(job.income) || 0;
        const fuelConsumed = Number(job.fuel_consumed) || 0;
        const fuelCost = Number(job.fuel_cost) || (fuelConsumed * 1.5);
        const otherExpense = Number(job.other_expenses) || 0;
        const totalJobExpense = fuelCost + otherExpense;

        return {
          total_distance: acc.total_distance + (Number(job.distance_km) || 0),
          total_deliveries: acc.total_deliveries + 1,
          total_fuel: acc.total_fuel + fuelConsumed,
          total_income: acc.total_income + income,
          total_expenses: acc.total_expenses + totalJobExpense,
          total_profit: acc.total_profit + (income - totalJobExpense),
          active_drivers: 0,
          total_load_weight: acc.total_load_weight + (Number(job.cargo_weight || job.cargo_mass) || 0)
        };
      }, {
        total_distance: 0,
        total_deliveries: 0,
        total_fuel: 0,
        total_income: 0,
        total_expenses: 0,
        total_profit: 0,
        active_drivers: 0,
        total_load_weight: 0
      });

      const activeDriversSet = new Set(rawJobs.map(j => j.user_id));
      aggregated.active_drivers = activeDriversSet.size;
      return aggregated;
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
    stats: stats || null,
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