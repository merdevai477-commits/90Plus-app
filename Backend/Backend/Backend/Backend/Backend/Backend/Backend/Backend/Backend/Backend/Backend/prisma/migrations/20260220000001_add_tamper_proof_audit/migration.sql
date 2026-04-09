-- Add tamper-proof audit fields
ALTER TABLE "audit_logs" ADD COLUMN "hash" TEXT;
ALTER TABLE "audit_logs" ADD COLUMN "previousHash" TEXT;
ALTER TABLE "audit_logs" ADD COLUMN "severity" TEXT DEFAULT 'MEDIUM';

-- Create indexes for new fields
CREATE INDEX "audit_logs_severity_idx" ON "audit_logs"("severity");
CREATE INDEX "audit_logs_hash_idx" ON "audit_logs"("hash");

-- Add comment explaining immutability
COMMENT ON TABLE "audit_logs" IS 'Tamper-proof audit log with cryptographic hash chaining. DO NOT MODIFY DIRECTLY.';
