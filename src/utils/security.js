const {
    randomBytes,
    createHash,
    scryptSync,
    timingSafeEqual
} = require("node:crypto");

function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
}

function normalizeMac(mac) {
    return String(mac || "").trim().toUpperCase();
}

function isValidMac(mac) {
    return /^(?:[0-9A-F]{2}:){5}[0-9A-F]{2}$/.test(mac);
}

function createPasswordHash(password, salt = randomBytes(16).toString("hex")) {
    return {
        salt,
        hash: scryptSync(password, salt, 64).toString("hex")
    };
}

function verifyPassword(password, salt, savedHash) {
    const calculated = scryptSync(password, salt, 64);
    const original = Buffer.from(savedHash, "hex");
    return original.length === calculated.length && timingSafeEqual(original, calculated);
}

function hashToken(token) {
    return createHash("sha256").update(token).digest("hex");
}

function createToken() {
    return randomBytes(32).toString("hex");
}

module.exports = {
    normalizeEmail,
    normalizeMac,
    isValidMac,
    createPasswordHash,
    verifyPassword,
    hashToken,
    createToken
};
