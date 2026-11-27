process.env.DB_HOST = "127.0.0.1";
process.env.DB_NAME = "test";
process.env.DB_USER = "test";
process.env.DB_PASSWORD = "test";

const { afterEach, test } = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcrypt");
const { argon2, randomBytes } = require("node:crypto");
const User = require("../src/models/User");
const authController = require("../src/controllers/authController");

const originalFindOne = User.findOne;
const originalFindByPk = User.findByPk;
const originalCreate = User.create;
const originalJwtSecret = process.env.JWT_SECRET;
const originalGoogleClientId = process.env.GOOGLE_CLIENT_ID;
const originalFetch = global.fetch;
const testJwtSecret = "test-jwt-secret-for-account-registration";
process.env.JWT_SECRET = testJwtSecret;

afterEach(() => {
    User.findOne = originalFindOne;
    User.findByPk = originalFindByPk;
    User.create = originalCreate;
    global.fetch = originalFetch;
    // Each test below issues a token; restore the safe test secret after
    // the insecure-secret case instead of leaving later tests misconfigured.
    process.env.JWT_SECRET = testJwtSecret;
    if (originalGoogleClientId === undefined) {
        delete process.env.GOOGLE_CLIENT_ID;
    } else {
        process.env.GOOGLE_CLIENT_ID = originalGoogleClientId;
    }
});

const createResponse = () => ({
    statusCode: 200,
    headers: {},
    body: null,
    status(code) {
        this.statusCode = code;
        return this;
    },
    set(name, value) {
        this.headers[name] = value;
        return this;
    },
    json(body) {
        this.body = body;
        return this;
    }
});

test("public auth config returns only the Google OAuth client ID", () => {
    process.env.GOOGLE_CLIENT_ID = "public-google-client-id";
    const response = createResponse();

    authController.getAuthConfig({}, response);

    assert.equal(response.headers["Cache-Control"], "no-store");
    assert.deepEqual(response.body, { googleClientId: "public-google-client-id" });
});

test("public auth config reports when Google sign-in is not configured", () => {
    delete process.env.GOOGLE_CLIENT_ID;
    const response = createResponse();

    authController.getAuthConfig({}, response);

    assert.deepEqual(response.body, { googleClientId: null });
});

test("logout revokes the user's session", async () => {
    let incrementedField;
    User.findByPk = async (id) => {
        assert.equal(id, 21);
        return {
            increment: async (field) => {
                incrementedField = field;
            }
        };
    };

    const response = createResponse();
    await authController.logout({ user: { id: 21 } }, response);

    assert.equal(incrementedField, "tokenVersion");
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body, { message: "Logged out successfully" });
});

test("logout reports when the user no longer exists", async () => {
    User.findByPk = async () => null;
    const response = createResponse();

    await authController.logout({ user: { id: 21 } }, response);

    assert.equal(response.statusCode, 401);
    assert.deepEqual(response.body, { message: "User no longer exists" });
});

test("email registration creates a student account without requiring a phone number", async () => {
    let createdUser;
    User.findOne = async ({ where }) => {
        assert.deepEqual(where, { email: "student@example.edu" });
        return null;
    };
    User.create = async (values) => {
        createdUser = values;
        return {
            id: 21,
            tokenVersion: 0,
            ...values,
            toJSON() {
                return { ...this };
            }
        };
    };

    const response = createResponse();
    await authController.register({
        body: {
            fullName: "Student Example",
            email: "Student@Example.edu",
            password: "student-password",
            confirmPassword: "student-password",
            role: "student",
            matNumber: "STU-2026"
        }
    }, response);

    assert.equal(response.statusCode, 201);
    assert.equal(response.headers["Cache-Control"], "no-store");
    assert.equal(createdUser.fullName, "Student Example");
    assert.equal(createdUser.email, "student@example.edu");
    assert.equal(createdUser.role, "student");
    assert.equal(createdUser.matNumber, "STU-2026");
    assert.equal(createdUser.phone, null);
    assert.equal(createdUser.passwordLoginEnabled, true);
    assert.equal(await bcrypt.compare("student-password", createdUser.password), true);
    assert.equal(response.body.user.phone, null);
    assert.ok(response.body.token);
});

test("email registration refuses public lecturer account creation", async () => {
    User.findOne = async () => assert.fail("Lecturer self-registration must be rejected before database lookup");
    User.create = async () => assert.fail("Lecturer self-registration must not create an account");
    const response = createResponse();

    await authController.register({
        body: {
            fullName: "Lecturer Example",
            email: "lecturer@example.edu",
            password: "lecturer-password",
            confirmPassword: "lecturer-password",
            role: "lecturer"
        }
    }, response);

    assert.equal(response.statusCode, 403);
    assert.match(response.body.message, /provisioned by the university/i);
});
test("email registration rejects an email that already exists regardless of input casing", async () => {
    User.findOne = async ({ where }) => {
        assert.deepEqual(where, { email: "student@example.edu" });
        return { id: 22, email: "student@example.edu" };
    };
    User.create = async () => assert.fail("A duplicate email must not create another account");
    const response = createResponse();

    await authController.register({
        body: {
            fullName: "Another Student",
            email: " Student@Example.edu ",
            password: "student-password",
            confirmPassword: "student-password",
            role: "student",
            matNumber: "STU-2026"
        }
    }, response);

    assert.equal(response.statusCode, 409);
    assert.match(response.body.message, /email already exists/i);
});

test("email registration rejects mismatched password confirmation on the backend", async () => {
    User.findOne = async () => assert.fail("Mismatched passwords must be rejected before lookup");
    User.create = async () => assert.fail("Mismatched passwords must not create an account");
    const response = createResponse();

    await authController.register({
        body: {
            fullName: "Student Example",
            email: "student@example.edu",
            password: "student-password",
            confirmPassword: "different-password",
            role: "student",
            matNumber: "STU-2026"
        }
    }, response);

    assert.equal(response.statusCode, 400);
    assert.match(response.body.message, /passwords do not match/i);
});

test("password reset rejects mismatched password confirmation on the backend", async () => {
    User.findOne = async () => assert.fail("Mismatched passwords must be rejected before lookup");
    const response = createResponse();

    await authController.resetPassword({
        body: {
            token: "a".repeat(64),
            newPassword: "new-password",
            confirmPassword: "different-password"
        }
    }, response);

    assert.equal(response.statusCode, 400);
    assert.match(response.body.message, /passwords do not match/i);
});

test("password login refuses to issue a session with an insecure JWT secret", async () => {
    process.env.JWT_SECRET = "change_this_to_a_long_random_secret";
    const password = "account-password";
    const user = {
        id: 26,
        tokenVersion: 0,
        email: "student@example.edu",
        role: "student",
        passwordLoginEnabled: true,
        password: await bcrypt.hash(password, 10)
    };
    User.findOne = async () => user;
    const response = createResponse();

    await authController.login({
        body: { email: user.email, password }
    }, response);

    assert.equal(response.statusCode, 500);
    assert.equal(response.body.message, "Authentication is not configured");
    assert.equal(response.body.token, undefined);
});

test("Google registration refuses public lecturer account creation before credential exchange", async () => {
    global.fetch = async () => assert.fail("Lecturer self-registration must be rejected before calling Google");
    User.findOne = async () => assert.fail("Lecturer self-registration must be rejected before database lookup");
    User.create = async () => assert.fail("Lecturer self-registration must not create an account");
    const response = createResponse();

    await authController.googleRegister({
        body: { credential: "verified-test-credential", role: "lecturer" }
    }, response);

    assert.equal(response.statusCode, 403);
    assert.match(response.body.message, /provisioned by the university/i);
});

const createArgon2idHash = async (password) => {
    const salt = randomBytes(16);
    const parameters = { memory: 8192, passes: 1, parallelism: 1, tagLength: 32 };
    const tag = await new Promise((resolve, reject) => {
        argon2("argon2id", {
            message: Buffer.from(password, "utf8"),
            nonce: salt,
            ...parameters
        }, (error, derivedKey) => {
            if (error) reject(error);
            else resolve(derivedKey);
        });
    });
    const encode = (value) => value.toString("base64").replace(/=+$/, "");
    return `$argon2id$v=19$m=${parameters.memory},t=${parameters.passes},p=${parameters.parallelism}$${encode(salt)}$${encode(tag)}`;
};

test("Argon2id password login upgrades the verified hash to Bcrypt", async () => {
    const password = "legacy-argon-password";
    const originalHash = await createArgon2idHash(password);
    const user = {
        id: 27,
        tokenVersion: 0,
        fullName: "Legacy Lecturer",
        email: "legacy@example.edu",
        role: "lecturer",
        passwordLoginEnabled: true,
        password: originalHash,
        savedFields: null,
        async save(options) {
            this.savedFields = options.fields;
        },
        toJSON() {
            return { ...this };
        }
    };
    User.findOne = async ({ where }) => {
        assert.deepEqual(where, { email: user.email });
        return user;
    };

    const response = createResponse();
    await authController.login({
        body: { email: user.email, password }
    }, response);

    assert.equal(response.statusCode, 200);
    assert.deepEqual(user.savedFields, ["password"]);
    assert.notEqual(user.password, originalHash);
    assert.equal(await bcrypt.compare(password, user.password), true);
    assert.equal(response.body.user.password, undefined);
    assert.ok(response.body.token);
});

for (const role of ["student", "lecturer"]) {
    test(`password login accepts a registered ${role} account`, async () => {
        const password = "account-password";
        const user = {
            id: role === "student" ? 24 : 25,
            tokenVersion: 0,
            fullName: `${role} example`,
            email: `${role}@example.edu`,
            role,
            passwordLoginEnabled: true,
            password: await bcrypt.hash(password, 10),
            toJSON() {
                return { ...this };
            }
        };
        User.findOne = async ({ where }) => {
            assert.deepEqual(where, { email: user.email });
            return user;
        };

        const response = createResponse();
        await authController.login({
            body: { email: user.email, password }
        }, response);

        assert.equal(response.statusCode, 200);
        assert.equal(response.body.user.role, role);
        assert.ok(response.body.token);
    });
}

test("email registration requires a student matriculation number", async () => {
    User.findOne = async () => assert.fail("Invalid student details should be rejected before lookup");
    User.create = async () => assert.fail("Invalid student details must not create an account");

    const response = createResponse();
    await authController.register({
        body: {
            fullName: "Student Example",
            email: "student@example.edu",
            password: "student-password",
            confirmPassword: "student-password",
            role: "student"
        }
    }, response);

    assert.equal(response.statusCode, 400);
    assert.match(response.body.message, /student ID number/i);
});

test("email registration rejects an invalid phone number when one is provided", async () => {
    User.findOne = async () => assert.fail("Invalid phone should be rejected before lookup");
    User.create = async () => assert.fail("Invalid phone must not create an account");

    const response = createResponse();
    await authController.register({
        body: {
            fullName: "Student Example",
            email: "student@example.edu",
            password: "student-password",
            confirmPassword: "student-password",
            role: "student",
            matNumber: "STU-2026",
            phone: "not a phone"
        }
    }, response);

    assert.equal(response.statusCode, 400);
    assert.match(response.body.message, /valid phone number/i);
});
