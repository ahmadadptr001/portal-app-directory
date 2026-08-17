import { ImageResponse } from 'next/og';

export const alt = 'Portal Direktori Aplikasi';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 50%, #3b82f6 100%)',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 32, marginBottom: 40 }}>
          <div
            style={{
              width: 120,
              height: 120,
              borderRadius: 28,
              background: 'rgba(255,255,255,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
              flexShrink: 0,
            }}
          >
            <svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
              <path d="m3.3 7 8.7 5 8.7-5" />
              <path d="M12 22V12" />
            </svg>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ display: 'flex', fontSize: 72, fontWeight: 700, color: 'white', letterSpacing: '-0.02em' }}>
            Portal App
          </div>
          <div style={{ display: 'flex', fontSize: 36, fontWeight: 400, color: 'rgba(255,255,255,0.8)', marginTop: 12 }}>
            Directory
          </div>
        </div>
        <div style={{ display: 'flex', marginTop: 50, padding: '12px 32px', borderRadius: 999, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)' }}>
          <div style={{ display: 'flex', fontSize: 24, color: 'rgba(255,255,255,0.9)' }}>
            Portal Direktori Aplikasi v2
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
