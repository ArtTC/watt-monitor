const path = require("node:path");

const ROOT_DIR = path.resolve(__dirname, "..", "..");

module.exports = {
    ROOT_DIR,
    PORT: Number(process.env.PORT) || 3000,
    SESSION_DURATION_MS: 12 * 60 * 60 * 1000,
    DATABASE_PATH: process.env.DATABASE_PATH || path.join(ROOT_DIR, "medidor_solar.db"),
    PUBLIC_DIR: path.join(ROOT_DIR, "public")
};
