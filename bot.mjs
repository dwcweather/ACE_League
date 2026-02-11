import HaxballJS from 'haxball.js';
import express from 'express';

// --- 1. THE FAKE WEBSITE (Crucial for 24/7 Cloud Hosting) ---
// This trick makes the cloud provider think your bot is a "website" so it doesn't shut down.
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('✅ ACE LEAGUE BOT IS RUNNING! (Do not close this tab if testing locally)');
});

app.listen(PORT, () => {
    console.log(`🌐 Web Server listening on port ${PORT}`);
});

// --- 2. HAXBALL BOT LOGIC ---
console.log("--- ACE League Bot Starting ---");

// !!! PASTE YOUR FRESH TOKEN HERE !!!
// https://www.haxball.com/headlesstoken
// Look for the token in the server's environment settings
const myToken = process.env.HB_TOKEN;

HaxballJS({
    roomName: "ACE Official Haxball League",
    maxPlayers: 16,
    public: true, // Start Public for instant link...
    noPlayer: true,
    token: myToken 
}).then((room) => {

    // --- INSTANT LINK & LOCK ---
    room.onRoomLink = (link) => {
        // Immediately lock the room to make it private
        room.setPassword("acedwc");
        room.setPublic(false);

        console.log("=============================================");
        console.log("🚀 ACE LEAGUE IS LIVE!");
        console.log("🔗 LINK: " + link);
        console.log("=============================================");
    };

    // --- GAME VARIABLES ---
    let leagueMode = false;
    let lastKicker = null;
    let secondLastKicker = null;
    let ballLastPos = { x: 0, y: 0 };
    let shotSpeedMph = 0;
    let playerStats = {}; 
    let eloData = {};     
    let penalizedPlayers = new Map(); 

    const PLAYER_RADIUS = 15;
    const ATTACKING_BOX_X = 200;
    const GOAL_WIDTH = 120;

    // --- RANKS & ELO ---
    const RANKS = [
        { name: "[CHAMPION]", elo: 2900, color: 0x0000FF },
        { name: "[ELITE 2]", elo: 2300, color: 0xFFA500 },
        { name: "[ELITE 1]", elo: 1900, color: 0xFFA500 },
        { name: "[PLAT 3]", elo: 1600, color: 0x800080 },
        { name: "[PLAT 2]", elo: 1350, color: 0x800080 },
        { name: "[PLAT 1]", elo: 1150, color: 0x800080 },
        { name: "[GOLD]", elo: 1000, color: 0xFFD700 },
        { name: "[SILVER]", elo: 925, color: 0xC0C0C0 },
        { name: "[BRONZE]", elo: 850, color: 0x8B4513 },
        { name: "[UNRANKED]", elo: 800, color: 0x808080 }
    ];

    function getRank(elo) { return RANKS.find(r => elo >= r.elo) || RANKS[9]; }
    function getDist(p1, p2) { return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2)); }

    // --- EVENTS ---

    room.onPlayerJoin = (player) => {
        if (room.getPlayerList().length === 1) room.setPlayerAdmin(player.id, true);
        room.sendAnnouncement(`Welcome ${player.name} to ACE!`, null, 0x00FF00, "bold");
        
        // Initialize stats if new
        if (!playerStats[player.id]) playerStats[player.id] = { goals: 0, assists: 0, sot: 0, kicks: 0, xgot: 0 };
        if (!eloData[player.id]) eloData[player.id] = { elo: 800, ranked: false };
    };

    room.onPlayerBallKick = (player) => {
        if (lastKicker && lastKicker.id !== player.id) secondLastKicker = lastKicker;
        lastKicker = player;
        playerStats[player.id].kicks++;

        let ball = room.getBallPosition();
        if (!ball) return;

        // Advanced Stats: SOT (Shots on Target) & xGOT (Expected Goals on Target)
        let isAiming = (player.team === 1 && ball.x > ATTACKING_BOX_X && Math.abs(ball.y) < GOAL_WIDTH) ||
                       (player.team === 2 && ball.x < -ATTACKING_BOX_X && Math.abs(ball.y) < GOAL_WIDTH);

        if (isAiming) {
            playerStats[player.id].sot++;
            let dist = player.team === 1 ? getDist(ball, {x: 700, y: 0}) : getDist(ball, {x: -700, y: 0});
            // Simple xGOT calculation based on distance
            playerStats[player.id].xgot += parseFloat((120 / dist).toFixed(2));
        }
    };

    room.onGameTick = () => {
        let ball = room.getBallPosition();
        if (ball) {
            shotSpeedMph = (getDist(ball, ballLastPos) * 60 * 0.05).toFixed(2); 
            ballLastPos = { x: ball.x, y: ball.y };
        }

        // LEAGUE MODE: Offside Penalties
        if (leagueMode) {
            room.getPlayerList().forEach(p => {
                if (p.team === 0) return;
                
                let isOffside = (p.team === 1 && p.x > PLAYER_RADIUS) || (p.team === 2 && p.x < -PLAYER_RADIUS);

                if (isOffside && !penalizedPlayers.has(p.id)) {
                    room.pauseGame(true);
                    room.sendAnnouncement(`🚨 PENALTY: ${p.name} Offside! (Slowed for 30s)`, null, 0xFF0000, "bold");
                    room.setPlayerDiscProperties(p.id, { invMass: 1.4, acceleration: 0.07 }); // Slow them down
                    penalizedPlayers.set(p.id, Date.now() + 30000);
                    setTimeout(() => room.pauseGame(false), 2000);
                }

                if (penalizedPlayers.has(p.id) && Date.now() > penalizedPlayers.get(p.id)) {
                    room.setPlayerDiscProperties(p.id, { invMass: 1.0, acceleration: 0.1 }); // Restore speed
                    penalizedPlayers.delete(p.id);
                    room.sendAnnouncement(`✅ Penalty expired for ${p.name}`, p.id, 0x00FF00);
                }
            });
        }
    };

    room.onTeamGoal = (team) => {
        let scorer = lastKicker;
        let assistant = secondLastKicker;
        
        // Reset penalties on goal
        penalizedPlayers.forEach((t, id) => room.setPlayerDiscProperties(id, { invMass: 1.0, acceleration: 0.1 }));
        penalizedPlayers.clear();

        if (scorer && scorer.team === team) {
            playerStats[scorer.id].goals++;
            let msg = `⚽ Goal: ${scorer.name} | Speed: ${shotSpeedMph} mph`;
            
            if (assistant && assistant.team === team && assistant.id !== scorer.id) {
                msg += ` | Assist: ${assistant.name}`;
                playerStats[assistant.id].assists++;
            }
            room.sendAnnouncement(msg, null, 0xFFFF00, "bold");
        }
    };

    room.onPlayerChat = (player, message) => {
        // Command: Join Ranked
        if (message === "-ranked") {
            eloData[player.id].ranked = true;
            room.sendAnnouncement("✅ You are now signed up for Ranked Matches!", player.id, 0x00FF00);
            return false;
        }
        
        // Command: Toggle League Mode (Admin Only)
        if (message === "-league" && player.admin) {
            leagueMode = !leagueMode;
            room.sendAnnouncement("⚠️ League Mode is now " + (leagueMode ? "ENABLED ✅" : "DISABLED ❌"), null, 0x00FFFF, "bold");
            return false;
        }
        
        // Command: Check ELO
        if (message === "-elo") {
             if (eloData[player.id].ranked) {
                let r = getRank(eloData[player.id].elo);
                room.sendAnnouncement(`📊 Your ELO: ${eloData[player.id].elo} ${r.name}`, player.id, 0x00FFFF);
            } else {
                room.sendAnnouncement("❌ You are Unranked. Type -ranked to join.", player.id, 0xFF0000);
            }
            return false;
        }

        // Chat Formatting
        let sTag = player.admin ? "[ADMIN]" : "[MEMBER]";
        let rank = getRank(eloData[player.id].elo);
        let tagString = eloData[player.id].ranked ? `${sTag} ${rank.name}` : sTag;
        room.sendAnnouncement(`${tagString} ${player.name}: ${message}`, null, player.admin ? 0xFF0000 : 0x32CD32);
        return false; 
    };

    room.onTeamVictory = (scores) => {
        // ELO Updates
        if (leagueMode) {
            let winTeam = scores.red > scores.blue ? 1 : 2;
            room.getPlayerList().forEach(p => {
                if (p.team === 0 || !eloData[p.id].ranked) return;
                let change = (p.team === winTeam) ? 40 : -30;
                eloData[p.id].elo = Math.max(800, eloData[p.id].elo + change);
            });
        }

        // Post-Match Stats
        room.sendAnnouncement("--- MATCH STATS ---", null, 0xFFFFFF, "bold");
        room.getPlayerList().forEach(p => {
            let s = playerStats[p.id];
            let e = eloData[p.id];
            if (s) {
                let eloMsg = e.ranked ? ` / ${e.elo} ELO` : "";
                let line = `${s.goals}G / ${s.assists}A / ${s.sot} SOT / ${s.xgot.toFixed(2)} xGOT${eloMsg}`;
                room.sendAnnouncement(`${p.name}: ${line}`);
            }
        });
    };

}).catch((err) => {
    console.error("❌ CONNECTION ERROR:", err);
});