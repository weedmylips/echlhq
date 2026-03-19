const TEAMS = {
  74: { name: "Adirondack Thunder", city: "Adirondack", abbr: "ADK" },
  66: { name: "Allen Americans", city: "Allen", abbr: "ALN" },
  10: { name: "Atlanta Gladiators", city: "Atlanta", abbr: "ATL" },
  107: { name: "Bloomington Bison", city: "Bloomington", abbr: "BLM" },
  5: { name: "Cincinnati Cyclones", city: "Cincinnati", abbr: "CIN" },
  8: { name: "Florida Everblades", city: "Florida", abbr: "FLA" },
  60: { name: "Fort Wayne Komets", city: "Fort Wayne", abbr: "FW" },
  108: { name: "Greensboro Gargoyles", city: "Greensboro", abbr: "GSO" },
  52: { name: "Greenville Swamp Rabbits", city: "Greenville", abbr: "GVL" },
  11: { name: "Idaho Steelheads", city: "Idaho", abbr: "IDH" },
  65: { name: "Indy Fuel", city: "Indy", abbr: "IND" },
  98: { name: "Iowa Heartlanders", city: "Iowa", abbr: "IA" },
  79: { name: "Jacksonville Icemen", city: "Jacksonville", abbr: "JAX" },
  53: { name: "Kalamazoo Wings", city: "Kalamazoo", abbr: "KAL" },
  56: { name: "Kansas City Mavericks", city: "Kansas City", abbr: "KC" },
  101: { name: "Maine Mariners", city: "Maine", abbr: "MNE" },
  63: { name: "Norfolk Admirals", city: "Norfolk", abbr: "NOR" },
  13: { name: "Orlando Solar Bears", city: "Orlando", abbr: "ORL" },
  85: { name: "Rapid City Rush", city: "Rapid City", abbr: "RC" },
  55: { name: "Reading Royals", city: "Reading", abbr: "REA" },
  97: { name: "Savannah Ghost Pirates", city: "Savannah", abbr: "SAV" },
  50: { name: "South Carolina Stingrays", city: "South Carolina", abbr: "SC" },
  109: { name: "Tahoe Knight Monsters", city: "Tahoe", abbr: "TAH" },
  70: { name: "Toledo Walleye", city: "Toledo", abbr: "TOL" },
  103: { name: "Trois-Rivières Lions", city: "Trois-Rivières", abbr: "TR" },
  72: { name: "Tulsa Oilers", city: "Tulsa", abbr: "TUL" },
  106: { name: "Utah Grizzlies", city: "Utah", abbr: "UTA" },
  61: { name: "Wheeling Nailers", city: "Wheeling", abbr: "WHL" },
  96: { name: "Wichita Thunder", city: "Wichita", abbr: "WIC" },
  104: { name: "Worcester Railers", city: "Worcester", abbr: "WOR" },
};

const STATIC_META = {
  "/": { title: "ECHL Stats — Dashboard", desc: "Scores, upcoming games, and league leaders" },
  "/standings": { title: "ECHL Standings 2025–26", desc: "Full ECHL standings with playoff picture" },
  "/leaders": { title: "ECHL Leaders 2025–26", desc: "Points, goals, assists, and goalie leaders" },
  "/attendance": { title: "ECHL Attendance 2025–26", desc: "Game-by-game attendance figures" },
};

function buildOgTags(title, desc, url) {
  return [
    `<title>${title}</title>`,
    `<meta name="description" content="${desc}" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${desc}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="ECHL Stats" />`,
  ].join("\n    ");
}

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export const config = {
  matcher: [
    "/",
    "/standings",
    "/leaders",
    "/attendance",
    "/team/:path*",
    "/game/:path*",
    "/matchup/:path*",
  ],
};

export default async function middleware(request) {
  const url = new URL(request.url);
  const pathname = url.pathname;

  // Skip non-page requests (static files, data, etc.)
  if (pathname.match(/\.(js|css|png|jpg|svg|ico|json|webmanifest|txt|xml)$/)) {
    return;
  }

  let title = null;
  let desc = null;

  // Static pages
  if (STATIC_META[pathname]) {
    title = STATIC_META[pathname].title;
    desc = STATIC_META[pathname].desc;
  }

  // Team page: /team/:teamId
  const teamMatch = pathname.match(/^\/team\/(\d+)$/);
  if (teamMatch) {
    const team = TEAMS[teamMatch[1]];
    if (team) {
      title = escapeHtml(`${team.name} — ECHL Stats`);
      desc = escapeHtml(`Roster, stats, and recent results for ${team.name}`);
    }
  }

  // Box score: /game/:gameId
  const gameMatch = pathname.match(/^\/game\/(\d+)$/);
  if (gameMatch) {
    try {
      const dataUrl = new URL(`/data/boxscores/${gameMatch[1]}.json`, request.url);
      const res = await fetch(dataUrl);
      if (res.ok) {
        const data = await res.json();
        const gi = data.gameInfo;
        const vScore = gi.finalScore?.visiting ?? "";
        const hScore = gi.finalScore?.home ?? "";
        title = escapeHtml(`${gi.visitingTeam} ${vScore}, ${gi.homeTeam} ${hScore} — Box Score`);
        desc = escapeHtml(`Period scoring, skater stats, goalie stats — ${gi.visitingTeam} vs ${gi.homeTeam}`);
      }
    } catch {
      // Fall through to default
    }
  }

  // Matchup: /matchup/:visitingTeamId/:homeTeamId/:date
  const matchupMatch = pathname.match(/^\/matchup\/(\d+)\/(\d+)\/(.+)$/);
  if (matchupMatch) {
    const vTeam = TEAMS[matchupMatch[1]];
    const hTeam = TEAMS[matchupMatch[2]];
    const date = decodeURIComponent(matchupMatch[3]);
    if (vTeam && hTeam) {
      title = escapeHtml(`${vTeam.city} vs ${hTeam.city} Matchup Preview · ${date}`);
      desc = escapeHtml(`${vTeam.name} vs ${hTeam.name} — H2H record, special teams, players to watch`);
    }
  }

  // If no meta found, let the request pass through unchanged
  if (!title) return;

  // Fetch index.html explicitly (NOT fetch(request) — that causes infinite loops)
  const indexUrl = new URL("/index.html", request.url);
  const response = await fetch(indexUrl);
  const html = await response.text();

  const ogTags = buildOgTags(title, desc, url.href);

  // Replace existing title and inject OG tags
  const modifiedHtml = html
    .replace(/<title>[^<]*<\/title>/, "")
    .replace("</head>", `    ${ogTags}\n  </head>`);

  return new Response(modifiedHtml, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
