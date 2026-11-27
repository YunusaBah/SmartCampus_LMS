const { argon2, timingSafeEqual } = require("node:crypto");

const decodePhcBase64 = (value) => {
    if (typeof value !== "string" || !/^[A-Za-z0-9+/]+$/.test(value)) return null;
    const decoded = Buffer.from(value, "base64");
    if (decoded.length === 0 || decoded.toString("base64").replace(/=+$/, "") !== value) return null;
    return decoded;
};

const parseArgon2idHash = (encoded) => {
    if (typeof encoded !== "string" || encoded.length > 512) return null;
    const parts = encoded.split("$");
    if (parts.length !== 6 || parts[1] !== "argon2id" || parts[2] !== "v=19") return null;

    const parameters = {};
    for (const entry of parts[3].split(",")) {
        const match = /^(m|t|p)=(\d+)$/.exec(entry);
        if (!match || Object.prototype.hasOwnProperty.call(parameters, match[1])) return null;
        parameters[match[1]] = Number(match[2]);
    }

    const memory = parameters.m;
    const passes = parameters.t;
    const parallelism = parameters.p;
    const salt = decodePhcBase64(parts[4]);
    const expected = decodePhcBase64(parts[5]);

    if (!Number.isSafeInteger(memory) || memory < 8 || memory > 131072 ||
        !Number.isSafeInteger(passes) || passes < 1 || passes > 6 ||
        !Number.isSafeInteger(parallelism) || parallelism < 1 || parallelism > 4 ||
        memory < parallelism * 8 ||
        !salt || salt.length < 8 || salt.length > 64 ||
        !expected || expected.length < 16 || expected.length > 64) {
        return null;
    }

    return { memory, passes, parallelism, salt, expected };
};

const verifyArgon2idPassword = async (password, encoded) => {
    if (typeof password !== "string" || typeof argon2 !== "function") return false;
    const parsed = parseArgon2idHash(encoded);
    if (!parsed) return false;

    const actual = await new Promise((resolve, reject) => {
        argon2("argon2id", {
            message: Buffer.from(password, "utf8"),
            nonce: parsed.salt,
            memory: parsed.memory,
            passes: parsed.passes,
            parallelism: parsed.parallelism,
            tagLength: parsed.expected.length
        }, (error, derivedKey) => {
            if (error) reject(error);
            else resolve(derivedKey);
        });
    });

    return actual.length === parsed.expected.length && timingSafeEqual(actual, parsed.expected);
};

const isArgon2Hash = (encoded) => typeof encoded === "string" && encoded.startsWith("$argon2");

module.exports = { isArgon2Hash, parseArgon2idHash, verifyArgon2idPassword };
