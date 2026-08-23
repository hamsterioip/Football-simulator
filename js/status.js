/* ==========================================================================
   status.js — what you mean to the team, and what people call you.

   Two things live here.

   HEART OF THE TEAM — a standing you earn by carrying a side: playing every
   week, rating well, and being responsible for a real share of the goals. Once
   you have it, the weeks you are missing actually cost them. Sometimes they
   fall apart without you; sometimes they dig in and play for you. Either way
   the absence is felt, which is the whole point of being the heart of a team.

   TITLES — the names the timeline gives you. Nobody chooses their own nickname
   in football, they earn one; here you earn them off what you have actually
   done, and then pick which one you want under your name.
   ========================================================================== */
(function (global) {
  'use strict';

  const HEART_ON = 70;      // earn it here
  const HEART_OFF = 52;     // lose it below here

  /* ---------------- heart of the team ---------------- */

  /* Your share of what the team does going forward. Not just goals — a holding
     midfielder who plays every week and rates 7.4 is a talisman too. */
  function involvement(g) {
    const p = g.player, U = global.U;
    const inv = (p.season.goals || 0) + (p.season.assists || 0) * 0.8;
    // roughly what a league side scores across a season at this level
    const club = global.State.club(p.club);
    const expected = Math.max(28, Math.round((club.rating - 52) * 1.5));
    return U.clamp(inv / expected, 0, 1);
  }

  /* 0-100. Shown as a bar, so it has to move for reasons you can feel. */
  function heartScore(g) {
    const p = g.player, U = global.U, State = global.State;
    if (!p.club) return 0;
    const D = global.DATA;
    const group = p.pos === 'GK' ? 'GK' : (D.POSITIONS[p.pos] || {}).group;

    const rating = State.seasonRating(p) || 0;
    const apps = p.season.apps || 0;
    const played = U.clamp(apps / 22, 0, 1);                       // availability
    const form = U.clamp((rating - 6.3) / 1.7, 0, 1);              // how well
    const share = group === 'GK' || group === 'DEF'
      ? U.clamp((p.season.cleanSheets || 0) / 10, 0, 1)            // defenders keep them out
      : involvement(g);                                            // the rest put them in
    const trust = U.clamp((p.managerTrust - 45) / 45, 0, 1);
    const standing = U.clamp((p.reputation - 15) / 55, 0, 1);
    const armband = p.captain ? 1 : 0;

    return Math.round(
      played * 30 + form * 26 + share * 22 + trust * 10 + standing * 8 + armband * 4
    );
  }

  /* The parts, for the card that explains why the number is what it is. */
  function heartParts(g) {
    const p = g.player, U = global.U, State = global.State, D = global.DATA;
    const group = p.pos === 'GK' ? 'GK' : (D.POSITIONS[p.pos] || {}).group;
    const rating = State.seasonRating(p) || 0;
    return [
      { label: 'Always available', v: U.clamp((p.season.apps || 0) / 22, 0, 1),
        note: (p.season.apps || 0) + ' apps this season' },
      { label: 'Performing', v: U.clamp((rating - 6.3) / 1.7, 0, 1),
        note: rating ? rating.toFixed(2) + ' average rating' : 'no rating yet' },
      { label: group === 'GK' || group === 'DEF' ? 'Keeping them out' : 'Decisive',
        v: group === 'GK' || group === 'DEF'
          ? U.clamp((p.season.cleanSheets || 0) / 10, 0, 1) : involvement(g),
        note: group === 'GK' || group === 'DEF'
          ? (p.season.cleanSheets || 0) + ' clean sheets'
          : (p.season.goals || 0) + ' goals, ' + (p.season.assists || 0) + ' assists' },
      { label: 'The manager trusts you', v: U.clamp((p.managerTrust - 45) / 45, 0, 1),
        note: Math.round(p.managerTrust) + '/100' },
      { label: 'They sing your name', v: U.clamp((p.reputation - 15) / 55, 0, 1),
        note: 'reputation ' + Math.round(p.reputation) }
    ];
  }

  /* Called after every match and at season end. Announces both directions. */
  function checkHeart(g) {
    const p = g.player, State = global.State;
    const score = heartScore(g);
    p.heartScore = score;
    const club = State.club(p.club);
    if (!p.heart && score >= HEART_ON && (p.season.apps || 0) >= 12) {
      p.heart = { since: g.world.year, club: club.name };
      State.news(`${p.lastName} has become the heartbeat of this ${club.name} side`, 'good', null, 'morale');
      State.log('You are the heart of this team now. They feel it when you are not there.', 'good');
      if (global.Social) global.Social.heart(g, true);
      return 'earned';
    }
    // you do not stop being the heart of a team in the second week of August —
    // the standing only comes under review once the season is properly under way
    if (p.heart && score < HEART_OFF && (p.season.apps || 0) >= 10) {
      p.heart = null;
      State.news(`${club.name} are learning to live without leaning on ${p.lastName}`, 'info', null, 'manager');
      if (global.Social) global.Social.heart(g, false);
      return 'lost';
    }
    return null;
  }

  /* What happens to them on a week you are not playing. Returns the swing to
     apply to team strength, and a line to print. */
  function absence(g, m) {
    const p = g.player, U = global.U, State = global.State;
    if (!p.heart) return null;
    if (m.role === 'start') return null;

    const squad = global.Engine.Squad.ensure(g);
    const rel = squad.reduce((a, s) => a + (s.rel || 50), 0) / squad.length;
    const club = State.club(p.club);
    // a tight dressing room with something to prove rallies; a fragile one folds
    const rallyChance = U.clamp(0.16 + (rel - 50) * 0.008 + (club.morale - 65) * 0.004, 0.08, 0.55);
    const rally = U.chance(rallyChance);
    const why = m.role === 'injured' ? 'without their injured talisman'
      : m.role === 'suspended' ? 'with their suspended talisman in the stand'
      : 'with their best player only on the bench';

    if (rally) {
      return { swing: 3.2, rally: true,
        line: `${club.name} play for ${p.lastName} tonight — everyone a yard sharper ${why}.` };
    }
    return { swing: -5.5, rally: false,
      line: `${club.name} look lost ${why}. Nobody else takes the game by the scruff.` };
  }

  /* ---------------- titles ---------------- */

  /* Each has a test against what you have actually done. `by` is the account
     that would coin it, which is what makes them feel like nicknames rather
     than achievements. */
  const TITLES = [
    { id: 'iceman', name: 'The Iceman', by: 'the timeline',
      hint: 'Ten penalties. Not one of them missed.',
      test: p => (p.penScored || 0) >= 10 && (p.penMissed || 0) === 0 },
    { id: 'cheatcode', name: 'Cheat Code', by: 'every rival fan, bitterly',
      hint: 'A 90 overall. People have stopped pretending it is fair.',
      test: p => p.ovr >= 90 },
    { id: 'machine', name: 'The Machine', by: 'the stats accounts',
      hint: 'Forty appearances in a season. He does not stop.',
      test: p => (p.season.apps || 0) >= 40 || (p.career.apps || 0) >= 450 },
    { id: 'wall', name: 'The Wall', by: 'the home end',
      hint: 'Fifteen clean sheets. Nothing gets through.',
      test: (p, g) => (p.season.cleanSheets || 0) >= 15 || (p.career.cleanSheets || 0) >= 90 },
    { id: 'goldenboy', name: 'Golden Boy', by: 'the back pages',
      hint: 'Twenty goals before your twenty-first birthday.',
      test: p => p.age <= 21 && (p.career.goals || 0) >= 20 },
    { id: 'assassin', name: 'The Assassin', by: 'a fan channel',
      hint: 'A hundred goals, and none of them by accident.',
      test: p => (p.career.goals || 0) >= 100 },
    { id: 'general', name: 'The General', by: 'your manager, in a presser',
      hint: 'The armband, and a manager who trusts you with everything.',
      test: p => p.captain && p.managerTrust >= 78 },
    { id: 'metronome', name: 'The Metronome', by: 'a tactics account',
      hint: 'Passing at 85, and the whole thing goes through you.',
      test: p => (p.attrs.passing || 0) >= 85 && (p.career.assists || 0) >= 50 },
    { id: 'silk', name: 'Silk', by: 'the compilation channels',
      hint: 'Flair at 88. They cut the highlights to music.',
      test: p => (p.attrs.flair || 0) >= 88 },
    { id: 'engine', name: 'The Engine', by: 'your own supporters',
      hint: 'Physical at 85 and you have never asked to come off.',
      test: p => (p.attrs.physical || 0) >= 85 && (p.career.apps || 0) >= 150 },
    { id: 'bigmatch', name: 'The Big-Match Player', by: 'a pundit who was wrong about you',
      hint: 'Thirty caps and a habit of turning up when it counts.',
      test: p => (p.intl.caps || 0) >= 30 && (p.career.motm || 0) >= 25 },
    { id: 'oneclub', name: 'One-Club Man', by: 'everyone, with respect',
      hint: 'Three hundred games. One badge. Nothing else needed saying.',
      test: p => (p.career.clubs || []).length === 1 && (p.career.apps || 0) >= 300 },
    { id: 'nomad', name: 'The Nomad', by: 'a transfer account',
      hint: 'Five clubs. A passport with some stamps in it.',
      test: p => (p.career.clubs || []).length >= 5 },
    { id: 'hoover', name: 'Trophy Hoover', by: 'rival fans, through their teeth',
      hint: 'Twelve trophies. You collect them like receipts.',
      test: p => (p.career.trophies || []).length >= 12 },
    { id: 'culthero', name: 'Cult Hero', by: 'the block behind the goal',
      hint: 'Adored well past what the rating says you should be.',
      test: p => p.reputation >= 55 && p.ovr <= 80 },
    { id: 'glass', name: 'Glass Cannon', by: 'a fan channel, affectionately',
      hint: 'Unplayable. When fit. Which is the problem.',
      test: p => (p.injuryCount || 0) >= 6 && p.ovr >= 82 },
    { id: 'latebloom', name: 'The Late Bloomer', by: 'a podcast, apologetically',
      hint: 'Past thirty and better than you have ever been.',
      test: p => p.age >= 31 && p.ovr >= (p.peakOvr || 0) },
    { id: 'talisman', name: 'The Talisman', by: 'the club itself',
      hint: 'The heart of this team, and everybody knows it.',
      test: p => !!p.heart },
    { id: 'worldbeater', name: 'World Beater', by: 'the whole internet',
      hint: 'World Player of the Year. Argument over.',
      test: p => (p.achievements || []).some(a => /world player of the year/i.test(a.name)) },
    { id: 'setpiece', name: 'Set-Piece Sniper', by: 'a highlights account',
      hint: 'Shooting at 86 and a dead ball that behaves itself.',
      test: p => (p.attrs.shooting || 0) >= 86 && (p.career.goals || 0) >= 60 },
    { id: 'kid', name: 'The Kid', by: 'commentators who will not let it go',
      hint: 'Nineteen, in the first team, and already the best thing about it.',
      test: p => p.age <= 19 && p.ovr >= 72 },
    { id: 'unplayable', name: 'Unplayable', by: 'the defender who marked you',
      hint: 'An average rating of 8. For a whole season.',
      test: (p, g) => (global.State.seasonRating(p) || 0) >= 8 && (p.season.apps || 0) >= 15 }
  ];

  function earned(p, g) {
    return TITLES.filter(t => {
      try { return !!t.test(p, g); } catch (e) { return false; }
    });
  }

  /* New ones get announced. The player picks which to wear. */
  function checkTitles(g) {
    const p = g.player, State = global.State;
    p.titles = p.titles || [];
    const fresh = [];
    earned(p, g).forEach(t => {
      if (p.titles.indexOf(t.id) < 0) { p.titles.push(t.id); fresh.push(t); }
    });
    fresh.forEach(t => {
      State.news(`They have started calling ${p.lastName} "${t.name}"`, 'good', null, 'star');
      if (global.Social) global.Social.title(g, t);
    });
    if (fresh.length && !p.title) p.title = fresh[0].id;
    return fresh;
  }

  const Status = {
    HEART_ON, HEART_OFF, TITLES,
    heartScore, heartParts, checkHeart, absence,
    earned, checkTitles,
    titleById(id) { return TITLES.find(t => t.id === id) || null; },
    activeTitle(p) { return p && p.title ? Status.titleById(p.title) : null; }
  };

  global.Status = Status;
})(window);
