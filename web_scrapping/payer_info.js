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

        // Parse the match summary links based on the provided example
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

// Function to fetch player data from match URLs
async function fetchPlayerData(url) {
    console.log("fetching from url: ",url);
    try {
        const { data } = await axiosInstance.get(url);
        const $ = cheerio.load(data);
        const playersLinks = [];

        const match = $('div').filter(function () {
            return $(this).find('span > span > span').text() === String("Match Details");
        }).siblings();

        const team1 = $(match.eq(0)).find('span > span > span').text().replace(" Innings", "");
        const team2 = $(match.eq(1)).find('span > span > span').text().replace(" Innings", "");

        // Extract batting players
        const tables = $('div > table.ci-scorecard-table');
        const firstInningRows = $(tables.eq(0)).find('tbody > tr').filter(function () {
            return $(this).find("td").length >= 8;
        });

        const secondInningsRows = $(tables.eq(1)).find('tbody > tr').filter(function () {
            return $(this).find("td").length >= 8;
        });

        firstInningRows.each((index, element) => {
            const tds = $(element).find('td');
            playersLinks.push({
                "name": $(tds.eq(0)).find('a > span > span').text().trim(),
                "team": team1,
                "link": "https://www.espncricinfo.com" + $(tds.eq(0)).find('a').attr('href')
            });
        });

        secondInningsRows.each((index, element) => {
            const tds = $(element).find('td');
            console.log("https://www.espncricinfo.com" + $(tds.eq(0)).find('a').attr('href'));
            playersLinks.push({
                "name": $(tds.eq(0)).find('a > span > span').text().trim(),
                "team": team2,
                "link": "https://www.espncricinfo.com" + $(tds.eq(0)).find('a').attr('href')
            });
        });

        // Extract bowling players
        const bowlingTables = $('div > table.ds-table');
        const firstInningBowlingRows = $(bowlingTables.eq(1)).find('tbody > tr').filter(function () {
            return $(this).find("td").length >= 11;
        });

        const secondInningBowlingRows = $(bowlingTables.eq(3)).find('tbody > tr').filter(function () {
            return $(this).find("td").length >= 11;
        });

        firstInningBowlingRows.each((index, element) => {
            const tds = $(element).find('td');
            playersLinks.push({
                "name": $(tds.eq(0)).find('a > span').text().trim(),
                "team": team2.replace(" Innings", ""),
                "link": "https://www.espncricinfo.com" + $(tds.eq(0)).find('a').attr('href')
            });
        });

        secondInningBowlingRows.each((index, element) => {
            const tds = $(element).find('td');
            playersLinks.push({
                "name": $(tds.eq(0)).find('a > span').text().trim(),
                "team": team1.replace(" Innings", ""),
                "link": "https://www.espncricinfo.com" + $(tds.eq(0)).find('a').attr('href')
            });
        });
        console.log("player: ",playersLinks);

        return { playersData: playersLinks };
    } catch (error) {
        console.error('Error fetching player data:', error);
        return { playersData: [] };
    }
}

// Function to fetch individual player details
async function fetchPlayerDetails(url) {
    console.log("Fetching player details from URL: ", url);
    try {
        const { data } = await axiosInstance.get(url);
        const $ = cheerio.load(data);

        const playerInfo = {};
        console.log("name: ",$('div:contains("Full Name")')
        .children('span').children('p').text().trim())
        // Extracting player's full name
        playerInfo.name = $('div:contains("Full Name")')
        .children('span').children('p').text().trim();

        // Extracting the player's image
        const playerImage = $(`img[alt="${playerInfo.name}"]`).attr('src');
        playerInfo.image = playerImage || 'https://wassets.hscicdn.com/static/images/lazyimage-transparent.png';

        // Extracting the player's birth date
        playerInfo.born = $('div:contains("Born")')
        .children('span').children('p').text().trim()

        // Extracting the player's age
        playerInfo.age = $('div:contains("Age")')
        .children('span').children('p').text().trim()

        // Extracting batting style
        playerInfo.battingStyle = $('div:contains("Batting Style")')
        .children('span').children('p').text().trim()

        // Extracting bowling style
        playerInfo.bowlingStyle = $('div:contains("Bowling Style")')
        .children('span').children('p').text().trim()

        // Extracting playing role
        playerInfo.playingRole = $('div:contains("Playing Role")')
        .children('span').children('p').text().trim()

        // Extracting teams
        playerInfo.teams = [];
        $('div:contains("TEAMS")').children('div').children('a').each((index, element) => {
            const teamName = $(element).children('span').children('span').text().trim();
            playerInfo.teams.push(teamName); // Only storing the team name
        });

        // Return only the first team as team reference
        playerInfo.team = playerInfo.teams.length > 0 ? playerInfo.teams[0] : '';

        console.log(playerInfo);
        return playerInfo;

    } catch (error) {
        console.error('Error fetching player details:', error);
        return null;
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

    // Stage 2: Fetch player data from match URLs
    const playersData = [];
    for (const matchUrl of matchSummaryLinks) {
        const playerLinks = await fetchPlayerData(matchUrl);
        playersData.push(...playerLinks.playersData);
    }

    // Stage 3: Fetch individual player details
    const playerDetails = [];
    console.log(playersData.length)
    const uniqueSet = new Set(playersData);
    console.log(uniqueSet.size)
    for (const player of uniqueSet) {
        const details = await fetchPlayerDetails(player.link, player.name, player.team);
        if (details) {
            playerDetails.push(details);
        }
    }
    console.log("player details: ", playerDetails)

    // Save data to JSON file
    fs.writeFileSync('playersData.json', JSON.stringify(playerDetails, null, 2));
    console.log('Player data has been saved to playersData.json');
})();
