const axios = require('axios');
const cheerio = require('cheerio');

async function testo() {
    const url = 'https://www.seniorservicesplus.org/';
    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        console.log('Status:', response.status);
        const html = response.data;
        // console.log('HTML Preview:', html.substring(0, 500));

        const $ = cheerio.load(html);
        const bodyText = $('body').text().replace(/\s+/g, ' ');

        console.log('Body Text Preview:', bodyText.substring(0, 1000));

        // Test Address Regex
        const addressRegex = /([0-9]+[ ].+?)[, ]+([A-Za-z ]+?)[, ]+([A-Z]{2})[, ]+([0-9]{5}(?:-[0-9]{4})?)/;
        const match = bodyText.match(addressRegex);
        console.log('Address Match:', match ? match[0] : 'No match');

        // Test Hours Regex
        const hoursRegex = /(?:Hours|Operation|Open)[:\s]+((?:Mon|Tue|Wed|Thu|Fri|Sat|Sun|Daily|Weekdays|Weekends).*?(?:am|pm|a\.m\.|p\.m\.|:00))/i;
        const hoursMatch = bodyText.match(hoursRegex);
        console.log('Hours Match:', hoursMatch ? hoursMatch[1] : 'No match');

        // Check for specific text the user mentioned
        console.log('Contains "2603 N. Rodgers":', bodyText.includes('2603 N. Rodgers'));
        console.log('Contains "Alton":', bodyText.includes('Alton'));

    } catch (e) {
        console.error(e);
    }
}

testo();
