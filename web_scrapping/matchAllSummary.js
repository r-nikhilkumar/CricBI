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

// Function to fetch batting and bowling summaries from match URLs
async function fetchMatchSummary(url) {
    console.log("Fetching match summary from URL: ", url);
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

        // Batting summaries
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

        return {
            teams: teamNames,
            battingSummary,
            bowlingSummary,
        };
    } catch (error) {
        console.error('Error fetching match summary:', error);
        return { teams: [], battingSummary: [], bowlingSummary: [] };
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

    // Stage 2: Fetch batting and bowling summaries from match URLs
    const allMatchData = [];
    for (const matchUrl of matchSummaryLinks) {
        const matchData = await fetchMatchSummary(matchUrl);
        allMatchData.push({
            matchUrl,
            teams: matchData.teams,
            battingSummary: matchData.battingSummary,
            bowlingSummary: matchData.bowlingSummary,
        });
    }

    // Output results
    console.log(JSON.stringify(allMatchData, null, 2));

    // Save data to JSON file
    fs.writeFileSync('matchData.json', JSON.stringify(allMatchData, null, 2));
    console.log('Match data has been saved to matchData.json');
})();
