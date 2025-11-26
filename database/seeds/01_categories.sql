-- Seed categories for HumanAid
-- Based on CATEGORIES.md

-- ==================== FOOD ASSISTANCE ====================

INSERT INTO categories (name, slug, icon, color, mode, display_order, description) VALUES
('Food Pantries', 'food-pantries', '🍽️', '#F59E0B', 'need_help', 1, 'Shelf-stable groceries, fresh produce, and family food boxes'),
('Hot Meals', 'hot-meals', '🍲', '#F59E0B', 'need_help', 2, 'Soup kitchens, community meals, and Meals on Wheels'),
('Emergency Food', 'emergency-food', '🆘', '#EF4444', 'need_help', 3, 'Emergency food bags and weekend food programs'),
('Food Banks', 'food-banks', '🏢', '#F59E0B', 'need_help', 4, 'Large-scale distribution centers and mobile food pantries');

-- ==================== SHELTER & HOUSING ====================

INSERT INTO categories (name, slug, icon, color, mode, display_order, description) VALUES
('Emergency Shelters', 'emergency-shelters', '🏠', '#EF4444', 'need_help', 5, 'Overnight shelters, warming centers, and 24/7 facilities'),
('Family Shelters', 'family-shelters', '👨‍👩‍👧', '#EF4444', 'need_help', 6, 'Family-specific housing and domestic violence shelters'),
('Transitional Housing', 'transitional-housing', '🏘️', '#3B82F6', 'need_help', 7, 'Temporary housing with supportive services (30-180 days)'),
('Permanent Housing', 'permanent-housing', '🏡', '#3B82F6', 'need_help', 8, 'Affordable housing, Section 8, and rent assistance'),
('Youth Shelters', 'youth-shelters', '👦', '#EF4444', 'need_help', 9, 'Runaway youth and foster care transition housing'),
('Veterans Housing', 'veterans-housing', '🎖️', '#3B82F6', 'need_help', 10, 'Veterans shelters and VA housing programs');

-- ==================== MEDICAL & HEALTHCARE ====================

INSERT INTO categories (name, slug, icon, color, mode, display_order, description) VALUES
('Free Clinics', 'free-clinics', '🏥', '#10B981', 'need_help', 11, 'Walk-in clinics with sliding scale fees'),
('Mental Health Services', 'mental-health', '🧠', '#8B5CF6', 'need_help', 12, 'Counseling, crisis intervention, and therapy'),
('Dental Care', 'dental-care', '🦷', '#10B981', 'need_help', 13, 'Free and low-cost dental services'),
('Vision Care', 'vision-care', '👓', '#10B981', 'need_help', 14, 'Free eye exams and glasses programs'),
('Prescription Assistance', 'prescription-assistance', '💊', '#10B981', 'need_help', 15, 'Medication vouchers and drug discounts'),
('Mobile Clinics', 'mobile-clinics', '🚑', '#10B981', 'need_help', 16, 'Community health vans and mobile dental units');

-- ==================== DISABILITY SERVICES ====================

INSERT INTO categories (name, slug, icon, color, mode, display_order, description) VALUES
('Physical Disabilities', 'physical-disabilities', '♿', '#6366F1', 'need_help', 17, 'Adaptive equipment and accessibility support'),
('Developmental Disabilities', 'developmental-disabilities', '🧩', '#6366F1', 'need_help', 18, 'Day programs and life skills training'),
('Home Maintenance', 'home-maintenance', '🔧', '#6366F1', 'need_help', 19, 'Yard work, repairs, and ramp installation'),
('Assistive Technology', 'assistive-technology', '🦼', '#6366F1', 'need_help', 20, 'Wheelchairs, communication devices, mobility aids');

-- ==================== ADDICTION & RECOVERY ====================

INSERT INTO categories (name, slug, icon, color, mode, display_order, description) VALUES
('Substance Abuse Treatment', 'substance-abuse', '💊', '#8B5CF6', 'need_help', 21, 'Detox programs, rehab, and outpatient services'),
('Support Groups', 'support-groups', '🤝', '#8B5CF6', 'need_help', 22, 'AA/NA meetings and peer recovery'),
('Sober Living', 'sober-living', '🏠', '#8B5CF6', 'need_help', 23, 'Recovery housing and halfway houses');

-- ==================== FAMILY & CHILDREN ====================

INSERT INTO categories (name, slug, icon, color, mode, display_order, description) VALUES
('Childcare Assistance', 'childcare', '👶', '#EC4899', 'need_help', 24, 'Daycare vouchers and after-school programs'),
('Parenting Classes', 'parenting', '👪', '#EC4899', 'need_help', 25, 'New parent support and home visiting programs'),
('Youth Programs', 'youth-programs', '🎯', '#EC4899', 'need_help', 26, 'Mentoring, recreation, and educational support'),
('Foster Care Support', 'foster-care', '❤️', '#EC4899', 'need_help', 27, 'Foster family resources and adoption assistance');

-- ==================== EDUCATION & TRAINING ====================

INSERT INTO categories (name, slug, icon, color, mode, display_order, description) VALUES
('Adult Education', 'adult-education', '📚', '#14B8A6', 'need_help', 28, 'GED programs, ESL classes, and literacy'),
('Job Training', 'job-training', '🎓', '#14B8A6', 'need_help', 29, 'Vocational training and apprenticeships'),
('Career Services', 'career-services', '💼', '#14B8A6', 'need_help', 30, 'Resume help and job placement'),
('Computer Training', 'computer-training', '💻', '#14B8A6', 'need_help', 31, 'Digital literacy and technology classes');

-- ==================== EMPLOYMENT ====================

INSERT INTO categories (name, slug, icon, color, mode, display_order, description) VALUES
('Job Search Assistance', 'job-search', '🔍', '#F59E0B', 'need_help', 32, 'Job boards and employment agencies'),
('Work Programs', 'work-programs', '👷', '#F59E0B', 'need_help', 33, 'Transitional employment and job coaches'),
('Unemployment Help', 'unemployment', '📋', '#F59E0B', 'need_help', 34, 'Benefits assistance and claim filing');

-- ==================== LEGAL ASSISTANCE ====================

INSERT INTO categories (name, slug, icon, color, mode, display_order, description) VALUES
('Free Legal Aid', 'legal-aid', '⚖️', '#6366F1', 'need_help', 35, 'Civil legal help and eviction defense'),
('Immigration Services', 'immigration', '🌍', '#6366F1', 'need_help', 36, 'Immigration legal help and citizenship classes'),
('Criminal Justice', 'criminal-justice', '🏛️', '#6366F1', 'need_help', 37, 'Reentry programs and expungement help');

-- ==================== TRANSPORTATION ====================

INSERT INTO categories (name, slug, icon, color, mode, display_order, description) VALUES
('Public Transit', 'public-transit', '🚌', '#3B82F6', 'need_help', 38, 'Bus passes and reduced fares'),
('Medical Transportation', 'medical-transport', '🚑', '#3B82F6', 'need_help', 39, 'Non-emergency transport and wheelchair vans'),
('Vehicle Programs', 'vehicle-programs', '🚗', '#3B82F6', 'need_help', 40, 'Car donation programs and gas vouchers');

-- ==================== FINANCIAL ASSISTANCE ====================

INSERT INTO categories (name, slug, icon, color, mode, display_order, description) VALUES
('Utility Assistance', 'utility-assistance', '💡', '#10B981', 'need_help', 41, 'Electric, gas, and water bill help'),
('Emergency Financial Aid', 'emergency-financial', '💰', '#EF4444', 'need_help', 42, 'Rent assistance and eviction prevention'),
('Financial Literacy', 'financial-literacy', '📊', '#10B981', 'need_help', 43, 'Budgeting classes and credit counseling');

-- ==================== VETERANS SERVICES ====================

INSERT INTO categories (name, slug, icon, color, mode, display_order, description) VALUES
('VA Benefits', 'va-benefits', '🎖️', '#DC2626', 'need_help', 44, 'Benefits enrollment and claims assistance'),
('Veterans Support', 'veterans-support', '🇺🇸', '#DC2626', 'need_help', 45, 'Veteran service officers and peer support');

-- ==================== SENIOR SERVICES ====================

INSERT INTO categories (name, slug, icon, color, mode, display_order, description) VALUES
('Senior Centers', 'senior-centers', '👵', '#F59E0B', 'need_help', 46, 'Activities, socialization, and meals'),
('Home Care', 'home-care', '🏠', '#F59E0B', 'need_help', 47, 'In-home support and personal care'),
('Elder Abuse Prevention', 'elder-abuse', '🛡️', '#EF4444', 'need_help', 48, 'Protective services and legal advocacy');

-- ==================== MATERNAL & INFANT ====================

INSERT INTO categories (name, slug, icon, color, mode, display_order, description) VALUES
('Prenatal Care', 'prenatal-care', '🤰', '#EC4899', 'need_help', 49, 'Pregnancy support and maternal health'),
('Baby Supplies', 'baby-supplies', '👶', '#EC4899', 'need_help', 50, 'Diapers, formula, clothing, and cribs'),
('Breastfeeding Support', 'breastfeeding', '🍼', '#EC4899', 'need_help', 51, 'Lactation consultants and pumps');

-- ==================== IMMIGRANT & REFUGEE ====================

INSERT INTO categories (name, slug, icon, color, mode, display_order, description) VALUES
('Refugee Resettlement', 'refugee-resettlement', '🌍', '#14B8A6', 'need_help', 52, 'Case management and cultural orientation'),
('Language Services', 'language-services', '🗣️', '#14B8A6', 'need_help', 53, 'Interpretation, translation, and ESL');

-- ==================== CRISIS & EMERGENCY ====================

INSERT INTO categories (name, slug, icon, color, mode, display_order, description) VALUES
('Domestic Violence', 'domestic-violence', '🆘', '#DC2626', 'need_help', 54, 'Emergency shelters and crisis hotlines'),
('Sexual Assault', 'sexual-assault', '🚨', '#DC2626', 'need_help', 55, 'Rape crisis centers and counseling'),
('Suicide Prevention', 'suicide-prevention', '☎️', '#DC2626', 'need_help', 56, 'Crisis hotlines and mental health crisis support'),
('Disaster Relief', 'disaster-relief', '⛑️', '#DC2626', 'need_help', 57, 'Emergency supplies and temporary shelter');

-- ==================== HYGIENE & CLOTHING ====================

INSERT INTO categories (name, slug, icon, color, mode, display_order, description) VALUES
('Clothing Closets', 'clothing', '👕', '#8B5CF6', 'need_help', 58, 'Free clothing and professional attire'),
('Hygiene Products', 'hygiene', '🧼', '#8B5CF6', 'need_help', 59, 'Toiletries and feminine products'),
('Laundry Services', 'laundry', '🧺', '#8B5CF6', 'need_help', 60, 'Free laundry and showers');

-- ==================== PET ASSISTANCE ====================

INSERT INTO categories (name, slug, icon, color, mode, display_order, description) VALUES
('Pet Food Banks', 'pet-food', '🐾', '#F59E0B', 'need_help', 61, 'Free pet food and supplies'),
('Veterinary Care', 'veterinary', '🐕', '#F59E0B', 'need_help', 62, 'Low-cost vet services and spay/neuter');

-- ==================== DONATION & VOLUNTEER (I WANT TO HELP MODE) ====================

INSERT INTO categories (name, slug, icon, color, mode, display_order, description) VALUES
('Donate Money', 'donate-money', '💵', '#22C55E', 'want_help', 63, 'One-time donations and monthly giving'),
('Donate Goods', 'donate-goods', '📦', '#22C55E', 'want_help', 64, 'Food drives and clothing donations'),
('Volunteer Time', 'volunteer', '🤝', '#22C55E', 'want_help', 65, 'One-time events and regular volunteering'),
('Business Sponsorships', 'business-sponsor', '🏢', '#22C55E', 'want_help', 66, 'Corporate partnerships and employee giving');
