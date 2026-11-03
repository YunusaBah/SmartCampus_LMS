const nodemailer = require("nodemailer");

const createTransport = () => {
    const host = process.env.SMTP_HOST?.trim();
    const port = Number(process.env.SMTP_PORT || 587);
    const user = process.env.SMTP_USER?.trim();
    const password = process.env.SMTP_PASSWORD;
    const from = process.env.SMTP_FROM?.trim() || user;

    const missingSettings = [];
    if (!host) missingSettings.push("SMTP_HOST");
    if (!Number.isInteger(port) || port < 1 || port > 65535) missingSettings.push("SMTP_PORT");
    if (!user) missingSettings.push("SMTP_USER");
    if (!password) missingSettings.push("SMTP_PASSWORD");
    if (!from) missingSettings.push("SMTP_FROM");

    if (missingSettings.length) {
        const error = new Error(`Email delivery is not configured. Missing settings: ${missingSettings.join(", ")}.`);
        error.code = "EMAIL_NOT_CONFIGURED";
        throw error;
    }

    return nodemailer.createTransport({
        host,
        port,
        secure: process.env.SMTP_SECURE === "true",
        auth: { user, pass: password }
    });
};

exports.sendAppEmail = async ({ to, subject, text, replyTo }) => {
    if (typeof to !== "string" || !to.trim()) {
        const error = new Error("Email recipient is not configured.");
        error.code = "EMAIL_NOT_CONFIGURED";
        throw error;
    }

    const transporter = createTransport();
    const from = process.env.SMTP_FROM?.trim() || process.env.SMTP_USER.trim();
    await transporter.sendMail({
        from: { name: "SmartCampus", address: from },
        to,
        replyTo: replyTo || undefined,
        subject,
        text
    });
};
