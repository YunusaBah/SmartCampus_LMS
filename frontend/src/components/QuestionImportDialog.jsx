import { useMemo, useRef, useState } from "react";
import { FaCloudUploadAlt, FaTimes, FaTrash } from "react-icons/fa";
import API from "../services/api";
import { appendUploadedFile } from "../services/fileUploads";

const extensions = [".pdf", ".docx", ".pptx", ".txt", ".xlsx", ".csv"];
const maxFileSize = 20 * 1024 * 1024;
const optionLetters = ["A", "B", "C", "D"];

const validQuestion = (question) => question.question.trim() &&
    Number.isFinite(Number(question.marks)) && Number(question.marks) > 0 &&
    (question.questionType === "THEORY" ||
        (optionLetters.filter((letter) => question[`option${letter}`].trim()).length >= 2 &&
            question.correctAnswer &&
            question[`option${question.correctAnswer}`]?.trim()));

const QuestionImportDialog = ({ onClose, onImport }) => {
    const fileInput = useRef(null);
    const extractionController = useRef(null);
    const [file, setFile] = useState(null);
    const [dragging, setDragging] = useState(false);
    const [progress, setProgress] = useState(0);
    const [processing, setProcessing] = useState(false);
    const [status, setStatus] = useState("");
    const [error, setError] = useState("");
    const [result, setResult] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [selected, setSelected] = useState({});

    const selectedCount = useMemo(() => questions.filter((question) => selected[question.importId]).length, [questions, selected]);
    const updateFile = (nextFile) => {
        setError("");
        setResult(null);
        setQuestions([]);
        setSelected({});
        setProgress(0);
        if (!nextFile) {
            setFile(null);
            return;
        }
        const extension = `.${nextFile.name.split(".").pop()}`.toLowerCase();
        if (!extensions.includes(extension)) {
            setFile(null);
            setError("Unsupported file format. Choose PDF, DOCX, PPTX, TXT, XLSX, or CSV.");
            return;
        }
        if (nextFile.size > maxFileSize) {
            setFile(null);
            setError("This file exceeds the 20 MB upload limit.");
            return;
        }
        setFile(nextFile);
    };

    const extractQuestions = async () => {
        if (!file) {
            setError("Choose a document first.");
            return;
        }
        setProcessing(true);
        setProgress(0);
        setStatus("Uploading document...");
        setError("");
        extractionController.current = new AbortController();
        const payload = new FormData();
        try {
            await appendUploadedFile(payload, file, { purpose: "question-import" });
            const response = await API.post("/quizzes/questions/extract", payload, {
                headers: { "Content-Type": "multipart/form-data" },
                signal: extractionController.current.signal,
                onUploadProgress: (event) => {
                    const percent = event.total ? Math.round(event.loaded * 100 / event.total) : 0;
                    setProgress(percent);
                    if (percent >= 100) setStatus("Identifying questions and answer options...");
                }
            });
            const importedQuestions = (response.data.questions || []).map((question, index) => ({
                ...question,
                importId: `${Date.now()}-${index}`,
                selected: true
            }));
            setQuestions(importedQuestions);
            setSelected(Object.fromEntries(importedQuestions.map((question) => [question.importId, true])));
            setResult(response.data);
            setStatus("Import preview ready.");
        } catch (requestError) {
            if (!extractionController.current?.signal.aborted) {
                setError(requestError.response?.data?.message || requestError.message || "Unable to process the document. Try again.");
                setStatus("");
            }
        } finally {
            extractionController.current = null;
            setProcessing(false);
        }
    };

    const editQuestion = (importId, field, value) => {
        setQuestions((current) => current.map((question) => {
            if (question.importId !== importId) return question;
            const updated = { ...question, [field]: value };
            if (field === "questionType" && value === "THEORY") updated.correctAnswer = null;
            if (field === "questionType" && value === "MCQ") updated.correctAnswer = "";
            if (field.startsWith("option") && field.length === 7 && !value.trim() && updated.correctAnswer === field.slice(-1)) {
                updated.correctAnswer = "";
            }
            if (updated.questionType === "MCQ") {
                updated.reviewFlags = [
                    ...(optionLetters.filter((letter) => updated[`option${letter}`].trim()).length < 2
                        ? ["MCQ needs at least two answer options."]
                        : []),
                    ...(!updated.correctAnswer ? ["Select the correct answer before importing."]
                        : updated[`option${updated.correctAnswer}`]?.trim() ? [] : ["Correct answer must match an available option."])
                ];
            } else {
                updated.reviewFlags = [];
            }
            return updated;
        }));
    };

    const removeQuestion = (importId) => {
        setQuestions((current) => current.filter((question) => question.importId !== importId));
        setSelected((current) => ({ ...current, [importId]: false }));
    };

    const closeDialog = () => {
        if ((processing || questions.length > 0) &&
            !window.confirm("Cancel this import and discard its file and review changes?")) return;
        extractionController.current?.abort();
        onClose();
    };

    const addSelected = () => {
        const chosen = questions.filter((question) => selected[question.importId]);
        const invalid = chosen.find((question) => !validQuestion(question));
        if (invalid) {
            setError("Review the selected questions: each needs question text, and MCQs need at least two options and a correct answer.");
            return;
        }
        if (!chosen.length) {
            setError("Select at least one question to add.");
            return;
        }
        const imported = onImport(chosen.map((question) => ({
            question: question.question,
            questionType: question.questionType,
            optionA: question.optionA,
            optionB: question.optionB,
            optionC: question.optionC,
            optionD: question.optionD,
            correctAnswer: question.correctAnswer,
            marks: question.marks,
            sourceNumber: question.sourceNumber,
            confidence: question.confidence,
            reviewFlags: question.reviewFlags
        })));
        if (imported === false) return;
        if (typeof imported === "string") {
            setError(imported);
            return;
        }
        onClose();
    };

    const mcqCount = questions.filter((question) => question.questionType === "MCQ").length;
    const theoryCount = questions.length - mcqCount;
    const reviewCount = questions.filter((question) => !validQuestion(question) || question.reviewFlags?.length).length;

    return (
        <div className="course-modal-backdrop question-import-backdrop" onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeDialog();
        }}>
            <section className="course-modal question-import-modal" role="dialog" aria-modal="true" aria-labelledby="question-import-heading">
                <button type="button" className="course-modal-close" aria-label="Close import dialog" onClick={closeDialog}>
                    <FaTimes aria-hidden="true" />
                </button>
                <h2 id="question-import-heading">{result ? "Import Preview" : "Import Questions from a Document"}</h2>
                {!result && <>
                    <div
                        className={dragging ? "question-import-dropzone dragging" : "question-import-dropzone"}
                        onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
                        onDragLeave={() => setDragging(false)}
                        onDrop={(event) => {
                            event.preventDefault();
                            setDragging(false);
                            updateFile(event.dataTransfer.files?.[0]);
                        }}
                    >
                        <FaCloudUploadAlt aria-hidden="true" />
                        <strong>Drag and drop a document here</strong>
                        <span>PDF, DOCX, PPTX, TXT, XLSX, or CSV · Up to 20 MB</span>
                        <input
                            ref={fileInput}
                            className="sr-only"
                            type="file"
                            accept={extensions.join(",")}
                            aria-label="Choose question document"
                            onChange={(event) => updateFile(event.target.files?.[0])}
                        />
                        <button type="button" className="btn btn-inline btn-secondary" onClick={() => fileInput.current?.click()}>
                            Browse files
                        </button>
                    </div>
                    {file && <div className="question-import-file">
                        <span>{file.name}</span>
                        <small>{(file.size / 1024 / 1024).toFixed(2)} MB</small>
                    </div>}
                    {processing && <div className="question-import-progress">
                        <p role="status">{status}</p>
                        <progress max="100" value={progress}>{progress}%</progress>
                    </div>}
                    {error && <p className="course-modal-feedback" role="alert">{error}</p>}
                    <div className="course-modal-actions">
                        <button type="button" className="course-cancel-button" onClick={closeDialog}>Cancel</button>
                        <button type="button" className="btn btn-inline" onClick={extractQuestions} disabled={!file || processing}>
                            {processing ? "Processing..." : "Extract Questions"}
                        </button>
                    </div>
                </>}
                {result && <>
                    <p className="course-modal-intro">Review extracted questions and answer keys before importing.</p>
                    <div className="question-import-summary">
                        <span>{questions.length} questions detected</span>
                        <span>{mcqCount} MCQ</span>
                        <span>{theoryCount} theory</span>
                        <span>{reviewCount} need review</span>
                    </div>
                    {result.warnings?.map((warning) => <p className="question-import-warning" key={warning}>{warning}</p>)}
                    {result.unassignedText && <details className="question-import-unassigned">
                        <summary>Text needing review</summary>
                        <pre>{result.unassignedText}</pre>
                    </details>}
                    <div className="question-import-review">
                        {questions.map((question, index) => (
                            <fieldset className="question-import-card" key={question.importId}>
                                <legend>
                                    <input
                                        type="checkbox"
                                        checked={Boolean(selected[question.importId])}
                                        aria-label={`Select question ${index + 1}`}
                                        onChange={(event) => setSelected((current) => ({ ...current, [question.importId]: event.target.checked }))}
                                    />
                                    Question {question.sourceNumber || index + 1}
                                </legend>
                                {question.reviewFlags?.map((flag) => <p className="question-import-warning" key={flag}>{flag}</p>)}
                                <label>Question text<textarea rows={3} value={question.question} onChange={(event) => editQuestion(question.importId, "question", event.target.value)} /></label>
                                <div className="question-import-fields">
                                    <label>Type<select value={question.questionType} onChange={(event) => editQuestion(question.importId, "questionType", event.target.value)}>
                                        <option value="MCQ">Multiple choice</option>
                                        <option value="THEORY">Theory</option>
                                    </select></label>
                                    <label>Marks<input type="number" min="0.01" step="0.01" value={question.marks} onChange={(event) => editQuestion(question.importId, "marks", Number(event.target.value))} /></label>
                                </div>
                                {question.questionType === "MCQ" && <>
                                    <div className="question-import-fields">
                                        {optionLetters.map((letter) => <label key={letter}>Option {letter}<input value={question[`option${letter}`]} onChange={(event) => editQuestion(question.importId, `option${letter}`, event.target.value)} /></label>)}
                                    </div>
                                    <label>Correct answer<select value={question.correctAnswer || ""} onChange={(event) => editQuestion(question.importId, "correctAnswer", event.target.value)}>
                                        <option value="">Select answer</option>
                                        {optionLetters.filter((letter) => question[`option${letter}`].trim()).map((letter) => (
                                            <option key={letter} value={letter}>{letter}</option>
                                        ))}
                                    </select></label>
                                </>}
                                <span className="question-import-confidence">Extraction confidence: {Math.round((question.confidence || 0) * 100)}%</span>
                                <button type="button" className="text-button" onClick={() => removeQuestion(question.importId)}>
                                    <FaTrash aria-hidden="true" /> Remove question
                                </button>
                            </fieldset>
                        ))}
                    </div>
                    {error && <p className="course-modal-feedback" role="alert">{error}</p>}
                    <div className="course-modal-actions">
                        <button type="button" className="course-cancel-button" onClick={closeDialog}>Cancel Import</button>
                        <button type="button" className="btn btn-inline" onClick={addSelected} disabled={!selectedCount}>
                            Add {selectedCount} Selected Questions to Quiz
                        </button>
                    </div>
                </>}
            </section>
        </div>
    );
};

export default QuestionImportDialog;
