import './smart-scan.css';

export default function SmartScanLoading() {
    return <div className="smart-scan-page smart-scan-skeleton" role="status" aria-label="Loading Smart Scan" aria-busy="true">
        <div className="smart-scan-heading" aria-hidden="true"><div className="smart-skeleton-title" /></div>
        <div className="smart-scan-card" aria-hidden="true"><div className="smart-card-heading"><div className="smart-skeleton-title" /></div><div className="smart-camera-placeholder" /></div>
    </div>;
}
