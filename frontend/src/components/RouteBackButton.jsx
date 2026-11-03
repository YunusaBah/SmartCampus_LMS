import { useNavigate } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa";

const RouteBackButton = ({ fallbackTo = "/courses", label = "Back", className = "" }) => {
    const navigate = useNavigate();

    const goBack = () => {
        const historyIndex = window.history.state?.idx;
        navigate(Number.isInteger(historyIndex) && historyIndex > 0 ? -1 : fallbackTo);
    };

    return (
        <button type="button" className={className} onClick={goBack}>
            <FaArrowLeft aria-hidden="true" /> {label}
        </button>
    );
};

export default RouteBackButton;
