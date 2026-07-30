import React, { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

export function PwaInstallPrompt() {
  const [promptEvent, setPromptEvent] = useState(null);
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const electron = /Electron/i.test(navigator.userAgent);

  useEffect(() => {
    if (standalone || electron) return undefined;
    const handler = (event) => { event.preventDefault(); setPromptEvent(event); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, [standalone, electron]);

  if (!promptEvent) return null;
  return <div className="pwa-install-card"><div><b>Install Tiny Chat</b><small>Open it like a desktop app and keep your chat state.</small></div><button type="button" className="install" onClick={async () => { const event = promptEvent; setPromptEvent(null); await event.prompt(); }}><Download size={15} />Install</button><button type="button" className="close" onClick={() => setPromptEvent(null)} aria-label="Close"><X size={15} /></button></div>;
}
