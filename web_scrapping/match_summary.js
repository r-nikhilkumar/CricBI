const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

// URL to scrape data from
const url = 'https://stats.espncricinfo.com/ci/engine/records/team/match_results.html?id=14450;type=tournament';

// Function to fetch match data
async function fetchMatchData() {
    try {
        // Fetch the HTML of the page
        const { data } = await axios.get(url);
        const $ = cheerio.load(data); // Load HTML into cheerio

        const matches = [];
        const rows = $('table.ds-table tbody tr'); // Select all rows in the match summary table

        // Iterate through each row to extract data
        rows.each((index, element) => {
            const team1 = $(element).find('td').eq(0).text().trim();
            const team2 = $(element).find('td').eq(1).text().trim();
            const winner = $(element).find('td').eq(2).text().trim();
            const margin = $(element).find('td').eq(3).text().trim();
            const ground = $(element).find('td').eq(4).text().trim();
            const matchDate = $(element).find('td').eq(5).text().trim();
            const matchId = $(element).find('td').eq(6).text().trim();

            matches.push({ team1, team2, winner, margin, ground, matchDate, matchId });
        });

        return matches;
    } catch (error) {
        console.error('Error fetching match data:', error);
        return [];
    }
}

// Function to save data to CSV
function saveToCSV(data) {
    const csv = [
        ['Team 1', 'Team 2', 'Winner', 'Margin', 'Ground', 'Match Date', 'Match ID'], // Header
        ...data.map(match => [match.team1, match.team2, match.winner, match.margin, match.ground, match.matchDate, match.matchId]) // Rows
    ]
    .map(e => e.join(','))
    .join('\n');

    fs.writeFileSync('match_data.csv', csv);
    console.log('Data saved to match_data.csv');
}

// Function to save data to JSON
function saveToJSON(data) {
    fs.writeFileSync('match_data_summary.json', JSON.stringify(data, null, 2)); // Write JSON file with pretty print
    console.log('Data saved to match_data.json');
}

// Main execution function
(async () => {
    const matchData = await fetchMatchData();
    saveToCSV(matchData); // Save data to CSV
    saveToJSON(matchData); // Save data to JSON
})();
