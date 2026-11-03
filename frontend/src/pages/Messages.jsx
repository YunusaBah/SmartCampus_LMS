import { useEffect, useState } from "react";
import { FaCommentDots, FaPaperPlane } from "react-icons/fa";
import API from "../services/api";
import { useAuth } from "../hooks/useAuth";
import useOfflineRefresh from "../hooks/useOfflineRefresh";

const Messages = () => {
    const offlineRefresh = useOfflineRefresh();
    const { user } = useAuth();
    const [courses, setCourses] = useState([]);
    const [courseId, setCourseId] = useState("");
    const [classmates, setClassmates] = useState([]);
    const [participantId, setParticipantId] = useState("");
    const [messages, setMessages] = useState([]);
    const [messageBody, setMessageBody] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [sending, setSending] = useState(false);
    const activeCourse = courses.find((course) => String(course.id) === String(courseId));
    const activeClassmate = classmates.find((student) => String(student.id) === String(participantId));

    useEffect(() => {
        let active = true;
        API.get("/enrollments/my-courses")
            .then((response) => {
                if (!active) return;
                const available = response.data.map((enrollment) => enrollment.course).filter(Boolean);
                setCourses(available);
                setCourseId(available[0] ? String(available[0].id) : "");
            })
            .catch((requestError) => {
                if (active) setError(requestError.response?.data?.message || "Unable to load your classes.");
            })
            .finally(() => {
                if (active) setLoading(false);
            });
        return () => { active = false; };
    }, [offlineRefresh]);

    useEffect(() => {
        if (!courseId) return;
        let active = true;
        API.get(`/courses/${courseId}/conversations`)
            .then((response) => {
                if (!active) return;
                setClassmates(response.data.map((conversation) => ({
                    ...conversation.participant,
                    latestMessage: conversation.latestMessage
                })));
                setParticipantId("");
                setMessages([]);
            })
            .catch((requestError) => {
                if (active) setError(requestError.response?.data?.message || "Unable to load classmates.");
            });
        return () => { active = false; };
    }, [courseId, offlineRefresh]);

    useEffect(() => {
        if (!courseId || !participantId) return;
        let active = true;
        API.get(`/courses/${courseId}/conversations/${participantId}`)
            .then((response) => {
                if (active) setMessages(response.data);
            })
            .catch((requestError) => {
                if (active) setError(requestError.response?.data?.message || "Unable to load this classmate conversation.");
            });
        return () => { active = false; };
    }, [courseId, offlineRefresh, participantId]);

    const sendMessage = async (event) => {
        event.preventDefault();
        if (!messageBody.trim() || !courseId || !participantId) return;
        setSending(true);
        setError("");
        try {
            const response = await API.post(`/courses/${courseId}/messages`, {
                recipientId: Number(participantId),
                body: messageBody.trim()
            });
            setMessages((current) => [...current, response.data]);
            setMessageBody("");
        } catch (requestError) {
            setError(requestError.response?.data?.message || "Unable to send your message.");
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="page-content messages-page">
            <header className="feature-page-header">
                <div>
                    <p className="eyebrow">COURSE COMMUNICATION</p>
                    <h1>Messages</h1>
                </div>
            </header>
            {error && <div className="dashboard-alert" role="alert">{error}</div>}
            {loading ? <p className="dashboard-loading" role="status">Loading classmates...</p> : !courses.length ? (
                <div className="feature-empty"><FaCommentDots /><strong>No classes yet</strong></div>
            ) : (
                <>
                    <label className="messages-course-select">Class
                        <select value={courseId} onChange={(event) => setCourseId(event.target.value)}>
                            {courses.map((course) => <option value={course.id} key={course.id}>{course.title}</option>)}
                        </select>
                    </label>
                    <section className="messenger">
                        <aside className="conversation-list" aria-label="Classmates">
                            <h2>Classmates</h2>
                            {classmates.length ? classmates.map((student) => (
                                <button
                                    type="button"
                                    key={student.id}
                                    className={String(participantId) === String(student.id) ? "conversation-choice active" : "conversation-choice"}
                                    onClick={() => setParticipantId(String(student.id))}
                                >
                                    <strong>{student.fullName}</strong>
                                    <span>{student.latestMessage?.body || "Start a conversation"}</span>
                                </button>
                            )) : <p className="messenger-empty">No other students are enrolled in this class yet.</p>}
                        </aside>
                        <div className="chat-area">
                            <div className="chat-heading">
                                <strong>{activeClassmate?.fullName || "Select a classmate"}</strong>
                                <span>{activeCourse?.title}</span>
                            </div>
                            <div className="chat-messages" aria-live="polite">
                                {messages.length ? messages.map((message) => (
                                    <article className={String(message.senderId) === String(user?.id) ? "chat-message own" : "chat-message"} key={message.id}>
                                        <p>{message.body}</p>
                                        <time>{new Date(message.createdAt).toLocaleString()}</time>
                                    </article>
                                )) : <div className="messenger-empty">No messages.</div>}
                            </div>
                            <form className="chat-compose" onSubmit={sendMessage}>
                                <label className="sr-only" htmlFor="chat-message">Write a message</label>
                                <input id="chat-message" value={messageBody} onChange={(event) => setMessageBody(event.target.value)} placeholder="Write a message to your classmate..." maxLength={20000} disabled={!participantId} />
                                <button type="submit" className="btn btn-inline" disabled={sending || !messageBody.trim() || !participantId} aria-label="Send message">
                                    <FaPaperPlane /><span>Send</span>
                                </button>
                            </form>
                        </div>
                    </section>
                </>
            )}
        </div>
    );
};

export default Messages;
