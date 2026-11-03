process.env.DB_HOST = "127.0.0.1";
process.env.DB_NAME = "test";
process.env.DB_USER = "test";
process.env.DB_PASSWORD = "test";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const AdmZip = require("adm-zip");
const Submission = require("../src/models/Submission");
const uploadsDirectory = require("../src/utils/uploadsDirectory");
const downloadController = require("../src/controllers/downloadController");

const response = () => ({
    statusCode: 200,
    body: null,
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
        Object.assign(this.headers, headers);
        return this;
    },
    send(body) {
        this.body = body;
        return this;
    }
});

test("authorized lecturers can list and preview files inside nested ZIP folders", async () => {
    const archiveName = `zip-preview-${process.pid}.zip`;
    const archivePath = path.join(uploadsDirectory, archiveName);
    const originalFindByPk = Submission.findByPk;
    const zip = new AdmZip();
    zip.addFile("project/src/main.txt", Buffer.from("source code"));
    zip.addFile("project/src/app.js", Buffer.from("console.log('SmartCampus');"));
    zip.addFile("project/docs/readme.txt", Buffer.from("project guide"));

    try {
        await fs.writeFile(archivePath, zip.toBuffer());
        Submission.findByPk = async () => ({
            studentId: 17,
            fileUrl: `/uploads/${archiveName}`,
            fileName: archiveName,
            assignment: { courseId: 2, course: { lecturerId: 9 } }
        });

        const request = {
            params: { resourceType: "submission", id: "41" },
            user: { id: 9, role: "lecturer" }
        };
        const listResponse = response();
        await downloadController.listArchive(request, listResponse);
        assert.deepEqual(listResponse.body.files.map((file) => file.path).sort(), [
            "project/docs/readme.txt",
            "project/src/app.js",
            "project/src/main.txt"
        ]);
        assert.equal(
            listResponse.body.files.find((file) => file.path === "project/src/app.js").type,
            "text/plain; charset=utf-8"
        );

        const fileResponse = response();
        await downloadController.downloadArchiveEntry({
            ...request,
            query: { path: "project/src/app.js" }
        }, fileResponse);
        assert.equal(fileResponse.body.toString(), "console.log('SmartCampus');");
        assert.equal(fileResponse.headers["Content-Type"], "text/plain; charset=utf-8");

        const traversalResponse = response();
        await downloadController.downloadArchiveEntry({
            ...request,
            query: { path: "../outside.txt" }
        }, traversalResponse);
        assert.equal(traversalResponse.statusCode, 400);
    } finally {
        Submission.findByPk = originalFindByPk;
        await fs.rm(archivePath, { force: true });
    }
});
