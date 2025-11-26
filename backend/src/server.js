const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 4000;

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'humanaid',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD
});

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get resources with filtering
app.get('/api/resources', async (req, res) => {
  try {
    const { 
      city, 
      state, 
      category,
      zip, 
      lat, 
      lon, 
      radius = 10, // miles
      limit = 100 
    } = req.query;

    let query = `
      SELECT 
        r.id, r.name, r.address, r.city, r.state, r.zip_code,
        r.phone, r.website, r.description,
        ST_Y(r.location::geometry) as latitude,
        ST_X(r.location::geometry) as longitude,
        array_agg(c.name) as categories
        ${lat && lon ? `, ST_Distance(
          r.location,
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
        ) / 1609.34 as distance` : ''}
      FROM resources r
      LEFT JOIN resource_categories rc ON r.id = rc.resource_id
      LEFT JOIN categories c ON rc.category_id = c.id
      WHERE r.is_active = true AND r.approval_status = 'approved'
    `;

    const params = [];
    let paramCount = lat && lon ? 3 : 1;  // Reserve params 1,2 for lon/lat if location search
    
    // Add lon/lat to params first if location-based
    if (lat && lon) {
      params.push(parseFloat(lon), parseFloat(lat));
    }

    if (city) {
      query += ` AND LOWER(r.city) = LOWER($${paramCount})`;
      params.push(city);
      paramCount++;
    }

    if (state) {
      query += ` AND r.state = $${paramCount}`;
      params.push(state.toUpperCase());
      paramCount++;
    }

    if (zip) {
      query += ` AND r.zip_code LIKE $${paramCount}`;
      params.push(zip + '%');
      paramCount++;
    }

    if (category) {
      query += ` AND c.slug = $${paramCount}`;
      params.push(category);
      paramCount++;
    }

    // Location-based search (radius filter)
    if (lat && lon) {
      query += ` AND ST_DWithin(
        r.location,
        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
        $${paramCount} * 1609.34
      )`;
      params.push(parseFloat(radius));
      paramCount++;
    }

    // Group by and order
    query += ` GROUP BY r.id`;
    
    // Order by distance if location search, otherwise by name
    if (lat && lon) {
      query += `, distance ORDER BY distance`;
    } else {
      query += ` ORDER BY r.name`;
    }
    
    query += ` LIMIT $${paramCount}`;
    params.push(parseInt(limit));

    const result = await pool.query(query, params);
    
    // Get total count for stats
    const countQuery = `
      SELECT COUNT(DISTINCT r.id) as total
      FROM resources r
      LEFT JOIN resource_categories rc ON r.id = rc.resource_id
      LEFT JOIN categories c ON rc.category_id = c.id
      WHERE r.is_active = true AND r.approval_status = 'approved'
    `;
    const countResult = await pool.query(countQuery);
    const totalCount = parseInt(countResult.rows[0].total);
    
    res.json({
      count: result.rows.length,
      total: totalCount,
      resources: result.rows
    });
  } catch (error) {
    console.error('Error fetching resources:', error);
    res.status(500).json({ error: 'Failed to fetch resources' });
  }
});

// Get categories
app.get('/api/categories', async (req, res) => {
  try {
    const { mode } = req.query;
    
    let query = 'SELECT * FROM categories WHERE parent_id IS NULL';
    const params = [];
    
    if (mode) {
      query += ' AND (mode = $1 OR mode = \'both\')';
      params.push(mode);
    }
    
    query += ' ORDER BY display_order';
    
    const result = await pool.query(query, params);
    res.json({ categories: result.rows });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Search resources
app.get('/api/search', async (req, res) => {
  try {
    const { q, limit = 20 } = req.query;
    
    if (!q) {
      return res.status(400).json({ error: 'Search query required' });
    }

    const result = await pool.query(`
      SELECT 
        r.id, r.name, r.address, r.city, r.state,
        r.phone, r.website,
        ST_Y(r.location::geometry) as latitude,
        ST_X(r.location::geometry) as longitude,
        ts_rank(
          to_tsvector('english', r.name || ' ' || COALESCE(r.description, '')),
          plainto_tsquery('english', $1)
        ) as rank
      FROM resources r
      WHERE r.is_active = true 
        AND r.approval_status = 'approved'
        AND (
          to_tsvector('english', r.name || ' ' || COALESCE(r.description, '')) 
          @@ plainto_tsquery('english', $1)
        )
      ORDER BY rank DESC
      LIMIT $2
    `, [q, parseInt(limit)]);

    res.json({
      query: q,
      count: result.rows.length,
      results: result.rows
    });
  } catch (error) {
    console.error('Error searching:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Get stats
app.get('/api/stats', async (req, res) => {
  try {
    const resourceCount = await pool.query('SELECT COUNT(*) FROM resources WHERE is_active = true');
    const categoryCount = await pool.query('SELECT COUNT(*) FROM categories');
    const cityCount = await pool.query('SELECT COUNT(DISTINCT city) FROM resources WHERE is_active = true');
    
    res.json({
      resources: parseInt(resourceCount.rows[0].count),
      categories: parseInt(categoryCount.rows[0].count),
      cities: parseInt(cityCount.rows[0].count)
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Start server
app.listen(port, () => {
  console.log(`🚀 HumanAid API server running on port ${port}`);
  console.log(`📍 http://localhost:${port}/api/health`);
});
