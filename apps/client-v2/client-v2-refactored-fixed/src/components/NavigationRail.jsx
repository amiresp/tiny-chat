import React from 'react';
import { Bookmark, MessageCircle, Rss, Settings, Users } from 'lucide-react';

const ITEMS = [
  ['chats', MessageCircle, 'Chats'],
  ['rss', Rss, 'RSS'],
  ['saved', Bookmark, 'Saved'],
  ['contacts', Users, 'Contacts'],
  ['settings', Settings, 'Settings'],
];

export function NavigationRail({ active, onAction }) {
  return <>
    <aside className="tiny-navigation-rail" aria-label="Main navigation">
      <div className="tiny-rail-brand" aria-hidden="true"><span>T</span></div>
      {ITEMS.map(([key, Icon, label], index) => <React.Fragment key={key}>
        {index === 4 && <div className="tiny-rail-spacer" />}
        <button type="button" className={active === key ? 'active' : ''} onClick={() => onAction(key)} aria-label={label} title={label}>
          <Icon size={20} /><span>{label}</span>
        </button>
      </React.Fragment>)}
    </aside>
    <nav className="tiny-mobile-nav" aria-label="Main navigation">
      {ITEMS.filter(([key]) => key !== 'saved').map(([key, Icon, label]) => <button type="button" key={key} className={active === key ? 'active' : ''} onClick={() => onAction(key)}>
        <Icon size={20} /><span>{key === 'rss' ? 'Discover' : label}</span>
      </button>)}
    </nav>
  </>;
}
