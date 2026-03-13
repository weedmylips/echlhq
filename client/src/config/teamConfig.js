/**
 * ECHL team configuration.
 * Logos are stored locally at /logos/{id}.png (committed to the repo).
 */
export const TEAMS = {
  74:  { id: 74,  name: "Adirondack Thunder",       city: "Adirondack",     abbr: "ADK", division: "North",    conference: "Eastern", primaryColor: "#003DA5", secondaryColor: "#C8102E" },
  66:  { id: 66,  name: "Allen Americans",           city: "Allen",          abbr: "ALN", division: "Mountain", conference: "Western", primaryColor: "#002868", secondaryColor: "#BF0D3E" },
  10:  { id: 10,  name: "Atlanta Gladiators",        city: "Atlanta",        abbr: "ATL", division: "South",    conference: "Eastern", primaryColor: "#C8102E", secondaryColor: "#000000" },
  107: { id: 107, name: "Bloomington Bison",         city: "Bloomington",    abbr: "BLM", division: "Central",  conference: "Western", primaryColor: "#003087", secondaryColor: "#7A7C80" },
  5:   { id: 5,   name: "Cincinnati Cyclones",       city: "Cincinnati",     abbr: "CIN", division: "Central",  conference: "Western", primaryColor: "#003DA5", secondaryColor: "#FC4C02" },
  8:   { id: 8,   name: "Florida Everblades",        city: "Florida",        abbr: "FLA", division: "South",    conference: "Eastern", primaryColor: "#00703C", secondaryColor: "#C8A951" },
  60:  { id: 60,  name: "Fort Wayne Komets",         city: "Fort Wayne",     abbr: "FW",  division: "Central",  conference: "Western", primaryColor: "#F47920", secondaryColor: "#231F20" },
  108: { id: 108, name: "Greensboro Gargoyles",      city: "Greensboro",     abbr: "GRN", division: "South",    conference: "Eastern", primaryColor: "#005EB8", secondaryColor: "#9B2335" },
  52:  { id: 52,  name: "Greenville Swamp Rabbits",  city: "Greenville",     abbr: "GVL", division: "South",    conference: "Eastern", primaryColor: "#00563F", secondaryColor: "#A2AAAD" },
  11:  { id: 11,  name: "Idaho Steelheads",          city: "Idaho",          abbr: "IDH", division: "Mountain", conference: "Western", primaryColor: "#003DA5", secondaryColor: "#C8102E" },
  65:  { id: 65,  name: "Indy Fuel",                 city: "Indy",           abbr: "IND", division: "Central",  conference: "Western", primaryColor: "#002868", secondaryColor: "#BF0D3E" },
  98:  { id: 98,  name: "Iowa Heartlanders",         city: "Iowa",           abbr: "IA",  division: "Central",  conference: "Western", primaryColor: "#00843D", secondaryColor: "#FFCD00" },
  79:  { id: 79,  name: "Jacksonville Icemen",       city: "Jacksonville",   abbr: "JAX", division: "South",    conference: "Eastern", primaryColor: "#002868", secondaryColor: "#A2AAAD" },
  53:  { id: 53,  name: "Kalamazoo Wings",           city: "Kalamazoo",      abbr: "KAL", division: "Central",  conference: "Western", primaryColor: "#E03A3E", secondaryColor: "#231F20" },
  56:  { id: 56,  name: "Kansas City Mavericks",     city: "Kansas City",    abbr: "KC",  division: "Mountain", conference: "Western", primaryColor: "#002868", secondaryColor: "#00843D" },
  101: { id: 101, name: "Maine Mariners",            city: "Maine",          abbr: "MNE", division: "North",    conference: "Eastern", primaryColor: "#002868", secondaryColor: "#C8102E" },
  63:  { id: 63,  name: "Norfolk Admirals",          city: "Norfolk",        abbr: "NOR", division: "South",    conference: "Eastern", primaryColor: "#003DA5", secondaryColor: "#C8102E" },
  13:  { id: 13,  name: "Orlando Solar Bears",       city: "Orlando",        abbr: "ORL", division: "South",    conference: "Eastern", primaryColor: "#003DA5", secondaryColor: "#A67C52" },
  85:  { id: 85,  name: "Rapid City Rush",           city: "Rapid City",     abbr: "RC",  division: "Mountain", conference: "Western", primaryColor: "#002868", secondaryColor: "#C8102E" },
  55:  { id: 55,  name: "Reading Royals",            city: "Reading",        abbr: "REA", division: "North",    conference: "Eastern", primaryColor: "#003DA5", secondaryColor: "#C8102E" },
  97:  { id: 97,  name: "Savannah Ghost Pirates",    city: "Savannah",       abbr: "SAV", division: "South",    conference: "Eastern", primaryColor: "#006341", secondaryColor: "#A2AAAD" },
  50:  { id: 50,  name: "South Carolina Stingrays",  city: "South Carolina", abbr: "SC",  division: "South",    conference: "Eastern", primaryColor: "#003DA5", secondaryColor: "#C8102E" },
  109: { id: 109, name: "Tahoe Knight Monsters",     city: "Tahoe",          abbr: "TAH", division: "Mountain", conference: "Western", primaryColor: "#B9975B", secondaryColor: "#231F20" },
  70:  { id: 70,  name: "Toledo Walleye",            city: "Toledo",         abbr: "TOL", division: "Central",  conference: "Western", primaryColor: "#003DA5", secondaryColor: "#C8102E" },
  103: { id: 103, name: "Trois-Rivières Lions",      city: "Trois-Rivières", abbr: "TR",  division: "North",    conference: "Eastern", primaryColor: "#FFD700", secondaryColor: "#231F20" },
  72:  { id: 72,  name: "Tulsa Oilers",              city: "Tulsa",          abbr: "TUL", division: "Mountain", conference: "Western", primaryColor: "#003DA5", secondaryColor: "#FF8200" },
  106: { id: 106, name: "Utah Grizzlies",            city: "Utah",           abbr: "UTA", division: "Mountain", conference: "Western", primaryColor: "#002868", secondaryColor: "#A2AAAD" },
  61:  { id: 61,  name: "Wheeling Nailers",          city: "Wheeling",       abbr: "WHL", division: "North",    conference: "Eastern", primaryColor: "#003DA5", secondaryColor: "#C8102E" },
  96:  { id: 96,  name: "Wichita Thunder",           city: "Wichita",        abbr: "WIC", division: "Mountain", conference: "Western", primaryColor: "#002868", secondaryColor: "#C8102E" },
  104: { id: 104, name: "Worcester Railers",         city: "Worcester",      abbr: "WOR", division: "North",    conference: "Eastern", primaryColor: "#003DA5", secondaryColor: "#C8102E" },
};

// Add logoUrl pointing to locally-stored logos
for (const team of Object.values(TEAMS)) {
  team.logoUrl = `/logos/${team.id}.png`;
}

export function findTeamByName(name) {
  if (!name) return null;
  const lower = name.toLowerCase().trim();
  return Object.values(TEAMS).find(
    (t) =>
      t.name.toLowerCase() === lower ||
      lower.includes(t.city.toLowerCase()) ||
      t.name.toLowerCase().includes(lower)
  ) || null;
}
