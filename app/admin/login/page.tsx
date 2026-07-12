"use client";

import { useState } from "react";

export default function AdminLogin() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        // Hard navigation (not router.replace): a full page load is guaranteed to
        // re-run the auth middleware and render /admin, so the spinner can never
        // be stranded by a stalled client-side (RSC) navigation. Keep busy=true —
        // the page is unloading.
        window.location.assign("/admin");
        return;
      }

      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.status === 429) {
        setError(data.error || "Too many attempts. Please wait a few minutes and try again.");
      } else if (res.status === 401) {
        setError(data.error || "Incorrect password.");
      } else {
        setError(data.error || `Login failed (${res.status}). Please try again.`);
      }
    } catch {
      setError("Couldn’t reach the server. Check your connection and try again.");
    }
    // Reached on every non-navigating (error) path — the spinner always clears.
    setBusy(false);
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-5">
      <form
        onSubmit={submit}
        className="bg-white rounded-3xl shadow-panel w-full max-w-sm"
        style={{ padding: 32 }}
      >
        <p className="font-display text-2xl font-bold m-0">
          J<span className="text-gold">&amp;</span>N <span className="text-gold text-sm align-middle">ADMIN</span>
        </p>
        <p className="text-plum-soft text-sm m-0 mt-1 mb-6">Enter your password to continue.</p>
        <label className="flex flex-col gap-1.5 text-[12.5px] font-extrabold text-gold-ink" style={{ letterSpacing: "1px" }}>
          PASSWORD
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            className="border-2 border-blush rounded-xl px-3 py-2.5 text-base bg-cream text-plum font-sans"
          />
        </label>
        {error && <p role="alert" className="text-[13.5px] font-bold mt-3 mb-0" style={{ color: "#c14a3e" }}>{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="cursor-pointer bg-coral-deep text-white border-0 font-sans font-extrabold text-base rounded-full w-full mt-5 disabled:opacity-70"
          style={{ padding: "13px 20px", minHeight: 48 }}
        >
          {busy ? "…" : "Log in"}
        </button>
      </form>
    </main>
  );
}
