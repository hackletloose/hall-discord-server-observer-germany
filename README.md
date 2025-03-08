# Hall Discord Server Observer Germany

[English]

## Overview
This project is a Discord bot and server observer for Hell Let Loose servers in Germany. The bot regularly queries the servers, updates information in designated Discord channels, and refreshes server lists from Steam.

## Features
- Query server information using SourceQuery.
- Update Discord channels with server status.
- Automatically fetch new German servers from Steam.
- Logs using Winston with daily rotated logs.

## Installation
1. Clone the repository.
2. Install dependencies: `npm install`
3. Create a `.env` file with the necessary tokens and IDs:
   - `DISCORD_TOKEN`
   - `CHANNEL_ID_1`
   - `CHANNEL_ID_2`
   - `STEAM_API_KEY`
4. Run the bot with `node main.mjs` and the update script with `node update.mjs`.

## Configuration
- Configure your server list in `servers.json`.
- Adjust log settings in `main.mjs` if needed.

## License
This project is licensed under the [MIT License](LICENSE).

---

[Deutsch]

# Hall Discord Server Observer Germany

## Überblick
Dieses Projekt ist ein Discord-Bot und Server-Observer für Hell Let Loose-Server in Deutschland. Der Bot fragt regelmäßig Serverinformationen ab, aktualisiert Informationen in definierten Discord-Kanälen und aktualisiert die Serverliste von Steam.

## Funktionen
- Abfragen von Serverinformationen mittels SourceQuery.
- Aktualisieren von Discord-Kanälen mit Serverstatus.
- Automatisches Abrufen neuer deutscher Server von Steam.
- Logging mit Winston und täglicher Logrotation.

## Installation
1. Klone das Repository.
2. Installiere die Abhängigkeiten: `npm install`
3. Erstelle eine `.env` Datei mit den notwendigen Tokens und IDs:
   - `DISCORD_TOKEN`
   - `CHANNEL_ID_1`
   - `CHANNEL_ID_2`
   - `STEAM_API_KEY`
4. Starte den Bot mit `node main.mjs` und das Update-Skript mit `node update.mjs`.

## Konfiguration
- Konfiguriere die Serverliste in `servers.json`.
- Passe die Log-Einstellungen in `main.mjs` an, falls nötig.

## Lizenz
Dieses Projekt steht unter der [MIT License](LICENSE).
