const XLSX = require("xlsx");

const reportColumns = {
    students: {
        no: "No.",
        fullName: "Full name",
        matNumber: "Mat. number",
        courseTitle: "Course",
        phone: "Phone number",
        email: "Email"
    },
    grades: {
        no: "No.",
        fullName: "Full name",
        matNumber: "Mat. number",
        courseTitle: "Course",
        timed: "Timed assignment",
        classwork: "Classwork",
        assignment: "Assignment"
    }
};

exports.exportExcel = (req, res) => {
    const { reportType, columns, rows } = req.body;
    const allowedColumns = Object.prototype.hasOwnProperty.call(reportColumns, reportType)
        ? reportColumns[reportType]
        : null;
    if (!allowedColumns || !Array.isArray(columns) || !columns.length ||
        columns.length > 20 || columns.some((column) =>
            typeof column !== "string" || !Object.prototype.hasOwnProperty.call(allowedColumns, column)
        ) ||
        !Array.isArray(rows) || rows.length > 5000 ||
        rows.some((row) => !row || typeof row !== "object" || Array.isArray(row))) {
        return res.status(400).json({ message: "Invalid report data or selected columns" });
    }
    if ((reportType === "students" || reportType === "grades") && req.user.role !== "lecturer") {
        return res.status(403).json({ message: "Only lecturers can export this report" });
    }

    try {
        const headers = columns.map((key) => allowedColumns[key]);
        const data = rows.map((row) => columns.map((key) => {
            const value = row[key];
            if (value == null) return "";
            if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") {
                throw new Error("Report values must be plain text or numbers");
            }
            const cell = String(value);
            if (cell.length > 32000) throw new Error("A report cell exceeds the Excel cell limit");
            return cell;
        }));
        const worksheet = XLSX.utils.aoa_to_sheet([headers, ...data]);
        worksheet["!cols"] = columns.map((key, index) => ({
            wch: Math.min(60, Math.max(headers[index].length + 2, 16, ...data.slice(0, 100).map((row) => String(row[index] || "").length + 2)))
        }));
        worksheet["!autofilter"] = { ref: worksheet["!ref"] };
        worksheet["!freeze"] = { xSplit: 0, ySplit: 1, topLeftCell: "A2", activePane: "bottomLeft", state: "frozen" };
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Report");
        const content = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
        const filename = `${reportType}-report.xlsx`;
        res.set({
            "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Content-Disposition": `attachment; filename="${filename}"`,
            "Content-Length": content.length,
            "Cache-Control": "private, no-store"
        });
        return res.send(content);
    } catch (error) {
        if (error.message.includes("Report values") || error.message.includes("Excel cell limit")) {
            return res.status(400).json({ message: error.message });
        }
        console.error("Failed to generate Excel report:", error);
        return res.status(500).json({ message: "Failed to generate Excel report" });
    }
};
