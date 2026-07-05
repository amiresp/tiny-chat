import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Verdant UI error:', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="fatal-error">
        <section>
          <h1>Something went wrong</h1>
          <p>{this.state.error.message || 'The interface could not be rendered.'}</p>
          <button onClick={() => window.location.reload()}>Reload application</button>
        </section>
      </main>
    );
  }
}
