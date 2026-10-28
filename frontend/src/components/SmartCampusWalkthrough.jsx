import { useEffect, useState } from "react";

const walkthroughScenes = [
    {
        label: "Your courses",
        description: "See your courses and pick up where you left off."
    },
    {
        label: "Learning materials",
        description: "Find lecture notes, links, and resources in one place."
    },
    {
        label: "Assignments",
        description: "Keep track of upcoming work and due dates."
    },
    {
        label: "Your progress",
        description: "Follow course activity, grades, and learning progress."
    }
];

const SmartCampusWalkthrough = () => {
    const [activeScene, setActiveScene] = useState(0);
    const [isPlaying, setIsPlaying] = useState(
        () => !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );

    useEffect(() => {
        if (!isPlaying) return undefined;

        const timer = window.setInterval(() => {
            setActiveScene((scene) => (scene + 1) % walkthroughScenes.length);
        }, 3800);

        return () => window.clearInterval(timer);
    }, [isPlaying]);

    return (
        <aside className="login-walkthrough" aria-label="SmartCampus platform walkthrough">
            <div className="walkthrough-heading">
                <p className="login-eyebrow">A QUICK CAMPUS TOUR</p>
                <h2>See how SmartCampus works</h2>
            </div>
            <div className="walkthrough-phone">
                <div className="walkthrough-phone-frame">
                    <div className="walkthrough-phone-camera" aria-hidden="true" />
                    <div className="walkthrough-phone-screen" aria-hidden="true">
                        <div className="walkthrough-status-bar" aria-hidden="true">
                            <span>9:41</span>
                            <span>● ● ●</span>
                        </div>
                        <div className="walkthrough-app" key={activeScene}>
                            <header className="walkthrough-app-header">
                                <span className="walkthrough-app-mark">S</span>
                                <span>SmartCampus</span>
                                <span className="walkthrough-notification" aria-hidden="true">●</span>
                            </header>
                            {activeScene === 0 && (
                                <div className="walkthrough-content">
                                    <p className="walkthrough-greeting">Good morning, Awa 👋</p>
                                    <h3>Your courses</h3>
                                    <div className="walkthrough-course-card course-orange">
                                        <span>COMPUTING</span>
                                        <strong>Introduction to ICT</strong>
                                        <small>Week 4 · 3 new materials</small>
                                    </div>
                                    <div className="walkthrough-course-card course-blue">
                                        <span>MATHEMATICS</span>
                                        <strong>Discrete Mathematics</strong>
                                        <small>Next class · Today, 11:00</small>
                                    </div>
                                    <div className="walkthrough-mini-row">
                                        <span>Course activity</span><strong>View all →</strong>
                                    </div>
                                </div>
                            )}
                            {activeScene === 1 && (
                                <div className="walkthrough-content">
                                    <p className="walkthrough-back">‹ &nbsp; Introduction to ICT</p>
                                    <h3>Course materials</h3>
                                    <p className="walkthrough-muted">WEEK 4 · DIGITAL FOUNDATIONS</p>
                                    <div className="walkthrough-resource">
                                        <span className="resource-icon pdf-icon">PDF</span>
                                        <span><strong>Lecture notes</strong><small>Chapter 4 · 2.4 MB</small></span>
                                        <b>↓</b>
                                    </div>
                                    <div className="walkthrough-resource">
                                        <span className="resource-icon link-icon">↗</span>
                                        <span><strong>Useful learning links</strong><small>3 resources</small></span>
                                        <b>›</b>
                                    </div>
                                    <div className="walkthrough-notice">New material shared by your lecturer</div>
                                </div>
                            )}
                            {activeScene === 2 && (
                                <div className="walkthrough-content">
                                    <p className="walkthrough-muted">STAY ON TRACK</p>
                                    <h3>Upcoming work</h3>
                                    <div className="walkthrough-assignment">
                                        <span className="assignment-date"><strong>24</strong>OCT</span>
                                        <span><strong>ICT research task</strong><small>Introduction to ICT</small></span>
                                    </div>
                                    <div className="walkthrough-assignment">
                                        <span className="assignment-date date-purple"><strong>28</strong>OCT</span>
                                        <span><strong>Problem set 3</strong><small>Discrete Mathematics</small></span>
                                    </div>
                                    <div className="walkthrough-submit">
                                        <span>Quiz · Computer Systems</span>
                                        <strong>Start quiz&nbsp; →</strong>
                                    </div>
                                </div>
                            )}
                            {activeScene === 3 && (
                                <div className="walkthrough-content">
                                    <p className="walkthrough-muted">YOUR LEARNING JOURNEY</p>
                                    <h3>Course progress</h3>
                                    <div className="walkthrough-progress-card">
                                        <div><strong>Introduction to ICT</strong><b>72%</b></div>
                                        <span className="progress-track"><i style={{ width: "72%" }} /></span>
                                        <small>12 of 16 activities completed</small>
                                    </div>
                                    <div className="walkthrough-grade">
                                        <span className="grade-badge">A</span>
                                        <span><strong>Quiz 2 result</strong><small>Well done! Keep it up.</small></span>
                                        <b>88%</b>
                                    </div>
                                    <div className="walkthrough-mini-row">
                                        <span>View certificates</span><strong>→</strong>
                                    </div>
                                </div>
                            )}
                            <nav className="walkthrough-app-nav" aria-hidden="true">
                                <span className={activeScene === 0 ? "active" : ""}>⌂<small>Home</small></span>
                                <span className={activeScene === 1 ? "active" : ""}>▤<small>Courses</small></span>
                                <span className={activeScene === 2 ? "active" : ""}>◷<small>Tasks</small></span>
                                <span className={activeScene === 3 ? "active" : ""}>◉<small>Profile</small></span>
                            </nav>
                        </div>
                    </div>
                    <div className="walkthrough-phone-button" aria-hidden="true" />
                </div>
                <div className="walkthrough-caption" aria-live="polite">
                    <strong>{walkthroughScenes[activeScene].label}</strong>
                    <span>{walkthroughScenes[activeScene].description}</span>
                </div>
                <div className="walkthrough-controls">
                    <button
                        type="button"
                        className="walkthrough-play-button"
                        onClick={() => setIsPlaying((playing) => !playing)}
                        aria-label={isPlaying ? "Pause SmartCampus walkthrough" : "Play SmartCampus walkthrough"}
                    >
                        {isPlaying ? "Pause tour" : "Play tour"}
                    </button>
                    <div className="walkthrough-dots" aria-label="Choose a walkthrough scene">
                        {walkthroughScenes.map((scene, index) => (
                            <button
                                key={scene.label}
                                type="button"
                                className={index === activeScene ? "active" : ""}
                                onClick={() => setActiveScene(index)}
                                aria-label={`Show ${scene.label.toLowerCase()}`}
                                aria-current={index === activeScene ? "step" : undefined}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </aside>
    );
};

export default SmartCampusWalkthrough;
