import { useState } from "react";
import { FaSearch } from "react-icons/fa";

const dateLabel = (value) => value ? new Date(value).toLocaleString() : "—";

const QuizGradingTables = ({ gradebook, courses }) => {
    const [search, setSearch] = useState("");
    const [courseFilter, setCourseFilter] = useState("all");
    const courseGradebooks = courses || [{
        title: gradebook?.course?.title || "Course",
        gradebook
    }];
    const quickQuizResults = courseGradebooks.flatMap((course) =>
        (course.gradebook?.students || []).flatMap((student) => (student.quizResults || []).map((result) => ({
            id: `${course.gradebook?.course?.id || course.title}-${result.id}`,
            courseId: course.courseId || course.gradebook?.course?.id,
            courseTitle: course.title,
            student,
            quiz: result.quiz,
            completedAt: result.createdAt,
            score: result.score > 0 ? "Correct" : "Incorrect",
            answer: result.selectedAnswer
        })))
    ).sort((left, right) => new Date(left.completedAt || 0).getTime() - new Date(right.completedAt || 0).getTime());
    const assessmentResults = courseGradebooks.flatMap((course) =>
        (course.gradebook?.students || []).flatMap((student) => (student.assessmentAttempts || [])
            .filter((attempt) => attempt.submittedAt)
            .map((attempt) => ({
                id: `${course.gradebook?.course?.id || course.title}-${attempt.id}`,
                courseId: course.courseId || course.gradebook?.course?.id,
                courseTitle: course.title,
                student,
                assessment: attempt.assessment,
                completedAt: attempt.submittedAt,
                score: `${attempt.score}/${attempt.totalMarks ?? attempt.totalQuestions}`,
                theoryPending: attempt.theoryPending,
                percentage: attempt.totalMarks
                    ? Math.round(attempt.score * 100 / attempt.totalMarks)
                    : 0
            })))
    ).sort((left, right) => new Date(left.completedAt || 0).getTime() - new Date(right.completedAt || 0).getTime());
    const filterResults = (result) => {
        const query = search.trim().toLowerCase();
        return (courseFilter === "all" || String(result.courseId) === courseFilter) &&
            (!query || `${result.quiz?.question || result.assessment?.title || ""} ${result.courseTitle} ${result.student?.fullName || ""} ${result.student?.matNumber || ""} ${result.student?.email || ""} ${result.answer || ""}`
                .toLowerCase().includes(query));
    };
    const visibleQuickQuizResults = quickQuizResults.filter(filterResults);
    const visibleAssessmentResults = assessmentResults.filter(filterResults);

    return (
        <section className="quiz-grading-section">
            <h2>Quizzes and timed assessments</h2>
            <div className="materials-controls">
                <label className="catalog-search">
                    <FaSearch aria-hidden="true" />
                    <span className="sr-only">Search quiz submissions</span>
                    <input type="search" placeholder="Search: student, course, answer" value={search} onChange={(event) => setSearch(event.target.value)} />
                </label>
                {courseGradebooks.length > 1 && <label className="materials-course-filter">
                    <span>Course</span>
                    <select value={courseFilter} onChange={(event) => setCourseFilter(event.target.value)}>
                        <option value="all">All courses</option>
                        {courseGradebooks.map((course) => (
                            <option key={course.courseId || course.gradebook?.course?.id || course.title} value={String(course.courseId || course.gradebook?.course?.id || "")}>
                                {course.title}
                            </option>
                        ))}
                    </select>
                </label>}
            </div>
            <section className="quiz-grading-table-section">
                <h3>Quiz submissions</h3>
                {!visibleQuickQuizResults.length ? (
                    <p className="empty-state">{quickQuizResults.length ? "No quiz submissions match your filters." : "No classwork submissions yet."}</p>
                ) : (
                    <div className="grading-table-scroll">
                        <table className="grading-table quiz-grading-table">
                            <thead>
                                <tr>
                                    <th scope="col">Quiz question</th>
                                    <th scope="col">Course</th>
                                    <th scope="col">Student</th>
                                    <th scope="col">Submitted</th>
                                    <th scope="col">Answer</th>
                                    <th scope="col">Auto grade</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visibleQuickQuizResults.map((result) => (
                                    <tr key={result.id}>
                                        <td>{result.quiz?.question || "Quiz question"}</td>
                                        <td>{result.courseTitle}</td>
                                        <td>
                                            <strong>{result.student.fullName}</strong>
                                            <span className="records-table-secondary">Mat. no. {result.student.matNumber || "Not provided"}</span>
                                            <span className="records-table-secondary">{result.student.email}</span>
                                        </td>
                                        <td>{dateLabel(result.completedAt)}</td>
                                        <td>{result.answer}</td>
                                        <td><span className="grading-status graded">{result.score} ({result.score === "Correct" ? "100%" : "0%"})</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            <section className="quiz-grading-table-section">
                <h3>Assessment results</h3>
                {!visibleAssessmentResults.length ? (
                    <p className="empty-state">{assessmentResults.length ? "No timed test submissions match your filters." : "No completed timed tests yet."}</p>
                ) : (
                    <div className="grading-table-scroll">
                        <table className="grading-table quiz-grading-table">
                            <thead>
                                <tr>
                                    <th scope="col">Assessment</th>
                                    <th scope="col">Course</th>
                                    <th scope="col">Student</th>
                                    <th scope="col">Submitted</th>
                                    <th scope="col">Score</th>
                                    <th scope="col">Auto grade</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visibleAssessmentResults.map((result) => (
                                    <tr key={result.id}>
                                        <td>{result.assessment?.title || "Timed assessment"}</td>
                                        <td>{result.courseTitle}</td>
                                        <td>
                                            <strong>{result.student.fullName}</strong>
                                            <span className="records-table-secondary">Mat. no. {result.student.matNumber || "Not provided"}</span>
                                            <span className="records-table-secondary">{result.student.email}</span>
                                        </td>
                                        <td>{dateLabel(result.completedAt)}</td>
                                        <td>{result.score} {result.theoryPending ? "(provisional)" : `(${result.percentage}%)`}</td>
                                        <td><span className={result.theoryPending ? "grading-status pending" : "grading-status graded"}>
                                            {result.theoryPending ? "Theory marking pending" : "Graded"}
                                        </span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </section>
    );
};

export default QuizGradingTables;
