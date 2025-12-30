const { Pool } = require('pg');
const path = require('path');
const dotenvPath = path.resolve(__dirname, '../../.env');
require('dotenv').config({ path: dotenvPath });

// Database connection
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

const CANONICAL_CATEGORIES = [
    'Food Pantry',
    'Housing Assistance',
    'Mental Health',
    'Medical Care',
    'Legal Assistance',
    'Crisis & Emergency',
    'Family & Children',
    'Employment & Financial Help',
    'Disability & Senior Services',
    'Community Resource'
];

async function migrate() {
    const client = await pool.connect();
    try {
        console.log('Starting migration...');
        await client.query('BEGIN');

        // 1. Ensure Canonical Categories exist
        const categoryMap = {}; // name -> id
        for (const name of CANONICAL_CATEGORIES) {
            const slug = name.toLowerCase().replace(/ & /g, '-').replace(/ /g, '-');
            const res = await client.query(`
        INSERT INTO categories (name, slug, mode)
        VALUES ($1, $2, 'both')
        ON CONFLICT (slug) DO UPDATE SET name = $1
        RETURNING id
      `, [name, slug]);
            categoryMap[name] = res.rows[0].id;
        }
        console.log('Canonical categories verified.');

        // 2. Fetch all resources
        const resourcesRes = await client.query(`
      SELECT r.id, r.name, r.description,
             array_agg(c.name) as current_categories
      FROM resources r
      LEFT JOIN resource_categories rc ON r.id = rc.resource_id
      LEFT JOIN categories c ON rc.category_id = c.id
      WHERE r.primary_category_id IS NULL
      GROUP BY r.id
    `);

        const resources = resourcesRes.rows;
        console.log(`Found ${resources.length} resources to migrate.`);

        for (const res of resources) {
            const currentCats = res.current_categories || [];
            let primaryCatName = 'Community Resource';
            let tags = [];

            // Determine Primary Category
            // Logic: Find first match in canonical list, else Community Resource
            const matches = currentCats.filter(c => CANONICAL_CATEGORIES.includes(c));

            if (matches.length > 0) {
                // Prioritize "Food Pantry" if present, otherwise just pick first
                if (matches.includes('Food Pantry')) {
                    primaryCatName = 'Food Pantry';
                } else {
                    primaryCatName = matches[0];
                }

                // Others become tags
                tags = currentCats.filter(c => c !== primaryCatName);
            } else {
                // No canonical match found in current categories
                // Keep all current categories as tags
                tags = currentCats.filter(c => c !== null);
            }

            const primaryCatId = categoryMap[primaryCatName];

            // Update Resource
            await client.query(`
        UPDATE resources 
        SET primary_category_id = $1
        WHERE id = $2
      `, [primaryCatId, res.id]);

            // Handle Food Pantry Extras
            if (primaryCatName === 'Food Pantry') {
                // Basic heuristic for food_dist_onsite based on description keywords
                const desc = (res.description || '').toLowerCase();
                const isOnsite = desc.includes('pickup') || desc.includes('distribution') || desc.includes('market') || desc.includes('pantry');

                await client.query(`
          UPDATE resources 
          SET food_dist_onsite = $1
          WHERE id = $2
        `, [isOnsite, res.id]);
            }

            // Handle Tags
            for (const tagName of tags) {
                if (!tagName) continue;
                const tagSlug = tagName.toLowerCase().replace(/ /g, '-');

                // Create Tag if not exists
                const tagRes = await client.query(`
          INSERT INTO tags (name, slug)
          VALUES ($1, $2)
          ON CONFLICT (slug) DO UPDATE SET name = $1
          RETURNING id
        `, [tagName, tagSlug]);
                const tagId = tagRes.rows[0].id;

                // Link Resource Tag
                await client.query(`
          INSERT INTO resource_tags (resource_id, tag_id)
          VALUES ($1, $2)
          ON CONFLICT DO NOTHING
        `, [res.id, tagId]);
            }
        }

        await client.query('COMMIT');
        console.log('Migration completed successfully.');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error during migration:', error);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

migrate();
