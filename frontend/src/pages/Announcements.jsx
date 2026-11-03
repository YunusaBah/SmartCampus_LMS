import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FaBullhorn, FaPlus, FaSearch, FaTimes } from "react-icons/fa";
import API from "../services/api";
import { useAuth } from "../hooks/useAuth";
import AnnouncementCard from "../components/AnnouncementCard";
import RouteBackButton from "../components/RouteBackButton";
import useOfflineRefresh from "../hooks/useOfflineRefresh";

const Announcements = () => {
    const offlineRefresh = useOfflineRefresh();
    const { isStaff } = useAuth();
    const [searchParams] = useSearchParams();
    const initialCourseId = searchParams.get("courseId");
    const [courses, setCourses] = useState([]);
    const [calendarEvents, setCalendarEvents] = useState([]);
    const [announcements, setAnnouncements] = useState([]);
    const [selectedCourseId, setSelectedCourseId] = useState(initialCourseId || "all");
    const [announcementSearch, setAnnouncementSearch] = useState("");
    const [form, setForm] = useState({ courseId: isStaff ? initialCourseId || "" : "", title: "", body: "" });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [status, setStatus] = useState("");
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [publishing, setPublishing] = useState(false);

    useEffect(() => {
        if (!createModalOpen) return undefined;
        const previousOverflow = document.body.style.overflow;
        const closeOnEscape = (event) => {
            if (event.key === "Escape" && !publishing) setCreateModalOpen(false);
        };
        document.body.style.overflow = "hidden";
        window.addEventListener("keydown", closeOnEscape);
        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener("keydown", closeOnEscape);
        };
    }, [createModalOpen, publishing]);

    useEffect(() => {
        let active = true;
        const load = async () => {
            try {
                const courseResponse = await API.get(isStaff ? "/courses/my" : "/enrollments/my-courses");
                const availableCourses = isStaff
                    ? courseResponse.data
                    : courseResponse.data
                        .map((enrollment) => enrollment.course
                            ? {
                                ...enrollment.course,
                                canPostAnnouncements: enrollment.canPostAnnouncements,
                                permissions: enrollment.permissions || []
                            }
                            : null)
                        .filter(Boolean);
                const courseData = await Promise.all(availableCourses.map(async (course) => {
                    const [announcementResponse, calendarResponse] = await Promise.all([
                        API.get(`/courses/${course.id}/announcements`),
                        API.get(`/courses/${course.id}/calendar`)
                    ]);
                    return {
                        announcements: announcementResponse.data.map((announcement) => ({
                            ...announcement,
                            courseTitle: course.title,
                            courseId: course.id
                        })),
                        calendarEvents: calendarResponse.data
                            .filter((event) => event.title)
                            .map((event) => ({ ...event, courseId: course.id, courseTitle: course.title }))
                    };
                }));
                if (active) {
                    setCourses(availableCourses);
                    setCalendarEvents(courseData.flatMap((result) => result.calendarEvents));
                    setAnnouncements(courseData.flatMap((result) => result.announcements).sort((a, b) =>
                        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                    ));
                }
            } catch (requestError) {
                if (active) setError(requestError.response?.data?.message || "Unable to load announcements.");
            } finally {
                if (active) setLoading(false);
            }
        };
        load();
        return () => { active = false; };
    }, [isStaff, offlineRefresh]);

    useEffect(() => {
        const announcementId = window.location.hash.match(/^#announcement-(\d+)$/)?.[1];
        if (!announcementId || !announcements.length) return;
        document.getElementById(`announcement-${announcementId}`)?.scrollIntoView({
            behavior: "smooth",
            block: "center"
        });
    }, [announcements]);

    const createAnnouncement = async (event) => {
        event.preventDefault();
        setStatus("");
        setPublishing(true);
        try {
            const payload = {
                title: form.title,
                body: form.body
            };
            const broadcast = form.courseId === "all";
            const response = broadcast
                ? await API.post("/announcements/broadcast", payload)
                : await API.post(`/courses/${form.courseId}/announcements`, payload);
            const published = broadcast ? response.data.announcements : [response.data];
            const created = published.map((announcement) => ({
                ...announcement,
                author: { fullName: "You" },
                courseTitle: courses.find((course) => String(course.id) === String(announcement.courseId))?.title || "Course"
            }));
            setAnnouncements((current) => [...created, ...current]);
            setForm((current) => ({ ...current, title: "", body: "" }));
            setStatus(broadcast ? "Announcement published to all your courses." : "Announcement published.");
            setCreateModalOpen(false);
        } catch (requestError) {
            setStatus(requestError.response?.data?.message || "Unable to publish announcement.");
        } finally {
            setPublishing(false);
        }
    };

    const filteredAnnouncements = announcements.filter((announcement) =>
        (selectedCourseId === "all" || String(announcement.courseId) === selectedCourseId) &&
        `${announcement.title} ${announcement.body} ${announcement.courseTitle || ""} ${announcement.author?.fullName || ""}`
            .toLowerCase()
            .includes(announcementSearch.trim().toLowerCase())
    );
    const announcementTitleOptions = [...new Map(calendarEvents
        .filter((event) => form.courseId === "all" || String(event.courseId) === form.courseId)
        .filter((event) => event.title !== "No school")
        .map((event) => [event.title, event])).values()];

    return (
        <div className="page-content feature-page">
            {selectedCourseId !== "all" && courses.some((course) => String(course.id) === selectedCourseId) && (
                <RouteBackButton
                    className="course-context-back"
                    label={`Back to ${courses.find((course) => String(course.id) === selectedCourseId)?.title}`}
                />
            )}
            <header className="feature-page-header">
                <div>
                    <p className="eyebrow">COURSE UPDATES</p>
                    <h1>Announcements</h1>
                </div>
                {(isStaff || courses.some((course) => course.canPostAnnouncements)) && (
                    <button type="button" className="btn btn-inline announcement-create-trigger" onClick={() => {
                        setStatus("");
                        setCreateModalOpen(true);
                    }}>
                        <FaPlus aria-hidden="true" /> Post announcement
                    </button>
                )}
            </header>

            {status && !createModalOpen && <p className="feature-status" role="status">{status}</p>}
            {createModalOpen && (
                <div className="course-modal-backdrop announcement-modal-backdrop" onMouseDown={(event) => {
                    if (event.target === event.currentTarget && !publishing) setCreateModalOpen(false);
                }}>
                    <section className="course-modal announcement-create-modal" role="dialog" aria-modal="true" aria-labelledby="announcement-create-heading">
                        <button type="button" className="course-modal-close" aria-label="Close announcement form" disabled={publishing} onClick={() => setCreateModalOpen(false)}>
                            <FaTimes aria-hidden="true" />
                        </button>
                        <h2 id="announcement-create-heading">Post an announcement</h2>
                        <form className="feature-form-grid" onSubmit={createAnnouncement}>
                            <label>Course
                                <select required value={form.courseId} onChange={(event) => setForm({ ...form, courseId: event.target.value, title: "" })}>
                                    <option value="">Choose a course</option>
                                    {isStaff && <option value="all">All my courses</option>}
                                    {courses.filter((course) => isStaff || course.canPostAnnouncements)
                                        .map((course) => <option value={course.id} key={course.id}>{course.title}</option>)}
                                </select>
                            </label>
                            <label>Title
                                <select required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })}>
                                    <option value="">Choose a calendar title</option>
                                    {announcementTitleOptions.map((item) => (
                                        <option key={`${item.courseId}-${item.title}`} value={item.title}>
                                            {item.title}{form.courseId === "all" ? ` · ${item.courseTitle}` : ""}
                                        </option>
                                    ))}
                                    <option value="No school">No school</option>
                                </select>
                            </label>
                            <label className="feature-form-wide">Message<textarea required maxLength={20000} rows={5} value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} /></label>
                            <button type="submit" className="btn btn-inline announcement-publish-button" disabled={publishing}>
                                {publishing ? "Publishing..." : "Publish"}
                            </button>
                            {status && <p className="feature-status" role="alert">{status}</p>}
                        </form>
                    </section>
                </div>
            )}

            {courses.length > 0 && (
                <nav className="announcement-course-nav" aria-label="Announcements by course">
                    <button
                        type="button"
                        className={selectedCourseId === "all" ? "is-active" : ""}
                        aria-pressed={selectedCourseId === "all"}
                        onClick={() => setSelectedCourseId("all")}
                    >
                        All courses
                    </button>
                    {courses.map((course) => (
                        <button
                            type="button"
                            key={course.id}
                            className={selectedCourseId === String(course.id) ? "is-active" : ""}
                            aria-pressed={selectedCourseId === String(course.id)}
                            onClick={() => setSelectedCourseId(String(course.id))}
                        >
                            {course.title}
                        </button>
                    ))}
                </nav>
            )}

            {loading ? <p className="dashboard-loading" role="status">Loading announcements...</p> : error ? (
                <div className="dashboard-alert" role="alert">{error}</div>
            ) : announcements.length ? (
                <>
                    <label className="catalog-search announcement-search">
                        <FaSearch aria-hidden="true" />
                        <span className="sr-only">Search announcements</span>
                        <input
                            type="search"
                            value={announcementSearch}
                            onChange={(event) => setAnnouncementSearch(event.target.value)}
                            placeholder="Search: title, course"
                        />
                    </label>
                    {filteredAnnouncements.length ? (
                        <section className="announcement-list">
                            {filteredAnnouncements.map((announcement) => (
                                <AnnouncementCard key={announcement.id} announcement={announcement} isStaff={isStaff} />
                            ))}
                        </section>
                    ) : <p className="empty-state">No announcements match your search.</p>}
                </>
            ) : (
                <div className="feature-empty"><FaBullhorn /><strong>No announcements yet</strong></div>
            )}
        </div>
    );
};

export default Announcements;
