import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { GlassCard } from '@/components/layout/GlassCard';
import { Input } from '@/components/ui/input';
import { usePresenceStore } from '@/stores/appStore';
import { Search, MapPin, DollarSign, Package, Fuel, ExternalLink, Clock, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow, format } from 'date-fns';

interface PlayerStat {
  user_id: string;
  username: string;
  tmp_id: string | null;
  avatar_url: string | null;
  last_active: string | null;
  is_online: boolean;
  total_distance: number;
  total_income: number;
  total_deliveries: number;
  total_fuel: number;
  total_damage_percent: number;
}

export function PlayerStats() {
  const [stats, setStats] = useState<PlayerStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [userJobs, setUserJobs] = useState<any[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);

  const onlineUsers = usePresenceStore(state => state.onlineUsers);

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      try {
        const [profilesRes, jobsRes] = await Promise.all([
          supabase.from('profiles').select('*'),
          supabase.from('job_logs').select('user_id, distance_km, income, fuel_consumed, status, delivery_date, damage_percent')
        ]);

        const profiles = (profilesRes.data || []) as any[];
        const jobs = (jobsRes.data || []) as any[];

        const aggregated: Record<string, PlayerStat> = {};

        profiles.forEach(p => {
          aggregated[p.user_id] = {
            user_id: p.user_id,
            username: p.username,
            tmp_id: p.tmp_id,
            avatar_url: p.avatar_url,
            last_active: p.last_seen || p.updated_at,
            is_online: !!p.is_online,
            total_distance: 0,
            total_income: 0,
            total_deliveries: 0,
            total_fuel: 0,
            total_damage_percent: 0
          };
        });

        jobs.forEach(j => {
          if (j.status === 'delivered' && aggregated[j.user_id]) {
            aggregated[j.user_id].total_distance += Number(j.distance_km || 0);
            aggregated[j.user_id].total_income += Number(j.income || 0);
            aggregated[j.user_id].total_fuel += Number(j.fuel_consumed || 0);
            aggregated[j.user_id].total_deliveries += 1;
            aggregated[j.user_id].total_damage_percent += Number(j.damage_percent || 0);

            // update last active if delivery date is more recent and we don't have a recent last_seen
            if (j.delivery_date && !profiles.find(p => p.user_id === j.user_id)?.last_seen) {
              const currentLastActive = aggregated[j.user_id].last_active ? new Date(aggregated[j.user_id].last_active!).getTime() : 0;
              const jobDeliveryDate = new Date(j.delivery_date).getTime();
              if (jobDeliveryDate > currentLastActive) {
                aggregated[j.user_id].last_active = j.delivery_date;
              }
            }
          }
        });

        // Convert the record back to array and sort by deliveries descending
        const sortedArray = Object.values(aggregated).sort((a, b) => b.total_deliveries - a.total_deliveries);
        setStats(sortedArray);

      } catch (err) {
        console.error('Failed to fetch player stats:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const toggleUser = async (userId: string) => {
    if (expandedUser === userId) {
      setExpandedUser(null);
      return;
    }
    setExpandedUser(userId);
    setJobsLoading(true);
    try {
      const { data } = await supabase.from('job_logs').select('*').eq('user_id', userId).order('delivery_date', { ascending: false }).limit(50);
      setUserJobs(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setJobsLoading(false);
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
    return num.toLocaleString(undefined, { maximumFractionDigits: 0 });
  };

  const formatCurrency = (num: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  };

  const filteredStats = activeSearch.trim() === '' ? [] : stats.filter(s =>
    s.username.toLowerCase().includes(activeSearch.toLowerCase()) ||
    (s.tmp_id && s.tmp_id.includes(activeSearch))
  );

  return (
    <GlassCard>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            Player Statistics
          </h3>
          <p className="text-sm text-muted-foreground">Aggregated performance & activity of all players across the platform</p>
        </div>
        <div className="flex w-full sm:w-auto items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <Input
              placeholder="Search players..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && setActiveSearch(search)}
              className="pl-9 glass-input w-full"
            />
          </div>
          <Button
            variant="outline"
            onClick={() => setActiveSearch(search)}
            className="shrink-0 rounded-full"
          >
            Search
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-48">
          <span className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></span>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="border-b border-border/50 bg-muted/30">
                <th className="text-left py-3 px-4 font-medium text-sm text-muted-foreground">Player</th>
                <th className="text-right py-3 px-4 font-medium text-sm text-muted-foreground">Distance</th>
                <th className="text-right py-3 px-4 font-medium text-sm text-muted-foreground">Income</th>
                <th className="text-right py-3 px-4 font-medium text-sm text-muted-foreground">Deliveries</th>
                <th className="text-right py-3 px-4 font-medium text-sm text-muted-foreground">Fuel</th>
                <th className="text-right py-3 px-4 font-medium text-sm text-muted-foreground">Damage</th>
                <th className="text-center py-3 px-4 font-medium text-sm text-muted-foreground">Status / Last Active</th>
                <th className="py-3 px-4 flex justify-end"></th>
              </tr>
            </thead>
            <tbody>
              {filteredStats.map(stat => {
                // Determine online status combining the DB field and the real-time presence store
                const isOnline = stat.is_online || onlineUsers.has(stat.user_id);
                return (
                  <React.Fragment key={stat.user_id}>
                    <tr
                      className="border-b border-border/20 hover:bg-muted/10 transition-colors cursor-pointer"
                      onClick={() => toggleUser(stat.user_id)}
                    >
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/20 flex flex-shrink-0 items-center justify-center text-primary font-bold overflow-hidden">
                            {stat.avatar_url ? (
                              <img src={stat.avatar_url} alt={stat.username} className="w-full h-full object-cover" />
                            ) : (
                              stat.username.charAt(0).toUpperCase()
                            )}
                          </div>
                          <div>
                            <p className="font-semibold">{stat.username}</p>
                            {stat.tmp_id ? (
                              <a
                                href={`https://truckersmp.com/user/${stat.tmp_id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-primary hover:underline flex items-center gap-1 opacity-80"
                              >
                                TMP: {stat.tmp_id} <ExternalLink size={10} />
                              </a>
                            ) : (
                              <p className="text-xs text-muted-foreground">No TMP ID</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <span className="flex items-center justify-end gap-1.5 text-cyan">
                          <MapPin size={14} className="opacity-70" />
                          {formatNumber(stat.total_distance)} km
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <span className="flex items-center justify-end gap-1.5 text-amber">
                          <DollarSign size={14} className="opacity-70" />
                          {formatCurrency(stat.total_income)}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <span className="flex items-center justify-end gap-1.5 text-green-400">
                          <Package size={14} className="opacity-70" />
                          {formatNumber(stat.total_deliveries)}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <span className="flex items-center justify-end gap-1.5 text-purple">
                          <Fuel size={14} className="opacity-70" />
                          {formatNumber(stat.total_fuel)} L
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <span className={`flex items-center justify-end gap-1.5 ${(stat.total_deliveries > 0 ? stat.total_damage_percent / stat.total_deliveries : 0) > 0 ? 'text-red-400' : 'text-green-400'}`}>
                          <AlertTriangle size={14} className="opacity-70" />
                          {(stat.total_deliveries > 0 ? (stat.total_damage_percent / stat.total_deliveries) : 0).toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <div className="flex flex-col items-center justify-center text-xs whitespace-nowrap">
                          {isOnline ? (
                            <span className="flex items-center gap-1.5 text-green-500 font-medium">
                              <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                              </span>
                              Online now
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <Clock size={12} />
                              {stat.last_active ? `${formatDistanceToNow(new Date(stat.last_active))} ago` : 'Last seen unknown'}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-4 text-muted-foreground">
                        <div className="flex justify-end">
                          {expandedUser === stat.user_id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </div>
                      </td>
                    </tr>
                    {expandedUser === stat.user_id && (
                      <tr className="bg-muted/5 border-b border-border/20">
                        <td colSpan={7} className="px-4 py-6">
                          <div className="pl-14 space-y-3 relative">
                            <div className="absolute left-7 top-0 bottom-0 w-px bg-border/50"></div>
                            <h4 className="text-sm font-semibold flex items-center gap-2 text-foreground mb-4">
                              <Package size={16} className="text-primary" /> Recent Jobs
                            </h4>

                            {jobsLoading ? (
                              <div className="text-xs text-muted-foreground flex items-center gap-2">
                                <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></span>
                                Loading jobs...
                              </div>
                            ) : userJobs.length > 0 ? (
                              <div className="space-y-2">
                                {userJobs.map(job => (
                                  <div key={job.id} className="flex flex-col sm:flex-row sm:items-center justify-between text-xs p-3 rounded-lg bg-background/50 border border-border/30 gap-2">
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                      <div className="p-1.5 rounded bg-muted/50 text-muted-foreground whitespace-nowrap flex-shrink-0">
                                        {job.delivery_date ? format(new Date(job.delivery_date), 'MMM dd') : 'Unknown'}
                                      </div>
                                      <div className="font-medium truncate flex-1 min-w-0">
                                        {job.source_city} <span className="text-muted-foreground px-1">→</span> {job.destination_city}
                                      </div>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-3 sm:gap-4 flex-shrink-0 mt-1 sm:mt-0 text-muted-foreground">
                                      <span className="flex items-center gap-1"><Package size={12} /> {job.cargo}</span>
                                      <span className="flex items-center gap-1 text-cyan"><MapPin size={12} /> {job.distance_km} km</span>
                                      <span className="flex items-center gap-1 text-amber"><DollarSign size={12} /> {job.income}</span>
                                      {job.damage_percent !== undefined && job.damage_percent !== null && (
                                        <span className={`flex items-center gap-1 ${job.damage_percent > 0 ? 'text-red-400' : 'text-green-400'}`}>
                                          <AlertTriangle size={12} /> {Number(job.damage_percent).toFixed(1)}%
                                        </span>
                                      )}
                                      <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-[10px] uppercase font-bold ${job.status === 'delivered' ? 'bg-green-500/20 text-green-400' :
                                        job.status === 'cancelled' ? 'bg-rose-500/20 text-rose-400' :
                                          'bg-cyan-500/20 text-cyan-400'
                                        }`}>
                                        {job.status || 'Delivered'}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-xs text-muted-foreground p-3 bg-muted/20 rounded border border-dashed border-border/50">
                                No recent deliveries found.
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              {filteredStats.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted-foreground">
                    {activeSearch.trim() === '' ? 'Enter a player name and click search to view their statistics' : 'No players found based on your search'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </GlassCard>
  );
}
