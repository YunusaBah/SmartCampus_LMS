import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { FaBookOpen, FaEye, FaPlus, FaSearch, FaTimes } from "react-icons/fa";
import API from "../services/api";
import { useAuth } from "../hooks/useAuth";
import MaterialPreviewDialog from "../components/MaterialPreviewDialog";
import RouteBackButton from "../components/RouteBackButton";
import useOfflineRefresh from "../hooks/useOfflineRefresh";

const fileTypes = ".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv,.png,.jpg,.jpeg,.gif,.webp,.zip";

const Materials = () => {
    const offlineRefresh = useOfflineRefresh();
    const { isStaff } = useAuth();
    const [searchParams] = useSearchParams();
    const initialCourseId = searchParams.get("courseId");
    const [courses, setCourses] = useState([]);
    const [materials, setMaterials] = useState([]);
    const [courseFilter, setCourseFilter] = useState(initialCourseId || "all");
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState("");
    const [uploadError, setUploadError] = useState("");
    const [isUploadOpen, setIsUploadOpen] = useState(() => isStaff && searchParams.get("create") === "1");
    const [previewMaterial, setPreviewMaterial] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [form, setForm] = useState({ title: "", courseId: "", resourceUrl: "", file: null });
    const fileInput = useRef(null);

    useEffect(() => {
        let active = true;
        const loadMaterials = async () => {
            setLoadError("");
            try {
                const courseResponse = await API.get(isStaff ? "/courses/my" : "/enrollments/my-courses");
                const availableCourses = isStaff
                    ? courseResponse.data
                    : courseResponse.data
                        .filter((enrollment) => enrollment.course)
                        .map((enrollment) => ({
                            ...enrollment.course,
                            permissions: enrollment.permissions || []
                        }));
                const courseMaterials = await Promise.all(availableCourses.map(async (course) => {
                    const response = await API.get(`/lessons/course/${course.id}`);
                    return response.data.map((material) => ({
                        ...material,
                        courseId: course.id,
                        courseTitle: course.title
                    }));
                }));
                if (active) {
                    setCourses(availableCourses);
                    setMaterials(courseMaterials.flat());
                    setForm((current) => ({
                        ...current,
                        courseId: current.courseId || initialCourseId || String((isStaff
                            ? availableCourses[0]
                            : availableCourses.find((course) => course.permissions.includes("uploadMaterials"))
                        )?.id || "")
                    }));
                }
            } catch (error) {
                if (active) setLoadError(error.response?.data?.message || "Unable to load shared materials.");
            } finally {
                if (active) setLoading(false);
            }
        };

        loadMaterials();
        return () => { active = false; };
    }, [courses.length, initialCourseId, isStaff, materials.length, offlineRefresh]);
    const canUploadMaterials = isStaff || courses.some((course) => course.permissions?.includes("uploadMaterials"));

    const visibleMaterials = useMemo(() => {
        const query = search.trim().toLowerCase();
        return materials.filter((material) => {
            const matchesCourse = courseFilter === "all" || String(material.courseId) === courseFilter;
            const matchesSearch = !query || `${material.title} ${material.courseTitle} ${material.content || ""} ${material.videoUrl || ""}`
                .toLowerCase()
                .includes(query);
            return matchesCourse && matchesSearch;
        });
    }, [courseFilter, materials, search]);

    const closeUpload = () => {
        if (uploading) return;
        setIsUploadOpen(false);
        setUploadError("");
    };

    const shareMaterial = async (event) => {
        event.preventDefault();
        if ((!form.file && !form.resourceUrl.trim()) || !form.courseId ||
            (!isStaff && !courses.find((course) => String(course.id) === form.courseId)?.permissions?.includes("uploadMaterials"))) {
            setUploadError("Choose a course and add a file or resource link.");
            return;
        }
        const payload = new FormData();
        payload.append("title", form.title);
        payload.append("courseId", form.courseId);
        payload.append("videoUrl", form.resourceUrl);
        if (form.file) payload.append("file", form.file);
        setUploading(true);
        setUploadError("");
        try {
            const response = await API.post("/lessons", payload, {
                headers: { "Content-Type": "multipart/form-data" }
            });
            const course = courses.find((item) => String(item.id) === form.courseId);
            setMaterials((current) => [{
                ...response.data.lesson,
                courseId: course.id,
                courseTitle: course.title
            }, ...current]);
            setForm((current) => ({ ...current, title: "", resourceUrl: "", file: null }));
            if (fileInput.current) fileInput.current.value = "";
            setIsUploadOpen(false);
            window.dispatchEvent(new Event("smartcampus:dashboard-refresh"));
        } catch (error) {
            setUploadError(error.response?.data?.message || "Unable to share this material.");
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="page-content materials-page">
            {courseFilter !== "all" && courses.some((course) => String(course.id) === courseFilter) && (
                <RouteBackButton
                    className="course-context-back"
                    label={`Back to ${courses.find((course) => String(course.id) === courseFilter)?.title}`}
                />
            )}
            <header className="materials-header">
                <div>
                    <p className="eyebrow">LEARNING RESOURCES</p>
                    <h1>Shared Materials</h1>
                </div>
                {canUploadMaterials && (
                    <button
                        type="button"
                        className="btn btn-inline materials-upload-trigger"
                        aria-label="Upload material"
                        disabled={!courses.length}
                        onClick={() => {
                            setUploadError("");
                            setIsUploadOpen(true);
                        }}
                    >
                        <FaPlus aria-hidden="true" /> Upload material
                    </button>
                )}
            </header>

            <div className="materials-controls">
                <label className="catalog-search">
                    <FaSearch aria-hidden="true" />
                    <span className="sr-only">Search materials</span>
                    <input
                        type="search"
                        placeholder="Search: materials, courses"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                    />
                </label>
                <label className="materials-course-filter">
                    <span>Course</span>
                    <select value={courseFilter} onChange={(event) => setCourseFilter(event.target.value)}>
                        <option value="all">All courses</option>
                        {courses.map((course) => (
                            <option key={course.id} value={String(course.id)}>{course.title}</option>
                        ))}
                    </select>
                </label>
            </div>

            {loadError && <p className="materials-error" role="alert">{loadError}</p>}
            {loading ? (
                <p role="status">Loading shared materials...</p>
            ) : visibleMaterials.length ? (
                <div className="grading-table-scroll materials-table-scroll">
                    <table className="grading-table materials-table">
                        <thead>
                            <tr>
                                <th scope="col" className="table-number-column">No.</th>
                                <th scope="col">Course name</th>
                                <th scope="col">Title</th>
                                <th scope="col">Date</th>
                                <th scope="col">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {visibleMaterials.map((material, index) => (
                                <tr key={`${material.courseId}-${material.id}`}>
                                    <td className="table-number-column">{index + 1}</td>
                                    <td>
                                        <Link to={`/courses/${material.courseId}?section=${isStaff ? "manage" : "materials"}`} className="material-course-link">
                                            {material.courseTitle}
                                        </Link>
                                    </td>
                                    <td><strong>{material.title}</strong></td>
                                    <td>{material.createdAt ? new Date(material.createdAt).toLocaleDateString() : "—"}</td>
                                    <td>
                                        {material.hasFile ? (
                                            <button type="button" className="file-view-button" onClick={() => setPreviewMaterial(material)}>
                                                <FaEye aria-hidden="true" /> View
                                            </button>
                                        ) : material.videoUrl ? (
                                            <a className="file-view-button" href={material.videoUrl} target="_blank" rel="noreferrer">
                                                <FaEye aria-hidden="true" /> Open
                                            </a>
                                        ) : "—"}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="materials-empty">
                    <FaBookOpen aria-hidden="true" />
                    <h2>{materials.length ? "No materials match your filters" : "No shared materials yet"}</h2>
                    <p>{materials.length ? "No matching materials." : "No materials available."}</p>
                </div>
            )}

            {isUploadOpen && (
                <div className="course-modal-backdrop" onMouseDown={(event) => {
                    if (event.target === event.currentTarget) closeUpload();
                }}>
                    <section className="course-modal" role="dialog" aria-modal="true" aria-labelledby="share-material-heading">
                        <button
                            type="button"
                            className="course-modal-close"
                            aria-label="Close share material dialog"
                            onClick={closeUpload}
                        >
                            <FaTimes aria-hidden="true" />
                        </button>
                        <h2 id="share-material-heading">Share a material</h2>
                        {uploadError && <p className="course-modal-feedback" role="alert">{uploadError}</p>}
                        <form className="course-create-form" onSubmit={shareMaterial}>
                            <label>
                                Available courses
                                <select
                                    required
                                    value={form.courseId}
                                    onChange={(event) => setForm((current) => ({ ...current, courseId: event.target.value }))}
                                    disabled={uploading}
                                >
                                    <option value="" disabled>Select a course</option>
                                    {courses.map((course) => (
                                        <option key={course.id} value={String(course.id)}>{course.title}</option>
                                    ))}
                                </select>
                            </label>
                            <label>
                                Material title
                                <input
                                    required
                                    maxLength={255}
                                    value={form.title}
                                    onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                                    disabled={uploading}
                                />
                            </label>
                            <label>
                                Resource link (optional)
                                <input
                                    type="url"
                                    maxLength={2048}
                                    placeholder="Book, video, or learning platform URL"
                                    value={form.resourceUrl}
                                    onChange={(event) => setForm((current) => ({ ...current, resourceUrl: event.target.value }))}
                                    disabled={uploading}
                                />
                            </label>
                            <label>
                                Upload a file from your device (optional)
                                <input
                                    type="file"
                                    ref={fileInput}
                                    accept={fileTypes}
                                    onChange={(event) => setForm((current) => ({ ...current, file: event.target.files?.[0] || null }))}
                                    disabled={uploading}
                                />
                            </label>
                            <div className="course-modal-actions">
                                <button type="button" className="course-cancel-button" onClick={closeUpload} disabled={uploading}>Cancel</button>
                                <button type="submit" className="upload-icon-button" aria-label={uploading ? "Sharing material" : "Share material"} title={uploading ? "Sharing material" : "Share material"} disabled={uploading}>
                                    <FaPlus aria-hidden="true" />
                                </button>
                            </div>
                        </form>
                    </section>
                </div>
            )}
            {previewMaterial && <MaterialPreviewDialog
                key={previewMaterial.id}
                resourcePath={`/downloads/lesson/${previewMaterial.id}`}
                fileName={previewMaterial.fileName || previewMaterial.title}
                lessonId={previewMaterial.id}
                onClose={() => setPreviewMaterial(null)}
            />}
        </div>
    );
};

export default Materials;
