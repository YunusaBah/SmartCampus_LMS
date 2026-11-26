// Compatibility entrypoint for deployments that still discover the root
// catch-all function. Keep it aligned with the canonical backend service
// entrypoint so database initialization and runtime validation stay identical.
module.exports = require("../backend/src/vercel");
