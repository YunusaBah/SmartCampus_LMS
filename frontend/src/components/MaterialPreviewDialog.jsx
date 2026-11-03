import { useEffect, useMemo, useRef, useState } from "react";
import { FaChevronDown, FaDownload, FaFile, FaFolder, FaSave, FaTimes } from "react-icons/fa";
import API from "../services/api";
import { downloadFile } from "../utils/downloadFile";

const makeArchiveTree = (files) => {
    const root = { children: new Map() };
    files.forEach((file) => {
        const parts = file.path.split("/");
        let parent = root;
        parts.forEach((part, index) => {
            const directory = index < parts.length - 1;
            const currentPath = parts.slice(0, index + 1).join("/");
            if (!parent.children.has(part)) {
                parent.children.set(part, {
                    name: part,
                    path: currentPath,
                    directory,
                    size: directory ? 0 : file.size,
                    type: directory ? "" : file.type,
                    children: new Map()
                });
            }
            parent = parent.children.get(part);
        });
    });

    const flatten = (node, depth = 0) => [...node.children.values()]
        .sort((left, right) => Number(right.directory) - Number(left.directory) || left.name.localeCompare(right.name))
        .flatMap((child) => [
            { ...child, depth },
            ...(child.directory ? flatten(child, depth + 1) : [])
        ]);
    return flatten(root);
};

const textFileExtensions = new Set([
    ".bat", ".c", ".cc", ".cmd", ".conf", ".config", ".cpp", ".cs", ".css",
    ".dart", ".diff", ".dockerfile", ".env", ".go", ".gradle", ".h", ".hpp",
    ".htm", ".html", ".ini", ".java", ".js", ".jsx", ".kt", ".kts", ".log",
    ".make", ".md", ".patch", ".php", ".pl", ".properties", ".ps1", ".py",
    ".r", ".rb", ".rs", ".scala", ".sh", ".sql", ".swift", ".tex", ".toml",
    ".ts", ".tsx", ".vue", ".xml", ".yaml", ".yml"
]);

const previewType = (type, name) => {
    const mimeType = type?.split(";")[0].trim();
    if (mimeType && mimeType !== "application/octet-stream") return mimeType;
    const extension = `.${String(name || "").split(".").pop()}`.toLowerCase();
    if (textFileExtensions.has(extension) || [".txt", ".csv"].includes(extension)) return "text/plain";
    if (extension === ".pdf") return "application/pdf";
    if ([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"].includes(extension)) {
        return extension === ".jpg" ? "image/jpeg" : extension === ".svg" ? "image/svg+xml" : `image/${extension.slice(1)}`;
    }
    if ([".mp4", ".webm", ".ogv"].includes(extension)) return "video/" + extension.slice(1);
    if ([".mp3", ".wav", ".ogg"].includes(extension)) return "audio/" + extension.slice(1);
    if (extension === ".m4a") return "audio/mp4";
    return type || "application/octet-stream";
};

const isPreviewableType = (type) =>
    type.startsWith("image/") ||
    type === "application/pdf" ||
    type === "application/json" ||
    type.startsWith("text/") ||
    type.startsWith("audio/") ||
    type.startsWith("video/");

const MaterialPreviewDialog = ({
    resourcePath,
    fileName,
    lessonId,
    textContent,
    onClose,
    gradeValue,
    feedbackValue,
    grading = false,
    onGradeChange,
    onFeedbackChange,
    onSaveGrade
}) => {
    const [file, setFile] = useState(null);
    const [officePreview, setOfficePreview] = useState(null);
    const [error, setError] = useState("");
    const [gradeError, setGradeError] = useState("");
    const [gradeSaved, setGradeSaved] = useState(false);
    const [archive, setArchive] = useState(null);
    const [archiveError, setArchiveError] = useState("");
    const [selectedArchivePath, setSelectedArchivePath] = useState("");
    const [archiveFile, setArchiveFile] = useState(null);
    const [collapsedFolders, setCollapsedFolders] = useState(() => new Set());
    const [privateNote, setPrivateNote] = useState("");
    const [noteLoading, setNoteLoading] = useState(Boolean(lessonId));
    const [noteSaving, setNoteSaving] = useState(false);
    const [noteError, setNoteError] = useState("");
    const [noteSaved, setNoteSaved] = useState(false);
    const [noteDirty, setNoteDirty] = useState(false);
    const [noteLoadFailed, setNoteLoadFailed] = useState(false);
    const archiveRequestId = useRef(0);

    useEffect(() => {
        if (!lessonId) return undefined;
        let active = true;
        API.get(`/lessons/${lessonId}/notes`, { skipOfflineCache: true })
            .then((response) => {
                if (!active) return;
                setPrivateNote(response.data.note || "");
                setNoteDirty(false);
                setNoteLoadFailed(false);
            })
            .catch((requestError) => {
                if (active) {
                    setNoteLoadFailed(true);
                    setNoteError(requestError.response?.data?.message || "Unable to load your private notes.");
                }
            })
            .finally(() => {
                if (active) setNoteLoading(false);
            });
        return () => { active = false; };
    }, [lessonId]);

    useEffect(() => {
        if (!resourcePath) return undefined;
        let active = true;
        let objectUrl;

        const isZip = /\.zip$/i.test(fileName || "") || /\.zip$/i.test(resourcePath);
        const isOfficeDocument = /\.(docx|xlsx|xls|pptx)$/i.test(fileName || "");
        const request = isZip
            ? API.get(`${resourcePath}/archive`)
            : isOfficeDocument
                ? API.get(`${resourcePath}/preview`)
            : API.request({ url: resourcePath, method: "GET", responseType: "blob" });
        request
            .then((response) => {
                if (!active) return;
                if (isZip) {
                    setArchive(response.data);
                    return;
                }
                if (isOfficeDocument) {
                    setOfficePreview(response.data);
                    return;
                }
                objectUrl = URL.createObjectURL(response.data);
                setFile({
                    url: objectUrl,
                    type: previewType(response.data.type, fileName)
                });
            })
            .catch((requestError) => {
                if (!active) return;
                const message = requestError.response?.data?.message || "Unable to preview this material.";
                if (isZip) setArchiveError(message);
                else setError(message);
            });

        return () => {
            active = false;
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [fileName, resourcePath]);

    useEffect(() => {
        if (!archiveFile?.url) return undefined;
        return () => URL.revokeObjectURL(archiveFile.url);
    }, [archiveFile?.url]);

    useEffect(() => {
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, []);

    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [onClose]);

    const canPreview = file && isPreviewableType(file.type);
    const archiveRows = useMemo(() => makeArchiveTree(archive?.files || []), [archive]);
    const visibleArchiveRows = archiveRows.filter((row) => {
        const ancestors = row.path.split("/").slice(0, -1);
        return !ancestors.some((_, index) =>
            collapsedFolders.has(ancestors.slice(0, index + 1).join("/"))
        );
    });

    const handleDownload = async () => {
        try {
            await downloadFile(resourcePath, fileName || "course-material");
        } catch (downloadError) {
            setError(downloadError.message || "Unable to download this material.");
        }
    };

    const saveGrade = async () => {
        setGradeError("");
        setGradeSaved(false);
        const result = await onSaveGrade?.();
        if (result) {
            setGradeError(result);
            return;
        }
        setGradeSaved(true);
    };

    const savePrivateNote = async (event) => {
        event.preventDefault();
        if (!lessonId || noteSaving) return;
        setNoteSaving(true);
        setNoteError("");
        setNoteSaved(false);
        try {
            const response = await API.put(`/lessons/${lessonId}/notes`, { note: privateNote });
            setPrivateNote(response.data.note);
            setNoteDirty(false);
            setNoteSaved(true);
        } catch (requestError) {
            setNoteError(requestError.response?.data?.message || "Unable to save your private notes.");
        } finally {
            setNoteSaving(false);
        }
    };

    const selectArchiveFile = async (archivePath) => {
        const requestId = ++archiveRequestId.current;
        setSelectedArchivePath(archivePath);
        setArchiveError("");
        setArchiveFile(null);
        try {
            const response = await API.get(`${resourcePath}/archive-entry`, {
                params: { path: archivePath },
                responseType: "blob"
            });
            if (requestId !== archiveRequestId.current) return;
            setArchiveFile({
                url: URL.createObjectURL(response.data),
                type: response.data.type || "application/octet-stream",
                blob: response.data
            });
        } catch (requestError) {
            if (requestId !== archiveRequestId.current) return;
            setArchiveError(requestError.response?.data?.message || "Unable to open this archive file.");
        }
    };

    const downloadArchiveFile = () => {
        if (!archiveFile) return;
        const url = URL.createObjectURL(archiveFile.blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = selectedArchivePath.split("/").pop() || "archive-file";
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    };

    const renderPreview = (preview, name) => {
        if (preview.type.startsWith("image/")) {
            return <img className="material-preview-image" src={preview.url} alt={name} />;
        }
        if (preview.type.startsWith("video/")) {
            return <video className="material-preview-media" src={preview.url} controls title={name} />;
        }
        if (preview.type.startsWith("audio/")) {
            return <audio className="material-preview-audio" src={preview.url} controls />;
        }
        if (preview.type === "application/pdf" || preview.type.startsWith("text/") || preview.type === "application/json") {
            return <iframe className="material-preview-frame" src={preview.url} title={name} />;
        }
        return null;
    };

    return (
        <div className="material-preview-backdrop">
            <section className="material-preview-dialog" role="dialog" aria-modal="true" aria-label={`Preview ${fileName || "course material"}`}>
                <header className="material-preview-header">
                    <strong>{fileName || "Course material"}</strong>
                    {onSaveGrade && (
                        <form className="material-preview-grading" onSubmit={(event) => {
                            event.preventDefault();
                            saveGrade();
                        }}>
                            <label>
                                Grade
                                <input
                                    aria-label="Assignment grade"
                                    maxLength={50}
                                    required
                                    value={gradeValue ?? ""}
                                    onChange={(event) => {
                                        onGradeChange?.(event.target.value);
                                        setGradeSaved(false);
                                    }}
                                    disabled={grading}
                                />
                            </label>
                            <label className="material-preview-feedback">
                                Feedback
                                <input
                                    aria-label="Feedback for student"
                                    maxLength={20000}
                                    value={feedbackValue ?? ""}
                                    onChange={(event) => {
                                        onFeedbackChange?.(event.target.value);
                                        setGradeSaved(false);
                                    }}
                                    disabled={grading}
                                />
                            </label>
                            <button type="submit" className="material-preview-save-grade" disabled={grading || !String(gradeValue ?? "").trim()}>
                                {grading ? "Saving..." : "Save grade"}
                            </button>
                        </form>
                    )}
                    {resourcePath && <details
                        className="material-preview-download"
                        onClick={(event) => {
                            if (event.target.closest("button")) event.currentTarget.open = false;
                        }}
                    >
                        <summary aria-label="Download file" title="Download file">
                            <FaDownload aria-hidden="true" />
                            <FaChevronDown aria-hidden="true" />
                        </summary>
                        <div role="menu">
                            <button type="button" role="menuitem" onClick={handleDownload}>
                                <FaDownload aria-hidden="true" /> Download original
                            </button>
                            {archive && selectedArchivePath && archiveFile && (
                                <button type="button" role="menuitem" onClick={downloadArchiveFile}>
                                    <FaDownload aria-hidden="true" /> Download selected file
                                </button>
                            )}
                        </div>
                    </details>}
                    <button type="button" className="material-preview-close-button" aria-label="Close preview" title="Close preview" onClick={onClose}><FaTimes /></button>
                </header>
                {gradeError && <p className="material-preview-grade-status" role="alert">{gradeError}</p>}
                {gradeSaved && <p className="material-preview-grade-status success" role="status">Grade saved and student notified.</p>}
                {archiveError && <p className="material-preview-message archive-error" role="alert">{archiveError}</p>}
                {error && <p className="material-preview-message" role="alert">{error}</p>}
                {resourcePath && !file && !archive && !officePreview && !error && !archiveError && <p className="material-preview-message" role="status">Loading preview...</p>}
                {archive && (
                    <div className="archive-explorer">
                        <aside className="archive-file-tree" aria-label="Files in archive">
                            <header>
                                <strong>{archive.files.length} files</strong>
                            </header>
                            <nav>
                                {visibleArchiveRows.map((row) => (
                                    <button
                                        type="button"
                                        key={row.path}
                                        className={`archive-tree-item${selectedArchivePath === row.path ? " active" : ""}`}
                                        style={{ "--archive-depth": row.depth }}
                                        aria-expanded={row.directory ? !collapsedFolders.has(row.path) : undefined}
                                        onClick={() => {
                                            if (row.directory) {
                                                setCollapsedFolders((current) => {
                                                    const next = new Set(current);
                                                    if (next.has(row.path)) next.delete(row.path);
                                                    else next.add(row.path);
                                                    return next;
                                                });
                                            } else {
                                                selectArchiveFile(row.path);
                                            }
                                        }}
                                    >
                                        {row.directory ? <FaFolder aria-hidden="true" /> : <FaFile aria-hidden="true" />}
                                        <span>{row.name}</span>
                                        {!row.directory && <small>{row.size.toLocaleString()} B</small>}
                                    </button>
                                ))}
                                {!archive.files.length && <p className="archive-empty">This ZIP contains no files.</p>}
                            </nav>
                        </aside>
                        <section className="archive-file-preview" aria-label="Selected archive file">
                            {selectedArchivePath && <header>
                                <strong>{selectedArchivePath}</strong>
                            </header>}
                            {!selectedArchivePath && <p className="material-preview-message">Choose a file or folder to browse the ZIP archive.</p>}
                            {selectedArchivePath && !archiveFile && !archiveError && <p className="material-preview-message" role="status">Loading file...</p>}
                            {archiveFile && renderPreview({ ...archiveFile, type: previewType(archiveFile.type, selectedArchivePath) }, selectedArchivePath)}
                            {archiveFile && !isPreviewableType(previewType(archiveFile.type, selectedArchivePath)) && (
                                <p className="material-preview-message">This file type cannot be previewed in the browser. Download it to open it in a compatible app.</p>
                            )}
                        </section>
                    </div>
                )}
                {file && canPreview && renderPreview(file, fileName || "Course material preview")}
                {file && !canPreview && (
                    <div className="material-preview-message">
                        <p>This file type cannot be previewed in the browser. Download it to open it in a compatible app.</p>
                    </div>
                )}
                {officePreview && (Array.isArray(officePreview.slides)
                    ? <div className="material-preview-slides">
                        {officePreview.slides.map((slide, index) => (
                            <article className="material-preview-slide" key={index}>
                                <h2>Slide {index + 1}</h2>
                                <pre>{slide || "No readable text was found on this slide."}</pre>
                            </article>
                        ))}
                        {officePreview.truncated && <p className="material-preview-message">Presentation preview truncated.</p>}
                    </div>
                    : <pre className="material-preview-document">{officePreview.content || "No readable text was found in this document."}{officePreview.truncated ? "\n\n[Preview truncated]" : ""}</pre>)}
                {textContent && !archive && !officePreview && (
                    <section className={`material-preview-answer${file ? " with-file" : ""}`}>
                        <h2>Student answer</h2>
                        <pre>{textContent}</pre>
                    </section>
                )}
                {lessonId && (
                    <form className="material-preview-notes" onSubmit={savePrivateNote}>
                        <div className="material-preview-notes-heading">
                            <label htmlFor="material-private-note">Private notes</label>
                            <span>Only you can see these</span>
                        </div>
                        <textarea
                            id="material-private-note"
                            maxLength={60000}
                            rows={3}
                            placeholder="Write notes about this material..."
                            value={privateNote}
                            onChange={(event) => {
                                setPrivateNote(event.target.value);
                                setNoteDirty(true);
                                setNoteSaved(false);
                            }}
                            disabled={noteLoading || noteSaving || noteLoadFailed}
                        />
                        <div className="material-preview-notes-actions">
                            {noteError && <p role="alert">{noteError}</p>}
                            {noteSaved && <p role="status">Notes saved.</p>}
                            {noteLoading && <p role="status">Loading notes...</p>}
                            {noteLoadFailed && <p>Close and reopen the material to retry loading notes.</p>}
                            <button type="submit" disabled={noteLoading || noteSaving || noteLoadFailed || !noteDirty}>
                                <FaSave aria-hidden="true" />
                                {noteSaving ? "Saving..." : "Save notes"}
                            </button>
                        </div>
                    </form>
                )}
                {!file && !archive && !officePreview && !resourcePath && !textContent && !error && (
                    <p className="material-preview-message">There is no file or written answer to review.</p>
                )}
            </section>
        </div>
    );
};

export default MaterialPreviewDialog;
