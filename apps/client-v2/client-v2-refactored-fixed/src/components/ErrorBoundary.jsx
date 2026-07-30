import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error('[TinyChat] render error', error, info); }
  render() {
    if (!this.state.error) return this.props.children;
    return <div className="app-error-fallback"><div><h1>Tiny Chat recovered from an interface error.</h1><p>{this.state.error?.message || 'Unexpected interface error'}</p><button type="button" onClick={() => location.reload()}>Reload app</button></div></div>;
  }
}
