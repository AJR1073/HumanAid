const { Pool } = require('pg');
const path = require('path');
const dotenvPath = path.resolve(__dirname, '../../.env');
require('dotenv').config({ path: dotenvPath });

// Production config often provided via environment variables directly (e.g. Cloud Run)
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
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000
  };

const pool = new Pool(dbConfig);

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Starting Production Migration...');

    // 1. Add is_admin to users
    console.log('Checking users.is_admin...');
    await client.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;
    `);

    // 2. Add photo_url to users
    console.log('Checking users.photo_url...');
    await client.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS photo_url TEXT;
    `);

    // 3. Create user_favorites table
    console.log('Checking user_favorites table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_favorites (
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        resource_id INTEGER REFERENCES resources(id) ON DELETE CASCADE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, resource_id)
      );
    `);

    // 4. Create pending_submissions table
    console.log('Checking pending_submissions table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS pending_submissions (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        address VARCHAR(255) NOT NULL,
        city VARCHAR(100) NOT NULL,
        state VARCHAR(52) NOT NULL,
        zip_code VARCHAR(10) NOT NULL,
        phone VARCHAR(20),
        website TEXT,
        email VARCHAR(255),
        hours TEXT,
        primary_category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        tags JSONB,
        food_dist_onsite BOOLEAN,
        food_dist_type VARCHAR(50),
        notes TEXT,
        submitted_by VARCHAR(255),
        submitted_by_name VARCHAR(255),
        submitted_by_uid VARCHAR(255),
        status VARCHAR(50) DEFAULT 'pending', -- pending, approved, rejected
        reviewed_by VARCHAR(255),
        reviewed_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('Migration completed successfully.');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    client.release();
    pool.end();
  }
}

migrate();
