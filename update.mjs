import fs from 'fs';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const STEAM_API_KEY = process.env.STEAM_API_KEY;
const GAME_ID = 686810;
const SERVERS_JSON = 'servers.json';

/**
 * Fetches all servers for the specified game from Steam,
 * filters for German servers, and returns them in
 * { address, port } format.
 */
async function fetchGermanServersFromSteam() {
  const url = 'https://api.steampowered.com/IGameServersService/GetServerList/v1/';

  // Fetch server list from Steam Web API
const response = await axios.get(url, {
  params: {
    key: STEAM_API_KEY,
    filter: `\\appid\\${GAME_ID}`,
    limit: 1000  // <--- Increase this as needed
  }
});

  const servers = response.data?.response?.servers || [];

  // Filter for German servers, exclude certain keywords
  const germanServers = servers.filter((server) =>
    // /test(server.name.toUpperCase()) &&
    !/EVENT/i.test(server.name) &&
    !/JAGER/i.test(server.name) &&
    !/BADGERGROUNDS/i.test(server.name) &&
    !/SWE/i.test(server.name)
  );

  // Convert to { address, port }
  return germanServers.map((server) => {
    const [address, port] = server.addr.split(':');
    return {
      address,
      port: parseInt(port, 10),
    };
  });
}

/**
 * Reads existing servers from servers.json (if present).
 * Returns an array of { address, port }.
 */
function readExistingServers() {
  if (!fs.existsSync(SERVERS_JSON)) {
    return [];
  }
  try {
    const data = fs.readFileSync(SERVERS_JSON, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error(`Error reading ${SERVERS_JSON}:`, err.message);
    return [];
  }
}

/**
 * Writes updated servers list back to servers.json
 */
function writeServersToFile(servers) {
  try {
    fs.writeFileSync(SERVERS_JSON, JSON.stringify(servers, null, 2), 'utf8');
    console.log(`Successfully wrote ${servers.length} servers to ${SERVERS_JSON}.`);
  } catch (err) {
    console.error(`Error writing ${SERVERS_JSON}:`, err.message);
  }
}

/**
 * Main function that fetches the latest German servers from Steam,
 * merges them into servers.json, and saves updates (if any).
 */
export async function addNewServers() {
  console.log('Fetching new German servers from Steam...');
  let newServers;
  try {
    newServers = await fetchGermanServersFromSteam();
  } catch (err) {
    console.error('Error fetching from Steam API:', err.message);
    return;
  }

  const existingServers = readExistingServers();

  // Use a Set for quick lookup (e.g. "1.2.3.4:7777")
  const existingSet = new Set(
    existingServers.map((s) => `${s.address}:${s.port}`)
  );

  // Filter out servers already in the set
  const uniqueNewServers = [];
  for (const server of newServers) {
    const key = `${server.address}:${server.port}`;
    if (!existingSet.has(key)) {
      uniqueNewServers.push(server);
      existingSet.add(key);
    }
  }

  if (uniqueNewServers.length === 0) {
    console.log('No new servers found.');
    return;
  }

  // Merge the newly found servers into the existing list
  const updatedServerList = [...existingServers, ...uniqueNewServers];

  console.log(`Found ${uniqueNewServers.length} new server(s). Adding to servers.json...`);
  writeServersToFile(updatedServerList);
}

// If you want to run it directly (e.g., node addNewServers.js),
// uncomment the following lines:
 (async () => {
   await addNewServers();
 })();
