const Feedback = require("../models/Feedback");
const emailService = require("../utils/emailService");

const mailFailure = (res, error, context) => {
    console.error(`${context} email failed:`, error.message);
    if (error.code === "EMAIL_NOT_CONFIGURED") {
        return res.status(503).json({ message: error.message });
    }
    return res.status(502).json({ message: "Your message could not be delivered. Please try again later." });
};

exports.createFeedback = async (req, res) => {
    const { type, rating, comment, topic, helpful } = req.body;

    if (!["product", "helpfulness"].includes(type)) {
        return res.status(400).json({ message: "Choose a valid feedback type." });
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        return res.status(400).json({ message: "Rating must be a whole number from 1 to 5." });
    }

    if (type === "product") {
        if (typeof comment !== "string" || !comment.trim() || comment.length > 2000) {
            return res.status(400).json({ message: "Write your feedback in 1 to 2000 characters." });
        }

        const cleanComment = comment.trim();
        try {
            await emailService.sendAppEmail({
                to: process.env.FEEDBACK_RECIPIENT_EMAIL || "bahy1878@gmail.com",
                subject: `SmartCampus feedback — ${rating}/5 stars`,
                text: [
                    `Rating: ${rating}/5 stars`,
                    `Role: ${req.user.role}`,
                    `User ID: ${req.user.id}`,
                    "",
                    cleanComment
                ].join("\n")
            });
        } catch (error) {
            return mailFailure(res, error, "Product feedback");
        }

        await Feedback.create({ userId: req.user.id, role: req.user.role, type, rating, comment: cleanComment });
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

exports.submitCollaboration = async (req, res) => {
    const { message, name, email } = req.body;
    if (typeof message !== "string" || !message.trim() || message.length > 5000) {
        return res.status(400).json({ message: "Write a message up to 5000 characters." });
    }
    if (name !== undefined && (typeof name !== "string" || name.trim().length > 120)) {
        return res.status(400).json({ message: "Name must be 120 characters or fewer." });
    }
    if (email !== undefined && (typeof email !== "string" || email.length > 254 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))) {
        return res.status(400).json({ message: "Enter a valid reply email address." });
    }

    const cleanName = typeof name === "string" ? name.trim() : "";
    const cleanEmail = typeof email === "string" ? email.trim() : "";
    try {
        await emailService.sendAppEmail({
            to: process.env.COLLABORATION_RECIPIENT_EMAIL || "yb22423255@utg.edu.gm",
            subject: "SmartCampus collaboration message",
            replyTo: cleanEmail || undefined,
            text: [
                `Name: ${cleanName || "Not provided"}`,
                `Reply email: ${cleanEmail || "Not provided"}`,
                "",
                message.trim()
            ].join("\n")
        });
    } catch (error) {
        return mailFailure(res, error, "Collaboration message");
    }

    return res.status(201).json({ message: "Your collaboration message has been sent." });
};
