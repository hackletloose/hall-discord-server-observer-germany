import { Client, GatewayIntentBits } from 'discord.js';
import dotenv from 'dotenv';
import winston from 'winston';
import 'winston-daily-rotate-file';
import { SourceQuerySocket } from 'source-server-query';
import fs from 'fs';
import moment from 'moment';

dotenv.config();

const TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID_1 = process.env.CHANNEL_ID_1;
const CHANNEL_ID_2 = process.env.CHANNEL_ID_2;

const logFormatter = winston.format.printf(
  ({ timestamp, level, message }) => `${timestamp}:${level}:${message}`
);
const logTransports = [
  new winston.transports.Console(),
  new winston.transports.DailyRotateFile({
    filename: 'hll-server-list-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    maxSize: '10m',
    maxFiles: '2',
  }),
];
const logger = winston.createLogger({
  format: winston.format.combine(winston.format.timestamp(), logFormatter),
  transports: logTransports,
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

let lastMessages = {
  [CHANNEL_ID_1]: [],
  [CHANNEL_ID_2]: [],
};

const query = new SourceQuerySocket();
const serversFilePath = '/home/hll-server-browser/servers.json';
const serverCache = {};

const loadServers = async () => {
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error('Loading servers from file timed out'));
    }, 200);
  });

  const loadPromise = new Promise((resolve) => {
    try {
      const data = fs.readFileSync(serversFilePath, 'utf8');
      const servers = JSON.parse(data);
      resolve(servers);
    } catch (error) {
      logger.error(`Error loading servers from file: ${error.message}`);
      resolve([]);
    }
  });

  try {
    return await Promise.race([timeoutPromise, loadPromise]);
  } catch (error) {
    logger.error(`Error: ${error.message}`);
    return [];
  }
};

const calculateRemainingTime = (mapChangeTime, map) => {
  if (!mapChangeTime) {
    return '90 min. ⌛'; // Fallback
  }
  const changeTime = moment(mapChangeTime);
  const currentTime = moment();
  const elapsedMinutes = currentTime.diff(changeTime, 'minutes');

  const totalMinutes = map.includes('SKM') ? 30 : 90;
  let remaining = totalMinutes - elapsedMinutes;
  if (remaining < 0) remaining = 0;

  return `${remaining} min.⌛`;
};

const getServerInfo = async (address, port) => {
  const timeout = 150;
  const cacheKey = `${address}:${port}`;

  try {
    const serverInfo = await Promise.race([
      query.info(address, port, timeout),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Query timeout')), timeout)
      ),
    ]);

    let sanitizedServerName = serverInfo.name.trim();
    sanitizedServerName = sanitizedServerName.replace(/\s\s+/g, ' ');
    sanitizedServerName = sanitizedServerName.replace(/\.+$/, '').replace(/\s+$/, '');
    sanitizedServerName = sanitizedServerName.replace(/discord.gg/g, 'discord.gg\u200B');
    sanitizedServerName = sanitizedServerName.replace('https://discord.gg/ragem', 'ragem');
    sanitizedServerName = sanitizedServerName.replace(/discord.xn/g, 'discord.xn\u200B');
    sanitizedServerName = sanitizedServerName.replace(/https?:\/\//gi, '')

    const previousData = serverCache[cacheKey];
    const isNewMap = !previousData || previousData.map !== serverInfo.map;
    const mapChangeTime = isNewMap ? Date.now() : previousData?.mapChange;

    const newData = {
      sanitizedServerName,
      players: serverInfo.players,
      map: serverInfo.map,
      mapChange: mapChangeTime,
      lastValidTimestamp: Date.now(),
    };

    serverCache[cacheKey] = newData;
    return newData;
  } catch (error) {
    logger.error(`Error querying server info for ${address}:${port} - ${error.message}`);
    return null;
  }
};

/**
 * Wählt Emoji basierend auf Playercount.
 */
const getCircleEmoji = (serverName, players) => {
  if (players >= 50) {
    return '🟢'; // Grün
  } else if (players >= 15) {
    return '🟡'; // Gelb
  } else {
    return '🔴'; // Rot
  }
};

/**
 * Baut die Serverzeile zusammen.
 */
const createServerContent = (info) => {
  const remainingTime = calculateRemainingTime(info.mapChange, info.map);
  return `${getCircleEmoji(info.sanitizedServerName, info.players)} \`${info.players} - ${info.sanitizedServerName} - ${remainingTime}\`\n`;
};

/**
 * "Chunkt" eine lange Message in mehrere <=2000-Zeichen Häppchen
 * und *bearbeitet/erstellt/löscht* Nachrichten so, dass nichts komplett verschwindet.
 */
const updateInChunks = async (channel, oldMessages, content, chunkSize = 2000) => {
  // 1) Content in Chunks zerlegen
  const chunks = [];
  if (content.length === 0) {
    chunks.push('Derzeit sind keine Server aktiv.');
  } else if (content.length <= chunkSize) {
    chunks.push(content);
  } else {
    let currentIndex = 0;
    while (currentIndex < content.length) {
      const chunk = content.slice(currentIndex, currentIndex + chunkSize);
      chunks.push(chunk);
      currentIndex += chunkSize;
    }
  }

  const newMessages = [];

  // 2) So viele Chunks wie möglich in existierende Messages editieren
  for (let i = 0; i < chunks.length; i++) {
    if (oldMessages[i]) {
      // Gibt es bereits eine alte Nachricht? -> editieren
      await oldMessages[i].edit(chunks[i]);
      newMessages.push(oldMessages[i]);
    } else {
      // Sonst neue Nachricht erstellen
      const newMsg = await channel.send(chunks[i]);
      newMessages.push(newMsg);
    }
  }

  // 3) Falls noch alte Nachrichten übrig sind, die nicht mehr gebraucht werden, löschen
  for (let i = chunks.length; i < oldMessages.length; i++) {
    await oldMessages[i].delete().catch(() => {});
  }

  // Fertig: newMessages ist unser aktualisiertes Array
  return newMessages;
};

/**
 * Hauptfunktion, die regelmäßig aufgerufen wird (z.B. per setInterval).
 */
const updateServers = async () => {
  logger.info('Running updateServers function');

  const servers = await loadServers();
  const serverInfoList = [];

  // Nur Server mit >= 15 Spielern
  for (const server of servers) {
    const info = await getServerInfo(server.address, server.port);
    if (info && info.players >= 15) {
      logger.info(`Fetched server info for ${server.address}:${server.port} - Players: ${info.players}`);
      serverInfoList.push(info);
    }
  }

  // MEILENSTEIN-Server separat herausgreifen
  const meilensteinServers = serverInfoList.filter((s) =>
    s.sanitizedServerName.includes('MEILENSTEIN')
  );
  const otherServers = serverInfoList.filter(
    (s) => !s.sanitizedServerName.includes('MEILENSTEIN')
  );

  // Sortiere "Nicht-MEILENSTEIN" nach Player Count DESC
  otherServers.sort((a, b) => b.players - a.players);

  // Combine
  const finalList = [...meilensteinServers, ...otherServers];

  // Baue finalen Text
  let content = '';
  if (finalList.length > 0) {
    for (const info of finalList) {
      content += createServerContent(info);
    }
  } else {
    content = 'Derzeit sind keine Server aktiv.';
  }

  // Auf beide Channels anwenden
  for (const channelId of [CHANNEL_ID_1, CHANNEL_ID_2]) {
    const channel = await client.channels.fetch(channelId);
    if (!channel) continue;

    // Hier statt "lösche alles und sende neu" -> updateInChunks
    lastMessages[channelId] = await updateInChunks(channel, lastMessages[channelId], content, 2000);
    logger.info(`Updated messages in channel ${channelId}`);
  }
};

// Start des Bots
client.once('ready', async () => {
  logger.info(`${client.user.tag} has connected to Discord!`);

   OPTIONAL: Nur beim allerersten Start einmal Kanal aufräumen, falls erwünscht.
   Achtung: Das kann ebenfalls kurzes „Flackern“ hervorrufen – dann einfach weglassen.

   for (const channelId of [CHANNEL_ID_1, CHANNEL_ID_2]) {
     try {
       const channel = await client.channels.fetch(channelId);
       if (!channel) continue;
       const fetchedMessages = await channel.messages.fetch({ limit: 100 });
       await Promise.all(fetchedMessages.map((m) => m.delete()));
       logger.info(`Deleted old messages in channel ${channelId}`);
     } catch (e) {
       logger.error(`Error clearing channel ${channelId}: ${e}`);
     }
   }

  // Kleiner Delay, dann erster Update
  setTimeout(async () => {
    await updateServers();
    // Alle 15s aktualisieren
    setInterval(updateServers, 60_000);
  }, 5000);
});

client.login(TOKEN);
