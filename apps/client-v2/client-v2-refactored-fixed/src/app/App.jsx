import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { IonActionSheet, IonApp, IonFab, IonFabButton, IonLoading, IonToast } from '@ionic/react';
import { Plus } from 'lucide-react';
import { api, getToken, setToken } from '../api';
import { useTheme } from '../hooks/useTheme';
import { useChatController } from './useChatController';
import { AuthPage } from '../components/AuthPage';
import { ChatList } from '../components/ChatList';
import { ChatRoom } from '../components/ChatRoom';
import { NewChatModal } from '../modals/NewChatModal';
import { SearchModal } from '../modals/SearchModal';
import { FilesModal } from '../modals/FilesModal';
import { ForwardModal } from '../modals/ForwardModal';
import { ChatInfoModal } from '../modals/ChatInfoModal';
import { SettingsModal } from '../modals/SettingsModal';
import { ContactsModal } from '../modals/ContactsModal';
import { NavigationRail } from '../components/NavigationRail';
import { ShortcutHelp } from '../components/ShortcutHelp';
import { useBrowserAttention } from '../hooks/useBrowserAttention';
import { PwaInstallPrompt } from '../components/PwaInstallPrompt';

export function App() {
  const { themeMode, setThemeMode } = useTheme();
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(Boolean(getToken()));
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [filesOpen, setFilesOpen] = useState(false);
  const [mediaPreviewMessage, setMediaPreviewMessage] = useState(null);
  const [forwardOpen, setForwardOpen] = useState(false);
  const [forwardMessage, setForwardMessage] = useState(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [contactsOpen, setContactsOpen] = useState(false);
  const [shortcutHelpOpen, setShortcutHelpOpen] = useState(false);
  const [messageAction, setMessageAction] = useState(null);

  const chat = useChatController(user);
  useBrowserAttention(chat.chats);

  const setViewInUrl = useCallback((view) => {
    const url = new URL(location.href);
    if (view) url.searchParams.set('view', view); else url.searchParams.delete('view');
    history.replaceState(history.state, '', url);
  }, []);

  useEffect(() => {
    let alive = true;
    const token = getToken();
    if (!token) { setBooting(false); return undefined; }
    api('/api/me')
      .then((data) => { if (alive) setUser(data.user); })
      .catch(() => { if (alive) setToken(null); })
      .finally(() => { if (alive) setBooting(false); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    chat.loadChats().catch(() => {});
  }, [user?.id]); // chat.loadChats is stable by design.

  useEffect(() => {
    if (!user?.id) return undefined;
    const params = new URLSearchParams(location.search);
    if (params.get('action') === 'new-chat') setNewChatOpen(true);
    if (params.get('action') === 'search') window.setTimeout(() => document.querySelector('.chat-list-page ion-searchbar')?.setFocus?.(), 250);
    if (params.get('view') === 'contacts') setContactsOpen(true);
    if (params.get('view') === 'settings') setSettingsOpen(true);
    if (params.get('view') === 'profile') setInfoOpen(true);
    if (params.get('view') === 'chats') chat.setActive(null);

    const onKeyDown = (event) => {
      const modifier = event.ctrlKey || event.metaKey;
      if (!modifier) return;
      if (event.key.toLowerCase() === 'n') {
        event.preventDefault();
        setNewChatOpen(true);
      }
      if (event.key.toLowerCase() === 'k') {
        event.preventDefault();
        document.querySelector('.chat-list-page ion-searchbar')?.setFocus?.();
      }
      if (event.key === '/' || event.key === '?') {
        event.preventDefault();
        setShortcutHelpOpen(true);
      }
    };
    const onOffline = () => chat.setToast('You are offline. Messages may fail until the connection returns.');
    const onOnline = () => chat.setToast('Back online');
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
    };
  }, [user?.id, chat.setActive, chat.setToast]);

  useEffect(() => {
    const expire = () => {
      setToken(null);
      setUser(null);
      chat.setActive(null);
    };
    window.addEventListener('verdant-session-expired', expire);
    return () => window.removeEventListener('verdant-session-expired', expire);
  }, [chat.setActive]);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    chat.setActive(null);
    setSettingsOpen(false);
  }, [chat.setActive]);

  const runMessageCommand = useCallback(async (role) => {
    const message = messageAction;
    setMessageAction(null);
    if (!message) return;
    if (role === 'forward') {
      setForwardMessage(message);
      setForwardOpen(true);
      return;
    }
    await chat.runMessageCommand(role, message);
  }, [messageAction, chat.runMessageCommand]);

  const navigationAction = useCallback(async (action) => {
    if (action === 'settings') { setSettingsOpen(true); setViewInUrl('settings'); return; }
    if (action === 'contacts') { setContactsOpen(true); setViewInUrl('contacts'); return; }
    if (action === 'rss') { chat.setFilter('active'); chat.setTypeFilter('rss'); setViewInUrl('chats'); return; }
    if (action === 'chats') { chat.setFilter('active'); chat.setTypeFilter('all'); setViewInUrl('chats'); return; }
    if (action === 'saved') {
      let saved = chat.chats.find((item) => item.type === 'saved');
      if (!saved) {
        const next = await chat.loadChats({ includeHidden: chat.showHidden, quiet: true }).catch(() => []);
        saved = next.find((item) => item.type === 'saved');
      }
      if (saved) chat.setActive(saved);
    }
  }, [chat.chats, chat.showHidden, chat.loadChats, chat.setActive, chat.setFilter, chat.setTypeFilter, setViewInUrl]);

  const navigationActive = settingsOpen ? 'settings' : contactsOpen ? 'contacts' : chat.typeFilter === 'rss' ? 'rss' : chat.active?.type === 'saved' ? 'saved' : 'chats';

  const actionButtons = useMemo(() => {
    const mineText = messageAction?.body && Number(messageAction?.senderId) === Number(user?.id) && !messageAction?.deletedAt;
    return [
      { text: 'Reply', handler: () => runMessageCommand('reply') },
      ...(mineText ? [{ text: 'Edit', handler: () => runMessageCommand('edit') }] : []),
      { text: 'Copy', handler: () => runMessageCommand('copy') },
      { text: 'Forward', handler: () => runMessageCommand('forward') },
      { text: 'Save to Saved Messages', handler: () => runMessageCommand('save') },
      { text: 'Pin', handler: () => runMessageCommand('pin') },
      { text: 'Delete', role: 'destructive', handler: () => runMessageCommand('delete') },
      { text: 'Cancel', role: 'cancel' },
    ];
  }, [messageAction, user?.id, runMessageCommand]);

  if (booting) return <IonApp><IonLoading isOpen message="Opening Tiny Chat…" /></IonApp>;
  if (!user) return <IonApp><AuthPage onDone={setUser} themeMode={themeMode} onThemeModeChange={setThemeMode} /></IonApp>;

  return <IonApp>
    <div className={`desktop-shell ${chat.active ? 'has-active-chat' : 'no-active-chat'}`}>
      <NavigationRail active={navigationActive} onAction={navigationAction} />
      <ChatList
        chats={chat.chats}
        activeId={chat.active?.id}
        query={chat.query}
        setQuery={chat.setQuery}
        filter={chat.filter}
        setFilter={chat.setFilter}
        typeFilter={chat.typeFilter}
        setTypeFilter={chat.setTypeFilter}
        showHidden={chat.showHidden}
        onToggleHiddenReveal={chat.toggleHiddenReveal}
        onOpen={chat.setActive}
        onNew={() => setNewChatOpen(true)}
        onRefresh={() => chat.loadChats({ includeHidden: chat.showHidden })}
        onSettings={() => { setSettingsOpen(true); setViewInUrl('settings'); }}
        onArchive={(target) => chat.updatePreference('archived', target)}
      />
      <div id="main" className="main-pane">
        <ChatRoom
          user={user}
          chat={chat.active}
          messages={chat.messages}
          loading={chat.loading}
          text={chat.text}
          setText={chat.updateDraft}
          replyTo={chat.replyTo}
          onCancelReply={() => chat.setReplyTo(null)}
          onSend={chat.send}
          onBack={() => chat.setActive(null)}
          onRefresh={() => chat.active && chat.loadChat(chat.active)}
          onFile={chat.uploadFile}
          onInfo={() => { setInfoOpen(true); setViewInUrl('profile'); }}
          onSearch={() => setSearchOpen(true)}
          onOpenFiles={() => { setMediaPreviewMessage(null); setFilesOpen(true); }}
          onSelectMessage={setMessageAction}
          onSwipeReply={chat.setReplyTo}
          upload={chat.upload}
          pinnedMessage={chat.chatInfo?.pinnedMessage}
          onUnpinPinned={chat.unpinPinnedMessage}
          typingUsers={chat.activeTypingUsers}
          recording={chat.recording}
          recordingSeconds={chat.recordingSeconds}
          onStartVoice={chat.startVoiceRecording}
          onStopVoice={chat.stopVoiceRecording}
          onCancelVoice={chat.cancelVoiceRecording}
          onOpenMedia={(message) => { setMediaPreviewMessage(message); setFilesOpen(true); }}
          onDeleteChat={chat.deleteActiveChat}
          onNewChat={() => setNewChatOpen(true)}
          onOpenRss={() => { chat.setFilter('active'); chat.setTypeFilter('rss'); }}
        />
      </div>
    </div>

    {!chat.active && <IonFab vertical="bottom" horizontal="end" slot="fixed"><IonFabButton onClick={() => setNewChatOpen(true)}><Plus size={22} /></IonFabButton></IonFab>}

    <NewChatModal open={newChatOpen} onClose={() => setNewChatOpen(false)} onCreated={async (created) => { setNewChatOpen(false); const next = await chat.loadChats({ includeHidden: chat.showHidden, quiet: true }).catch(() => []); const target = next.find((item) => Number(item.id) === Number(created?.id)) || created; if (target?.id) chat.setActive(target); }} />
    <SearchModal open={searchOpen} chat={chat.active} onClose={() => setSearchOpen(false)} onJump={(message) => window.setTimeout(() => document.querySelector(`[data-message-id="${message.id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50)} />
    <FilesModal open={filesOpen} messages={chat.messages} initialPreview={mediaPreviewMessage} onClose={() => { setFilesOpen(false); setMediaPreviewMessage(null); }} />
    <ForwardModal open={forwardOpen} chats={chat.chats} activeId={chat.active?.id} onClose={() => { setForwardOpen(false); setForwardMessage(null); }} onForward={async (target) => { const message = forwardMessage; setForwardOpen(false); setForwardMessage(null); await chat.forwardMessageToChat(message, target); }} />
    <ChatInfoModal open={infoOpen} chat={chat.active} info={chat.chatInfo} user={user} onClose={() => { setInfoOpen(false); setViewInUrl(chat.active ? 'chat' : 'chats'); }} onCreateInvite={chat.createInvite} onPreference={chat.updatePreference} onBlockPeer={async (id) => { await chat.blockPeer(id); setInfoOpen(false); }} onToggleHidden={async () => { setInfoOpen(false); await chat.toggleHidden(); }} onDelete={async () => { setInfoOpen(false); await chat.deleteActiveChat(); }} />
    <SettingsModal open={settingsOpen} user={user} onClose={() => { setSettingsOpen(false); setViewInUrl(chat.active ? 'chat' : 'chats'); }} onLogout={logout} onUserUpdate={setUser} themeMode={themeMode} onThemeModeChange={setThemeMode} />
    <ContactsModal open={contactsOpen} onClose={() => { setContactsOpen(false); setViewInUrl(chat.active ? 'chat' : 'chats'); }} onOpenChat={async (created) => { const next = await chat.loadChats({ includeHidden: chat.showHidden, quiet: true }).catch(() => []); const target = next.find((item) => Number(item.id) === Number(created?.id)) || created; if (target?.id) chat.setActive(target); }} />
    <ShortcutHelp open={shortcutHelpOpen} onClose={() => setShortcutHelpOpen(false)} />
    <PwaInstallPrompt />

    <IonActionSheet isOpen={Boolean(messageAction)} header="Message" onDidDismiss={() => setMessageAction(null)} buttons={actionButtons} />
    <IonToast isOpen={Boolean(chat.toast)} message={chat.toast} duration={2600} onDidDismiss={() => chat.setToast('')} />
  </IonApp>;
}
