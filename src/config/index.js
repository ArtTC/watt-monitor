
const fs = require("node:fs");
const path = require("node:path");

const ROOT_DIR = path.resolve(__dirname, "..", "..");

// Caminho do banco de dados
const DATABASE_PATH =
    process.env.DATABASE_PATH ||
    path.join(ROOT_DIR, "medidor_solar.db");

// Cria automaticamente o diretório do banco, caso não exista
fs.mkdirSync(path.dirname(DATABASE_PATH), {
    recursive: true
});

module.exports = {
    ROOT_DIR,

    PORT: Number(process.env.PORT) || 3000,

    SESSION_DURATION_MS:
        Number(process.env.SESSION_DURATION_MS) ||
        12 * 60 * 60 * 1000,

    DATABASE_PATH,

    PUBLIC_DIR: path.join(ROOT_DIR, "public")
};
