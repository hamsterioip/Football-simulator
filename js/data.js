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

  // --- Name pools ----------------------------------------------------------
  const FIRST_NAMES = ['Leo','Marco','Diego','Kai','Luca','Mateo','Enzo','Rafael','Yusuf','Jamal','Noah','Elias',
    'Tomas','Andre','Bruno','Cristian','Dani','Emre','Felix','Gabriel','Hugo','Ibrahim','Jonas','Karim','Lucas',
    'Mo','Nico','Omar','Pablo','Quinn','Ryan','Santi','Theo','Umar','Victor','Wilson','Xavi','Yannick','Zane',
    'Ayo','Bilal','Cody','Dylan','Ezra','Finn','George','Harvey','Isaac','Jude','Kofi','Levi','Milos','Nathan'];
  const LAST_NAMES = ['Silva','Rossi','Fernandez','Okafor','Novak','Bakker','Costa','Muller','Dubois','Haaland',
    'Nakamura','Kovac','Ademola','Bianchi','Cruz','Delgado','Eriksen','Ferreira','Gomez','Hansen','Iversen',
    'Jansen','Keita','Lindqvist','Moreno','Nunes','Oliveira','Petrov','Quintero','Ramos','Sorensen','Traore',
    'Ulloa','Vargas','Wagner','Yilmaz','Zanetti','Ashworth','Blackwood','Carrington','Duarte','Esposito'];

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
    lucky:     { name: 'Born Lucky',        icon: 'star',     desc: 'Coin-flip moments tilt your way.' }
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
    LEAGUES, CONTINENTAL, NATIONS, FIRST_NAMES, LAST_NAMES,
    TRAITS, TRAINING, LEGENDS, LEGENDS_GK, CONFIG
  };
})(window);
