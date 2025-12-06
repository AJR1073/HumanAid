const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 4000;

// Database connection
// Use Cloud SQL socket if INSTANCE_CONNECTION_NAME is set (production)
// Otherwise use host/port (local development)
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

// Log DB config on startup (without password)
console.log('[DB Config]', {
  mode: process.env.INSTANCE_CONNECTION_NAME ? 'Cloud SQL Socket' : 'TCP/IP',
  instanceConnectionName: process.env.INSTANCE_CONNECTION_NAME || 'not set',
  host: dbConfig.host,
  database: process.env.DB_NAME || 'humanaid',
  user: process.env.DB_USER || 'postgres',
  hasPassword: !!process.env.DB_PASSWORD
});

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Database health check - diagnose connection issues
app.get('/api/db-health', async (req, res) => {
  const startTime = Date.now();
  try {
    const result = await pool.query('SELECT 1 as test, NOW() as time');
    res.json({ 
      status: 'connected',
      responseTime: Date.now() - startTime + 'ms',
      dbTime: result.rows[0].time,
      config: {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'humanaid',
        user: process.env.DB_USER || 'postgres',
        hasPassword: !!process.env.DB_PASSWORD,
        passwordLength: process.env.DB_PASSWORD?.length || 0
      }
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error',
      error: error.message,
      code: error.code,
      responseTime: Date.now() - startTime + 'ms',
      config: {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'humanaid',
        user: process.env.DB_USER || 'postgres',
        hasPassword: !!process.env.DB_PASSWORD,
        passwordLength: process.env.DB_PASSWORD?.length || 0
      }
    });
  }
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

// Search resources - location-aware
// If lat/lon provided, searches within radius first, then expands if no results
app.get('/api/search', async (req, res) => {
  try {
    const { q, lat, lon, radius = 50, limit = 20 } = req.query;
    
    if (!q) {
      return res.status(400).json({ error: 'Search query required' });
    }

    let result;
    let searchMode = 'global';

    // If location provided, try location-based search first
    if (lat && lon) {
      // First: Search within radius, sorted by distance
      const localResult = await pool.query(`
        SELECT 
          r.id, r.name, r.address, r.city, r.state, r.zip_code,
          r.phone, r.website,
          ST_Y(r.location::geometry) as latitude,
          ST_X(r.location::geometry) as longitude,
          array_agg(c.name) as categories,
          ST_Distance(
            r.location,
            ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography
          ) / 1609.34 as distance,
          ts_rank(
            to_tsvector('english', r.name || ' ' || COALESCE(r.description, '')),
            plainto_tsquery('english', $1)
          ) as rank
        FROM resources r
        LEFT JOIN resource_categories rc ON r.id = rc.resource_id
        LEFT JOIN categories c ON rc.category_id = c.id
        WHERE r.is_active = true 
          AND r.approval_status = 'approved'
          AND (
            to_tsvector('english', r.name || ' ' || COALESCE(r.description, '')) 
            @@ plainto_tsquery('english', $1)
            OR LOWER(r.name) LIKE LOWER('%' || $1 || '%')
          )
          AND ST_DWithin(
            r.location,
            ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography,
            $4 * 1609.34
          )
        GROUP BY r.id
        ORDER BY distance, rank DESC
        LIMIT $5
      `, [q, parseFloat(lon), parseFloat(lat), parseFloat(radius), parseInt(limit)]);

      if (localResult.rows.length > 0) {
        result = localResult;
        searchMode = 'local';
      } else {
        // No local results - find closest match anywhere
        const closestResult = await pool.query(`
          SELECT 
            r.id, r.name, r.address, r.city, r.state, r.zip_code,
            r.phone, r.website,
            ST_Y(r.location::geometry) as latitude,
            ST_X(r.location::geometry) as longitude,
            array_agg(c.name) as categories,
            ST_Distance(
              r.location,
              ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography
            ) / 1609.34 as distance,
            ts_rank(
              to_tsvector('english', r.name || ' ' || COALESCE(r.description, '')),
              plainto_tsquery('english', $1)
            ) as rank
          FROM resources r
          LEFT JOIN resource_categories rc ON r.id = rc.resource_id
          LEFT JOIN categories c ON rc.category_id = c.id
          WHERE r.is_active = true 
            AND r.approval_status = 'approved'
            AND (
              to_tsvector('english', r.name || ' ' || COALESCE(r.description, '')) 
              @@ plainto_tsquery('english', $1)
              OR LOWER(r.name) LIKE LOWER('%' || $1 || '%')
            )
          GROUP BY r.id
          ORDER BY distance
          LIMIT $4
        `, [q, parseFloat(lon), parseFloat(lat), parseInt(limit)]);
        
        result = closestResult;
        searchMode = 'closest';
      }
    } else {
      // No location - global search by relevance
      result = await pool.query(`
        SELECT 
          r.id, r.name, r.address, r.city, r.state, r.zip_code,
          r.phone, r.website,
          ST_Y(r.location::geometry) as latitude,
          ST_X(r.location::geometry) as longitude,
          array_agg(c.name) as categories,
          ts_rank(
            to_tsvector('english', r.name || ' ' || COALESCE(r.description, '')),
            plainto_tsquery('english', $1)
          ) as rank
        FROM resources r
        LEFT JOIN resource_categories rc ON r.id = rc.resource_id
        LEFT JOIN categories c ON rc.category_id = c.id
        WHERE r.is_active = true 
          AND r.approval_status = 'approved'
          AND (
            to_tsvector('english', r.name || ' ' || COALESCE(r.description, '')) 
            @@ plainto_tsquery('english', $1)
            OR LOWER(r.name) LIKE LOWER('%' || $1 || '%')
          )
        GROUP BY r.id
        ORDER BY rank DESC
        LIMIT $2
      `, [q, parseInt(limit)]);
    }

    res.json({
      query: q,
      count: result.rows.length,
      searchMode: searchMode, // 'local', 'closest', or 'global'
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

// Submit a new resource (pending approval)
app.post('/api/submissions', async (req, res) => {
  try {
    const {
      name,
      description,
      address,
      city,
      state,
      zipCode,
      phone,
      website,
      email,
      hours,
      categoryId,
      notes,
      submittedBy,
      submittedByName,
      submittedByUid
    } = req.body;

    // Validate required fields
    if (!name || !address || !city || !state || !zipCode || !categoryId) {
      return res.status(400).json({ 
        error: 'Missing required fields: name, address, city, state, zipCode, categoryId' 
      });
    }

    // Insert into pending_submissions table
    const result = await pool.query(`
      INSERT INTO pending_submissions (
        name, description, address, city, state, zip_code,
        phone, website, email, hours, category_id, notes,
        submitted_by, submitted_by_name, submitted_by_uid,
        status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'pending', NOW())
      RETURNING id
    `, [
      name, description, address, city, state, zipCode,
      phone, website, email, hours, categoryId, notes,
      submittedBy, submittedByName, submittedByUid
    ]);

    res.status(201).json({
      success: true,
      message: 'Resource submitted for review',
      submissionId: result.rows[0].id
    });
  } catch (error) {
    console.error('Error submitting resource:', error);
    res.status(500).json({ error: 'Failed to submit resource' });
  }
});

// Get pending submissions (admin only)
app.get('/api/submissions', async (req, res) => {
  try {
    const { status = 'pending' } = req.query;
    
    const result = await pool.query(`
      SELECT ps.*, c.name as category_name, c.icon as category_icon
      FROM pending_submissions ps
      LEFT JOIN categories c ON ps.category_id = c.id
      WHERE ps.status = $1
      ORDER BY ps.created_at DESC
    `, [status]);

    res.json({
      submissions: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching submissions:', error);
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
});

// Approve or reject a submission (admin only)
app.patch('/api/submissions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { action, reviewedBy } = req.body; // action: 'approve' or 'reject'

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action. Use "approve" or "reject"' });
    }

    if (action === 'approve') {
      // Get the submission
      const submission = await pool.query(
        'SELECT * FROM pending_submissions WHERE id = $1',
        [id]
      );

      if (submission.rows.length === 0) {
        return res.status(404).json({ error: 'Submission not found' });
      }

      const sub = submission.rows[0];

      // Geocode the address (simplified - use actual geocoding in production)
      // For now, we'll set a placeholder location

      // Insert into resources table
      const newResource = await pool.query(`
        INSERT INTO resources (
          name, description, address, city, state, zip_code,
          phone, website, email, hours, is_active, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, NOW())
        RETURNING id
      `, [
        sub.name, sub.description, sub.address, sub.city, sub.state, sub.zip_code,
        sub.phone, sub.website, sub.email, sub.hours
      ]);

      // Link to category
      await pool.query(`
        INSERT INTO resource_categories (resource_id, category_id)
        VALUES ($1, $2)
      `, [newResource.rows[0].id, sub.category_id]);

      // Update submission status
      await pool.query(`
        UPDATE pending_submissions 
        SET status = 'approved', reviewed_at = NOW(), reviewed_by = $1
        WHERE id = $2
      `, [reviewedBy, id]);

      res.json({
        success: true,
        message: 'Resource approved and published',
        resourceId: newResource.rows[0].id
      });
    } else {
      // Reject submission
      await pool.query(`
        UPDATE pending_submissions 
        SET status = 'rejected', reviewed_at = NOW(), reviewed_by = $1
        WHERE id = $2
      `, [reviewedBy, id]);

      res.json({
        success: true,
        message: 'Submission rejected'
      });
    }
  } catch (error) {
    console.error('Error processing submission:', error);
    res.status(500).json({ error: 'Failed to process submission' });
  }
});

// Start server
app.listen(port, () => {
  console.log(`🚀 HumanAid API server running on port ${port}`);
  console.log(`📍 http://localhost:${port}/api/health`);
});
