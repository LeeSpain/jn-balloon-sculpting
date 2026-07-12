"use client";

import { useEffect, useState } from "react";

interface Status {
  publishable: string;
  secretSet: boolean;
  secretLast4: string;
  webhookSet: boolean;
  webhookLast4: string;
  mode: "test" | "live" | "";
  connected: boolean;
  acceptCardPayments: boolean;
  effectiveAcceptCard: boolean;
  configured: boolean;
  usingEnvFallback: boolean;
  webhookUrl: string;
}

const card = "bg-white rounded-2xl shadow-card";
const label = "flex flex-col gap-1.5 text-[12.5px] font-extrabold text-gold-ink";
const input =
  "rounded-xl bg-cream border-2 border-blush font-mono text-plum text-[13px]";

export default function PaymentsSettings() {
  const [status, setStatus] = useState<Status | null>(null);
  const [publishable, setPublishable] = useState("");
  const [secret, setSecret] = useState("");
  const [webhook, setWebhook] = useState("");
  const [busy, setBusy] = useState<"" | "save" | "test" | "toggle">("");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  async function load() {
    const r = await fetch("/api/admin/stripe");
    if (r.ok) {
      const s: Status = await r.json();
      setStatus(s);
      setPublishable(s.publishable || "");
    }
  }
  useEffect(() => {
    void load();
  }, []);

  async function saveKeys() {
    setBusy("save");
    setMsg(null);
    try {
      const r = await fetch("/api/admin/stripe", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publishable, secret, webhookSecret: webhook }),
      });
      const s = await r.json();
      if (!r.ok) throw new Error(s.error || "Save failed.");
      setStatus(s);
      setSecret("");
      setWebhook("");
      setMsg({ kind: "ok", text: "Keys saved. Now run “Test connection”." });
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : "Save failed." });
    } finally {
      setBusy("");
    }
  }

  async function testConnection() {
    setBusy("test");
    setMsg(null);
    try {
      const r = await fetch("/api/admin/stripe/test", { method: "POST" });
      const j = await r.json();
      await load();
      if (j.connected) {
        setMsg({ kind: "ok", text: `Connected to Stripe in ${j.mode === "live" ? "LIVE" : "TEST"} mode.` });
      } else {
        setMsg({ kind: "err", text: j.error || "Could not connect with that key." });
      }
    } catch {
      setMsg({ kind: "err", text: "Test failed — please try again." });
    } finally {
      setBusy("");
    }
  }

  async function toggleAccept(next: boolean) {
    setBusy("toggle");
    setMsg(null);
    try {
      const r = await fetch("/api/admin/stripe/accept", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accept: next }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Couldn’t change that.");
      await load();
      setMsg({ kind: "ok", text: next ? "Card payments are ON." : "Card payments are OFF." });
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : "Couldn’t change that." });
    } finally {
      setBusy("");
    }
  }

  function copyWebhook() {
    if (!status?.webhookUrl) return;
    navigator.clipboard?.writeText(status.webhookUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  }

  const s = status;
  const modeBadge = () => {
    if (!s?.connected) {
      return { text: "NOT CONNECTED", bg: "#FFE3DF", fg: "#c14a3e" };
    }
    return s.mode === "live"
      ? { text: "● LIVE MODE — real cards will be charged", bg: "#E4F0E4", fg: "#2f6b2f" }
      : { text: "● TEST MODE — no real money moves", bg: "#FFF4D6", fg: "#8a6a1a" };
  };
  const badge = modeBadge();

  return (
    <div className={card} style={{ padding: 22, marginBottom: 18 }}>
      <div className="flex items-center gap-3 mb-1.5 flex-wrap">
        <h2 className="font-display m-0" style={{ fontSize: 20 }}>
          Payments — Stripe
        </h2>
        <span
          className="text-xs font-extrabold rounded-full"
          style={{ padding: "6px 14px", background: badge.bg, color: badge.fg, letterSpacing: "0.5px" }}
        >
          {badge.text}
        </span>
      </div>
      <p className="m-0 mb-4 text-[13.5px] text-plum-soft">
        Paste your keys from the Stripe dashboard (Developers → API keys). Secret values
        are encrypted before they’re saved and are never shown again — only the last 4 digits.
      </p>

      {/* Keys */}
      <div className="flex flex-col gap-3" style={{ maxWidth: 560 }}>
        <label className={label} style={{ letterSpacing: "1px" }}>
          PUBLISHABLE KEY (pk_)
          <input
            value={publishable}
            onChange={(e) => setPublishable(e.target.value.trim())}
            placeholder="pk_test_… or pk_live_…"
            className={`${input} px-3 py-2.5`}
          />
        </label>
        <label className={label} style={{ letterSpacing: "1px" }}>
          SECRET KEY (sk_) {s?.secretSet && <span className="text-plum-soft font-normal">· saved ····{s.secretLast4}</span>}
          <input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value.trim())}
            placeholder={s?.secretSet ? "•••••••• (leave blank to keep)" : "sk_test_… or sk_live_…"}
            className={`${input} px-3 py-2.5`}
          />
        </label>
        <label className={label} style={{ letterSpacing: "1px" }}>
          WEBHOOK SIGNING SECRET (whsec_) {s?.webhookSet && <span className="text-plum-soft font-normal">· saved ····{s.webhookLast4}</span>}
          <input
            type="password"
            value={webhook}
            onChange={(e) => setWebhook(e.target.value.trim())}
            placeholder={s?.webhookSet ? "•••••••• (leave blank to keep)" : "whsec_…"}
            className={`${input} px-3 py-2.5`}
          />
        </label>
      </div>

      <div className="flex gap-2.5 mt-4 flex-wrap">
        <button
          onClick={saveKeys}
          disabled={busy !== ""}
          className="cursor-pointer bg-plum text-cream border-0 font-sans font-extrabold text-[13.5px] rounded-full disabled:opacity-60"
          style={{ padding: "11px 20px", minHeight: 44 }}
        >
          {busy === "save" ? "Saving…" : "Save keys"}
        </button>
        <button
          onClick={testConnection}
          disabled={busy !== "" || !s?.secretSet}
          className="cursor-pointer bg-white text-plum border-2 border-blush font-sans font-extrabold text-[13.5px] rounded-full disabled:opacity-50"
          style={{ padding: "9px 20px", minHeight: 44 }}
        >
          {busy === "test" ? "Testing…" : "Test connection"}
        </button>
      </div>

      {msg && (
        <p
          role={msg.kind === "err" ? "alert" : "status"}
          className="mt-3 mb-0 text-[13px] font-bold"
          style={{ color: msg.kind === "err" ? "#c14a3e" : "#2f6b2f" }}
        >
          {msg.text}
        </p>
      )}

      {/* Webhook endpoint */}
      <div className="mt-5 pt-4" style={{ borderTop: "1px solid #F3C6C6" }}>
        <p className={label} style={{ letterSpacing: "1px", marginBottom: 6 }}>WEBHOOK ENDPOINT</p>
        <div className="flex gap-2 items-center flex-wrap">
          <code
            className="bg-cream rounded-lg text-[12.5px]"
            style={{ padding: "9px 12px", border: "1px solid #F3C6C6", wordBreak: "break-all" }}
          >
            {s?.webhookUrl || "set NEXT_PUBLIC_SITE_URL to show this"}
          </code>
          <button
            onClick={copyWebhook}
            className="cursor-pointer bg-gold text-plum border-0 font-sans font-extrabold text-[12.5px] rounded-full"
            style={{ padding: "8px 14px", minHeight: 36 }}
          >
            {copied ? "Copied ✓" : "Copy"}
          </button>
        </div>
        <ol className="text-[13px] text-plum-soft mt-3 mb-0" style={{ paddingLeft: 18, lineHeight: 1.7 }}>
          <li>In Stripe: Developers → Webhooks → <strong>Add endpoint</strong>.</li>
          <li>Paste the URL above; choose the event <code>checkout.session.completed</code>.</li>
          <li>Create it, then copy the endpoint’s <strong>Signing secret</strong> (<code>whsec_…</code>).</li>
          <li>Paste that into the “Webhook signing secret” field above and Save.</li>
        </ol>
      </div>

      {/* Accept card payments toggle */}
      <div className="mt-5 pt-4" style={{ borderTop: "1px solid #F3C6C6" }}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="m-0 font-extrabold text-[14px]">Accept card payments</p>
            <p className="m-0 text-[12.5px] text-plum-soft" style={{ maxWidth: 420 }}>
              {s?.connected
                ? "When on, the booking form takes payment through Stripe. When off, it takes enquiries (“pay on confirmation”)."
                : "Save your keys and run a successful “Test connection” to enable this."}
            </p>
          </div>
          <button
            role="switch"
            aria-checked={!!s?.acceptCardPayments}
            disabled={busy !== "" || !s?.connected}
            onClick={() => toggleAccept(!s?.acceptCardPayments)}
            className="cursor-pointer border-0 rounded-full disabled:opacity-50"
            style={{
              width: 58,
              height: 32,
              background: s?.acceptCardPayments ? "#2f6b2f" : "#d8cbd9",
              position: "relative",
              transition: "background .15s",
            }}
            title={s?.connected ? "" : "Connect a tested key first"}
          >
            <span
              style={{
                position: "absolute",
                top: 3,
                left: s?.acceptCardPayments ? 29 : 3,
                width: 26,
                height: 26,
                borderRadius: "50%",
                background: "#fff",
                transition: "left .15s",
              }}
            />
          </button>
        </div>
        {s?.acceptCardPayments && !s?.effectiveAcceptCard && (
          <p role="alert" className="mt-2 mb-0 text-[12.5px] font-bold" style={{ color: "#c14a3e" }}>
            Payments are toggled on but not active yet — a database must be connected too.
          </p>
        )}
      </div>
    </div>
  );
}
