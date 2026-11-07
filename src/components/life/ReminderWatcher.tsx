/** Delivers due reminders/alarms while the app is open: toast + system notification. */
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/legacyClient";
import { bootNativeBridge } from "@/lib/native/bridge";

export default function ReminderWatcher() {
  const navigate = useNavigate();
  useEffect(() => {
    void bootNativeBridge();
    const { data: sub } = supabase.auth.onAuthStateChange((e) => {
      if (e === "SIGNED_IN") void bootNativeBridge();
    });
    return () => sub.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    let stopped = false;
    const tick = async () => {
      const { data: auth } = await supabase.auth.getSession();
      if (!auth.session || stopped) return;
      const { data } = await supabase
        .from("scheduled_nudges")
        .select("id,title,body,kind")
        .is("sent_at", null)
        .lte("run_at", new Date().toISOString())
        .limit(5);
      for (const n of data ?? []) {
        await supabase.from("scheduled_nudges").update({ sent_at: new Date().toISOString() }).eq("id", n.id);
        const title = (n.kind === "alarm" ? "⏰ " : "🔔 ") + n.title;
        toast(title, {
          description: n.body ?? undefined,
          duration: n.kind === "alarm" ? 60_000 : 10_000,
          action: { label: "Tasks", onClick: () => navigate("/tasks") },
        });
        try {
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification(title, { body: n.body ?? "", icon: "/favicon.ico" });
          }
        } catch {
          /* ignore */
        }
      }
    };
    void tick();
    const id = window.setInterval(() => void tick(), 30_000);
    return () => {
      stopped = true;
      window.clearInterval(id);
    };
  }, [navigate]);
  return null;
}
