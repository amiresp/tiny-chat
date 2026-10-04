import React from 'react';
import { createRoot } from 'react-dom/client';
import './vazirmatn.css';
import './styles/refactor.css';
import { bootstrapTheme } from './hooks/useTheme';
import { App } from './app/App';
import { ErrorBoundary } from './components/ErrorBoundary';

bootstrapTheme();

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');
createRoot(root).render(<ErrorBoundary><App /></ErrorBoundary>);
