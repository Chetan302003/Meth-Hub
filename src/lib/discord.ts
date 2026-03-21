export interface JobStartedPayload {
  username: string;
  avatar_url?: string;
  job_id: string;
  origin_city: string;
  destination_city: string;
  cargo_type: string;
  cargo_weight: number;
  truck_name: string;
  planned_distance_km: number;
  started_at: string;
}

export interface JobCompletedPayload extends JobStartedPayload {
  distance_km: number;
  revenue: number;
  fuel_consumed: number;
  avg_fuel_consumption: number;
  expenses: number;
  xp_earned: number;
  damage_percent: number;
  status: string;
  duration_seconds?: number;
}

const WEBHOOK_URL = import.meta.env.VITE_DISCORD_WEBHOOK_URL;

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return 'Unknown';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h} hours ${m} minutes ${s} seconds`;
  if (m > 0) return `${m} minutes ${s} seconds`;
  return `${s} seconds`;
}

export const sendDiscordWebhook = async (
  type: 'job_started' | 'job_completed',
  payload: JobStartedPayload | JobCompletedPayload
) => {
  if (!WEBHOOK_URL) {
    console.warn('Discord webhook URL not configured in .env');
    return;
  }

  const isCompleted = type === 'job_completed';
  const cPayload = payload as JobCompletedPayload;

  // Colors: 3447003 (Blue) for started, 3066993 (Green) for completed, 15158332 (Red) for cancelled
  let color = 3447003; 
  let title = `Job Started - #${payload.job_id.replace('job_', '').substring(0, 8)}`;
  
  if (isCompleted) {
    if (cPayload.status === 'completed' || cPayload.status === 'delivered') {
      color = 3066993;
      title = `Job Completed - #${payload.job_id.replace('job_', '').substring(0, 8)}`;
    } else {
      color = 15158332;
      title = `Job Cancelled - #${payload.job_id.replace('job_', '').substring(0, 8)}`;
    }
  }

  const startedDate = new Date(payload.started_at);
  const formattedStarted = startedDate.toISOString().replace('T', ' ').substring(0, 16);

  const fields = [
    {
      name: "🗺️ Route",
      value: `**${payload.origin_city}** to **${payload.destination_city}**\n${Math.round(isCompleted ? cPayload.distance_km : payload.planned_distance_km).toLocaleString()} km${!isCompleted ? ' (Planned)' : ''}`,
      inline: true
    },
    {
      name: "📦 Cargo",
      value: `${payload.cargo_type} (${payload.cargo_weight} t)`,
      inline: true
    },
    {
      name: "🚚 Truck",
      value: payload.truck_name,
      inline: true
    }
  ];

  if (isCompleted) {
    fields.push(
      {
        name: "⛽ Fuel",
        value: `${Math.round(cPayload.fuel_consumed).toLocaleString()} l`,
        inline: true
      },
      {
        name: "📏 Economy",
        value: `${cPayload.avg_fuel_consumption.toFixed(1)} l/100km`,
        inline: true
      },
      {
        name: "💰 Revenue",
        value: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cPayload.revenue),
        inline: true
      },
      {
        name: "👮‍♂️ Expenses",
        value: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cPayload.expenses),
        inline: true
      },
      {
        name: "📅 Started",
        value: formattedStarted,
        inline: true
      }
    );
    
    if (cPayload.duration_seconds) {
      fields.push({
        name: "⏲️ Duration",
        value: formatDuration(cPayload.duration_seconds),
        inline: true
      });
    }
  } else {
    fields.push({
      name: "📅 Started",
      value: formattedStarted,
      inline: true
    });
  }

  const fallbackAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(payload.username)}&background=3447003&color=fff`;

  const embed: any = {
    title,
    color,
    author: {
      name: payload.username,
      icon_url: payload.avatar_url || fallbackAvatar
    },
    fields: fields,
    footer: {
      text: "Provided by Aura VTC"
    },
    timestamp: new Date().toISOString()
  };

  try {
    await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: "Aura Tracker",
        avatar_url: "https://cdn-icons-png.flaticon.com/512/709/709790.png",
        embeds: [embed]
      })
    });
    console.log(`[Discord] Successfully posted ${type} webhook.`);
  } catch (error) {
    console.error('[Discord] Failed to send webhook:', error);
  }
};
