const path = require("path");
const os = require("os");

module.exports = path.resolve(
    process.env.UPLOADS_DIR ||
        (process.env.VERCEL ? path.join(os.tmpdir(), "smartcampus-uploads") : path.join(__dirname, "../../uploads"))
);
