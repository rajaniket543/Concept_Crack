import { Component, type ErrorInfo, type ReactNode } from 'react';
import Logo from './Logo';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surfaced to the console for debugging; the UI shows a friendly fallback.
    console.error('Unhandled UI error:', error, info);
  }

  handleReload = () => {
    this.setState({ hasError: false });
    window.location.assign('/');
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--bg)',
          padding: 24,
        }}
      >
        <div className="card" style={{ maxWidth: 420, textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            <Logo size="lg" tone="theme" />
          </div>
          <h1 className="text-title-lg" style={{ color: 'var(--text-primary)', marginBottom: 8 }}>
            Something went wrong
          </h1>
          <p className="text-body-md" style={{ color: 'var(--text-muted)', marginBottom: 20 }}>
            An unexpected error occurred. Reloading usually fixes it.
          </p>
          <button type="button" className="btn-primary btn-md" style={{ display: 'inline-flex' }} onClick={this.handleReload}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>refresh</span>
            Reload app
          </button>
        </div>
      </div>
    );
  }
}
