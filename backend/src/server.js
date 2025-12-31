const functions = require('firebase-functions');
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 4000;

// Database connection
// Use Cloud SQL socket if INSTANCE_CONNECTION_NAME is set AND we are in a Cloud environment
// Otherwise use host/port (local development)
const isCloudEnv = process.env.K_SERVICE || process.env.FUNCTION_NAME;
const useSocket = process.env.INSTANCE_CONNECTION_NAME && isCloudEnv;

const dbConfig = useSocket
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
    ssl: process.env.DB_HOST !== 'localhost' ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000
  };

const pool = new Pool(dbConfig);

// Log DB config on startup (without password)
console.log('[DB Config]', {
  mode: useSocket ? 'Cloud SQL Socket' : 'TCP/IP',
  instanceConnectionName: process.env.INSTANCE_CONNECTION_NAME || 'not set',
  host: dbConfig.host,
  database: process.env.DB_NAME || 'humanaid',
  user: process.env.DB_USER || 'postgres',
  hasPassword: !!process.env.DB_PASSWORD,
  isCloudEnv: !!isCloudEnv
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
      limit = 100,
      ids // comma-separated list of IDs
    } = req.query;

    let query = `
      SELECT 
        r.id, r.name, r.address, r.city, r.state, r.zip_code,
        r.phone, r.website, r.description,
        ST_Y(r.location::geometry) as latitude,
        ST_X(r.location::geometry) as longitude,
        c.name as primary_category,
        c.slug as primary_category_slug,
        c.icon as primary_category_icon,
        COALESCE(
          json_agg(json_build_object('id', t.id, 'name', t.name, 'slug', t.slug))
          FILTER (WHERE t.id IS NOT NULL),
          '[]'
        ) as tags,
        r.food_dist_onsite,
        r.food_dist_type
        ${lat && lon ? `, ST_Distance(
          r.location,
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
        ) / 1609.34 as distance` : ''}
      FROM resources r
      LEFT JOIN categories c ON r.primary_category_id = c.id
      LEFT JOIN resource_tags rt ON r.id = rt.resource_id
      LEFT JOIN tags t ON rt.tag_id = t.id
      WHERE r.is_active = true AND r.approval_status = 'approved'
    `;

    const params = [];
    let paramCount = lat && lon ? 3 : 1;

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

    if (ids) {
      const idList = ids.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
      if (idList.length > 0) {
        query += ` AND r.id = ANY($${paramCount})`;
        params.push(idList);
        paramCount++;
      }
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
    query += ` GROUP BY r.id, c.id`;

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
    const { mode, include_empty, all_levels } = req.query;

    let query = `
      SELECT c.*, COUNT(r.id) as resource_count
      FROM categories c
      LEFT JOIN resources r ON r.primary_category_id = c.id AND r.is_active = true
      WHERE 1=1
    `;
    const params = [];

    // Filter by parent_id unless all_levels is requested
    if (all_levels !== 'true') {
      query += ' AND c.parent_id IS NULL';
    }

    let paramCount = 1;
    if (mode) {
      query += ` AND (c.mode = $${paramCount} OR c.mode = 'both')`;
      params.push(mode);
    }

    query += ` GROUP BY c.id`;

    // Only filter out empty categories if include_empty is NOT true
    if (include_empty !== 'true') {
      query += ` HAVING COUNT(r.id) > 0`;
    }

    query += ` ORDER BY c.display_order`;

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
          c.name as primary_category,
          c.slug as primary_category_slug,
          COALESCE(
            json_agg(t.name) FILTER (WHERE t.name IS NOT NULL),
            '[]'
          ) as tags,
          ST_Distance(
            r.location,
            ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography
          ) / 1609.34 as distance,
          ts_rank(
            to_tsvector('english', r.name || ' ' || COALESCE(r.description, '')),
            plainto_tsquery('english', $1)
          ) as rank
        FROM resources r
        LEFT JOIN categories c ON r.primary_category_id = c.id
        LEFT JOIN resource_tags rt ON r.id = rt.resource_id
        LEFT JOIN tags t ON rt.tag_id = t.id
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
        GROUP BY r.id, c.id
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
            c.name as primary_category,
            c.slug as primary_category_slug,
            COALESCE(
              json_agg(t.name) FILTER (WHERE t.name IS NOT NULL),
              '[]'
            ) as tags,
            ST_Distance(
              r.location,
              ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography
            ) / 1609.34 as distance,
            ts_rank(
              to_tsvector('english', r.name || ' ' || COALESCE(r.description, '')),
              plainto_tsquery('english', $1)
            ) as rank
          FROM resources r
          LEFT JOIN categories c ON r.primary_category_id = c.id
          LEFT JOIN resource_tags rt ON r.id = rt.resource_id
          LEFT JOIN tags t ON rt.tag_id = t.id
          WHERE r.is_active = true 
            AND r.approval_status = 'approved'
            AND (
              to_tsvector('english', r.name || ' ' || COALESCE(r.description, '')) 
              @@ plainto_tsquery('english', $1)
              OR LOWER(r.name) LIKE LOWER('%' || $1 || '%')
            )
          GROUP BY r.id, c.id
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
          c.name as primary_category,
          c.slug as primary_category_slug,
          COALESCE(
            json_agg(t.name) FILTER (WHERE t.name IS NOT NULL),
            '[]'
          ) as tags,
          ts_rank(
            to_tsvector('english', r.name || ' ' || COALESCE(r.description, '')),
            plainto_tsquery('english', $1)
          ) as rank
        FROM resources r
        LEFT JOIN categories c ON r.primary_category_id = c.id
        LEFT JOIN resource_tags rt ON r.id = rt.resource_id
        LEFT JOIN tags t ON rt.tag_id = t.id
        WHERE r.is_active = true 
          AND r.approval_status = 'approved'
          AND (
            to_tsvector('english', r.name || ' ' || COALESCE(r.description, '')) 
            @@ plainto_tsquery('english', $1)
            OR LOWER(r.name) LIKE LOWER('%' || $1 || '%')
          )
        GROUP BY r.id, c.id
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

const axios = require('axios');
const cheerio = require('cheerio');

// CORS configuration
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:4173',
  'https://humanaidapp.org',
  'https://humanaid-79963.web.app',
  'https://gocasino-1ecc9.web.app',
  'https://gocasino-1ecc9.firebaseapp.com'
];

// URL Scanner endpoint
app.post('/api/scan-url', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    // Validate URL format
    try {
      new URL(url);
    } catch (e) {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    const response = await axios.get(url, {
      timeout: 5000,
      headers: {
        'User-Agent': 'HumanAid-Bot/1.0'
      }
    });

    const $ = cheerio.load(response.data);
    const title = $('title').text().trim() || $('meta[property="og:title"]').attr('content') || '';
    const description = $('meta[name="description"]').attr('content') ||
      $('meta[property="og:description"]').attr('content') || '';

    // Clean up title (remove common suffixes like " - Home", " | Brand")
    const cleanTitle = title.split(/ [|\-] /)[0].trim();

    // Helper: Predict Category based on keywords
    const predictCategory = (text) => {
      const lowerText = text.toLowerCase();
      // Mapping of keywords to category slugs
      const categoryMap = {
        'senior-centers': ['senior', 'elder', 'aging', 'retirement', '55+', 'golden years'],
        'food': ['food', 'pantry', 'hunger', 'meal', 'nutrition', 'soup kitchen'],
        'housing': ['housing', 'shelter', 'homeless', 'eviction', 'rent', 'apartment'],
        'health': ['medical', 'health', 'clinic', 'doctor', 'care', 'hospital', 'dental'],
        'legal': ['legal', 'law', 'attorney', 'justice', 'court'],
        'mental-health': ['mental', 'counseling', 'therapy', 'suicide', 'crisis', 'depression'],
        'veterans-support': ['veteran', 'military', 'army', 'navy', 'air force', 'marines'],
        'child-care': ['child', 'daycare', 'preschool', 'kids', 'baby'],
        'education': ['school', 'education', 'tutoring', 'literacy', 'ged'],
        'employment': ['job', 'career', 'employment', 'work', 'hiring', 'resume'],
        'transportation': ['transport', 'ride', 'bus', 'transit', 'shuttle'],
        'clothing': ['clothing', 'clothes', 'attire', 'wardrobe', 'closet'],
        'utility-assistance': ['utility', 'electric', 'gas', 'water', 'bill', 'heap'],
        'financial-assistance': ['financial', 'money', 'grant', 'loan', 'budget']
      };

      let bestCategory = '';
      let maxScore = 0;

      for (const [slug, keywords] of Object.entries(categoryMap)) {
        let score = 0;
        keywords.forEach(keyword => {
          if (lowerText.includes(keyword)) score++;
        });
        if (score > maxScore) {
          maxScore = score;
          bestCategory = slug;
        }
      }
      return maxScore > 0 ? bestCategory : '';
    };

    const suggestedCategory = predictCategory(cleanTitle + ' ' + description);

    // Extract Phone (look for tel: link first, then regex)
    let phone = $('a[href^="tel:"]').first().attr('href')?.replace('tel:', '') || '';
    if (!phone) {
      const phoneRegex = /(\(\d{3}\)\s*\d{3}[-\s]\d{4}|\d{3}[-\s]\d{3}[-\s]\d{4})/;
      phone = $('body').text().match(phoneRegex)?.[0] || '';
    }

    // Extract Email (look for mailto: link first, then regex)
    let email = $('a[href^="mailto:"]').first().attr('href')?.replace('mailto:', '') || '';
    if (!email) {
      const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/;
      email = $('body').text().match(emailRegex)?.[0] || '';
    }

    // Extract Address (Schema.org or common classes)
    let address = '';
    let city = '';
    let state = '';
    let zipCode = '';

    // Try Schema.org Address
    const schemaScript = $('script[type="application/ld+json"]').html();
    if (schemaScript) {
      try {
        const schema = JSON.parse(schemaScript);
        const postalAddress = schema.address || (schema['@graph']?.find(i => i.address)?.address);
        if (postalAddress) {
          address = postalAddress.streetAddress || '';
          city = postalAddress.addressLocality || '';
          state = postalAddress.addressRegion || '';
          zipCode = postalAddress.postalCode || '';
        }
      } catch (e) {
        console.log('Error parsing schema for address', e);
      }
    }

    // Fallback: Regex for US Address (Heuristic: Right-to-Left)
    if (!address) {
      const bodyText = $('body').text().replace(/\s+/g, ' ');

      // Regex to find ", City, State Zip" or ".City, State Zip" (handling text merge)
      // Group 1: City, Group 2: State, Group 3: Zip (5 digits)
      const stateZipRegex = /(?:,|.)\s*([A-Za-z\s]+?)\s*(?:,|.)\s*([A-Z]{2})\s*(?:,|.)\s*(\d{5}(?:-\d{4})?)/g;

      let match;
      while ((match = stateZipRegex.exec(bodyText)) !== null) {
        const cityCandidate = match[1];
        const stateCandidate = match[2];
        const zipCandidate = match[3];

        if (stateCandidate === stateCandidate.toUpperCase() && cityCandidate.length < 30) {
          const endIndex = match.index;
          // Look backwards for the street up to 100 chars
          const lookback = bodyText.substring(Math.max(0, endIndex - 100), endIndex);

          // Try to find the start of street address (starts with digit)
          const streetMatch = lookback.match(/(\d+\s+[A-Za-z0-9\s.]+?)$/);

          if (streetMatch) {
            address = streetMatch[1].trim();
            if (address.endsWith('.')) address = address.slice(0, -1);

            city = cityCandidate.trim();
            state = stateCandidate;
            zipCode = zipCandidate;
            break;
          }
        }
      }
    }

    // Extract Hours (Regex for common patterns)
    let hours = '';
    const bodyTextNorm = $('body').text().replace(/\s+/g, ' ');
    // Look for keywords like "Hours", "Open" followed by time patterns
    const hoursRegex = /(?:Hours|Operation|Open)[:\s]+((?:Mon|Tue|Wed|Thu|Fri|Sat|Sun|Daily|Weekdays|Weekends).*?(?:am|pm|a\.m\.|p\.m\.|:00))/i;
    const hoursMatch = bodyTextNorm.match(hoursRegex);
    if (hoursMatch) {
      hours = hoursMatch[1].trim().substring(0, 100); // Limit length
    }

    // Strategy 2: Look for JSON data in raw HTML
    if (!hours) {
      const openHoursRegex = /"open_hours":(\[.*?\])/;
      const jsonMatch = response.data.match(openHoursRegex);
      if (jsonMatch) {
        try {
          const rawHours = JSON.parse(jsonMatch[1]);
          const schedule = rawHours
            .filter(h => h.status === 1 && h.start && h.end)
            .map(h => `${h.start} - ${h.end}`);

          if (schedule.length > 0) {
            const uniqueHours = [...new Set(schedule)];
            // If all days are the same, just show one range
            if (uniqueHours.length === 1 && rawHours.length >= 5) {
              hours = `Mon-Fri ${uniqueHours[0]}`;
            } else {
              hours = uniqueHours.join(', ');
            }
          }
        } catch (e) {
          console.log('Error parsing open_hours JSON', e);
        }
      }
    }

    res.json({
      title: cleanTitle,
      description: description.substring(0, 500), // Limit length
      url: url,
      phone: phone.trim(),
      email: email.split('?')[0].trim(), // Remove query params from mailto
      address: address,
      city: city,
      state: state,
      zipCode: zipCode,
      hours: hours,
      suggestedCategory: suggestedCategory
    });

  } catch (error) {
    console.error('Error scanning URL:', error.message);
    res.status(500).json({ error: 'Failed to scan URL. Please enter details manually.' });
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
      primaryCategoryId,
      tags,
      foodDistOnsite,
      foodDistType,
      notes,
      submittedBy,
      submittedByName,
      submittedByUid
    } = req.body;

    // Validate required fields
    if (!name || !address || !city || !state || !zipCode || !primaryCategoryId) {
      return res.status(400).json({
        error: 'Missing required fields: name, address, city, state, zipCode, primaryCategoryId'
      });
    }

    // Insert into pending_submissions table
    const result = await pool.query(`
      INSERT INTO pending_submissions (
        name, description, address, city, state, zip_code,
        phone, website, email, hours, primary_category_id, tags,
        food_dist_onsite, food_dist_type,
        notes, submitted_by, submitted_by_name, submitted_by_uid,
        status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, 'pending', NOW())
      RETURNING id
    `, [
      name, description, address, city, state, zipCode,
      phone, website, email, hours, primaryCategoryId, JSON.stringify(tags || []),
      foodDistOnsite, foodDistType,
      notes, submittedBy, submittedByName, submittedByUid
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
      LEFT JOIN categories c ON ps.primary_category_id = c.id
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

      // Insert into resources table
      // Generate slug
      let slug = sub.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      slug = `${slug}-${Date.now().toString().slice(-4)}`;

      // Default location (Alton, IL) if no geocoding
      // ST_SetSRID(ST_MakePoint(-90.1843, 38.8906), 4326)

      const newResource = await pool.query(`
        INSERT INTO resources (
          name, slug, description, address, city, state, zip_code,
          phone, website, email, hours, primary_category_id,
          food_dist_onsite, food_dist_type,
          is_active, location, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, true, ST_SetSRID(ST_MakePoint(-90.1843, 38.8906), 4326), NOW())
        RETURNING id
      `, [
        sub.name, slug, sub.description, sub.address, sub.city, sub.state, sub.zip_code,
        sub.phone, sub.website, sub.email, sub.hours, sub.primary_category_id,
        sub.food_dist_onsite, sub.food_dist_type
      ]);

      // Handle Tags (create if needed, link)
      const tags = sub.tags || []; // assumed to be array of names or IDs. let's assume names for now.
      if (typeof tags === 'string') {
        // If stored as JSON string, parse it? DB returns JSONB object/array if column is JSONB.
        // pg driver parses JSONB automatically.
      }

      if (Array.isArray(tags)) {
        for (const tagName of tags) {
          if (!tagName) continue;
          // Simple slug generation
          const tagSlug = tagName.toLowerCase().replace(/ /g, '-');

          // Upsert tag
          const tagRes = await pool.query(`
              INSERT INTO tags (name, slug) VALUES ($1, $2)
              ON CONFLICT (slug) DO UPDATE SET name = $1
              RETURNING id
            `, [tagName, tagSlug]);

          // Link
          await pool.query(`
              INSERT INTO resource_tags (resource_id, tag_id)
              VALUES ($1, $2)
              ON CONFLICT DO NOTHING
            `, [newResource.rows[0].id, tagRes.rows[0].id]);
        }
      }

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

// Favorites API
app.get('/api/favorites', async (req, res) => {
  try {
    const { uid } = req.query; // Firebase UID
    if (!uid) return res.status(400).json({ error: 'User ID required' });

    // Get user ID from firebase_uid
    const userRes = await pool.query('SELECT id FROM users WHERE firebase_uid = $1', [uid]);
    if (userRes.rows.length === 0) return res.json({ favorites: [] });
    const userId = userRes.rows[0].id;

    const result = await pool.query(`
      SELECT resource_id 
      FROM user_favorites 
      WHERE user_id = $1
    `, [userId]);

    res.json({ favorites: result.rows.map(r => r.resource_id) });
  } catch (error) {
    console.error('Error fetching favorites:', error);
    res.status(500).json({ error: 'Failed to fetch favorites' });
  }
});

app.post('/api/favorites', async (req, res) => {
  try {
    const { uid, resourceId } = req.body;
    if (!uid || !resourceId) return res.status(400).json({ error: 'Missing required fields' });

    // Get or Create User
    let userRes = await pool.query('SELECT id FROM users WHERE firebase_uid = $1', [uid]);
    let userId;

    if (userRes.rows.length === 0) {
      // Create user on the fly if not exists (syncs with firebase auth)
      // Note: We don't have email/name here, so we might need to pass it or just create basic record
      // Ideally client passes full user obj or we rely on Auth header. 
      // For now, let's assume user exists or create minimal.
      // Better: Client should ensure user exists via /api/users/sync first. 
      // Let's create minimal if missing.
      const newUser = await pool.query(
        'INSERT INTO users (firebase_uid, email) VALUES ($1, $2) RETURNING id',
        [uid, `${uid}@placeholder.com`] // Fallback
      );
      userId = newUser.rows[0].id;
    } else {
      userId = userRes.rows[0].id;
    }

    // Toggle Favorite
    const check = await pool.query(
      'SELECT * FROM user_favorites WHERE user_id = $1 AND resource_id = $2',
      [userId, resourceId]
    );

    if (check.rows.length > 0) {
      // Remove
      await pool.query(
        'DELETE FROM user_favorites WHERE user_id = $1 AND resource_id = $2',
        [userId, resourceId]
      );
      res.json({ status: 'removed' });
    } else {
      // Add
      await pool.query(
        'INSERT INTO user_favorites (user_id, resource_id) VALUES ($1, $2)',
        [userId, resourceId]
      );
      res.json({ status: 'added' });
    }
  } catch (error) {
    console.error('Error toggling favorite:', error);
    res.status(500).json({ error: 'Failed to toggle favorite' });
  }
});

// Update or Create User (Sync)
app.post('/api/users/sync', async (req, res) => {
  try {
    const { uid, email, displayName, photoURL } = req.body;

    // Hardcoded Admin Promotion for fallback
    const shouldBeAdmin = email === 'aaronreifschneider@outlook.com';

    const result = await pool.query(`
      INSERT INTO users (firebase_uid, email, display_name, photo_url, last_login, is_admin)
      VALUES ($1, $2, $3, $4, NOW(), $5)
      ON CONFLICT (firebase_uid) 
      DO UPDATE SET 
        last_login = NOW(),
        email = EXCLUDED.email,
        display_name = COALESCE(EXCLUDED.display_name, users.display_name),
        photo_url = COALESCE(EXCLUDED.photo_url, users.photo_url),
        is_admin = users.is_admin OR EXCLUDED.is_admin
      RETURNING is_admin
    `, [uid, email, displayName, photoURL, shouldBeAdmin]);

    res.json({ success: true, isAdmin: result.rows[0].is_admin });
  } catch (error) {
    console.error('Error syncing user:', error);
    res.status(500).json({ error: 'Failed to sync user' });
  }
});

// Admin API
app.get('/api/submissions/pending', async (req, res) => {
  // Note: In production, verify Admin status via ID token or DB lookup middleware
  try {
    const result = await pool.query(`
      SELECT * FROM pending_submissions 
      WHERE status = 'pending' 
      ORDER BY created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching submissions:', error);
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
});

app.get('/api/admin/resources', async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '', missing_zip = 'false' } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT r.*, c.name as category_name
      FROM resources r
      LEFT JOIN categories c ON r.primary_category_id = c.id
    `;
    const params = [];
    const conditions = [];

    if (search) {
      conditions.push(`(r.name ILIKE $${params.length + 1} OR r.city ILIKE $${params.length + 1} OR r.zip_code ILIKE $${params.length + 1} OR r.address ILIKE $${params.length + 1})`);
      params.push(`%${search}%`);
    }

    if (missing_zip === 'true') {
      conditions.push(`(r.zip_code IS NULL OR r.zip_code = '')`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ` ORDER BY r.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM resources r';
    if (conditions.length > 0) {
      countQuery += ' WHERE ' + conditions.join(' AND ');
    }

    // Re-use params for count query (only search/filter params, not limit/offset)
    const countParams = params.slice(0, params.length - 2);
    const countRes = await pool.query(countQuery, countParams);

    res.json({
      resources: result.rows,
      total: parseInt(countRes.rows[0].count),
      page: parseInt(page),
      totalPages: Math.ceil(parseInt(countRes.rows[0].count) / limit)
    });
  } catch (error) {
    console.error('Error fetching admin resources:', error);
    res.status(500).json({ error: 'Failed' });
  }
});

app.put('/api/admin/resources/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name, address, city, state, zip_code, phone, website, email, hours, primary_category_id, is_active,
      eligibility_requirements, appointment_required, walk_ins_accepted,
      food_dist_type, food_dist_onsite, service_area, languages_spoken
    } = req.body;

    // Generate new slug if name changes (optional, but good practice)
    let slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    slug = `${slug}-${id.slice(-4)}`; // Use ID segment to keep stable

    // Format languages_spoken as array literal or null
    const languagesArray = languages_spoken
      ? `{${languages_spoken.split(',').map(s => `"${s.trim()}"`).join(',')}}`
      : null;

    // Ensure food_dist_type is valid or null
    const validFoodTypes = ['boxes', 'meal', 'both'];
    let cleanFoodType = food_dist_type || null;
    if (cleanFoodType && !validFoodTypes.includes(cleanFoodType)) cleanFoodType = null;

    const result = await pool.query(
      `UPDATE resources 
         SET name = $1, slug = $2, address = $3, city = $4, state = $5, zip_code = $6, 
             phone = $7, website = $8, email = $9, hours = $10, primary_category_id = $11, 
             is_active = $12, eligibility_requirements = $13, appointment_required = $14,
             walk_ins_accepted = $15, food_dist_type = $16,
             food_dist_onsite = $17, service_area = $18, 
             languages_spoken = $19
         WHERE id = $20
         RETURNING id, name, email, languages_spoken`,
      [
        name, slug, address, city, state, zip_code,
        phone, website, email, hours, primary_category_id,
        is_active, eligibility_requirements, appointment_required,
        walk_ins_accepted, cleanFoodType,
        food_dist_onsite, service_area,
        languagesArray, // Use formatted array
        id
      ]
    );

    // Update location if geocoding needed (client can pass coords, but for now specific updates)
    // Or we could trigger geocoding here. For MVP, we assume editing text fields.

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating resource:', error);
    res.status(500).json({ error: 'Failed to update' });
  }
});

app.post('/api/admin/promote', async (req, res) => {
  try {
    const { email } = req.body;
    await pool.query('UPDATE users SET is_admin = TRUE WHERE email = $1', [email]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error promoting user:', error);
    res.status(500).json({ error: 'Failed to promote user' });
  }
});

app.post('/api/admin/demote', async (req, res) => {
  try {
    const { email } = req.body;
    // Prevent demoting the last admin or specific super-admins if needed, but for now just allow it.
    await pool.query('UPDATE users SET is_admin = FALSE WHERE email = $1', [email]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error demoting user:', error);
    res.status(500).json({ error: 'Failed to demote user' });
  }
});

app.get('/api/admin/list', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, email, display_name, last_login FROM users WHERE is_admin = TRUE ORDER BY email');
    res.json({ admins: result.rows });
  } catch (error) {
    console.error('Error listing admins:', error);
    res.status(500).json({ error: 'Failed to list admins' });
  }
});

// Export for Firebase Functions
exports.api = functions.https.onRequest(app);
exports.app = app; // Export for testing

// Start server locally (only if not running as a Cloud Function)
if (process.env.NODE_ENV !== 'production' && require.main === module) {
  app.listen(port, () => {
    console.log(`🚀 HumanAid API server running on port ${port}`);
    console.log(`📍 http://localhost:${port}/api/health`);
  });
}
