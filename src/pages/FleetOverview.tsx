import React, { useState, useMemo } from 'react';
import { useFleetStats } from '@/hooks/useFleetStats';
import { GlassCard, StatCard } from '@/components/layout/GlassCard';
import {
  MapPin,
  Fuel,
  DollarSign,
  Package,
  TrendingUp,
  TrendingDown,
  Truck,
  Scale,
  RefreshCw,
  Route,
  BarChart3,
  Calendar,
  Layers,
  Search,
  AlertTriangle,
  ArrowLeft
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
  Sector
} from 'recharts';

export default function FleetOverview() {
  const {
    stats,
    monthlyData,
    cargoDistribution,
    allCargos,
    categoryDistribution,
    allCategories,
    routeData,
    loading,
    error,
    refresh
  } = useFleetStats();

  const [cargoSearchQuery, setCargoSearchQuery] = useState('');
  const [hoveredCategoryIndex, setHoveredCategoryIndex] = useState<number | undefined>(undefined);
  const [hoveredCategoryGridIndex, setHoveredCategoryGridIndex] = useState<number | undefined>(undefined);

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toFixed(0);
  };

  const formatCurrency = (num: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  };

  const formatCurrencyShort = (num: number) => {
    if (Math.abs(num) >= 1000000) return `$${(num / 1000000).toFixed(1)}M`;
    if (Math.abs(num) >= 1000) return `$${(num / 1000).toFixed(0)}k`;
    return `$${num}`;
  };

  // Real month-over-month trend calculations
  const currentMonthData = monthlyData.length > 0 ? monthlyData[monthlyData.length - 1] : null;
  const prevMonthData = monthlyData.length >= 2 ? monthlyData[monthlyData.length - 2] : null;

  const distanceTrend = prevMonthData && prevMonthData.distance > 0 && currentMonthData
    ? {
        value: Math.abs(Number((((currentMonthData.distance - prevMonthData.distance) / prevMonthData.distance) * 100).toFixed(1))),
        isPositive: currentMonthData.distance >= prevMonthData.distance
      }
    : undefined;

  const revenueTrend = prevMonthData && prevMonthData.income > 0 && currentMonthData
    ? {
        value: Math.abs(Number((((currentMonthData.income - prevMonthData.income) / prevMonthData.income) * 100).toFixed(1))),
        isPositive: currentMonthData.income >= prevMonthData.income
      }
    : undefined;

  const profitTrend = prevMonthData && prevMonthData.profit !== 0 && currentMonthData
    ? {
        value: Math.abs(Number((((currentMonthData.profit - prevMonthData.profit) / Math.abs(prevMonthData.profit)) * 100).toFixed(1))),
        isPositive: currentMonthData.profit >= prevMonthData.profit
      }
    : undefined;

  const hasFinancialData = monthlyData.some(d => d.income > 0 || d.expenses > 0);
  const hasDistanceData = monthlyData.some(d => d.distance > 0);

  // ── Render 1: Monthly Performance Card ──
  const renderMonthlyCard = (isExpanded = false) => (
    <GlassCard className="flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <DollarSign size={18} className="text-primary" />
            Monthly Performance
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">Fleet income vs operational expenses</p>
        </div>
        {hasFinancialData && (
          <span className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium">
            {monthlyData.length} Months Tracked
          </span>
        )}
      </div>

      {hasFinancialData ? (
        <div className={isExpanded ? 'h-96' : 'h-72'}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={monthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(150, 100%, 50%)" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="hsl(150, 100%, 50%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(150, 30%, 20%)" opacity={0.3} />
              <XAxis dataKey="month" stroke="hsl(0, 0%, 60%)" fontSize={12} tickLine={false} />
              <YAxis
                stroke="hsl(0, 0%, 60%)"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => formatCurrencyShort(v)}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(222, 47%, 11%)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '10px'
                }}
                formatter={(value: number) => [formatCurrency(value), '']}
              />
              <Legend verticalAlign="top" height={36} />
              <Area
                type="monotone"
                dataKey="income"
                stroke="hsl(150, 100%, 50%)"
                fill="url(#incomeGradient)"
                name="Income"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="expenses"
                stroke="hsl(0, 72%, 51%)"
                fill="url(#expenseGradient)"
                name="Expenses"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className={`${isExpanded ? 'h-96' : 'h-72'} flex flex-col items-center justify-center text-muted-foreground`}>
          <DollarSign size={40} className="mb-2 opacity-30" />
          <p className="text-sm font-medium">No financial performance data yet</p>
          <p className="text-xs text-muted-foreground/70">Complete deliveries to track revenue and expenses</p>
        </div>
      )}

      {isExpanded && hasFinancialData && (
        <div className="mt-6 border-t border-white/5 pt-4">
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Calendar size={16} className="text-primary" />
            Monthly Financial Breakdown
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground border-b border-white/5 pb-2">
                  <th className="text-left font-medium py-2">Month</th>
                  <th className="text-right font-medium py-2">Trips</th>
                  <th className="text-right font-medium py-2">Distance</th>
                  <th className="text-right font-medium py-2">Revenue</th>
                  <th className="text-right font-medium py-2">Expenses</th>
                  <th className="text-right font-medium py-2">Net Profit</th>
                </tr>
              </thead>
              <tbody>
                {monthlyData.map((m) => (
                  <tr key={m.monthKey} className="border-b border-white/5 hover:bg-muted/10 transition-colors">
                    <td className="py-2.5 font-medium">{m.month}</td>
                    <td className="py-2.5 text-right">{m.trips}</td>
                    <td className="py-2.5 text-right">{formatNumber(m.distance)} km</td>
                    <td className="py-2.5 text-right text-primary font-medium">{formatCurrency(m.income)}</td>
                    <td className="py-2.5 text-right text-destructive font-medium">{formatCurrency(m.expenses)}</td>
                    <td className={`py-2.5 text-right font-bold ${m.profit >= 0 ? 'text-primary' : 'text-destructive'}`}>
                      {formatCurrency(m.profit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </GlassCard>
  );

  // ── Render 2: Distance Trend Card ──
  const renderDistanceCard = (isExpanded = false) => (
    <GlassCard className="flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Route size={18} className="text-primary" />
            Distance Trend (km)
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">Fleet mileage tracked over months</p>
        </div>
        {hasDistanceData && (
          <span className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium">
            {stats ? `${formatNumber(stats.total_distance)} km total` : 'Active'}
          </span>
        )}
      </div>

      {hasDistanceData ? (
        <div className={isExpanded ? 'h-96' : 'h-72'}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={monthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="distLineGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="hsl(150, 100%, 50%)" />
                  <stop offset="100%" stopColor="hsl(195, 100%, 50%)" />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(150, 30%, 20%)" opacity={0.3} />
              <XAxis dataKey="month" stroke="hsl(0, 0%, 60%)" fontSize={12} tickLine={false} />
              <YAxis
                stroke="hsl(0, 0%, 60%)"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(222, 47%, 11%)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '10px'
                }}
                formatter={(value: number) => [`${formatNumber(value)} km`, 'Distance']}
              />
              <Line
                type="monotone"
                dataKey="distance"
                name="Distance"
                stroke="url(#distLineGrad)"
                strokeWidth={3}
                dot={{ fill: 'hsl(150, 100%, 50%)', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, fill: 'hsl(150, 100%, 60%)' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className={`${isExpanded ? 'h-96' : 'h-72'} flex flex-col items-center justify-center text-muted-foreground`}>
          <MapPin size={40} className="mb-2 opacity-30" />
          <p className="text-sm font-medium">No distance trend data yet</p>
          <p className="text-xs text-muted-foreground/70">Distance traveled will be tracked here monthly</p>
        </div>
      )}

      {isExpanded && hasDistanceData && (
        <div className="mt-6 border-t border-white/5 pt-4">
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Route size={16} className="text-primary" />
            Monthly Mileage Overview
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {monthlyData.map((m) => (
              <div key={m.monthKey} className="p-3 rounded-xl bg-muted/20 border border-white/5 text-center">
                <p className="text-xs text-muted-foreground font-medium">{m.month}</p>
                <p className="text-base font-bold gradient-text mt-1">{formatNumber(m.distance)} km</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{m.trips} deliveries</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </GlassCard>
  );

  // ── Render 3: Cargo Distribution Card (By Cargo Category) ──
  const CargoCustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <div
          className="p-3.5 rounded-xl border border-white/10 shadow-2xl text-xs min-w-[190px] space-y-2 pointer-events-none select-none relative z-[9999]"
          style={{ backgroundColor: '#090e17', opacity: 1 }}
        >
          <div className="flex items-center gap-2 font-bold text-white pb-2 border-b border-white/10">
            <div
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: item.color }}
            />
            <span className="truncate" title={item.name}>{item.name}</span>
          </div>
          <div className="flex items-center justify-between text-slate-300 pt-0.5">
            <span className="text-muted-foreground">Fleet Share:</span>
            <span className="font-bold text-primary text-sm">{item.value}%</span>
          </div>
          <div className="flex items-center justify-between text-slate-300">
            <span className="text-muted-foreground">Deliveries:</span>
            <span className="font-semibold text-white">{item.count}</span>
          </div>
          {item.weight > 0 && (
            <div className="flex items-center justify-between text-slate-300">
              <span className="text-muted-foreground">Cargo Weight:</span>
              <span className="font-semibold text-white">{formatNumber(item.weight)} t</span>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  const renderCargoCard = (isExpanded = false) => {
    // Only By Cargo Category is kept across all charts
    const categories = categoryDistribution;
    const totalCargoLoads = categories.reduce((sum, item) => sum + item.count, 0);
    const totalCargoWeight = categories.reduce((sum, item) => sum + (item.weight || 0), 0);

    // Search filtering for the category breakdown list
    const filteredList = (cargoSearchQuery.trim() === '')
      ? categories
      : categories.filter(item => {
          const q = cargoSearchQuery.toLowerCase().trim();
          return item.name.toLowerCase().includes(q);
        });

    return (
      <GlassCard className="flex flex-col h-full">
        {/* Card Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Package size={18} className="text-primary" />
              Cargo Distribution
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Deliveries aggregated by industry sector
            </p>
          </div>

          {totalCargoLoads > 0 && (
            <span className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium shrink-0 self-start sm:self-auto">
              {totalCargoLoads} Loads
            </span>
          )}
        </div>

        {categories.length > 0 ? (
          isExpanded ? (
            /* Expanded Tab View: Generous 2-column layout with Searchable Complete Breakdown */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start py-2">
              {/* Left Column: Donut Chart with Center Stat */}
              <div className="lg:col-span-5 h-[380px] flex items-center justify-center relative">
                {/* Center Stat in Donut Hole (rendered behind the chart with z-0) */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-0">
                  <span className="text-3xl font-extrabold text-white tracking-tight">
                    {totalCargoLoads}
                  </span>
                  <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                    Total Loads
                  </span>
                </div>

                <ResponsiveContainer width="100%" height="100%" className="relative z-10">
                  <PieChart onMouseLeave={() => setHoveredCategoryIndex(undefined)}>
                    <Pie
                      data={categories}
                      cx="50%"
                      cy="50%"
                      innerRadius={85}
                      outerRadius={145}
                      paddingAngle={3}
                      dataKey="count"
                      nameKey="name"
                      activeIndex={hoveredCategoryIndex}
                      onMouseEnter={(_, index) => setHoveredCategoryIndex(index)}
                      onMouseLeave={() => setHoveredCategoryIndex(undefined)}
                      activeShape={(props: any) => {
                        const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
                        return (
                          <g style={{ outline: 'none' }}>
                            <Sector
                              cx={cx}
                              cy={cy}
                              innerRadius={innerRadius}
                              outerRadius={outerRadius + 5}
                              startAngle={startAngle}
                              endAngle={endAngle}
                              fill={fill}
                              style={{ outline: 'none', filter: 'drop-shadow(0 0 8px rgba(255, 255, 255, 0.25))' }}
                            />
                          </g>
                        );
                      }}
                    >
                      {categories.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} style={{ outline: 'none' }} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={CargoCustomTooltip}
                      isAnimationActive={false}
                      wrapperStyle={{ zIndex: 1000, pointerEvents: 'none' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Right Column: Key Stats & Complete Searchable Breakdown */}
              <div className="lg:col-span-7 space-y-4">
                {/* 3 Metric Cards */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/5">
                    <p className="text-xs text-muted-foreground font-medium">Total Deliveries</p>
                    <p className="text-xl font-bold text-white mt-1">{totalCargoLoads}</p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/5">
                    <p className="text-xs text-muted-foreground font-medium">Total Tonnage</p>
                    <p className="text-xl font-bold text-white mt-1">{formatNumber(totalCargoWeight)} t</p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/5">
                    <p className="text-xs text-muted-foreground font-medium">Industry Sectors</p>
                    <p className="text-xl font-bold text-white mt-1">{categories.length}</p>
                  </div>
                </div>

                {/* Complete Search Input */}
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={cargoSearchQuery}
                    onChange={(e) => setCargoSearchQuery(e.target.value)}
                    placeholder={`Search all ${categories.length} industry categories...`}
                    className="pl-9 pr-14 h-9 text-xs bg-slate-900/60 border-white/10 placeholder:text-muted-foreground/60 rounded-xl"
                  />
                  {cargoSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setCargoSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground hover:text-white"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Searchable Scrollable Breakdown List */}
                <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                  {filteredList.length > 0 ? (
                    filteredList.map((item, idx) => (
                      <div
                        key={item.name}
                        className="p-3 rounded-xl bg-slate-900/40 border border-white/5 hover:bg-slate-800/60 hover:border-white/10 transition-colors"
                      >
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <div className="flex items-center gap-2.5 truncate min-w-0">
                            <span className="text-[10px] font-bold text-muted-foreground min-w-[24px]">
                              #{item.fleetRank || idx + 1}
                            </span>
                            <div className="w-3.5 h-3.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                            <span className="font-semibold text-white text-sm truncate" title={item.name}>
                              {item.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0 ml-2">
                            <span className="text-muted-foreground font-medium text-[11px] sm:text-xs">
                              {item.count} {item.count === 1 ? 'load' : 'loads'}
                            </span>
                            {item.weight > 0 && (
                              <span className="text-slate-400 font-medium text-[11px] sm:text-xs">
                                ({formatNumber(item.weight)} t)
                              </span>
                            )}
                            <span className="font-bold text-primary text-xs sm:text-sm min-w-[42px] text-right">
                              {item.value}%
                            </span>
                          </div>
                        </div>
                        <div className="w-full bg-slate-800/80 rounded-full h-2 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(100, Math.max(item.value, 0.5))}%`, backgroundColor: item.color }}
                          />
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-8 text-center text-muted-foreground text-xs bg-slate-900/20 rounded-xl border border-white/5">
                      <p className="font-medium">No industry categories matching "{cargoSearchQuery}"</p>
                      <p className="text-[11px] text-muted-foreground/70 mt-1">Try another search keyword</p>
                    </div>
                  )}
                </div>

                <div className="text-[11px] text-muted-foreground/70 text-right pt-0.5">
                  Showing {filteredList.length} of {categories.length} industry categories
                </div>
              </div>
            </div>
          ) : (
            /* Grid View: Sized nicely to fill container in All Charts */
            <>
              <div className="h-72 flex items-center justify-center relative">
                {/* Center Stat in Donut Hole (rendered behind the chart with z-0) */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-0">
                  <span className="text-2xl font-bold text-white">
                    {totalCargoLoads}
                  </span>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                    Loads
                  </span>
                </div>

                <ResponsiveContainer width="100%" height="100%" className="relative z-10">
                  <PieChart onMouseLeave={() => setHoveredCategoryGridIndex(undefined)}>
                    <Pie
                      data={categories}
                      cx="50%"
                      cy="50%"
                      innerRadius={65}
                      outerRadius={105}
                      paddingAngle={3}
                      dataKey="count"
                      nameKey="name"
                      activeIndex={hoveredCategoryGridIndex}
                      onMouseEnter={(_, index) => setHoveredCategoryGridIndex(index)}
                      onMouseLeave={() => setHoveredCategoryGridIndex(undefined)}
                      activeShape={(props: any) => {
                        const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
                        return (
                          <g style={{ outline: 'none' }}>
                            <Sector
                              cx={cx}
                              cy={cy}
                              innerRadius={innerRadius}
                              outerRadius={outerRadius + 4}
                              startAngle={startAngle}
                              endAngle={endAngle}
                              fill={fill}
                              style={{ outline: 'none', filter: 'drop-shadow(0 0 6px rgba(255, 255, 255, 0.25))' }}
                            />
                          </g>
                        );
                      }}
                    >
                      {categories.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} style={{ outline: 'none' }} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={CargoCustomTooltip}
                      isAnimationActive={false}
                      wrapperStyle={{ zIndex: 1000, pointerEvents: 'none' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-4 max-h-52 overflow-y-auto pr-1">
                {categories.map((item) => (
                  <div
                    key={item.name}
                    className="flex items-center justify-between gap-2 text-xs p-2.5 rounded-lg bg-slate-900/40 border border-white/5 hover:bg-slate-800/60 hover:border-white/10 transition-colors cursor-default"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="text-foreground font-medium truncate" title={item.name}>{item.name}</span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-bold text-primary">{item.value}%</span>
                      <span className="text-[10px] text-muted-foreground block">({item.count})</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )
        ) : (
          <div className={`${isExpanded ? 'h-96' : 'h-72'} flex flex-col items-center justify-center text-muted-foreground`}>
            <Package size={44} className="mb-2 opacity-30" />
            <p className="text-sm font-medium">No cargo data yet</p>
            <p className="text-xs text-muted-foreground/70">Complete deliveries to see cargo breakdown</p>
          </div>
        )}
      </GlassCard>
    );
  };

  // ── Render 4: Popular Routes Card ──
  const renderRoutesCard = (isExpanded = false) => (
    <GlassCard className={`flex flex-col h-full ${isExpanded ? '' : 'lg:col-span-2'}`}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Truck size={18} className="text-primary" />
            Popular Routes
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">Most frequented origin to destination lanes</p>
        </div>
        {routeData.length > 0 && (
          <span className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium">
            Top {routeData.length} Routes
          </span>
        )}
      </div>

      {routeData.length > 0 ? (
        <>
          <div
            className={isExpanded ? 'w-full' : 'flex-1 w-full min-h-[280px]'}
            style={isExpanded ? { height: `${Math.max(280, Math.min(500, routeData.length * 72 + 50))}px` } : undefined}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={routeData}
                layout="vertical"
                margin={isExpanded ? { left: 15, right: 35, top: 15, bottom: 15 } : { left: 10, right: 25, top: 10, bottom: 10 }}
                barCategoryGap="16%"
              >
                <defs>
                  <linearGradient id="popularRouteGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="hsl(150, 100%, 50%)" />
                    <stop offset="100%" stopColor="hsl(195, 100%, 50%)" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(150, 30%, 20%)" opacity={0.3} />
                <XAxis
                  type="number"
                  stroke="hsl(0, 0%, 60%)"
                  fontSize={isExpanded ? 12 : 11}
                  allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="route"
                  stroke="hsl(0, 0%, 60%)"
                  width={isExpanded ? 240 : 190}
                  tick={{ fontSize: isExpanded ? 13 : 12, fontWeight: isExpanded ? 600 : 500, fill: 'hsl(0, 0%, 85%)' }}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(222, 47%, 11%)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '10px',
                    boxShadow: '0 8px 30px rgba(0, 0, 0, 0.6)'
                  }}
                  formatter={(value: number, name: string, item: any) => [
                    `${value} ${value === 1 ? 'trip' : 'trips'} (avg. ${formatNumber(item?.payload?.distance || 0)} km)`,
                    'Deliveries'
                  ]}
                />
                <Bar
                  dataKey="trips"
                  name="Trips"
                  fill="url(#popularRouteGrad)"
                  radius={[0, isExpanded ? 8 : 6, isExpanded ? 8 : 6, 0]}
                  maxBarSize={isExpanded ? 38 : 30}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Quick summary stats in All Charts grid view to utilize card height and match Cargo Distribution */}
          {!isExpanded && (
            <div className="pt-3 border-t border-white/5 grid grid-cols-3 gap-2 text-center text-xs mt-3">
              <div className="p-2 rounded-lg bg-slate-900/40 border border-white/5">
                <p className="text-[10px] text-muted-foreground uppercase font-medium">Top Corridor</p>
                <p className="font-semibold text-white truncate mt-0.5">{routeData[0]?.route || '—'}</p>
              </div>
              <div className="p-2 rounded-lg bg-slate-900/40 border border-white/5">
                <p className="text-[10px] text-muted-foreground uppercase font-medium">Most Active</p>
                <p className="font-semibold text-primary mt-0.5">{routeData[0]?.trips || 0} {routeData[0]?.trips === 1 ? 'trip' : 'trips'}</p>
              </div>
              <div className="p-2 rounded-lg bg-slate-900/40 border border-white/5">
                <p className="text-[10px] text-muted-foreground uppercase font-medium">Avg. Mileage</p>
                <p className="font-semibold text-white mt-0.5">
                  {formatNumber(routeData.reduce((sum, r) => sum + r.distance, 0) / (routeData.length || 1))} km
                </p>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="flex-1 min-h-[260px] flex flex-col items-center justify-center text-muted-foreground">
          <Truck size={44} className="mb-2 opacity-30" />
          <p className="text-sm font-medium">No route history yet</p>
          <p className="text-xs text-muted-foreground/70">Top lanes will be calculated automatically</p>
        </div>
      )}

      {isExpanded && routeData.length > 0 && (
        <div className="mt-6 border-t border-white/5 pt-4">
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <BarChart3 size={16} className="text-primary" />
            Top Lanes Details
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground border-b border-white/5 text-xs uppercase tracking-wider">
                  <th className="text-left font-semibold py-3 px-3">Rank</th>
                  <th className="text-left font-semibold py-3 px-3">Route Lane</th>
                  <th className="text-right font-semibold py-3 px-3">Total Dispatches</th>
                  <th className="text-right font-semibold py-3 px-3">Avg. Distance</th>
                  <th className="text-right font-semibold py-3 px-3">Est. Total Mileage</th>
                </tr>
              </thead>
              <tbody>
                {routeData.map((r, idx) => (
                  <tr key={r.route} className="border-b border-white/5 hover:bg-white/[0.03] transition-colors">
                    <td className="py-3 px-3">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-primary/10 text-primary font-bold text-xs">
                        #{idx + 1}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-semibold text-white">{r.route}</td>
                    <td className="py-3 px-3 text-right">
                      <span className="font-bold text-white">{r.trips}</span>{' '}
                      <span className="text-xs text-muted-foreground">{r.trips === 1 ? 'trip' : 'trips'}</span>
                    </td>
                    <td className="py-3 px-3 text-right text-muted-foreground">{formatNumber(r.distance)} km</td>
                    <td className="py-3 px-3 text-right font-semibold text-primary">{formatNumber(r.distance * r.trips)} km</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </GlassCard>
  );

  return (
    <>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold gradient-text">Fleet Overview</h1>
            <p className="text-muted-foreground mt-1">Combined VTC performance statistics</p>
          </div>
          <Button
            variant="outline"
            onClick={refresh}
            disabled={loading}
            className="gap-2 rounded-full"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            Refresh Data
          </Button>
        </div>

        {/* Database Error Banner with Retry */}
        {error && (
          <div className="p-4 rounded-xl bg-destructive/15 border border-destructive/30 flex items-center justify-between gap-3 text-sm">
            <div className="flex items-center gap-2.5 text-destructive font-medium">
              <AlertTriangle size={18} className="shrink-0" />
              <span>Failed to fetch fleet statistics from database: {error}</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={refresh}
              className="rounded-lg shrink-0 border-destructive/40 text-destructive hover:bg-destructive/10"
            >
              Retry
            </Button>
          </div>
        )}

        {/* Main Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Distance"
            value={stats ? `${formatNumber(stats.total_distance)} km` : '—'}
            icon={<MapPin size={24} />}
            trend={distanceTrend}
          />
          <StatCard
            title="Total Revenue"
            value={stats ? formatCurrency(stats.total_income) : '—'}
            icon={<DollarSign size={24} />}
            trend={revenueTrend}
          />
          <StatCard
            title="Total Expenses"
            value={stats ? formatCurrency(stats.total_expenses) : '—'}
            icon={<TrendingDown size={24} />}
            subtitle="Fuel, repairs, tolls"
          />
          <StatCard
            title="Net Profit"
            value={stats ? formatCurrency(stats.total_profit) : '—'}
            icon={<TrendingUp size={24} />}
            trend={profitTrend}
          />
        </div>

        {/* Secondary Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Deliveries"
            value={stats?.total_deliveries || 0}
            icon={<Package size={24} />}
          />
          <StatCard
            title="Fuel Consumed"
            value={stats ? `${formatNumber(stats.total_fuel)} L` : '—'}
            icon={<Fuel size={24} />}
          />
          <StatCard
            title="Active Drivers"
            value={stats?.active_drivers || 0}
            icon={<Truck size={24} />}
          />
          <StatCard
            title="Total Load Weight"
            value={stats ? `${formatNumber(stats.total_load_weight)} t` : '—'}
            icon={<Scale size={24} />}
          />
        </div>

        {/* ── 4 Tabs / Interactive Analytics Navigation ── */}
        <Tabs defaultValue="all" className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold gradient-text">Fleet Analytics</h2>
              <p className="text-xs text-muted-foreground">Select a tab or view all charts side by side</p>
            </div>
            <TabsList className="bg-muted/40 border border-white/5 p-1 w-full sm:w-auto grid grid-cols-2 sm:grid-cols-5 gap-1">
              <TabsTrigger value="all" className="text-xs flex items-center gap-1.5">
                <Layers size={13} />
                All Charts
              </TabsTrigger>
              <TabsTrigger value="monthly" className="text-xs flex items-center gap-1.5">
                <DollarSign size={13} />
                Monthly Performance
              </TabsTrigger>
              <TabsTrigger value="distance" className="text-xs flex items-center gap-1.5">
                <Route size={13} />
                Distance Trend (km)
              </TabsTrigger>
              <TabsTrigger value="cargo" className="text-xs flex items-center gap-1.5">
                <Package size={13} />
                Cargo Distribution
              </TabsTrigger>
              <TabsTrigger value="routes" className="text-xs flex items-center gap-1.5">
                <Truck size={13} />
                Popular Routes
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Tab 1: All Charts Grid */}
          <TabsContent value="all" className="space-y-6 m-0">
            {/* Charts Row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {renderMonthlyCard(false)}
              {renderDistanceCard(false)}
            </div>

            {/* Charts Row 2 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {renderCargoCard(false)}
              {renderRoutesCard(false)}
            </div>
          </TabsContent>

          {/* Tab 2: Monthly Performance Deep-Dive */}
          <TabsContent value="monthly" className="m-0">
            {renderMonthlyCard(true)}
          </TabsContent>

          {/* Tab 3: Distance Trend Deep-Dive */}
          <TabsContent value="distance" className="m-0">
            {renderDistanceCard(true)}
          </TabsContent>

          {/* Tab 4: Cargo Distribution Deep-Dive */}
          <TabsContent value="cargo" className="m-0">
            {renderCargoCard(true)}
          </TabsContent>

          {/* Tab 5: Popular Routes Deep-Dive */}
          <TabsContent value="routes" className="m-0">
            {renderRoutesCard(true)}
          </TabsContent>
        </Tabs>

        {/* Profit/Loss Summary */}
        <GlassCard>
          <h3 className="text-lg font-semibold mb-4">Profit & Loss Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center p-4 rounded-xl bg-muted/30">
              <p className="text-muted-foreground text-sm">Gross Revenue</p>
              <p className="text-2xl font-bold gradient-text mt-1">
                {stats ? formatCurrency(stats.total_income) : '$0'}
              </p>
            </div>
            <div className="text-center p-4 rounded-xl bg-muted/30">
              <p className="text-muted-foreground text-sm">Fuel Costs</p>
              <p className="text-2xl font-bold text-destructive mt-1">
                {stats ? formatCurrency(stats.total_fuel * 1.5) : '$0'}
              </p>
            </div>
            <div className="text-center p-4 rounded-xl bg-muted/30">
              <p className="text-muted-foreground text-sm">Other Expenses</p>
              <p className="text-2xl font-bold text-destructive mt-1">
                {stats ? formatCurrency(Math.max(0, stats.total_expenses - stats.total_fuel * 1.5)) : '$0'}
              </p>
            </div>
            <div className="text-center p-4 rounded-xl bg-muted/30">
              <p className="text-muted-foreground text-sm">Total Expenses</p>
              <p className="text-2xl font-bold text-destructive mt-1">
                {stats ? formatCurrency(stats.total_expenses) : '$0'}
              </p>
            </div>
            <div className="text-center p-4 rounded-xl bg-primary/10 border border-primary/30">
              <p className="text-muted-foreground text-sm">Net Profit</p>
              <p className="text-2xl font-bold gradient-text mt-1">
                {stats ? formatCurrency(stats.total_profit) : '$0'}
              </p>
            </div>
          </div>
        </GlassCard>
      </div>
    </>
  );
}
