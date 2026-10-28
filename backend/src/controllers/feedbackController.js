const Feedback = require("../models/Feedback");

exports.createFeedback = async (req, res) => {
    const { type, rating, comment, topic, helpful } = req.body;

    if (!["product", "helpfulness"].includes(type)) {
        return res.status(400).json({ message: "Choose a valid feedback type." });
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        return res.status(400).json({ message: "Rating must be a whole number from 1 to 5." });
    }

    if (type === "product") {
        if (comment !== undefined && (typeof comment !== "string" || comment.length > 2000)) {
            return res.status(400).json({ message: "Feedback must be 2000 characters or fewer." });
        }

        await Feedback.create({
            userId: req.user.id,
            role: req.user.role,
            type,
            rating,
            comment: typeof comment === "string" ? comment.trim() || null : null
        });
    } else {
        if (typeof helpful !== "boolean" || !helpful && rating !== 1 || helpful && rating !== 5) {
            return res.status(400).json({ message: "Choose whether the help article was useful." });
        }
        if (typeof topic !== "string" || !topic.trim() || topic.length > 120) {
            return res.status(400).json({ message: "A valid help topic is required." });
        }

        await Feedback.create({
            userId: req.user.id,
            role: req.user.role,
            type,
            rating,
            topic: topic.trim(),
            helpful
        });
    }

    return res.status(201).json({ message: "Feedback submitted successfully." });
};
