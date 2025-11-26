-- Comprehensive Database Cleanup
-- Removes all commercial businesses in one go

BEGIN;

-- First, let's see what we'll remove
CREATE TEMP TABLE to_remove AS
SELECT DISTINCT r.id, r.name, r.city, r.state
FROM resources r
WHERE r.is_active = true
AND (
  -- Restaurants & Food Service
  r.name ~* '(pizza|burger|taco|sub shop|sandwich|grill|diner|restaurant|cafe|coffee shop|bakery|bar & grill|steakhouse|wing|bbq)'
  OR r.name ~* '(portillo|malnati|caputo|cracker barrel|penn station|jersey mike|jimmy john|subway|panera|chipotle)'
  OR r.name ~* '(mcdonald|burger king|wendy|arby|taco bell|kfc|popeye|domino|papa john)'
  
  -- Liquor & Convenience Stores
  OR r.name ~* '(liquor store|wine & spirits|party time liquor|break time|7-eleven|circle k|speedway)'
  
  -- Retail & Shopping
  OR r.name ~* '(walmart|target|costco|sam''s club|aldi|kroger|jewel-osco|schnucks)'
  OR r.name ~* '(mall|shopping center|boutique|clothing store|retail|market place|plaza)'
  OR r.name ~* '(barnes & noble|best buy|home depot|lowe''s|menards)'
  OR r.name ILIKE '%Maximum Clothing%'
  OR r.name ILIKE '%Plato''s Closet%'
  OR r.name ILIKE '%Once Upon A Child%'
  
  -- Gyms & Fitness (commercial only, not YMCAs)
  OR (r.name ~* '(life time|lifetime fitness|la fitness|planet fitness|anytime fitness|24 hour fitness|gold''s gym|crunch fitness)' 
      AND r.name NOT ILIKE '%ymca%')
  
  -- Logistics & Warehouses
  OR r.name ~* '(warehouse|distribution center|logistics|freight|transport|supply chain)'
  OR r.name ~* '(americold|sysco|us foods|gordon food)'
  
  -- Entertainment
  OR r.name ~* '(cinema|movie theater|amc|regal|cinemark|bowling alley|arcade|entertainment center)'
  
  -- Gas Stations & Auto
  OR r.name ~* '(gas station|fuel station|auto repair|car wash|oil change|jiffy lube|midas|pep boys)'
  
  -- Hotels
  OR r.name ~* '(hotel|motel|inn|suites|resort|holiday inn|marriott|hilton|hyatt|best western)'
  
  -- Banks & Financial
  OR r.name ~* '(bank of|chase bank|wells fargo|us bank|bank branch|credit union branch|atm)'
)
-- EXCLUDE legitimate organizations that might match patterns
AND r.name NOT ILIKE '%food pantry%'
AND r.name NOT ILIKE '%food bank%'
AND r.name NOT ILIKE '%soup kitchen%'
AND r.name NOT ILIKE '%salvation army%'
AND r.name NOT ILIKE '%goodwill%'
AND r.name NOT ILIKE '%rescue mission%'
AND r.name NOT ILIKE '%ymca%'
AND r.name NOT ILIKE '%ywca%'
AND r.name NOT ILIKE '%church%'
AND r.name NOT ILIKE '%temple%'
AND r.name NOT ILIKE '%mosque%'
AND r.name NOT ILIKE '%synagogue%'
AND r.name NOT ILIKE '%ministry%'
AND r.name NOT ILIKE '%outreach%'
AND r.name NOT ILIKE '%community center%'
AND r.name NOT ILIKE '%senior center%'
AND r.name NOT ILIKE '%shelter%'
AND r.name NOT ILIKE '%clinic%'
AND r.name NOT ILIKE '%health center%'
AND r.name NOT ILIKE '%thrift shop%'
AND r.name NOT ILIKE '%thrift store%';

-- Show what we found
SELECT COUNT(*) as "Total Commercial Businesses Found" FROM to_remove;

-- Show breakdown by pattern
SELECT 
  CASE
    WHEN name ~* 'pizza|burger|taco|sub|sandwich|grill|restaurant' THEN 'Restaurants'
    WHEN name ~* 'liquor|wine|spirits|break time' THEN 'Liquor/Convenience'
    WHEN name ~* 'walmart|target|mall|retail|boutique|shopping' THEN 'Retail/Shopping'
    WHEN name ~* 'life time|fitness|gym' THEN 'Gyms'
    WHEN name ~* 'warehouse|logistics|distribution' THEN 'Logistics'
    WHEN name ~* 'cinema|theater|entertainment' THEN 'Entertainment'
    WHEN name ~* 'gas|fuel|auto|car wash' THEN 'Gas/Auto'
    WHEN name ~* 'hotel|motel|inn' THEN 'Hotels'
    WHEN name ~* 'bank|credit union|atm' THEN 'Banks'
    ELSE 'Other'
  END as category,
  COUNT(*) as count
FROM to_remove
GROUP BY category
ORDER BY count DESC;

-- Show sample of what will be removed
SELECT name, city, state FROM to_remove ORDER BY name LIMIT 50;

-- Remove them (commented out - uncomment to execute)
-- DELETE FROM resource_categories WHERE resource_id IN (SELECT id FROM to_remove);
-- DELETE FROM resources WHERE id IN (SELECT id FROM to_remove);
-- SELECT COUNT(*) as "Total Removed" FROM to_remove;

ROLLBACK;  -- Change to COMMIT when ready to apply
