'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { css } from '@/lib/css';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (res.ok) {
      router.replace('/admin');
      router.refresh();
      return;
    }
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    setError(data.error || 'Login failed.');
    setBusy(false);
  }

  return (
    <main style={css('min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px;')}>
      <form onSubmit={submit} style={css('background: #fff; border-radius: 22px; box-shadow: 0 10px 30px rgba(74,44,77,0.12); padding: 34px; width: 100%; max-width: 380px;')}>
        <div style={css('display: flex; align-items: baseline; gap: 10px; margin-bottom: 6px;')}>
          <span style={css("font-family: 'Playfair Display', serif; font-size: 26px; font-weight: 700;")}>J<span style={css('color: #D4AF7A;')}>&amp;</span>N</span>
          <span style={css('font-size: 12px; letter-spacing: 2px; font-weight: 800; color: #D4AF7A;')}>ADMIN</span>
        </div>
        <p style={css('margin: 0 0 22px; color: #7a5f7d; font-size: 14px;')}>Sign in to manage bookings, costs and content.</p>

        <label style={css('display: flex; flex-direction: column; gap: 6px; font-size: 12.5px; font-weight: 800; letter-spacing: 1px; color: #D4AF7A; margin-bottom: 14px;')}>USERNAME
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" style={css('border: 2px solid #F3C6C6; border-radius: 12px; padding: 12px 14px; font-size: 16px; background: #FBF7F2;')} />
        </label>
        <label style={css('display: flex; flex-direction: column; gap: 6px; font-size: 12.5px; font-weight: 800; letter-spacing: 1px; color: #D4AF7A; margin-bottom: 18px;')}>PASSWORD
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" style={css('border: 2px solid #F3C6C6; border-radius: 12px; padding: 12px 14px; font-size: 16px; background: #FBF7F2;')} />
        </label>

        {!!error && <p style={css('margin: 0 0 14px; font-size: 13.5px; font-weight: 700; color: #c14a3e;')}>{error}</p>}

        <button type="submit" disabled={busy} style={css("cursor: pointer; width: 100%; background: #FF6F61; color: #fff; border: none; font-family: 'Nunito', sans-serif; font-weight: 800; font-size: 16px; padding: 14px; border-radius: 999px; min-height: 50px;")}>{busy ? 'Signing in…' : 'Sign in'}</button>
        <p style={css('margin: 18px 0 0; text-align: center; font-size: 12px;')}><a href="/" style={css('color: #7a5f7d;')}>← Back to site</a></p>
      </form>
    </main>
  );
}
