import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { FaBullhorn, FaCommentDots, FaHeart, FaPaperPlane, FaRegHeart, FaRegSmile, FaReply, FaTimes } from "react-icons/fa";
import API from "../services/api";

const positiveEmojis = ["👍", "❤️", "🎉", "👏", "😊", "🙌", "💯", "✅", "🤩", "🚀"];

const AnnouncementCard = ({ announcement, isStaff, actions }) => {
    const [expanded, setExpanded] = useState(false);
    const [pickerOpen, setPickerOpen] = useState(false);
    const [activity, setActivity] = useState({ viewers: [], reactions: [], comments: [] });
    const [activityError, setActivityError] = useState("");
    const [commentText, setCommentText] = useState("");
    const [replyingTo, setReplyingTo] = useState(null);
    const [commentPending, setCommentPending] = useState(false);
    const longPressTimer = useRef(null);
    const longPressTriggered = useRef(false);
    const lastTouchTapAt = useRef(0);

    const loadActivity = async () => {
        setActivityError("");
        try {
            const response = await API.get(`/announcements/${announcement.id}/activity`);
            setActivity(response.data);
        } catch (error) {
            setActivityError(error.response?.data?.message || "Unable to load announcement activity.");
        }
    };

    useEffect(() => {
        let active = true;
        API.get(`/announcements/${announcement.id}/activity`)
            .then((response) => {
                if (active) setActivity(response.data);
            })
            .catch((error) => {
                if (active) setActivityError(error.response?.data?.message || "Unable to load announcement activity.");
            });
        return () => { active = false; };
    }, [announcement.id]);

    useEffect(() => {
        if (!expanded) return undefined;
        const previousOverflow = document.body.style.overflow;
        const closeOnEscape = (event) => {
            if (event.key === "Escape") {
                setExpanded(false);
                setReplyingTo(null);
            }
        };
        document.body.style.overflow = "hidden";
        window.addEventListener("keydown", closeOnEscape);
        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener("keydown", closeOnEscape);
        };
    }, [expanded]);

    const openDetails = async () => {
        if (!expanded) {
            setExpanded(true);
            if (!isStaff) {
                try {
                    await API.post(`/announcements/${announcement.id}/view`);
                } catch (error) {
                    setActivityError(error.response?.data?.message || "Unable to record this announcement view.");
                }
            }
            await loadActivity();
        } else {
            setExpanded(false);
            setReplyingTo(null);
        }
    };

    const react = async (emoji) => {
        try {
            await API.put(`/announcements/${announcement.id}/reaction`, { emoji });
            setPickerOpen(false);
            await loadActivity();
        } catch (error) {
            setActivityError(error.response?.data?.message || "Unable to save your reaction.");
        }
    };

    const handleAnnouncementTap = (event) => {
        if (event.pointerType !== "touch") return;
        const now = Date.now();
        if (now - lastTouchTapAt.current < 320) {
            lastTouchTapAt.current = 0;
            void react("❤️");
            return;
        }
        lastTouchTapAt.current = now;
    };

    const submitComment = async (event) => {
        event.preventDefault();
        const body = commentText.trim();
        if (!body || commentPending) return;
        setCommentPending(true);
        try {
            await API.post(`/announcements/${announcement.id}/comments`, {
                body,
                ...(replyingTo ? { parentCommentId: replyingTo.id } : {})
            });
            setCommentText("");
            setReplyingTo(null);
            await loadActivity();
        } catch (error) {
            setActivityError(error.response?.data?.message || "Unable to post your comment.");
        } finally {
            setCommentPending(false);
        }
    };

    const toggleCommentLike = async (commentId) => {
        try {
            await API.put(`/announcements/comments/${commentId}/reaction`);
            await loadActivity();
        } catch (error) {
            setActivityError(error.response?.data?.message || "Unable to like this comment.");
        }
    };

    const clearLongPress = () => {
        if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
    };

    useEffect(() => () => {
        if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
    }, []);

    const renderComment = (comment, isReply = false, replyParentId = comment.id) => (
        <li className={`announcement-comment${isReply ? " is-reply" : ""}`} key={comment.id}>
            <div className="announcement-comment-content">
                <p>
                    <strong>{comment.author?.fullName || "Course member"}</strong>
                    {comment.author?.role === "lecturer" && <span className="announcement-lecturer-badge">Lecturer</span>}
                    <span>{comment.body}</span>
                </p>
                <div className="announcement-comment-actions">
                    <time>{new Date(comment.createdAt).toLocaleString()}</time>
                    {isStaff && !isReply && comment.author?.role !== "lecturer" && (
                        <button type="button" onClick={() => setReplyingTo({ id: replyParentId, name: comment.author?.fullName || "comment" })}>
                            <FaReply aria-hidden="true" /> Reply
                        </button>
                    )}
                </div>
                {comment.replies?.length > 0 && (
                    <ul className="announcement-comment-replies">
                        {comment.replies.map((reply) => renderComment(reply, true, comment.id))}
                    </ul>
                )}
            </div>
            <button
                type="button"
                className={`announcement-comment-like${comment.likedByMe ? " is-liked" : ""}`}
                aria-label={`${comment.likedByMe ? "Unlike" : "Like"} comment by ${comment.author?.fullName || "course member"}`}
                aria-pressed={Boolean(comment.likedByMe)}
                onClick={() => toggleCommentLike(comment.id)}
            >
                {comment.likedByMe ? <FaHeart aria-hidden="true" /> : <FaRegHeart aria-hidden="true" />}
                {comment.likeCount > 0 && <span>{comment.likeCount}</span>}
            </button>
        </li>
    );

    const topLevelComments = activity.comments
        .filter((comment) => !comment.parentCommentId)
        .map((comment) => ({
            ...comment,
            replies: activity.comments.filter((reply) => String(reply.parentCommentId) === String(comment.id))
        }));
    const reactionCount = activity.reactions.reduce((total, reaction) => total + reaction.users.length, 0);
    const myReaction = activity.myReaction;
    const shareAnnouncement = () => {
        window.dispatchEvent(new CustomEvent("smartcampus:share-announcement", {
            detail: {
                id: announcement.id,
                title: announcement.title,
                body: announcement.body,
                courseId: announcement.courseId,
                courseTitle: announcement.courseTitle || announcement.course?.title || "Course"
            }
        }));
    };

    return (
        <article
            id={`announcement-${announcement.id}`}
            className="announcement-card announcement-interactive-card"
            onContextMenu={(event) => {
                event.preventDefault();
                setPickerOpen(true);
                void loadActivity();
            }}
            onPointerDown={(event) => {
                if (event.pointerType !== "touch") return;
                longPressTriggered.current = false;
                longPressTimer.current = window.setTimeout(() => {
                    longPressTriggered.current = true;
                    setPickerOpen(true);
                }, 550);
            }}
            onPointerUp={clearLongPress}
            onPointerCancel={clearLongPress}
            onPointerLeave={clearLongPress}
            onClickCapture={(event) => {
                if (longPressTriggered.current) {
                    event.preventDefault();
                    event.stopPropagation();
                    longPressTriggered.current = false;
                }
            }}
        >
            <span className="announcement-icon" aria-hidden="true"><FaBullhorn /></span>
            <div className="announcement-copy">
                <span className="sr-only" aria-live="polite">
                    {reactionCount} reactions, {activity.comments.length} comments
                </span>
                <div className="announcement-meta">
                    {announcement.courseTitle && announcement.courseId
                        ? <Link to={`/courses/${announcement.courseId}`}>{announcement.courseTitle}</Link>
                        : <span>{announcement.course?.title || "Course announcement"}</span>}
                    <time>{new Date(announcement.createdAt).toLocaleString()}</time>
                </div>
                <h2 className="announcement-post-title">{announcement.title}</h2>
                <span className="announcement-author">
                    Posted by {announcement.author?.fullName || "Course staff"}
                    {announcement.authorRoleName && ` · ${announcement.authorRoleName}`}
                </span>
                <p
                    className="announcement-post-body"
                    onPointerUp={handleAnnouncementTap}
                >
                    {announcement.body}
                </p>
                {pickerOpen && (
                    <div className="announcement-emoji-picker" role="group" aria-label="Choose a positive reaction">
                        {positiveEmojis.map((emoji) => (
                            <button key={emoji} type="button" aria-label={`React with ${emoji}`} onClick={() => react(emoji)}>
                                {emoji}
                            </button>
                        ))}
                    </div>
                )}
                {activity.reactions.length > 0 && (
                    <div className="announcement-reaction-list" aria-label="Announcement reactions">
                        {activity.reactions.map(({ emoji, users }) => (
                            <button
                                key={emoji}
                                type="button"
                                className={activity.myReaction === emoji ? "is-selected" : ""}
                                title={users.map((user) => user.fullName).join(", ")}
                                aria-label={`React with ${emoji}; ${users.length} reactions`}
                                aria-pressed={activity.myReaction === emoji}
                                onClick={() => react(emoji)}
                            >
                                {emoji} {users.length}
                            </button>
                        ))}
                    </div>
                )}
            </div>
            <footer className="announcement-engagement-bar" aria-label="Announcement actions">
                <button
                    type="button"
                    className={`announcement-engagement-action announcement-reaction-action${pickerOpen ? " is-open" : ""}`}
                    onClick={() => {
                        setPickerOpen((open) => !open);
                        void loadActivity();
                    }}
                    aria-label={pickerOpen ? "Close announcement reactions" : "Choose an announcement reaction"}
                    aria-expanded={pickerOpen}
                    aria-haspopup="true"
                >
                    {myReaction
                        ? <span className="announcement-my-reaction" aria-hidden="true">{myReaction}</span>
                        : <FaRegSmile aria-hidden="true" />}
                    <span>{reactionCount.toLocaleString()}</span>
                </button>
                <button
                    type="button"
                    className={`announcement-engagement-action${expanded ? " is-open" : ""}`}
                    onClick={openDetails}
                    aria-label={expanded ? "Hide announcement comments" : "Show announcement comments"}
                    aria-expanded={expanded}
                >
                    <FaCommentDots aria-hidden="true" />
                    <span>{activity.comments.length.toLocaleString()}</span>
                </button>
                {!isStaff && (
                    <button
                        type="button"
                        className="announcement-engagement-action announcement-share-action"
                        onClick={shareAnnouncement}
                        aria-label="Share announcement in student chat"
                        title="Share in student chat"
                    >
                        <FaPaperPlane aria-hidden="true" />
                        <span className="sr-only">Share</span>
                    </button>
                )}
            </footer>
            {expanded && (
                <div
                    className="announcement-comments-overlay"
                    role="presentation"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) {
                            setExpanded(false);
                            setReplyingTo(null);
                        }
                    }}
                >
                    <section
                        className="announcement-comments-panel"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby={`announcement-comments-title-${announcement.id}`}
                        onMouseDown={(event) => event.stopPropagation()}
                    >
                        <header className="announcement-comments-header">
                            <h2 id={`announcement-comments-title-${announcement.id}`}>Comments</h2>
                            <button
                                type="button"
                                onClick={() => {
                                    setExpanded(false);
                                    setReplyingTo(null);
                                }}
                                aria-label="Close comments"
                            >
                                <FaTimes aria-hidden="true" />
                            </button>
                        </header>
                        {activityError && <p className="announcement-activity-error" role="alert">{activityError}</p>}
                        <div className="announcement-comments-scroll">
                            {topLevelComments.length ? (
                                <ul className="announcement-comments">
                                    {topLevelComments.map((comment) => renderComment(comment))}
                                </ul>
                            ) : <p className="announcement-comments-empty">Start the conversation.</p>}
                            {isStaff && (
                                <details className="announcement-viewers">
                                    <summary>Seen by {activity.viewers.length}</summary>
                                    {activity.viewers.length > 0 && (
                                        <ul>
                                            {activity.viewers.map((viewer) => (
                                                <li key={viewer.id}>
                                                    {viewer.fullName}{viewer.roleName ? ` · ${viewer.roleName}` : ""}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </details>
                            )}
                        </div>
                        {actions && isStaff && <div className="announcement-comments-admin-actions">{actions}</div>}
                        <form className="announcement-comment-form" onSubmit={submitComment}>
                            {replyingTo && (
                                <div className="announcement-replying-to">
                                    Replying to {replyingTo.name}
                                    <button type="button" onClick={() => setReplyingTo(null)} aria-label="Cancel reply">×</button>
                                </div>
                            )}
                            <textarea
                                className="announcement-comment-input"
                                value={commentText}
                                onChange={(event) => setCommentText(event.target.value)}
                                maxLength={2000}
                                rows={2}
                                placeholder={replyingTo ? "Write a reply..." : "Write a comment..."}
                                aria-label={replyingTo ? "Write a reply" : "Write a comment"}
                            />
                            <button type="submit" className="btn btn-inline" disabled={!commentText.trim() || commentPending}>
                                {commentPending ? "Posting..." : replyingTo ? "Reply" : "Comment"}
                            </button>
                        </form>
                    </section>
                </div>
            )}
        </article>
    );
};

export default AnnouncementCard;
