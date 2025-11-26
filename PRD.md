# HumanAid Platform - Product Requirements Document

## Executive Summary

**HumanAid** is a global humanitarian assistance platform connecting people in need with local resources while empowering communities to donate, volunteer, and sponsor aid programs.

### Mission
Make it effortless for anyone, anywhere to find help or give help.

---

## Core Features

### 1. Dual-Mode Interface
- **"I Need Help"** (Default): Browse assistance resources
- **"I Want to Help"** (Toggle): Find donation/volunteer opportunities
- Seamless mode switching with top-right toggle button

### 2. Geographic Coverage
- **Phase 1**: All cities in Illinois & Missouri
- **Phase 2**: Nationwide USA expansion
- **Phase 3**: Global rollout

### 3. Resource Categories (60+)
Detailed categories and subcategories covering:
- Food assistance (pantries, hot meals, emergency bags)
- Shelter & housing (emergency, transitional, permanent)
- Medical & healthcare
- Disability services
- Veteran support
- Mental health & addiction
- Employment & workforce
- Legal assistance
- Transportation
- Education
- Family & children services
- And 50+ more categories

### 4. Search & Discovery
- **Map-based search** with radius filtering
- **Category filtering** with nested subcategories
- **Location search** by city, zip, or current position
- **Text search** with full-text indexing
- **Urgency filters** for critical needs

### 5. LLM Chatbot Assistant
- Natural language queries: "I need food assistance in St. Louis"
- Personalized recommendations
- Step-by-step guidance
- Multi-language support (future)
- Optional VAPI voice integration (future)

### 6. User Accounts
- **Browsing**: No account required
- **Submitting Resources**: Account required
- **Volunteering**: Account required
- **Donations**: Account required

### 7. Resource Submission & Verification
- Anyone can submit resources
- Admin approval required before publishing
- Community flagging system
- Quality scoring
- Regular verification checks

### 8. Sponsorship System
- Local businesses sponsor programs
- Corporate partnerships
- "Sponsor a Family" campaigns
- Donation matching
- Visibility on resource pages

### 9. Donation & Volunteer Management
- Real-time urgent needs posting
- Volunteer opportunity listings
- Application tracking
- Impact metrics

---

## Technical Stack

### Frontend
- React.js with TypeScript
- Tailwind CSS + shadcn/ui components
- Mapbox/Leaflet for maps
- Responsive PWA design

### Backend
- Node.js + Express API
- Python automation scripts
- Firebase Authentication
- Supabase/PostgreSQL + PostGIS

### Hosting & Infrastructure
- Firebase Hosting
- Cloud Functions for serverless operations
- CDN for global performance

### AI & Automation
- OpenAI GPT-4 for chatbot
- Automated web scraping
- Data verification pipelines

---

## User Flows

### Flow 1: Person in Need
1. Opens app (no account required)
2. Allows location access or enters city
3. Selects category (e.g., "Food")
4. Views map with nearby resources
5. Clicks resource for details
6. Contacts organization directly

### Flow 2: Volunteer/Donor
1. Toggles to "I Want to Help" mode
2. Views urgent needs and opportunities
3. Creates account
4. Signs up for volunteer shift or donates
5. Receives confirmation and impact updates

### Flow 3: Nonprofit Organization
1. Creates verified nonprofit account
2. Submits their services for approval
3. Posts urgent needs (food drive, volunteers needed)
4. Receives sponsorship inquiries
5. Tracks engagement analytics

### Flow 4: Business Sponsor
1. Creates business account
2. Browses sponsorship opportunities
3. Selects cause to support
4. Receives visibility on platform
5. Monitors impact metrics

---

## Security & Privacy

- OAuth 2.0 authentication
- Encrypted API keys
- No personal data collection for browsing
- GDPR/CCPA compliant
- Anonymous usage for vulnerable populations
- Secure admin dashboard with audit logs

---

## Success Metrics

1. **Resource Coverage**: 1,000+ verified resources in IL/MO by Month 3
2. **User Engagement**: 10,000 monthly active users by Month 6
3. **Impact**: 50,000 people helped in Year 1
4. **Donations**: $100K+ facilitated through platform in Year 1
5. **Volunteer Hours**: 5,000+ hours coordinated in Year 1

---

## Future Enhancements

- SMS interface for non-smartphone users
- Voice assistant via VAPI integration
- Multi-language support (Spanish, Arabic, Mandarin)
- Offline mode for disaster scenarios
- Crisis alerts (weather, emergency shelters)
- Integration with 211 database
- API for partner organizations
- Mobile apps (iOS/Android)

---

## Timeline

**Phase 1 (Months 1-2)**: MVP with IL/MO resources, basic map, categories
**Phase 2 (Months 3-4)**: Chatbot, accounts, submission workflow
**Phase 3 (Months 5-6)**: Sponsorships, volunteer management, analytics
**Phase 4 (Months 7-12)**: National expansion, mobile apps, advanced features
