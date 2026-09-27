'use strict';

// Public directory fields only. New database columns require an explicit review
// before appearing in this response; actor IDs and moderation data stay private.
const publicFields = Object.freeze([
  'id', 'name', 'slug', 'primary_category_id', 'category_name', 'description',
  'address', 'city', 'state', 'zip_code', 'county', 'latitude', 'longitude',
  'phone', 'email', 'website', 'photo_url', 'hours', 'hours_of_operation',
  'service_area', 'languages_spoken', 'food_dist_onsite', 'food_dist_type',
  'eligibility_requirements', 'required_documents', 'appointment_required',
  'walk_ins_accepted', 'verified', 'verified_at', 'is_active',
  'last_updated', 'created_at'
]);

function publicResource(row) {
  return Object.fromEntries(publicFields
    .filter(field => Object.hasOwn(row, field))
    .map(field => [field, row[field]]));
}

module.exports = { publicResource };
