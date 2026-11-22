-- Mantém a associação dos MACs anteriores para preservar o histórico após edição.
CREATE TABLE IF NOT EXISTS dispositivo_macs (
    mac TEXT PRIMARY KEY,
    dispositivo_id INTEGER NOT NULL,
    criado_em TEXT NOT NULL,
    aceita_medicoes INTEGER NOT NULL DEFAULT 1 CHECK (aceita_medicoes IN (0, 1)),
    FOREIGN KEY (dispositivo_id) REFERENCES dispositivos(id) ON DELETE CASCADE
);

INSERT OR IGNORE INTO dispositivo_macs (mac, dispositivo_id, criado_em, aceita_medicoes)
SELECT esp_id, id, criado_em, 1 FROM dispositivos;

CREATE INDEX IF NOT EXISTS idx_dispositivo_macs_dispositivo
ON dispositivo_macs (dispositivo_id);
