-- Auto-categorization script for HumanAid resources
-- This script intelligently assigns resources to appropriate categories based on keywords

BEGIN;

-- HEALTHCARE CATEGORIES

-- Dental Care (id: 13)
INSERT INTO resource_categories (resource_id, category_id)
SELECT DISTINCT id, 13 FROM resources WHERE 
  name ILIKE '%dental%' OR name ILIKE '%dentist%' OR name ILIKE '%orthodont%' OR name ILIKE '%tooth%' OR name ILIKE '%teeth%'
  ON CONFLICT DO NOTHING;

-- Vision Care (id: 14)
INSERT INTO resource_categories (resource_id, category_id)
SELECT DISTINCT id, 14 FROM resources WHERE 
  name ILIKE '%vision%' OR name ILIKE '%eye care%' OR name ILIKE '%optom%' OR name ILIKE '%ophthalm%' OR name ILIKE '%glasses%' OR name ILIKE '%eyewear%'
  ON CONFLICT DO NOTHING;

-- Prescription Assistance (id: 15)
INSERT INTO resource_categories (resource_id, category_id)
SELECT DISTINCT id, 15 FROM resources WHERE 
  name ILIKE '%pharmacy%' OR name ILIKE '%prescription%' OR name ILIKE '%medication%' OR name ILIKE '%drug assistance%' OR name ILIKE '%rx%'
  ON CONFLICT DO NOTHING;

-- Mobile Clinics (id: 16)
INSERT INTO resource_categories (resource_id, category_id)
SELECT DISTINCT id, 16 FROM resources WHERE 
  name ILIKE '%mobile clinic%' OR name ILIKE '%mobile health%' OR name ILIKE '%mobile medical%' OR name ILIKE '%health van%'
  ON CONFLICT DO NOTHING;

-- Physical Disabilities (id: 17)
INSERT INTO resource_categories (resource_id, category_id)
SELECT DISTINCT id, 17 FROM resources WHERE 
  name ILIKE '%physical disabilit%' OR name ILIKE '%mobility%' OR name ILIKE '%wheelchair%' OR name ILIKE '%handicap%' OR name ILIKE '%accessible%'
  ON CONFLICT DO NOTHING;

-- Developmental Disabilities (id: 18)
INSERT INTO resource_categories (resource_id, category_id)
SELECT DISTINCT id, 18 FROM resources WHERE 
  name ILIKE '%developmental%' OR name ILIKE '%autism%' OR name ILIKE '%special needs%' OR name ILIKE '%intellectual disabilit%' OR name ILIKE '%down syndrome%'
  ON CONFLICT DO NOTHING;

-- Assistive Technology (id: 20)
INSERT INTO resource_categories (resource_id, category_id)
SELECT DISTINCT id, 20 FROM resources WHERE 
  name ILIKE '%assistive tech%' OR name ILIKE '%adaptive equipment%' OR name ILIKE '%hearing aid%' OR name ILIKE '%medical device%'
  ON CONFLICT DO NOTHING;

-- HOUSING & SHELTER

-- Transitional Housing (id: 7)
INSERT INTO resource_categories (resource_id, category_id)
SELECT DISTINCT id, 7 FROM resources WHERE 
  name ILIKE '%transitional hous%' OR name ILIKE '%transition%home%' OR name ILIKE '%halfway house%' OR name ILIKE '%sober house%'
  ON CONFLICT DO NOTHING;

-- Permanent Housing (id: 8)
INSERT INTO resource_categories (resource_id, category_id)
SELECT DISTINCT id, 8 FROM resources WHERE 
  name ILIKE '%permanent hous%' OR name ILIKE '%affordable hous%' OR name ILIKE '%low income housing%' OR name ILIKE '%subsidized hous%' OR name ILIKE '%section 8%'
  ON CONFLICT DO NOTHING;

-- Youth Shelters (id: 9)
INSERT INTO resource_categories (resource_id, category_id)
SELECT DISTINCT id, 9 FROM resources WHERE 
  name ILIKE '%youth shelter%' OR name ILIKE '%teen shelter%' OR name ILIKE '%runaway%' OR name ILIKE '%youth hous%'
  ON CONFLICT DO NOTHING;

-- Veterans Housing (id: 10)
INSERT INTO resource_categories (resource_id, category_id)
SELECT DISTINCT id, 10 FROM resources WHERE 
  (name ILIKE '%veteran%' OR name ILIKE '%vets%' OR name ILIKE '%va %') AND (name ILIKE '%hous%' OR name ILIKE '%shelter%')
  ON CONFLICT DO NOTHING;

-- Home Maintenance (id: 19)
INSERT INTO resource_categories (resource_id, category_id)
SELECT DISTINCT id, 19 FROM resources WHERE 
  name ILIKE '%home repair%' OR name ILIKE '%weatherization%' OR name ILIKE '%home maintenance%' OR name ILIKE '%housing rehab%'
  ON CONFLICT DO NOTHING;

-- FAMILY & CHILDREN

-- Childcare Assistance (id: 24)
INSERT INTO resource_categories (resource_id, category_id)
SELECT DISTINCT id, 24 FROM resources WHERE 
  name ILIKE '%childcare%' OR name ILIKE '%child care%' OR name ILIKE '%daycare%' OR name ILIKE '%day care%' OR name ILIKE '%preschool%' OR name ILIKE '%early childhood%'
  ON CONFLICT DO NOTHING;

-- Parenting Classes (id: 25)
INSERT INTO resource_categories (resource_id, category_id)
SELECT DISTINCT id, 25 FROM resources WHERE 
  name ILIKE '%parenting class%' OR name ILIKE '%parent educat%' OR name ILIKE '%family educat%' OR name ILIKE '%parent training%'
  ON CONFLICT DO NOTHING;

-- Youth Programs (id: 26)
INSERT INTO resource_categories (resource_id, category_id)
SELECT DISTINCT id, 26 FROM resources WHERE 
  name ILIKE '%youth program%' OR name ILIKE '%youth center%' OR name ILIKE '%teen program%' OR name ILIKE '%after school%' OR name ILIKE '%boys & girls club%' OR name ILIKE '%ymca%' OR name ILIKE '%ywca%'
  ON CONFLICT DO NOTHING;

-- Foster Care Support (id: 27)
INSERT INTO resource_categories (resource_id, category_id)
SELECT DISTINCT id, 27 FROM resources WHERE 
  name ILIKE '%foster care%' OR name ILIKE '%foster%' OR name ILIKE '%adoption%'
  ON CONFLICT DO NOTHING;

-- Baby Supplies (id: 50)
INSERT INTO resource_categories (resource_id, category_id)
SELECT DISTINCT id, 50 FROM resources WHERE 
  name ILIKE '%baby%' OR name ILIKE '%infant%' OR name ILIKE '%diaper%' OR name ILIKE '%formula%' OR name ILIKE '%newborn%'
  ON CONFLICT DO NOTHING;

-- Breastfeeding Support (id: 51)
INSERT INTO resource_categories (resource_id, category_id)
SELECT DISTINCT id, 51 FROM resources WHERE 
  name ILIKE '%breastfeed%' OR name ILIKE '%lactation%' OR name ILIKE '%nursing%mother%' OR name ILIKE '%wic%'
  ON CONFLICT DO NOTHING;

-- Prenatal Care (id: 49)
INSERT INTO resource_categories (resource_id, category_id)
SELECT DISTINCT id, 49 FROM resources WHERE 
  name ILIKE '%prenatal%' OR name ILIKE '%pregnancy%' OR name ILIKE '%maternal%' OR name ILIKE '%expectant mother%' OR name ILIKE '%maternity%'
  ON CONFLICT DO NOTHING;

-- EDUCATION & EMPLOYMENT

-- Adult Education (id: 28)
INSERT INTO resource_categories (resource_id, category_id)
SELECT DISTINCT id, 28 FROM resources WHERE 
  name ILIKE '%adult educat%' OR name ILIKE '%ged%' OR name ILIKE '%literacy%' OR name ILIKE '%esl%' OR name ILIKE '%english class%'
  ON CONFLICT DO NOTHING;

-- Career Services (id: 30)
INSERT INTO resource_categories (resource_id, category_id)
SELECT DISTINCT id, 30 FROM resources WHERE 
  name ILIKE '%career%' OR name ILIKE '%employment%' OR name ILIKE '%workforce%' OR name ILIKE '%job training%'
  ON CONFLICT DO NOTHING;

-- Computer Training (id: 31)
INSERT INTO resource_categories (resource_id, category_id)
SELECT DISTINCT id, 31 FROM resources WHERE 
  name ILIKE '%computer train%' OR name ILIKE '%digital literacy%' OR name ILIKE '%tech training%' OR name ILIKE '%it training%'
  ON CONFLICT DO NOTHING;

-- Job Search Assistance (id: 32)
INSERT INTO resource_categories (resource_id, category_id)
SELECT DISTINCT id, 32 FROM resources WHERE 
  name ILIKE '%job search%' OR name ILIKE '%job placement%' OR name ILIKE '%hiring%' OR name ILIKE '%employment service%'
  ON CONFLICT DO NOTHING;

-- Work Programs (id: 33)
INSERT INTO resource_categories (resource_id, category_id)
SELECT DISTINCT id, 33 FROM resources WHERE 
  name ILIKE '%work program%' OR name ILIKE '%vocational%' OR name ILIKE '%apprentice%' OR name ILIKE '%job corps%'
  ON CONFLICT DO NOTHING;

-- Unemployment Help (id: 34)
INSERT INTO resource_categories (resource_id, category_id)
SELECT DISTINCT id, 34 FROM resources WHERE 
  name ILIKE '%unemployment%' OR name ILIKE '%job loss%' OR name ILIKE '%laid off%'
  ON CONFLICT DO NOTHING;

-- LEGAL & IMMIGRATION

-- Immigration Services (id: 36)
INSERT INTO resource_categories (resource_id, category_id)
SELECT DISTINCT id, 36 FROM resources WHERE 
  name ILIKE '%immigration%' OR name ILIKE '%immigrant%' OR name ILIKE '%refugee%' OR name ILIKE '%citizenship%' OR name ILIKE '%visa%'
  ON CONFLICT DO NOTHING;

-- Criminal Justice (id: 37)
INSERT INTO resource_categories (resource_id, category_id)
SELECT DISTINCT id, 37 FROM resources WHERE 
  name ILIKE '%criminal justice%' OR name ILIKE '%re-entry%' OR name ILIKE '%reentry%' OR name ILIKE '%formerly incarcerated%' OR name ILIKE '%expungement%'
  ON CONFLICT DO NOTHING;

-- Language Services (id: 53)
INSERT INTO resource_categories (resource_id, category_id)
SELECT DISTINCT id, 53 FROM resources WHERE 
  name ILIKE '%translation%' OR name ILIKE '%interpreter%' OR name ILIKE '%language%' OR name ILIKE '%bilingual%'
  ON CONFLICT DO NOTHING;

-- Refugee Resettlement (id: 52)
INSERT INTO resource_categories (resource_id, category_id)
SELECT DISTINCT id, 52 FROM resources WHERE 
  name ILIKE '%refugee%' OR name ILIKE '%resettlement%' OR name ILIKE '%asylum%'
  ON CONFLICT DO NOTHING;

-- TRANSPORTATION

-- Public Transit (id: 38)
INSERT INTO resource_categories (resource_id, category_id)
SELECT DISTINCT id, 38 FROM resources WHERE 
  name ILIKE '%public transit%' OR name ILIKE '%bus pass%' OR name ILIKE '%transit card%' OR name ILIKE '%transportation voucher%'
  ON CONFLICT DO NOTHING;

-- Medical Transportation (id: 39)
INSERT INTO resource_categories (resource_id, category_id)
SELECT DISTINCT id, 39 FROM resources WHERE 
  name ILIKE '%medical transport%' OR name ILIKE '%health transport%' OR name ILIKE '%patient transport%' OR name ILIKE '%ambulance%'
  ON CONFLICT DO NOTHING;

-- Vehicle Programs (id: 40)
INSERT INTO resource_categories (resource_id, category_id)
SELECT DISTINCT id, 40 FROM resources WHERE 
  name ILIKE '%car donation%' OR name ILIKE '%vehicle%' OR name ILIKE '%auto%' OR name ILIKE '%transportation assist%'
  ON CONFLICT DO NOTHING;

-- FINANCIAL

-- Utility Assistance (id: 41)
INSERT INTO resource_categories (resource_id, category_id)
SELECT DISTINCT id, 41 FROM resources WHERE 
  name ILIKE '%utility%' OR name ILIKE '%energy assist%' OR name ILIKE '%liheap%' OR name ILIKE '%electric%bill%' OR name ILIKE '%gas bill%' OR name ILIKE '%water bill%'
  ON CONFLICT DO NOTHING;

-- Emergency Financial Aid (id: 42)
INSERT INTO resource_categories (resource_id, category_id)
SELECT DISTINCT id, 42 FROM resources WHERE 
  name ILIKE '%emergency fund%' OR name ILIKE '%financial emergency%' OR name ILIKE '%crisis fund%' OR name ILIKE '%emergency assist%'
  ON CONFLICT DO NOTHING;

-- Financial Literacy (id: 43)
INSERT INTO resource_categories (resource_id, category_id)
SELECT DISTINCT id, 43 FROM resources WHERE 
  name ILIKE '%financial literacy%' OR name ILIKE '%money management%' OR name ILIKE '%budgeting%' OR name ILIKE '%credit counseling%'
  ON CONFLICT DO NOTHING;

-- VETERANS

-- VA Benefits (id: 44)
INSERT INTO resource_categories (resource_id, category_id)
SELECT DISTINCT id, 44 FROM resources WHERE 
  name ILIKE '%va benefit%' OR name ILIKE '%veterans benefit%' OR name ILIKE '%gi bill%' OR name ILIKE '%veterans admin%'
  ON CONFLICT DO NOTHING;

-- Veterans Support (id: 45)
INSERT INTO resource_categories (resource_id, category_id)
SELECT DISTINCT id, 45 FROM resources WHERE 
  (name ILIKE '%veteran%' OR name ILIKE '%vets%' OR name ILIKE '%va %' OR name ILIKE '%american legion%' OR name ILIKE '%vfw%') 
  AND NOT EXISTS (SELECT 1 FROM resource_categories rc WHERE rc.resource_id = resources.id AND rc.category_id IN (10, 44))
  ON CONFLICT DO NOTHING;

-- CRISIS & SUPPORT

-- Domestic Violence (id: 54)
INSERT INTO resource_categories (resource_id, category_id)
SELECT DISTINCT id, 54 FROM resources WHERE 
  name ILIKE '%domestic violence%' OR name ILIKE '%intimate partner%' OR name ILIKE '%family violence%' OR name ILIKE '%abuse shelter%' OR name ILIKE '%safe house%'
  ON CONFLICT DO NOTHING;

-- Sexual Assault (id: 55)
INSERT INTO resource_categories (resource_id, category_id)
SELECT DISTINCT id, 55 FROM resources WHERE 
  name ILIKE '%sexual assault%' OR name ILIKE '%rape crisis%' OR name ILIKE '%sexual abuse%'
  ON CONFLICT DO NOTHING;

-- Suicide Prevention (id: 56)
INSERT INTO resource_categories (resource_id, category_id)
SELECT DISTINCT id, 56 FROM resources WHERE 
  name ILIKE '%suicide%' OR name ILIKE '%crisis line%' OR name ILIKE '%crisis hotline%' OR name ILIKE '%988%'
  ON CONFLICT DO NOTHING;

-- Disaster Relief (id: 57)
INSERT INTO resource_categories (resource_id, category_id)
SELECT DISTINCT id, 57 FROM resources WHERE 
  name ILIKE '%disaster%' OR name ILIKE '%emergency relief%' OR name ILIKE '%red cross%' OR name ILIKE '%fema%'
  ON CONFLICT DO NOTHING;

-- Support Groups (id: 22)
INSERT INTO resource_categories (resource_id, category_id)
SELECT DISTINCT id, 22 FROM resources WHERE 
  name ILIKE '%support group%' OR name ILIKE '%peer support%' OR name ILIKE '%group therapy%' OR name ILIKE '%12 step%' OR name ILIKE '%aa %' OR name ILIKE '%na %'
  ON CONFLICT DO NOTHING;

-- Sober Living (id: 23)
INSERT INTO resource_categories (resource_id, category_id)
SELECT DISTINCT id, 23 FROM resources WHERE 
  name ILIKE '%sober living%' OR name ILIKE '%recovery hous%' OR name ILIKE '%halfway house%' OR name ILIKE '%rehab%'
  ON CONFLICT DO NOTHING;

-- Elder Abuse Prevention (id: 48)
INSERT INTO resource_categories (resource_id, category_id)
SELECT DISTINCT id, 48 FROM resources WHERE 
  name ILIKE '%elder abuse%' OR name ILIKE '%senior protect%' OR name ILIKE '%adult protective%'
  ON CONFLICT DO NOTHING;

-- Home Care (id: 47)
INSERT INTO resource_categories (resource_id, category_id)
SELECT DISTINCT id, 47 FROM resources WHERE 
  name ILIKE '%home care%' OR name ILIKE '%home health%' OR name ILIKE '%in-home%' OR name ILIKE '%homemaker%' OR name ILIKE '%visiting nurse%'
  ON CONFLICT DO NOTHING;

-- HYGIENE & ESSENTIALS

-- Hygiene Products (id: 59)
INSERT INTO resource_categories (resource_id, category_id)
SELECT DISTINCT id, 59 FROM resources WHERE 
  name ILIKE '%hygiene%' OR name ILIKE '%toiletries%' OR name ILIKE '%personal care%' OR name ILIKE '%shower%' OR name ILIKE '%bathroom%'
  ON CONFLICT DO NOTHING;

-- Laundry Services (id: 60)
INSERT INTO resource_categories (resource_id, category_id)
SELECT DISTINCT id, 60 FROM resources WHERE 
  name ILIKE '%laundry%' OR name ILIKE '%washing%' OR name ILIKE '%laundromat%'
  ON CONFLICT DO NOTHING;

-- PET SERVICES

-- Pet Food Banks (id: 61)
INSERT INTO resource_categories (resource_id, category_id)
SELECT DISTINCT id, 61 FROM resources WHERE 
  name ILIKE '%pet food%' OR name ILIKE '%animal food%' OR name ILIKE '%pet pantry%'
  ON CONFLICT DO NOTHING;

-- Veterinary Care (id: 62)
INSERT INTO resource_categories (resource_id, category_id)
SELECT DISTINCT id, 62 FROM resources WHERE 
  name ILIKE '%veterinar%' OR name ILIKE '%vet clinic%' OR name ILIKE '%animal clinic%' OR name ILIKE '%pet care%' OR name ILIKE '%humane society%'
  ON CONFLICT DO NOTHING;

COMMIT;

-- Report results
SELECT 'Auto-categorization complete!' as status;

SELECT c.name, COUNT(rc.resource_id) as resource_count 
FROM categories c 
LEFT JOIN resource_categories rc ON c.id = rc.category_id 
GROUP BY c.id, c.name
HAVING COUNT(rc.resource_id) > 0
ORDER BY resource_count DESC;
