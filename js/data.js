/* ==========================================================================
   data.js — static game data: leagues, clubs, names, positions, config
   ========================================================================== */
(function (global) {
  'use strict';

  // --- Positions -----------------------------------------------------------
  // weights are used to compute the positional overall rating
  const POSITIONS = {
    GK:  { name: 'Goalkeeper',        group: 'GK',  attack: 0.02,
           w: { gk: .62, physical: .14, passing: .12, pace: .04, defending: .06, shooting: .00, dribbling: .02 } },
    CB:  { name: 'Centre Back',       group: 'DEF', attack: 0.10,
           w: { defending: .42, physical: .24, pace: .12, passing: .12, dribbling: .05, shooting: .05, gk: 0 } },
    LB:  { name: 'Left Back',         group: 'DEF', attack: 0.16,
           w: { defending: .30, pace: .22, physical: .16, passing: .18, dribbling: .10, shooting: .04, gk: 0 } },
    RB:  { name: 'Right Back',        group: 'DEF', attack: 0.16,
           w: { defending: .30, pace: .22, physical: .16, passing: .18, dribbling: .10, shooting: .04, gk: 0 } },
    CDM: { name: 'Defensive Mid',     group: 'MID', attack: 0.18,
           w: { defending: .32, passing: .26, physical: .22, dribbling: .10, pace: .06, shooting: .04, gk: 0 } },
    CM:  { name: 'Centre Mid',        group: 'MID', attack: 0.28,
           w: { passing: .34, dribbling: .18, defending: .16, physical: .14, shooting: .12, pace: .06, gk: 0 } },
    CAM: { name: 'Attacking Mid',     group: 'MID', attack: 0.38,
           w: { passing: .30, dribbling: .26, shooting: .22, pace: .10, physical: .06, defending: .06, gk: 0 } },
    LW:  { name: 'Left Winger',       group: 'ATT', attack: 0.44,
           w: { dribbling: .30, pace: .28, shooting: .20, passing: .14, physical: .05, defending: .03, gk: 0 } },
    RW:  { name: 'Right Winger',      group: 'ATT', attack: 0.44,
           w: { dribbling: .30, pace: .28, shooting: .20, passing: .14, physical: .05, defending: .03, gk: 0 } },
    ST:  { name: 'Striker',           group: 'ATT', attack: 0.52,
           w: { shooting: .40, pace: .20, physical: .16, dribbling: .14, passing: .08, defending: .02, gk: 0 } }
  };

  const ATTR_KEYS = ['pace', 'shooting', 'passing', 'dribbling', 'defending', 'physical', 'gk'];
  const ATTR_LABEL = {
    pace: 'Pace', shooting: 'Shooting', passing: 'Passing', dribbling: 'Dribbling',
    defending: 'Defending', physical: 'Physical', gk: 'Goalkeeping'
  };

  // --- Clubs ---------------------------------------------------------------
  // [name, rating, prestige(1-5)]  rating drives match strength & wages
  const LEAGUES = [
    { id: 'ENG', name: 'Premier League', country: 'England', flag: '🏴', tier: 5, cup: 'FA Cup',
      cont: 'UCL', clubs: [
      ['Manchester City', 89, 5], ['Arsenal', 87, 5], ['Liverpool', 87, 5], ['Chelsea', 84, 5],
      ['Manchester United', 83, 5], ['Tottenham', 82, 4], ['Newcastle', 80, 4], ['Aston Villa', 79, 4],
      ['Brighton', 77, 3], ['West Ham', 76, 3], ['Everton', 73, 3], ['Nottingham Forest', 71, 2]
    ]},
    { id: 'ESP', name: 'La Liga', country: 'Spain', flag: '🇪🇸', tier: 5, cup: 'Copa del Rey',
      cont: 'UCL', clubs: [
      ['Real Madrid', 90, 5], ['Barcelona', 88, 5], ['Atlético Madrid', 84, 5], ['Athletic Club', 79, 4],
      ['Real Sociedad', 78, 4], ['Villarreal', 77, 4], ['Real Betis', 76, 3], ['Sevilla', 76, 4],
      ['Valencia', 74, 4], ['Girona', 74, 2], ['Celta Vigo', 71, 2], ['Osasuna', 70, 2]
    ]},
    { id: 'ITA', name: 'Serie A', country: 'Italy', flag: '🇮🇹', tier: 5, cup: 'Coppa Italia',
      cont: 'UCL', clubs: [
      ['Inter', 86, 5], ['Juventus', 84, 5], ['AC Milan', 83, 5], ['Napoli', 82, 4],
      ['Atalanta', 81, 4], ['Roma', 80, 4], ['Lazio', 78, 4], ['Fiorentina', 76, 3],
      ['Bologna', 75, 3], ['Torino', 72, 3], ['Udinese', 70, 2], ['Genoa', 69, 2]
    ]},
    { id: 'GER', name: 'Bundesliga', country: 'Germany', flag: '🇩🇪', tier: 5, cup: 'DFB-Pokal',
      cont: 'UCL', clubs: [
      ['Bayern München', 88, 5], ['Bayer Leverkusen', 85, 4], ['Borussia Dortmund', 83, 5], ['RB Leipzig', 82, 4],
      ['Eintracht Frankfurt', 78, 3], ['Stuttgart', 77, 3], ['Wolfsburg', 75, 3], ['Freiburg', 74, 2],
      ['Hoffenheim', 72, 2], ['Werder Bremen', 71, 3], ['Mainz', 69, 2], ['Augsburg', 68, 2]
    ]},
    { id: 'FRA', name: 'Ligue 1', country: 'France', flag: '🇫🇷', tier: 4, cup: 'Coupe de France',
      cont: 'UCL', clubs: [
      ['Paris SG', 88, 5], ['Monaco', 80, 4], ['Marseille', 79, 4], ['Lille', 78, 3],
      ['Lyon', 77, 4], ['Nice', 76, 3], ['Rennes', 75, 3], ['Lens', 74, 3],
      ['Strasbourg', 71, 2], ['Nantes', 70, 2], ['Toulouse', 69, 2], ['Brest', 68, 1]
    ]},
    { id: 'NED', name: 'Eredivisie', country: 'Netherlands', flag: '🇳🇱', tier: 3, cup: 'KNVB Beker',
      cont: 'UCL', clubs: [
      ['Ajax', 79, 5], ['PSV', 80, 4], ['Feyenoord', 78, 4], ['AZ Alkmaar', 74, 3],
      ['Twente', 72, 2], ['Utrecht', 70, 2], ['Vitesse', 68, 2], ['Heerenveen', 66, 1],
      ['Groningen', 65, 1], ['Sparta Rotterdam', 64, 1], ['NEC', 64, 1], ['Go Ahead Eagles', 62, 1]
    ]},
    { id: 'POR', name: 'Primeira Liga', country: 'Portugal', flag: '🇵🇹', tier: 3, cup: 'Taça de Portugal',
      cont: 'UCL', clubs: [
      ['Benfica', 81, 4], ['Porto', 81, 4], ['Sporting CP', 80, 4], ['Braga', 75, 3],
      ['Vitória Guimarães', 70, 2], ['Boavista', 66, 2], ['Famalicão', 65, 1], ['Rio Ave', 64, 1],
      ['Gil Vicente', 63, 1], ['Casa Pia', 62, 1], ['Arouca', 62, 1], ['Estoril', 61, 1]
    ]},
    { id: 'ARG', name: 'Liga Profesional', country: 'Argentina', flag: '🇦🇷', tier: 3, cup: 'Copa Argentina',
      cont: 'LIB', clubs: [
      ['River Plate', 78, 5], ['Boca Juniors', 77, 5], ['Racing Club', 74, 4], ['Independiente', 72, 4],
      ['San Lorenzo', 71, 3], ['Estudiantes', 71, 3], ['Vélez Sarsfield', 70, 3], ['Talleres', 70, 2],
      ['Lanús', 68, 2], ['Rosario Central', 68, 2], ['Newell’s', 67, 2], ['Argentinos Juniors', 66, 2]
    ]},
    { id: 'BRA', name: 'Brasileirão', country: 'Brazil', flag: '🇧🇷', tier: 4, cup: 'Copa do Brasil',
      cont: 'LIB', clubs: [
      ['Flamengo', 80, 5], ['Palmeiras', 80, 5], ['Botafogo', 76, 3], ['São Paulo', 76, 4],
      ['Fluminense', 75, 4], ['Corinthians', 74, 4], ['Atlético Mineiro', 74, 4], ['Grêmio', 73, 4],
      ['Internacional', 73, 3], ['Cruzeiro', 71, 3], ['Fortaleza', 70, 2], ['Bahia', 69, 2]
    ]},
    { id: 'USA', name: 'Major League Soccer', country: 'USA', flag: '🇺🇸', tier: 2, cup: 'US Open Cup',
      cont: 'CCL', clubs: [
      ['Inter Miami', 76, 3], ['LAFC', 74, 3], ['LA Galaxy', 73, 3], ['Seattle Sounders', 72, 3],
      ['Atlanta United', 71, 2], ['Columbus Crew', 71, 2], ['NY Red Bulls', 70, 2], ['Philadelphia Union', 69, 2],
      ['Portland Timbers', 68, 2], ['Austin FC', 66, 1], ['Nashville SC', 66, 1], ['Chicago Fire', 65, 1]
    ]}
  ];

  const CONTINENTAL = {
    UCL: { name: 'Champions League', short: 'UCL', region: 'Europe' },
    LIB: { name: 'Copa Libertadores', short: 'Libertadores', region: 'South America' },
    CCL: { name: 'CONCACAF Champions Cup', short: 'CONCACAF CC', region: 'North America' }
  };

  // --- Nations (for the player + international tournaments) ----------------
  const NATIONS = [
    { name: 'England',     flag: '🏴', rating: 86 },
    { name: 'France',      flag: '🇫🇷', rating: 88 },
    { name: 'Brazil',      flag: '🇧🇷', rating: 87 },
    { name: 'Argentina',   flag: '🇦🇷', rating: 88 },
    { name: 'Spain',       flag: '🇪🇸', rating: 86 },
    { name: 'Germany',     flag: '🇩🇪', rating: 84 },
    { name: 'Italy',       flag: '🇮🇹', rating: 83 },
    { name: 'Portugal',    flag: '🇵🇹', rating: 85 },
    { name: 'Netherlands', flag: '🇳🇱', rating: 84 },
    { name: 'Belgium',     flag: '🇧🇪', rating: 82 },
    { name: 'Croatia',     flag: '🇭🇷', rating: 81 },
    { name: 'Uruguay',     flag: '🇺🇾', rating: 82 },
    { name: 'Colombia',    flag: '🇨🇴', rating: 81 },
    { name: 'Mexico',      flag: '🇲🇽', rating: 78 },
    { name: 'USA',         flag: '🇺🇸', rating: 77 },
    { name: 'Morocco',     flag: '🇲🇦', rating: 80 },
    { name: 'Senegal',     flag: '🇸🇳', rating: 80 },
    { name: 'Nigeria',     flag: '🇳🇬', rating: 78 },
    { name: 'Japan',       flag: '🇯🇵', rating: 78 },
    { name: 'South Korea', flag: '🇰🇷', rating: 76 },
    { name: 'Norway',      flag: '🇳🇴', rating: 75 },
    { name: 'Sweden',      flag: '🇸🇪', rating: 74 },
    { name: 'Poland',      flag: '🇵🇱', rating: 75 },
    { name: 'Serbia',      flag: '🇷🇸', rating: 76 },
    { name: 'Turkey',      flag: '🇹🇷', rating: 76 },
    { name: 'Australia',   flag: '🇦🇺', rating: 72 },
    { name: 'Canada',      flag: '🇨🇦', rating: 74 },
    { name: 'Ireland',     flag: '🇮🇪', rating: 72 },
    { name: 'Scotland',    flag: '🏴', rating: 73 },
    { name: 'Ghana',       flag: '🇬🇭', rating: 75 }
  ];

  // --- Name pools ----------------------------------------------------------
  const FIRST_NAMES = ['Leo','Marco','Diego','Kai','Luca','Mateo','Enzo','Rafael','Yusuf','Jamal','Noah','Elias',
    'Tomas','Andre','Bruno','Cristian','Dani','Emre','Felix','Gabriel','Hugo','Ibrahim','Jonas','Karim','Lucas',
    'Mo','Nico','Omar','Pablo','Quinn','Ryan','Santi','Theo','Umar','Victor','Wilson','Xavi','Yannick','Zane',
    'Ayo','Bilal','Cody','Dylan','Ezra','Finn','George','Harvey','Isaac','Jude','Kofi','Levi','Milos','Nathan'];
  const LAST_NAMES = ['Silva','Rossi','Fernandez','Okafor','Novak','Bakker','Costa','Muller','Dubois','Haaland',
    'Nakamura','Kovac','Ademola','Bianchi','Cruz','Delgado','Eriksen','Ferreira','Gomez','Hansen','Iversen',
    'Jansen','Keita','Lindqvist','Moreno','Nunes','Oliveira','Petrov','Quintero','Ramos','Sorensen','Traore',
    'Ulloa','Vargas','Wagner','Yilmaz','Zanetti','Ashworth','Blackwood','Carrington','Duarte','Esposito'];

  // --- Traits (unlockable perks) ------------------------------------------
  const TRAITS = {
    clinical:    { name: 'Clinical Finisher', icon: '🎯', desc: '+8% on shooting scenarios.' },
    ice:         { name: 'Ice in the Veins',  icon: '🧊', desc: '+12% on penalties & shootouts.' },
    engine:      { name: 'The Engine',        icon: '🫀', desc: 'Fitness drains 30% slower.' },
    magnet:      { name: 'Fan Magnet',        icon: '📣', desc: 'Fame grows 50% faster.' },
    leader:      { name: 'Born Leader',       icon: '🎖️', desc: 'Teammates lift: +3 team strength.' },
    glass:       { name: 'Glass Ankles',      icon: '🩼', desc: 'Injury risk raised (negative).', bad: true },
    hothead:     { name: 'Hot Head',          icon: '🤬', desc: 'Cards come easier (negative).', bad: true },
    wizard:      { name: 'Set Piece Wizard',  icon: '🌀', desc: '+12% on free kicks & corners.' },
    tank:        { name: 'Immovable',         icon: '🛡️', desc: '+10% on duels and tackles.' },
    showman:     { name: 'Showman',           icon: '🎪', desc: 'Flair choices pay off more often.' },
    workhorse:   { name: 'Workhorse',         icon: '⚙️', desc: 'Training gains +25%.' },
    lucky:       { name: 'Born Lucky',        icon: '🍀', desc: 'Coin-flip moments tilt your way.' }
  };

  // --- Training programmes -------------------------------------------------
  const TRAINING = [
    { id: 'finishing', name: 'Finishing Drills',  attr: 'shooting',  icon: '🥅', fatigue: 12 },
    { id: 'sprints',   name: 'Sprint Work',       attr: 'pace',      icon: '💨', fatigue: 16 },
    { id: 'rondo',     name: 'Rondos & Passing',  attr: 'passing',   icon: '🔄', fatigue: 8 },
    { id: 'skills',    name: 'Skill Moves',       attr: 'dribbling', icon: '🕺', fatigue: 10 },
    { id: 'defwork',   name: 'Defensive Shape',   attr: 'defending', icon: '🧱', fatigue: 10 },
    { id: 'gym',       name: 'Weights & Gym',     attr: 'physical',  icon: '🏋️', fatigue: 14 },
    { id: 'keeping',   name: 'Keeper Session',    attr: 'gk',        icon: '🧤', fatigue: 10 }
  ];

  // --- Assets you can buy --------------------------------------------------
  const ASSETS = [
    { id: 'boots',    name: 'Custom Boots',        icon: '👟', cost: 15000,    fame: 1,  happy: 4 },
    { id: 'watch',    name: 'Diamond Watch',       icon: '⌚', cost: 250000,   fame: 3,  happy: 6 },
    { id: 'car',      name: 'Supercar',            icon: '🏎️', cost: 900000,   fame: 5,  happy: 10 },
    { id: 'flat',     name: 'City Penthouse',      icon: '🏙️', cost: 2500000,  fame: 4,  happy: 12 },
    { id: 'mansion',  name: 'Country Mansion',     icon: '🏰', cost: 9000000,  fame: 7,  happy: 18 },
    { id: 'jet',      name: 'Private Jet',         icon: '✈️', cost: 28000000, fame: 12, happy: 22 },
    { id: 'island',   name: 'Private Island',      icon: '🏝️', cost: 65000000, fame: 18, happy: 30 },
    { id: 'club',     name: 'Buy a Lower-League Club', icon: '🏟️', cost: 120000000, fame: 25, happy: 35 }
  ];

  const INVESTMENTS = [
    { id: 'crypto',   name: 'Crypto Punt',      icon: '🪙', min: 10000,  risk: .55, mult: [0.0, 4.5] },
    { id: 'stocks',   name: 'Index Fund',       icon: '📈', min: 25000,  risk: .30, mult: [0.6, 1.9] },
    { id: 'resto',    name: 'Restaurant Chain', icon: '🍽️', min: 150000, risk: .40, mult: [0.2, 3.0] },
    { id: 'esports',  name: 'Esports Team',     icon: '🎮', min: 500000, risk: .45, mult: [0.1, 3.6] },
    { id: 'property', name: 'Property Portfolio', icon: '🏘️', min: 1000000, risk: .22, mult: [0.7, 2.2] }
  ];

  const SPONSORS = [
    { id: 'boot1', name: 'Strikeforce Boots', icon: '👟', minFame: 10, base: 250000 },
    { id: 'energy', name: 'VoltUp Energy',    icon: '⚡', minFame: 25, base: 700000 },
    { id: 'fashion', name: 'Maison Noir',     icon: '🕶️', minFame: 45, base: 2000000 },
    { id: 'game',   name: 'Ultra Football 26', icon: '🎮', minFame: 60, base: 4500000 },
    { id: 'global', name: 'Global Cola',      icon: '🥤', minFame: 78, base: 9000000 }
  ];

  const CONFIG = {
    SEASON_START_YEAR: 2026,
    LEAGUE_SIZE: 12,
    RETIRE_MIN_AGE: 28,
    SAVE_KEY: 'footy_life_save_v1'
  };

  global.DATA = {
    POSITIONS, ATTR_KEYS, ATTR_LABEL, LEAGUES, CONTINENTAL, NATIONS,
    FIRST_NAMES, LAST_NAMES, TRAITS, TRAINING, ASSETS, INVESTMENTS, SPONSORS, CONFIG
  };
})(window);
