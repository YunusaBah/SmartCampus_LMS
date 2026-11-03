import { useMemo, useRef, useState } from "react";
import { FaArrowLeft, FaBookOpen, FaSearch, FaStar } from "react-icons/fa";
import { Link } from "react-router-dom";
import API from "../services/api";
import { useAuth } from "../hooks/useAuth";

const helpArticles = [
    {
        id: "dashboard",
        category: "Getting started",
        title: "What can I do from my dashboard?",
        roles: ["student", "lecturer"],
        summary: "Understand your dashboard and find your next learning or teaching task.",
        steps: [
            "Choose Home in the sidebar to open your dashboard.",
            "Review the course, activity, and deadline information shown for your account.",
            "Open a course or use a dashboard link to continue to the related module."
        ],
        result: "Your dashboard shows information available to your signed-in role and provides shortcuts into course activities.",
        troubleshooting: "If a course or activity is missing, confirm you are signed in to the correct account and that you are enrolled in or responsible for that course."
    },
    {
        id: "navigation",
        category: "Getting started",
        title: "How do I navigate SmartCampus LMS?",
        roles: ["student", "lecturer"],
        summary: "Find the sidebar, open a module, and move between your dashboard, courses, settings, and help.",
        steps: [
            "On a desktop, use the navigation sidebar on the left. On a phone, tap the menu button in the top bar to open the sidebar; tap a module to go there.",
            "Choose Home to return to your dashboard, or Courses to find and open a course.",
            "Inside a course, use the sidebar or course navigation to open Materials, Assignments, Quizzes, Calendar, and Announcements.",
            "Students can open Grades, Assignments, and Quizzes from the sidebar to see their own coursework and results. Lecturers also have Students and Grades, with review and upload tools inside Assignments and Quizzes.",
            "Choose Settings for profile and display preferences. From Settings, open Help & Feedback for step-by-step guides or to email private feedback to the developer."
        ],
        result: "The sidebar takes you between modules while keeping you signed in. Available modules depend on your role and course access.",
        troubleshooting: "On a phone, the sidebar closes after you choose a module. Tap the top-bar menu again whenever you need another module. If a link is unavailable, check your role and course enrollment."
    },
    {
        id: "courses-student",
        category: "Courses",
        title: "How do I find or join a course?",
        roles: ["student"],
        summary: "Browse available courses, join with a class code, and open your enrolled courses.",
        steps: [
            "Open Courses to see your enrolled courses.",
            "To browse courses, open the course catalog from the Courses page.",
            "To join by code, choose Join Class, enter the code supplied by your lecturer, and submit.",
            "Open an enrolled course to go directly to its course materials."
        ],
        result: "A successful enrollment adds the course to your course list. Access to course activities depends on your enrollment.",
        troubleshooting: "Check that the class code was entered exactly as supplied and that enrollment is open. If joining is still unavailable, ask the course lecturer to confirm the code and enrollment settings."
    },
    {
        id: "courses-lecturer",
        category: "Courses",
        title: "How do I create and manage courses?",
        roles: ["lecturer"],
        summary: "Create a course and manage its details, enrollment, and learning sections.",
        steps: [
            "Open Courses and choose the create-course action.",
            "Enter the course title, optional description, and class schedule, then submit the form.",
            "Open the created course to work with its materials, students, assignments, quizzes, calendar, and announcements.",
            "For course details or enrollment options, open Settings, then Course settings, and select the course to update."
        ],
        result: "The course appears in your course list. Its availability to students follows the course status and enrollment settings.",
        troubleshooting: "If the course does not appear, check for the creation message and refresh Courses. Course settings are available only to the lecturer responsible for the course."
    },
    {
        id: "materials-student",
        category: "Materials",
        title: "How do I find course materials?",
        roles: ["student"],
        summary: "Search, preview, and download materials shared for your courses.",
        steps: [
            "Choose Materials in the sidebar.",
            "Search by material or course, or use the course filter.",
            "Select a material to preview it when a preview is available.",
            "Use the download action to save a shared file."
        ],
        result: "Materials are shown for courses you can access. Available resource links can be opened from the material.",
        troubleshooting: "If a material is missing, confirm you are enrolled in its course. If a file cannot be opened, try downloading it or contact the course lecturer."
    },
    {
        id: "materials-lecturer",
        category: "Materials",
        title: "How do I share learning materials?",
        roles: ["lecturer"],
        summary: "Upload a supported file or share a resource link with a course.",
        steps: [
            "Open Materials and choose Share a material.",
            "Choose the course, enter a title, then attach a supported file or enter a resource link.",
            "Submit the form and check for the success message.",
            "Use search or the course filter to confirm the material is listed."
        ],
        result: "The new resource is added to the selected course and becomes available to users with access to that course.",
        troubleshooting: "Choose a course and provide a file or link. If sharing fails, check the displayed error and confirm your connection."
    },
    {
        id: "assignments-student",
        category: "Assignments",
        title: "How do I read and submit an assignment?",
        roles: ["student"],
        summary: "Review an assignment, then submit a written reply or supported file before its deadline.",
        steps: [
            "Open Assignment in the sidebar and find the assignment for your course.",
            "Open or download its instructions and check the due date.",
            "Enter a written reply, attach a supported document or image, or provide both.",
            "Submit the work and check for the submission confirmation."
        ],
        result: "Your submission is recorded for the assignment. You can review feedback or grades when they are made available.",
        troubleshooting: "The app does not allow submission after the due date. If the deadline has passed, contact your lecturer about an extension."
    },
    {
        id: "assignments-lecturer",
        category: "Assignments",
        title: "How do I review submissions and grade work?",
        roles: ["lecturer"],
        summary: "Open assignment submissions, review student work, and record grades and feedback.",
        steps: [
            "Open Grading in the sidebar or open a course's grading section.",
            "Select the relevant course or assignment and review its submissions.",
            "Open or download a submission to review the student's work.",
            "Enter a grade and save it. Add feedback where the assignment workflow provides a feedback field."
        ],
        result: "The saved grade and feedback are associated with the submission and can be viewed by the student.",
        troubleshooting: "If a submission is missing, confirm it belongs to a course you teach and refresh the page. Only authorized lecturers can grade course submissions."
    },
    {
        id: "quizzes-student",
        category: "Quizzes",
        title: "How do I take a quiz or assessment?",
        roles: ["student"],
        summary: "Find course quizzes, review assessment instructions, and submit your attempt.",
        steps: [
            "Open Quizzes and find the quiz by course or title.",
            "Open it and read any instructions, time limit, and attempt limit shown.",
            "Answer each question and submit before leaving the assessment.",
            "Review any result or feedback made available after submission."
        ],
        result: "Your attempt is recorded and results are shown according to the assessment settings.",
        troubleshooting: "If an assessment is unavailable, check its course and availability with the lecturer. Avoid refreshing or closing an assessment while an attempt is in progress."
    },
    {
        id: "quizzes-lecturer",
        category: "Quizzes",
        title: "How do I create a quiz or assessment?",
        roles: ["lecturer"],
        summary: "Create course quizzes, including assessments with questions, instructions, and attempt limits.",
        steps: [
            "Open Quizzes and choose the create action.",
            "Choose the course and the quiz format shown in the form.",
            "For an assessment, enter its title and instructions, set the time and attempt limits, then add questions.",
            "Complete every question. Multiple-choice questions require at least two options and a correct answer.",
            "Submit the form and confirm that the new quiz appears in the list."
        ],
        result: "The quiz is associated with the chosen course and is available to its students according to the assessment settings.",
        troubleshooting: "Complete all required questions and check the displayed validation message. You can also import questions when the import option is available."
    },
    {
        id: "grades-student",
        category: "Grades",
        title: "Where can I see my grades?",
        roles: ["student"],
        summary: "Review grades released for your course activities.",
        steps: [
            "Choose Grades in the sidebar.",
            "Find the course or assessment you want to review.",
            "Open the item to see the grade and any feedback provided."
        ],
        result: "Only grades released or available to your account are displayed.",
        troubleshooting: "If you expect a grade that is not shown, confirm the work was submitted and ask the course lecturer whether grading has been completed."
    },
    {
        id: "students-lecturer",
        category: "Students",
        title: "How do I view students in my courses?",
        roles: ["lecturer"],
        summary: "Open the student list to review learners associated with courses you teach.",
        steps: [
            "Choose Students in the sidebar or open Students from a course section.",
            "Select or open the relevant course if prompted.",
            "Use the available student details to identify learners enrolled in the course."
        ],
        result: "The list is limited to student/course information your lecturer account is authorized to access.",
        troubleshooting: "If a student is missing, confirm the learner has completed enrollment in your course."
    },
    {
        id: "calendar",
        category: "Calendar",
        title: "How do I use the course calendar?",
        roles: ["student", "lecturer"],
        summary: "Review course events and due dates. Lecturers can add course events.",
        steps: [
            "Choose Calendar in the sidebar to review events available to your account.",
            "Open a course calendar when you need to focus on one course.",
            "Lecturers can use the course calendar's add-event action to enter event details and save the event."
        ],
        result: "Events are displayed for courses available to your account. Students can review events; lecturers can create course events.",
        troubleshooting: "If an event is missing, check the course calendar and confirm you have access to that course."
    },
    {
        id: "announcements-student",
        category: "Announcements",
        title: "How do I read course announcements?",
        roles: ["student"],
        summary: "View course updates and interact with announcements when those actions are available.",
        steps: [
            "Choose Announcements in the sidebar.",
            "Find the course announcement you want to read and open it.",
            "Review the full message and any attached course context.",
            "Use the available reaction or reply controls if they are shown for that announcement."
        ],
        result: "You can see announcements available to your enrolled courses.",
        troubleshooting: "If you cannot find a course update, confirm that you are enrolled in the course and check with its lecturer."
    },
    {
        id: "announcements-lecturer",
        category: "Announcements",
        title: "How do I post a course announcement?",
        roles: ["lecturer"],
        summary: "Share an update with a course or use the broadcast option when available.",
        steps: [
            "Open Announcements or the Announcements section inside a course.",
            "Choose the create-announcement action and select the course when prompted.",
            "Enter the announcement title and message, then submit.",
            "Use the broadcast action only when you intend to share an update across the courses offered by that workflow."
        ],
        result: "The announcement appears for the audience selected by the announcement workflow.",
        troubleshooting: "Confirm the course selection and required title/message. If the option is unavailable, check that you are signed in as a lecturer with access to the course."
    },
    {
        id: "messages-student",
        category: "Messages",
        title: "How do I message my course lecturer?",
        roles: ["student"],
        summary: "Open course messages to contact a lecturer about course work.",
        steps: [
            "Open Messages from the student workspace or the relevant course.",
            "Choose the course and lecturer conversation.",
            "Read the conversation, enter your message, and send it.",
            "Return to the conversation to read the lecturer's reply."
        ],
        result: "Your message is associated with the selected course conversation.",
        troubleshooting: "If no conversation is available, check your course enrollment or use the lecturer-message option from the course if present."
    },
    {
        id: "settings",
        category: "Settings",
        title: "How do I update my profile and preferences?",
        roles: ["student", "lecturer"],
        summary: "Manage account information, security, display preferences, and role-specific course settings.",
        steps: [
            "Choose Settings in the sidebar.",
            "Open Profile to update your personal information or profile picture.",
            "Open Security to change a password when password login is enabled.",
            "Open Preferences to adjust theme, text size, reduced motion, default page, and notification badge.",
            "Lecturers can also open Course settings to manage the courses they teach."
        ],
        result: "Profile and display changes are saved for your account. Course settings apply to the selected course.",
        troubleshooting: "Some profile fields and course settings differ by role. If an option is missing, check that it is available to your role and login method."
    },
    {
        id: "assignment-status",
        category: "Assignments",
        title: "How do I check assignment status?",
        roles: ["student"],
        summary: "Review assigned, missing, and completed coursework in one place.",
        steps: [
            "Open Assignments from the sidebar.",
            "Choose Assigned, Missing, or Done to filter your coursework.",
            "Open an assignment card to review its instructions, due date, and submission details."
        ],
        result: "Assignment status is based on whether the deadline has passed and whether you have submitted the work.",
        troubleshooting: "If an assignment is missing, check its due date or contact your lecturer."
    }
];

const HelpFeedback = () => {
    const { user } = useAuth();
    const [search, setSearch] = useState("");
    const [activeCategory, setActiveCategory] = useState("All topics");
    const [selectedArticle, setSelectedArticle] = useState(null);
    const [activeTab, setActiveTab] = useState("help");
    const [rating, setRating] = useState(0);
    const [comment, setComment] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [status, setStatus] = useState(null);
    const [helpfulness, setHelpfulness] = useState(null);
    const tabButtons = useRef({});
    const role = user?.role === "lecturer" ? "lecturer" : user?.role === "student" ? "student" : null;

    const articles = useMemo(() => helpArticles.filter((article) => article.roles.includes(role)), [role]);
    const categories = useMemo(() => ["All topics", ...new Set(articles.map((article) => article.category))], [articles]);
    const visibleArticles = useMemo(() => {
        const query = search.trim().toLowerCase();
        return articles.filter((article) => {
            const inCategory = activeCategory === "All topics" || article.category === activeCategory;
            const searchableText = `${article.title} ${article.summary} ${article.steps.join(" ")} ${article.troubleshooting}`.toLowerCase();
            return inCategory && (!query || searchableText.includes(query));
        });
    }, [activeCategory, articles, search]);

    const openArticle = (article) => {
        setSelectedArticle(article);
        setHelpfulness(null);
        setStatus(null);
    };

    const startFeedback = () => {
        setSelectedArticle(null);
        setActiveTab("feedback");
        setRating(0);
        setComment("");
        setStatus(null);
    };

    const selectTab = (tab) => {
        if (tab === "feedback") {
            startFeedback();
        } else {
            setActiveTab("help");
            setStatus(null);
        }
    };

    const handleTabKeyDown = (event) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const nextTab = event.key === "Home" ? "help"
            : event.key === "End" ? "feedback"
                : event.key === "ArrowRight"
                    ? activeTab === "help" ? "feedback" : "help"
                    : activeTab === "help" ? "feedback" : "help";
        selectTab(nextTab);
        tabButtons.current[nextTab]?.focus();
    };

    const submitResponse = async ({ type, selectedRating, text, topic, helpful }) => {
        setSubmitting(true);
        setStatus(null);
        try {
            await API.post("/feedback", {
                type,
                rating: selectedRating,
                comment: text || undefined,
                topic: topic || undefined,
                helpful
            });
            setStatus({
                type: "success",
                text: type === "helpfulness"
                    ? "Thanks. Your help-center rating has been recorded."
                    : "Your feedback was delivered to the developer's private email."
            });
            return true;
        } catch (error) {
            setStatus({
                type: "error",
                text: error.response?.data?.message || "Unable to submit your feedback. Check your connection and try again."
            });
            return false;
        } finally {
            setSubmitting(false);
        }
    };

    const submitProductFeedback = async (event) => {
        event.preventDefault();
        const submitted = await submitResponse({
            type: "product",
            selectedRating: rating,
            text: comment.trim()
        });
        if (submitted) {
            setRating(0);
            setComment("");
        }
    };

    const submitHelpfulness = async (answer) => {
        const helpful = answer === "yes";
        const submitted = await submitResponse({
            type: "helpfulness",
            selectedRating: helpful ? 5 : 1,
            topic: selectedArticle.id,
            helpful
        });
        if (submitted) setHelpfulness(answer);
    };

    return (
        <div className="page-content help-feedback-page">
            <header className="help-feedback-header">
                <div>
                    <p className="eyebrow">SMARTCAMPUS SUPPORT</p>
                    <h1>Help &amp; Feedback</h1>
                    <p className="subtitle">Search step-by-step guides for your {role || "SmartCampus"} account, or send feedback directly to the developer's private email.</p>
                </div>
                {role && <span className="help-feedback-role">{role}</span>}
            </header>

            <div className="help-feedback-tabs" role="tablist" aria-label="Help and feedback">
                <button ref={(node) => { tabButtons.current.help = node; }} id="help-center-tab" type="button" role="tab" aria-controls="help-center-panel" aria-selected={activeTab === "help"} tabIndex={activeTab === "help" ? 0 : -1} className={activeTab === "help" ? "tab active" : "tab"} onClick={() => selectTab("help")} onKeyDown={handleTabKeyDown}>
                    Help center
                </button>
                <button ref={(node) => { tabButtons.current.feedback = node; }} id="share-feedback-tab" type="button" role="tab" aria-controls="share-feedback-panel" aria-selected={activeTab === "feedback"} tabIndex={activeTab === "feedback" ? 0 : -1} className={activeTab === "feedback" ? "tab active" : "tab"} onClick={() => selectTab("feedback")} onKeyDown={handleTabKeyDown}>
                    Share feedback
                </button>
            </div>

            {activeTab === "help" && (
                <section id="help-center-panel" role="tabpanel" aria-labelledby="help-center-tab" className="help-center" aria-label="Help center">
                    {selectedArticle ? (
                        <article className="help-article">
                            <button type="button" className="help-back-button" onClick={() => { setSelectedArticle(null); setStatus(null); }}>
                                <FaArrowLeft aria-hidden="true" /> All help topics
                            </button>
                            <p className="eyebrow">{selectedArticle.category}</p>
                            <h2>{selectedArticle.title}</h2>
                            <p className="help-article-summary">{selectedArticle.summary}</p>
                            <div className="help-detail-block">
                                <h3>Before you start</h3>
                                <p>{role === "lecturer"
                                    ? "Sign in as a lecturer. Course actions are limited to courses you teach and permissions assigned to your account."
                                    : "Sign in as a student. Course content and activities require enrollment in the course."}</p>
                            </div>
                            <h3>How to do it</h3>
                            <ol>
                                {selectedArticle.steps.map((step) => <li key={step}>{step}</li>)}
                            </ol>
                            <div className="help-detail-block">
                                <h3>What to expect</h3>
                                <p>{selectedArticle.result}</p>
                            </div>
                            <div className="help-detail-block">
                                <h3>Troubleshooting</h3>
                                <p>{selectedArticle.troubleshooting}</p>
                            </div>
                            <div className="helpfulness-prompt">
                                <h3>Did this answer your question or help you?</h3>
                                <p>Your yes/no answer is recorded to improve the help articles. To send a private message, choose Share feedback.</p>
                                {helpfulness ? (
                                    <p role="status">Thanks for letting us know.</p>
                                ) : (
                                    <div className="helpfulness-actions">
                                        <button type="button" className="btn btn-inline" disabled={submitting} onClick={() => submitHelpfulness("yes")}>Yes, it helped</button>
                                        <button type="button" className="btn btn-inline btn-secondary" disabled={submitting} onClick={() => submitHelpfulness("no")}>No, find another answer</button>
                                    </div>
                                )}
                                {helpfulness === "no" && (
                                    <div className="help-next-steps">
                                        <p>Try another guide or share feedback so we know what was missing.</p>
                                        <button type="button" className="btn btn-inline" onClick={startFeedback}>Share feedback</button>
                                    </div>
                                )}
                                {status && <p className={`help-status ${status.type}`} role={status.type === "error" ? "alert" : "status"}>{status.text}</p>}
                            </div>
                        </article>
                    ) : (
                        <>
                            <label className="help-search">
                                <FaSearch aria-hidden="true" />
                                <span className="sr-only">Search help topics</span>
                                <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search: modules, questions, tasks" />
                            </label>
                            <div className="help-category-list" aria-label="Help categories">
                                {categories.map((category) => (
                                    <button key={category} type="button" className={activeCategory === category ? "tab active" : "tab"} aria-pressed={activeCategory === category} onClick={() => setActiveCategory(category)}>
                                        {category}
                                    </button>
                                ))}
                            </div>
                            {visibleArticles.length ? (
                                <div className="help-article-grid">
                                    {visibleArticles.map((article) => (
                                        <button key={article.id} type="button" className="help-topic-card" onClick={() => openArticle(article)}>
                                            <span className="help-topic-icon"><FaBookOpen aria-hidden="true" /></span>
                                            <span className="help-topic-copy">
                                                <small>{article.category}</small>
                                                <strong>{article.title}</strong>
                                                <span>{article.summary}</span>
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="help-empty-state">
                                    <h2>No matching help topics</h2>
                                    <p>Try another search term or choose a different category. You can also share feedback if you need a guide that is not listed.</p>
                                    <button type="button" className="btn btn-inline" onClick={startFeedback}>Share feedback</button>
                                </div>
                            )}
                        </>
                    )}
                </section>
            )}

            {activeTab === "feedback" && (
                <section id="share-feedback-panel" role="tabpanel" aria-labelledby="share-feedback-tab" className="settings-section help-feedback-form-section" aria-label="Share feedback">
                    <div className="settings-section-heading">
                        <span className="settings-section-icon"><FaStar aria-hidden="true" /></span>
                        <div>
                            <h2>How is your SmartCampus experience?</h2>
                            <p>Your rating and message are emailed directly to the developer’s private email. If delivery is unavailable, you will see an error instead of a success message.</p>
                        </div>
                    </div>
                    {status?.type === "success" ? (
                        <div className="help-feedback-confirmation" role="status">
                            <h3>Feedback received</h3>
                            <p>{status.text}</p>
                            <button type="button" className="btn btn-inline" onClick={() => { setStatus(null); setActiveTab("help"); }}>Back to help center</button>
                        </div>
                    ) : (
                        <form className="help-feedback-form" onSubmit={submitProductFeedback}>
                            <fieldset className="help-rating-fieldset">
                                <legend>Choose a rating from 1 to 5 stars</legend>
                                <div className="help-rating-options">
                                    {[1, 2, 3, 4, 5].map((value) => (
                                        <button
                                            key={value}
                                            type="button"
                                            className={rating >= value ? "help-rating-star selected" : "help-rating-star"}
                                            aria-label={`${value} ${value === 1 ? "star" : "stars"}`}
                                            aria-pressed={rating === value}
                                            onClick={() => { setRating(value); setStatus(null); }}
                                        >
                                            <FaStar aria-hidden="true" />
                                        </button>
                                    ))}
                                    <span className="help-rating-label">{rating ? `${rating} out of 5` : "Select a rating"}</span>
                                </div>
                            </fieldset>
                            {rating > 0 && (
                                <label className="help-feedback-comment">
                                    {rating >= 4 ? "What is working well for you?" : rating === 3 ? "What could make your experience better?" : "What should we improve first?"}
                                    <textarea value={comment} onChange={(event) => { setComment(event.target.value); setStatus(null); }} maxLength={2000} rows={5} placeholder="Write your feedback message here..." required />
                                    <small>Your message is required. {comment.length}/2000</small>
                                </label>
                            )}
                            {status?.type === "error" && <p className="help-status error" role="alert">{status.text}</p>}
                            <div className="help-feedback-actions">
                                <button type="submit" className="btn btn-inline" disabled={rating === 0 || !comment.trim() || submitting}>{submitting ? "Sending..." : "Send feedback"}</button>
                            </div>
                        </form>
                    )}
                </section>
            )}
            <p className="help-feedback-footer"><Link to="/settings">Return to Settings</Link></p>
        </div>
    );
};

export default HelpFeedback;
