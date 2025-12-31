const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST || '34.132.37.162',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD, // Ensure this is set in environment or .env
    database: process.env.DB_NAME || 'humanaid',
    port: process.env.DB_PORT || 5432,
    ssl: { rejectUnauthorized: false } // Required for Cloud SQL
});

const migration = async () => {
    try {
        console.log('🔌 Connecting to DB...');
        const client = await pool.connect();

        console.log('🔄 Running migration: Adding expanded columns to resources table...');

        const queries = [
            "ALTER TABLE resources ADD COLUMN IF NOT EXISTS eligibility_requirements TEXT;",
            "ALTER TABLE resources ADD COLUMN IF NOT EXISTS appointment_required BOOLEAN DEFAULT false;",
            "ALTER TABLE resources ADD COLUMN IF NOT EXISTS walk_ins_accepted BOOLEAN DEFAULT true;",
            "ALTER TABLE resources ADD COLUMN IF NOT EXISTS food_dist_type VARCHAR(20) CHECK (food_dist_type IN ('boxes', 'meal', 'both', ''));",
            "ALTER TABLE resources ADD COLUMN IF NOT EXISTS food_dist_onsite BOOLEAN DEFAULT false;",
            "ALTER TABLE resources ADD COLUMN IF NOT EXISTS service_area TEXT;",
            "ALTER TABLE resources ADD COLUMN IF NOT EXISTS languages_spoken TEXT;"
        ];

        for (const query of queries) {
            await client.query(query);
            console.log(`✅ Executed: ${query}`);
        }

        console.log('🎉 Migration complete!');
        client.release();
    } catch (err) {
        console.error('❌ Migration failed:', err);
    } finally {
        await pool.end();
    }
};

migration();
