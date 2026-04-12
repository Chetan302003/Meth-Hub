import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getVersion } from '@tauri-apps/api/app';
import { isTauri } from '@tauri-apps/api/core';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Rocket, Clock } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export function UpdateAnnouncementModal() {
  const [open, setOpen] = useState(false);
  const [releaseNotes, setReleaseNotes] = useState('');
  const [currentVersion, setCurrentVersion] = useState('');

  useEffect(() => {
    const checkUpdates = async () => {
      if (!isTauri()) return;
      
      try {
        const appVersion = await getVersion();
        
        const { data } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'version')
          .single();

        if (data && data.value) {
          const versionData = data.value as any;
          
          if (appVersion === versionData.latest && versionData.release_notes) {
            // User is running the latest version, check if we've shown the release notes
            const lsKey = `release_notes_seen_${appVersion}`;
            const seenData = localStorage.getItem(lsKey);
            
            if (seenData) {
              const parsed = JSON.parse(seenData);
              const now = Date.now();
              const twoDaysInMs = 48 * 60 * 60 * 1000;
              
              if (parsed.dismissed || now - parsed.timestamp > twoDaysInMs) {
                return; // Already dismissed or expired
              }
              // Still open but maybe user hasn't explicitly dismissed it, let it auto hide after 2 days
              // We'll show it if it hasn't been dismissed and hasn't expired.
              // Wait, if it's not dismissed and not expired, should we pop it up again?
              // That might be annoying. It's better to show once and let them read. 
              // The requirement: "remove it in 2 days or give the user to remove it."
              // We'll show it on every load until dismissed or 2 days have passed since the update was pushed.
              // Actually, checking standard behaviors: usually show once, but we will follow the instruction:
            } else {
              // First time seeing it
              localStorage.setItem(lsKey, JSON.stringify({ timestamp: Date.now(), dismissed: false }));
            }
            
            setCurrentVersion(appVersion);
            setReleaseNotes(versionData.release_notes);
            setOpen(true);
          }
        }
      } catch (err) {
        console.error('Error fetching release notes:', err);
      }
    };

    checkUpdates();
  }, []);

  const handleDismiss = () => {
    const lsKey = `release_notes_seen_${currentVersion}`;
    const seenData = localStorage.getItem(lsKey);
    if (seenData) {
      const parsed = JSON.parse(seenData);
      localStorage.setItem(lsKey, JSON.stringify({ ...parsed, dismissed: true }));
    } else {
      localStorage.setItem(lsKey, JSON.stringify({ timestamp: Date.now(), dismissed: true }));
    }
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-hidden flex flex-col glass-card border-primary/30 p-0">
        <DialogHeader className="p-6 bg-primary/10 border-b border-primary/20 shrink-0">
          <DialogTitle className="flex items-center gap-3 text-2xl">
            <div className="p-2 rounded-full bg-primary/20 text-primary">
              <Rocket size={24} className="animate-pulse" />
            </div>
            What's New in v{currentVersion}
          </DialogTitle>
          <DialogDescription>
            Aura VTC Hub has just been updated! Here are the changes.
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 overflow-y-auto flex-1 prose prose-invert prose-p:text-muted-foreground prose-headings:text-foreground prose-a:text-primary hover:prose-a:text-primary/80 prose-strong:text-foreground max-w-none custom-scrollbar">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {releaseNotes}
          </ReactMarkdown>
        </div>

        <DialogFooter className="p-6 border-t border-border/50 bg-muted/20 shrink-0 flex items-center justify-between sm:justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock size={14} />
            <span>Auto-hides after 2 days</span>
          </div>
          <Button onClick={handleDismiss} className="neon-glow px-8">
            Awesome! Dismiss
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
