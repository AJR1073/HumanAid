-- Sample resources for testing HumanAid
-- IL & MO locations

-- ==================== ILLINOIS RESOURCES ====================

-- Food Pantries in Chicago
INSERT INTO resources (name, slug, address, city, state, zip_code, location, phone, website, description, approval_status, is_active, verified) VALUES
('Greater Chicago Food Depository', 'greater-chicago-food-depository', '4100 W Ann Lurie Pl', 'Chicago', 'IL', '60632', ST_SetSRID(ST_MakePoint(-87.7298, 41.8239), 4326), '(773) 247-3663', 'https://www.chicagosfoodbank.org', 'Major food bank serving Cook County with partner pantries throughout the region', 'approved', true, true),
('Lakeview Pantry', 'lakeview-pantry', '3945 N Sheridan Rd', 'Chicago', 'IL', '60613', ST_SetSRID(ST_MakePoint(-87.6520, 41.9550), 4326), '(773) 525-1777', 'https://www.lakeviewpantry.org', 'Provides emergency food, case management, and connections to resources', 'approved', true, true),
('Northside Common Pantry', 'northside-common-pantry', '4800 N Marine Dr', 'Chicago', 'IL', '60640', ST_SetSRID(ST_MakePoint(-87.6549, 41.9700), 4326), '(773) 283-8493', 'https://www.northsidecommonpantry.org', 'Client-choice food pantry serving Uptown and surrounding neighborhoods', 'approved', true, true);

-- Shelters in Chicago
INSERT INTO resources (name, slug, address, city, state, zip_code, location, phone, website, description, approval_status, is_active, verified) VALUES
('Pacific Garden Mission', 'pacific-garden-mission', '1458 S Canal St', 'Chicago', 'IL', '60607', ST_SetSRID(ST_MakePoint(-87.6397, 41.8600), 4326), '(312) 492-9410', 'https://www.pgm.org', '24/7 emergency shelter providing meals, shelter, and recovery programs', 'approved', true, true),
('Cornerstone Community Outreach', 'cornerstone-community', '1048 W Madison St', 'Chicago', 'IL', '60607', ST_SetSRID(ST_MakePoint(-87.6550, 41.8818), 4326), '(312) 600-1664', 'https://www.ccolife.org', 'Comprehensive services including shelter, meals, and life transformation programs', 'approved', true, true);

-- Healthcare in Springfield, IL
INSERT INTO resources (name, slug, address, city, state, zip_code, location, phone, website, description, approval_status, is_active, verified) VALUES
('Heartland Health Outreach', 'heartland-health-outreach', '2101 S State St', 'Springfield', 'IL', '62704', ST_SetSRID(ST_MakePoint(-89.6362, 39.7751), 4326), '(217) 528-7474', 'https://www.heartlandhealth.com', 'Free and low-cost medical, dental, and behavioral health services', 'approved', true, true);

-- ==================== MISSOURI RESOURCES ====================

-- Food Banks in St. Louis
INSERT INTO resources (name, slug, address, city, state, zip_code, location, phone, website, description, approval_status, is_active, verified) VALUES
('St. Louis Area Foodbank', 'st-louis-foodbank', '1644 Lotsie Blvd', 'St. Louis', 'MO', '63132', ST_SetSRID(ST_MakePoint(-90.3461, 38.6706), 4326), '(314) 292-6262', 'https://www.stlfoodbank.org', 'Largest food bank in region, distributing food through 600+ partner agencies', 'approved', true, true),
('Operation Food Search', 'operation-food-search', '1644 Lotsie Blvd', 'Bridgeton', 'MO', '63044', ST_SetSRID(ST_MakePoint(-90.4070, 38.7561), 4326), '(314) 726-5355', 'https://www.operationfoodsearch.org', 'Provides nutritious food and nutrition education to those in need', 'approved', true, true);

-- Shelters in St. Louis
INSERT INTO resources (name, slug, address, city, state, zip_code, location, phone, website, description, approval_status, is_active, verified) VALUES
('The Salvation Army Harbor Light', 'salvation-army-harbor-light-stl', '3900 Lindell Blvd', 'St. Louis', 'MO', '63108', ST_SetSRID(ST_MakePoint(-90.2341, 38.6370), 4326), '(314) 533-3723', 'https://www.salvationarmystl.org', 'Emergency shelter and recovery programs for men', 'approved', true, true),
('Karen House Catholic Worker', 'karen-house', '1840 Hogan St', 'St. Louis', 'MO', '63106', ST_SetSRID(ST_MakePoint(-90.2090, 38.6310), 4326), '(314) 621-4052', NULL, 'Hospitality house for women and children experiencing homelessness', 'approved', true, true);

-- Healthcare in Kansas City, MO
INSERT INTO resources (name, slug, address, city, state, zip_code, location, phone, website, description, approval_status, is_active, verified) VALUES
('Swope Health Services', 'swope-health', '3801 Blue Pkwy', 'Kansas City', 'MO', '64130', ST_SetSRID(ST_MakePoint(-94.5328, 39.0376), 4326), '(816) 923-5800', 'https://www.swopehealth.org', 'Federally qualified health center providing comprehensive medical, dental, and pharmacy services', 'approved', true, true),
('Samuel U. Rodgers Health Center', 'samuel-rodgers', '825 Euclid Ave', 'Kansas City', 'MO', '64124', ST_SetSRID(ST_MakePoint(-94.5551, 39.1048), 4326), '(816) 474-4920', 'https://www.samuelrodgers.com', 'Community health center serving uninsured and underinsured patients', 'approved', true, true);

-- Veterans Services in Springfield, MO
INSERT INTO resources (name, slug, address, city, state, zip_code, location, phone, website, description, approval_status, is_active, verified) VALUES
('Veterans Coming Home Center', 'veterans-coming-home', '1856 E Pythian St', 'Springfield', 'MO', '65802', ST_SetSRID(ST_MakePoint(-93.2696, 37.2000), 4326), '(417) 889-6940', 'https://www.veteranscominghome.org', 'Transitional housing and supportive services for homeless veterans', 'approved', true, true);

-- ==================== LINK RESOURCES TO CATEGORIES ====================

-- Food Pantries
INSERT INTO resource_categories (resource_id, category_id) 
SELECT r.id, c.id FROM resources r, categories c 
WHERE r.slug IN ('greater-chicago-food-depository', 'lakeview-pantry', 'northside-common-pantry', 'st-louis-foodbank', 'operation-food-search') 
AND c.slug = 'food-pantries';

-- Emergency Shelters
INSERT INTO resource_categories (resource_id, category_id) 
SELECT r.id, c.id FROM resources r, categories c 
WHERE r.slug IN ('pacific-garden-mission', 'cornerstone-community', 'salvation-army-harbor-light-stl', 'karen-house') 
AND c.slug = 'emergency-shelters';

-- Free Clinics
INSERT INTO resource_categories (resource_id, category_id) 
SELECT r.id, c.id FROM resources r, categories c 
WHERE r.slug IN ('heartland-health-outreach', 'swope-health', 'samuel-rodgers') 
AND c.slug = 'free-clinics';

-- Veterans Housing
INSERT INTO resource_categories (resource_id, category_id) 
SELECT r.id, c.id FROM resources r, categories c 
WHERE r.slug = 'veterans-coming-home' 
AND c.slug = 'veterans-housing';

-- Veterans Support
INSERT INTO resource_categories (resource_id, category_id) 
SELECT r.id, c.id FROM resources r, categories c 
WHERE r.slug = 'veterans-coming-home' 
AND c.slug = 'veterans-support';
