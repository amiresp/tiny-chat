import React, { memo } from 'react';
import { IonAvatar } from '../ui/primitives';
import { assetUrl } from '../api';
import { initials, titleOf } from '../lib/chat';

export const Avatar = memo(function Avatar({ entity, icon }) {
  const source = assetUrl(entity?.avatarUrl || entity?.avatar_url);
  return (
    <IonAvatar className={`vc-avatar chat-avatar ${entity?.peer?.isOnline || entity?.isOnline ? 'online' : ''}`}>
      {source ? <img src={source} alt={titleOf(entity)} loading="lazy" /> : <span>{icon || initials(entity)}</span>}
    </IonAvatar>
  );
});
