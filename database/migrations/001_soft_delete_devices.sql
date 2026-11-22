-- Migração aditiva; não remove nem altera dados existentes.
ALTER TABLE dispositivos ADD COLUMN removido_em TEXT DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_dispositivos_usuario_removido
ON dispositivos (usuario_id, removido_em);
