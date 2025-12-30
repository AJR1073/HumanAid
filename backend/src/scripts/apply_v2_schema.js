const { Pool } = require('pg');
const path = require('path');
const dotenvPath = path.resolve(__dirname, '../../.env');
require('dotenv').config({ path: dotenvPath });

console.log('Loading .env from:', dotenvPath);
console.log('DB Config Env Vars:', {
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  passwordType: typeof process.env.DB_PASSWORD,
  passwordLength: process.env.DB_PASSWORD ? process.env.DB_PASSWORD.length : 0
});

// Database connection (copied from server.js logic)
const dbConfig = process.env.INSTANCE_CONNECTION_NAME
  ? {
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'humanaid',
    host: `/cloudsql/${process.env.INSTANCE_CONNECTION_NAME}`,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000
  }
  : {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'humanaid',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000
  };

const pool = new Pool(dbConfig);

async function applySchema() {
  const client = await pool.connect();
  try {
    console.log('Starting schema update...');
    await client.query('BEGIN');

    // 1. Add primary_category_id to resources
    console.log('Adding primary_category_id to resources...');
    await client.query(`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='resources' AND column_name='primary_category_id') THEN
          ALTER TABLE resources ADD COLUMN primary_category_id INTEGER REFERENCES categories(id);
        END IF;
      END $$;
    `);

    // 2. Add food pantry fields
    console.log('Adding food pantry fields to resources...');
    await client.query(`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='resources' AND column_name='food_dist_onsite') THEN
          ALTER TABLE resources ADD COLUMN food_dist_onsite BOOLEAN DEFAULT false;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='resources' AND column_name='food_dist_type') THEN
          ALTER TABLE resources ADD COLUMN food_dist_type VARCHAR(20) CHECK (food_dist_type IN ('boxes', 'meal', 'both'));
        END IF;
      END $$;
    `);

    // 3. Create tags table
    console.log('Creating tags table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS tags (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        slug VARCHAR(255) NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 4. Create resource_tags table
    console.log('Creating resource_tags table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS resource_tags (
        resource_id INTEGER REFERENCES resources(id) ON DELETE CASCADE,
        tag_id INTEGER REFERENCES tags(id) ON DELETE CASCADE,
        PRIMARY KEY (resource_id, tag_id)
      );
    `);

    await client.query('COMMIT');
    console.log('Schema update completed successfully.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error applying schema update:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

applySchema();
