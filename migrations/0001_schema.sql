-- Estrutura reservada para futura implantação segura (não utilizada pelo protótipo público).
CREATE TABLE IF NOT EXISTS patients (id TEXT PRIMARY KEY,record_number TEXT NOT NULL UNIQUE,full_name TEXT NOT NULL,birth_date TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS clinical_visits (id TEXT PRIMARY KEY,patient_id TEXT NOT NULL,visit_date TEXT NOT NULL,document_json TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(patient_id) REFERENCES patients(id));
CREATE INDEX IF NOT EXISTS idx_visits_patient_date ON clinical_visits(patient_id,visit_date);
CREATE TABLE IF NOT EXISTS audit_events (id TEXT PRIMARY KEY,actor_id TEXT NOT NULL,action TEXT NOT NULL,record_id TEXT,occurred_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
-- Exigir autenticação, autorização individual, trilha de auditoria e política de retenção ANTES de habilitar API de dados.