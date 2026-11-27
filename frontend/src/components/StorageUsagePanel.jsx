import { useCallback, useEffect, useState } from "react";
import { FaCloud, FaSyncAlt } from "react-icons/fa";
import API from "../services/api";

const formatBytes = (value) => {
    const bytes = Math.max(0, Number(value) || 0);
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1000 * 1000)).toFixed(1)} MB`;
};

const StorageUsagePanel = () => {
    const [usage, setUsage] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState("");

    const loadUsage = useCallback(async () => {
        setRefreshing(true);
        setError("");
        try {
            const response = await API.get("/storage/usage");
            setUsage(response.data);
        } catch (requestError) {
            setError(requestError.response?.data?.message || "Unable to load storage usage right now.");
        } finally {
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        let active = true;
        const fetchInitialUsage = async () => {
            try {
                const response = await API.get("/storage/usage");
                if (active) setUsage(response.data);
            } catch (requestError) {
                if (active) {
                    setError(requestError.response?.data?.message || "Unable to load storage usage right now.");
                }
            } finally {
                if (active) setLoading(false);
            }
        };
        fetchInitialUsage();
        return () => { active = false; };
    }, []);

    if (loading) {
        return <div className="storage-usage-panel" role="status">Checking your storage usage...</div>;
    }

    if (error) {
        return (
            <div className="storage-usage-panel">
                <p className="settings-status error" role="alert">{error}</p>
                <button type="button" className="btn btn-inline btn-secondary" onClick={loadUsage} disabled={refreshing}>
                    <FaSyncAlt aria-hidden="true" /> {refreshing ? "Checking..." : "Try again"}
                </button>
            </div>
        );
    }

    const percent = Math.min(100, Math.max(0, Number(usage?.percentUsed) || 0));
    const alertText = percent >= 90
        ? "Storage is almost full. Remove unused files before uploading more."
        : percent >= 75
            ? "Storage is getting full. Review old course materials and unused uploads."
            : "SmartCampus blocks new uploads before this safety limit is exceeded.";
    const alertClass = percent >= 90 ? "error" : percent >= 75 ? "warning" : "success";

    return (
        <div className="storage-usage-panel">
            <div className="storage-usage-heading">
                <span className="storage-usage-icon"><FaCloud aria-hidden="true" /></span>
                <div>
                    <h2>Supabase file storage</h2>
                    <p>Free-tier protection for SmartCampus uploads</p>
                </div>
                <button
                    type="button"
                    className="btn btn-inline btn-secondary storage-refresh-button"
                    onClick={() => loadUsage(true)}
                    disabled={refreshing}
                    aria-label="Refresh storage usage"
                >
                    <FaSyncAlt aria-hidden="true" /> {refreshing ? "Refreshing..." : "Refresh"}
                </button>
            </div>

            <div className="storage-usage-main">
                <div>
                    <span>Project storage in use</span>
                    <strong>{formatBytes(usage.accountedBytes)} <small>of {formatBytes(usage.quotaBytes)}</small></strong>
                </div>
                <strong className="storage-usage-percent">{percent}%</strong>
            </div>
            <progress
                className="storage-usage-progress"
                value={percent}
                max="100"
                aria-label="Supabase project storage used"
            />
            <div className="storage-usage-stats">
                <div><span>Stored objects</span><strong>{Number(usage.objectCount || 0).toLocaleString()}</strong></div>
                <div><span>Reserved uploads</span><strong>{formatBytes(usage.reservedBytes)}</strong></div>
                <div><span>Remaining capacity</span><strong>{formatBytes(usage.availableBytes)}</strong></div>
            </div>

            <div className="storage-usage-user">
                <h3>Your SmartCampus uploads</h3>
                <strong>{formatBytes(Number(usage.userUsedBytes || 0) + Number(usage.userReservedBytes || 0))}</strong>
                <span>{Number(usage.userObjectCount || 0).toLocaleString()} stored file(s)</span>
            </div>

            <p className={`storage-usage-notice ${alertClass}`} role="status">{alertText}</p>
            <p className="storage-usage-footnote">
                The 800 MB safety limit leaves a buffer below Supabase Free's 1 GB file-storage allowance.
                Each unfinished signed upload temporarily reserves up to 20 MB to protect the quota from
                inaccurate file-size claims. Usage includes all storage buckets in this Supabase project;
                other projects in your Supabase organisation may also use part of the organisation's allowance.
            </p>
        </div>
    );
};

export default StorageUsagePanel;
