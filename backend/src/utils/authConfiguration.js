const isValidJwtSecret = (secret) =>
    typeof secret === "string" &&
    secret.length >= 32 &&
    secret !== "change_this_to_a_long_random_secret";

module.exports = { isValidJwtSecret };
