/* ==========================================================================
   data.js — static game data: leagues, clubs, names, positions, config
   ========================================================================== */
(function (global) {
  'use strict';

  // --- Positions -----------------------------------------------------------
  // weights are used to compute the positional overall rating
  const POSITIONS = {
    GK:  { name: 'Goalkeeper',        short: 'GK',  group: 'GK',  attack: 0.02,
           w: { gk: .58, physical: .13, passing: .11, pace: .04, defending: .06, flair: .02, weakFoot: .03, shooting: .00, dribbling: .03 } },
    CB:  { name: 'Centre Back',       short: 'DEF', group: 'DEF', attack: 0.10,
           w: { defending: .40, physical: .23, pace: .11, passing: .11, dribbling: .05, shooting: .04, flair: .02, weakFoot: .04, gk: 0 } },
    LB:  { name: 'Left Back',         short: 'DEF', group: 'DEF', attack: 0.16,
           w: { defending: .28, pace: .21, physical: .15, passing: .17, dribbling: .09, shooting: .03, flair: .03, weakFoot: .04, gk: 0 } },
    RB:  { name: 'Right Back',        short: 'DEF', group: 'DEF', attack: 0.16,
           w: { defending: .28, pace: .21, physical: .15, passing: .17, dribbling: .09, shooting: .03, flair: .03, weakFoot: .04, gk: 0 } },
    CDM: { name: 'Defensive Mid',     short: 'MID', group: 'MID', attack: 0.18,
           w: { defending: .30, passing: .25, physical: .21, dribbling: .09, pace: .06, shooting: .03, flair: .02, weakFoot: .04, gk: 0 } },
    CM:  { name: 'Centre Mid',        short: 'MID', group: 'MID', attack: 0.28,
           w: { passing: .32, dribbling: .17, defending: .15, physical: .13, shooting: .11, pace: .05, flair: .03, weakFoot: .04, gk: 0 } },
    CAM: { name: 'Attacking Mid',     short: 'MID', group: 'MID', attack: 0.38,
           w: { passing: .28, dribbling: .24, shooting: .20, pace: .09, physical: .05, defending: .05, flair: .05, weakFoot: .04, gk: 0 } },
    LW:  { name: 'Left Winger',       short: 'FWD', group: 'ATT', attack: 0.44,
           w: { dribbling: .28, pace: .26, shooting: .19, passing: .13, physical: .04, defending: .03, flair: .04, weakFoot: .03, gk: 0 } },
    RW:  { name: 'Right Winger',      short: 'FWD', group: 'ATT', attack: 0.44,
           w: { dribbling: .28, pace: .26, shooting: .19, passing: .13, physical: .04, defending: .03, flair: .04, weakFoot: .03, gk: 0 } },
    ST:  { name: 'Striker',           short: 'FWD', group: 'ATT', attack: 0.52,
           w: { shooting: .38, pace: .19, physical: .15, dribbling: .13, passing: .07, defending: .02, flair: .03, weakFoot: .03, gk: 0 } }
  };

  // the eight attributes you draft, plus goalkeeping for keepers
  const ATTR_KEYS = ['pace', 'shooting', 'passing', 'dribbling', 'defending', 'physical',
                     'flair', 'weakFoot', 'gk'];
  const ATTR_LABEL = {
    pace: 'Pace', shooting: 'Shooting', passing: 'Passing', dribbling: 'Dribbling',
    defending: 'Defending', physical: 'Physical', flair: 'Flair', weakFoot: 'Weak Foot',
    gk: 'Goalkeeping'
  };
  // what the draft offers: keepers swap shooting for goalkeeping
  const DRAFT_ATTRS = ['pace', 'shooting', 'passing', 'dribbling', 'defending', 'physical', 'flair', 'weakFoot'];
  const DRAFT_ATTRS_GK = ['pace', 'gk', 'passing', 'dribbling', 'defending', 'physical', 'flair', 'weakFoot'];

  // --- Clubs ---------------------------------------------------------------
  // [name, rating, prestige(1-5)]  rating drives match strength & wages
  const LEAGUES = [
    { id: 'ENG', name: 'Premier League', country: 'England', tier: 5, cup: 'FA Cup',
      cont: 'UCL', clubs: [
      ['Manchester City', 89, 5], ['Arsenal', 87, 5], ['Liverpool', 87, 5], ['Chelsea', 84, 5],
      ['Manchester United', 83, 5], ['Tottenham', 82, 4], ['Newcastle', 80, 4], ['Aston Villa', 79, 4],
      ['Brighton', 77, 3], ['West Ham', 76, 3], ['Everton', 73, 3], ['Nottingham Forest', 71, 2]
    ]},
    { id: 'ESP', name: 'La Liga', country: 'Spain', tier: 5, cup: 'Copa del Rey',
      cont: 'UCL', clubs: [
      ['Real Madrid', 90, 5], ['Barcelona', 88, 5], ['Atlético Madrid', 84, 5], ['Athletic Club', 79, 4],
      ['Real Sociedad', 78, 4], ['Villarreal', 77, 4], ['Real Betis', 76, 3], ['Sevilla', 76, 4],
      ['Valencia', 74, 4], ['Girona', 74, 2], ['Celta Vigo', 71, 2], ['Osasuna', 70, 2]
    ]},
    { id: 'ITA', name: 'Serie A', country: 'Italy', tier: 5, cup: 'Coppa Italia',
      cont: 'UCL', clubs: [
      ['Inter', 86, 5], ['Juventus', 84, 5], ['AC Milan', 83, 5], ['Napoli', 82, 4],
      ['Atalanta', 81, 4], ['Roma', 80, 4], ['Lazio', 78, 4], ['Fiorentina', 76, 3],
      ['Bologna', 75, 3], ['Torino', 72, 3], ['Udinese', 70, 2], ['Genoa', 69, 2]
    ]},
    { id: 'GER', name: 'Bundesliga', country: 'Germany', tier: 5, cup: 'DFB-Pokal',
      cont: 'UCL', clubs: [
      ['Bayern München', 88, 5], ['Bayer Leverkusen', 85, 4], ['Borussia Dortmund', 83, 5], ['RB Leipzig', 82, 4],
      ['Eintracht Frankfurt', 78, 3], ['Stuttgart', 77, 3], ['Wolfsburg', 75, 3], ['Freiburg', 74, 2],
      ['Hoffenheim', 72, 2], ['Werder Bremen', 71, 3], ['Mainz', 69, 2], ['Augsburg', 68, 2]
    ]},
    { id: 'FRA', name: 'Ligue 1', country: 'France', tier: 4, cup: 'Coupe de France',
      cont: 'UCL', clubs: [
      ['Paris SG', 88, 5], ['Monaco', 80, 4], ['Marseille', 79, 4], ['Lille', 78, 3],
      ['Lyon', 77, 4], ['Nice', 76, 3], ['Rennes', 75, 3], ['Lens', 74, 3],
      ['Strasbourg', 71, 2], ['Nantes', 70, 2], ['Toulouse', 69, 2], ['Brest', 68, 1]
    ]},
    { id: 'NED', name: 'Eredivisie', country: 'Netherlands', tier: 3, cup: 'KNVB Beker',
      cont: 'UCL', clubs: [
      ['Ajax', 79, 5], ['PSV', 80, 4], ['Feyenoord', 78, 4], ['AZ Alkmaar', 74, 3],
      ['Twente', 72, 2], ['Utrecht', 70, 2], ['Vitesse', 68, 2], ['Heerenveen', 66, 1],
      ['Groningen', 65, 1], ['Sparta Rotterdam', 64, 1], ['NEC', 64, 1], ['Go Ahead Eagles', 62, 1]
    ]},
    { id: 'POR', name: 'Primeira Liga', country: 'Portugal', tier: 3, cup: 'Taça de Portugal',
      cont: 'UCL', clubs: [
      ['Benfica', 81, 4], ['Porto', 81, 4], ['Sporting CP', 80, 4], ['Braga', 75, 3],
      ['Vitória Guimarães', 70, 2], ['Boavista', 66, 2], ['Famalicão', 65, 1], ['Rio Ave', 64, 1],
      ['Gil Vicente', 63, 1], ['Casa Pia', 62, 1], ['Arouca', 62, 1], ['Estoril', 61, 1]
    ]},
    { id: 'ARG', name: 'Liga Profesional', country: 'Argentina', tier: 3, cup: 'Copa Argentina',
      cont: 'LIB', clubs: [
      ['River Plate', 78, 5], ['Boca Juniors', 77, 5], ['Racing Club', 74, 4], ['Independiente', 72, 4],
      ['San Lorenzo', 71, 3], ['Estudiantes', 71, 3], ['Vélez Sarsfield', 70, 3], ['Talleres', 70, 2],
      ['Lanús', 68, 2], ['Rosario Central', 68, 2], ['Newell’s', 67, 2], ['Argentinos Juniors', 66, 2]
    ]},
    { id: 'BRA', name: 'Brasileirão', country: 'Brazil', tier: 4, cup: 'Copa do Brasil',
      cont: 'LIB', clubs: [
      ['Flamengo', 80, 5], ['Palmeiras', 80, 5], ['Botafogo', 76, 3], ['São Paulo', 76, 4],
      ['Fluminense', 75, 4], ['Corinthians', 74, 4], ['Atlético Mineiro', 74, 4], ['Grêmio', 73, 4],
      ['Internacional', 73, 3], ['Cruzeiro', 71, 3], ['Fortaleza', 70, 2], ['Bahia', 69, 2]
    ]},
    { id: 'USA', name: 'Major League Soccer', country: 'USA', tier: 2, cup: 'US Open Cup',
      cont: 'CCL', clubs: [
      ['Inter Miami', 76, 3], ['LAFC', 74, 3], ['LA Galaxy', 73, 3], ['Seattle Sounders', 72, 3],
      ['Atlanta United', 71, 2], ['Columbus Crew', 71, 2], ['NY Red Bulls', 70, 2], ['Philadelphia Union', 69, 2],
      ['Portland Timbers', 68, 2], ['Austin FC', 66, 1], ['Nashville SC', 66, 1], ['Chicago Fire', 65, 1]
    ]}
  ];

  /* --- Club identity ------------------------------------------------------
     Real club badges are trademarked, so the game draws its own crest for every
     club instead: each one's real colours and shirt pattern, rendered as a
     shield with the club's initials. Distinct at a glance, nobody's artwork.
     [primary, secondary, pattern]
  --------------------------------------------------------------------------- */
  const CLUB_KIT = {
    // England
    'Manchester City': ['#6CABDD', '#1C2C5B', 'plain'], 'Arsenal': ['#EF0107', '#FFFFFF', 'sleeve'],
    'Liverpool': ['#C8102E', '#00B2A9', 'plain'], 'Chelsea': ['#034694', '#FFFFFF', 'plain'],
    'Manchester United': ['#DA291C', '#FBE122', 'plain'], 'Tottenham': ['#FFFFFF', '#132257', 'plain'],
    'Newcastle': ['#241F20', '#FFFFFF', 'stripes'], 'Aston Villa': ['#95BFE5', '#670E36', 'halves'],
    'Brighton': ['#0057B8', '#FFFFFF', 'stripes'], 'West Ham': ['#7A263A', '#1BB1E7', 'plain'],
    'Everton': ['#003399', '#FFFFFF', 'plain'], 'Nottingham Forest': ['#DD0000', '#FFFFFF', 'plain'],
    // Spain
    'Real Madrid': ['#FFFFFF', '#FEBE10', 'plain'], 'Barcelona': ['#A50044', '#004D98', 'stripes'],
    'Atlético Madrid': ['#CB3524', '#FFFFFF', 'stripes'], 'Athletic Club': ['#EE2523', '#FFFFFF', 'stripes'],
    'Real Sociedad': ['#0067B1', '#FFFFFF', 'stripes'], 'Villarreal': ['#FFE667', '#005187', 'plain'],
    'Real Betis': ['#00954C', '#FFFFFF', 'stripes'], 'Sevilla': ['#FFFFFF', '#D80027', 'plain'],
    'Valencia': ['#FFFFFF', '#F4A600', 'plain'], 'Girona': ['#D40000', '#FFFFFF', 'stripes'],
    'Celta Vigo': ['#8AC3EE', '#FFFFFF', 'plain'], 'Osasuna': ['#D91A21', '#0A346F', 'plain'],
    // Italy
    'Inter': ['#0068A8', '#000000', 'stripes'], 'Juventus': ['#FFFFFF', '#000000', 'stripes'],
    'AC Milan': ['#FB090B', '#000000', 'stripes'], 'Napoli': ['#12A0D7', '#FFFFFF', 'plain'],
    'Atalanta': ['#1D71B8', '#000000', 'stripes'], 'Roma': ['#8E1F2F', '#F0BC42', 'plain'],
    'Lazio': ['#87D8F7', '#FFFFFF', 'plain'], 'Fiorentina': ['#592C82', '#FFFFFF', 'plain'],
    'Bologna': ['#1A2F48', '#D2122E', 'halves'], 'Torino': ['#8B1A1A', '#FFFFFF', 'plain'],
    'Udinese': ['#000000', '#FFFFFF', 'stripes'], 'Genoa': ['#B4022A', '#00234B', 'halves'],
    // Germany
    'Bayern München': ['#DC052D', '#0066B2', 'plain'], 'Bayer Leverkusen': ['#E32221', '#000000', 'plain'],
    'Borussia Dortmund': ['#FDE100', '#000000', 'plain'], 'RB Leipzig': ['#FFFFFF', '#DD0741', 'plain'],
    'Eintracht Frankfurt': ['#000000', '#E1000F', 'plain'], 'Stuttgart': ['#FFFFFF', '#E32219', 'plain'],
    'Wolfsburg': ['#65B32E', '#FFFFFF', 'plain'], 'Freiburg': ['#000000', '#E2001A', 'plain'],
    'Hoffenheim': ['#1961B5', '#FFFFFF', 'plain'], 'Werder Bremen': ['#1D9053', '#FFFFFF', 'plain'],
    'Mainz': ['#C3141E', '#FFFFFF', 'plain'], 'Augsburg': ['#BA3733', '#46714D', 'halves'],
    // France
    'Paris SG': ['#004170', '#DA291C', 'sash'], 'Monaco': ['#E63946', '#FFFFFF', 'halves'],
    'Marseille': ['#FFFFFF', '#2FAEE0', 'plain'], 'Lille': ['#E01E13', '#FFFFFF', 'plain'],
    'Lyon': ['#FFFFFF', '#1B4C9C', 'plain'], 'Nice': ['#E4032E', '#000000', 'halves'],
    'Rennes': ['#E23838', '#000000', 'halves'], 'Lens': ['#FFC300', '#E4032E', 'stripes'],
    'Strasbourg': ['#0066B3', '#FFFFFF', 'plain'], 'Nantes': ['#FFC72C', '#008D3F', 'plain'],
    'Toulouse': ['#582C83', '#FFFFFF', 'plain'], 'Brest': ['#E4032E', '#FFFFFF', 'plain'],
    // Netherlands
    'Ajax': ['#FFFFFF', '#D2122E', 'sash'], 'PSV': ['#EE2E24', '#FFFFFF', 'plain'],
    'Feyenoord': ['#FFFFFF', '#DA020E', 'halves'], 'AZ Alkmaar': ['#E4032E', '#FFFFFF', 'plain'],
    'Twente': ['#E30613', '#FFFFFF', 'plain'], 'Utrecht': ['#E4032E', '#FFFFFF', 'plain'],
    'Vitesse': ['#FFE500', '#000000', 'plain'], 'Heerenveen': ['#0066B3', '#FFFFFF', 'plain'],
    'Groningen': ['#00A650', '#FFFFFF', 'plain'], 'Sparta Rotterdam': ['#FFFFFF', '#E4032E', 'sash'],
    'NEC': ['#E4032E', '#008D3F', 'halves'], 'Go Ahead Eagles': ['#FFE500', '#E4032E', 'plain'],
    // Portugal
    'Benfica': ['#E30613', '#FFFFFF', 'plain'], 'Porto': ['#00428C', '#FFFFFF', 'stripes'],
    'Sporting CP': ['#008057', '#FFFFFF', 'hoops'], 'Braga': ['#E4032E', '#FFFFFF', 'plain'],
    'Vitória Guimarães': ['#FFFFFF', '#000000', 'plain'], 'Boavista': ['#000000', '#FFFFFF', 'quarters'],
    'Famalicão': ['#005CA9', '#FFFFFF', 'plain'], 'Rio Ave': ['#008D3F', '#FFFFFF', 'plain'],
    'Gil Vicente': ['#E4032E', '#000000', 'halves'], 'Casa Pia': ['#000000', '#FFFFFF', 'plain'],
    'Arouca': ['#FFE500', '#000000', 'plain'], 'Estoril': ['#FFE500', '#005CA9', 'plain'],
    // Argentina
    'River Plate': ['#FFFFFF', '#E4032E', 'sash'], 'Boca Juniors': ['#0A3A82', '#FFD100', 'plain'],
    'Racing Club': ['#6CACE4', '#FFFFFF', 'stripes'], 'Independiente': ['#E4032E', '#FFFFFF', 'plain'],
    'San Lorenzo': ['#0A3A82', '#E4032E', 'stripes'], 'Estudiantes': ['#E4032E', '#FFFFFF', 'stripes'],
    'Vélez Sarsfield': ['#FFFFFF', '#0A3A82', 'sash'], 'Talleres': ['#005CA9', '#FFFFFF', 'plain'],
    'Lanús': ['#7B0F2B', '#FFFFFF', 'plain'], 'Rosario Central': ['#0A3A82', '#FFD100', 'stripes'],
    'Newell’s': ['#E4032E', '#000000', 'halves'], 'Argentinos Juniors': ['#E4032E', '#FFFFFF', 'plain'],
    // Brazil
    'Flamengo': ['#E4032E', '#000000', 'hoops'], 'Palmeiras': ['#006437', '#FFFFFF', 'plain'],
    'Botafogo': ['#000000', '#FFFFFF', 'stripes'], 'São Paulo': ['#FFFFFF', '#E4032E', 'hoops'],
    'Fluminense': ['#7A1C38', '#008D3F', 'stripes'], 'Corinthians': ['#FFFFFF', '#000000', 'plain'],
    'Atlético Mineiro': ['#000000', '#FFFFFF', 'stripes'], 'Grêmio': ['#0D80BF', '#000000', 'stripes'],
    'Internacional': ['#E4032E', '#FFFFFF', 'plain'], 'Cruzeiro': ['#0A3A82', '#FFFFFF', 'plain'],
    'Fortaleza': ['#005CA9', '#E4032E', 'hoops'], 'Bahia': ['#005CA9', '#E4032E', 'hoops'],
    // USA
    'Inter Miami': ['#F7B5CD', '#000000', 'plain'], 'LAFC': ['#000000', '#C39E6D', 'plain'],
    'LA Galaxy': ['#FFFFFF', '#00245D', 'plain'], 'Seattle Sounders': ['#5D9732', '#005595', 'plain'],
    'Atlanta United': ['#80000A', '#000000', 'stripes'], 'Columbus Crew': ['#FEDD00', '#000000', 'plain'],
    'NY Red Bulls': ['#FFFFFF', '#E4032E', 'plain'], 'Philadelphia Union': ['#071B2C', '#B49759', 'plain'],
    'Portland Timbers': ['#00482B', '#D69A00', 'plain'], 'Austin FC': ['#00B140', '#000000', 'plain'],
    'Nashville SC': ['#ECE83A', '#1D1D1B', 'plain'], 'Chicago Fire': ['#141B4D', '#EF3E42', 'plain']
  };

  const CONTINENTAL = {
    UCL: { name: 'Champions League', short: 'UCL', region: 'Europe' },
    LIB: { name: 'Copa Libertadores', short: 'Libertadores', region: 'South America' },
    CCL: { name: 'CONCACAF Champions Cup', short: 'CONCACAF CC', region: 'North America' }
  };

  // --- Nations (for the player + international tournaments) ----------------
  const NATIONS = [
    { name: 'England',     rating: 86 },
    { name: 'France',      rating: 88 },
    { name: 'Brazil',      rating: 87 },
    { name: 'Argentina',   rating: 88 },
    { name: 'Spain',       rating: 86 },
    { name: 'Germany',     rating: 84 },
    { name: 'Italy',       rating: 83 },
    { name: 'Portugal',    rating: 85 },
    { name: 'Netherlands', rating: 84 },
    { name: 'Belgium',     rating: 82 },
    { name: 'Croatia',     rating: 81 },
    { name: 'Uruguay',     rating: 82 },
    { name: 'Colombia',    rating: 81 },
    { name: 'Mexico',      rating: 78 },
    { name: 'USA',         rating: 77 },
    { name: 'Morocco',     rating: 80 },
    { name: 'Senegal',     rating: 80 },
    { name: 'Nigeria',     rating: 78 },
    { name: 'Japan',       rating: 78 },
    { name: 'South Korea', rating: 76 },
    { name: 'Norway',      rating: 75 },
    { name: 'Sweden',      rating: 74 },
    { name: 'Poland',      rating: 75 },
    { name: 'Serbia',      rating: 76 },
    { name: 'Turkey',      rating: 76 },
    { name: 'Australia',   rating: 72 },
    { name: 'Canada',      rating: 74 },
    { name: 'Ireland',     rating: 72 },
    { name: 'Scotland',    rating: 73 },
    { name: 'Ghana',       rating: 75 }
  ];

  /* --- Real stars -----------------------------------------------------------
     Each club's headline players, overlaid onto its generated squad so squad
     lists, top scorers and "danger man" warnings read like the real thing.
     [name, nation, pos, ovr, age] — pos must exist in POSITIONS; nation must
     have a flag in tools/build-icons.js. Squads as of the 2025-26 season,
     best effort. Clubs not listed here stay fully generated.
  --------------------------------------------------------------------------- */
  const REAL_STARS = {
    // England
    'Manchester City': [
      ['Erling Haaland', 'Norway', 'ST', 92, 25], ['Rodri', 'Spain', 'CDM', 90, 29],
      ['Gianluigi Donnarumma', 'Italy', 'GK', 89, 26], ['Rúben Dias', 'Portugal', 'CB', 87, 28],
      ['Phil Foden', 'England', 'CAM', 86, 25], ['Bernardo Silva', 'Portugal', 'CM', 85, 31]
    ],
    'Arsenal': [
      ['Declan Rice', 'England', 'CDM', 88, 26], ['Bukayo Saka', 'England', 'RW', 88, 24],
      ['William Saliba', 'France', 'CB', 87, 24], ['Martin Ødegaard', 'Norway', 'CAM', 87, 26],
      ['Gabriel Magalhães', 'Brazil', 'CB', 86, 27], ['David Raya', 'Spain', 'GK', 85, 30]
    ],
    'Liverpool': [
      ['Mohamed Salah', 'Egypt', 'RW', 89, 33], ['Virgil van Dijk', 'Netherlands', 'CB', 89, 34],
      ['Alisson Becker', 'Brazil', 'GK', 89, 32], ['Florian Wirtz', 'Germany', 'CAM', 88, 22],
      ['Alexander Isak', 'Sweden', 'ST', 88, 26], ['Alexis Mac Allister', 'Argentina', 'CM', 85, 26]
    ],
    'Chelsea': [
      ['Cole Palmer', 'England', 'CAM', 88, 23], ['Moisés Caicedo', 'Ecuador', 'CDM', 85, 23],
      ['Enzo Fernández', 'Argentina', 'CM', 84, 24], ['Reece James', 'England', 'RB', 83, 25]
    ],
    'Manchester United': [
      ['Bruno Fernandes', 'Portugal', 'CAM', 86, 31], ['Bryan Mbeumo', 'Cameroon', 'RW', 84, 26],
      ['Matthijs de Ligt', 'Netherlands', 'CB', 82, 26], ['Kobbie Mainoo', 'England', 'CM', 80, 20]
    ],
    'Tottenham': [
      ['Cristian Romero', 'Argentina', 'CB', 84, 27], ['Mohammed Kudus', 'Ghana', 'RW', 83, 25],
      ['Xavi Simons', 'Netherlands', 'CAM', 83, 22], ['Micky van de Ven', 'Netherlands', 'CB', 83, 24],
      ['James Maddison', 'England', 'CM', 82, 29]
    ],
    'Newcastle': [
      ['Bruno Guimarães', 'Brazil', 'CM', 85, 27], ['Sandro Tonali', 'Italy', 'CDM', 84, 25],
      ['Anthony Gordon', 'England', 'LW', 83, 24], ['Nick Pope', 'England', 'GK', 82, 33]
    ],
    'Aston Villa': [
      ['Emiliano Martínez', 'Argentina', 'GK', 87, 33], ['Ollie Watkins', 'England', 'ST', 84, 29],
      ['Youri Tielemans', 'Belgium', 'CM', 83, 28], ['Morgan Rogers', 'England', 'CAM', 82, 23]
    ],
    'Brighton': [
      ['Kaoru Mitoma', 'Japan', 'LW', 82, 28], ['Carlos Baleba', 'Cameroon', 'CM', 81, 21],
      ['Bart Verbruggen', 'Netherlands', 'GK', 79, 23]
    ],
    'West Ham': [
      ['Jarrod Bowen', 'England', 'RW', 82, 28], ['Lucas Paquetá', 'Brazil', 'CAM', 82, 28],
      ['Alphonse Areola', 'France', 'GK', 79, 32]
    ],
    'Everton': [
      ['Jordan Pickford', 'England', 'GK', 83, 31], ['Iliman Ndiaye', 'Senegal', 'RW', 80, 25],
      ['Jarrad Branthwaite', 'England', 'CB', 80, 23]
    ],
    'Nottingham Forest': [
      ['Morgan Gibbs-White', 'England', 'CAM', 82, 25], ['Murillo', 'Brazil', 'CB', 81, 23],
      ['Elliot Anderson', 'England', 'CM', 80, 22]
    ],
    // Spain
    'Real Madrid': [
      ['Kylian Mbappé', 'France', 'ST', 91, 26], ['Jude Bellingham', 'England', 'CAM', 89, 22],
      ['Vinícius Júnior', 'Brazil', 'LW', 89, 25], ['Thibaut Courtois', 'Belgium', 'GK', 89, 33],
      ['Federico Valverde', 'Uruguay', 'CM', 86, 27], ['Antonio Rüdiger', 'Germany', 'CB', 84, 32]
    ],
    'Barcelona': [
      ['Lamine Yamal', 'Spain', 'RW', 89, 18], ['Pedri', 'Spain', 'CM', 87, 22],
      ['Raphinha', 'Brazil', 'LW', 87, 28], ['Robert Lewandowski', 'Poland', 'ST', 86, 37],
      ['Marc-André ter Stegen', 'Germany', 'GK', 85, 33], ['Jules Koundé', 'France', 'RB', 84, 26]
    ],
    'Atlético Madrid': [
      ['Jan Oblak', 'Slovenia', 'GK', 87, 32], ['Julián Alvarez', 'Argentina', 'ST', 86, 25],
      ['Antoine Griezmann', 'France', 'CAM', 85, 34], ['Marcos Llorente', 'Spain', 'CM', 82, 30]
    ],
    'Athletic Club': [
      ['Nico Williams', 'Spain', 'LW', 84, 23], ['Unai Simón', 'Spain', 'GK', 83, 28],
      ['Oihan Sancet', 'Spain', 'CAM', 82, 25], ['Iñaki Williams', 'Ghana', 'ST', 80, 31]
    ],
    'Real Sociedad': [
      ['Mikel Oyarzabal', 'Spain', 'ST', 83, 28], ['Takefusa Kubo', 'Japan', 'RW', 82, 24],
      ['Brais Méndez', 'Spain', 'CAM', 81, 28]
    ],
    'Villarreal': [
      ['Álex Baena', 'Spain', 'LW', 82, 24], ['Gerard Moreno', 'Spain', 'ST', 80, 33],
      ['Dani Parejo', 'Spain', 'CM', 80, 36]
    ],
    'Real Betis': [
      ['Isco', 'Spain', 'CAM', 82, 33], ['Giovani Lo Celso', 'Argentina', 'CM', 80, 29],
      ['Antony', 'Brazil', 'RW', 79, 25]
    ],
    'Sevilla': [
      ['Isaac Romero', 'Spain', 'ST', 78, 25], ['Nemanja Gudelj', 'Serbia', 'CDM', 78, 33]
    ],
    'Valencia': [
      ['José Gayà', 'Spain', 'LB', 80, 30], ['Hugo Duro', 'Spain', 'ST', 78, 25],
      ['Javi Guerra', 'Spain', 'CM', 78, 22]
    ],
    'Girona': [
      ['Viktor Tsygankov', 'Ukraine', 'RW', 79, 27], ['Paulo Gazzaniga', 'Argentina', 'GK', 79, 33],
      ['Cristhian Stuani', 'Uruguay', 'ST', 77, 39]
    ],
    'Celta Vigo': [
      ['Iago Aspas', 'Spain', 'ST', 80, 38], ['Borja Iglesias', 'Spain', 'ST', 78, 32],
      ['Marcos Alonso', 'Spain', 'LB', 76, 34]
    ],
    'Osasuna': [
      ['Ante Budimir', 'Croatia', 'ST', 80, 34], ['Sergio Herrera', 'Spain', 'GK', 78, 32],
      ['Aimar Oroz', 'Spain', 'CAM', 77, 23]
    ],
    // Italy
    'Inter': [
      ['Lautaro Martínez', 'Argentina', 'ST', 88, 28], ['Nicolò Barella', 'Italy', 'CM', 86, 28],
      ['Alessandro Bastoni', 'Italy', 'CB', 84, 26], ['Hakan Çalhanoğlu', 'Turkey', 'CDM', 84, 31],
      ['Yann Sommer', 'Switzerland', 'GK', 84, 36]
    ],
    'Juventus': [
      ['Gleison Bremer', 'Brazil', 'CB', 84, 28], ['Dušan Vlahović', 'Serbia', 'ST', 82, 25],
      ['Michele Di Gregorio', 'Italy', 'GK', 82, 28], ['Kenan Yıldız', 'Turkey', 'CAM', 81, 20],
      ['Manuel Locatelli', 'Italy', 'CDM', 81, 27]
    ],
    'AC Milan': [
      ['Mike Maignan', 'France', 'GK', 86, 30], ['Rafael Leão', 'Portugal', 'LW', 85, 26],
      ['Christian Pulisic', 'USA', 'RW', 84, 27], ['Luka Modrić', 'Croatia', 'CM', 84, 40],
      ['Fikayo Tomori', 'England', 'CB', 82, 27]
    ],
    'Napoli': [
      ['Kevin De Bruyne', 'Belgium', 'CM', 85, 34], ['Scott McTominay', 'Scotland', 'CM', 83, 28],
      ['Romelu Lukaku', 'Belgium', 'ST', 82, 32], ['Alex Meret', 'Italy', 'GK', 82, 28],
      ['Giovanni Di Lorenzo', 'Italy', 'RB', 81, 32]
    ],
    'Atalanta': [
      ['Ademola Lookman', 'Nigeria', 'LW', 84, 27], ['Éderson', 'Brazil', 'CDM', 83, 26],
      ['Gianluca Scamacca', 'Italy', 'ST', 81, 26], ['Marten de Roon', 'Netherlands', 'CM', 81, 34]
    ],
    'Roma': [
      ['Paulo Dybala', 'Argentina', 'CAM', 84, 31], ['Mile Svilar', 'Serbia', 'GK', 82, 26],
      ['Evan Ndicka', 'Ivory Coast', 'CB', 82, 26], ['Matías Soulé', 'Argentina', 'RW', 80, 22]
    ],
    'Lazio': [
      ['Mattia Zaccagni', 'Italy', 'LW', 81, 30], ['Ivan Provedel', 'Italy', 'GK', 81, 31],
      ['Nicolò Rovella', 'Italy', 'CDM', 80, 23]
    ],
    'Fiorentina': [
      ['Moise Kean', 'Italy', 'ST', 82, 25], ['David de Gea', 'Spain', 'GK', 82, 34],
      ['Rolando Mandragora', 'Italy', 'CM', 79, 28]
    ],
    'Bologna': [
      ['Riccardo Orsolini', 'Italy', 'RW', 81, 28], ['Łukasz Skorupski', 'Poland', 'GK', 80, 34],
      ['Santiago Castro', 'Argentina', 'ST', 78, 21]
    ],
    'Torino': [
      ['Nikola Vlašić', 'Croatia', 'CAM', 78, 27], ['Che Adams', 'Scotland', 'ST', 77, 29]
    ],
    'Udinese': [
      ['Oumar Solet', 'France', 'CB', 78, 25], ['Maduka Okoye', 'Nigeria', 'GK', 77, 26],
      ['Sandi Lovrić', 'Slovenia', 'CM', 77, 27]
    ],
    'Genoa': [
      ['Ruslan Malinovskyi', 'Ukraine', 'CAM', 77, 32], ['Junior Messias', 'Brazil', 'RW', 76, 34],
      ['Milan Badelj', 'Croatia', 'CDM', 76, 36]
    ],
    // Germany
    'Bayern München': [
      ['Harry Kane', 'England', 'ST', 90, 32], ['Jamal Musiala', 'Germany', 'CAM', 87, 22],
      ['Michael Olise', 'France', 'RW', 85, 23], ['Joshua Kimmich', 'Germany', 'CDM', 85, 30],
      ['Manuel Neuer', 'Germany', 'GK', 84, 39], ['Dayot Upamecano', 'France', 'CB', 83, 26]
    ],
    'Bayer Leverkusen': [
      ['Alejandro Grimaldo', 'Spain', 'LB', 82, 29], ['Patrik Schick', 'Czechia', 'ST', 82, 29],
      ['Exequiel Palacios', 'Argentina', 'CM', 81, 26], ['Jonas Hofmann', 'Germany', 'RW', 79, 33]
    ],
    'Borussia Dortmund': [
      ['Gregor Kobel', 'Switzerland', 'GK', 85, 27], ['Serhou Guirassy', 'Guinea', 'ST', 84, 29],
      ['Nico Schlotterbeck', 'Germany', 'CB', 82, 25], ['Karim Adeyemi', 'Germany', 'RW', 81, 23],
      ['Julian Brandt', 'Germany', 'CAM', 81, 29]
    ],
    'RB Leipzig': [
      ['Péter Gulácsi', 'Hungary', 'GK', 81, 35], ['Castello Lukeba', 'France', 'CB', 80, 22],
      ['Christoph Baumgartner', 'Austria', 'CAM', 80, 26], ['Antonio Nusa', 'Norway', 'LW', 79, 20]
    ],
    'Eintracht Frankfurt': [
      ['Kevin Trapp', 'Germany', 'GK', 81, 35], ['Jonathan Burkardt', 'Germany', 'ST', 79, 25],
      ['Mario Götze', 'Germany', 'CAM', 79, 33], ['Rasmus Kristensen', 'Denmark', 'RB', 77, 28]
    ],
    'Stuttgart': [
      ['Alexander Nübel', 'Germany', 'GK', 80, 29], ['Deniz Undav', 'Germany', 'ST', 80, 29],
      ['Angelo Stiller', 'Germany', 'CM', 80, 24]
    ],
    'Wolfsburg': [
      ['Maximilian Arnold', 'Germany', 'CM', 78, 31], ['Kamil Grabara', 'Poland', 'GK', 78, 26],
      ['Mohammed Amoura', 'Algeria', 'ST', 78, 25]
    ],
    'Freiburg': [
      ['Vincenzo Grifo', 'Italy', 'LW', 79, 32], ['Matthias Ginter', 'Germany', 'CB', 79, 31],
      ['Noah Atubolu', 'Germany', 'GK', 77, 23]
    ],
    'Hoffenheim': [
      ['Oliver Baumann', 'Germany', 'GK', 79, 35], ['Andrej Kramarić', 'Croatia', 'CAM', 79, 34],
      ['Grischa Prömel', 'Germany', 'CM', 77, 30]
    ],
    'Werder Bremen': [
      ['Marvin Ducksch', 'Germany', 'ST', 77, 31], ['Romano Schmid', 'Austria', 'CAM', 77, 25],
      ['Milos Veljković', 'Serbia', 'CB', 76, 29]
    ],
    'Mainz': [
      ['Nadiem Amiri', 'Germany', 'CM', 78, 28], ['Robin Zentner', 'Germany', 'GK', 78, 30],
      ['Paul Nebel', 'Germany', 'CAM', 76, 22]
    ],
    'Augsburg': [
      ['Finn Dahmen', 'Germany', 'GK', 76, 27], ['Alexis Claude-Maurice', 'France', 'CAM', 76, 27],
      ['Jeffrey Gouweleeuw', 'Netherlands', 'CB', 75, 34]
    ],
    // France
    'Paris SG': [
      ['Ousmane Dembélé', 'France', 'RW', 88, 28], ['Khvicha Kvaratskhelia', 'Georgia', 'LW', 87, 24],
      ['Vitinha', 'Portugal', 'CM', 86, 25], ['Achraf Hakimi', 'Morocco', 'RB', 86, 26],
      ['Nuno Mendes', 'Portugal', 'LB', 84, 23], ['Willian Pacho', 'Ecuador', 'CB', 83, 23]
    ],
    'Monaco': [
      ['Denis Zakaria', 'Switzerland', 'CDM', 80, 28], ['Pierre-Emerick Aubameyang', 'Gabon', 'ST', 80, 36],
      ['Takumi Minamino', 'Japan', 'CAM', 78, 30], ['Folarin Balogun', 'USA', 'ST', 78, 24]
    ],
    'Marseille': [
      ['Mason Greenwood', 'England', 'RW', 81, 24], ['Gerónimo Rulli', 'Argentina', 'GK', 80, 33],
      ['Leonardo Balerdi', 'Argentina', 'CB', 79, 26]
    ],
    'Lille': [
      ['Benjamin André', 'France', 'CDM', 78, 35], ['Hákon Arnar Haraldsson', 'Iceland', 'CAM', 77, 22],
      ['Nabil Bentaleb', 'Algeria', 'CM', 76, 30]
    ],
    'Lyon': [
      ['Corentin Tolisso', 'France', 'CM', 80, 31], ['Georges Mikautadze', 'Georgia', 'ST', 78, 24],
      ['Malick Fofana', 'Belgium', 'LW', 77, 20]
    ],
    'Nice': [
      ['Marcin Bułka', 'Poland', 'GK', 79, 25], ['Evann Guessand', 'Ivory Coast', 'ST', 77, 24],
      ['Dante', 'Brazil', 'CB', 75, 41]
    ],
    'Rennes': [
      ['Brice Samba', 'France', 'GK', 78, 31], ['Ludovic Blas', 'France', 'CAM', 77, 27],
      ['Seko Fofana', 'Ivory Coast', 'CM', 77, 30]
    ],
    'Lens': [
      ['Florian Thauvin', 'France', 'RW', 77, 32], ['Adrien Thomasson', 'France', 'CAM', 77, 31],
      ['Deiver Machado', 'Colombia', 'LB', 76, 31]
    ],
    'Strasbourg': [
      ['Emanuel Emegha', 'Netherlands', 'ST', 77, 22], ['Guéla Doué', 'Ivory Coast', 'RB', 76, 22],
      ['Joaquín Panichelli', 'Argentina', 'ST', 76, 22]
    ],
    'Nantes': [
      ['Alban Lafont', 'France', 'GK', 77, 26], ['Moses Simon', 'Nigeria', 'LW', 76, 30],
      ['Matthis Abline', 'France', 'ST', 76, 22]
    ],
    'Toulouse': [
      ['Guillaume Restes', 'France', 'GK', 77, 20], ['Cristian Cásseres Jr.', 'Venezuela', 'CM', 74, 25],
      ['Aron Dønnum', 'Norway', 'RW', 74, 27]
    ],
    'Brest': [
      ['Pierre Lees-Melou', 'France', 'CM', 76, 32], ['Romain Del Castillo', 'France', 'RW', 75, 29],
      ['Brendan Chardonnet', 'France', 'CB', 74, 30]
    ],
    // Netherlands
    'Ajax': [
      ['Steven Berghuis', 'Netherlands', 'RW', 78, 33], ['Davy Klaassen', 'Netherlands', 'CM', 78, 32],
      ['Wout Weghorst', 'Netherlands', 'ST', 78, 33], ['Kenneth Taylor', 'Netherlands', 'CM', 77, 23]
    ],
    'PSV': [
      ['Jerdy Schouten', 'Netherlands', 'CDM', 79, 28], ['Ismael Saibari', 'Morocco', 'CAM', 78, 24],
      ['Ricardo Pepi', 'USA', 'ST', 78, 22], ['Joey Veerman', 'Netherlands', 'CM', 78, 26]
    ],
    'Feyenoord': [
      ['Quinten Timber', 'Netherlands', 'CM', 78, 24], ['Timon Wellenreuther', 'Germany', 'GK', 77, 29],
      ['Ayase Ueda', 'Japan', 'ST', 76, 26], ['Anis Hadj Moussa', 'Algeria', 'RW', 76, 23]
    ],
    'AZ Alkmaar': [
      ['Troy Parrott', 'Ireland', 'ST', 76, 23], ['Sven Mijnans', 'Netherlands', 'CAM', 76, 25],
      ['Jordy Clasie', 'Netherlands', 'CDM', 75, 34]
    ],
    'Twente': [
      ['Lars Unnerstall', 'Netherlands', 'GK', 75, 35], ['Ricky van Wolfswinkel', 'Netherlands', 'ST', 74, 36]
    ],
    'Utrecht': [
      ['Vasilis Barkas', 'Greece', 'GK', 74, 31], ['Victor Jensen', 'Denmark', 'CAM', 74, 25],
      ['Souffian El Karouani', 'Morocco', 'LB', 74, 24]
    ],
    // Portugal
    'Benfica': [
      ['Nicolás Otamendi', 'Argentina', 'CB', 81, 37], ['Vangelis Pavlidis', 'Greece', 'ST', 80, 26],
      ['Anatoliy Trubin', 'Ukraine', 'GK', 80, 24], ['Fredrik Aursnes', 'Norway', 'CM', 78, 29]
    ],
    'Porto': [
      ['Diogo Costa', 'Portugal', 'GK', 82, 26], ['Samu Aghehowa', 'Spain', 'ST', 79, 21],
      ['Luuk de Jong', 'Netherlands', 'ST', 78, 35], ['Pepê', 'Brazil', 'RW', 77, 28]
    ],
    'Sporting CP': [
      ['Pedro Gonçalves', 'Portugal', 'CAM', 81, 27], ['Morten Hjulmand', 'Denmark', 'CDM', 80, 26],
      ['Francisco Trincão', 'Portugal', 'RW', 79, 25], ['Rui Silva', 'Portugal', 'GK', 76, 31]
    ],
    'Braga': [
      ['Ricardo Horta', 'Portugal', 'RW', 78, 30], ['Rodrigo Zalazar', 'Uruguay', 'CAM', 77, 26],
      ['Sikou Niakaté', 'Mali', 'CB', 75, 26]
    ],
    // Argentina
    'River Plate': [
      ['Franco Armani', 'Argentina', 'GK', 77, 39], ['Sebastián Driussi', 'Argentina', 'CAM', 76, 29],
      ['Paulo Díaz', 'Chile', 'CB', 76, 31]
    ],
    'Boca Juniors': [
      ['Leandro Paredes', 'Argentina', 'CDM', 79, 31], ['Edinson Cavani', 'Uruguay', 'ST', 78, 38],
      ['Sergio Romero', 'Argentina', 'GK', 76, 38]
    ],
    'Racing Club': [
      ['Adrián Martínez', 'Argentina', 'ST', 76, 33], ['Gabriel Arias', 'Chile', 'GK', 76, 37],
      ['Agustín Almendra', 'Argentina', 'CM', 74, 25]
    ],
    // Brazil
    'Flamengo': [
      ['Giorgian de Arrascaeta', 'Uruguay', 'CAM', 81, 31], ['Pedro', 'Brazil', 'ST', 80, 28],
      ['Agustín Rossi', 'Argentina', 'GK', 79, 30], ['Danilo', 'Brazil', 'CB', 76, 34]
    ],
    'Palmeiras': [
      ['Gustavo Gómez', 'Paraguay', 'CB', 81, 32], ['Raphael Veiga', 'Brazil', 'CAM', 79, 30],
      ['Weverton', 'Brazil', 'GK', 79, 37], ['Vitor Roque', 'Brazil', 'ST', 77, 20]
    ],
    'Botafogo': [
      ['Alexander Barboza', 'Argentina', 'CB', 77, 30], ['Artur', 'Brazil', 'RW', 76, 27],
      ['Marlon Freitas', 'Brazil', 'CDM', 75, 30]
    ],
    'São Paulo': [
      ['Lucas Moura', 'Brazil', 'RW', 78, 33], ['Jonathan Calleri', 'Argentina', 'ST', 77, 32],
      ['Rafael', 'Brazil', 'GK', 74, 36]
    ],
    // USA
    'Inter Miami': [
      ['Lionel Messi', 'Argentina', 'RW', 88, 38], ['Luis Suárez', 'Uruguay', 'ST', 82, 38],
      ['Rodrigo De Paul', 'Argentina', 'CM', 82, 31], ['Sergio Busquets', 'Spain', 'CDM', 81, 37],
      ['Jordi Alba', 'Spain', 'LB', 80, 36]
    ],
    'LAFC': [
      ['Son Heung-min', 'South Korea', 'LW', 83, 33], ['Hugo Lloris', 'France', 'GK', 82, 38],
      ['Denis Bouanga', 'Gabon', 'ST', 81, 30]
    ],
    'LA Galaxy': [
      ['Marco Reus', 'Germany', 'CAM', 80, 36], ['Riqui Puig', 'Spain', 'CM', 78, 26],
      ['Gabriel Pec', 'Brazil', 'RW', 78, 24]
    ],
    'Seattle Sounders': [
      ['Albert Rusnák', 'Slovakia', 'CAM', 76, 31], ['Stefan Frei', 'USA', 'GK', 74, 39],
      ['Pedro de la Vega', 'Argentina', 'LW', 74, 24]
    ],
    'Atlanta United': [
      ['Miguel Almirón', 'Paraguay', 'CAM', 78, 31], ['Emmanuel Latte Lath', 'Ivory Coast', 'ST', 76, 26],
      ['Aleksey Miranchuk', 'Russia', 'CAM', 76, 29]
    ],
    'Columbus Crew': [
      ['Diego Rossi', 'Uruguay', 'ST', 78, 27], ['Darlington Nagbe', 'USA', 'CM', 74, 35],
      ['Patrick Schulte', 'USA', 'GK', 74, 24]
    ],
    'NY Red Bulls': [
      ['Emil Forsberg', 'Sweden', 'CAM', 78, 34], ['Lewis Morgan', 'Scotland', 'RW', 75, 29],
      ['Carlos Coronel', 'Paraguay', 'GK', 74, 28]
    ],
    'Philadelphia Union': [
      ['Andre Blake', 'Jamaica', 'GK', 76, 34], ['Tai Baribo', 'Israel', 'ST', 75, 27],
      ['Quinn Sullivan', 'USA', 'CAM', 73, 21]
    ],
    'Portland Timbers': [
      ['David da Costa', 'Portugal', 'CAM', 75, 24], ['Antony', 'Brazil', 'LW', 74, 24],
      ['Maxime Crépeau', 'Canada', 'GK', 74, 31]
    ],
    'Austin FC': [
      ['Brandon Vázquez', 'USA', 'ST', 75, 26], ['Osman Bukari', 'Ghana', 'RW', 75, 26],
      ['Brad Stuver', 'USA', 'GK', 74, 34]
    ],
    'Nashville SC': [
      ['Hany Mukhtar', 'Germany', 'CAM', 78, 30], ['Sam Surridge', 'England', 'ST', 75, 27],
      ['Walker Zimmerman', 'USA', 'CB', 74, 32]
    ],
    'Chicago Fire': [
      ['Hugo Cuypers', 'Belgium', 'ST', 77, 28], ['Philip Zinckernagel', 'Denmark', 'LW', 76, 30],
      ['Chris Brady', 'USA', 'GK', 74, 21]
    ]
  };

  /* --- Names ---------------------------------------------------------------
     The bulk of every squad is generated. What makes a squad list read as
     real is not famous names but *consistent* ones: a Spanish club full of
     Spanish names with a handful of imports, rather than a random mix of
     everything. The REAL_STARS above then anchor each club.
  --------------------------------------------------------------------------- */
  const NAMES = {
    England:     { first: ['Harry','Jack','Callum','Reece','Mason','Ollie','Tyler','Josh','Kieran','Declan','Aaron','Lewis','Charlie','Nathan','Jude','Bukayo','Marcus','Phil','Conor','Ben'],
                   last:  ['Bellamy','Hartley','Whitmore','Ashdown','Corbett','Radcliffe','Prescott','Ainsley','Blackwood','Carrington','Hollis','Merrick','Tunstall','Waverley','Kingsley','Rowntree','Sandford','Ellery','Marlowe','Barnett'] },
    Spain:       { first: ['Sergio','Álvaro','Iker','Pablo','Marcos','Javi','Unai','Rubén','Nacho','Aitor','Gonzalo','Diego','Adrián','Íñigo','Bruno','Mikel','Rodri','Dani','Hugo','Pau'],
                   last:  ['Herrera','Cabrera','Solano','Requena','Bautista','Otero','Mendieta','Valverde','Salguero','Iriarte','Barrantes','Zubeldia','Camacho','Ferrán','Bilbao','Arriaga','Pinilla','Quintana','Sarabia','Casillas'] },
    Italy:       { first: ['Matteo','Lorenzo','Andrea','Riccardo','Federico','Alessio','Davide','Giacomo','Simone','Nicolò','Tommaso','Gianluca','Stefano','Marco','Luca','Emanuele','Fabio','Cristian','Michele','Samuele'],
                   last:  ['Marchetti','Bellini','Lombardi','Zaccaria','Pellegrini','Vitali','Fiorentino','Barbieri','Caruso','Mancuso','Rizzoli','Tavecchio','Orsini','Sartori','Grimaldi','Bonaventura','Salvatore','Perrone','Manzoni','Falcone'] },
    Germany:     { first: ['Leon','Jonas','Nico','Maximilian','Felix','Luca','Tim','Julian','Florian','Marvin','Kevin','Niklas','Jannik','Moritz','Elias','Robin','Lennart','Fabian','Tobias','Sven'],
                   last:  ['Weissmann','Brandt','Köhler','Steinbach','Hofmann','Reinhardt','Vollmer','Dietrich','Kranz','Lindner','Schuster','Hartwig','Beckmann','Ostermann','Gerlach','Wendland','Rothe','Bauer','Kesler','Neumeier'] },
    France:      { first: ['Lucas','Théo','Enzo','Hugo','Nathan','Mathis','Yanis','Rayan','Killian','Noah','Clément','Maxime','Antoine','Bilal','Ousmane','Amine','Baptiste','Gabin','Rémi','Sofiane'],
                   last:  ['Lemaire','Duval','Roussel','Marchand','Bonnet','Delcourt','Fontaine','Guerin','Marceau','Vasseur','Perrin','Cissé','Traoré','Dembakh','Lavigne','Chevalier','Barreau','Nkolo','Rimbaud','Sagnol'] },
    Netherlands: { first: ['Daan','Sem','Luuk','Bram','Thijs','Jurriën','Ryan','Mees','Stijn','Kees','Joris','Ties','Sven','Milan','Xavi','Youri','Cody','Wout','Jorrit','Ruben'],
                   last:  ['van Dijken','de Wit','Bakhuis','Vermeer','Hoogland','van Rijn','Kuipers','Dekker','Veenstra','Molenaar','Brouwer','ten Cate','Sluiter','van Bergen','Hendriks','Roelofs','Blankers','de Groot','Verhoeven','Stekelenburg'] },
    Portugal:    { first: ['João','Rúben','Diogo','Gonçalo','Tiago','Rafael','André','Bernardo','Nuno','Vitinha','Fábio','Ricardo','Bruno','Pedro','Miguel','Hélder','Duarte','Tomás','Rodrigo','Ivo'],
                   last:  ['Fonseca','Pereira','Moutinho','Cardoso','Teixeira','Sequeira','Barbosa','Antunes','Guedes','Rebelo','Faria','Nogueira','Machado','Lourenço','Pinheiro','Trincão','Semedo','Bragança','Vinagre','Palhinha'] },
    Argentina:   { first: ['Santiago','Franco','Lautaro','Nicolás','Julián','Emiliano','Facundo','Agustín','Tomás','Matías','Lucas','Gonzalo','Ezequiel','Valentín','Alan','Thiago','Ramiro','Joaquín','Bruno','Cristian'],
                   last:  ['Ferreyra','Domínguez','Balbuena','Ocampos','Zabaleta','Palacios','Cardozo','Almirón','Barrios','Quiroga','Villalba','Sosa','Andrada','Benedetto','Retegui','Colidio','Buonanotte','Garnacho','Paredes','Otamendi'] },
    Brazil:      { first: ['Gabriel','Lucas','Matheus','Rodrygo','Vinícius','Bruno','Éder','Wesley','Kaio','Marquinhos','Danilo','Igor','Vitor','Thiago','Douglas','Everton','Pedro','Endrick','Raphael','Caio'],
                   last:  ['Ribeiro','Nascimento','Andrade','Cavalcanti','Bittencourt','Moraes','Siqueira','Vasconcelos','Guimarães','Teles','Correia','Aparecido','Rezende','Bastos','Furtado','Macedo','Prado','Barcellos','Amorim','Queiroz'] },
    USA:         { first: ['Tyler','Brandon','Christian','Weston','Gio','Cade','Jackson','Ethan','Cole','Owen','Malik','Diego','Ryan','Trevor','Kobe','Paxten','Auston','Bryce','Devin','Julian'],
                   last:  ['Hutchinson','Delgado','Whitaker','Sandoval','Bradley','Ferguson','Nakamura','Okonkwo','Vasquez','Sheffield','Aaronson','Reyna','Turner','Zimmerman','Musah','Cardoso','Wolff','Pomykal','Sargent','Ledezma'] },
    Belgium:     { first: ['Arthur','Lois','Charles','Romeo','Senne','Maarten','Wout','Zeno','Amadou','Jérémy'],
                   last:  ['Vermeulen','Dendoncker','Verstraete','Lukebakio','Openda','Bakayoko','De Ketelaere','Vranckx','Theate','Castagne'] },
    Croatia:     { first: ['Luka','Marko','Ivan','Josip','Mateo','Ante','Duje','Petar','Nikola','Borna'],
                   last:  ['Modrić','Kovačević','Perišić','Vlašić','Sučić','Baturina','Šutalo','Erlić','Juranović','Pašalić'] },
    Serbia:      { first: ['Nikola','Dušan','Aleksa','Filip','Miloš','Strahinja','Lazar','Veljko','Uroš','Petar'],
                   last:  ['Jovanović','Milinković','Pavlović','Kostić','Mitrović','Vlahović','Ilić','Gudelj','Stanković','Radonjić'] },
    Poland:      { first: ['Jakub','Piotr','Kacper','Bartosz','Michał','Sebastian','Nicola','Damian','Krzysztof','Mateusz'],
                   last:  ['Kowalczyk','Zieliński','Bednarek','Szymański','Frankowski','Kiwior','Zalewski','Cash','Skorupski','Buksa'] },
    Turkey:      { first: ['Emre','Kerem','Arda','Yusuf','Mert','Baris','Kaan','Orkun','Ferdi','Cengiz'],
                   last:  ['Yılmaz','Aktürkoğlu','Demiral','Kabak','Ayhan','Kökçü','Çalhanoğlu','Bardakçı','Müldür','Akgün'] },
    Nigeria:     { first: ['Chidi','Emeka','Kelechi','Ademola','Samuel','Victor','Joe','Alex','Tunde','Ola'],
                   last:  ['Okafor','Adeyemi','Balogun','Nwankwo','Chukwueze','Osimhen','Aribo','Ndidi','Iheanacho','Bassey'] },
    Senegal:     { first: ['Ismaïla','Cheikh','Pape','Moussa','Idrissa','Nicolas','Abdou','Iliman','Boulaye','Habib'],
                   last:  ['Diallo','Ndiaye','Sarr','Gueye','Mendy','Cissé','Diatta','Jakobs','Ciss','Faye'] },
    Ghana:       { first: ['Kwame','Kofi','Mohammed','Jordan','Elisha','Fatawu','Ernest','Baba','Alidu','Osman'],
                   last:  ['Mensah','Boateng','Owusu','Partey','Ayew','Kudus','Nuamah','Salisu','Bukari','Semenyo'] },
    Morocco:     { first: ['Youssef','Achraf','Sofyan','Hakim','Bilal','Amine','Nayef','Azzedine','Ilias','Anass'],
                   last:  ['El Amrani','Benhaddou','Ouahabi','Chibani','Mazraoui','Zaroury','Amrabat','Aguerd','Saïss','Boufal'] },
    Japan:       { first: ['Kaoru','Takefusa','Daichi','Ritsu','Ao','Wataru','Hidemasa','Junya','Reo','Koki'],
                   last:  ['Tanaka','Nakamura','Sugawara','Hashioka','Morita','Kubota','Ito','Endo','Kamada','Machida'] },
    Norway:      { first: ['Erling','Martin','Sander','Kristian','Ola','Fredrik','Jens','Antonio','Morten','Oscar'],
                   last:  ['Berge','Nordtveit','Solbakken','Hovland','Ryerson','Aursnes','Strand','Bobb','Thorsby','Sørloth'] },
    Sweden:      { first: ['Alexander','Viktor','Emil','Dejan','Anthony','Gustav','Hugo','Jesper','Isaac','Linus'],
                   last:  ['Lindqvist','Bergström','Forsberg','Kulusevski','Elanga','Svensson','Larsson','Karlström','Ekdal','Holm'] },
    Uruguay:     { first: ['Federico','Manuel','Facundo','Darwin','Nicolás','Rodrigo','Maximiliano','Agustín','Brian','Sebastián'],
                   last:  ['Valverde','Ugarte','Pellistri','Núñez','De la Cruz','Bentancur','Araújo','Cáceres','Rodríguez','Olivera'] },
    Colombia:    { first: ['Luis','Jhon','Rafael','Yerry','Daniel','Jorge','Kevin','Johan','Richard','Nelson'],
                   last:  ['Córdoba','Arias','Lerma','Sinisterra','Muñoz','Borré','Uribe','Mosquera','Ospina','Carrascal'] },
    Mexico:      { first: ['Santiago','Hirving','Edson','César','Orbelín','Luis','Jorge','Israel','Roberto','Julián'],
                   last:  ['Giménez','Álvarez','Montes','Sánchez','Pineda','Vásquez','Antuna','Reyes','Alvarado','Araujo'] },
    Ireland:     { first: ['Evan','Josh','Nathan','Séamus','Finn','Adam','Chiedozie','Dara','Killian','Mikey'],
                   last:  ["O'Brien","Ferguson","Collins","Doherty","Ogbene","Cullen","Molumby","Idah","Coleman","Egan"] },
    Scotland:    { first: ['Callum','Scott','Kieran','Lewis','Ryan','Billy','Andy','Aaron','Grant','Ben'],
                   last:  ['McTominay','Robertson','Gilmour','Ferguson','Christie','Armstrong','McGregor','Hickey','Hanley','Doig'] },
    Denmark:     { first: ['Rasmus','Mikkel','Christian','Jonas','Andreas','Victor','Pierre','Joakim','Anders','Mads'],
                   last:  ['Højlund','Damsgaard','Kristensen','Skov','Wind','Nelsson','Dolberg','Bruun','Vestergaard','Poulsen'] }
  };

  // where a club's players tend to come from: mostly local, some imports
  const IMPORT_POOLS = {
    England: ['Ireland','Scotland','France','Netherlands','Brazil','Nigeria','Denmark','Belgium'],
    Spain:   ['Argentina','Brazil','Portugal','Morocco','Uruguay','France'],
    Italy:   ['Argentina','Brazil','Serbia','France','Netherlands','Poland'],
    Germany: ['Turkey','Poland','Netherlands','Denmark','Japan','Nigeria','France'],
    France:  ['Senegal','Morocco','Ghana','Nigeria','Belgium','Brazil'],
    Netherlands: ['Belgium','Ghana','Nigeria','Denmark','Japan','Morocco'],
    Portugal: ['Brazil','Spain','Ghana','Senegal','Uruguay','Nigeria'],
    Argentina: ['Uruguay','Colombia','Brazil','Mexico'],
    Brazil:  ['Argentina','Uruguay','Colombia','Portugal'],
    USA:     ['Mexico','Colombia','England','Japan','Ghana','Brazil']
  };

  // fallback pools used when nothing else applies
  const FIRST_NAMES = NAMES.England.first.concat(NAMES.Brazil.first, NAMES.Spain.first);
  const LAST_NAMES = NAMES.England.last.concat(NAMES.Brazil.last, NAMES.Spain.last);

  // --- Traits (earned on the pitch, never bought) --------------------------
  const TRAITS = {
    clinical:  { name: 'Clinical Finisher', icon: 'shooting', desc: '+8% on shooting moments.' },
    ice:       { name: 'Ice in the Veins',  icon: 'penalty',  desc: '+12% on penalties and shootouts.' },
    engine:    { name: 'The Engine',        icon: 'fitness',  desc: 'Fitness drains 30% slower.' },
    idol:      { name: 'Terrace Idol',      icon: 'fans',     desc: 'Reputation grows 50% faster.' },
    leader:    { name: 'Born Leader',       icon: 'crown',    desc: 'The team lifts around you: +3 team strength.' },
    glass:     { name: 'Glass Ankles',      icon: 'injury',   desc: 'Injuries come far more easily.', bad: true },
    hothead:   { name: 'Hot Head',          icon: 'card',     desc: 'Referees reach for their pocket sooner.', bad: true },
    wizard:    { name: 'Set Piece Wizard',  icon: 'corner',   desc: '+12% on free kicks and corners.' },
    tank:      { name: 'Immovable',         icon: 'block',    desc: '+10% in duels and tackles.' },
    showman:   { name: 'Showman',           icon: 'flair',    desc: 'Flair choices come off far more often.' },
    workhorse: { name: 'Workhorse',         icon: 'train',    desc: 'Training gains +25%.' },
    twofooted: { name: 'Two-Footed',        icon: 'weakFoot', desc: 'Your weak foot stops being a weakness.' },
    lucky:     { name: 'Born Lucky',        icon: 'star',     desc: 'Coin-flip moments tilt your way.' },

    // --- style traits: each one sharpens a particular kind of moment ---
    finesse:   { name: 'Finesse Expert',    icon: 'target',   desc: '+12% when you place or curl it rather than hit it.' },
    power:     { name: 'Power Shooter',     icon: 'physical', desc: '+12% when you strike it with everything you have.' },
    poacher:   { name: 'Six-Yard Poacher',  icon: 'rebound',  desc: '+15% on rebounds, tap-ins and scraps in the box.' },
    aerial:    { name: 'Aerial Threat',     icon: 'header',   desc: '+13% on headers, attacking and defending.' },
    visionary: { name: 'Visionary',         icon: 'passing',  desc: '+12% on through balls and killer passes.' },
    burst:     { name: 'Explosive',         icon: 'pace',     desc: '+12% whenever a moment comes down to raw speed.' },
    pressres:  { name: 'Press Resistant',   icon: 'block',    desc: '+15% when playing out of trouble under pressure.' },
    longrange: { name: 'Long Range Threat', icon: 'shooting', desc: '+18% from distance. Worth a go from anywhere.' },
    shotstop:  { name: 'Shot Stopper',      icon: 'gk',       desc: '+13% on saves. The last line, properly.' },
    sweeperk:  { name: 'Sweeper Keeper',    icon: 'keeper',   desc: '+13% rushing out and playing with your feet.' },
    theatrical:{ name: 'Theatrical',        icon: 'dive',     desc: 'Referees buy it more often than they should.' },
    ironman:   { name: 'Iron Man',          icon: 'fitness',  desc: 'Injuries are far less likely to find you.' }
  };

  // --- Training drills ------------------------------------------------------
  const TRAINING = [
    { id: 'finishing', name: 'Finishing Drills',  attr: 'shooting',  icon: 'shooting',  fatigue: 12 },
    { id: 'sprints',   name: 'Sprint Work',       attr: 'pace',      icon: 'pace',      fatigue: 16 },
    { id: 'rondo',     name: 'Rondos & Passing',  attr: 'passing',   icon: 'passing',   fatigue: 8 },
    { id: 'skills',    name: 'Close Control',     attr: 'dribbling', icon: 'dribbling', fatigue: 10 },
    { id: 'defwork',   name: 'Defensive Shape',   attr: 'defending', icon: 'defending', fatigue: 10 },
    { id: 'gym',       name: 'Weights & Gym',     attr: 'physical',  icon: 'physical',  fatigue: 14 },
    { id: 'tricks',    name: 'Tricks & Flicks',   attr: 'flair',     icon: 'flair',     fatigue: 9 },
    { id: 'weakfoot',  name: 'Weak Foot Work',    attr: 'weakFoot',  icon: 'weakFoot',  fatigue: 9 },
    { id: 'keeping',   name: 'Keeper Session',    attr: 'gk',        icon: 'gk',        fatigue: 10 }
  ];

  /* --- The draft ------------------------------------------------------------
     Eight legends come past you one at a time and you rob exactly one attribute
     from each. What you steal becomes your ceiling in that attribute — you start
     at roughly half of it and grow towards it across your career.

     The legends are invented archetypes rather than real players, so nobody's
     name or record is being borrowed.
  --------------------------------------------------------------------------- */
  const LEGENDS = [
    { name: 'El Relámpago', nation: 'Argentina', era: "'98–'12", role: 'Left Winger',
      note: 'Nobody ever caught him. Nobody ever tried twice.',
      attrs: { pace: 97, shooting: 78, passing: 72, dribbling: 90, defending: 34, physical: 66, flair: 88, weakFoot: 52 } },
    { name: 'The Cannon', nation: 'Netherlands', era: "'01–'15", role: 'Striker',
      note: 'Broke three crossbars and one goalkeeper’s wrist.',
      attrs: { pace: 74, shooting: 96, passing: 63, dribbling: 70, defending: 30, physical: 86, flair: 60, weakFoot: 71 } },
    { name: 'Il Professore', nation: 'Italy', era: "'94–'10", role: 'Deep Playmaker',
      note: 'Saw the pass four seconds before anyone else did.',
      attrs: { pace: 58, shooting: 71, passing: 96, dribbling: 76, defending: 68, physical: 64, flair: 74, weakFoot: 80 } },
    { name: 'The Wall', nation: 'Germany', era: "'96–'11", role: 'Centre Back',
      note: 'Two hundred and eleven consecutive starts. Never once beaten in the air.',
      attrs: { pace: 62, shooting: 40, passing: 66, dribbling: 44, defending: 96, physical: 93, flair: 28, weakFoot: 58 } },
    { name: 'O Mágico', nation: 'Brazil', era: "'99–'13", role: 'Attacking Mid',
      note: 'Invented two skill moves. Named neither of them.',
      attrs: { pace: 80, shooting: 79, passing: 84, dribbling: 96, defending: 32, physical: 58, flair: 98, weakFoot: 74 } },
    { name: 'Two-Foot Tomás', nation: 'Uruguay', era: "'03–'19", role: 'Centre Mid',
      note: 'Scouts spent a decade arguing about which foot was his good one.',
      attrs: { pace: 71, shooting: 82, passing: 85, dribbling: 80, defending: 62, physical: 72, flair: 70, weakFoot: 97 } },
    { name: 'The Bull', nation: 'Ghana', era: "'05–'20", role: 'Target Man',
      note: 'Defenders bounced off him. So did one advertising hoarding.',
      attrs: { pace: 76, shooting: 84, passing: 55, dribbling: 62, defending: 55, physical: 97, flair: 48, weakFoot: 64 } },
    { name: 'Le Chirurgien', nation: 'France', era: "'97–'12", role: 'Winger',
      note: 'Every cross landed on the same blade of grass.',
      attrs: { pace: 84, shooting: 74, passing: 93, dribbling: 86, defending: 40, physical: 60, flair: 85, weakFoot: 88 } },
    { name: 'La Sombra', nation: 'Spain', era: "'02–'16", role: 'Holding Mid',
      note: 'You never noticed him until you watched it back.',
      attrs: { pace: 66, shooting: 58, passing: 90, dribbling: 78, defending: 88, physical: 76, flair: 62, weakFoot: 76 } },
    { name: 'The Comet', nation: 'Nigeria', era: "'08–'22", role: 'Right Winger',
      note: 'Forty yards in under four seconds, with the ball.',
      attrs: { pace: 95, shooting: 80, passing: 66, dribbling: 92, defending: 36, physical: 70, flair: 90, weakFoot: 58 } },
    { name: 'Old Iron', nation: 'England', era: "'92–'09", role: 'Captain',
      note: 'Played a cup final with a broken cheekbone and a plastic mask.',
      attrs: { pace: 60, shooting: 72, passing: 78, dribbling: 60, defending: 90, physical: 95, flair: 40, weakFoot: 70 } },
    { name: 'El Poeta', nation: 'Colombia', era: "'00–'14", role: 'Number Ten',
      note: 'Scored from the halfway line twice in one season, on purpose.',
      attrs: { pace: 72, shooting: 91, passing: 88, dribbling: 88, defending: 30, physical: 55, flair: 95, weakFoot: 82 } }
  ];

  // keepers rob from a different generation entirely
  const LEGENDS_GK = [
    { name: 'The Cat', nation: 'Spain', era: "'95–'11", role: 'Goalkeeper',
      note: 'Saved three penalties in one shootout and shrugged.',
      attrs: { pace: 62, gk: 97, passing: 70, dribbling: 55, defending: 60, physical: 80, flair: 58, weakFoot: 64 } },
    { name: 'The Lighthouse', nation: 'Norway', era: "'99–'15", role: 'Goalkeeper',
      note: 'Two metres of him, and he came for everything.',
      attrs: { pace: 55, gk: 90, passing: 66, dribbling: 44, defending: 72, physical: 96, flair: 40, weakFoot: 58 } },
    { name: 'El Loco', nation: 'Mexico', era: "'01–'18", role: 'Sweeper Keeper',
      note: 'Took corners. Scored two. Conceded four because of it.',
      attrs: { pace: 88, gk: 84, passing: 90, dribbling: 82, defending: 66, physical: 74, flair: 94, weakFoot: 86 } },
    { name: 'The Librarian', nation: 'Japan', era: "'06–'21", role: 'Goalkeeper',
      note: 'Studied every taker. Guessed right more often than chance allows.',
      attrs: { pace: 64, gk: 93, passing: 82, dribbling: 60, defending: 78, physical: 76, flair: 50, weakFoot: 90 } },
    { name: 'Stone Hands', nation: 'Serbia', era: "'97–'13", role: 'Goalkeeper',
      note: 'Never once spilled a shot. His nickname was meant kindly.',
      attrs: { pace: 58, gk: 95, passing: 60, dribbling: 40, defending: 70, physical: 88, flair: 36, weakFoot: 55 } },
    { name: 'The Understudy', nation: 'Ireland', era: "'04–'20", role: 'Goalkeeper',
      note: 'Waited nine years for a debut, then kept the shirt for eleven.',
      attrs: { pace: 66, gk: 86, passing: 76, dribbling: 58, defending: 82, physical: 82, flair: 62, weakFoot: 78 } },
    { name: 'El Muro', nation: 'Argentina', era: "'93–'08", role: 'Goalkeeper',
      note: 'Organised his back four with his voice alone. You could hear him from the away end.',
      attrs: { pace: 60, gk: 91, passing: 68, dribbling: 48, defending: 90, physical: 84, flair: 44, weakFoot: 62 } },
    { name: 'The Kid', nation: 'Belgium', era: "'12–now", role: 'Goalkeeper',
      note: 'Still playing. Already the best of his generation.',
      attrs: { pace: 78, gk: 89, passing: 88, dribbling: 70, defending: 74, physical: 80, flair: 72, weakFoot: 92 } }
  ];

  const CONFIG = {
    SEASON_START_YEAR: 2026,
    LEAGUE_SIZE: 12,
    RETIRE_MIN_AGE: 28,
    DRAFT_PICKS: 8,
    DRAFT_START_RATIO: 0.52,   // you begin at about half a legend's number
    SAVE_KEY: 'footy_career_save_v2'
  };

  global.DATA = {
    POSITIONS, ATTR_KEYS, ATTR_LABEL, DRAFT_ATTRS, DRAFT_ATTRS_GK,
    LEAGUES, CONTINENTAL, NATIONS, CLUB_KIT, REAL_STARS, NAMES, IMPORT_POOLS, FIRST_NAMES, LAST_NAMES,
    TRAITS, TRAINING, LEGENDS, LEGENDS_GK, CONFIG
  };
})(window);
