const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const https = require('https');

// Create an Axios instance that ignores SSL errors
const axiosInstance = axios.create({
    httpsAgent: new https.Agent({
        rejectUnauthorized: false // Disables SSL verification (for development only)
    })
});

// Function to fetch match summary links
async function fetchMatchSummaryLinks(url) {
    try {
        const { data } = await axiosInstance.get(url);
        const $ = cheerio.load(data);
        const links = [];
        const allRows = $('a[title^="T20I"]'); // Looking for links with titles that start with "T20I"
        console.log(`Found ${allRows.length} rows`);

        allRows.each((index, element) => {
            const rowURL = $(element).attr('href');
            if (rowURL) {
                const fullURL = "https://www.espncricinfo.com" + rowURL;
                links.push(fullURL);
            }
        });

        return links;
    } catch (error) {
        console.error('Error fetching match summary links:', error);
        return [];
    }
}

// Function to fetch only bowling summaries from match URLs
async function fetchBowlingSummary(url) {
    console.log("Fetching bowling summary from URL: ", url);
    try {
        const { data } = await axiosInstance.get(url);
        const $ = cheerio.load(data);

        // Extract bowling data
        const bowlingSummary = [];
        const bowlingTables = $('div > table.ds-table');

        // Bowling summaries
        bowlingTables.each((index, table) => {
            const rows = $(table).find('tbody > tr').filter(function () {
                return $(this).find("td").length >= 11;
            });

            rows.each((idx, row) => {
                const tds = $(row).find('td');
                const playerName = $(tds.eq(0)).find('a > span').text().trim();
                const overs = $(tds.eq(1)).text().trim();
                const runs = $(tds.eq(2)).text().trim();
                const wickets = $(tds.eq(3)).text().trim();
                const economy = $(tds.eq(4)).text().trim();

                bowlingSummary.push({
                    playerName,
                    overs,
                    runs,
                    wickets,
                    economy,
                });
            });
        });

        return bowlingSummary;
    } catch (error) {
        console.error('Error fetching bowling summary:', error);
        return [];
    }
}

// Main function
(async () => {
    const url = 'https://stats.espncricinfo.com/ci/engine/records/team/match_results.html?id=14450;type=tournament';
    
    // Stage 1: Fetch match summary links
    const matchSummaryLinks = await fetchMatchSummaryLinks(url);
    if (matchSummaryLinks.length === 0) {
        console.log('No match summary links found.');
        return;
    }
    console.log(`Found ${matchSummaryLinks.length} match summary links.`);

    // Stage 2: Fetch bowling summaries from match URLs
    const allBowlingData = [];
    for (const matchUrl of matchSummaryLinks) {
        const bowlingData = await fetchBowlingSummary(matchUrl);
        allBowlingData.push({
            matchUrl,
            bowlingSummary: bowlingData,
        });
    }

    // Output results
    console.log(JSON.stringify(allBowlingData, null, 2));

    // Save data to JSON file
    fs.writeFileSync('bowlingSummary.json', JSON.stringify(allBowlingData, null, 2));
    console.log('Bowling summary data has been saved to bowlingSummary.json');
})();
