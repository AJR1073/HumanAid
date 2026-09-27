const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const { databaseConfig, corsOptions, readInteger, assertFirebaseAuthEnvironment } = require('./security/config');
const { createAuthMiddleware, requireOwnIdentity, getFirebaseUser } = require('./security/auth');
const { createRateLimiter } = require('./security/rate-limit');
const { validate, validateId, requireCoordinatePair, schemas } = require('./security/validation');
const { fetchPublicHtml, ScanUrlError } = require('./services/safe-url-fetch');
const { publicResource } = require('./security/public-resource');

// A local .env cannot silently switch a development process into production mode.
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
if (process.env.NODE_ENV !== 'test') require('dotenv').config();

const app = express();
const port = process.env.PORT || 4000;
assertFirebaseAuthEnvironment();
const pool = new Pool(databaseConfig());
const { requireAuthenticatedUser, requireAdmin } = createAuthMiddleware({ pool });
const adminOnly = [requireAuthenticatedUser, requireAdmin];
const mutationLimit = createRateLimiter({ limit: 30, windowMs: 10 * 60 * 1000 });
const scanLimit = createRateLimiter({ limit: 10, windowMs: 5 * 60 * 1000 });

app.disable('x-powered-by');
app.set('trust proxy', readInteger(process.env.TRUST_PROXY_HOPS, 0, 0, 3, 'TRUST_PROXY_HOPS'));
app.use(cors(corsOptions()));
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api', createRateLimiter({ limit: 300, windowMs: 60 * 1000 }));
app.use(express.json({ limit: '64kb', strict: true }));
app.use('/api/admin', ...adminOnly);
app.param('id', validateId);

// Get resources with filtering
app.get('/api/resources', validate(schemas.resources, 'query'), requireCoordinatePair, async (req, res) => {
  try {
    const {
      city,
      state,
      category,
      mode,
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
        ${lat !== undefined && lon !== undefined ? `, ST_Distance(
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
    let paramCount = lat !== undefined && lon !== undefined ? 3 : 1;

    // Add lon/lat to params first if location-based
    if (lat !== undefined && lon !== undefined) {
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

    if (mode && mode !== 'both') {
      query += ` AND (c.mode = $${paramCount} OR c.mode = 'both')`;
      params.push(mode);
      paramCount++;
    }

    if (ids) {
      const pieces = ids.split(',');
      if (pieces.length > 1000 || pieces.some(id => !/^[1-9][0-9]*$/.test(id.trim()) || Number(id) > 2147483647)) {
        return res.status(400).json({ error: 'Invalid resource identifiers' });
      }
      const idList = pieces.map(id => Number(id.trim()));
      if (idList.length > 0) {
        query += ` AND r.id = ANY($${paramCount})`;
        params.push(idList);
        paramCount++;
      }
    }

    // Location-based search (radius filter)
    if (lat !== undefined && lon !== undefined) {
      query += ` AND ST_DWithin(
        r.location,
        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
        $${paramCount} * 1609.34
      )`;
      params.push(parseFloat(radius));
      paramCount++;
    }

    // Reuse the validated filter clause and parameter list for a consistent count.
    const filterClause = query.slice(query.indexOf('WHERE r.is_active'));
    const countQuery = `SELECT COUNT(DISTINCT r.id) AS total
      FROM resources r
      LEFT JOIN categories c ON r.primary_category_id = c.id
      ${filterClause}`;
    const countParams = [...params];

    // Group by and order
    query += ` GROUP BY r.id, c.id`;

    // Order by distance if location search, otherwise by name
    if (lat !== undefined && lon !== undefined) {
      query += `, distance ORDER BY distance`;
    } else {
      query += ` ORDER BY r.name`;
    }

    query += ` LIMIT $${paramCount}`;
    params.push(parseInt(limit));

    const result = await pool.query(query, params);

    const countResult = await pool.query(countQuery, countParams);
    const totalCount = parseInt(countResult.rows[0].total);

    res.json({
      count: result.rows.length,
      total: totalCount,
      resources: result.rows
    });
  } catch (error) {
    console.error('Error fetching resources:');
    res.status(500).json({ error: 'Failed to fetch resources' });
  }
});

// Get categories
app.get('/api/categories', validate(schemas.categories, 'query'), async (req, res) => {
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
    console.error('Error fetching categories:');
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Search resources - location-aware
// If lat/lon provided, searches within radius first, then expands if no results
app.get(['/api/search', '/api/resources/search'], validate(schemas.search, 'query'), requireCoordinatePair, async (req, res) => {
  try {
    const { q, lat, lon, radius = 50, limit = 20 } = req.query;

    if (!q) {
      return res.status(400).json({ error: 'Search query required' });
    }

    let result;
    let searchMode = 'global';

    // If location provided, try location-based search first
    if (lat !== undefined && lon !== undefined) {
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
    console.error('Error searching:');
    res.status(500).json({ error: 'Search failed' });
  }
});

// Get stats
app.get('/api/stats', async (req, res) => {
  try {
    const resourceCount = await pool.query('SELECT COUNT(*) FROM resources WHERE is_active = true');
    const categoryCount = await pool.query('SELECT COUNT(*) FROM categories');
    const cityCount = await pool.query('SELECT COUNT(DISTINCT city) FROM resources WHERE is_active = true');

    // New stats
    const pendingCount = await pool.query("SELECT COUNT(*) FROM pending_submissions WHERE status = 'pending'");
    const userCount = await pool.query('SELECT COUNT(*) FROM users');
    const viewCount = await pool.query('SELECT SUM(view_count) as total FROM resources');

    res.json({
      resources: parseInt(resourceCount.rows[0].count),
      categories: parseInt(categoryCount.rows[0].count),
      cities: parseInt(cityCount.rows[0].count),
      pending_submissions: parseInt(pendingCount.rows[0].count),
      users: parseInt(userCount.rows[0].count),
      total_views: parseInt(viewCount.rows[0].total || 0)
    });
  } catch (error) {
    console.error('Error fetching stats:');
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

const cheerio = require('cheerio');

// URL Scanner endpoint
app.post('/api/scan-url', requireAuthenticatedUser, scanLimit, validate(schemas.scan), async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    const html = await fetchPublicHtml(url);
    const $ = cheerio.load(html);
    const scanText = (value, max) => typeof value === 'string'
      ? value.slice(0, max * 2).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max)
      : '';
    // Heuristic extraction examines a bounded text window, separate from fetch limits.
    const bodyText = scanText($('body').text(), 100000);
    const title = scanText($('title').text() || $('meta[property="og:title"]').attr('content'), 500);
    const description = scanText($('meta[name="description"]').attr('content') ||
      $('meta[property="og:description"]').attr('content'), 500);

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
      phone = bodyText.match(phoneRegex)?.[0] || '';
    }

    // Extract Email (look for mailto: link first, then regex)
    let email = $('a[href^="mailto:"]').first().attr('href')?.replace('mailto:', '') || '';
    if (!email) {
      const emailRegex = /([a-zA-Z0-9._-]{1,64}@[a-zA-Z0-9._-]{1,190}\.[a-zA-Z0-9_-]{1,63})/;
      email = bodyText.match(emailRegex)?.[0] || '';
    }

    // Extract Address (Schema.org or common classes)
    let address = '';
    let city = '';
    let state = '';
    let zipCode = '';

    // Try Schema.org Address
    const schemaScript = $('script[type="application/ld+json"]').html();
    if (schemaScript && schemaScript.length <= 65536) {
      try {
        const schema = JSON.parse(schemaScript);
        const graph = Array.isArray(schema?.['@graph']) ? schema['@graph'] : [];
        const postalAddress = schema?.address || graph.find(i => i && typeof i === 'object' && i.address)?.address;
        if (postalAddress) {
          address = scanText(postalAddress.streetAddress, 500);
          city = scanText(postalAddress.addressLocality, 150);
          state = scanText(postalAddress.addressRegion, 2);
          zipCode = scanText(postalAddress.postalCode, 10);
        }
      } catch (e) {
        console.warn('Error parsing schema for address');
      }
    }

    // Fallback: Regex for US Address (Heuristic: Right-to-Left)
    if (!address) {

      // Regex to find ", City, State Zip" or ".City, State Zip" (handling text merge)
      // Group 1: City, Group 2: State, Group 3: Zip (5 digits)
      const stateZipRegex = /(?:,|.)\s*([A-Za-z ]{1,29}?)\s*(?:,|.)\s*([A-Z]{2})\s*(?:,|.)\s*(\d{5}(?:-\d{4})?)/g;

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
    const bodyTextNorm = bodyText;
    // Look for keywords like "Hours", "Open" followed by time patterns
    const hoursRegex = /(?:Hours|Operation|Open)[:\s]+((?:Mon|Tue|Wed|Thu|Fri|Sat|Sun|Daily|Weekdays|Weekends).{0,180}?(?:am|pm|a\.m\.|p\.m\.|:00))/i;
    const hoursMatch = bodyTextNorm.match(hoursRegex);
    if (hoursMatch) {
      hours = hoursMatch[1].trim().substring(0, 100); // Limit length
    }

    // Strategy 2: Look for JSON data in raw HTML
    if (!hours) {
      const openHoursRegex = /"open_hours":(\[.{0,4096}?\])/;
      const jsonMatch = html.slice(0, 200000).match(openHoursRegex);
      if (jsonMatch) {
        try {
          const parsedHours = JSON.parse(jsonMatch[1]);
          const rawHours = Array.isArray(parsedHours) ? parsedHours.slice(0, 31) : [];
          const schedule = rawHours
            .filter(h => h && h.status === 1 && typeof h.start === 'string' && typeof h.end === 'string')
            .map(h => `${scanText(h.start, 30)} - ${scanText(h.end, 30)}`);

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
          console.warn('Error parsing open_hours JSON');
        }
      }
    }

    res.json({
      title: scanText(cleanTitle, 500),
      description: description.substring(0, 500), // Limit length
      url: url,
      phone: scanText(phone, 50),
      email: scanText(email.split('?')[0], 254), // Remove query params from mailto
      address: scanText(address, 500),
      city: scanText(city, 150),
      state: scanText(state, 2),
      zipCode: scanText(zipCode, 10),
      hours: scanText(hours, 2000),
      suggestedCategory: suggestedCategory
    });

  } catch (error) {
    if (error instanceof ScanUrlError) {
      return res.status(error.status).json({ error: error.message });
    }
    res.status(502).json({ error: 'Failed to scan URL. Please enter details manually.' });
  }
});

// Submit a new resource (pending approval)
app.post('/api/submissions', requireAuthenticatedUser, mutationLimit, requireOwnIdentity({ uidFields: ['submittedByUid'] }), validate(schemas.submission), async (req, res) => {
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
    } = req.body;
    const submittedBy = req.auth.email;
    const submittedByName = req.auth.name;
    const submittedByUid = req.auth.uid;
    if (req.body.submittedBy !== undefined && req.body.submittedBy !== submittedBy) {
      return res.status(403).json({ error: 'Cannot submit as another user' });
    }

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
    console.error('Error submitting resource:');
    res.status(500).json({ error: 'Failed to submit resource' });
  }
});

// Get pending submissions (admin only)
app.get('/api/submissions', ...adminOnly, validate({ status: { type: 'enum', values: ['pending', 'approved', 'rejected'] } }, 'query'), async (req, res) => {
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
    console.error('Error fetching submissions:');
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
});

// Approve or reject a submission atomically, locking out repeated review.
app.patch('/api/submissions/:id', ...adminOnly, validate(schemas.review), async (req, res) => {
  let client;
  let transactionOpen = false;
  try {
    const { id } = req.params;
    const { action } = req.body;
    const reviewedBy = req.auth.email || req.auth.uid;
    client = await pool.connect();
    await client.query('BEGIN');
    transactionOpen = true;
    const submission = await client.query('SELECT * FROM pending_submissions WHERE id = $1 FOR UPDATE', [id]);
    if (submission.rows.length === 0 || submission.rows[0].status !== 'pending') {
      await client.query('ROLLBACK');
      transactionOpen = false;
      return res.status(submission.rows.length === 0 ? 404 : 409).json({
        error: submission.rows.length === 0 ? 'Submission not found' : 'Submission has already been reviewed'
      });
    }
    const sub = submission.rows[0];
    let resourceId;
    if (action === 'approve') {
      // Leave room for the hyphen and 36-character UUID in VARCHAR(500).
      const baseSlug = sub.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 463).replace(/-$/, '');
      const slug = `${baseSlug}-${require('node:crypto').randomUUID()}`;
      const newResource = await client.query(`
        INSERT INTO resources (
          name, slug, description, address, city, state, zip_code,
          phone, website, email, hours, primary_category_id,
          food_dist_onsite, food_dist_type,
          is_active, approval_status, location, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, true, 'approved', ST_SetSRID(ST_MakePoint(-90.1843, 38.8906), 4326), NOW())
        RETURNING id
      `, [
        sub.name, slug, sub.description, sub.address, sub.city, sub.state, sub.zip_code,
        sub.phone, sub.website, sub.email, sub.hours, sub.primary_category_id,
        sub.food_dist_onsite, sub.food_dist_type
      ]);
      resourceId = newResource.rows[0].id;
      if (Array.isArray(sub.tags)) {
        for (const tagName of sub.tags) {
          if (typeof tagName !== 'string' || !tagName.trim()) continue;
          const tagSlug = tagName.toLowerCase().replace(/ /g, '-');
          const tagRes = await client.query(`
            INSERT INTO tags (name, slug) VALUES ($1, $2)
            ON CONFLICT (slug) DO UPDATE SET name = $1
            RETURNING id
          `, [tagName, tagSlug]);
          await client.query(`
            INSERT INTO resource_tags (resource_id, tag_id)
            VALUES ($1, $2) ON CONFLICT DO NOTHING
          `, [resourceId, tagRes.rows[0].id]);
        }
      }
    }
    await client.query(`
      UPDATE pending_submissions
      SET status = $1, reviewed_at = NOW(), reviewed_by = $2
      WHERE id = $3
    `, [action === 'approve' ? 'approved' : 'rejected', reviewedBy, id]);
    await client.query('COMMIT');
    transactionOpen = false;
    return res.json({
      success: true,
      message: action === 'approve' ? 'Resource approved and published' : 'Submission rejected',
      ...(resourceId !== undefined ? { resourceId } : {})
    });
  } catch {
    if (client && transactionOpen) {
      try { await client.query('ROLLBACK'); } catch { /* Preserve a generic external error. */ }
    }
    console.error('Error processing submission:');
    return res.status(500).json({ error: 'Failed to process submission' });
  } finally {
    if (client) client.release();
  }
});

// Favorites API
app.get('/api/favorites', requireAuthenticatedUser, requireOwnIdentity(), validate({ uid: { type: 'string', max: 128 } }, 'query'), async (req, res) => {
  try {
    const uid = req.auth.uid;

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
    console.error('Error fetching favorites:');
    res.status(500).json({ error: 'Failed to fetch favorites' });
  }
});

app.post('/api/favorites', requireAuthenticatedUser, mutationLimit, requireOwnIdentity(), validate(schemas.favorite), async (req, res) => {
  try {
    const uid = req.auth.uid;
    const { resourceId } = req.body;

    // Get or Create User
    let userRes = await pool.query('SELECT id FROM users WHERE firebase_uid = $1', [uid]);
    let userId;

    if (userRes.rows.length === 0) {
      if (!req.auth.email) return res.status(400).json({ error: 'An authenticated email address is required' });
      const newUser = await pool.query(
        'INSERT INTO users (firebase_uid, email) VALUES ($1, $2) RETURNING id',
        [uid, req.auth.email]
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
    console.error('Error toggling favorite:');
    res.status(500).json({ error: 'Failed to toggle favorite' });
  }
});

// Update or Create User (Sync)
app.post('/api/users/sync', requireAuthenticatedUser, requireOwnIdentity({ email: true }), validate(schemas.sync), async (req, res) => {
  try {
    const { uid, email } = req.auth;
    const { displayName, photoURL } = req.body;
    if (!email) return res.status(400).json({ error: 'An authenticated email address is required' });
    const result = await pool.query(`
      INSERT INTO users (firebase_uid, email, display_name, photo_url, last_login, is_admin)
      VALUES ($1, $2, $3, $4, NOW(), FALSE)
      ON CONFLICT (firebase_uid)
      DO UPDATE SET
        last_login = NOW(),
        email = EXCLUDED.email,
        display_name = COALESCE(EXCLUDED.display_name, users.display_name),
        photo_url = COALESCE(EXCLUDED.photo_url, users.photo_url)
      RETURNING is_admin
    `, [uid, email, displayName, photoURL]);

    res.json({ success: true, isAdmin: req.auth.emailVerified === true && result.rows[0].is_admin === true });
  } catch (error) {
    console.error('Error syncing user:');
    res.status(500).json({ error: 'Failed to sync user' });
  }
});

// Admin API
app.get('/api/submissions/pending', ...adminOnly, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM pending_submissions
      WHERE status = 'pending'
      ORDER BY created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching submissions:');
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
});

app.get('/api/admin/resources', validate(schemas.adminResources, 'query'), async (req, res) => {
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
      conditions.push(`(r.name ILIKE $${params.length + 1} OR r.city ILIKE $${params.length + 1} OR r.zip_code ILIKE $${params.length + 1} OR r.address ILIKE $${params.length + 1} OR r.website ILIKE $${params.length + 1} OR r.description ILIKE $${params.length + 1})`);
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
    console.error('Error fetching admin resources:');
    res.status(500).json({ error: 'Failed' });
  }
});

app.put('/api/admin/resources/:id', validate(schemas.resource), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name, address, city, state, zip_code, phone, website, email, hours, primary_category_id, is_active,
      eligibility_requirements, appointment_required, walk_ins_accepted,
      food_dist_type, food_dist_onsite, service_area, languages_spoken,
      description, latitude, longitude
    } = req.body;

    // Sanitize Inputs to separate constants to ensure safety
    const cleanCategoryId = primary_category_id === '' ? null : primary_category_id;

    // Ensure latitude/longitude are numbers or null
    const cleanLat = (latitude === '' || latitude === null || isNaN(parseFloat(latitude))) ? null : parseFloat(latitude);
    const cleanLon = (longitude === '' || longitude === null || isNaN(parseFloat(longitude))) ? null : parseFloat(longitude);

    // Generate new slug if name changes (optional, but good practice)
    let slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    slug = `${slug}-${id.slice(-4)}`; // Use ID segment to keep stable

    const languagesArray = typeof languages_spoken === 'string' && languages_spoken.trim()
      ? languages_spoken.split(',').map(language => language.trim()).filter(Boolean)
      : null;

    // Ensure food_dist_type is valid or null
    const validFoodTypes = ['boxes', 'meal', 'both'];
    let cleanFoodType = food_dist_type || null;
    if (cleanFoodType && !validFoodTypes.includes(cleanFoodType)) cleanFoodType = null;

    // Force boolean for onsite
    const cleanOnsite = food_dist_onsite === true || food_dist_onsite === 'true';

    const result = await pool.query(
      `UPDATE resources
         SET name = $1, slug = $2, address = $3, city = $4, state = $5, zip_code = $6,
             phone = $7, website = $8, email = $9, hours = $10, primary_category_id = $11,
             is_active = $12, eligibility_requirements = $13, appointment_required = $14,
             walk_ins_accepted = $15, food_dist_type = $16,
             food_dist_onsite = $17, service_area = $18,
             languages_spoken = $19, description = $20, latitude = $21, longitude = $22
         WHERE id = $23
         RETURNING id, name, email, languages_spoken`,
      [
        name, slug, address, city, state, zip_code,
        phone, website, email, hours, cleanCategoryId,
        is_active, eligibility_requirements, appointment_required,
        walk_ins_accepted, cleanFoodType,
        cleanOnsite, service_area,
        languagesArray, // Use formatted array
        description || null,
        cleanLat,
        cleanLon,
        id
      ]
    );

    // Update location if geocoding needed (client can pass coords, but for now specific updates)
    // Or we could trigger geocoding here. For MVP, we assume editing text fields.

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating resource:');
    res.status(500).json({ error: 'Failed to update resource' });
  }
});

app.post('/api/admin/promote', mutationLimit, validate(schemas.adminEmail), async (req, res) => {
  try {
    const email = req.body.email.toLowerCase();
    const candidates = await pool.query('SELECT firebase_uid FROM users WHERE LOWER(email) = $1', [email]);
    if (candidates.rows.length !== 1 || !candidates.rows[0].firebase_uid) {
      return res.status(400).json({ error: 'A single registered user with a verified email is required' });
    }
    const uid = candidates.rows[0].firebase_uid;
    let identity;
    try {
      identity = await getFirebaseUser(uid);
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        return res.status(403).json({ error: 'The target account must have a verified email' });
      }
      return res.status(503).json({ error: 'Identity verification is temporarily unavailable' });
    }
    if (identity.uid !== uid || identity.disabled || identity.emailVerified !== true ||
        typeof identity.email !== 'string' || identity.email.trim().toLowerCase() !== email) {
      return res.status(403).json({ error: 'The target account must have a verified email' });
    }
    // Grant to the verified immutable identity, never every row sharing an email.
    await pool.query('UPDATE users SET is_admin = TRUE WHERE firebase_uid = $1', [uid]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error promoting user:');
    res.status(500).json({ error: 'Failed to promote user' });
  }
});

app.post('/api/admin/demote', mutationLimit, validate(schemas.adminEmail), async (req, res) => {
  try {
    const { email } = req.body;
    if (email === req.auth.email) {
      return res.status(400).json({ error: 'Use another administrator to change your administrator role' });
    }
    await pool.query('UPDATE users SET is_admin = FALSE WHERE email = $1', [email]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error demoting user:');
    res.status(500).json({ error: 'Failed to demote user' });
  }
});

app.get('/api/admin/list', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, email, display_name, last_login FROM users WHERE is_admin = TRUE ORDER BY email');
    res.json({ admins: result.rows });
  } catch (error) {
    console.error('Error listing admins:');
    res.status(500).json({ error: 'Failed to list admins' });
  }
});

// Get single resource by ID (Public)
app.get('/api/resources/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT r.*, c.name as category_name,
        ST_Y(r.location::geometry) as latitude,
        ST_X(r.location::geometry) as longitude
      FROM resources r
      LEFT JOIN categories c ON r.primary_category_id = c.id
      WHERE r.id = $1 AND r.is_active = true AND r.approval_status = 'approved'
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Resource not found' });
    }

    res.json(publicResource(result.rows[0]));
  } catch (error) {
    console.error('Error fetching resource:');
    res.status(500).json({ error: 'Failed to fetch resource' });
  }
});

app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error.type === 'entity.too.large') return res.status(413).json({ error: 'Request body is too large' });
  if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body' });
  if (error.status === 403) return res.status(403).json({ error: 'Origin not allowed' });
  return res.status(500).json({ error: 'Request could not be completed' });
});

// Export for Firebase Functions
const { onRequest } = require('firebase-functions/v2/https');

exports.api = onRequest({
  memory: '1GiB',
  timeoutSeconds: 120
}, app);

exports.app = app; // Export for testing

// Start server locally (only if not running as a Cloud Function)
if (require.main === module) {
  app.listen(port, () => {
    console.log(`🚀 HumanAid API server running on port ${port}`);
    console.log(`📍 http://localhost:${port}/api/health`);
  });
}
