'use client';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Plus, ExternalLink, Pencil, ShieldCheck, RefreshCw, Monitor, Unplug } from 'lucide-react';
import { loadAttendanceStations, manageAttendanceStation } from '@/app/actions/attendance-stations';
import { stationDefaults, type AttendanceStation, type StationManagementData, type StationReply, type StationSettings } from '@/lib/attendance/stations/types';

export default function AttendanceStationManagement({ initial }: { initial: StationReply<StationManagementData> }) {
    const [data, setData] = useState(initial.success ? initial.data : null);
    const [error, setError] = useState<string | null>(initial.success ? null : initial.error);
    const [notice, setNotice] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [editing, setEditing] = useState<AttendanceStation | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [pairStation, setPairStation] = useState<string | null>(null);
    const [code, setCode] = useState('');
    const [deviceName, setDeviceName] = useState('');
    const [draft, setDraft] = useState<StationSettings>({ ...stationDefaults, name: '', store_id: initial.success ? initial.data.stores[0]?.id || '' : '' });
    const [now, setNow] = useState(() => initial.success ? Date.parse(initial.data.serverNow) : Date.now());
    const offset = useRef(initial.success ? Date.parse(initial.data.serverNow) - Date.now() : 0);
    const mutation = useRef(false);
    const refreshVersion = useRef(0);
    const id = useId();
    const refresh = useCallback(async (clearError = false) => {
        const version = ++refreshVersion.current;
        try {
            const result = await loadAttendanceStations();
            if (version !== refreshVersion.current) return;
            if (result.success) { offset.current = Date.parse(result.data.serverNow) - Date.now(); setNow(Date.parse(result.data.serverNow)); setData(result.data); if (clearError) setError(null); }
            else setError(result.error);
        } catch { if (version === refreshVersion.current) setError('Station status could not be refreshed. Check your connection.'); }
    }, []);
    useEffect(() => {
        const timer = window.setInterval(() => { setNow(Date.now() + offset.current); if (!document.hidden && !mutation.current) void refresh(); }, 15000);
        return () => window.clearInterval(timer);
    }, [refresh]);
    const save = async (operation: Parameters<typeof manageAttendanceStation>[0]) => {
        if (mutation.current) return;
        mutation.current = true; refreshVersion.current += 1; setBusy(true); setError(null); setNotice(null);
        try {
            const result = await manageAttendanceStation(operation);
            if (!result.success) { setError(result.error); return; }
            setNotice(operation.action === 'pair' ? 'Display authorized. It can run without an administrator signed in.' : operation.action === 'revoke' ? 'Display revoked. Its QR codes are no longer valid.' : 'Station saved.');
            setShowForm(false); setEditing(null); setPairStation(null); setCode(''); setDeviceName('');
            await refresh();
        } catch { setError('The change could not be confirmed. Refresh station status before retrying.'); }
        finally { mutation.current = false; setBusy(false); }
    };
    const edit = (station: AttendanceStation) => {
        setEditing(station); setDraft({ store_id: station.store_id, name: station.name, refresh_seconds: station.refresh_seconds, validity_seconds: station.validity_seconds,
            heartbeat_seconds: station.heartbeat_seconds, offline_seconds: station.offline_seconds, credential_days: station.credential_days }); setShowForm(true);
    };
    const stale = Boolean(editing && data?.stations.find(station => station.id === editing.id)?.updated_at !== editing.updated_at);
    return <div className="station-management space-y-6">
        <header className="station-management-heading"><div><h1>Attendance stations</h1><p>Authorize branch displays and manage rotating attendance codes.</p></div><button type="button" disabled={busy || !data?.stores.length} className="station-admin-primary" onClick={() => { setEditing(null); setDraft({ ...stationDefaults, name: '', store_id: data?.stores[0]?.id || '' }); setShowForm(true); }}><Plus size={17} />New station</button></header>
        <p className="station-setup-note"><ShieldCheck size={18} aria-hidden="true" />Enable Smart Scan for each branch after deployment and verification. Displays follow that branch’s attendance settings.</p>
        {error && <div role="alert" className="station-admin-error"><p>{error}</p><button type="button" disabled={busy} onClick={() => void refresh(true)}><RefreshCw size={15} />Refresh status</button></div>}
        {notice && <p role="status" className="station-admin-notice">{notice}</p>}
        {showForm && <form className="station-admin-form" onSubmit={event => { event.preventDefault(); void save(editing ? { action: 'update', stationId: editing.id, settings: draft, active: editing.active, expectedUpdatedAt: editing.updated_at } : { action: 'create', settings: draft }); }}>
            <h2>{editing ? 'Edit station' : 'New station'}</h2>
            <div className="station-form-grid"><label htmlFor={`${id}-name`}>Station name<input id={`${id}-name`} required minLength={2} maxLength={80} value={draft.name} onChange={e => setDraft(v => ({ ...v, name: e.target.value }))} placeholder="E.g. Billing counter" /></label>
                <label htmlFor={`${id}-branch`}>Branch<select id={`${id}-branch`} required value={draft.store_id} onChange={e => setDraft(v => ({ ...v, store_id: e.target.value }))}><option value="">Select a branch</option>{data?.stores.map(store => <option value={store.id} key={store.id}>{store.name || 'Unnamed branch'}</option>)}</select></label>
                {([{ key: 'refresh_seconds', label: 'QR refresh (seconds)', min: 15, max: 120 }, { key: 'validity_seconds', label: 'QR validity (seconds)', min: 20, max: 180 }, { key: 'heartbeat_seconds', label: 'Heartbeat (seconds)', min: 5, max: 60 }, { key: 'offline_seconds', label: 'Offline threshold (seconds)', min: 30, max: 600 }, { key: 'credential_days', label: 'New display authorization (days)', min: 1, max: 365 }] as const).map(field => <label key={field.key} htmlFor={`${id}-${field.key}`}>{field.label}<input id={`${id}-${field.key}`} type="number" min={field.min} max={field.max} required value={draft[field.key]} onChange={e => setDraft(v => ({ ...v, [field.key]: Number(e.target.value) }))} /></label>)}
            </div><p>Moving a station to another branch revokes every paired display. A shorter validity applies to newly issued codes.</p>{stale && <p role="alert">Station settings changed. Cancel and reopen the editor to load the latest settings.</p>}<div className="station-form-actions"><button disabled={busy || stale} className="station-admin-primary" type="submit">{busy ? 'Saving…' : 'Save station'}</button><button type="button" disabled={busy} onClick={() => setShowForm(false)}>Cancel</button></div>
        </form>}
        {!data ? null : !data.stores.length ? <div className="station-admin-empty"><h2>No branches configured</h2><p>Add your store branches before creating an attendance station.</p></div> : !data.stations.length ? <div className="station-admin-empty"><Monitor size={30} aria-hidden="true" /><h2>No attendance stations yet</h2><p>Create a station, open its display link on a store computer or tablet, then approve its pairing code here.</p></div> : <div className="station-admin-list">{data.stations.map(station => {
            const devices = data.devices.filter(device => device.station_id === station.id);
            const authorized = devices.filter(device => device.approved_at && !device.revoked_at && Date.parse(device.credential_expires_at) > now);
            const online = authorized.filter(device => device.last_seen_at && now - Date.parse(device.last_seen_at) < station.offline_seconds * 1000);
            return <section key={station.id} className="station-admin-card" aria-labelledby={`station-${station.id}`}>
                <div className="station-card-heading"><div><h2 id={`station-${station.id}`}>{station.name}</h2><p>{data.stores.find(store => store.id === station.store_id)?.name || 'Branch'} · {station.active ? 'Active' : 'Inactive'}</p></div><span className="station-admin-online" data-online={Boolean(online.length)}>{online.length ? `${online.length} online` : 'No displays online'}</span></div>
                <dl className="station-stats"><div><dt>QR codes issued</dt><dd>{station.issued_count.toLocaleString('en-IN')}</dd></div><div><dt>Authorized displays</dt><dd>{authorized.length}</dd></div><div><dt>Refresh / validity</dt><dd>{station.refresh_seconds}s / {station.validity_seconds}s</dd></div></dl>
                <div className="station-card-actions"><a href={`/attendance-station?station=${station.id}`} target="_blank" rel="noreferrer"><ExternalLink size={16} />Open display</a><button type="button" disabled={busy} onClick={() => edit(station)}><Pencil size={16} />Edit</button><button type="button" disabled={busy || !station.active} onClick={() => { setPairStation(station.id); setCode(''); setDeviceName(''); }}><ShieldCheck size={16} />Authorize display</button><button type="button" disabled={busy} onClick={() => { if (!station.active || window.confirm('Deactivate this station and revoke every paired display? Each display will need authorization again.')) { const { store_id, name, refresh_seconds, validity_seconds, heartbeat_seconds, offline_seconds, credential_days } = station; void save({ action: 'update', stationId: station.id, active: !station.active, expectedUpdatedAt: station.updated_at, settings: { store_id, name, refresh_seconds, validity_seconds, heartbeat_seconds, offline_seconds, credential_days } }); } }}>{station.active ? 'Deactivate' : 'Activate'}</button></div>
                {pairStation === station.id && <form className="station-pair-form" onSubmit={e => { e.preventDefault(); void save({ action: 'pair', stationId: station.id, code, deviceName }); }}><p>Open the display link on the store device, choose Authorize display, and verify its code in person before approving.</p><label htmlFor={`${id}-${station.id}-code`}>Pairing code<input id={`${id}-${station.id}-code`} autoComplete="off" autoCapitalize="characters" required maxLength={9} value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="ABCD EFGH" /></label><label htmlFor={`${id}-${station.id}-device`}>Display name<input id={`${id}-${station.id}-device`} required minLength={2} maxLength={80} value={deviceName} onChange={e => setDeviceName(e.target.value)} placeholder="E.g. Billing computer" /></label><div className="station-form-actions"><button type="submit" disabled={busy} className="station-admin-primary">{busy ? 'Authorizing…' : 'Authorize this display'}</button><button type="button" disabled={busy} onClick={() => setPairStation(null)}>Cancel</button></div></form>}
                {devices.length > 0 && <div className="station-device-list">{devices.map(device => <div key={device.id}><div><strong>{device.name}</strong><p>{device.revoked_at ? 'Revoked' : !device.approved_at ? Date.parse(device.pairing_expires_at) > now ? 'Awaiting authorization' : 'Pairing expired' : Date.parse(device.credential_expires_at) <= now ? 'Authorization expired' : 'Authorized'} · {device.last_seen_at ? `Last heartbeat ${new Date(device.last_seen_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })}` : 'No heartbeat yet'}</p></div>{!device.revoked_at && <button type="button" disabled={busy} onClick={() => { if (window.confirm(`Revoke ${device.name}? Its QR codes will stop working.`)) void save({ action: 'revoke', stationId: station.id, deviceId: device.id }); }}><Unplug size={15} />Revoke</button>}</div>)}</div>}
            </section>;
        })}</div>}
    </div>;
}
