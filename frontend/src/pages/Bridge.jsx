import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import "../theme/cockpit.css";

/* ───────────────────────── data layer ───────────────────────── */
const API = "/api/v1/cockpit";
async function getJSON(path) {
  const r = await fetch(API + path);
  if (!r.ok) throw new Error(`${path} → ${r.status}`);
  return r.json();
}
const useProp = () =>
  useQuery({ queryKey: ["ck", "prop"], queryFn: () => getJSON("/prop"), refetchInterval: 30000, staleTime: 15000 });
const useResearch = () =>
  useQuery({ queryKey: ["ck", "research"], queryFn: () => getJSON("/research"), refetchInterval: 120000, staleTime: 60000 });

/* ambient market ticker — decorative; not wired to a live quote feed */
const TAPE = [
  ["EURUSD", "1.0842", "+0.06"], ["XAUUSD", "4,327.8", "+0.31"], ["US500", "30,153", "-0.12"],
  ["USTEC", "30,178", "+0.22"], ["DE30", "24,996", "+0.18"], ["NIFTY", "24,712", "+0.41"],
  ["BANKNIFTY", "52,840", "+0.29"], ["INDIAVIX", "12.84", "-1.10"], ["GBPUSD", "1.2731", "-0.04"],
];

/* sidebar nav → in-page section jumps (one screen of content; not separate routes yet) */
const NAV = [
  ["BRIDGE", "ti-layout-dashboard", "ck-top"],
  ["PROP", "ti-activity-heartbeat", "ck-prop"],
  ["RSRCH", "ti-flask", "ck-research"],
  ["DATA", "ti-database", "ck-data"],
  ["SYS", "ti-settings", "ck-sys"],
];

/* ───────────────────────── helpers ───────────────────────── */
const money = (n) =>
  n == null ? "—" : "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (f, dp = 2) => (f == null ? "—" : (f >= 0 ? "+" : "") + (f * 100).toFixed(dp) + "%");
const dirCls = (f) => (f == null ? "ck-neu" : f > 0 ? "ck-up" : f < 0 ? "ck-down" : "ck-neu");
const sym = (s) => (s || "").replace(/\.Qtek$/i, "");
const axN = (n) => Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 });

function ago(iso) {
  if (!iso) return "—";
  const s = (Date.now() - +new Date(iso)) / 1000;
  if (s < 90) return Math.round(s) + "s ago";
  if (s < 5400) return Math.round(s / 60) + "m ago";
  if (s < 172800) return Math.round(s / 3600) + "h ago";
  return Math.round(s / 86400) + "d ago";
}

const COLOR = { grn: "#3ee08f", cyan: "#36c9ff", amber: "#f2b03a", mag: "#e85cf0", red: "#ff5b76" };
const SB = {
  pass: ["✓", "ck-up"], star: ["★", "ck-up"],
  null: ["✗", "ck-down"], fail: ["✗", "ck-down"],
  pending: ["⋯", "ck-neu"],
};

function useClock() {
  const [t, setT] = useState({ ist: "--:--:--", utc: "--:--" });
  useEffect(() => {
    const p = (n) => String(n).padStart(2, "0");
    const tick = () => {
      const d = new Date();
      const ist = new Date(d.getTime() + (330 + d.getTimezoneOffset()) * 60000);
      setT({
        ist: `${p(ist.getHours())}:${p(ist.getMinutes())}:${p(ist.getSeconds())}`,
        utc: `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`,
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return t;
}

/* eases from the previous displayed value to a new target — big sweep on first load,
   small glides on each poll. */
function useCountUp(target, ms = 900) {
  const [v, setV] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    if (target == null) return;
    const from = prev.current, to = target;
    if (from === to) { setV(to); return; }
    const steps = 40, inc = (to - from) / steps;
    let n = from, i = 0;
    const id = setInterval(() => {
      i++; n += inc;
      if (i >= steps) { n = to; clearInterval(id); }
      setV(n);
    }, ms / steps);
    prev.current = to;
    return () => clearInterval(id);
  }, [target, ms]);
  return v;
}

/* build SVG geometry for the dual equity line + area, on a shared time/value axis */
function buildChart(live, shadow, W = 760, H = 150, pad = 14) {
  const L = (live || []).filter((p) => p && p.v != null);
  const S = (shadow || []).filter((p) => p && p.v != null);
  const allV = [...L, ...S].map((p) => p.v);
  if (allV.length < 2) return null;
  const allT = [...L, ...S].map((p) => +new Date(p.t));
  const t0 = Math.min(...allT);
  const t1 = Math.max(...allT) || t0 + 1;
  let vmin = Math.min(...allV), vmax = Math.max(...allV);
  if (vmin === vmax) { vmin -= 1; vmax += 1; }
  const padV = (vmax - vmin) * 0.12;
  vmin -= padV; vmax += padV;
  const X = (t) => (t1 === t0 ? 0 : ((+new Date(t) - t0) / (t1 - t0)) * W);
  const Y = (v) => pad + (1 - (v - vmin) / (vmax - vmin)) * (H - 2 * pad);
  const toPts = (A) => A.map((p) => `${X(p.t).toFixed(1)},${Y(p.v).toFixed(1)}`).join(" ");
  const sPts = toPts(S), lPts = toPts(L);
  const area = S.length
    ? `M ${X(S[0].t).toFixed(1)},${H} L ${sPts} L ${X(S[S.length - 1].t).toFixed(1)},${H} Z`
    : null;
  return { sPts, lPts, area, vmin, vmax, mid: (vmin + vmax) / 2, W, H, pad, Y };
}

/* ───────────────────────── component ───────────────────────── */
export default function Bridge() {
  const clock = useClock();
  const { data: prop, isError: propErr } = useProp();
  const { data: rsrch } = useResearch();
  const p = prop || {};
  const r = rsrch || {};

  const hero = useCountUp(p.shadow_equity ?? null);
  const [active, setActive] = useState("BRIDGE");
  const go = (key, id) => {
    setActive(key);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const [fill, setFill] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setFill(true), 150);
    return () => clearTimeout(id);
  }, []);

  const chart = buildChart(p.live_series, p.shadow_series);
  const fills = [...(p.fills || [])].reverse();
  const positions = p.positions || [];

  const updSec = p.updated ? (Date.now() - +new Date(p.updated)) / 1000 : null;
  const engineOnline = updSec != null && updSec < 1800;        // ≤ 30 min ⇒ healthy
  const engineStale = updSec != null && updSec >= 1800;
  const riskOk = (p.last_risk || "").toLowerCase() === "ok";

  /* research with fallback to last-known static copy if the endpoint is unreachable */
  const sleeve = r.sleeve || {};
  const h4 = sleeve.momentum_h4 || { label: "H4 · 52wk-high mom", sharpe: 0.95, t: 3.23, dd: -0.31 };
  const lowbeta = sleeve.lowbeta || { label: "Low-beta", sharpe: 0.88, dd: -0.21 };
  const blend = sleeve.blend || { label: "Sleeve", sharpe: 0.94, dd: -0.26 };
  const scoreboard = r.scoreboard || [
    { id: "H1", status: "pass" }, { id: "H2", status: "pass" }, { id: "H4", status: "star" },
    { id: "H5", status: "null" }, { id: "H6", status: "null" }, { id: "H7", status: "pass" },
    { id: "H8", status: "null" }, { id: "H3", status: "pending" }, { id: "H11", status: "pending" },
  ];
  const pipeline = r.pipeline || [];
  const note = r.note || "7 families screened · 3 keepers · long-short rejected · diversify cross-asset";

  const led = (label, color) => (
    <div className="ck-led">{label}<span className="l" style={{ background: color, boxShadow: `0 0 6px ${color}` }} /></div>
  );

  return (
    <div className="cockpit">
      <div className="ck-grid" />

      <div className="ck-tape">
        <div className="run">
          {[...TAPE, ...TAPE].map(([s, px, c], i) => (
            <span key={i}>{s} <b>{px}</b> <span style={{ color: c[0] === "+" ? COLOR.grn : COLOR.red }}>{c}%</span></span>
          ))}
        </div>
      </div>

      <div className="ck-shell">
        <header className="ck-head">
          <div className="ck-brand">QUANT<span>//</span>COCKPIT<small>CROSS-ASSET COMMAND</small></div>
          <span className="ck-chip"><span className="ck-dot" /> systems {propErr ? "offline" : "nominal"}</span>
          <div className="ck-hgap" />
          <span
            className="ck-chip"
            style={engineOnline
              ? { color: COLOR.grn, borderColor: "rgba(62,224,143,.35)" }
              : { color: COLOR.amber, borderColor: "rgba(242,176,58,.35)" }}
          >
            <span className="ck-dot" /> engine {propErr ? "no link" : engineOnline ? "online" : "stale"}
          </span>
          <span className="ck-chip">updated · {ago(p.updated)}</span>
          <span className="ck-clock">{clock.ist}<i>IST · {clock.utc} UTC</i></span>
        </header>

        <nav className="ck-nav">
          {NAV.map(([k, icon, id]) => (
            <a key={k} className={active === k ? "on" : ""} onClick={() => go(k, id)} style={{ cursor: "pointer" }}>
              <i className={"ti " + icon} />{k}
            </a>
          ))}
        </nav>

        <main className="ck-main">
          <div className="ck-row ck-hero" id="ck-top" style={{ scrollMarginTop: 90 }}>
            <div className="ck-panel br">
              <div className="ck-ph"><span>Prop · shadow book <b>equity</b></span><span>vol-correct · live overlay</span></div>
              <div className="ck-big">{money(hero)}</div>
              <div className={"ck-bigsub " + dirCls(p.day_pnl_shadow)}>
                {p.day_pnl_shadow > 0 ? "▴ " : p.day_pnl_shadow < 0 ? "▾ " : "• "}
                {pct(p.day_pnl_shadow)} day · live {money(p.live_equity)} (min-lot) · gap {pct(p.live_vs_shadow)}
              </div>

              {chart ? (
                <svg viewBox="0 0 760 150" width="100%" height="150" preserveAspectRatio="none" style={{ marginTop: 10 }}>
                  <defs>
                    <linearGradient id="ckfill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stopColor="#e85cf0" stopOpacity="0.22" />
                      <stop offset="1" stopColor="#e85cf0" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {/* value gridlines + axis numbers */}
                  <g stroke="rgba(54,201,255,.08)">
                    <line x1="0" y1={chart.Y(chart.vmax) + 0.5} x2="760" y2={chart.Y(chart.vmax) + 0.5} />
                    <line x1="0" y1={chart.Y(chart.mid)} x2="760" y2={chart.Y(chart.mid)} />
                    <line x1="0" y1={chart.Y(chart.vmin) - 0.5} x2="760" y2={chart.Y(chart.vmin) - 0.5} />
                  </g>
                  <g fill="#6c89a8" fontSize="10" fontFamily="JetBrains Mono">
                    <text x="4" y={chart.Y(chart.vmax) + 11}>{axN(chart.vmax)}</text>
                    <text x="4" y={chart.Y(chart.mid) - 3}>{axN(chart.mid)}</text>
                    <text x="4" y={chart.Y(chart.vmin) - 3}>{axN(chart.vmin)}</text>
                  </g>
                  <path d={chart.area} fill="url(#ckfill)" />
                  <polyline className="ck-draw" fill="none" stroke="#e85cf0" strokeWidth="2.2" points={chart.sPts} />
                  <polyline fill="none" stroke="#36c9ff" strokeWidth="1.6" opacity="0.85" points={chart.lPts} />
                </svg>
              ) : (
                <div style={{ height: 150, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)", fontSize: 12 }}>
                  {propErr ? "engine endpoint unreachable" : "loading equity series…"}
                </div>
              )}
              <div style={{ display: "flex", gap: 16, fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
                <span><span style={{ color: "#e85cf0" }}>■</span> shadow (strategy)</span>
                <span><span style={{ color: "#36c9ff" }}>■</span> live (min-lot)</span>
              </div>
            </div>

            <div className="ck-panel br" id="ck-sys" style={{ scrollMarginTop: 90 }}>
              <div className="ck-ph"><span>Systems</span><span>integrity</span></div>
              <div style={{ display: "flex", justifyContent: "center", margin: "4px 0 10px" }}>
                <svg viewBox="0 0 130 130" width="150" height="150">
                  <circle cx="65" cy="65" r="54" fill="none" stroke="rgba(54,201,255,.08)" strokeWidth="6" />
                  <circle cx="65" cy="65" r="54" fill="none" stroke={engineOnline ? "#3ee08f" : "#f2b03a"} strokeWidth="6" strokeLinecap="round" strokeDasharray={(engineOnline ? 333 : 150) + " 339"} transform="rotate(-90 65 65)" />
                  <circle cx="65" cy="65" r="42" fill="none" stroke="rgba(54,201,255,.08)" strokeWidth="6" />
                  <circle cx="65" cy="65" r="42" fill="none" stroke="#36c9ff" strokeWidth="6" strokeLinecap="round" strokeDasharray="250 264" transform="rotate(-90 65 65)" />
                  <circle cx="65" cy="65" r="30" fill="none" stroke="rgba(54,201,255,.08)" strokeWidth="6" />
                  <circle cx="65" cy="65" r="30" fill="none" stroke={riskOk ? "#3ee08f" : "#ff5b76"} strokeWidth="6" strokeLinecap="round" strokeDasharray="6 182" transform="rotate(-90 65 65)" />
                  <text x="65" y="62" textAnchor="middle" fill="#eafbff" fontSize="19" fontFamily="Space Grotesk">{propErr ? "—" : engineOnline ? "OK" : "ZZZ"}</text>
                  <text x="65" y="80" textAnchor="middle" fill="#6c89a8" fontSize="9" letterSpacing="2">ALL SYS</text>
                </svg>
              </div>
              <div>
                {led(`engine loop · ${ago(p.updated)}`, engineOnline ? "#3ee08f" : "#f2b03a")}
                {led(`heartbeat ${propErr ? "· no link" : engineStale ? "· stale" : ""}`, propErr ? "#ff5b76" : engineOnline ? "#3ee08f" : "#f2b03a")}
                {led(`risk: ${p.last_risk || "—"}`, riskOk ? "#3ee08f" : "#ff5b76")}
                {led(`open legs · ${positions.length}`, "#36c9ff")}
                {led("held-out seal", "#f2b03a")}
              </div>
            </div>
          </div>

          <div className="ck-panel br" style={{ marginBottom: 15 }}>
            <div className="ck-ph"><span>Session timeline</span><span>24h UTC · markets your books touch</span></div>
            <svg viewBox="0 0 1000 96" width="100%" height="96" fontFamily="JetBrains Mono">
              <g stroke="rgba(54,201,255,.08)"><line x1="0" y1="14" x2="1000" y2="14" /></g>
              <g fill="#6c89a8" fontSize="11">
                <text x="0" y="10">00</text><text x="247" y="10">06</text><text x="497" y="10">12</text><text x="747" y="10">18</text><text x="975" y="10">24</text>
              </g>
              <g fontSize="11">
                <rect x="0" y="22" width="250" height="13" rx="2" fill="#1fe7c2" opacity="0.5" /><text x="8" y="32" fill="#04140f">TOKYO</text>
                <rect x="156" y="40" width="260" height="13" rx="2" fill="#36c9ff" opacity="0.55" /><text x="164" y="50" fill="#042033">NSE · 03:45–10:00</text>
                <rect x="292" y="58" width="354" height="13" rx="2" fill="#f2b03a" opacity="0.5" /><text x="300" y="68" fill="#3a2a05">LONDON</text>
                <rect x="562" y="76" width="271" height="13" rx="2" fill="#e85cf0" opacity="0.5" /><text x="570" y="86" fill="#3a0a3a">NEW YORK</text>
              </g>
              <NowMarker />
            </svg>
          </div>

          <div className="ck-sectit c" id="ck-prop" style={{ scrollMarginTop: 90 }}><i className="ti ti-activity-heartbeat" /> Prop monitor — QT dual-track</div>
          <div className="ck-row ck-r4">
            <div className="ck-panel ck-metric br">
              <div className="lbl">Day P&amp;L · shadow</div>
              <div className={"val " + dirCls(p.day_pnl_shadow)}>{pct(p.day_pnl_shadow)}</div>
              <div className="sub ck-neu">limit −4.0% · halt −2.4%</div>
            </div>
            <div className="ck-panel ck-metric br">
              <div className="lbl">Static DD</div>
              <div className={"val " + dirCls(p.static_dd_shadow)}>{pct(p.static_dd_shadow)}</div>
              <div className="sub ck-neu">floor −10.0% · halt −8.0%</div>
            </div>
            <div className="ck-panel ck-metric br">
              <div className="lbl">Live − Shadow</div>
              <div className={"val " + dirCls(p.live_vs_shadow)}>{pct(p.live_vs_shadow)}</div>
              <div className="sub ck-down">equity gap (min-lot vs vol-correct)</div>
            </div>
            <div className="ck-panel ck-metric br">
              <div className="lbl">Open Risk</div>
              <div className="val">{positions.length} {positions.length === 1 ? "leg" : "legs"}</div>
              <div className="sub ck-neu">{positions.length ? positions.map((x) => sym(x.symbol)).join(" · ") : "flat"}</div>
            </div>
          </div>

          <div className="ck-row ck-r2b">
            <div className="ck-panel br">
              <div className="ck-ph"><span>Open positions</span><span>shadow book · marked</span></div>
              <table>
                <tbody>
                  <tr><th>Symbol</th><th>Shadow</th><th>Mark</th><th>Sess</th></tr>
                  {positions.length ? positions.map((x) => (
                    <tr key={x.symbol}>
                      <td>{x.symbol}</td>
                      <td>{Number(x.shadow).toFixed(4)}</td>
                      <td>{x.mark != null ? Number(x.mark).toLocaleString("en-US", { maximumFractionDigits: 2 }) : "—"}</td>
                      <td><span className="ck-tag g">open</span></td>
                    </tr>
                  )) : (
                    <tr><td colSpan={4} style={{ color: "var(--muted)" }}>flat — no open positions</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="ck-panel br">
              <div className="ck-ph"><span>Recent fills</span><span>newest first</span></div>
              <table>
                <tbody>
                  <tr><th>Sym</th><th>Δ</th><th>Mode</th><th>Ref</th><th>Fill</th><th>Spread</th></tr>
                  {fills.length ? fills.map((f, i) => {
                    const fpx = Number(f.fill_px);
                    const ref = Number(f.ref_px);
                    const spr = Number(f.spread_px);
                    const up = String(f.delta || "").trim().startsWith("+");
                    return (
                      <tr key={i}>
                        <td>{sym(f.symbol)}</td>
                        <td className={up ? "ck-up" : "ck-down"}>{f.delta}</td>
                        <td>{f.mode}</td>
                        <td>{Number.isFinite(ref) ? ref.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "—"}</td>
                        <td>{Number.isFinite(fpx) && fpx > 0 ? fpx.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "—"}</td>
                        <td>{Number.isFinite(spr) ? spr.toFixed(2) : "—"}</td>
                      </tr>
                    );
                  }) : (
                    <tr><td colSpan={6} style={{ color: "var(--muted)" }}>no fills logged</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="ck-sectit m" id="ck-research" style={{ scrollMarginTop: 90 }}><i className="ti ti-flask" /> Research — NSE factor sleeve</div>
          <div className="ck-row ck-r4">
            <div className="ck-panel ck-metric br">
              <div className="lbl">{h4.label}</div>
              <div className="val ck-grn">{Number(h4.sharpe).toFixed(2)}</div>
              <div className="sub ck-up">Sharpe{h4.t != null ? ` · t ${Number(h4.t).toFixed(2)}` : ""}{h4.dd != null ? ` · DD ${pct(h4.dd, 0)}` : ""}</div>
            </div>
            <div className="ck-panel ck-metric br">
              <div className="lbl">{lowbeta.label}</div>
              <div className="val">{Number(lowbeta.sharpe).toFixed(2)}</div>
              <div className="sub ck-neu">Sharpe{lowbeta.dd != null ? ` · DD ${pct(lowbeta.dd, 0)}` : ""}</div>
            </div>
            <div className="ck-panel ck-metric br">
              <div className="lbl">{blend.label}</div>
              <div className="val">{Number(blend.sharpe).toFixed(2)}</div>
              <div className="sub ck-up">in-sample{blend.dd != null ? ` · DD ${pct(blend.dd, 0)}` : ""}</div>
            </div>
            <div className="ck-panel ck-metric br">
              <div className="lbl">Held-out</div>
              <div className="val ck-amber">{(sleeve.heldout || "sealed").toUpperCase()}</div>
              <div className="sub ck-neu">2023+ · spend once</div>
            </div>
          </div>

          <div className="ck-row ck-r2">
            <div className="ck-panel br">
              <div className="ck-ph"><span>Hypothesis scoreboard</span><span>in-sample · DSR&gt;0.95</span></div>
              <div className="ck-sb">
                {scoreboard.map((h) => {
                  const [glyph, cl] = SB[h.status] || SB.pending;
                  const dim = h.status === "pending";
                  return (
                    <div className="h" key={h.id} style={dim ? { opacity: 0.5 } : null}>
                      <span className="n">{h.id}</span><span className={"s " + cl}>{glyph}</span>
                    </div>
                  );
                })}
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 14 }}>{note}</div>
            </div>
            <div className="ck-panel br" id="ck-data" style={{ scrollMarginTop: 90 }}>
              <div className="ck-ph"><span>Data pipeline</span><span>status</span></div>
              <div style={{ display: "flex", flexDirection: "column", gap: 13, marginTop: 4 }}>
                {(pipeline.length ? pipeline : [
                  { name: "price panel · 2010–2026", pct: 100, color: "grn" },
                  { name: "PIT universe", pct: 100, color: "cyan" },
                  { name: "fundamentals · XBRL", pct: 28, color: "amber" },
                ]).map((b) => (
                  <div key={b.name}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>
                      <span>{b.name}</span><span>{b.pct}%</span>
                    </div>
                    <div className="ck-bar"><i style={{ width: fill ? b.pct + "%" : "0%", background: COLOR[b.color] || COLOR.cyan }} /></div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="ck-foot">
            QUANT // COCKPIT — live · forex engine + NSE research · polled 30s
            {p.updated ? ` · engine last reported ${ago(p.updated)}` : ""}
          </div>
        </main>
      </div>
    </div>
  );
}

/* live NOW marker on the 24h session timeline (UTC) */
function NowMarker() {
  const [x, setX] = useState(0);
  useEffect(() => {
    const tick = () => {
      const d = new Date();
      const frac = (d.getUTCHours() * 3600 + d.getUTCMinutes() * 60 + d.getUTCSeconds()) / 86400;
      setX(frac * 1000);
    };
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, []);
  return (
    <>
      <line x1={x} y1="16" x2={x} y2="92" stroke="#eafbff" strokeWidth="1.4" strokeDasharray="3 3" />
      <circle cx={x} cy="16" r="3.5" fill="#eafbff" />
      <text x={Math.max(0, x - 24)} y="13" fill="#eafbff" fontSize="11">NOW</text>
    </>
  );
}
