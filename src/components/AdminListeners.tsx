"use client";

import { useEffect, useState } from "react";
import { STATIONS } from "@/lib/stations";

type Listener = {
  ip?: string; connected_on?: number; connected_time?: number;
  device?: { client?: string; browser_family?: string; os_family?: string };
  location?: { country?: string; city?: string; description?: string };
};
type Report = { listeners: Listener[]; fetchedAt: string };
const channels = STATIONS.flatMap(station => station.hostChannels.map(channel => ({ ...channel, label: `${station.name} · ${channel.locale}` })));

export function AdminListeners() {
  const [channel, setChannel] = useState(channels[0].id);
  const [range, setRange] = useState("live");
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [page, setPage] = useState(0);
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    let controller: AbortController;
    setReport(null); setPage(0); setError(null);
    async function refresh() {
      setLoading(true);
      controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);
      try {
        const response = await fetch(`/api/admin/listeners?channel=${encodeURIComponent(channel)}&range=${range}`, { cache: "no-store", signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load listeners.");
        if (!stopped) { setReport(data); setPage(value => Math.min(value, Math.max(0, Math.ceil(data.listeners.length / 25) - 1))); setError(null); }
      } catch (error) {
        if (!stopped) setError(error instanceof Error ? error.message : "Unable to load listeners.");
      } finally {
        clearTimeout(timeout);
        if (!stopped) { setLoading(false); timer = setTimeout(refresh, range === "live" ? 15000 : 60000); }
      }
    }
    void refresh();
    return () => { stopped = true; clearTimeout(timer); controller?.abort(); };
  }, [channel, range, revision]);
  const listeners = report?.listeners || [];
  const countries = new Map<string, number>();
  listeners.forEach(listener => { const name = listener.location?.country || "Unknown"; countries.set(name, (countries.get(name) || 0) + 1); });
  const locations = [...countries].sort((a, b) => b[1] - a[1]);
  const duration = listeners.reduce((sum, listener) => sum + (listener.connected_time || 0), 0);
  return <div className="adminAudience">
    <section className="adminPanel adminAudienceFilters">
      <label className="adminField"><span>Channel</span><select value={channel} onChange={event => setChannel(event.target.value)}>{channels.map(channel => <option key={channel.id} value={channel.id}>{channel.label}</option>)}</select></label>
      <label className="adminField"><span>Time range</span><select value={range} onChange={event => setRange(event.target.value)}><option value="live">Live now</option><option value="1">Last 24 hours</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option></select></label>
      <button className="adminGhostButton" disabled={loading} onClick={() => setRevision(value => value + 1)}>{loading ? "Refreshing…" : "Refresh"}</button>
    </section>
    <p className="adminReportStatus" role="status">{error || (report ? `${range === "live" ? "Live report · Refreshes every 15 seconds" : "Historical report · Unique listeners within the selected period"} · Updated ${new Date(report.fetchedAt).toLocaleTimeString("en-GB")}` : "Connecting to AzuraCast…")}{error && report ? " Showing the last successful report; retrying automatically." : ""}</p>
    {report ? <>
      <div className="adminMetricGrid">
        <Metric label={range === "live" ? "Listening now" : "Unique listeners"} value={String(listeners.length)} detail={range === "live" ? "Connected to this channel" : "As grouped by AzuraCast"} />
        <Metric label="Countries" value={String(locations.filter(([name]) => name !== "Unknown").length)} detail="From available location data" />
        <Metric label="Average listening time" value={`${Math.round(duration / Math.max(1, listeners.length) / 60)} min`} detail="Per listener in this report" />
      </div>
      <section className="adminPanel"><div className="adminPanelHeader"><div><p className="sectionEyebrow">REACH</p><h3>Where people tune in</h3></div><small>Location may be unavailable or approximate.</small></div>
        {locations.length ? <div className="adminCountryGrid">{locations.slice(0, 10).map(([name, count]) => <div className="adminCountry" key={name}><div><strong>{name}</strong><span>{count} · {Math.round(count / listeners.length * 100)}%</span></div><div className="adminCountryTrack"><span style={{ width: `${count / listeners.length * 100}%` }} /></div></div>)}</div> : <p>No listeners recorded for this selection.</p>}
      </section>
      <section className="adminPanel"><div className="adminPanelHeader"><div><p className="sectionEyebrow">CONNECTIONS</p><h3>{range === "live" ? "Who’s tuned in" : "Listener history"}</h3></div><span>{listeners.length} listeners</span></div>
        <div className="adminTableScroll"><table className="adminListenerTable"><thead><tr><th>Listener</th><th>Location</th><th>Device / player</th><th>Connected</th><th>Listening time</th></tr></thead><tbody>{listeners.slice(page * 25, (page + 1) * 25).map((listener, index) => <tr key={`${listener.ip}-${index}`}><td>{listener.ip || "Unknown"}</td><td>{[listener.location?.city, listener.location?.country].filter(Boolean).join(", ") || "Unknown"}</td><td>{listener.device?.client || listener.device?.browser_family || "Unknown"}<small>{listener.device?.os_family}</small></td><td>{listener.connected_on ? new Date(listener.connected_on * 1000).toLocaleString("en-GB") : "—"}</td><td>{Math.round((listener.connected_time || 0) / 60)} min</td></tr>)}</tbody></table></div>
        {!listeners.length ? <p className="adminReportStatus">No connections to show. Try another channel or a longer time range. History depends on AzuraCast’s analytics retention settings.</p> : null}
        {listeners.length > 25 ? <div className="adminActivityTools"><button className="adminGhostButton" disabled={page === 0} onClick={() => setPage(value => value - 1)}>Previous</button><span>Page {page + 1} of {Math.ceil(listeners.length / 25)}</span><button className="adminGhostButton" disabled={(page + 1) * 25 >= listeners.length} onClick={() => setPage(value => value + 1)}>Next</button></div> : null}
      </section>
    </> : null}
  </div>;
}
function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <section className="adminPanel adminMetric"><p>{label}</p><strong>{value}</strong><small>{detail}</small></section>;
}
