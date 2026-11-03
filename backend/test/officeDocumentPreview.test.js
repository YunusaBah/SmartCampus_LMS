process.env.DB_HOST = "127.0.0.1";
process.env.DB_NAME = "test";
process.env.DB_USER = "test";
process.env.DB_PASSWORD = "test";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const XLSX = require("xlsx");
const AdmZip = require("adm-zip");
const Course = require("../src/models/Course");
const Lesson = require("../src/models/Lesson");
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
    set(name, value) {
        if (typeof name === "string") this.headers[name] = value;
        else Object.assign(this.headers, name);
        return this;
    }
});

test("authorized lecturers can preview spreadsheet cell contents", async () => {
    const fileName = `office-preview-${process.pid}.xlsx`;
    const filePath = path.join(uploadsDirectory, fileName);
    const originalLessonFindByPk = Lesson.findByPk;
    const originalCourseFindByPk = Course.findByPk;
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.aoa_to_sheet([["Student", "Score"], ["Ada", 95]]),
        "Results"
    );

    try {
        XLSX.writeFile(workbook, filePath);
        Lesson.findByPk = async () => ({
            courseId: 2,
            fileUrl: `/uploads/${fileName}`,
            fileName
        });
        Course.findByPk = async () => ({ lecturerId: 9 });

        const res = response();
        await downloadController.previewOfficeDocument({
            params: { resourceType: "lesson", id: "1" },
            user: { id: 9, role: "lecturer" }
        }, res);

        assert.equal(res.statusCode, 200);
        assert.match(res.body.content, /Results\nStudent,Score\nAda,95/);
        assert.equal(res.body.truncated, false);
        assert.equal(res.headers["Cache-Control"], "private, no-store");
    } finally {
        Lesson.findByPk = originalLessonFindByPk;
        Course.findByPk = originalCourseFindByPk;
        await fs.rm(filePath, { force: true });
    }
});

test("authorized lecturers can preview PowerPoint text by slide", async () => {
    const fileName = `office-preview-${process.pid}.pptx`;
    const filePath = path.join(uploadsDirectory, fileName);
    const originalLessonFindByPk = Lesson.findByPk;
    const originalCourseFindByPk = Course.findByPk;

    try {
        const presentation = new AdmZip();
        presentation.addFile(
            "ppt/slides/slide1.xml",
            Buffer.from("<p:sld><a:p><a:r><a:t>First slide</a:t></a:r></a:p></p:sld>")
        );
        presentation.addFile(
            "ppt/slides/slide2.xml",
            Buffer.from("<p:sld><a:p><a:r><a:t>Second slide</a:t></a:r></a:p></p:sld>")
        );
        presentation.writeZip(filePath);
        Lesson.findByPk = async () => ({
            courseId: 2,
            fileUrl: `/uploads/${fileName}`,
            fileName
        });
        Course.findByPk = async () => ({ lecturerId: 9 });

        const res = response();
        await downloadController.previewOfficeDocument({
            params: { resourceType: "lesson", id: "1" },
            user: { id: 9, role: "lecturer" }
        }, res);

        assert.equal(res.statusCode, 200);
        assert.deepEqual(res.body.slides, ["First slide", "Second slide"]);
        assert.match(res.body.content, /Slide 1\nFirst slide[\s\S]*Slide 2\nSecond slide/);
    } finally {
        Lesson.findByPk = originalLessonFindByPk;
        Course.findByPk = originalCourseFindByPk;
        await fs.rm(filePath, { force: true });
    }
});
