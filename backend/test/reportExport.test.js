const test = require("node:test");
const assert = require("node:assert/strict");
const XLSX = require("xlsx");
const reportController = require("../src/controllers/reportController");

const response = () => ({
    statusCode: 200,
    headers: {},
    status(code) {
        this.statusCode = code;
        return this;
    },
    json(body) {
        this.body = body;
        return this;
    },
    set(headers) {
        this.headers = headers;
        return this;
    },
    send(body) {
        this.body = body;
        return this;
    }
});

test("Excel report exports only selected allowed columns", () => {
    const res = response();
    reportController.exportExcel({
        user: { role: "lecturer" },
        body: {
            reportType: "grades",
            columns: ["fullName", "assignment"],
            rows: [{ fullName: "Ada Student", assignment: "Essay: 85", matNumber: "excluded" }]
        }
    }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.headers["Content-Type"], "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    const workbook = XLSX.read(res.body, { type: "buffer" });
    assert.deepEqual(XLSX.utils.sheet_to_json(workbook.Sheets.Report, { header: 1 }), [
        ["Full name", "Assignment"],
        ["Ada Student", "Essay: 85"]
    ]);
});

test("Excel report rejects invalid columns and oversized reports", () => {
    const invalidColumnResponse = response();
    reportController.exportExcel({
        user: { role: "lecturer" },
        body: { reportType: "students", columns: ["__proto__"], rows: [] }
    }, invalidColumnResponse);
    assert.equal(invalidColumnResponse.statusCode, 400);

    const oversizedResponse = response();
    reportController.exportExcel({
        user: { role: "lecturer" },
        body: { reportType: "students", columns: ["fullName"], rows: Array(5001).fill({ fullName: "Student" }) }
    }, oversizedResponse);
    assert.equal(oversizedResponse.statusCode, 400);
});
