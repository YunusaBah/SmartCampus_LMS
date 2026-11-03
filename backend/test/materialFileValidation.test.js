const test = require("node:test");
const assert = require("node:assert/strict");
const AdmZip = require("adm-zip");
const validateMaterialFile = require("../src/utils/validateMaterialFile");

test("validates ZIP archives", async () => {
    const zip = new AdmZip();
    zip.addFile("project/src/main.txt", Buffer.from("source code"));
    const buffer = zip.toBuffer();
    assert.deepEqual(await validateMaterialFile({
        originalname: "project.zip",
        buffer,
        size: buffer.length
    }), { mimeType: "application/zip", fileSize: buffer.length });
});

test("validates file signatures and returns trusted metadata", async () => {
    const pdf = Buffer.from("%PDF-1.7\nsample");
    assert.deepEqual(await validateMaterialFile({
        originalname: "notes.pdf",
        buffer: pdf,
        size: pdf.length
    }), { mimeType: "application/pdf", fileSize: pdf.length });

    const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    assert.deepEqual(await validateMaterialFile({
        originalname: "image.png",
        buffer: png,
        size: png.length
    }), { mimeType: "image/png", fileSize: png.length });
});

test("rejects a supported extension with a mismatched file signature", async () => {
    await assert.rejects(
        validateMaterialFile({
            originalname: "notes.pdf",
            buffer: Buffer.from("not a PDF"),
            size: 9
        }),
        { message: "File contents do not match a supported material file type" }
    );
});

test("rejects unsupported material file extensions", async () => {
    await assert.rejects(
        validateMaterialFile({
            originalname: "script.exe",
            buffer: Buffer.from("sample"),
            size: 6
        }),
        { message: "File contents do not match a supported material file type" }
    );
});

test("validates plain text as UTF-8", async () => {
    const text = Buffer.from("Course notes\nWeek 1", "utf8");
    assert.deepEqual(await validateMaterialFile({
        originalname: "notes.txt",
        buffer: text,
        size: text.length
    }), { mimeType: "text/plain", fileSize: text.length });

    await assert.rejects(validateMaterialFile({
        originalname: "notes.txt",
        buffer: Buffer.from([0xff, 0xfe]),
        size: 2
    }));
});
