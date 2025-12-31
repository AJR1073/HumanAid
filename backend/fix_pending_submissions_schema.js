const { Pool } = require('pg');
require('dotenv').config();

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'humanaid',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_HOST !== 'localhost' ? { rejectUnauthorized: false } : false
};

const pool = new Pool(dbConfig);

async function runFix() {
    try {
        console.log('Checking pending_submissions table...');

        // Create table if not exists (covering all fields from server.js)
        // Note: Creating table won't run if it already exists, so we rely on ALTER loop below.
        await pool.query(`
      CREATE TABLE IF NOT EXISTS pending_submissions (
        id SERIAL PRIMARY KEY,
        name VARCHAR(500) NOT NULL,
        description TEXT,
        address VARCHAR(500),
        city VARCHAR(200),
        state VARCHAR(2),
        zip_code VARCHAR(10),
        phone VARCHAR(50),
        website VARCHAR(500),
        email VARCHAR(255),
        hours TEXT,
        primary_category_id INTEGER REFERENCES categories(id),
        tags JSONB,
        food_dist_onsite BOOLEAN DEFAULT false,
        food_dist_type VARCHAR(20),
        notes TEXT,
        submitted_by VARCHAR(255),
        submitted_by_name VARCHAR(255),
        submitted_by_uid VARCHAR(128),
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
        console.log('Table structure ensured (if new). Checking columns...');

        // List of columns to check/add
        const columns = [
            { name: 'primary_category_id', type: 'INTEGER REFERENCES categories(id)' },
            { name: 'tags', type: 'JSONB' },
            { name: 'food_dist_onsite', type: 'BOOLEAN DEFAULT false' },
            { name: 'food_dist_type', type: 'VARCHAR(20)' },
            { name: 'notes', type: 'TEXT' },
            { name: 'submitted_by', type: 'VARCHAR(255)' }, // email
            { name: 'submitted_by_name', type: 'VARCHAR(255)' },
            { name: 'submitted_by_uid', type: 'VARCHAR(128)' },
            { name: 'hours', type: 'TEXT' },
            { name: 'website', type: 'VARCHAR(500)' },
            { name: 'phone', type: 'VARCHAR(50)' },
            { name: 'email', type: 'VARCHAR(255)' },
            { name: 'zip_code', type: 'VARCHAR(10)' },
            { name: 'state', type: 'VARCHAR(2)' },
            { name: 'city', type: 'VARCHAR(200)' },
            { name: 'address', type: 'VARCHAR(500)' },
            { name: 'description', type: 'TEXT' }
        ];

        for (const col of columns) {
            const res = await pool.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name='pending_submissions' AND column_name=$1
        `, [col.name]);

            if (res.rows.length === 0) {
                console.log(`Adding missing column: ${col.name}`);
                // Note: using generic type for ADD COLUMN without constraints is safer if data exists, 
                // but here we want schema alignment. REFERENCES might fail if data invalid, but table is likely empty or we don't care.
                try {
                    await pool.query(`
              ALTER TABLE pending_submissions 
              ADD COLUMN ${col.name} ${col.type}
            `);
                } catch (e) {
                    console.error(`Failed to add ${col.name}: ${e.message}`);
                }
            } else {
                // console.log(`Column ${col.name} exists.`);
            }
        }

        console.log('Schema fix completed successfully.');
    } catch (error) {
        console.error('Error fixing schema:', error);
    } finally {
        await pool.end();
    }
}

runFix();
