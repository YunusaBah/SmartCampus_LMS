import { useEffect, useState } from "react";
import { FaAward, FaBookOpen } from "react-icons/fa";
import API from "../services/api";
import useOfflineRefresh from "../hooks/useOfflineRefresh";

const Certificates = () => {
    const offlineRefresh = useOfflineRefresh();
    const [certificates, setCertificates] = useState([]);
    const [courses, setCourses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busyCourse, setBusyCourse] = useState(null);
    const [error, setError] = useState("");
    const [status, setStatus] = useState("");

    useEffect(() => {
        let active = true;
        Promise.all([API.get("/certificates"), API.get("/enrollments/my-courses")])
            .then(([certificateResponse, courseResponse]) => {
                if (!active) return;
                setCertificates(certificateResponse.data);
                setCourses(courseResponse.data.map((enrollment) => enrollment.course).filter(Boolean));
            })
            .catch((requestError) => {
                if (active) setError(requestError.response?.data?.message || "Unable to load certificates.");
            })
            .finally(() => {
                if (active) setLoading(false);
            });
        return () => { active = false; };
    }, [offlineRefresh]);

    const requestCertificate = async (courseId) => {
        setBusyCourse(courseId);
        setStatus("");
        try {
            const response = await API.post(`/courses/${courseId}/certificate`);
            setCertificates((current) => current.some((certificate) => certificate.id === response.data.id)
                ? current
                : [response.data, ...current]);
            setStatus("Certificate issued successfully.");
        } catch (requestError) {
            setStatus(requestError.response?.data?.message || "Unable to issue a certificate.");
        } finally {
            setBusyCourse(null);
        }
    };

    const issuedCourseIds = new Set(certificates.map((certificate) => certificate.courseId));

    return (
        <div className="page-content feature-page">
            <header className="feature-page-header">
                <div><p className="eyebrow">YOUR ACHIEVEMENTS</p><h1>Certificates</h1></div>
            </header>
            {status && <p className="feature-status" role="status">{status}</p>}
            {loading ? <p className="dashboard-loading" role="status">Loading certificates...</p> : error ? (
                <div className="dashboard-alert" role="alert">{error}</div>
            ) : (
                <>
                    <section className="certificate-section">
                        <div className="section-heading"><div><p className="eyebrow">AWARDED</p><h2>My certificates</h2></div><span className="grades-section-count">{certificates.length}</span></div>
                        {certificates.length ? <div className="certificate-grid">
                            {certificates.map((certificate) => (
                                <article className="certificate-card" key={certificate.id}>
                                    <FaAward aria-hidden="true" />
                                    <div><span>SMARTCAMPUS CERTIFICATE</span><h3>{certificate.course?.title || "Course completion"}</h3><p>Issued {new Date(certificate.issuedAt).toLocaleDateString()}</p><code>{certificate.certificateCode}</code></div>
                                </article>
                            ))}
                        </div> : <div className="feature-empty"><FaAward /><strong>No certificates issued yet</strong><span>Complete all lessons to earn a certificate.</span></div>}
                    </section>
                    <section className="certificate-section">
                        <div className="section-heading"><div><p className="eyebrow">COURSE COMPLETION</p><h2>My courses</h2></div></div>
                        {courses.length ? <div className="certificate-course-list">
                            {courses.map((course) => (
                                <article className="certificate-course" key={course.id}>
                                    <span className="course-list-icon"><FaBookOpen /></span>
                                    <div><strong>{course.title}</strong><span>Complete all lessons to check eligibility.</span></div>
                                    {issuedCourseIds.has(course.id) ? <span className="enrolled-badge">Issued</span> : (
                                        <button type="button" className="btn btn-inline" disabled={busyCourse === course.id} onClick={() => requestCertificate(course.id)}>
                                            {busyCourse === course.id ? "Checking..." : "Check eligibility"}
                                        </button>
                                    )}
                                </article>
                            ))}
                        </div> : <p className="feature-empty">No courses available.</p>}
                    </section>
                </>
            )}
        </div>
    );
};

export default Certificates;
