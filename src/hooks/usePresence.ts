import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export function usePresence(userId: string | undefined) {
  useEffect(() => {
    if (!userId) return;

    const channel = supabase.channel("online-users-db");

    channel
      .on("presence", { event: "leave" }, async ({ leftPresences }) => {
        for (const presence of leftPresences) {
          if (presence.user_id) {
            await supabase
              .from("profiles")
              .update({
                last_seen: new Date().toISOString(),
                is_online: false,
              })
              .eq("user_id", presence.user_id);
          }
        }
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            user_id: userId,
            online_at: new Date().toISOString(),
          });
          // Mark online when app connects
          await supabase
            .from("profiles")
            .update({ is_online: true })
            .eq("user_id", userId);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);
}
