import { useEffect, useMemo, useState } from "react";
import { FaCommentDots, FaPaperPlane } from "react-icons/fa";
import API from "../services/api";
import { useAuth } from "../hooks/useAuth";
import useOfflineRefresh from "../hooks/useOfflineRefresh";

const CourseLecturerMessages = ({ courseId, isLecturer, canMessageLecturer }) => {
    const offlineRefresh = useOfflineRefresh();
    const { user } = useAuth();
    const [messages, setMessages] = useState([]);
    const [students, setStudents] = useState([]);
    const [studentId, setStudentId] = useState("");
    const [body, setBody] = useState("");
    const [error, setError] = useState("");
    const [loadedKey, setLoadedKey] = useState("");
    const [sending, setSending] = useState(false);
    const canAccessInbox = isLecturer || canMessageLecturer;
    const inboxKey = `${courseId}:${isLecturer}:${canAccessInbox}`;
    const loading = canAccessInbox && loadedKey !== inboxKey;
    const selectedStudent = students.find((student) => String(student.id) === studentId);
    const visibleMessages = useMemo(() => canAccessInbox ? messages.filter((message) => {
        const otherId = String(message.senderId) === String(user?.id) ? message.recipientId : message.senderId;
        return isLecturer ? String(otherId) === studentId : true;
    }) : [], [canAccessInbox, isLecturer, messages, studentId, user?.id]);

    useEffect(() => {
        if (!canAccessInbox) return undefined;
        let active = true;
        const loadMessages = () => API.get(`/courses/${courseId}/lecturer-messages`)
            .then((response) => {
                if (!active) return;
                setError("");
                if (isLecturer) {
                    setMessages(response.data.messages);
                    setStudents(response.data.students);
                    setStudentId((current) => {
                        if (response.data.students.some((student) => String(student.id) === current)) return current;
                        const firstMessage = response.data.messages[0];
                        const firstStudentId = firstMessage
                            ? String(String(firstMessage.senderId) === String(user?.id)
                                ? firstMessage.recipientId
                                : firstMessage.senderId)
                            : "";
                        return firstStudentId || String(response.data.students[0]?.id || "");
                    });
                } else {
                    setMessages(response.data);
                }
            })
            .catch((requestError) => {
                if (active) setError(requestError.response?.data?.message || "Unable to load course messages.");
            })
            .finally(() => {
                if (active) setLoadedKey(inboxKey);
            });
        loadMessages();
        const refreshTimer = window.setInterval(loadMessages, 10000);
        return () => {
            active = false;
            window.clearInterval(refreshTimer);
        };
    }, [canAccessInbox, courseId, inboxKey, isLecturer, offlineRefresh, user?.id]);

    const sendMessage = async (event) => {
        event.preventDefault();
        if (!body.trim() || (isLecturer && !studentId)) return;
        setSending(true);
        setError("");
        try {
            const response = await API.post(`/courses/${courseId}/lecturer-messages`, {
                body: body.trim(),
                ...(isLecturer ? { recipientId: Number(studentId) } : {})
            });
            setMessages((current) => [...current, {
                ...response.data,
                sender: user,
                recipient: isLecturer ? selectedStudent : null
            }]);
            setBody("");
        } catch (requestError) {
            setError(requestError.response?.data?.message || "Unable to send your message.");
        } finally {
            setSending(false);
        }
    };

    return (
        <section className="course-feature-section course-lecturer-messages">
            <header>
                <p className="eyebrow">PRIVATE COURSE INBOX</p>
                <h2><FaCommentDots aria-hidden="true" /> {isLecturer ? "Student messages" : "Message your lecturer"}</h2>
                <p>{isLecturer
                    ? "Read and reply to private messages from students with messaging permission."
                    : canMessageLecturer
                        ? "Only you and your lecturer can see this conversation."
                        : "Your lecturer must grant you messaging permission to start a private conversation."}</p>
            </header>
            {isLecturer && (
                <label className="messages-course-select">Student
                    <select value={studentId} onChange={(event) => setStudentId(event.target.value)}>
                        {students.map((student) => (
                            <option key={student.id} value={student.id}>{student.fullName}</option>
                        ))}
                    </select>
                </label>
            )}
            {error && <p className="materials-error" role="alert">{error}</p>}
            {!canAccessInbox ? <p className="messenger-empty">Messaging permission required.</p> : loading ? <p role="status">Loading messages...</p> : (
                <>
                    <div className="chat-messages" aria-live="polite">
                        {visibleMessages.length ? visibleMessages.map((message) => (
                            <article className={String(message.senderId) === String(user?.id) ? "chat-message own" : "chat-message"} key={message.id}>
                                {isLecturer && String(message.senderId) !== String(user?.id) && (
                                    <strong>{message.sender?.fullName || selectedStudent?.fullName}</strong>
                                )}
                                <p>{message.body}</p>
                                <time>{new Date(message.createdAt).toLocaleString()}</time>
                            </article>
                        )) : <p className="messenger-empty">{isLecturer
                            ? (selectedStudent ? "No messages from this student yet." : "No students have private messaging permission.")
                            : "No messages yet."}</p>}
                    </div>
                    {(isLecturer || canMessageLecturer) && (
                        <form className="chat-compose" onSubmit={sendMessage}>
                            <label className="sr-only" htmlFor={`lecturer-message-${courseId}`}>Write a private message</label>
                            <input
                                id={`lecturer-message-${courseId}`}
                                value={body}
                                onChange={(event) => setBody(event.target.value)}
                                placeholder="Write a private message..."
                                maxLength={20000}
                                disabled={sending || (isLecturer && !studentId)}
                            />
                            <button type="submit" className="btn btn-inline" disabled={sending || !body.trim() || (isLecturer && !studentId)} aria-label="Send private message">
                                <FaPaperPlane /><span>Send</span>
                            </button>
                        </form>
                    )}
                </>
            )}
        </section>
    );
};

export default CourseLecturerMessages;
