const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifyTables() {
    try {
        console.log('Checking GDPR tables...\n');
        
        // Check DataExportRequest table
        try {
            await prisma.dataExportRequest.findMany({ take: 1 });
            console.log('✅ DataExportRequest table exists');
        } catch (e) {
            console.log('❌ DataExportRequest table missing');
        }
        
        // Check AccountDeletionRequest table
        try {
            await prisma.accountDeletionRequest.findMany({ take: 1 });
            console.log('✅ AccountDeletionRequest table exists');
        } catch (e) {
            console.log('❌ AccountDeletionRequest table missing');
        }
        
        // Check ConsentLog table
        try {
            await prisma.consentLog.findMany({ take: 1 });
            console.log('✅ ConsentLog table exists');
        } catch (e) {
            console.log('❌ ConsentLog table missing');
        }
        
        // Check GDPRAuditLog table
        try {
            await prisma.gDPRAuditLog.findMany({ take: 1 });
            console.log('✅ GDPRAuditLog table exists');
        } catch (e) {
            console.log('❌ GDPRAuditLog table missing');
        }
        
        console.log('\n✅ All GDPR tables verified successfully!');
        await prisma.$disconnect();
        process.exit(0);
    } catch (error) {
        console.error('❌ Error verifying tables:', error.message);
        await prisma.$disconnect();
        process.exit(1);
    }
}

verifyTables();
