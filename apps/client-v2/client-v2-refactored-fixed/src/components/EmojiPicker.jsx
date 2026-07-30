import React, { useMemo, useState } from 'react';
import { Search, Smile, X } from 'lucide-react';

const EMOJI_GROUPS = {
  Recent: ['😀','😂','🥰','😍','😊','😉','😎','🤔','😭','😡','👍','❤️'],
  Smileys: ['😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇','🙂','🙃','😉','😌','😍','🥰','😘','😗','😙','😚','😋','😛','😝','😜','🤪','🤨','🧐','🤓','😎','🥳','😏','😒','😞','😔','😟','😕','🙁','☹️','😣','😖','😫','😩','🥺','😢','😭','😤','😠','😡','🤬','🤯','😳','🥵','🥶','😱','😨','😰','😥','🤗','🤔','🫣','🤭','🤫','🤥','😶','😐','😑','😬','🙄','😯','😦','😧','😮','😲','🥱','😴'],
  Gestures: ['👍','👎','👌','🤌','🤏','✌️','🤞','🫰','🤟','🤘','🤙','👈','👉','👆','👇','☝️','✋','🤚','🖐️','🖖','👋','🤝','👏','🙌','🫶','👐','🤲','🙏','✍️','💪'],
  Hearts: ['❤️','🩷','🧡','💛','💚','💙','🩵','💜','🤎','🖤','🩶','🤍','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟'],
  Animals: ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐻‍❄️','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🙈','🙉','🙊','🐔','🐧','🐦','🦄','🐝','🦋'],
  Food: ['🍏','🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🫐','🍈','🍒','🍑','🥭','🍍','🥥','🥝','🍅','🥑','🍕','🍔','🍟','🌭','🍿','🍩','🍪','🎂','☕'],
  Activities: ['⚽','🏀','🏈','⚾','🎾','🏐','🎱','🏓','🏸','🥊','🎮','🎯','🎲','🎸','🎧','🎤','🎬','🎨','🏆','🥇'],
  Travel: ['🚗','🚕','🚌','🚎','🏎️','🚓','🚑','🚒','🚚','🚲','🛵','🏍️','✈️','🚀','🚁','⛵','🚢','🏠','🏢','🌍','🌙','⭐','☀️','🌈'],
  Symbols: ['✅','❌','⚠️','❓','❗','💯','🔥','✨','🎉','🎊','💡','📌','📍','🔒','🔓','🔔','🔕','💬','💭','🗨️','📎','📁','📷','🎥'],
};

const RECENT_KEY = 'tiny-chat-recent-emojis';

function recentEmojis() {
  try {
    const value = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    return Array.isArray(value) && value.length ? value.slice(0, 24) : EMOJI_GROUPS.Recent;
  } catch { return EMOJI_GROUPS.Recent; }
}

function rememberEmoji(emoji) {
  const next = [emoji, ...recentEmojis().filter((item) => item !== emoji)].slice(0, 24);
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
}

export function EmojiPicker({ open, onClose, onPick }) {
  const [group, setGroup] = useState('Smileys');
  const [query, setQuery] = useState('');
  const emojis = useMemo(() => {
    if (query.trim()) return [...new Set(Object.values(EMOJI_GROUPS).flat())];
    return group === 'Recent' ? recentEmojis() : (EMOJI_GROUPS[group] || []);
  }, [group, query, open]);
  if (!open) return null;
  return <section className="tiny-emoji-picker" role="dialog" aria-label="Emoji picker">
    <header><label><Search size={15} /><input value={query} onChange={(e) => setQuery(e.target.value)} type="search" placeholder="Search emojis" /></label><button type="button" onClick={onClose} aria-label="Close"><X size={16} /></button></header>
    <nav>{Object.keys(EMOJI_GROUPS).map((name) => <button type="button" key={name} className={group === name ? 'active' : ''} onClick={() => { setGroup(name); setQuery(''); }} title={name}>{name === 'Recent' ? '🕘' : EMOJI_GROUPS[name][0]}</button>)}</nav>
    <div className="tiny-emoji-grid">{emojis.map((emoji, index) => <button type="button" key={`${emoji}-${index}`} onClick={() => { rememberEmoji(emoji); onPick(emoji); }} aria-label={emoji}>{emoji}</button>)}</div>
    {!emojis.length && <div className="tiny-emoji-empty"><Smile size={20} />No emojis found.</div>}
  </section>;
}
