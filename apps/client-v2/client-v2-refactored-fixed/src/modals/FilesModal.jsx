import React, { useEffect, useMemo, useState } from 'react';
import { IonButton, IonButtons, IonContent, IonHeader, IonModal, IonSegment, IonSegmentButton, IonTitle, IonToolbar } from '@ionic/react';
import { FileText, X } from 'lucide-react';
import { assetUrl } from '../api';

function messageFileUrl(message) {
  if (message?.fileUrl) return message.fileUrl;
  if (!message?.filePath) return null;
  const fileName = String(message.filePath).split(/[\\/]/).pop();
  return fileName ? `/uploads/${fileName}` : null;
}

export function FilesModal({ open, messages, onClose, initialPreview = null }) {
  const [tab, setTab] = useState('media');
  const [preview, setPreview] = useState(null);
  useEffect(() => { if (open && initialPreview) setPreview(initialPreview); if (!open) setPreview(null); }, [open, initialPreview]);
  const { media, files } = useMemo(() => {
    const withFiles = messages.filter((message) => messageFileUrl(message));
    return {
      media: withFiles.filter((message) => message.mimeType?.startsWith('image/') || message.mimeType?.startsWith('video/')),
      files: withFiles.filter((message) => !message.mimeType?.startsWith('image/') && !message.mimeType?.startsWith('video/') && !message.mimeType?.startsWith('audio/')),
    };
  }, [messages]);

  return <>
    <IonModal isOpen={open} onDidDismiss={onClose}>
      <IonHeader><IonToolbar><IonTitle>Shared files</IonTitle><IonButtons slot="end"><IonButton onClick={onClose}><X size={18} /></IonButton></IonButtons></IonToolbar><IonToolbar><IonSegment value={tab} onIonChange={(event) => setTab(event.detail.value)}><IonSegmentButton value="media">Media</IonSegmentButton><IonSegmentButton value="files">Files</IonSegmentButton></IonSegment></IonToolbar></IonHeader>
      <IonContent className="ion-padding">{tab === 'media' ? <div className="media-grid-v2">{media.map((message) => { const url = assetUrl(messageFileUrl(message)); return <button type="button" key={message.id} className="media-grid-button" onClick={() => setPreview(message)}>{message.mimeType?.startsWith('video/') ? <video src={url} preload="metadata" /> : <img src={url} alt={message.fileName || 'media'} loading="lazy" />}</button>; })}</div> : <div className="file-list-v2">{files.map((message) => <a key={message.id} href={assetUrl(messageFileUrl(message))} target="_blank" rel="noreferrer" download={message.fileName || undefined}><FileText size={18} />{message.fileName || 'File'}</a>)}</div>}</IonContent>
    </IonModal>
    <IonModal isOpen={Boolean(preview)} onDidDismiss={() => setPreview(null)} cssClass="media-preview-modal">
      <IonHeader><IonToolbar><IonTitle>{preview?.fileName || 'Media'}</IonTitle><IonButtons slot="end"><IonButton onClick={() => setPreview(null)}><X size={18} /></IonButton></IonButtons></IonToolbar></IonHeader>
      <IonContent className="media-preview-content">{preview && (preview.mimeType?.startsWith('video/') ? <video src={assetUrl(messageFileUrl(preview))} controls autoPlay /> : <img src={assetUrl(messageFileUrl(preview))} alt={preview.fileName || 'media'} />)}</IonContent>
    </IonModal>
  </>;
}
