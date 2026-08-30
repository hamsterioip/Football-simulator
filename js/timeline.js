/* ==========================================================================
   timeline.js — a player's career in eras.

   The idea is the one the big football games use: a great player is not one
   card, he is several. The kid who broke through, the version that won
   everything, the elder statesman. You sign the man as he is today, and his
   timeline shows you every version of him there has been.

   Curated entries below are the well-known ones — the clubs and the years are
   public record, the ratings are this game's opinion. For everybody else the
   arc is generated from his age and rating, and deliberately does not name
   clubs he may never have played for.
   ========================================================================== */
(function (global) {
  'use strict';

  /* [year, club, age, ovr, label] */
  const PLAYER_ERAS = {
    'Cristiano Ronaldo': [
      [2004, 'Sporting CP', 18, 74, 'The kid from Madeira'],
      [2007, 'Manchester United', 22, 89, 'Stepovers and a whole league rattled'],
      [2009, 'Manchester United', 24, 93, 'Ballon d’Or, and off to Madrid'],
      [2014, 'Real Madrid', 29, 98, 'La Décima. The best on earth'],
      [2018, 'Juventus', 33, 93, 'Still scoring, somewhere new'],
      [2026, 'Al Nassr', 41, 93, 'Forty-one, and nowhere near finished']
    ],
    'Lionel Messi': [
      [2005, 'Barcelona', 18, 76, 'Seventeen and already impossible to mark'],
      [2009, 'Barcelona', 22, 93, 'Six trophies in a calendar year'],
      [2012, 'Barcelona', 25, 98, 'Ninety-one goals in a year'],
      [2015, 'Barcelona', 28, 97, 'The second treble'],
      [2022, 'Paris SG', 35, 94, 'A World Cup, finally'],
      [2026, 'Inter Miami', 38, 95, 'Still the best passer in any room']
    ],
    'Kylian Mbappé': [
      [2017, 'Monaco', 18, 82, 'Nobody could live with him'],
      [2018, 'Paris SG', 19, 88, 'A World Cup at nineteen'],
      [2022, 'Paris SG', 23, 93, 'A hat-trick in a final'],
      [2026, 'Real Madrid', 26, 95, 'The best forward alive']
    ],
    'Erling Haaland': [
      [2019, 'RB Salzburg', 19, 80, 'Eight in the group stage'],
      [2021, 'Borussia Dortmund', 21, 88, 'A goal every time he played'],
      [2023, 'Manchester City', 23, 93, 'Thirty-six in a league season'],
      [2026, 'Manchester City', 25, 95, 'A treble and a habit']
    ],
    'Harry Kane': [
      [2015, 'Tottenham', 21, 82, 'One-season wonder, they said'],
      [2018, 'Tottenham', 24, 90, 'A Golden Boot at a World Cup'],
      [2021, 'Tottenham', 27, 92, 'Scoring them and making them'],
      [2026, 'Bayern München', 32, 93, 'Finally winning things']
    ],
    'Mohamed Salah': [
      [2014, 'Chelsea', 21, 76, 'It did not work out in London'],
      [2016, 'Roma', 24, 85, 'Rebuilt in Italy'],
      [2018, 'Liverpool', 25, 92, 'Thirty-two in a Premier League season'],
      [2020, 'Liverpool', 27, 93, 'A European Cup and a title'],
      [2026, 'Liverpool', 33, 92, 'Still the first name on the sheet']
    ],
    'Kevin De Bruyne': [
      [2013, 'Chelsea', 22, 78, 'Sent out on loan'],
      [2015, 'Wolfsburg', 24, 86, 'The best player in Germany'],
      [2020, 'Manchester City', 29, 94, 'Twenty assists in a season'],
      [2026, 'Manchester City', 34, 90, 'Fewer minutes, same passes']
    ],
    'Karim Benzema': [
      [2008, 'Lyon', 20, 82, 'The best young forward in France'],
      [2014, 'Real Madrid', 26, 88, 'The one who made room for others'],
      [2022, 'Real Madrid', 34, 93, 'His own Ballon d’Or at last'],
      [2026, 'Al Ittihad', 38, 88, 'A different league, the same touch']
    ],
    'Virgil van Dijk': [
      [2015, 'Southampton', 24, 82, 'Too good for where he was'],
      [2019, 'Liverpool', 27, 93, 'Nobody got past him for a year'],
      [2026, 'Liverpool', 34, 91, 'Reads it before it happens']
    ],
    'Vinícius Júnior': [
      [2018, 'Real Madrid', 18, 76, 'All running, no end product'],
      [2022, 'Real Madrid', 22, 88, 'Scored in a Champions League final'],
      [2026, 'Real Madrid', 25, 93, 'Unplayable down the left']
    ],
    'Jude Bellingham': [
      [2020, 'Borussia Dortmund', 17, 76, 'Seventeen, and running a midfield'],
      [2023, 'Borussia Dortmund', 20, 85, 'Captain material already'],
      [2024, 'Real Madrid', 21, 91, 'Nineteen goals from midfield'],
      [2026, 'Real Madrid', 22, 93, 'The best midfielder in the world']
    ],
    'Lamine Yamal': [
      [2023, 'Barcelona', 16, 74, 'Sixteen years old, in a first team'],
      [2024, 'Barcelona', 17, 86, 'A European Championship at seventeen'],
      [2026, 'Barcelona', 18, 94, 'Already the best right winger alive']
    ],
    'Rodri': [
      [2018, 'Atlético Madrid', 22, 82, 'The best young holder in Spain'],
      [2023, 'Manchester City', 27, 91, 'Scored the goal that won the lot'],
      [2026, 'Manchester City', 29, 92, 'The whole team runs through him']
    ],
    'Bukayo Saka': [
      [2020, 'Arsenal', 18, 76, 'Thrown in and never dropped'],
      [2023, 'Arsenal', 21, 86, 'Carrying a title challenge'],
      [2026, 'Arsenal', 24, 91, 'Nobody in England beats him one-on-one']
    ],
    'Thibaut Courtois': [
      [2013, 'Atlético Madrid', 21, 85, 'On loan and already the best in Spain'],
      [2022, 'Real Madrid', 30, 93, 'The final he won on his own'],
      [2026, 'Real Madrid', 33, 92, 'Still enormous']
    ],
    'Lautaro Martínez': [
      [2018, 'Racing Club', 20, 78, 'Argentina noticed first'],
      [2023, 'Inter', 25, 87, 'Captain, and a European final'],
      [2026, 'Inter', 28, 91, 'Scores every kind of goal']
    ]
  };

  /* When we have no record, an arc built off what we do know — his age and
     what he is now. No club names, because inventing a career for a real
     person is worse than saying nothing. */
  function generated(p) {
    const U = global.U, out = [];
    const now = p.ovr, age = p.age;
    const yr = (global.State.game && global.State.game.world.year) || 2026;
    const at = a => yr - (age - a);
    const clamp = v => U.clamp(Math.round(v), 48, 97);

    if (age >= 20) out.push([at(18), null, 18, clamp(now - 15), 'Breaking through']);
    if (age >= 23) out.push([at(21), null, 21, clamp(now - 8), 'Coming of age']);
    // his best years: already had them, or they are the ones he is in
    if (age >= 30) {
      out.push([at(27), null, 27, clamp(now + 3), 'His very best']);
      out.push([yr, p.fromClub || null, age, now, 'Now']);
    } else if (age >= 26) {
      out.push([yr, p.fromClub || null, age, now, 'In his prime, now']);
    } else {
      out.push([yr, p.fromClub || null, age, now, 'Now — and still climbing']);
    }
    return out;
  }

  const Timeline = {
    PLAYER_ERAS,

    /* Every version of him, oldest first. */
    for(p) {
      if (!p) return [];
      const raw = PLAYER_ERAS[p.name];
      const rows = raw ? raw.map(r => r.slice()) : generated(p);
      return rows.map(([year, club, age, ovr, label]) => ({
        year, club, age, ovr, label,
        now: label === 'Now' || /^Now\b/.test(label || '') || year === (raw ? raw[raw.length - 1][0] : 0)
      }));
    },

    /* The best version there has ever been — the one that gets the card. */
    peakIndex(eras) {
      let best = 0;
      eras.forEach((e, i) => { if (e.ovr > eras[best].ovr) best = i; });
      return best;
    },

    /* Is this somebody we actually have a written history for? */
    curated(p) { return !!(p && PLAYER_ERAS[p.name]); }
  };

  global.Timeline = Timeline;
})(window);
