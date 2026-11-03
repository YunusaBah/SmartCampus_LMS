import { useEffect, useMemo, useState } from "react";
import { FaTimes } from "react-icons/fa";
import API from "../services/api";

const ReportExportDialog = ({ title, columns, rows, reportType, onClose }) => {
    const [selectedColumns, setSelectedColumns] = useState(() => columns.map((column) => column.key));
    const [error, setError] = useState("");
    const [exporting, setExporting] = useState(false);
    const allSelected = selectedColumns.length === columns.length;
    const selected = useMemo(
        () => columns.filter((column) => selectedColumns.includes(column.key)),
        [columns, selectedColumns]
    );

    useEffect(() => {
        const previousOverflow = document.body.style.overflow;
        const closeOnEscape = (event) => {
            if (event.key === "Escape") onClose();
        };
        document.body.style.overflow = "hidden";
        window.addEventListener("keydown", closeOnEscape);
        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener("keydown", closeOnEscape);
        };
    }, [onClose]);

    const toggleColumn = (key) => setSelectedColumns((current) =>
        current.includes(key) ? current.filter((item) => item !== key) : [...current, key]
    );

    const exportReport = async () => {
        if (!selected.length) {
            setError("Select at least one column to export.");
            return;
        }
        setError("");
        setExporting(true);
        try {
            const reportRows = rows.map((row, index) => Object.fromEntries(selected.map((column) => [
                column.key,
                column.value ? column.value(row, index) : row[column.key] ?? ""
            ])));
            const response = await API.post("/reports/excel", {
                reportType,
                columns: selected.map((column) => column.key),
                rows: reportRows
            }, { responseType: "blob" });
            const blobUrl = URL.createObjectURL(response.data);
            const download = document.createElement("a");
            download.href = blobUrl;
            download.download = `${reportType}-report.xlsx`;
            document.body.appendChild(download);
            download.click();
            download.remove();
            window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
            onClose();
        } catch (exportError) {
            const responseData = exportError.response?.data;
            const message = responseData instanceof Blob
                ? (await responseData.text()).then((text) => {
                    try {
                        return JSON.parse(text).message;
                    } catch {
                        return "";
                    }
                })
                : Promise.resolve(responseData?.message);
            setError(await message || "The Excel report could not be created. Please try again.");
        } finally {
            setExporting(false);
        }
    };

    return (
        <div className="course-modal-backdrop report-modal-backdrop" onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClose();
        }}>
            <section className="course-modal report-export-modal" role="dialog" aria-modal="true" aria-labelledby="report-export-title">
                <button type="button" className="course-modal-close" aria-label="Close report options" onClick={onClose}>
                    <FaTimes aria-hidden="true" />
                </button>
                <h2 id="report-export-title">{title}</h2>
                <p className="course-modal-intro">Choose the columns to include in your Excel report.</p>
                <label className="report-select-all">
                    <input type="checkbox" checked={allSelected} onChange={(event) => setSelectedColumns(event.target.checked ? columns.map((column) => column.key) : [])} />
                    <span>Select all columns</span>
                </label>
                <div className="report-column-options">
                    {columns.map((column) => (
                        <label key={column.key}>
                            <input type="checkbox" checked={selectedColumns.includes(column.key)} onChange={() => toggleColumn(column.key)} />
                            <span>{column.label}</span>
                        </label>
                    ))}
                </div>
                {error && <p className="dashboard-alert" role="alert">{error}</p>}
                <div className="report-export-actions">
                    <button type="button" className="btn btn-secondary" onClick={onClose} disabled={exporting}>Cancel</button>
                    <button type="button" className="btn btn-inline" onClick={exportReport} disabled={exporting}>{exporting ? "Preparing..." : "Download Excel"}</button>
                </div>
            </section>
        </div>
    );
};

export default ReportExportDialog;
