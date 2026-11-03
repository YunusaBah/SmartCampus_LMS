import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FaChevronLeft, FaChevronRight, FaClock, FaTimes } from "react-icons/fa";
import API from "../services/api";
import { useAuth } from "../hooks/useAuth";
import useOfflineRefresh from "../hooks/useOfflineRefresh";
import RouteBackButton from "../components/RouteBackButton";

const eventKinds = ["class", "exam", "deadline", "assignment", "assessment", "quiz", "event", "no-school", "other"];
const eventKindLabel = (kind) => kind === "no-school"
    ? "No school"
    : kind[0].toUpperCase() + kind.slice(1);
const localDateValue = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
};
const localDateTimeValue = (value) => {
    const date = new Date(value);
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0, 16);
};

const Calendar = () => {
    const offlineRefresh = useOfflineRefresh();
    const { isStaff } = useAuth();
    const [searchParams] = useSearchParams();
    const courseId = searchParams.get("courseId");
    const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    const [selectedDay, setSelectedDay] = useState(() => localDateValue(new Date()));
    const [events, setEvents] = useState([]);
    const [courses, setCourses] = useState([]);
    const [assessmentOptions, setAssessmentOptions] = useState({ key: "", items: [] });
    const [form, setForm] = useState({
        courseId: "", eventType: "class", assessmentId: "", title: "", description: "", startsAt: "", endsAt: ""
    });
    const [modalMode, setModalMode] = useState("");
    const [editingEvent, setEditingEvent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [status, setStatus] = useState("");

    const monthStart = new Date(month.getFullYear(), month.getMonth(), 1).toISOString();
    const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 1).toISOString();
    const assessmentKey = `${form.courseId}:${form.eventType}`;
    const assessments = assessmentOptions.key === assessmentKey ? assessmentOptions.items : [];

    const loadEvents = async () => {
        try {
            const response = await API.get("/calendar", { params: { from: monthStart, to: monthEnd } });
            setEvents(response.data);
            setError("");
        } catch (requestError) {
            setError(requestError.response?.data?.message || "Unable to load your calendar.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        let active = true;
        API.get("/calendar", { params: { from: monthStart, to: monthEnd } })
            .then((response) => {
                if (active) {
                    setEvents(response.data);
                    setError("");
                }
            })
            .catch((requestError) => {
                if (active) setError(requestError.response?.data?.message || "Unable to load your calendar.");
            })
            .finally(() => {
                if (active) setLoading(false);
            });
        return () => { active = false; };
    }, [monthStart, monthEnd, offlineRefresh]);

    useEffect(() => {
        API.get(isStaff ? "/courses/my" : "/enrollments/my-courses")
            .then((response) => setCourses(isStaff
                ? response.data
                : response.data
                    .filter((enrollment) => enrollment.course)
                    .map((enrollment) => enrollment.course)))
            .catch((requestError) => setError(requestError.response?.data?.message || "Unable to load course list."));
    }, [isStaff, offlineRefresh]);

    useEffect(() => {
        if (!isStaff || !form.courseId || !["assessment", "quiz"].includes(form.eventType)) {
            return;
        }
        let active = true;
        API.get(`/quizzes/assessments/course/${form.courseId}`)
            .then((response) => {
                if (active) setAssessmentOptions({ key: assessmentKey, items: response.data });
            })
            .catch((requestError) => {
                if (active) setStatus(requestError.response?.data?.message || "Unable to load course assessments.");
            });
        return () => { active = false; };
    }, [assessmentKey, form.courseId, form.eventType, isStaff, offlineRefresh]);

    const scopedEvents = useMemo(
        () => courseId ? events.filter((event) => String(event.courseId) === courseId) : events,
        [courseId, events]
    );

    const eventsByDay = useMemo(() => scopedEvents.reduce((map, event) => {
        const key = localDateValue(new Date(event.startsAt));
        map.set(key, [...(map.get(key) || []), event]);
        return map;
    }, new Map()), [scopedEvents]);

    const calendarDays = useMemo(() => {
        const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
        const gridStart = new Date(firstDay);
        gridStart.setDate(firstDay.getDate() - firstDay.getDay());
        return Array.from({ length: 42 }, (_, index) => {
            const day = new Date(gridStart);
            day.setDate(gridStart.getDate() + index);
            return day;
        });
    }, [month]);

    const selectedEvents = eventsByDay.get(selectedDay) || [];

    const createEvent = async (event) => {
        event.preventDefault();
        setStatus("");
        try {
            if (editingEvent?.type === "assignment") {
                await API.patch(`/assignments/${editingEvent.assignmentId}`, {
                    dueDate: new Date(form.startsAt).toISOString()
                });
            } else if (editingEvent?.recurring) {
                await API.patch(`/courses/${editingEvent.courseId}/calendar/classes/${editingEvent.scheduledDate}`, {
                    status: "rescheduled",
                    startsAt: new Date(form.startsAt).toISOString(),
                    endsAt: new Date(form.endsAt).toISOString(),
                    description: form.description,
                    title: form.title
                });
            } else if (editingEvent) {
                await API.patch(`/calendar/${editingEvent.eventId}`, {
                    title: form.title,
                    description: form.description,
                    startsAt: new Date(form.startsAt).toISOString(),
                    endsAt: new Date(form.endsAt).toISOString()
                });
            } else if (form.eventType === "assignment") {
                await API.post("/assignments", {
                    courseId: Number(form.courseId),
                    title: form.title,
                    description: form.description,
                    dueDate: new Date(form.startsAt).toISOString()
                });
            } else {
                await API.post(`/courses/${form.courseId}/calendar`, {
                    eventType: form.eventType,
                    assessmentId: ["assessment", "quiz"].includes(form.eventType) ? Number(form.assessmentId) : null,
                    title: form.title,
                    description: form.description,
                    startsAt: new Date(form.startsAt).toISOString(),
                    endsAt: new Date(form.endsAt).toISOString()
                });
            }
            setForm((current) => ({ ...current, assessmentId: "", title: "", description: "", startsAt: "", endsAt: "" }));
            setModalMode("");
            setEditingEvent(null);
            setStatus(editingEvent ? "Calendar item rescheduled." : form.eventType === "assignment" ? "Assignment and due date scheduled." : "Calendar event scheduled.");
            await loadEvents();
        } catch (requestError) {
            setStatus(requestError.response?.data?.message || "Unable to schedule this calendar item.");
        }
    };

    const openSchedule = (day = selectedDay) => {
        setSelectedDay(day);
        const start = `${day}T09:00`;
        setForm({
            courseId: courseId || (courses[0] ? String(courses[0].id) : ""),
            eventType: "class",
            assessmentId: "",
            title: "",
            description: "",
            startsAt: start,
            endsAt: `${day}T10:00`
        });
        setEditingEvent(null);
        setModalMode("schedule");
        setStatus("");
    };

    const openReschedule = (item) => {
        setEditingEvent(item);
        setForm({
            courseId: String(item.courseId),
            eventType: item.type === "assignment" ? "assignment" : item.type,
            assessmentId: String(item.assessmentId || ""),
            title: item.recurring && item.status === "cancelled" ? `${item.courseTitle} class` : item.title,
            description: item.description || "",
            startsAt: localDateTimeValue(item.startsAt),
            endsAt: localDateTimeValue(item.endsAt || new Date(new Date(item.startsAt).getTime() + 60 * 60 * 1000))
        });
        setModalMode("reschedule");
        setStatus("");
    };

    const cancelClass = async (item) => {
        if (!item.recurring) return;
        try {
            await API.patch(`/courses/${item.courseId}/calendar/classes/${item.scheduledDate}`, {
                status: "cancelled",
                description: item.description || ""
            });
            setModalMode("");
            setEditingEvent(null);
            setStatus("Class cancellation scheduled. Students will be notified 24 hours before class.");
            await loadEvents();
        } catch (requestError) {
            setStatus(requestError.response?.data?.message || "Unable to cancel this class.");
        }
    };

    const changeMonth = (offset) => {
        const next = new Date(month.getFullYear(), month.getMonth() + offset, 1);
        setLoading(true);
        setMonth(next);
        setSelectedDay(localDateValue(next));
    };

    const changeYear = (year) => {
        const next = new Date(Number(year), month.getMonth(), 1);
        setLoading(true);
        setMonth(next);
        setSelectedDay(localDateValue(next));
    };

    return (
        <div className="page-content feature-page">
            {courseId && courses.some((course) => String(course.id) === courseId) && (
                <RouteBackButton
                    className="course-context-back"
                    label={`Back to ${courses.find((course) => String(course.id) === courseId)?.title}`}
                />
            )}
            <header className="feature-page-header">
                <div>
                    <p className="eyebrow">PLAN YOUR LEARNING</p>
                    <h1>Calendar</h1>
                </div>
            </header>

            {error && <div className="dashboard-alert" role="alert">{error}</div>}
            {status && !modalMode && <p role="status" className="feature-status">{status}</p>}
            <section className="calendar-panel" aria-label="Course calendar">
                <div className="calendar-toolbar">
                    <div className="calendar-heading">
                        <h2>{new Intl.DateTimeFormat(undefined, { month: "long" }).format(month)}</h2>
                        <label className="calendar-year-picker">
                            <span className="sr-only">Calendar year</span>
                            <select aria-label="Calendar year" value={month.getFullYear()} onChange={(event) => changeYear(event.target.value)}>
                                {Array.from({ length: 21 }, (_, index) => month.getFullYear() - 10 + index)
                                    .map((year) => <option key={year} value={year}>{year}</option>)}
                            </select>
                        </label>
                    </div>
                    <div className="calendar-navigation" aria-label="Calendar navigation">
                        <button type="button" onClick={() => {
                            const today = new Date();
                            setLoading(true);
                            setMonth(new Date(today.getFullYear(), today.getMonth(), 1));
                            setSelectedDay(localDateValue(today));
                        }} aria-label="Go to today">Today</button>
                        <button type="button" aria-label="Previous month" onClick={() => changeMonth(-1)}><FaChevronLeft /></button>
                        <button type="button" aria-label="Next month" onClick={() => changeMonth(1)}><FaChevronRight /></button>
                    </div>
                </div>
                {loading ? <p className="dashboard-loading" role="status">Loading your calendar...</p> : <>
                    <div className="calendar-month-grid" role="grid" aria-label={new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(month)}>
                        {[
                            ["Sunday", "Sun"], ["Monday", "Mon"], ["Tuesday", "Tue"], ["Wednesday", "Wed"],
                            ["Thursday", "Thu"], ["Friday", "Fri"], ["Saturday", "Sat"]
                        ].map(([weekday, shortWeekday]) => (
                            <div role="columnheader" className="calendar-weekday" key={weekday} aria-label={weekday}>
                                <span className="calendar-weekday-full">{weekday}</span>
                                <span className="calendar-weekday-short" aria-hidden="true">{shortWeekday}</span>
                            </div>
                        ))}
                        {calendarDays.map((day) => {
                            const key = localDateValue(day);
                            const dayEvents = eventsByDay.get(key) || [];
                            const currentMonth = day.getMonth() === month.getMonth();
                            const today = key === localDateValue(new Date());
                            return (
                                <button
                                    type="button"
                                    role="gridcell"
                                    key={key}
                                    aria-label={`${new Intl.DateTimeFormat(undefined, { dateStyle: "full" }).format(day)}${dayEvents.length ? `, ${dayEvents.length} scheduled item(s)` : ""}`}
                                    aria-pressed={selectedDay === key}
                                    className={`calendar-day${currentMonth ? "" : " outside-month"}${selectedDay === key ? " selected" : ""}${today ? " today" : ""}${dayEvents.length ? " has-events" : ""}`}
                                    onClick={() => {
                                        setSelectedDay(key);
                                        if (isStaff) openSchedule(key);
                                        if (!currentMonth) {
                                            setLoading(true);
                                            setMonth(new Date(day.getFullYear(), day.getMonth(), 1));
                                        }
                                    }}
                                >
                                    <span>{day.getDate()}</span>
                                    {dayEvents.length > 0 && <span className="calendar-day-events">
                                        {dayEvents.slice(0, 2).map((item) => <span key={item.id} title={`${item.type}: ${item.title}`}>{item.title}</span>)}
                                        {dayEvents.length > 2 && <small>+{dayEvents.length - 2} more</small>}
                                    </span>}
                                </button>
                            );
                        })}
                    </div>
                    <section className="calendar-selected-day" aria-live="polite">
                        <h3>{new Date(`${selectedDay}T12:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</h3>
                        {isStaff && <button type="button" className="btn btn-inline" onClick={() => openSchedule()}>
                            Schedule activity
                        </button>}
                        {!selectedEvents.length ? <p>No activities scheduled for this day.</p> : (
                            <div className="calendar-event-list calendar-activities-scroll" aria-label="Activities" tabIndex={0}>
                                {selectedEvents.map((event) => (
                                    <article className="calendar-event" key={event.id}>
                                        <span className={`calendar-type type-${event.type}`}>{event.type}</span>
                                        <div>
                                            <strong>{event.title}</strong>
                                            <span>{event.courseTitle}</span>
                                            {event.description && <p>{event.description}</p>}
                                            {event.status === "cancelled" && <span className="calendar-event-status">Cancelled</span>}
                                            {event.status === "rescheduled" && <span className="calendar-event-status">Rescheduled</span>}
                                        </div>
                                        <time><FaClock aria-hidden="true" />{new Date(event.startsAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</time>
                                        {isStaff && event.type === "class" && event.recurring && (
                                            <div className="calendar-event-actions">
                                                <button type="button" className="btn btn-inline btn-secondary" onClick={() => openReschedule(event)}>Reschedule</button>
                                                {event.status !== "cancelled" && <button type="button" className="btn btn-inline btn-secondary" onClick={() => cancelClass(event)}>Cancel class</button>}
                                            </div>
                                        )}
                                        {isStaff && !event.recurring && event.type !== "assignment" && (
                                            <div className="calendar-event-actions">
                                                <button type="button" className="btn btn-inline btn-secondary" onClick={() => openReschedule(event)}>Reschedule</button>
                                            </div>
                                        )}
                                        {event.type === "assignment" && isStaff && <div className="calendar-reschedule">
                                            <button type="button" className="btn btn-inline btn-secondary" onClick={() => openReschedule(event)}>Reschedule due date</button>
                                        </div>}
                                    </article>
                                ))}
                            </div>
                        )}
                    </section>
                </>}
            </section>
            {isStaff && modalMode && (
                <div className="course-modal-backdrop" onMouseDown={(event) => {
                    if (event.target === event.currentTarget) {
                        setModalMode("");
                        setEditingEvent(null);
                    }
                }}>
                    <section className="course-modal calendar-schedule-modal" role="dialog" aria-modal="true" aria-labelledby="calendar-schedule-heading">
                        <button type="button" className="course-modal-close" aria-label="Close schedule dialog" onClick={() => {
                            setModalMode("");
                            setEditingEvent(null);
                        }}><FaTimes aria-hidden="true" /></button>
                        <h2 id="calendar-schedule-heading">{modalMode === "reschedule" ? "Reschedule activity" : "Schedule activity"}</h2>
                        {modalMode === "schedule" && selectedEvents.length > 0 && (
                            <div className="calendar-modal-events">
                                <h3>Scheduled for this day</h3>
                                {selectedEvents.map((item) => (
                                    <div key={item.id}>
                                        <span><strong>{item.title}</strong> · {new Date(item.startsAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</span>
                                        <button type="button" className="btn btn-inline btn-secondary" onClick={() => openReschedule(item)}>Reschedule</button>
                                        {item.recurring && item.type === "class" && item.status !== "cancelled" && (
                                            <button type="button" className="btn btn-inline btn-secondary" onClick={() => cancelClass(item)}>Cancel class</button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                        <form className="feature-form-grid" onSubmit={createEvent}>
                            {!editingEvent && <label>Course
                                <select required value={form.courseId} onChange={(event) => setForm({ ...form, courseId: event.target.value, assessmentId: "" })}>
                                    <option value="">Choose a course</option>
                                    {courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
                                </select>
                            </label>}
                            {!editingEvent && <label>Activity type
                                <select value={form.eventType} onChange={(event) => setForm({
                                    ...form,
                                    eventType: event.target.value,
                                    title: event.target.value === "no-school" ? "No school" : form.title,
                                    assessmentId: ""
                                })}>
                                    {eventKinds.map((kind) => <option key={kind} value={kind}>{eventKindLabel(kind)}</option>)}
                                </select>
                            </label>}
                            {!editingEvent && ["assessment", "quiz"].includes(form.eventType) && <label>Timed assessment
                                <select required value={form.assessmentId} onChange={(event) => {
                                    const assessment = assessments.find((item) => String(item.id) === event.target.value);
                                    setForm((current) => ({
                                        ...current,
                                        assessmentId: event.target.value,
                                        title: assessment?.title || current.title
                                    }));
                                }}>
                                    <option value="">Choose an assessment</option>
                                    {assessments.map((assessment) => <option key={assessment.id} value={assessment.id}>{assessment.title}</option>)}
                                </select>
                            </label>}
                            {(!editingEvent || editingEvent.type !== "assignment") && <label>Title
                                <input
                                    required
                                    maxLength={255}
                                    value={form.title}
                                    readOnly={form.eventType === "no-school"}
                                    onChange={(event) => setForm({ ...form, title: event.target.value })}
                                />
                            </label>}
                            {form.eventType === "assignment" && !editingEvent && <label>Assignment instructions
                                <textarea required rows={2} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
                            </label>}
                            {form.eventType !== "assignment" && <label>Description
                                <textarea
                                    required={form.eventType === "no-school"}
                                    rows={2}
                                    value={form.description}
                                    onChange={(event) => setForm({ ...form, description: event.target.value })}
                                />
                            </label>}
                            <label>{form.eventType === "assignment" ? "Due date" : "Starts"}
                                <input type="datetime-local" required value={form.startsAt} onChange={(event) => setForm({ ...form, startsAt: event.target.value })} />
                            </label>
                            {form.eventType !== "assignment" && <label>Ends
                                <input type="datetime-local" required value={form.endsAt} onChange={(event) => setForm({ ...form, endsAt: event.target.value })} />
                            </label>}
                            <div className="course-modal-actions feature-form-wide">
                                <button type="button" className="course-cancel-button" onClick={() => {
                                    setModalMode("");
                                    setEditingEvent(null);
                                }}>Cancel</button>
                                {editingEvent?.recurring && editingEvent.status !== "cancelled" && <button type="button" className="course-cancel-button" onClick={() => cancelClass(editingEvent)}>Cancel class</button>}
                                <button className="btn btn-inline" type="submit">{modalMode === "reschedule" ? "Save changes" : "Schedule"}</button>
                            </div>
                            {status && <p role="status" className="feature-status feature-form-wide">{status}</p>}
                        </form>
                    </section>
                </div>
            )}
        </div>
    );
};

export default Calendar;
