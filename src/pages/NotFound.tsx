import { Link } from 'react-router-dom';

export default function NotFound() {
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
      <div style={{ textAlign: 'center', maxWidth: 440 }}>
        <img
          src="/logo.png"
          alt="Concept Crack"
          style={{ width: 64, height: 64, borderRadius: 14, objectFit: 'cover', margin: '0 auto 24px' }}
        />
        <div
          className="text-gradient-brand"
          style={{ fontSize: 72, fontWeight: 800, lineHeight: 1, fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          404
        </div>
        <h1 className="text-title-lg" style={{ color: 'var(--text-primary)', margin: '12px 0 8px' }}>
          Page not found
        </h1>
        <p className="text-body-md" style={{ color: 'var(--text-muted)', marginBottom: 24 }}>
          The page you're looking for doesn't exist or may have moved.
        </p>
        <Link to="/" className="btn-primary btn-md" style={{ display: 'inline-flex' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>home</span>
          Back to home
        </Link>
      </div>
    </div>
  );
}
