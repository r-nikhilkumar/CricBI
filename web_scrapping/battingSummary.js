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

// Function to fetch batting summary from match URLs
async function fetchBattingSummary(url) {
    console.log("Fetching batting summary from URL: ", url);
    try {
        const { data } = await axiosInstance.get(url);
        const $ = cheerio.load(data);
        
        // Extract teams
        const teamNames = [];
        $('span.ds-text-tight-xs').each((index, element) => {
            teamNames.push($(element).text().trim());
        });

        // Extract batting data
        const battingSummary = [];
        const tables = $('div > table.ci-scorecard-table');

        tables.each((index, table) => {
            const rows = $(table).find('tbody > tr').filter(function () {
                return $(this).find("td").length >= 8;
            });

            rows.each((idx, row) => {
                const tds = $(row).find('td');
                const playerName = $(tds.eq(0)).find('a > span > span').text().trim();
                const runs = $(tds.eq(2)).text().trim();
                const balls = $(tds.eq(3)).text().trim();
                const fours = $(tds.eq(5)).text().trim();
                const sixes = $(tds.eq(6)).text().trim();
                const strikeRate = $(tds.eq(7)).text().trim();

                battingSummary.push({
                    playerName,
                    runs,
                    balls,
                    fours,
                    sixes,
                    strikeRate,
                });
            });
        });

        return {
            teams: teamNames,
            battingSummary,
        };
    } catch (error) {
        console.error('Error fetching batting summary:', error);
        return { teams: [], battingSummary: [] };
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

    // Stage 2: Fetch batting summaries from match URLs
    const allBattingData = [];
    for (const matchUrl of matchSummaryLinks) {
        const battingData = await fetchBattingSummary(matchUrl);
        allBattingData.push({
            matchUrl,
            teams: battingData.teams,
            battingSummary: battingData.battingSummary,
        });
    }

    // Output results
    console.log(JSON.stringify(allBattingData, null, 2));

    // Save data to JSON file
    fs.writeFileSync('battingData.json', JSON.stringify(allBattingData, null, 2));
    console.log('Batting data has been saved to battingData.json');
})();
