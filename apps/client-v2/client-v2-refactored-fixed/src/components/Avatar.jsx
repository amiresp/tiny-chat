import React, { memo } from 'react';
import { IonAvatar } from '@ionic/react';
import { assetUrl } from '../api';
import { initials, titleOf } from '../lib/chat';

export const Avatar = memo(function Avatar({ entity, icon }) {
  const source = assetUrl(entity?.avatarUrl || entity?.avatar_url);
  return (
    <IonAvatar className="vc-avatar">
      {source ? <img src={source} alt={titleOf(entity)} loading="lazy" /> : <span>{icon || initials(entity)}</span>}
    </IonAvatar>
  );
});
