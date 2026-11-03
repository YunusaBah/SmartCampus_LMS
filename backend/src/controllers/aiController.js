require("../config/env");

exports.askAI = async (req, res) => {
    try {
        const { message, context } = req.body;
        if (typeof message !== "string" || !message.trim() || message.length > 4000) {
            return res.status(400).json({ message: "Enter a message of at most 4,000 characters" });
        }

        if (!process.env.OPENAI_API_KEY ||
            process.env.OPENAI_API_KEY === "your_openai_api_key") {
            return res.status(503).json({ message: "The AI assistant is not configured" });
        }

        const courseName = typeof context?.courseName === "string"
            ? context.courseName.slice(0, 200)
            : "";
        const lessonContent = typeof context?.lessonContent === "string"
            ? context.lessonContent.slice(0, 12000)
            : "";
        const isStaff = req.user.role === "lecturer";

        const systemPrompt = isStaff
            ? `You are an AI assistant for lecturers on SmartCampus LMS.
You help lecturers create educational quiz questions for their courses.
Course: "${courseName || "General"}"
Materials: "${lessonContent || "None provided"}"

When generating quiz questions, use this exact format:
QUESTION: [question text]
A: [option A]
B: [option B]
C: [option C]
D: [option D]
ANSWER: [correct letter]

Generate clear educational questions based only on the course materials.`
            : `You are an AI learning assistant for students on SmartCampus LMS.
The student is studying: "${courseName || "their course"}".
Course material available: "${lessonContent || "No materials uploaded yet"}".

STRICT RULES:
1. Only help students understand the course material above.
2. NEVER give direct answers to quiz questions or assignments.
3. If asked for quiz/assignment answers say: "I can't give you the answer directly, but let me explain the concept so you can work it out."
4. Guide with explanations and hints only.
5. If question is unrelated to course material say: "I can only help with topics from this course."
Be friendly, clear and educational.`;

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                max_tokens: 1024,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: message.trim() }
                ]
            }),
            redirect: "error",
            signal: AbortSignal.timeout(30000)
        });

        if (!response.ok) {
            console.error(`OpenAI request failed with status ${response.status}`);
            const message = response.status === 401
                ? "OpenAI rejected the API key. Check OPENAI_API_KEY in backend/.env and restart the backend."
                : response.status === 403
                    ? "The OpenAI project or key does not have access to the requested model."
                    : response.status === 429
                        ? "OpenAI quota or rate limit reached. Check the project's billing and usage."
                        : response.status === 404
                            ? "The configured OpenAI model is unavailable to this project."
                            : "The AI assistant could not respond";
            return res.status(response.status === 429 ? 503 : 502).json({
                message
            });
        }

        const result = await response.json();
        const reply = result.choices?.[0]?.message?.content;
        if (!reply) {
            console.error("OpenAI returned no text response");
            return res.status(502).json({ message: "The AI assistant returned an empty response" });
        }
        res.json({ reply });
    } catch (error) {
        console.error("OpenAI request failed:", error.message);
        res.status(502).json({ message: "The AI assistant could not respond" });
    }
};