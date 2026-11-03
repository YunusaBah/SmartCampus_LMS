import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { FaClipboardList } from "react-icons/fa";
import API from "../services/api";

const statuses = [
    { id: "assigned", label: "Assigned" },
    { id: "missing", label: "Missing" },
    { id: "done", label: "Done" }
];

const Todos = () => {
    const { status } = useParams();
    const [assignments, setAssignments] = useState([]);
    const [submissions, setSubmissions] = useState([]);
    const [currentTime] = useState(() => Date.now());
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const activeStatus = statuses.some((item) => item.id === status) ? status : null;

    useEffect(() => {
        let active = true;
        Promise.all([
            API.get("/assignments/my"),
            API.get("/assignments/my/submissions")
        ])
            .then(([assignmentResponse, submissionResponse]) => {
                if (!active) return;
                setAssignments(assignmentResponse.data);
                setSubmissions(submissionResponse.data);
            })
            .catch((requestError) => {
                if (active) setError(requestError.response?.data?.message || "Unable to load your to-do list.");
            })
            .finally(() => {
                if (active) setLoading(false);
            });
        return () => { active = false; };
    }, []);

    const categorized = useMemo(() => {
        const submittedIds = new Set(submissions.map((submission) => submission.assignmentId));
        return assignments.map((assignment) => {
            if (submittedIds.has(assignment.id)) return { ...assignment, status: "done" };
            return {
                ...assignment,
                status: new Date(assignment.dueDate).getTime() < currentTime ? "missing" : "assigned"
            };
        });
    }, [assignments, submissions, currentTime]);
    const displayedAssignments = activeStatus
        ? categorized.filter((assignment) => assignment.status === activeStatus)
        : categorized;

    return (
        <div className="page-content feature-page">
            <header className="feature-page-header">
                <div>
                    <p className="eyebrow">YOUR COURSEWORK</p>
                    <h1>To-do list</h1>
                </div>
            </header>
            {activeStatus && <Link className="todo-board-link" to="/todo">View all to-do columns</Link>}
            {loading ? <p className="dashboard-loading" role="status">Loading your to-do list...</p> : error ? (
                <div className="dashboard-alert" role="alert">{error}</div>
            ) : !activeStatus && !displayedAssignments.length ? (
                <div className="feature-empty">
                    <FaClipboardList />
                    <strong>{activeStatus ? `No ${activeStatus} assignments` : "No assignments yet"}</strong>
                </div>
            ) : (
                <section className={activeStatus ? "todo-board single-column" : "todo-board"} aria-label="Assignments by status">
                    {statuses
                        .filter((item) => !activeStatus || item.id === activeStatus)
                        .map((item) => {
                            const columnAssignments = categorized.filter((assignment) => assignment.status === item.id);
                            return (
                                <section className={`todo-column todo-column-${item.id}`} key={item.id} id={`todo-${item.id}`}>
                                    <header className="todo-column-header">
                                        <div>
                                            <h2>{item.label}</h2>
                                            <span>{columnAssignments.length} {columnAssignments.length === 1 ? "assignment" : "assignments"}</span>
                                        </div>
                                        <Link to={`/todo/${item.id}`} aria-label={`Open ${item.label} assignments`}>View</Link>
                                    </header>
                                    <div className="todo-column-items">
                                        {columnAssignments.length ? columnAssignments.map((assignment) => (
                                            <article className="todo-card" key={assignment.id}>
                                                <span className={`todo-status status-${item.id}`}>{item.label}</span>
                                                <h3>{assignment.title}</h3>
                                                <p>{assignment.course?.title || "Course assignment"}</p>
                                                <time dateTime={assignment.dueDate}>
                                                    Due {new Date(assignment.dueDate).toLocaleString()}
                                                </time>
                                                <Link to={`/courses/${assignment.courseId}`}>Open course</Link>
                                            </article>
                                        )) : (
                                            <p className="todo-column-empty">No {item.label.toLowerCase()} assignments.</p>
                                        )}
                                    </div>
                                </section>
                            );
                        })}
                </section>
            )}
        </div>
    );
};

export default Todos;
