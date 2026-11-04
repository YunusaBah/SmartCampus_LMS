process.env.DB_HOST = "127.0.0.1";
process.env.DB_NAME = "test";
process.env.DB_USER = "test";
process.env.DB_PASSWORD = "test";

const { afterEach, test } = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcrypt");
const User = require("../src/models/User");
const authController = require("../src/controllers/authController");

const originalFindOne = User.findOne;
const originalFindByPk = User.findByPk;
const originalCreate = User.create;
const originalJwtSecret = process.env.JWT_SECRET;
const originalGoogleClientId = process.env.GOOGLE_CLIENT_ID;
const originalFetch = global.fetch;
process.env.JWT_SECRET = "test-jwt-secret-for-account-registration";

afterEach(() => {
    User.findOne = originalFindOne;
    User.findByPk = originalFindByPk;
    User.create = originalCreate;
    global.fetch = originalFetch;
    if (originalJwtSecret === undefined) {
        delete process.env.JWT_SECRET;
    } else {
        process.env.JWT_SECRET = originalJwtSecret;
    }
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

test("email registration creates lecturer accounts without student-only details", async () => {
    let createdUser;
    User.findOne = async ({ where }) => {
        assert.deepEqual(where, { email: "lecturer@example.edu" });
        return null;
    };
    User.create = async (values) => {
        createdUser = values;
        return {
            id: 22,
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
            fullName: "Lecturer Example",
            email: "lecturer@example.edu",
            password: "lecturer-password",
            confirmPassword: "lecturer-password",
            role: "lecturer"
        }
    }, response);

    assert.equal(response.statusCode, 201);
    assert.equal(createdUser.role, "lecturer");
    assert.equal(createdUser.matNumber, null);
    assert.equal(createdUser.phone, null);
    assert.equal(createdUser.passwordLoginEnabled, true);
    assert.equal(await bcrypt.compare("lecturer-password", createdUser.password), true);
    assert.ok(response.body.token);
});

test("email registration rejects an email that already exists regardless of input casing", async () => {
    User.findOne = async ({ where }) => {
        assert.deepEqual(where, { email: "lecturer@example.edu" });
        return { id: 22, email: "lecturer@example.edu" };
    };
    User.create = async () => assert.fail("A duplicate email must not create another account");
    const response = createResponse();

    await authController.register({
        body: {
            fullName: "Another Lecturer",
            email: " Lecturer@Example.edu ",
            password: "lecturer-password",
            confirmPassword: "lecturer-password",
            role: "lecturer"
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
            role: "lecturer"
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

test("Google registration creates lecturer accounts without student-only details", async () => {
    process.env.GOOGLE_CLIENT_ID = "test-google-client-id";
    global.fetch = async () => ({
        ok: true,
        json: async () => ({
            aud: "test-google-client-id",
            iss: "https://accounts.google.com",
            email_verified: true,
            exp: String(Math.floor(Date.now() / 1000) + 3600),
            sub: "google-lecturer-123",
            email: "lecturer@example.edu",
            name: "Lecturer Example"
        })
    });

    let createdUser;
    User.findOne = async ({ where }) => {
        assert.deepEqual(where, { email: "lecturer@example.edu" });
        return null;
    };
    User.create = async (values) => {
        createdUser = values;
        return {
            id: 23,
            tokenVersion: 0,
            ...values,
            toJSON() {
                return { ...this };
            }
        };
    };
    const response = createResponse();

    await authController.googleRegister({
        body: { credential: "verified-test-credential", role: "lecturer" }
    }, response);

    assert.equal(response.statusCode, 201);
    assert.equal(createdUser.role, "lecturer");
    assert.equal(createdUser.matNumber, null);
    assert.equal(createdUser.phone, null);
    assert.equal(createdUser.passwordLoginEnabled, false);
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
