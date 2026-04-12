import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FleetStats {
    total_distance: number;
    total_deliveries: number;
    total_fuel: number;
    total_income: number;
    total_expenses: number;
    total_profit: number;
    active_drivers: number;
    avg_load_weight: number;
}

interface LeaderboardEntry {
    user_id: string;
    username: string;
    avatar_url: string;
    total_distance: number;
    total_deliveries: number;
    total_earnings: number;
}

serve(async (req: Request) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        // Initialize Supabase Client
        const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
        const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
        const discordWebhookUrl = Deno.env.get('DISCORD_WEBHOOK_URL') || '';

        if (!discordWebhookUrl) {
            throw new Error('DISCORD_WEBHOOK_URL is not configured');
        }

        const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

        console.log('[Discord Broadcast] Fetching fleet metrics...');

        // 1. Fetch Fleet Stats
        const { data: statsData, error: statsError } = await supabase.rpc('get_fleet_stats');
        if (statsError) throw statsError;
        const stats = statsData as FleetStats;

        // 2. Fetch Leaderboard (Top 5)
        const { data: leaderboardData, error: leaderboardError } = await supabase.rpc('get_leaderboard', { limit_count: 5 });
        if (leaderboardError) throw leaderboardError;
        const leaderboard = leaderboardData as LeaderboardEntry[];

        console.log('[Discord Broadcast] Constructing payload...');

        // 3. Format Discord Embed
        const formatNumber = (num: number) => num.toLocaleString('en-US', { maximumFractionDigits: 1 });
        const formatCurrency = (num: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(num);

        const embedTitle = "🌌 Aura VTC Hub | Fleet Operational Intelligence";
        const embedColor = 0x7DF9FF; // Neon Cyan

        const fields = [
            { name: "🚛 Total Fleet Distance", value: `\`${formatNumber(stats.total_distance)} KM\``, inline: true },
            { name: "📦 Successful Logs", value: `\`${formatNumber(stats.total_deliveries)}\``, inline: true },
            { name: "👥 Active Operatives", value: `\`${stats.active_drivers}\``, inline: true },
            { name: "💰 Total Revenue", value: `\`${formatCurrency(stats.total_income)}\``, inline: true },
            { name: "⛽ Fuel Consumed", value: `\`${formatNumber(stats.total_fuel)} L\``, inline: true },
            { name: "📊 Net Profit", value: `\`${formatCurrency(stats.total_profit)}\``, inline: true },
        ];

        // Individual Top Drivers Section
        let leaderboardText = "";
        leaderboard.forEach((d, i) => {
            const rankEmoji = i === 0 ? "👑" : i === 1 ? "🥈" : i === 2 ? "🥉" : "🔹";
            leaderboardText += `${rankEmoji} **${d.username}**: \`${formatNumber(d.total_distance)} KM\` | \`${formatCurrency(d.total_earnings)}\`\n`;
        });

        const discordPayload = {
            embeds: [
                {
                    title: embedTitle,
                    description: "Broadcast from Aura Network Protocol - Fleet Management System v2.0",
                    color: embedColor,
                    fields: fields,
                    footer: { text: "Operative Status: ONLINE | Aura VTC Hub Sync" },
                    timestamp: new Date().toISOString(),
                    thumbnail: {
                        url: "https://i.ibb.co/9Hd1f7jr/cropped-circle-image-1.png"
                    }
                },
                {
                    title: "🏆 Top Operatives | Vanguard Rankings",
                    description: leaderboardText || "Simulation pending data...",
                    color: 0xFFD700, // Gold
                }
            ]
        };

        // 4. Send to Discord
        const discordResponse = await fetch(discordWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(discordPayload),
        });

        if (!discordResponse.ok) {
            const errorText = await discordResponse.text();
            throw new Error(`Discord Webhook failed: ${discordResponse.status} - ${errorText}`);
        }

        return new Response(
            JSON.stringify({ message: 'Stats shared successfully' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error: unknown) {
        console.error('[Discord Broadcast] Error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        return new Response(
            JSON.stringify({ error: message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
