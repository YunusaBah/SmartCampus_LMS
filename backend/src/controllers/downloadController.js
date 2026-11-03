const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");
const mammoth = require("mammoth");
const XLSX = require("xlsx");

const Assignment = require("../models/Assignment");
const Course = require("../models/Course");
const Lesson = require("../models/Lesson");
const Submission = require("../models/Submission");
const Enrollment = require("../models/Enrollment");
const getCourseAccess = require("../utils/courseAccess");
const { hasCoursePermission } = require("../utils/coursePermissions");

const uploadsDirectory = require("../utils/uploadsDirectory");
const objectStorage = require("../utils/objectStorage");
const { objectKeyFor } = require("../utils/storedUpload");

const parseResourceId = (value) => {
    if (!/^[0-9]+$/.test(value)) return null;
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
};

const getDownloadResource = async (req, res) => {
    const resourceId = parseResourceId(req.params.id);
    if (!resourceId) {
        res.status(400).json({ message: "Invalid file resource ID" });
        return null;
    }

    let fileUrl;
    let downloadName;
    if (req.params.resourceType === "course-content") {
        const course = await Course.findByPk(resourceId);
        if (!course) {
            res.status(404).json({ message: "Course not found" });
            return null;
        }

        const access = await getCourseAccess(course.id, req.user);
        if (access.status) {
            res.status(access.status).json({ message: access.message });
            return null;
        }
        fileUrl = course.contentFileUrl;
        downloadName = course.contentFileName;
    } else if (req.params.resourceType === "lesson") {
        const lesson = await Lesson.findByPk(resourceId);
        if (!lesson) {
            res.status(404).json({ message: "Lesson not found" });
            return null;
        }

        const access = await getCourseAccess(lesson.courseId, req.user);
        if (access.status) {
            res.status(access.status).json({ message: access.message });
            return null;
        }
        fileUrl = lesson.fileUrl;
        downloadName = lesson.fileName;
    } else if (req.params.resourceType === "assignment") {
        const assignment = await Assignment.findByPk(resourceId);
        if (!assignment) {
            res.status(404).json({ message: "Assignment not found" });
            return null;
        }
        const access = await getCourseAccess(assignment.courseId, req.user);
        if (access.status) {
            res.status(access.status).json({ message: access.message });
            return null;
        }
        fileUrl = assignment.fileUrl;
        downloadName = assignment.fileName;
    } else if (req.params.resourceType === "submission") {
        const submission = await Submission.findByPk(resourceId, {
            include: [{
                model: Assignment,
                as: "assignment",
                include: [{ model: Course, as: "course" }]
            }]
        });
        if (!submission?.assignment?.course) {
            res.status(404).json({ message: "Submission not found" });
            return null;
        }

        const isSubmittingStudent = req.user.role === "student" &&
            submission.studentId === req.user.id;
        const isCourseLecturer = req.user.role === "lecturer" &&
            submission.assignment.course.lecturerId === req.user.id;
        const enrollment = req.user.role === "student" && !isSubmittingStudent
            ? await Enrollment.findOne({
                where: { courseId: submission.assignment.courseId, studentId: req.user.id }
            })
            : null;
        const isPermittedGrader = submission.studentId !== req.user.id &&
            hasCoursePermission(enrollment, "gradeAssignments");
        if (!isSubmittingStudent && !isCourseLecturer && !isPermittedGrader) {
            res.status(403).json({ message: "You cannot download this submission" });
            return null;
        }
        fileUrl = submission.fileUrl;
        downloadName = submission.fileName;
    } else {
        res.status(404).json({ message: "File resource not found" });
        return null;
    }

    return { fileUrl, downloadName };
};

const resolveLocalPath = async (fileUrl) => {
    const prefix = "/uploads/";
    if (typeof fileUrl !== "string" || !fileUrl.startsWith(prefix)) return null;
    const filename = fileUrl.slice(prefix.length);
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(filename)) return null;

    let uploadsRoot;
    let resolvedFile;
    try {
        uploadsRoot = await fs.promises.realpath(uploadsDirectory);
        resolvedFile = await fs.promises.realpath(path.resolve(uploadsRoot, filename));
    } catch (error) {
        if (error.code === "ENOENT" || error.code === "ENOTDIR") return null;
        throw error;
    }

    const relativePath = path.relative(uploadsRoot, resolvedFile);
    if (!relativePath || relativePath === ".." ||
        relativePath.startsWith(`..${path.sep}`) || path.isAbsolute(relativePath)) {
        return null;
    }
    return (await fs.promises.stat(resolvedFile)).isFile() ? resolvedFile : null;
};

const loadResourceContent = async (resource) => {
    const key = objectKeyFor(resource.fileUrl);
    if (key) return { ...resource, buffer: await objectStorage.download(key) };
    const filePath = await resolveLocalPath(resource.fileUrl);
    return filePath ? { ...resource, filePath } : null;
};

exports.download = async (req, res, next) => {
    const resource = await getDownloadResource(req, res);
    if (!resource) return;

    res.set("Cache-Control", "private, no-store");
    const key = objectKeyFor(resource.fileUrl);
    if (key) {
        const signedUrl = await objectStorage.signedDownloadUrl(key, resource.downloadName);
        return res.redirect(302, signedUrl);
    }
    const filePath = await resolveLocalPath(resource.fileUrl);
    if (!filePath) return res.status(404).json({ message: "File not found" });
    return res.download(filePath, resource.downloadName ? path.basename(resource.downloadName) : undefined, (error) => {
        if (!error) return;
        if (res.headersSent) return next(error);
        if (error.code === "ENOENT") {
            return res.status(404).json({ message: "File not found" });
        }
        return next(error);
    });
};

exports.previewOfficeDocument = async (req, res) => {
    const accessResource = await getDownloadResource(req, res);
    if (!accessResource) return;
    const resource = await loadResourceContent(accessResource);
    if (!resource) return res.status(404).json({ message: "File not found" });

    try {
        const extension = path.extname(resource.downloadName || "file").toLowerCase();
        const buffer = resource.buffer || await fs.promises.readFile(resource.filePath);
        let content;
        let slides;
        if (extension === ".docx") {
            if (!officeArchiveWithinLimits(buffer)) {
                return res.status(413).json({ message: "This document exceeds the preview limits" });
            }
            const result = await mammoth.extractRawText({ buffer });
            content = result.value;
        } else if ([".xls", ".xlsx"].includes(extension)) {
            if (extension === ".xlsx" && !officeArchiveWithinLimits(buffer)) {
                return res.status(413).json({ message: "This spreadsheet exceeds the preview limits" });
            }
            const workbook = XLSX.read(buffer, { type: "buffer", cellText: true });
            const sheetNames = workbook.SheetNames.slice(0, 20);
            content = sheetNames.map((name) => {
                const sheet = workbook.Sheets[name];
                const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
                const truncated = range.e.r - range.s.r >= 200 || range.e.c - range.s.c >= 40;
                range.e.r = Math.min(range.e.r, range.s.r + 199);
                range.e.c = Math.min(range.e.c, range.s.c + 39);
                return `${name}\n${XLSX.utils.sheet_to_csv(sheet, { range, blankrows: false })}${truncated ? "\n[Sheet preview truncated]" : ""}`;
            }).join("\n\n");
            if (workbook.SheetNames.length > sheetNames.length) content += "\n\n[Additional sheets omitted]";
        } else if (extension === ".pptx") {
            if (!officeArchiveWithinLimits(buffer)) {
                return res.status(413).json({ message: "This presentation exceeds the preview limits" });
            }
            const zip = new AdmZip(buffer);
            const slideEntries = zip.getEntries()
                .filter((entry) => /^ppt\/slides\/slide\d+\.xml$/.test(entry.entryName))
                .sort((left, right) => Number(left.entryName.match(/\d+/)[0]) - Number(right.entryName.match(/\d+/)[0]));
            if (slideEntries.length > 200 || slideEntries.some((entry) => entry.header.size > 10 * 1024 * 1024)) {
                return res.status(413).json({ message: "This presentation exceeds the preview limits" });
            }
            slides = slideEntries.map((entry) => {
                const xml = entry.getData().toString("utf8");
                const text = [...xml.matchAll(/<a:t\b[^>]*>([\s\S]*?)<\/a:t>/g)]
                    .map((match) => match[1]
                        .replace(/&amp;/g, "&")
                        .replace(/&lt;/g, "<")
                        .replace(/&gt;/g, ">")
                        .replace(/&quot;/g, "\"")
                        .replace(/&apos;/g, "'"))
                    .join("");
                return text;
            });
            content = slides.map((text, index) => `Slide ${index + 1}\n${text}`).join("\n\n");
        } else {
            return res.status(415).json({ message: "This office document format cannot be previewed in the browser" });
        }

        const maxCharacters = 1_000_000;
        let previewSlides;
        if (slides) {
            let remainingCharacters = maxCharacters;
            previewSlides = slides.map((slide) => {
                const preview = slide.slice(0, remainingCharacters);
                remainingCharacters -= preview.length;
                return preview;
            });
        }
        res.set("Cache-Control", "private, no-store");
        return res.json({
            content: content.slice(0, maxCharacters),
            truncated: content.length > maxCharacters,
            ...(previewSlides ? { slides: previewSlides } : {})
        });
    } catch (error) {
        console.error("Failed to preview office document:", error);
        return res.status(422).json({ message: "Unable to preview this office document" });
    }
};

const isSafeArchivePath = (value) => {
    if (typeof value !== "string" || !value || value.includes("\0")) return false;
    const normalized = value.replace(/\\/g, "/");
    return !normalized.startsWith("/") && !/^[A-Za-z]:/.test(normalized) &&
        !normalized.split("/").includes("..");
};

const officeArchiveWithinLimits = (file) => {
    const entries = new AdmZip(file).getEntries();
    let totalSize = 0;
    for (const entry of entries) {
        const size = Number(entry.header.size) || 0;
        totalSize += size;
        if (size > 20 * 1024 * 1024 || totalSize > 100 * 1024 * 1024) return false;
    }
    return true;
};

const archiveMimeType = (entryName) => ({
    ".pdf": "application/pdf",
    ".txt": "text/plain; charset=utf-8",
    ".csv": "text/csv; charset=utf-8",
    ".bat": "text/plain; charset=utf-8",
    ".c": "text/plain; charset=utf-8",
    ".cc": "text/plain; charset=utf-8",
    ".cmd": "text/plain; charset=utf-8",
    ".conf": "text/plain; charset=utf-8",
    ".config": "text/plain; charset=utf-8",
    ".cpp": "text/plain; charset=utf-8",
    ".cs": "text/plain; charset=utf-8",
    ".dart": "text/plain; charset=utf-8",
    ".diff": "text/plain; charset=utf-8",
    ".dockerfile": "text/plain; charset=utf-8",
    ".env": "text/plain; charset=utf-8",
    ".gradle": "text/plain; charset=utf-8",
    ".h": "text/plain; charset=utf-8",
    ".hpp": "text/plain; charset=utf-8",
    ".ini": "text/plain; charset=utf-8",
    ".kt": "text/plain; charset=utf-8",
    ".kts": "text/plain; charset=utf-8",
    ".log": "text/plain; charset=utf-8",
    ".html": "text/plain; charset=utf-8",
    ".htm": "text/plain; charset=utf-8",
    ".make": "text/plain; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".c": "text/plain; charset=utf-8",
    ".cc": "text/plain; charset=utf-8",
    ".cpp": "text/plain; charset=utf-8",
    ".css": "text/plain; charset=utf-8",
    ".go": "text/plain; charset=utf-8",
    ".h": "text/plain; charset=utf-8",
    ".hpp": "text/plain; charset=utf-8",
    ".java": "text/plain; charset=utf-8",
    ".js": "text/plain; charset=utf-8",
    ".jsx": "text/plain; charset=utf-8",
    ".md": "text/plain; charset=utf-8",
    ".patch": "text/plain; charset=utf-8",
    ".php": "text/plain; charset=utf-8",
    ".pl": "text/plain; charset=utf-8",
    ".properties": "text/plain; charset=utf-8",
    ".ps1": "text/plain; charset=utf-8",
    ".py": "text/plain; charset=utf-8",
    ".r": "text/plain; charset=utf-8",
    ".rb": "text/plain; charset=utf-8",
    ".rs": "text/plain; charset=utf-8",
    ".scala": "text/plain; charset=utf-8",
    ".sh": "text/plain; charset=utf-8",
    ".sql": "text/plain; charset=utf-8",
    ".swift": "text/plain; charset=utf-8",
    ".tex": "text/plain; charset=utf-8",
    ".toml": "text/plain; charset=utf-8",
    ".ts": "text/plain; charset=utf-8",
    ".tsx": "text/plain; charset=utf-8",
    ".vue": "text/plain; charset=utf-8",
    ".xml": "text/plain; charset=utf-8",
    ".yaml": "text/plain; charset=utf-8",
    ".yml": "text/plain; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".ogg": "audio/ogg",
    ".m4a": "audio/mp4",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".ogv": "video/ogg"
}[path.extname(entryName).toLowerCase()] || "application/octet-stream");

const loadArchive = async (resource, res) => {
    if (path.extname(resource.downloadName || "file").toLowerCase() !== ".zip") {
        res.status(415).json({ message: "This file is not a ZIP archive" });
        return null;
    }

    const zip = new AdmZip(resource.buffer || resource.filePath);
    const entries = zip.getEntries();
    if (entries.length > 2000) {
        res.status(413).json({ message: "ZIP archives may contain at most 2,000 files" });
        return null;
    }
    const files = [];
    let totalUncompressedSize = 0;
    for (const entry of entries) {
        if (entry.isDirectory || !isSafeArchivePath(entry.entryName)) continue;
        const size = Number(entry.header.size) || 0;
        totalUncompressedSize += size;
        if (size > 20 * 1024 * 1024 || totalUncompressedSize > 100 * 1024 * 1024) {
            res.status(413).json({ message: "This ZIP archive exceeds the preview size limits" });
            return null;
        }
        files.push({
            path: entry.entryName.replace(/\\/g, "/"),
            size,
            type: archiveMimeType(entry.entryName)
        });
    }
    return { zip, files };
};

exports.listArchive = async (req, res) => {
    try {
        const accessResource = await getDownloadResource(req, res);
        if (!accessResource) return;
        const resource = await loadResourceContent(accessResource);
        if (!resource) return res.status(404).json({ message: "File not found" });
        const archive = await loadArchive(resource, res);
        if (!archive) return;
        res.set("Cache-Control", "private, no-store");
        return res.json({ files: archive.files });
    } catch (error) {
        console.error("Failed to inspect ZIP archive:", error);
        return res.status(400).json({ message: "Unable to read this ZIP archive" });
    }
};

exports.downloadArchiveEntry = async (req, res) => {
    try {
        const entryPath = req.query.path;
        if (!isSafeArchivePath(entryPath)) {
            return res.status(400).json({ message: "Invalid archive file path" });
        }
        const accessResource = await getDownloadResource(req, res);
        if (!accessResource) return;
        const resource = await loadResourceContent(accessResource);
        if (!resource) return res.status(404).json({ message: "File not found" });
        const archive = await loadArchive(resource, res);
        if (!archive) return;
        const entry = archive.zip.getEntry(entryPath);
        if (!entry || entry.isDirectory || !archive.files.some((file) => file.path === entryPath.replace(/\\/g, "/"))) {
            return res.status(404).json({ message: "Archive file not found" });
        }
        const content = entry.getData();
        if (content.length > 20 * 1024 * 1024) {
            return res.status(413).json({ message: "This archive file exceeds the preview size limit" });
        }
        const basename = path.posix.basename(entryPath.replace(/\\/g, "/"));
        const filename = basename.replace(/[^\x20-\x7E"\\;]/g, "_").replace(/["\\;]/g, "_") || "archive-file";
        const encodedFilename = encodeURIComponent(basename).replace(/['()*]/g, (character) =>
            `%${character.charCodeAt(0).toString(16).toUpperCase()}`
        );
        res.set({
            "Cache-Control": "private, no-store",
            "Content-Type": archiveMimeType(entryPath),
            "Content-Disposition": `inline; filename="${filename}"; filename*=UTF-8''${encodedFilename}`
        });
        return res.send(content);
    } catch (error) {
        console.error("Failed to read ZIP archive entry:", error);
        return res.status(400).json({ message: "Unable to read this ZIP archive file" });
    }
};
