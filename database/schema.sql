-- MEDIDOR SOLAR - ESTRUTURA DO BANCO DE DADOS
-- Execute este arquivo no DBeaver conectado ao arquivo medidor_solar.db.
-- CREATE TABLE IF NOT EXISTS preserva as tabelas e os dados que ja existem.

PRAGMA foreign_keys = ON;

-- Historico de medicoes. Se a tabela ja existir, os registros sao preservados.
CREATE TABLE IF NOT EXISTS medicoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    esp_id TEXT NOT NULL,
    data_hora TEXT NOT NULL,
    tensao REAL NOT NULL,
    corrente REAL NOT NULL,
    potencia REAL NOT NULL
);

-- Contas dos usuarios do painel.
CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    email TEXT NOT NULL COLLATE NOCASE UNIQUE,
    senha_hash TEXT NOT NULL,
    senha_salt TEXT NOT NULL,
    criado_em TEXT NOT NULL
);

-- Cada MAC pode ser vinculado a uma unica conta.
-- O ESP32 e identificado pelo campo esp_id; nao ha chave adicional do dispositivo.
CREATE TABLE IF NOT EXISTS dispositivos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    esp_id TEXT NOT NULL UNIQUE,
    usuario_id INTEGER NOT NULL,
    nome TEXT NOT NULL,
    criado_em TEXT NOT NULL,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

-- Sessoes de login do painel.
CREATE TABLE IF NOT EXISTS sessoes (
    token_hash TEXT PRIMARY KEY,
    usuario_id INTEGER NOT NULL,
    criado_em INTEGER NOT NULL,
    expira_em INTEGER NOT NULL,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_medicoes_esp_data
ON medicoes (esp_id, id DESC);

CREATE INDEX IF NOT EXISTS idx_dispositivos_usuario
ON dispositivos (usuario_id);

CREATE INDEX IF NOT EXISTS idx_sessoes_expiracao
ON sessoes (expira_em);
