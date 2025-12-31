const axios = require('axios');
const cheerio = require('cheerio');

async function testScrape() {
    const url = 'https://www.seniorservicesplus.org/';
    try {
        console.log('Fetching:', url);
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        const html = response.data;
        const $ = cheerio.load(html);
        const bodyText = $('body').text().replace(/\s+/g, ' ');

        console.log('--- Body Text Snippet ---');
        console.log(bodyText.substring(bodyText.indexOf('2603'), bodyText.indexOf('2603') + 200));
        console.log('-------------------------');

        // Initial Regex (Failed?)
        const addressRegex = /([0-9]+[ ].+?)[, ]+([A-Za-z ]+?)[, ]+([A-Z]{2})[, ]+([0-9]{5}(?:-[0-9]{4})?)/;
        const match = bodyText.match(addressRegex);
        console.log('Old Regex Match:', match ? match[0] : 'No match');

        // New Proposed Regex (More flexible)
        // Looks for: Number ... City, State Zip
        // We look for the State Zip anchor and grab the preceding text
        const flexibleRegex = /([0-9]+\s+[^,]+(?:\s+[^,]+)*?)\s*,?\s*([A-Za-z\s]+?)\s*,?\s*([A-Z]{2})\s*,?\s*([0-9]{5}(?:-[0-9]{4})?)/;
        // Make sure it captures "2603 N. Rodgers"
        // Let's try to match specifically near the known address to test the regex
        const textSegment = bodyText.substring(bodyText.indexOf('2603'));
        const flexMatch = textSegment.match(flexibleRegex);
        console.log('Flexible Regex Match (on segment):', flexMatch ? flexMatch[0] : 'No match');

        // Hours JSON Check
        const openHoursRegex = /"open_hours":(\[.*?\])/;
        const jsonMatch = html.match(openHoursRegex);
        console.log('JSON Hours Match:', jsonMatch ? 'Found JSON' : 'No JSON found');

    } catch (e) {
        console.error('Error:', e.message);
    }
}

testScrape();
