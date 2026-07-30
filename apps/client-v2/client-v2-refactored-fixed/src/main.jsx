import React from 'react';
import { createRoot } from 'react-dom/client';
import { setupIonicReact } from '@ionic/react';
import '@ionic/react/css/core.css';
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';
import '@ionic/react/css/padding.css';
import '@ionic/react/css/flex-utils.css';
import './theme.css';
import './vazirmatn.css';
import './styles/refactor.css';
import { bootstrapTheme } from './hooks/useTheme';
import { App } from './app/App';
import { ErrorBoundary } from './components/ErrorBoundary';

setupIonicReact({ mode: 'ios' });
bootstrapTheme();

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');
createRoot(root).render(<ErrorBoundary><App /></ErrorBoundary>);
