
const express = require("express");
const cors = require("cors");

const { PORT, PUBLIC_DIR, DATABASE_PATH } = require("./src/config");
const { db, validateSchema } = require("./src/database");

// Validar a estrutura do banco antes de iniciar
try {
    validateSchema();
} catch (error) {
    console.error("\nERRO AO VALIDAR BANCO DE DADOS:");
    console.error(error.message);
    process.exit(1);
}

const authRoutes = require("./src/routes/auth.routes");
const deviceRoutes = require("./src/routes/devices.routes");
const measurementRoutes = require("./src/routes/measurements.routes");

const app = express();

app.use(cors());
app.use(express.json({ limit: "20kb" }));
app.use(express.static(PUBLIC_DIR));

// Verificação de disponibilidade
app.get("/api/health", (req, res) => {
    res.json({
        sucesso: true,
        servidor: "Watt Monitor",
        status: "online"
    });
});

// Rotas da aplicação
app.use("/api/auth", authRoutes);
app.use("/api/dispositivos", deviceRoutes);
app.use("/api", measurementRoutes);

// Tratamento de erros
app.use((error, req, res, next) => {
    console.error("Erro não tratado:", error);

    if (res.headersSent) return next(error);

    res.status(500).json({
        sucesso: false,
        mensagem: "Erro interno do servidor."
    });
});

// Inicialização do servidor
const server = app.listen(PORT, "0.0.0.0", () => {
    console.log("------------------------------------------");
    console.log(" WATT MONITOR - SERVIDOR ONLINE");
    console.log("------------------------------------------");
    console.log(`Porta: ${PORT}`);
    console.log(`Banco: ${DATABASE_PATH}`);
    console.log("------------------------------------------");
});

// Encerramento controlado
let shuttingDown = false;

function shutdown() {
    if (shuttingDown) return;
    shuttingDown = true;

    console.log("\nEncerrando servidor...");

    server.close(() => {
        db.close();
        console.log("Banco fechado. Servidor encerrado.");
        process.exit(0);
    });

    setTimeout(() => {
        console.error("Tempo limite de encerramento atingido.");
        process.exit(1);
    }, 10000).unref();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
