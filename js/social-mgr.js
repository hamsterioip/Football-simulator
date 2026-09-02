/* ==========================================================================
   social-mgr.js — the timeline, from the dugout.

   social.js builds a feed about a player. This one builds a feed about a
   manager: the results, the signings, the injuries, the cup runs, the sack
   watch and the summer somebody else's club rings you. Same cast of accounts
   (club, fan channel, reporter, pundit, stats account, your own supporters
   and the rival ones), same post shape, so UI.post renders both.

   Every line in here is written for one situation and gated to it — a post
   about a thrashing cannot appear after a draw — for the same reason The
   Talk is: a feed that says things that did not happen is noise.
   ========================================================================== */
(function (global) {
  'use strict';

  const CAP = 70;          // posts kept in the save
  const ROSTER = 12;       // recurring accounts

  const U = () => global.U;
  const S = () => global.Social;
  const State = () => global.State;

  /* ---------------- the cast ----------------
     Rebuilt whenever you change club, so the local accounts always support
     the badge you are actually wearing. */

  const BOARD_TAGS = ['Official', 'Board', 'HQ', 'Chairman'];
  const MGR_TAGS = ['TacticsBoard', 'Gaffer', 'Dugout', 'Touchline', 'TheBench',
    'Whiteboard', 'Chalkboard', 'FourFourTwo_'];

  function handleOf(base) { return '@' + String(base).replace(/[^A-Za-z0-9_]/g, ''); }
  function tag(name) {
    const compact = String(name).replace(/[^A-Za-z]/g, '');
    if (compact.length <= 12) return compact || 'Club';
    const words = String(name).replace(/[^A-Za-z ]/g, '').split(' ').filter(w => w.length >= 4);
    return words.sort((a, b) => b.length - a.length)[0] || compact || 'Club';
  }

  function makeTactics(country) {
    const who = global.Names.person(country || 'England');
    return { n: who.name, h: handleOf(who.name.split(' ')[0] + U().pick(MGR_TAGS)),
      kind: 'pundit', v: true, bio: 'Tactics · ' + U().pick(['newsletter', 'podcast', 'YouTube', 'column']) };
  }
  function makeBoard(club) {
    return { n: club.name + ' ' + U().pick(BOARD_TAGS), h: handleOf(tag(club.name) + 'Board'),
      kind: 'club', v: true, club: club.name, bio: 'Official account' };
  }

  function folk(g) {
    const club = State().club(g.mgr.club);
    if (g.mgr.folk && g.mgr.folk.club === club.name) return g.mgr.folk;
    const S0 = S();
    const country = (State().league(club.league) || {}).country;
    const rivals = Object.values(g.world.clubs).filter(c => c.league === club.league && c.id !== club.id);
    const list = [S0.makeClub(club), makeBoard(club), S0.makeFanTV(club.name), S0.makeStats(),
      S0.makeJourno(country), S0.makePundit(country), makeTactics(country)];
    for (let i = 0; i < 3; i++) list.push(S0.makeFan(club.name, country));
    for (let i = 0; i < 2; i++) {
      const r = rivals.length ? U().pick(rivals) : null;
      if (r) list.push(S0.makeRival(r.name, country));
    }
    g.mgr.folk = { club: club.name, list: list.slice(0, ROSTER) };
    return g.mgr.folk;
  }
  function pickFolk(g, kind) {
    const all = folk(g).list;
    const want = all.filter(f => f.kind === kind);
    return want.length ? U().pick(want) : U().pick(all);
  }
  function meAccount(g) {
    const club = State().club(g.mgr.club);
    return { n: 'The Manager', h: handleOf('Boss' + tag(club.name)), kind: 'you',
      v: global.Manager.reputation(g) >= 55, bio: club.name };
  }

  /* ---------------- what the timeline knows ---------------- */

  function ordinal(n) { return U().ordinal(n); }

  function ctx(g, extra) {
    const club = State().club(g.mgr.club);
    const league = State().league(club.league);
    const squad = g.squad || [];
    const byGoals = squad.slice().filter(s => s.goals > 0).sort((a, b) => b.goals - a.goals);
    const byOvr = squad.slice().sort((a, b) => b.ovr - a.ovr);
    const rivals = Object.values(g.world.clubs)
      .filter(c => c.league === club.league && c.id !== club.id)
      .sort((a, b) => b.rating - a.rating);
    const results = g.mgr.results || [];
    const last5 = results.slice(-5).map(r => r.result).join('');
    const pos = global.Manager.position(g);
    const c = {
      g, club,
      clubName: club.name, tagName: tag(club.name),
      leagueName: league.name, country: league.country,
      year: g.world.year,
      pos, posOrd: ordinal(pos),
      conf: Math.round(g.mgr.board.confidence),
      target: g.mgr.board.target.pos,
      seasons: g.mgr.board.seasons,
      budget: U().cash(g.mgr.budget),
      rep: global.Manager.reputation(g),
      trophies: global.Manager.cabinet(g).length,
      topScorer: byGoals[0] ? byGoals[0].name : (byOvr[0] ? byOvr[0].name : 'somebody'),
      topGoals: byGoals[0] ? byGoals[0].goals : 0,
      star: byOvr[0] ? byOvr[0].name : 'the captain',
      star2: byOvr[1] ? byOvr[1].name : 'the skipper',
      kid: (squad.filter(s => s.age <= 21).sort((a, b) => b.ovr - a.ovr)[0] || byOvr[byOvr.length - 1] || {}).name || 'the kid',
      rival: rivals[0] ? rivals[0].name : 'them',
      formation: g.mgr.formation,
      style: (global.Manager.STYLES[g.mgr.style] || {}).name || 'balanced',
      form: last5,
      wins: results.filter(r => r.result === 'W').length,
      played: results.length,
      reach: 0.5 + global.Manager.reputation(g) / 100 * 2.2
    };
    if (extra) for (const k in extra) c[k] = extra[k];
    return c;
  }

  /* ---------------- posting ---------------- */

  function push(g, entry, c, opts) {
    const o = opts || {};
    const who = entry.k === 'you' ? meAccount(g) : pickFolk(g, entry.k);
    /* A template is either a function of the context or, where it never looks
       at one, a plain string. Nine hundred of them are plain strings, and not
       making those into closures is worth a third of the page's start-up. */
    let text;
    try { text = typeof entry.t === 'function' ? entry.t(c) : entry.t; }
    catch (e) { return null; }
    if (!text) return null;
    g.mgr.feed = g.mgr.feed || [];
    /* Never the same line twice while it is still on screen. Checking the
       whole saved feed instead starved the timeline: after a handful of wins
       every win post was still in memory and nothing new could be said. */
    if (g.mgr.feed.slice(0, 18).some(f => f.t === text)) return null;
    const heat = (o.heat || 1) * (entry.tone === 'hot' ? 1.5 : 1)
      * (who.kind === 'club' || who.kind === 'journo' ? 1.35 : 1);
    const likes = Math.max(3, Math.round(U().rnd(25, 240) * c.reach * heat));
    const post = {
      t: text,
      who: { n: who.n, h: who.h, kind: who.kind, v: !!who.v, bio: who.bio || '' },
      tone: entry.tone || 'info',
      tick: (g.world.year * 100) + (g.mgr.round || 0),
      season: g.world.year,
      likes,
      reposts: Math.round(likes * U().rnd(0.08, 0.3)),
      tags: o.tags || [],
      mine: who.kind === 'you',
      replies: S().repliesFor(g, entry.tone || 'info', c, o.replies, kind => pickFolk(g, kind))
    };
    g.mgr.feedCount = (g.mgr.feedCount || 0) + 1;
    g.mgr.feed.unshift(post);
    if (g.mgr.feed.length > CAP) g.mgr.feed.length = CAP;
    return post;
  }

  function fire(g, pool, c, opts) {
    const usable = pool.filter(e => !e.when || e.when(c));
    if (!usable.length) return null;
    return push(g, U().pick(usable), c, opts);
  }

  /* Two or three accounts react to the same thing, never the same one twice. */
  function burst(g, pools, c, opts, n) {
    const flat = [];
    pools.forEach(p => p.forEach(e => { if (!e.when || e.when(c)) flat.push(e); }));
    if (!flat.length) return 0;
    const want = Math.min(n || U().weighted([[1, 4], [2, 6], [3, 3]]), flat.length);
    const shuffled = U().shuffle(flat.slice());
    let made = 0, seenKind = {};
    for (let i = 0; i < shuffled.length && made < want; i++) {
      const e = shuffled[i];
      if (seenKind[e.k] && made) continue;     // spread it across the timeline
      if (push(g, e, c, opts)) { seenKind[e.k] = true; made++; }
    }
    return made;
  }

  /* ================= the banks =================
     Each entry: { k: who posts it, tone, when?: c => bool, t: c => text }.
     Every one is gated to the situation it describes. */

  const POSTS = {};

  /* ---- a win, by any margin ---- */
  POSTS.win = [
    { k: 'club', tone: 'good', t: c => `FULL TIME | ${c.clubName} ${c.us}-${c.them} ${c.opp} ⚽ Three points.` },
    { k: 'fan', tone: 'good', t: 'Three points and I can enjoy my Sunday. That is all I ask for.' },
    { k: 'fan', tone: 'good', t: 'Whatever the gaffer said at half time, say it again next week.' },
    { k: 'fantv', tone: 'good', t: 'WE WON. Reaction video is up. I am hoarse. Worth it.' },
    { k: 'journo', tone: 'good', t: c => `${c.clubName} beat ${c.opp} without ever really having to get out of second gear.` },
    { k: 'pundit', tone: 'good', t: "That was a manager's win. The shape never broke once, even when they pushed." },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} have now won ${c.wins} of ${c.played} this season.` },
    { k: 'fan', tone: 'good', t: 'Not pretty. Do not care. Next.' },
    { k: 'journo', tone: 'info', t: c => `Another three points for ${c.clubName}, who move on with a manager quietly building something.` },
    { k: 'fan', tone: 'good', t: c => `The ${c.formation} is finally clicking. About time somebody trusted it.` },
    { k: 'pundit', tone: 'info', t: c => `${c.opp} will feel they gave that away. ${c.clubName} will say they took it. Both are right.` },
    { k: 'fantv', tone: 'good', t: 'Some of you were calling for him in August. Where are you now? WHERE ARE YOU NOW.' },
    { k: 'rival', tone: 'info', t: c => `Fair play, ${c.clubName} deserved that. Doesn't mean I have to enjoy it.` },
    { k: 'club', tone: 'good', t: "That's another one. 👏 Safe home, everyone." },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} in ${c.style.toLowerCase()} shape: ${c.us} scored, ${c.them} conceded. The plan worked.` },
    { k: 'fan', tone: 'good', t: "My dad has been coming here since 1974 and he was singing on the way out. That'll do." }
  ];

  POSTS.bigWin = [
    { k: 'fantv', tone: 'hot', t: c => `${c.us}-${c.them}. ${c.us}-${c.them}!! I have no voice left and no regrets.` },
    { k: 'club', tone: 'good', t: c => `FULL TIME | ${c.clubName} ${c.us}-${c.them} ${c.opp} 🔥🔥🔥` },
    { k: 'journo', tone: 'good', t: c => `${c.clubName} did not just beat ${c.opp}, they dismantled them. The manager barely left his seat.` },
    { k: 'fan', tone: 'hot', t: 'I have watched this club my whole life and that was one of the best halves I have ever seen.' },
    { k: 'pundit', tone: 'good', t: 'You do not get results like that by accident. That was coached, drilled and executed.' },
    { k: 'stats', tone: 'info', t: c => `${c.us} goals. ${c.clubName}'s biggest win of the season so far.` },
    { k: 'rival', tone: 'bad', t: c => `Embarrassing from us. ${c.clubName} could have had eight and everybody knows it.` },
    { k: 'fan', tone: 'hot', t: 'TELL ME AGAIN HOW WE ARE IN A CRISIS' },
    { k: 'fantv', tone: 'hot', t: 'Emergency livestream tonight and it is a happy one for once. Bring snacks.' },
    { k: 'journo', tone: 'good', t: c => `A statement result. ${c.clubName} have not scored ${c.us} in a league game in a very long time.` },
    { k: 'pundit', tone: 'good', t: c => `${c.opp} could not lay a glove on them. That is a side that knows exactly what it is doing.` },
    { k: 'club', tone: 'good', t: c => `Turn the volume up. 🔊 ${c.us}-${c.them}.` },
    { k: 'fan', tone: 'good', t: 'Told my mate to come to this one and now he wants a season ticket. Sold.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} scored ${c.us} against ${c.opp}. Nobody in this division has done that to them this year.` }
  ];

  POSTS.narrowWin = [
    { k: 'fan', tone: 'good', t: '1-0. Not a classic. Do not care even slightly.' },
    { k: 'pundit', tone: 'good', t: 'Winning ugly is a skill. That is a team being managed properly.' },
    { k: 'journo', tone: 'info', t: c => `${c.clubName} got over the line against ${c.opp}. Not much in it, but the table does not ask how.` },
    { k: 'fantv', tone: 'good', t: 'That was TENSE. My blood pressure cannot take a whole season of this.' },
    { k: 'fan', tone: 'good', t: 'Ninety minutes of my life I will never get back and three points I will never give back.' },
    { k: 'stats', tone: 'info', t: c => `Fourth one-goal win of the season for ${c.clubName}. Fine margins, right side of them.` },
    { k: 'rival', tone: 'bad', t: 'They got away with one there and the timeline will call it a masterclass.' },
    { k: 'pundit', tone: 'info', t: 'The interesting bit was the last fifteen minutes. They saw it out without panicking, which is new.' },
    { k: 'club', tone: 'good', t: c => `Hard-earned. 💪 ${c.us}-${c.them}.` },
    { k: 'fan', tone: 'good', t: 'I aged four years in stoppage time and I would do it again.' }
  ];

  POSTS.draw = [
    { k: 'club', tone: 'info', t: c => `FULL TIME | ${c.clubName} ${c.us}-${c.them} ${c.opp}. A point.` },
    { k: 'fan', tone: 'info', t: 'A point away from home is a point. Some of you need to hear that.' },
    { k: 'fantv', tone: 'bad', t: 'Two dropped, not one gained. I am not doing the positive spin tonight.' },
    { k: 'journo', tone: 'info', t: c => `${c.clubName} and ${c.opp} cancelled each other out. Nobody will remember it by Tuesday.` },
    { k: 'pundit', tone: 'info', t: 'The manager will take it. The supporters will not. Both positions are defensible.' },
    { k: 'fan', tone: 'bad', t: 'We do not win enough of these to be drawing them.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} have drawn too many. Points dropped from winning positions is becoming a theme.` },
    { k: 'rival', tone: 'info', t: 'Point each, everyone goes home. Boring, but I will take it against them.' },
    { k: 'pundit', tone: 'info', t: c => `A ${c.formation} against a side sitting that deep was always going to end like this.` },
    { k: 'fan', tone: 'info', t: 'Draw. Fine. Onwards.' },
    { k: 'journo', tone: 'info', t: "Neither side did enough. The manager's face at full time said more than the press conference will." }
  ];

  POSTS.loss = [
    { k: 'club', tone: 'bad', t: c => `FULL TIME | ${c.clubName} ${c.us}-${c.them} ${c.opp}. We go again on Saturday.` },
    { k: 'fantv', tone: 'bad', t: 'Same problems. Same result. I am tired of making the same video.' },
    { k: 'fan', tone: 'bad', t: 'Four hours on a coach for that. FOUR HOURS.' },
    { k: 'fan', tone: 'bad', t: 'We were second to everything. That is on the manager, not the players.' },
    { k: 'journo', tone: 'bad', t: c => `${c.opp} deserved it. ${c.clubName} never got going and the manager knew it by the half hour.` },
    { k: 'pundit', tone: 'info', t: 'Losing happens. Losing like that, without a plan B, is the bit that should worry them.' },
    { k: 'rival', tone: 'good', t: c => `Away at ${c.clubName}, three points, lovely stuff. Thanks for the hospitality.` },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} are ${c.posOrd} and have lost ${c.played - c.wins} of ${c.played}.` },
    { k: 'fan', tone: 'info', t: 'Everyone calm down. It is one game. We have all seen worse.' },
    { k: 'fantv', tone: 'bad', t: c => `Right. Somebody explain the ${c.formation} to me. Slowly. With diagrams.` },
    { k: 'pundit', tone: 'bad', t: c => `They had no way of hurting ${c.opp} and they had ninety minutes to work one out.` },
    { k: 'club', tone: 'bad', t: 'Not our night. Thank you to everyone who travelled. 💙' },
    { k: 'fan', tone: 'bad', t: 'I am not angry. I am just very, very tired.' }
  ];

  POSTS.heavyLoss = [
    { k: 'fantv', tone: 'bad', t: c => `${c.us}-${c.them}. I have nothing. No analysis, no jokes, nothing.` },
    { k: 'fan', tone: 'bad', t: 'That is the worst I have seen us play in years and I have seen some things.' },
    { k: 'journo', tone: 'bad', t: c => `${c.them} goals conceded. The manager stood on the touchline for the last twenty minutes and did not move.` },
    { k: 'pundit', tone: 'bad', t: 'You can lose. You cannot lose like that. There was no shape and no fight after the second goal.' },
    { k: 'rival', tone: 'hot', t: c => `Framing this scoreline. ${c.us}-${c.them} at ${c.clubName}. What a day out.` },
    { k: 'fan', tone: 'bad', t: 'Half the ground was gone by the eightieth minute. That tells you everything.' },
    { k: 'club', tone: 'bad', t: 'That was not good enough. We know it. We are sorry.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} conceded ${c.them}. Their heaviest defeat of the season.` },
    { k: 'fantv', tone: 'bad', t: 'Do not @ me tonight. I will be back tomorrow when I can form sentences.' },
    { k: 'fan', tone: 'bad', t: 'I want to see fight. I do not need us to be good, I need us to try.' },
    { k: 'pundit', tone: 'info', t: 'The manager has some serious thinking to do this week, and not about tactics.' }
  ];

  POSTS.cleanSheet = [
    { k: 'club', tone: 'good', t: 'Another clean sheet. 🧱 Not a thing got past them.' },
    { k: 'pundit', tone: 'good', t: 'The back four barely had to make a tackle. That is what good structure looks like.' },
    { k: 'fan', tone: 'good', t: 'Do not care about the goals. That was a defensive performance and I loved every second.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} keep another clean sheet. Their expected goals against is among the best in the division.` },
    { k: 'journo', tone: 'good', t: c => `${c.opp} had chances and found a wall. The manager has fixed the thing everybody said he could not fix.` },
    { k: 'fantv', tone: 'good', t: 'NOTHING. They got NOTHING. Best defensive display of the season.' },
    { k: 'fan', tone: 'good', t: 'Clean sheets win you leagues. Write that down.' }
  ];

  POSTS.derbyWin = [
    { k: 'fantv', tone: 'hot', t: c => `BEAT ${c.opp.toUpperCase()}. Nothing else in football feels like this. NOTHING.` },
    { k: 'fan', tone: 'hot', t: c => `I do not care about anything else this season now. We beat ${c.opp}.` },
    { k: 'club', tone: 'good', t: c => `Bragging rights stay here. 😌 ${c.us}-${c.them}.` },
    { k: 'rival', tone: 'bad', t: c => `Losing to ${c.clubName} is the one I cannot take. Every year. Every single year.` },
    { k: 'journo', tone: 'good', t: 'The manager celebrated that one like a supporter. He understands what this fixture is.' },
    { k: 'fan', tone: 'hot', t: 'Booking Monday off work. Do not need a reason.' },
    { k: 'pundit', tone: 'good', t: 'He got the big call right in the big game. That is what they pay him for.' }
  ];

  POSTS.derbyLoss = [
    { k: 'fan', tone: 'bad', t: c => `Losing to ${c.opp} is the one that actually hurts. I will be quiet for a week.` },
    { k: 'fantv', tone: 'bad', t: 'Of all the games. Of ALL the games. I cannot look at my phone.' },
    { k: 'rival', tone: 'hot', t: c => `Beat ${c.clubName}. Best day of the year and it is not close.` },
    { k: 'pundit', tone: 'bad', t: 'He set up not to lose that one and lost it anyway. That is the worst of both worlds.' },
    { k: 'fan', tone: 'bad', t: 'Avoiding the group chat, the office and the internet until Thursday.' },
    { k: 'journo', tone: 'bad', t: 'A long, quiet walk down the tunnel for the manager. This is the result they judge you on here.' }
  ];
  /* ---- the cups ---- */
  POSTS.cupThrough = [
    { k: 'club', tone: 'good', t: c => `Through to the next round of the ${c.comp}. 🏆` },
    { k: 'fan', tone: 'good', t: 'Cup runs are the best part of football and nobody will convince me otherwise.' },
    { k: 'fantv', tone: 'good', t: 'THROUGH. Get the hat out. We are dreaming again and I refuse to be sensible.' },
    { k: 'journo', tone: 'good', t: c => `${c.clubName} navigate the ${c.stageName.toLowerCase()} of the ${c.comp} without much fuss.` },
    { k: 'pundit', tone: 'info', t: 'He rotated and still won it. That is a squad being managed properly across a long season.' },
    { k: 'fan', tone: 'good', t: 'Next round. Do not tell me who we want. I want everyone.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} are still in the ${c.comp}. One tie closer.` },
    { k: 'fan', tone: 'hot', t: c => `WEMBLEY. I said it. I am saying it in the ${c.stageName.toLowerCase()} and I do not care.` },
    { k: 'club', tone: 'good', t: 'Job done. Onto the next one. 🎩' }
  ];

  POSTS.cupOut = [
    { k: 'fantv', tone: 'bad', t: c => `Out of the ${c.comp}. In the ${c.stageName.toLowerCase()}. To THEM.` },
    { k: 'fan', tone: 'bad', t: 'One game. One chance. Gone for another year.' },
    { k: 'journo', tone: 'bad', t: c => `${c.clubName} are out of the ${c.comp}, beaten by ${c.opp} in the ${c.stageName.toLowerCase()}.` },
    { k: 'pundit', tone: 'info', t: 'Knockout football does not care how well you have been playing. It only asks about one night.' },
    { k: 'fan', tone: 'info', t: 'Right. League it is. Fewer distractions, they always say.' },
    { k: 'rival', tone: 'good', t: c => `Knocked ${c.clubName} out. Bus back is going to be lively.` },
    { k: 'club', tone: 'bad', t: c => `Our ${c.comp} ends here. Thank you to everyone who followed us in it. 💙` },
    { k: 'fan', tone: 'bad', t: 'I had booked the day off for the final. That is the bit that stings.' },
    { k: 'fantv', tone: 'bad', t: 'Every year. EVERY YEAR. I am going to bed.' }
  ];

  POSTS.cupWon = [
    { k: 'club', tone: 'hot', t: c => `🏆 ${c.comp.toUpperCase()} WINNERS 🏆 Enjoy this, all of you.` },
    { k: 'fantv', tone: 'hot', t: c => `WE HAVE WON THE ${c.comp.toUpperCase()}. I am crying on a livestream and I do not care.` },
    { k: 'fan', tone: 'hot', t: 'Silverware. Actual silverware. My grandad never saw us win one of these.' },
    { k: 'journo', tone: 'good', t: c => `${c.clubName} lift the ${c.comp}. The manager's first trophy here, and it will not be the last.` },
    { k: 'pundit', tone: 'good', t: 'He built to that final all season. Rotated in the early rounds, went full strength when it mattered.' },
    { k: 'stats', tone: 'info', t: c => `${c.comp} winners: ${c.clubName}. That is ${c.trophies} for this manager.` },
    { k: 'rival', tone: 'bad', t: c => `Congratulations to ${c.clubName}. Said through absolutely gritted teeth.` },
    { k: 'fan', tone: 'hot', t: 'Getting the date tattooed. My wife says no. It is happening.' },
    { k: 'club', tone: 'good', t: 'Bus parade details to follow. 🚌 Yes, really.' },
    { k: 'fan', tone: 'hot', t: c => `I was at the ${c.stageName.toLowerCase()}. I was at all of them. This is OURS.` }
  ];

  POSTS.cupFinalLost = [
    { k: 'fan', tone: 'bad', t: 'So close. So, so close. I do not want to talk about it.' },
    { k: 'journo', tone: 'bad', t: c => `${c.clubName} fall at the last. A final is the cruellest place to lose one.` },
    { k: 'fantv', tone: 'bad', t: 'Losing a final is worse than not getting there. I said it. Fight me.' },
    { k: 'pundit', tone: 'info', t: 'They were the better side for an hour. Finals do not always reward that.' },
    { k: 'club', tone: 'bad', t: 'Heartbreaking. Proud of every one of them. We will be back. 💙' },
    { k: 'fan', tone: 'info', t: 'We got to a final. Two years ago we would have taken that. Chin up.' }
  ];

  /* ---- the goals people remember ---- */
  POSTS.worldie = [
    { k: 'fantv', tone: 'hot', t: c => `${c.scorer.toUpperCase()}. WHAT WAS THAT. Slow motion, four angles, tonight.` },
    { k: 'fan', tone: 'hot', t: c => `Have watched ${c.scorer}'s goal eleven times. Going for twelve.` },
    { k: 'club', tone: 'good', t: c => `⚽ ${c.scorer}. Watch it again. And again. 🔁` },
    { k: 'journo', tone: 'good', t: c => `${c.scorer} produced the best goal of this round of fixtures and it was not close.` },
    { k: 'stats', tone: 'info', t: c => `${c.scorer}'s strike had an xG of about 0.04. Some players do not read the numbers.` },
    { k: 'pundit', tone: 'good', t: 'Do not overthink it. That is a player of real quality doing something the rest cannot.' },
    { k: 'rival', tone: 'info', t: c => `Hate to say it but ${c.scorer}'s goal was ridiculous. Credit where it is due.` },
    { k: 'fan', tone: 'good', t: 'Sent that to my brother who supports nobody. Even he replied.' }
  ];

  POSTS.wonderGoal = [
    { k: 'fantv', tone: 'hot', t: 'I HAVE BEEN DOING THIS CHANNEL FOR NINE YEARS. THAT IS THE BEST GOAL I HAVE EVER FILMED.' },
    { k: 'club', tone: 'hot', t: c => `We are not sure what to say. ⚽ ${c.scorer}. 🤯` },
    { k: 'journo', tone: 'good', t: c => `${c.scorer} has just scored a goal that will be on television for the next twenty years.` },
    { k: 'fan', tone: 'hot', t: 'I was in the ground for it. I will be telling people about it when I am eighty.' },
    { k: 'pundit', tone: 'good', t: 'I have watched football for forty years and I stood up in the studio. That does not happen.' },
    { k: 'stats', tone: 'info', t: c => `${c.scorer}'s goal: the lowest-probability finish recorded in this division all season.` },
    { k: 'rival', tone: 'good', t: c => `We lost and I am still applauding. ${c.scorer}, that was absurd.` },
    { k: 'fan', tone: 'hot', t: 'The noise in the ground. I have never heard anything like it. My ears are still ringing.' },
    { k: 'fantv', tone: 'hot', t: 'Cancelling everything. Doing a full breakdown. This deserves an hour.' }
  ];

  POSTS.century = [
    { k: 'club', tone: 'hot', t: c => `No caption. Just watch. ⚽ ${c.scorer}. 🐐` },
    { k: 'journo', tone: 'hot', t: c => `Whatever you are doing, stop, and go and watch what ${c.scorer} has just done. Goal of the century talk, and it is not hyperbole.` },
    { k: 'fantv', tone: 'hot', t: 'THE GREATEST GOAL I HAVE EVER SEEN. NOT AT THIS CLUB. ANYWHERE. EVER.' },
    { k: 'pundit', tone: 'hot', t: 'I have never said this on air before. That is the best goal I have seen in my lifetime.' },
    { k: 'fan', tone: 'hot', t: 'I was THERE. I was there for that. Nothing that happens to me for the rest of the season matters.' },
    { k: 'rival', tone: 'good', t: c => `I hate ${c.clubName} with everything I have and I stood up and applauded. That was history.` },
    { k: 'stats', tone: 'info', t: c => `We do not have a model for what ${c.scorer} just did. Genuinely. It is off the chart.` },
    { k: 'fan', tone: 'hot', t: 'Naming my son after him. Consulted nobody. It is done.' },
    { k: 'journo', tone: 'good', t: 'Every newspaper front page tomorrow. Not the back page. The front.' }
  ];

  POSTS.hattrick = [
    { k: 'club', tone: 'good', t: c => `Match ball secured. 🎩 ${c.scorer} with three.` },
    { k: 'fantv', tone: 'hot', t: c => `THREE GOALS. ${c.scorer.toUpperCase()}. Get him a statue, get him a road, get him whatever he wants.` },
    { k: 'fan', tone: 'hot', t: c => `${c.scorer} has taken that game and put it in his pocket.` },
    { k: 'journo', tone: 'good', t: c => `A hat-trick for ${c.scorer}, and the manager took him off to a standing ovation.` },
    { k: 'stats', tone: 'info', t: c => `${c.scorer} now has ${c.topGoals} for the season.` },
    { k: 'pundit', tone: 'good', t: "Three different finishes. Power, placement, composure. That is a complete striker's day." },
    { k: 'rival', tone: 'bad', t: c => `Our defenders should not be allowed home tonight. ${c.scorer} did what he liked.` }
  ];

  /* ---- the market ---- */
  POSTS.signing = [
    { k: 'club', tone: 'good', t: c => `✍️ ${c.player} has signed for ${c.clubName}. Welcome. #${c.tagName}` },
    { k: 'fan', tone: 'good', t: c => `We have actually signed ${c.player}. I refreshed this app forty times today.` },
    { k: 'journo', tone: 'info', t: c => `${c.clubName} complete the signing of ${c.player} for ${c.fee}. The manager has been pushing for this one for weeks.` },
    { k: 'fantv', tone: 'hot', t: c => `${c.player.toUpperCase()} IS OURS. Emergency stream. Now. GO.` },
    { k: 'stats', tone: 'info', t: c => `${c.player} joins ${c.clubName}: rated ${c.ovr}, aged ${c.age}, for ${c.fee}.` },
    { k: 'pundit', tone: 'good', t: 'Good business. He fills the exact hole that has cost them points all season.' },
    { k: 'rival', tone: 'bad', t: 'Of course they signed him. Of course they did.' },
    { k: 'fan', tone: 'hot', t: 'Shirt ordered. Name on the back. No I will not be talked out of it.' },
    { k: 'journo', tone: 'info', t: c => `${c.fee} for ${c.player}. A statement of intent from ${c.clubName}, and from the manager.` },
    { k: 'pundit', tone: 'info', t: 'The fee will get the headlines. The fit is the interesting part, and the fit is right.' },
    { k: 'fan', tone: 'good', t: 'Finally. FINALLY. We have been crying out for this since August.' },
    { k: 'club', tone: 'good', t: c => `He's here. 📸 More from ${c.player}'s first day soon.` }
  ];

  POSTS.bigSigning = [
    { k: 'fantv', tone: 'hot', t: c => `${c.fee.toUpperCase()}. FOR ${c.player.toUpperCase()}. AT OUR CLUB. I need a moment.` },
    { k: 'journo', tone: 'hot', t: c => `Extraordinary. ${c.player} to ${c.clubName} for ${c.fee}. This changes what this club is.` },
    { k: 'fan', tone: 'hot', t: c => `I have supported this club for thirty years and we have never signed anybody like ${c.player}.` },
    { k: 'club', tone: 'hot', t: c => `Some signings need a caption. This one does not. ${c.player}. 🔴 #${c.tagName}` },
    { k: 'rival', tone: 'bad', t: 'Money ruining football again. Nothing to do with the fact I wish we had him.' },
    { k: 'pundit', tone: 'info', t: c => `${c.fee} is a lot. He is also the difference between fourth and first, so it is not a lot.` },
    { k: 'stats', tone: 'info', t: c => `${c.player}, ${c.ovr} rated, is now the highest-rated player at ${c.clubName}.` },
    { k: 'fan', tone: 'hot', t: 'Ticket prices going up and I do not even care. Worth it.' },
    { k: 'journo', tone: 'good', t: 'The manager got his man. The board found the money. Now they have to live up to it.' }
  ];

  POSTS.sale = [
    { k: 'club', tone: 'info', t: c => `${c.player} leaves ${c.clubName}. Thank you for everything. 💙` },
    { k: 'fan', tone: 'bad', t: c => `Selling ${c.player} is a decision I will be angry about in May. Mark it down.` },
    { k: 'journo', tone: 'info', t: c => `${c.clubName} bank ${c.fee} for ${c.player}. The manager insists it was his call.` },
    { k: 'fantv', tone: 'bad', t: 'Why. WHY. Somebody in that building explain this to me.' },
    { k: 'pundit', tone: 'info', t: 'Good business if they reinvest it. A disaster if they do not. We will know by September.' },
    { k: 'fan', tone: 'info', t: 'Fair fee, right time. Not everything has to be a crisis.' },
    { k: 'stats', tone: 'info', t: c => `${c.player} departs having played his part. ${c.fee} received.` },
    { k: 'rival', tone: 'info', t: 'They have sold their best player again. Same club, different season.' },
    { k: 'fan', tone: 'good', t: c => `All the best ${c.player}. Never gave less than everything. 👏` }
  ];

  /* ---- the treatment room ---- */
  POSTS.injury = [
    { k: 'club', tone: 'bad', t: c => `${c.player} will be assessed after leaving the pitch. Updates to follow. 💙` },
    { k: 'fan', tone: 'bad', t: c => `Not ${c.player}. Please not him. Not now.` },
    { k: 'journo', tone: 'bad', t: c => `${c.player} is out for around ${c.games} game${c.games === 1 ? '' : 's'} — ${c.label}.` },
    { k: 'fantv', tone: 'bad', t: 'Of all the players. Of all the weeks. The luck at this club is unbelievable.' },
    { k: 'pundit', tone: 'info', t: 'That is a real problem for them. There is no like-for-like replacement in that squad.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} now have players missing. The rotation the manager gets criticised for looks smarter every week.` },
    { k: 'rival', tone: 'info', t: c => `No club wants to see that. Get well soon ${c.player}.` },
    { k: 'fan', tone: 'info', t: 'Next man up. That is what a squad is for.' }
  ];

  POSTS.longInjury = [
    { k: 'fantv', tone: 'bad', t: c => `${c.games} GAMES. Our season just changed shape in one challenge.` },
    { k: 'journo', tone: 'bad', t: c => `A serious blow: ${c.player} faces around ${c.games} games out with ${c.label}.` },
    { k: 'club', tone: 'bad', t: c => `${c.player} will undergo surgery. Everyone here is behind you. 💙 #${c.tagName}` },
    { k: 'fan', tone: 'bad', t: 'Devastated for him. He has been our best player for months.' },
    { k: 'pundit', tone: 'bad', t: 'That is the kind of injury that decides where a club finishes. No way around it.' },
    { k: 'fan', tone: 'info', t: 'Right. Somebody in that squad is about to get the season of their life. Take it.' },
    { k: 'stats', tone: 'info', t: c => `${c.player}: out for approximately ${c.games} matches. ${c.label}.` }
  ];

  POSTS.redCard = [
    { k: 'journo', tone: 'bad', t: c => `Red card for ${c.player}. He did not wait for the referee to reach for it.` },
    { k: 'fan', tone: 'bad', t: 'We needed him for the next three games. Absolutely gutted.' },
    { k: 'fantv', tone: 'bad', t: 'WHAT ARE YOU DOING. What are you DOING.' },
    { k: 'pundit', tone: 'bad', t: 'You can talk about passion. That is letting ten team-mates down, and he knows it.' },
    { k: 'rival', tone: 'good', t: 'Sending yourself off in that game is a bold career choice. Enjoy the ban.' },
    { k: 'club', tone: 'info', t: c => `${c.player} is sent off. We play on.` },
    { k: 'fan', tone: 'info', t: 'Harsh. Genuinely harsh. But he gave the referee the decision to make.' }
  ];

  POSTS.suspended = [
    { k: 'stats', tone: 'info', t: c => `${c.player} misses the next game — ${c.why}.` },
    { k: 'fan', tone: 'bad', t: 'Suspended. In this week of all weeks. Someone is having a laugh.' },
    { k: 'journo', tone: 'info', t: c => `${c.clubName} will be without ${c.player}, suspended. The manager will not be pleased about the timing.` },
    { k: 'pundit', tone: 'info', t: 'Bookings catch up with everybody eventually. Managing that is part of the job.' },
    { k: 'fantv', tone: 'bad', t: 'Missing him for that fixture is the definition of avoidable.' }
  ];
  /* ---- form and the table ---- */
  POSTS.streakGood = [
    { k: 'stats', tone: 'info', t: c => `${c.clubName}: ${c.form}. Nobody in this division is in better form.` },
    { k: 'fantv', tone: 'hot', t: 'WE CANNOT STOP WINNING. Do not wake me up.' },
    { k: 'fan', tone: 'good', t: 'Whatever is happening on that training ground, do not change a thing.' },
    { k: 'journo', tone: 'good', t: c => `${c.clubName} are the form side in the ${c.leagueName}, and the manager is finally getting credit for it.` },
    { k: 'pundit', tone: 'good', t: 'Runs like this are not luck. Same shape, same principles, week after week.' },
    { k: 'fan', tone: 'hot', t: 'I have started checking the table three times a day. Send help. Do not send help.' },
    { k: 'rival', tone: 'bad', t: c => `Nobody talk about ${c.clubName}. If we ignore it maybe it stops.` },
    { k: 'club', tone: 'good', t: 'Another one. 📈 Long may it continue.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} have taken more points in their last five than anyone else in the ${c.leagueName}.` }
  ];

  POSTS.streakBad = [
    { k: 'stats', tone: 'info', t: c => `${c.clubName}: ${c.form}. That is their worst run of the season.` },
    { k: 'fantv', tone: 'bad', t: 'Five games. FIVE. At what point does somebody in that boardroom pick up a phone?' },
    { k: 'fan', tone: 'bad', t: 'I have stopped setting an alarm for kick-off. That is where we are.' },
    { k: 'journo', tone: 'bad', t: c => `The run continues for ${c.clubName}. The manager's post-match answers are getting shorter.` },
    { k: 'pundit', tone: 'info', t: 'The performances are not as bad as the results. That is the only thing keeping him in a job.' },
    { k: 'fan', tone: 'info', t: 'Everyone breathe. We have been through worse than this and come out fine.' },
    { k: 'rival', tone: 'hot', t: c => `Every week I check ${c.clubName}'s score and every week football gives me a gift.` },
    { k: 'fantv', tone: 'bad', t: 'I am not calling for him. I am just saying I would understand.' },
    { k: 'fan', tone: 'bad', t: "Something has to change. Anything. Pick a different shape, pick different players, I don't care." }
  ];

  POSTS.topOfTable = [
    { k: 'stats', tone: 'info', t: c => `${c.clubName} are top of the ${c.leagueName}.` },
    { k: 'fantv', tone: 'hot', t: 'TOP OF THE LEAGUE. Say it out loud. TOP OF THE LEAGUE.' },
    { k: 'fan', tone: 'hot', t: 'Screenshotted the table. Set it as my wallpaper. Judge me.' },
    { k: 'journo', tone: 'good', t: c => `${c.clubName} lead the ${c.leagueName}. Very few people had that in August.` },
    { k: 'pundit', tone: 'info', t: 'They are top on merit. The question now is whether the squad is deep enough to stay there.' },
    { k: 'rival', tone: 'bad', t: 'They will bottle it. They always bottle it. (Please bottle it.)' },
    { k: 'fan', tone: 'good', t: 'Not getting carried away. Definitely not. Absolutely calm. TOP OF THE LEAGUE.' },
    { k: 'club', tone: 'good', t: 'Nice view from up here. 👀' }
  ];

  POSTS.titleRace = [
    { k: 'journo', tone: 'hot', t: c => `${c.posOrd} and in it. ${c.clubName} have a genuine title race on their hands.` },
    { k: 'fan', tone: 'hot', t: 'I have not dared say the word. I am not saying it. You know the word.' },
    { k: 'pundit', tone: 'info', t: 'Whoever holds their nerve in the next six games wins this league. Simple as that.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} are ${c.posOrd}. On this form the run-in is the whole season.` },
    { k: 'fantv', tone: 'hot', t: 'I have not slept properly in three weeks and there are eight games left.' },
    { k: 'fan', tone: 'info', t: 'Whatever happens, this has been the most fun I have had following this club in years.' }
  ];

  POSTS.relegationFight = [
    { k: 'stats', tone: 'info', t: c => `${c.clubName} are ${c.posOrd}. The bottom is closer than the middle now.` },
    { k: 'fan', tone: 'bad', t: 'I did not think we would be in this conversation. I really did not.' },
    { k: 'journo', tone: 'bad', t: c => `A serious relegation fight for ${c.clubName}, and the manager knows exactly what that means for him.` },
    { k: 'fantv', tone: 'bad', t: 'Doing the maths every night like a madman. It is not good maths.' },
    { k: 'pundit', tone: 'info', t: 'They need points, not performances. Sometimes a manager has to accept that and set up accordingly.' },
    { k: 'fan', tone: 'info', t: 'Behind them until the last kick. Whatever happens.' },
    { k: 'rival', tone: 'hot', t: c => `${c.clubName} going down would make my entire decade.` }
  ];

  /* ---- the board and the job ---- */
  POSTS.boardHappy = [
    { k: 'journo', tone: 'good', t: c => `Sources at ${c.clubName} say the board could not be happier. Talk of a new contract has started.` },
    { k: 'club', tone: 'good', t: 'Full backing from everyone at this football club. 👏' },
    { k: 'pundit', tone: 'good', t: 'He has earned the right to be trusted with the money. That is not nothing at that club.' },
    { k: 'fan', tone: 'good', t: 'Give him a five year deal and let him build something. For once.' },
    { k: 'stats', tone: 'info', t: c => `Board confidence in the manager at ${c.clubName}: ${c.conf}/100.` },
    { k: 'fantv', tone: 'good', t: 'I owe him an apology for what I said in October. Publicly. There, done.' }
  ];

  POSTS.sackWatch = [
    { k: 'journo', tone: 'bad', t: c => `${c.clubName}'s board held a meeting today. The manager's position was on the agenda.` },
    { k: 'fantv', tone: 'bad', t: 'Sack watch is officially on and I hate that we are here again.' },
    { k: 'stats', tone: 'info', t: c => `Board confidence at ${c.clubName}: ${c.conf}/100. Managers rarely survive below twenty.` },
    { k: 'fan', tone: 'bad', t: 'Not his fault entirely but somebody has to go and it is never the board.' },
    { k: 'fan', tone: 'info', t: 'Sacking him solves nothing. The problems at this club are older than he is.' },
    { k: 'pundit', tone: 'info', t: 'He has three games. Maybe four. That is the reality and everybody inside the building knows it.' },
    { k: 'rival', tone: 'good', t: 'Do not sack him. Please do not sack him. He is doing brilliant work.' },
    { k: 'journo', tone: 'info', t: c => `No decision yet at ${c.clubName}. But nobody is denying anything either.` },
    { k: 'fantv', tone: 'bad', t: 'Bookies have suspended betting on the next manager. That is never a good sign.' }
  ];

  POSTS.champions = [
    { k: 'club', tone: 'hot', t: c => `🏆 CHAMPIONS OF THE ${c.leagueName.toUpperCase()} 🏆` },
    { k: 'fantv', tone: 'hot', t: 'WE HAVE WON THE LEAGUE. I have waited my entire life for this video.' },
    { k: 'fan', tone: 'hot', t: 'Champions. CHAMPIONS. My phone is at 4% and I do not care.' },
    { k: 'journo', tone: 'hot', t: c => `${c.clubName} are champions. Whatever anybody said about the manager in ${c.year}, this is the answer.` },
    { k: 'pundit', tone: 'good', t: 'A deserved title. Best defensive record, best structure, the clearest idea of what it wanted to be.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName}: champions. ${c.wins} wins from ${c.played}.` },
    { k: 'rival', tone: 'bad', t: c => `Congratulations to ${c.clubName}. Now please go away for the summer.` },
    { k: 'fan', tone: 'hot', t: 'My dad is 78 and he is crying in the kitchen. That is what this means.' },
    { k: 'club', tone: 'good', t: 'Thank you. All of you. Every away end, every wet Tuesday. This is yours. 💙' },
    { k: 'fan', tone: 'hot', t: 'Not going to work tomorrow. Not going to work Tuesday either, probably.' }
  ];

  POSTS.seasonGood = [
    { k: 'journo', tone: 'good', t: c => `${c.clubName} finish ${c.posOrd}. Above where anyone expected, and the manager is the reason.` },
    { k: 'fan', tone: 'good', t: 'Best season I have had following this club in a long time. Thank you, seriously.' },
    { k: 'pundit', tone: 'good', t: 'Overachievement is a horrible word. He has made a squad better than the sum of its parts. Call it that.' },
    { k: 'stats', tone: 'info', t: c => `Final position: ${c.posOrd}. Target was ${c.target}${c.pos <= c.target ? '. Met.' : '.'}` },
    { k: 'club', tone: 'good', t: c => `That's a wrap on the season. ${c.posOrd}. See you in August. 💙` },
    { k: 'fantv', tone: 'good', t: 'End of season review coming this week and for once it is a positive one.' }
  ];

  POSTS.seasonBad = [
    { k: 'fantv', tone: 'bad', t: c => `${c.posOrd}. That is where we finished. Somebody has to answer for this summer.` },
    { k: 'journo', tone: 'bad', t: c => `${c.clubName} finish ${c.posOrd}, well short of what was asked. Questions will be asked of everyone.` },
    { k: 'fan', tone: 'bad', t: 'Renewing my season ticket out of habit, not hope.' },
    { k: 'pundit', tone: 'info', t: 'He inherited problems. He has also not solved many of them. Both things are true.' },
    { k: 'club', tone: 'info', t: 'Not the season we wanted. Thank you for standing by us. We will do better.' },
    { k: 'fan', tone: 'info', t: 'Give him a summer and a budget before you write him off.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} finish ${c.posOrd}. The board asked for ${c.target}.` }
  ];

  /* ---- the career ---- */
  POSTS.linked = [
    { k: 'journo', tone: 'hot', t: c => `Understand ${c.suitor} have made contact about ${c.clubName}'s manager. Early, but real.` },
    { k: 'fantv', tone: 'bad', t: c => `If ${c.suitor} take our manager I am going to lose it. Genuinely.` },
    { k: 'fan', tone: 'bad', t: 'Please stay. Please. We have not had somebody who knows what he is doing in years.' },
    { k: 'pundit', tone: 'info', t: 'He would be mad not to listen. That does not mean he goes.' },
    { k: 'rival', tone: 'good', t: 'Take him. Take him now. Do it for me.' },
    { k: 'stats', tone: 'info', t: c => `Manager reputation: ${c.rep}/100. That is why the phone is ringing.` },
    { k: 'fan', tone: 'info', t: 'Nothing in this story. There is never anything in these stories. (There is always something.)' },
    { k: 'journo', tone: 'info', t: c => `No approach has been confirmed. ${c.suitor} have not denied it either.` }
  ];

  POSTS.leaving = [
    { k: 'club', tone: 'info', t: c => `${c.clubName} can confirm the manager has left the club. We thank him and wish him well. 💙` },
    { k: 'fantv', tone: 'bad', t: 'He has gone. Just like that. I need to sit down.' },
    { k: 'fan', tone: 'bad', t: 'Gutted. Absolutely gutted. Best manager we have had in my lifetime.' },
    { k: 'journo', tone: 'hot', t: c => `Done deal. The ${c.clubName} manager is on his way to ${c.suitor}.` },
    { k: 'fan', tone: 'bad', t: "Everybody leaves this club eventually. Doesn't make it easier." },
    { k: 'pundit', tone: 'info', t: 'Hard to blame him. Bigger club, bigger budget, bigger stage. That is football.' },
    { k: 'rival', tone: 'hot', t: 'Lost their manager. Their season is over and it is August.' },
    { k: 'fan', tone: 'good', t: 'Thanks for everything. Genuinely. Good luck. (Except against us.)' }
  ];

  POSTS.arrived = [
    { k: 'club', tone: 'good', t: c => `Welcome to ${c.clubName}. ✍️ Our new manager has signed.` },
    { k: 'fan', tone: 'good', t: 'Right. New manager. New start. I am choosing to be optimistic and you cannot stop me.' },
    { k: 'journo', tone: 'info', t: c => `${c.clubName} appoint their new manager. ${c.trophies} trophies on the CV and a reputation of ${c.rep}.` },
    { k: 'fantv', tone: 'good', t: 'New gaffer. First impressions video tonight. I am cautiously excited and that is rare for me.' },
    { k: 'pundit', tone: 'info', t: 'Sensible appointment. He has done it at a level below and earned the step up.' },
    { k: 'fan', tone: 'info', t: 'Judging nobody until Christmas. That is the deal I make with myself every time.' },
    { k: 'rival', tone: 'info', t: 'Decent appointment that, annoyingly.' },
    { k: 'stats', tone: 'info', t: c => `New manager at ${c.clubName}. Career trophies: ${c.trophies}.` },
    { k: 'fan', tone: 'good', t: 'Anybody is an upgrade at this point. Welcome, whoever you are.' }
  ];

  POSTS.sacked = [
    { k: 'club', tone: 'bad', t: c => `${c.clubName} have parted company with the manager. We thank him for his efforts.` },
    { k: 'journo', tone: 'hot', t: c => `The ${c.clubName} manager has been sacked after ${c.seasons} season${c.seasons === 1 ? '' : 's'}.` },
    { k: 'fantv', tone: 'info', t: "He's gone. I called for it in November and I feel worse about it than I expected." },
    { k: 'fan', tone: 'info', t: 'Never his fault alone. Never is. Good luck to him.' },
    { k: 'fan', tone: 'bad', t: 'Fourth manager in five years. The problem is not in the dugout, it is upstairs.' },
    { k: 'pundit', tone: 'info', t: 'Sacking is the easy decision. The hard one is who they get next, and they have not been good at that.' },
    { k: 'rival', tone: 'good', t: 'Gutted for them, obviously. Devastated. Can barely type through the laughter.' }
  ];
  /* ---- ambient: the timeline between matches ----
     Fires on a quiet week. This is where most of the noise lives. */
  POSTS.weekly = [
    { k: 'fan', tone: 'info', t: c => `Genuine question: is the ${c.formation} the right shape for these players? I am not being funny, I want to know.` },
    { k: 'pundit', tone: 'info', t: c => `Watch ${c.clubName}'s build-up again. The whole thing is designed to get ${c.star} the ball facing forward.` },
    { k: 'stats', tone: 'info', when: c => c.topGoals > 0,
      t: c => `${c.topScorer} has ${c.topGoals} for ${c.clubName} this season.` },
    { k: 'fantv', tone: 'info', t: 'Doing a mailbag tonight. Send me your questions and please, PLEASE, not all about the shape.' },
    { k: 'fan', tone: 'info', t: 'Prices up again next season. Same football, more money. Funny that.' },
    { k: 'journo', tone: 'info', t: c => `Quiet week at ${c.clubName}. The manager used it to work on set pieces, apparently.` },
    { k: 'fan', tone: 'good', t: c => `${c.kid} in training this week looked like a first team player. Remember the name.` },
    { k: 'pundit', tone: 'info', t: c => `Nobody talks about how much running ${c.star2} does. It is the reason the whole shape works.` },
    { k: 'rival', tone: 'info', t: c => `Looking forward to ${c.clubName} away. Best pies in the division and I will not be taking questions.` },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} are ${c.posOrd} with ${c.wins} wins from ${c.played}.` },
    { k: 'fan', tone: 'info', t: 'Wet Tuesday night, three quid on the train, standing in the rain. Would not change it.' },
    { k: 'fantv', tone: 'info', t: 'Tier list of every manager we have had since 2010. It is going to upset people.' },
    { k: 'journo', tone: 'info', t: 'The manager has been at the training ground before seven every day this week. Make of that what you will.' },
    { k: 'fan', tone: 'bad', t: 'The pitch is a disgrace. How are they meant to play football on that.' },
    { k: 'pundit', tone: 'info', t: c => `Every side in this league now has a plan for ${c.star}. The interesting bit is whether the manager has a plan for that.` },
    { k: 'fan', tone: 'info', t: 'Who is picking the music at half time. I need names.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} have the ${c.pos <= 4 ? 'best' : 'a mid-table'} points-per-game in the ${c.leagueName} since December.` },
    { k: 'fan', tone: 'good', t: "Took my daughter to her first game. She asked why everyone was shouting. Told her that's just Tuesday." },
    { k: 'fantv', tone: 'info', t: 'Poll: is this squad better than the one three years ago? Be honest, not nostalgic.' },
    { k: 'journo', tone: 'info', t: c => `Contract talks at ${c.clubName} are ongoing with two senior players. No panic yet.` },
    { k: 'rival', tone: 'info', t: c => `Say what you like about ${c.clubName}, their away support is proper.` },
    { k: 'fan', tone: 'bad', t: 'Kick off moved for television again. Some of us have to get home.' },
    { k: 'pundit', tone: 'info', t: c => `${c.clubName} press higher than anyone gives them credit for. It is the least fashionable good idea in the league.` },
    { k: 'fan', tone: 'info', t: 'Every year I say I will not get emotionally invested. Every year, by September, I am gone.' },
    { k: 'stats', tone: 'info', t: c => `Squad average age at ${c.clubName} is one of the lowest in the division.` },
    { k: 'fantv', tone: 'good', t: 'Went to watch the under 21s. Two of them are ready. I am telling you now so I can say I told you.' },
    { k: 'fan', tone: 'info', t: 'The bloke behind me has been telling the manager what to do for eleven years. He has never been right once.' },
    { k: 'journo', tone: 'info', t: c => `${c.clubName} scouting in ${c.country} again. The manager likes players who can play in two positions.` },
    { k: 'fan', tone: 'good', t: 'Club shop has finally restocked. Only took until March.' },
    { k: 'pundit', tone: 'info', t: 'The best thing this manager does is not on the ball. Watch where his midfield stand when they lose it.' },
    { k: 'fan', tone: 'bad', t: 'Away tickets sold out in nine minutes and half of them are on resale sites. Sort it out.' },
    { k: 'stats', tone: 'info', t: c => `Board confidence: ${c.conf}. Position: ${c.posOrd}. Target: ${c.target}.` },
    { k: 'fantv', tone: 'info', t: 'Somebody asked me to rank the kits. Twelve minutes of my life, gone, and I loved it.' },
    { k: 'fan', tone: 'info', t: 'Nobody in this fanbase has ever agreed on anything and that is honestly the best part.' },
    { k: 'journo', tone: 'info', t: c => `Understand ${c.clubName}'s manager turned down an approach to discuss another job earlier this year.` },
    { k: 'rival', tone: 'bad', when: c => c.pos <= 5,
      t: c => `Their fans have been unbearable since they hit ${c.posOrd}. Unbearable.` },
    { k: 'fan', tone: 'good', t: 'Signed shirt raffle for the local hospice raised a fortune. Proper club, this.' },
    { k: 'pundit', tone: 'info', t: c => `${c.style} as an approach only works if the front two press together. Right now they do.` },
    { k: 'fan', tone: 'info', t: 'Nine months of the year I am miserable about this club. I would not swap it.' },
    { k: 'stats', tone: 'info', t: c => `${c.star} leads ${c.clubName} for minutes played. The manager clearly trusts him.` },
    { k: 'fantv', tone: 'bad', t: 'Why do we always start slowly. Every season. Somebody at that club must know.' },
    { k: 'journo', tone: 'info', t: c => `Training ground redevelopment at ${c.clubName} signed off. Not glamorous, but it matters.` },
    { k: 'fan', tone: 'good', t: c => `Bumped into ${c.star} in a supermarket. Lovely with my lad. Took photos with everyone.` },
    { k: 'fan', tone: 'info', t: "Whoever does the club's social media deserves a raise and a lie down." },
    { k: 'pundit', tone: 'info', t: 'People underrate how hard it is to keep a dressing room with you in a season like this one.' },
    { k: 'rival', tone: 'info', t: c => `Weirdly, I do not mind ${c.clubName}. Their manager seems alright.` },
    { k: 'fan', tone: 'bad', t: 'Third kit is an abomination and I have bought two.' },
    { k: 'stats', tone: 'info', when: c => c.pos <= 4 || c.pos >= 11,
      t: c => `Wage bill at ${c.clubName} is mid-table. Their position is not.` },
    { k: 'fantv', tone: 'info', t: 'Ten years of this channel today. Thanks for putting up with me shouting.' },
    { k: 'journo', tone: 'info', t: 'The manager gave a genuinely interesting press conference today, which almost never happens.' },
    { k: 'fan', tone: 'info', t: 'Booked the whole family in for the last home game. Rain or shine, we are there.' },
    { k: 'pundit', tone: 'info', t: c => `If ${c.clubName} keep this squad together for two more years, they are a problem for everybody.` },
    { k: 'fan', tone: 'good', t: 'We are not a big club and I do not want us to be. This is enough.' },
    { k: 'fan', tone: 'bad', t: 'Sick of hearing about "the project". Show me a result.' },
    { k: 'stats', tone: 'info', when: c => c.pos > 8,
      t: c => `${c.clubName} concede fewer shots than any side in the bottom half of the ${c.leagueName}.` },
    { k: 'fantv', tone: 'good', t: 'Doing a watchalong for the next away game. Bring your own beer and low expectations.' },
    { k: 'journo', tone: 'info', t: c => `No news from ${c.clubName} today, which at this club counts as good news.` },
    { k: 'fan', tone: 'info', t: 'My season ticket is in the same seat my grandad had. That is the whole thing, really.' },
    { k: 'pundit', tone: 'info', t: c => `${c.topScorer} is doing the unglamorous work as well as scoring. That is why the manager never takes him off.` },
    { k: 'rival', tone: 'bad', t: 'Their manager gets far too much credit for having decent players.' },
    { k: 'fan', tone: 'good', t: 'Whoever put the young lads on the pitch at half time to play, that was lovely.' },
    { k: 'fan', tone: 'info', t: c => `Debating the ${c.formation} in a pub car park at half eleven at night. Football.` },
    { k: 'stats', tone: 'info', t: c => `${c.clubName}'s manager: ${c.seasons} season${c.seasons === 1 ? '' : 's'} in charge, ${c.trophies} trophies.` },
    { k: 'fantv', tone: 'info', t: 'Reading out your worst transfer predictions from August. Some of you should be embarrassed.' },
    { k: 'journo', tone: 'info', t: c => `A scout from a bigger club was at ${c.clubName}'s last game. That happens a lot lately.` },
    { k: 'fan', tone: 'bad', t: 'Every away end I go to has better singing than us. It is embarrassing.' },
    { k: 'pundit', tone: 'info', t: 'The bravest thing this manager does is keep playing out from the back when it goes wrong.' },
    { k: 'fan', tone: 'good', t: "Away day in the rain, 2-0 down, still singing. That's my lot, that." },
    { k: 'stats', tone: 'info', t: c => `Only two clubs in the ${c.leagueName} have used fewer players this season than ${c.clubName}.` },
    { k: 'fan', tone: 'info', t: 'Somebody explain offside to my mum. I have tried for twenty years.' },
    { k: 'fantv', tone: 'bad', t: 'The referee thread. It is long. It is angry. It is up now.' },
    { k: 'journo', tone: 'info', t: c => `${c.clubName} have been quietly excellent at set pieces since Christmas. Somebody on that staff is very good at their job.` },
    { k: 'fan', tone: 'good', t: 'Twenty three years, home and away. Never regretted a mile of it.' },
    { k: 'rival', tone: 'info', t: 'Their ground is a nightmare to get to and worth it every time.' },
    { k: 'pundit', tone: 'info', t: 'The gap between what this squad cost and where it is sitting is the story of the season.' },
    { k: 'fan', tone: 'bad', t: 'I do not want to hear about the wage structure. I want to hear about a winger.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} have scored more from outside the box than anyone in this division.` },
    { k: 'fantv', tone: 'good', t: 'Just want to say thank you. This club has got me through some rough years.' },
    { k: 'fan', tone: 'info', t: 'Nobody at work understands why I care this much. I have stopped explaining.' },
    { k: 'journo', tone: 'info', t: c => `Club sources describe the mood at ${c.clubName} as calm. That is either good or very bad.` },
    { k: 'pundit', tone: 'info', t: 'The manager keeps saying it is a process. Annoyingly for everybody, the process appears to be working.' },
    { k: 'fan', tone: 'good', t: 'Renewed. Same seat. Same misery. Same joy. See you in August.' },
    { k: 'fan', tone: 'info', t: 'Every club thinks their referees are the worst. Ours actually are.' },
    { k: 'stats', tone: 'info', when: c => c.wins > c.played - c.wins,
      t: c => `${c.clubName} have led at half time in more games than they have lost all season.` },
    { k: 'fantv', tone: 'info', t: 'Ranking every away trip by pie quality. Purely scientific. Thread below.' },
    { k: 'fan', tone: 'bad', t: 'Sat behind a bloke on his phone the whole game. Why come?' },
    { k: 'journo', tone: 'info', t: c => `The manager's contract situation at ${c.clubName} will need addressing sooner rather than later.` },
    { k: 'pundit', tone: 'info', t: c => `Watch what ${c.clubName} do in the first ten minutes after conceding. That is coached, and it is very good.` },
    { k: 'fan', tone: 'good', t: 'We are not going to win anything and I love this football club with everything I have.' },
    { k: 'rival', tone: 'good', t: 'Genuinely wish them well in the cup. Not the league. Never the league.' },
    { k: 'stats', tone: 'info', when: c => c.pos >= 5,
      t: c => `${c.clubName}'s squad is worth less than four clubs above them. Make of that what you will.` },
    { k: 'fan', tone: 'info', t: 'The bloke who does the tannoy has been there since 1991. National treasure.' },
    { k: 'fantv', tone: 'bad', t: 'I am begging this club to sign a left back. Begging.' },
    { k: 'journo', tone: 'info', t: c => `Recruitment meeting at ${c.clubName} today. The manager was in it, which has not always been true here.` },
    { k: 'fan', tone: 'good', t: 'Standing in the away end singing about a manager. Only football does this.' },
    { k: 'pundit', tone: 'info', t: 'They are one injury away from a very different season. Every side is. Not every side admits it.' },
    { k: 'fan', tone: 'info', t: 'Somebody in the ground shouted a tactical instruction and it actually worked. He has not shut up since.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} have used ${c.formation} in almost every league game this season.` },
    { k: 'fan', tone: 'bad', t: 'Getting rid of the standing section was the worst thing this club ever did.' },
    { k: 'fantv', tone: 'good', t: 'Best atmosphere in years on Saturday. Whatever we are doing, keep doing it.' },
    { k: 'journo', tone: 'info', t: c => `Nothing to report from ${c.clubName}. Everybody fit, everybody available, nobody arguing.` },
    { k: 'pundit', tone: 'info', t: 'The manager has changed his shape twice this season and been right both times. That is a good habit.' },
    { k: 'fan', tone: 'info', t: 'Twelve of us in a car for six hours for a goalless draw. Best weekend of the year.' },
    { k: 'rival', tone: 'bad', t: c => `${c.clubName} fans acting like they invented football again.` },
    { k: 'stats', tone: 'info', t: c => `Home form at ${c.clubName} is markedly better than away. It has been for three years.` },
    { k: 'fan', tone: 'good', t: 'My mate came for the first time in fifteen years and said the ground felt alive again.' },
    { k: 'fantv', tone: 'info', t: 'Bringing back the phone-in. Please be nicer to me than last time.' },
    { k: 'journo', tone: 'info', t: c => `${c.clubName} have quietly become one of the better-run clubs in this division.` },
    { k: 'fan', tone: 'bad', t: c => `Do not talk to me about the ${c.leagueName} broadcast schedule. Do not.` },
    { k: 'pundit', tone: 'info', t: 'Give a manager three transfer windows and you find out what he actually believes. He is two in.' },
    { k: 'fan', tone: 'info', t: 'Have started watching games with the sound off. Genuinely improves the experience.' },
    { k: 'stats', tone: 'info', when: c => c.topGoals >= 4,
      t: c => `${c.clubName} win far more often than not when ${c.topScorer} scores. Small sample, nice stat.` },
    { k: 'fan', tone: 'good', t: 'Been coming since I was six. My kids come now. That is the whole point of it.' },
    { k: 'fantv', tone: 'info', t: "Making a video about the manager's first season. It has aged in unexpected ways." },
    { k: 'journo', tone: 'info', t: c => `A calm week at ${c.clubName}, which given the last few years is an achievement in itself.` },
    { k: 'fan', tone: 'info', t: 'New signing spotted at a coffee shop in town. This is what passes for news in June.' },
    { k: 'pundit', tone: 'info', t: c => `Nobody in the ${c.leagueName} has a clearer idea of what they are than ${c.clubName} right now.` },
    { k: 'fan', tone: 'bad', t: 'Bored of hearing we are punching above our weight. Let us punch.' },
    { k: 'rival', tone: 'info', t: 'Their manager is doing a proper job. Hate that I have to say it.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName}: ${c.wins} wins, ${c.played} played, ${c.posOrd} in the table.` },
    { k: 'fan', tone: 'good', t: 'The moment the floodlights come on. Every time. Twenty years and it still gets me.' },
    { k: 'fantv', tone: 'good', t: 'Genuinely enjoying following this team again. Did not expect to type that.' },
    { k: 'journo', tone: 'info', t: c => `Expect ${c.clubName} to be active but not extravagant in the window. That is the manager's preference.` },
    { k: 'fan', tone: 'info', t: 'Started a group chat for away travel. It is now 40 people and mostly arguing.' },
    { k: 'pundit', tone: 'info', t: c => `The academy at ${c.clubName} is producing again. That is worth more than any signing.` },
    { k: 'fan', tone: 'bad', t: 'Half time queue was longer than the half. Sort the concourse out.' },
    { k: 'stats', tone: 'info', when: c => c.pos <= 6 && c.wins >= 5,
      t: c => `${c.clubName} have taken points off sides well above them this season.` },
    { k: 'fan', tone: 'good', t: 'Football gave me a rubbish decade and one incredible afternoon. Still worth it.' }
  ];

  /* ---- what you can post yourself ---- */
  const YOU_POSTS = {
    calm: [
      c => `One game at a time. That is not a cliché here, it is the whole plan.`,
      c => `Pleased with the players. We do the work, we let the table look after itself.`,
      c => `We know what we are. We know what we are trying to build. Nothing changes this week.`,
      c => `No complaints about anybody but ourselves. We will be better.`,
      c => `The supporters were excellent again. That matters more than people outside think.`,
      c => `Football is long. Judge us in May, not in October.`,
      c => `Everyone in that dressing room is pulling the same way. That is all I can ask for.`,
      c => `Not getting carried away and not getting dragged down. Same as last week.`,
      c => `We prepared properly and it showed. That is the standard now.`
    ],
    fire: [
      c => `I have heard what has been said about this football club. We will answer it on the pitch.`,
      c => `Write us off. Please. Keep writing us off.`,
      c => `Nobody outside this building believes in us. Good. We do not need them.`,
      c => `Some people are going to look very silly in May and I am going to enjoy it.`,
      c => `They can talk. We will play. See you Saturday.`,
      c => `Doubt this group at your own risk.`,
      c => `Every single person at ${c.clubName} deserved that. Nobody else gets a say.`,
      c => `I have been in this game a long time. I know what I am looking at, and I like it.`
    ],
    honest: [
      c => `That was not good enough and I am not going to pretend otherwise. It starts with me.`,
      c => `We were second best. I picked the team and I got it wrong.`,
      c => `Supporters travelled a long way for that. They deserve better and they will get it.`,
      c => `I will not hide behind the players. That is my responsibility.`,
      c => `We have a lot of work to do. I would rather say that than sell you something.`,
      c => `No excuses about anything — not the pitch, not the referee, not the fixtures.`,
      c => `Angry, and that is the right thing to be. It will be a hard week on the training ground.`
    ],
    praise: [
      c => `${c.star} was outstanding. Everything good we did went through him.`,
      c => `Special mention for ${c.kid}. Not many players his age could have done that.`,
      c => `${c.topScorer} works harder for this team than anyone will ever write about.`,
      c => `The staff do not get enough credit. Every one of them was right this week.`,
      c => `The best thing about this group is that nobody hides. Not one of them.`,
      c => `Proud of the players. Genuinely proud. They gave everything.`,
      c => `${c.star2} does the job nobody notices. I notice.`
    ],
    defiant: [
      c => `I read what is written. It does not change one thing about how I do this job.`,
      c => `I have a contract, a plan and a group of players who believe in it. That is enough.`,
      c => `If the board want a conversation, they know where my office is.`,
      c => `I will not be talking about my future. I will be talking about Saturday.`,
      c => `Everyone is entitled to an opinion. Not everyone is entitled to my attention.`,
      c => `We will be judged on results. I have no problem with that. None at all.`,
      c => `Nobody here is panicking. Nobody. Look at the training ground if you do not believe me.`
    ]
  };

  /* ---- what the timeline says back to you ---- */
  const MGR_REPLIES = {
    hype: [
      'the gaffer gets it', 'in him we trust', 'best appointment this club has made in twenty years',
      'give him a contract until 2040', 'he has turned this squad around and nobody outside sees it',
      'proper manager, proper man', 'the shape, the substitutions, everything. faultless.',
      'I doubted him. I was wrong. I will say it loudly.', 'do not let him leave. whatever it costs.',
      'he has made me enjoy watching this club again'
    ],
    doubt: [
      'ask me again after a run of hard games', 'anybody could get results with that budget',
      'one good month does not make a manager', 'wait until we play a top four side',
      'the football is dreadful even when we win', 'he has not fixed the defence, we are just scoring more',
      'this squad should be higher than this', 'I want to believe. I have been burned before.',
      'nice bloke, not sure he is the answer'
    ],
    banter: [
      'you lot were calling for him in September', 'quote tweeting this in May',
      'imagine peaking against us', 'enjoy it, it does not last',
      'still would not swap managers with you', 'and you all said we were the badly run one',
      'your ground still has a leaky roof though', 'the bandwagon has a weight limit lads'
    ],
    stat: [
      'that is his best points-per-game run at this club', 'their xG for and against have both improved every month',
      'nobody in this division has taken more points from losing positions', 'set piece goals are up 40% since he arrived',
      'the squad is younger and the results are better. that is coaching.',
      'he has used fewer players than any manager in the top half'
    ],
    tactic: [
      'the shape is the story here, not the players', 'move the midfield five yards higher and this team wins the league',
      'stop asking the full backs to do two jobs', 'we press in a 4-4-2 and defend in a back five. it is not complicated.',
      'the substitutions win us games and nobody clips substitutions',
      'give him a proper number six and watch what happens'
    ],
    joke: [
      'my wife has asked me to stop shouting at the tactics board', 'I have a spreadsheet. I am not okay.',
      'putting this on the fridge', 'told my boss I was ill. I was, emotionally.',
      'the amount of my life I have given this club is genuinely alarming',
      'nobody tell him he can do that every week', 'watched it 41 times, send help'
    ],
    cope: [
      'referee decided that one, as usual', 'we were the better side for twenty minutes',
      'no complaints, they wanted it more', 'right. season starts now.',
      'deleting the app until Saturday', 'I am not angry I am just extremely tired',
      'it is only football. it is not only football.'
    ],
    wholesome: [
      'he stayed and clapped the away end. small thing, means everything.',
      'my lad met him outside the training ground. could not have been nicer.',
      'football is good sometimes', 'whatever happens next, thanks for this season',
      'took my dad to his first game in ten years. he was buzzing.',
      'the manager signed my programme and asked my daughter her name. class.',
      'he went over to the ball boy at the end. nobody filmed it except me.',
      'paid for the away coach out of his own pocket apparently. no idea if it is true. hope it is.',
      'stood in the rain signing things for forty minutes. proper bloke.',
      'my nan has started watching games again because of this team',
      'whatever the table says, this has been a lovely season to follow'
    ],
    hope: [
      'first time in years I have been excited for a fixture list',
      'something is being built here and I want to be around for it',
      'we are two players away and I think he knows it',
      'give it one more window before you judge the whole thing',
      'the young lads are the reason to keep watching',
      'I have seen enough to trust him with a bad run',
      'this is the most coherent this club has looked in a decade',
      'not asking for trophies. just asking for a plan. we have one.'
    ],
    anger: [
      'somebody in that boardroom needs to explain themselves',
      'we have been badly run for fifteen years and it is not the manager',
      'I pay a lot of money to watch that and I want it acknowledged',
      'the same mistake, the same week, the same nothing done about it',
      'stop telling me about the process. show me a win.',
      'if any of us did our jobs like that we would be sacked by Tuesday',
      'no fight, no shape, no idea. pick one to fix.',
      'I am not renewing. I say it every year. this year I mean it.'
    ]
  };

  /* ---- the academy, the window, the milestones ---- */
  POSTS.youth = [
    { k: 'club', tone: 'good', t: c => `${c.kid} has been promoted to the first team squad. 🌱 #${c.tagName}` },
    { k: 'fan', tone: 'good', t: c => `${c.kid} coming through is worth more to me than any signing. Genuinely.` },
    { k: 'journo', tone: 'good', t: c => `${c.clubName} hand a first team place to ${c.kid}. The manager has never been afraid of that.` },
    { k: 'fantv', tone: 'good', t: c => `Told you about ${c.kid} in September. TOLD YOU. Framing this post.` },
    { k: 'pundit', tone: 'info', t: 'Playing kids is easy. Playing them when you are under pressure is the hard part. He does.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} have given more minutes to under-21s than most of this division.` },
    { k: 'fan', tone: 'info', t: 'Do not put too much on him. Let the lad grow up first.' },
    { k: 'rival', tone: 'info', t: 'Their academy is genuinely good and it is annoying.' }
  ];

  POSTS.windowQuiet = [
    { k: 'fantv', tone: 'bad', t: 'Deadline day and we have signed nobody. Nobody! I sat here for eleven hours.' },
    { k: 'fan', tone: 'bad', t: 'Same squad, same problems, different season. Brilliant.' },
    { k: 'journo', tone: 'info', t: c => `${c.clubName} end the window quietly. The manager insists he is happy with what he has.` },
    { k: 'pundit', tone: 'info', t: 'Not signing is a decision too. Sometimes it is the right one. Sometimes it is just cheaper.' },
    { k: 'fan', tone: 'info', t: 'Trusting the group we have. Radical, I know.' },
    { k: 'stats', tone: 'info', t: c => `${c.budget} still unspent at ${c.clubName}.` },
    { k: 'rival', tone: 'good', t: 'They had all summer and did nothing. Beautiful.' }
  ];

  POSTS.milestone = [
    { k: 'club', tone: 'good', t: c => `${c.played} games in charge. Thank you, boss. 👏` },
    { k: 'stats', tone: 'info', t: c => `${c.seasons} season${c.seasons === 1 ? '' : 's'}, ${c.trophies} trophies, reputation ${c.rep}. Not bad.` },
    { k: 'journo', tone: 'info', t: c => `A milestone for ${c.clubName}'s manager. Longevity is rare in this job and rarer at this club.` },
    { k: 'fan', tone: 'good', t: 'Been through a lot with this gaffer. Would not swap him.' },
    { k: 'fantv', tone: 'good', t: 'Doing a full retrospective on his time here. It has been a ride.' },
    { k: 'pundit', tone: 'info', t: 'Managers do not get time any more. He has had it and he has used it well.' }
  ];

  POSTS.moneyTalk = [
    { k: 'fan', tone: 'info', t: c => `${c.budget} in the bank and a squad crying out for a winger. Do the maths.` },
    { k: 'journo', tone: 'info', t: c => `${c.clubName} have made ${c.budget} available to the manager. Whether he spends it is another matter.` },
    { k: 'fantv', tone: 'bad', t: 'We have money. We have needs. We have a board. Two out of three is the problem.' },
    { k: 'pundit', tone: 'info', t: 'A budget is not a plan. What he does with it will tell you what he actually thinks of this squad.' },
    { k: 'stats', tone: 'info', t: c => `Transfer budget at ${c.clubName}: ${c.budget}.` },
    { k: 'fan', tone: 'good', t: 'Backing the manager with real money. When did we become a proper club?' },
    { k: 'rival', tone: 'bad', t: 'Buying the league again. Some of us develop players.' }
  ];

  POSTS.goalOfSeason = [
    { k: 'club', tone: 'hot', t: c => `Goal of the Season. 🏅 There was only ever one winner. ${c.scorer}.` },
    { k: 'fantv', tone: 'hot', t: c => `GOAL OF THE SEASON AND IT IS NOT EVEN CLOSE. ${c.scorer.toUpperCase()}.` },
    { k: 'fan', tone: 'hot', t: c => `Voted for ${c.scorer}'s one about forty times. No regrets.` },
    { k: 'journo', tone: 'good', t: c => `${c.scorer} takes Goal of the Season. Nobody at ${c.clubName} needed a vote.` },
    { k: 'pundit', tone: 'good', t: 'I have watched it every week since. It gets better, not worse.' },
    { k: 'stats', tone: 'info', t: c => `Goal of the Season: ${c.scorer}, ${c.clubName}.` }
  ];

  POSTS.rivalNews = [
    { k: 'rival', tone: 'bad', t: c => `Our manager has gone. Enjoy your week, ${c.clubName} fans, you insufferable lot.` },
    { k: 'fan', tone: 'good', t: c => `${c.rival} in crisis again. I am eating this up with a spoon.` },
    { k: 'fantv', tone: 'good', t: c => `Doing a whole video on ${c.rival}'s season. Purely to be cruel. No apologies.` },
    { k: 'journo', tone: 'info', t: c => `${c.rival} are having a difficult season, which will not be causing much sadness at ${c.clubName}.` },
    { k: 'fan', tone: 'info', t: c => `Genuinely do not care what ${c.rival} do. (Checks their score.) (Cares enormously.)` },
    { k: 'pundit', tone: 'info', t: 'The balance of power in this city has shifted, and it has shifted because of coaching.' },
    { k: 'stats', tone: 'info', when: c => c.pos <= 3,
      t: c => `${c.clubName} are ${c.posOrd}, and ${c.rival} are not enjoying it.` }
  ];

  POSTS.pressure = [
    { k: 'journo', tone: 'info', t: 'The manager was asked about his future four times today. He answered once.' },
    { k: 'fan', tone: 'info', t: 'The bloke has taken more abuse this month than most take in a career. Give him a break.' },
    { k: 'fantv', tone: 'bad', t: 'I do not enjoy being right about this. I would genuinely rather be wrong.' },
    { k: 'pundit', tone: 'info', t: 'He looks tired. Not beaten — tired. There is a difference and it matters.' },
    { k: 'fan', tone: 'bad', t: 'Boos at full time. Never nice to hear. Cannot say it was undeserved.' },
    { k: 'club', tone: 'info', t: 'The manager will speak to the media as normal tomorrow morning.' },
    { k: 'rival', tone: 'good', t: 'Their fans turning on their own manager. Best content on this app.' },
    { k: 'fan', tone: 'good', t: 'Sang his name for ten minutes at the end. Whatever happens, he knows.' }
  ];

  POSTS.bigGameWin = [
    { k: 'fantv', tone: 'hot', t: c => `WE BEAT ${c.opp.toUpperCase()}. Rated ${c.oppRating}. AT THEIR PLACE.` },
    { k: 'journo', tone: 'good', t: c => `${c.clubName} beat ${c.opp}, a side rated ${c.oppRating}. That is the manager's best result here.` },
    { k: 'pundit', tone: 'good', t: c => `That is a tactical win. He picked a shape specifically for ${c.opp} and it worked perfectly.` },
    { k: 'fan', tone: 'hot', t: 'Nobody gave us a prayer. NOBODY. And we went and did it.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} (rated below ${c.opp}) win it. Upsets like that are rarer than you think.` },
    { k: 'rival', tone: 'bad', t: c => `Losing to ${c.clubName} at home is unacceptable. Genuinely unacceptable.` },
    { k: 'club', tone: 'hot', t: c => `On a night like this, there is nothing better. ${c.us}-${c.them}. 💙` },
    { k: 'fan', tone: 'hot', t: 'Away end did not stop for ninety minutes. Voice gone. Worth every second.' }
  ];
  /* ================= more of everything =================
     Same rules: each line belongs to one situation and is gated to it. */
  const MORE = {};

  MORE.win = [
    { k: 'fan', tone: 'good', t: 'Three points, home in time for tea, no complaints from me.' },
    { k: 'fan', tone: 'good', t: 'That is how you follow up a bad week. Proper response.' },
    { k: 'pundit', tone: 'good', t: 'They controlled the middle third for an hour. Everything else followed from that.' },
    { k: 'journo', tone: 'info', t: c => `${c.clubName} 	take the points at ${c.opp}'s expense. The manager barely reacted.` },
    { k: 'fantv', tone: 'good', t: 'Three points. Three! Do you know how long it has been since I said that twice in a month?' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} ${c.us}-${c.them} ${c.opp}. ${c.wins} wins in ${c.played}.` },
    { k: 'club', tone: 'good', t: 'Points on the board. 📌 Thanks for the noise today.' },
    { k: 'fan', tone: 'good', t: 'The bloke next to me said it would be a nervy one. He was right and he loved it.' },
    { k: 'rival', tone: 'info', t: c => `${c.clubName} winning again. Yes, I am aware. Thank you all for the reminders.` },
    { k: 'pundit', tone: 'info', t: 'Not a vintage performance, but they were never in danger of losing it. That is progress.' },
    { k: 'journo', tone: 'good', t: 'The manager praised his substitutes afterwards, and he was right to.' },
    { k: 'fan', tone: 'good', t: 'Left it late to get in, missed the first ten, still worth it.' },
    { k: 'fantv', tone: 'good', t: 'Player ratings up tonight. Nobody is getting below a six and that is unusual.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} have taken points in this fixture for a while now.` },
    { k: 'club', tone: 'good', t: 'Same again next week, please. 🙏' },
    { k: 'fan', tone: 'good', t: 'A win is a win. Some of you have forgotten what those feel like.' },
    { k: 'pundit', tone: 'good', t: c => `${c.style} away from home takes courage. It worked.` },
    { k: 'journo', tone: 'info', t: c => `A workmanlike win for ${c.clubName}. The table will not ask for details.` },
    { k: 'fan', tone: 'good', t: 'Kid next to me got a shirt thrown to him at full time. Made his year.' },
    { k: 'fantv', tone: 'good', t: 'Right, everyone who wanted the manager out in September, form an orderly queue.' }
  ];

  MORE.bigWin = [
    { k: 'fan', tone: 'hot', t: 'They could have had ten. TEN.' },
    { k: 'journo', tone: 'good', t: c => `${c.opp} were second best in every single department. ${c.clubName} were relentless.` },
    { k: 'pundit', tone: 'good', t: c => `The pressing was the story. ${c.opp} could not get out of their own half for forty minutes.` },
    { k: 'fantv', tone: 'hot', t: 'THAT IS THE BEST WE HAVE PLAYED SINCE I STARTED THIS CHANNEL. On my life.' },
    { k: 'club', tone: 'hot', t: c => `Some days it just clicks. ⚡ ${c.us}-${c.them}.` },
    { k: 'fan', tone: 'hot', t: 'My throat is gone, my legs are gone, my week is made.' },
    { k: 'stats', tone: 'info', t: c => `${c.us} goals scored, ${c.them} conceded. ${c.clubName}'s biggest margin this season.` },
    { k: 'rival', tone: 'bad', t: 'We turned up in a coach and went home in a wheelbarrow. Awful.' },
    { k: 'journo', tone: 'good', t: 'The manager took off two of his best players with twenty minutes left. He could afford to.' },
    { k: 'fan', tone: 'good', t: 'Standing ovation at full time and it was not even close to enough.' },
    { k: 'pundit', tone: 'good', t: 'Every single player understood their job. That does not happen by chance.' },
    { k: 'fantv', tone: 'hot', t: 'Doing a goal-by-goal breakdown and it is going to be forty minutes long. Sorry not sorry.' },
    { k: 'club', tone: 'good', t: 'Safe home. What a day. 💙' },
    { k: 'fan', tone: 'hot', t: 'Away end was bouncing from the first whistle. Best atmosphere in years.' },
    { k: 'stats', tone: 'info', t: c => `Nobody has scored ${c.us} in a game in this division for months.` },
    { k: 'rival', tone: 'info', t: c => `Credit where it is due, that was a proper performance from ${c.clubName}.` }
  ];

  MORE.narrowWin = [
    { k: 'fantv', tone: 'good', t: 'Won it, hated every minute, would not have missed it.' },
    { k: 'fan', tone: 'good', t: 'My mate left on eighty-five to beat the traffic. He is not a serious man.' },
    { k: 'pundit', tone: 'info', t: 'They defended a one-goal lead for half an hour without inviting pressure. Not easy.' },
    { k: 'journo', tone: 'info', t: c => `${c.clubName} scrape past ${c.opp}. The manager called it a "grown-up performance".` },
    { k: 'fan', tone: 'good', t: 'We used to lose these. That is the whole change, right there.' },
    { k: 'stats', tone: 'info', t: c => `Another one-goal game for ${c.clubName}. They are getting good at those.` },
    { k: 'club', tone: 'good', t: c => `Never in doubt. (It was, briefly.) ${c.us}-${c.them}.` },
    { k: 'rival', tone: 'bad', t: 'One shot on target and they win it. Football is a broken sport.' },
    { k: 'fan', tone: 'good', t: 'Not watched a game through my fingers like that in a long time.' },
    { k: 'pundit', tone: 'good', t: 'Good sides win the games they play badly in. They are becoming a good side.' },
    { k: 'fantv', tone: 'good', t: 'The last five minutes took a year off me. Small price.' },
    { k: 'journo', tone: 'good', t: c => `Not a classic, but ${c.clubName} have not thrown a lead away in weeks.` }
  ];

  MORE.draw = [
    { k: 'fan', tone: 'info', t: 'Draw. Not a disaster, not a night out. Just a Tuesday.' },
    { k: 'pundit', tone: 'info', t: 'Two teams cancelling each other out is not a scandal. It is quite often football.' },
    { k: 'fantv', tone: 'bad', t: 'We have drawn how many now? Add them up and we would be third.' },
    { k: 'journo', tone: 'info', t: c => `Honours even at ${c.clubName}. Both managers looked like they would take it.` },
    { k: 'fan', tone: 'bad', t: 'Dropped two. Say it properly. We dropped two.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName}: ${c.us}-${c.them}. Points shared.` },
    { k: 'club', tone: 'info', t: 'A point. On we go. 💙' },
    { k: 'rival', tone: 'info', t: c => `Point at ${c.clubName}. I would have taken that before kick off and I am taking it now.` },
    { k: 'fan', tone: 'info', t: 'Somebody in the ground shouted "SHOOT" for ninety minutes. He was right twice.' },
    { k: 'pundit', tone: 'bad', t: 'They ran out of ideas after an hour and the bench did not change it. That is fixable.' },
    { k: 'fantv', tone: 'info', t: 'Doing a calm video for once. It was a draw. Draws happen.' },
    { k: 'journo', tone: 'info', t: 'Neither goalkeeper had much to do. Neither set of supporters had much to sing about.' },
    { k: 'fan', tone: 'good', t: 'Came from behind for that point. Would have folded a year ago.' }
  ];

  MORE.loss = [
    { k: 'fan', tone: 'bad', t: 'We had one shot. ONE. At this level that is not a plan, that is a hope.' },
    { k: 'pundit', tone: 'info', t: 'They were beaten by a better team on the day. It happens. The reaction is what matters.' },
    { k: 'journo', tone: 'bad', t: c => `${c.opp} were sharper, quicker and hungrier. ${c.clubName} had no answer to any of it.` },
    { k: 'fantv', tone: 'bad', t: 'Not doing player ratings tonight. It would be cruel.' },
    { k: 'fan', tone: 'info', t: 'Losing away at a good side is not a crisis. Some of you need to log off.' },
    { k: 'club', tone: 'bad', t: 'Disappointing. We will review it and go again. Thank you for the support.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} are ${c.posOrd}. ${c.wins} wins from ${c.played}.` },
    { k: 'rival', tone: 'good', t: c => `Beat ${c.clubName}. Getting the good tea set out.` },
    { k: 'fan', tone: 'bad', t: 'Booed off. Deserved it, unfortunately.' },
    { k: 'pundit', tone: 'bad', t: 'The substitutions came too late and did not change anything when they did.' },
    { k: 'journo', tone: 'info', t: 'The manager took full responsibility afterwards, which supporters will appreciate more than excuses.' },
    { k: 'fan', tone: 'bad', t: 'Same shape, same problem, same result. At some point that is a choice.' },
    { k: 'fantv', tone: 'bad', t: 'Genuinely asking: what is the plan when the first plan does not work?' },
    { k: 'fan', tone: 'good', t: 'Players came over to the away end at the end. Small thing. Meant something.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} lost the shot count and the possession. Hard to argue with the result.` }
  ];

  MORE.heavyLoss = [
    { k: 'fan', tone: 'bad', t: 'Left on seventy. First time in eleven years I have walked out early.' },
    { k: 'journo', tone: 'bad', t: c => `Chastening. ${c.opp} scored ${c.them} and were rarely out of second gear.` },
    { k: 'pundit', tone: 'bad', t: 'There was no plan and, worse than that, there was no fight once it went. That is the bit that costs jobs.' },
    { k: 'fantv', tone: 'bad', t: 'I have made four hundred videos about this club. That was the hardest one to sit through.' },
    { k: 'fan', tone: 'bad', t: 'Some of those lads should be ashamed. The manager too.' },
    { k: 'club', tone: 'bad', t: 'We fell well short today. We owe you better than that.' },
    { k: 'rival', tone: 'hot', t: c => `Best away day of my life and it is not close. ${c.us}-${c.them}.` },
    { k: 'stats', tone: 'info', t: c => `${c.them} conceded. ${c.clubName} have not shipped that many in a very long time.` },
    { k: 'fan', tone: 'info', t: 'Stayed to the end and clapped them off. Somebody has to.' },
    { k: 'pundit', tone: 'info', t: 'One bad afternoon does not define a season. Three of them do.' },
    { k: 'journo', tone: 'bad', t: 'The manager did not speak to the players in the dressing room afterwards. He told them to think about it.' },
    { k: 'fantv', tone: 'bad', t: 'Comments are open. Be nice to each other. Be brutal about the football.' }
  ];

  MORE.cleanSheet = [
    { k: 'pundit', tone: 'good', t: 'Two banks of four, no gaps, no panic. Deeply unfashionable and deeply effective.' },
    { k: 'fantv', tone: 'good', t: 'A clean sheet! Somebody frame it. Somebody put it in a museum.' },
    { k: 'journo', tone: 'good', t: c => `${c.opp} did not have a shot worth the name. That is a coached performance.` },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} keep ${c.opp} out entirely. Nothing on target.` },
    { k: 'club', tone: 'good', t: 'Nothing past us. 🚫 Great from the back five.' },
    { k: 'fan', tone: 'good', t: 'I love a 0-0 more than any of you and today I was in heaven.' },
    { k: 'fan', tone: 'good', t: 'Our keeper had a quiet afternoon and that is the highest praise there is.' },
    { k: 'pundit', tone: 'info', t: "Clean sheets are a team habit, not a goalkeeper's. This one is becoming a habit." },
    { k: 'rival', tone: 'bad', t: 'We could have played until midnight and not scored past that lot.' }
  ];

  MORE.bigGameWin = [
    { k: 'fan', tone: 'hot', t: c => `We beat ${c.opp}. Read it again. We beat ${c.opp}.` },
    { k: 'journo', tone: 'good', t: c => `A result that will change how people talk about ${c.clubName} this season.` },
    { k: 'pundit', tone: 'good', t: 'He out-thought a better manager with worse players. That is the job, done properly.' },
    { k: 'fantv', tone: 'hot', t: 'NOBODY GAVE US A CHANCE. NOBODY. I love this football club.' },
    { k: 'club', tone: 'hot', t: c => `Nights like this. 🌙 ${c.us}-${c.them} against ${c.opp}.` },
    { k: 'stats', tone: 'info', t: c => `${c.opp}, rated ${c.oppRating}, beaten. On paper this should not have happened.` },
    { k: 'fan', tone: 'hot', t: 'The noise when the goal went in. I have never heard our ground like that.' },
    { k: 'rival', tone: 'bad', t: 'Losing there is one thing. Losing there like that is another.' },
    { k: 'journo', tone: 'good', t: 'The manager was mobbed on the touchline at full time. He did not seem to mind.' }
  ];

  MORE.derbyWin = [
    { k: 'club', tone: 'hot', t: 'This one is for you. 💙 All of you.' },
    { k: 'fan', tone: 'hot', t: 'Work tomorrow is going to be the best day of my professional life.' },
    { k: 'fantv', tone: 'hot', t: 'SIX HOURS of content coming this week and every second is about this game.' },
    { k: 'journo', tone: 'good', t: 'The manager understood exactly what this fixture meant, and set his team up like a supporter would have.' },
    { k: 'rival', tone: 'bad', t: 'Twelve months of hearing about this. Twelve months.' },
    { k: 'pundit', tone: 'good', t: 'He won the tactical battle and the emotional one. Derbies need both.' },
    { k: 'fan', tone: 'hot', t: 'Told my boss I had a dentist appointment. I have never smiled so much.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} beat ${c.opp}. The bragging rights stay put.` }
  ];

  MORE.derbyLoss = [
    { k: 'fantv', tone: 'bad', t: 'Comments off. Notifications off. Phone off. See you Thursday.' },
    { k: 'fan', tone: 'bad', t: 'Every year I say it does not matter more than the others. Every year I lie.' },
    { k: 'journo', tone: 'bad', t: c => `A miserable afternoon for ${c.clubName}, and the one result the manager could not afford.` },
    { k: 'rival', tone: 'hot', t: 'Beat them. BEAT THEM. Nothing else this season matters now.' },
    { k: 'pundit', tone: 'info', t: 'You can lose a derby. You cannot lose it looking like you did not want it.' },
    { k: 'fan', tone: 'info', t: 'Right. It is done. It counts for three points and no more. Onwards.' },
    { k: 'club', tone: 'bad', t: 'Not our day. We know what that fixture means. We will put it right.' }
  ];
  MORE.cupThrough = [
    { k: 'fan', tone: 'good', t: 'Still in it. That is all a cup run is: still being in it.' },
    { k: 'fantv', tone: 'good', t: 'Draw is on Monday and I will be watching it like it is a lottery ticket.' },
    { k: 'journo', tone: 'info', t: c => `${c.clubName} progress. The manager made changes and got away with all of them.` },
    { k: 'club', tone: 'good', t: c => `We go again in the next round. 🏆 #${c.tagName}` },
    { k: 'pundit', tone: 'good', t: 'Winning a tie without your best eleven is how you win cups over a long season.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} advance in the ${c.comp}.` },
    { k: 'fan', tone: 'hot', t: 'Do NOT let me start dreaming. Too late. I have started dreaming.' },
    { k: 'rival', tone: 'info', t: 'Every year they get a nice draw and every year we get a monster. Rigged.' },
    { k: 'fan', tone: 'good', t: 'Midweek away in the cup, half full ground, freezing. Perfect.' },
    { k: 'fantv', tone: 'good', t: 'Ticket info video tonight because I know none of you can work the website.' }
  ];

  MORE.cupOut = [
    { k: 'pundit', tone: 'info', t: 'He rotated and it cost him. He would probably do the same again, and he would probably be right.' },
    { k: 'fan', tone: 'bad', t: 'Cup runs are the only fun some of us get. Gone in ninety minutes.' },
    { k: 'club', tone: 'bad', t: c => `Beaten in the ${c.stageName.toLowerCase()}. Thank you to everybody who travelled. 💙` },
    { k: 'journo', tone: 'info', t: c => `Out of the ${c.comp}. The manager will say it helps the league. Nobody in that away end believes him.` },
    { k: 'fantv', tone: 'bad', t: 'I had the hotel booked. THE HOTEL WAS BOOKED.' },
    { k: 'fan', tone: 'info', t: 'Full focus on the league now. That is the sensible take and I hate it.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} exit the ${c.comp} at the ${c.stageName.toLowerCase()}.` },
    { k: 'rival', tone: 'good', t: c => `Watching ${c.clubName} go out of a cup never gets old.` },
    { k: 'pundit', tone: 'bad', t: "One night, one team not at it, and a season's ambition gone. Brutal competition." }
  ];

  MORE.cupWon = [
    { k: 'fan', tone: 'hot', t: 'My phone has died twice. My voice is gone. I have never been happier.' },
    { k: 'journo', tone: 'hot', t: c => `${c.clubName} have won the ${c.comp}. Supporters will remember exactly where they were.` },
    { k: 'pundit', tone: 'good', t: "Winning a cup changes a manager's standing forever. He will always have this." },
    { k: 'fantv', tone: 'hot', t: 'I HAVE BEEN DOING THIS SINCE WE WERE NOWHERE AND WE HAVE WON A TROPHY.' },
    { k: 'club', tone: 'hot', t: '🏆 Champions. Get the open top bus warmed up.' },
    { k: 'stats', tone: 'info', t: c => `${c.comp}: won. That is trophy number ${c.trophies} for this manager.` },
    { k: 'fan', tone: 'hot', t: 'Rang my dad before I rang my wife. He understood. She did not.' },
    { k: 'rival', tone: 'bad', t: 'Going to be a long summer listening to that lot.' },
    { k: 'fan', tone: 'good', t: 'Every single one of those players gave everything. Thank you, honestly.' },
    { k: 'journo', tone: 'good', t: 'The manager gave his medal to a member of the ground staff. Says a lot about him.' },
    { k: 'fantv', tone: 'hot', t: 'Cancelling the tactical breakdown. We are just watching the celebrations for two hours.' }
  ];

  MORE.cupFinalLost = [
    { k: 'fantv', tone: 'bad', t: 'Do not talk to me about "we got there". I wanted to WIN it.' },
    { k: 'fan', tone: 'info', t: 'Proud of them. Sick to my stomach. Both, at the same time.' },
    { k: 'journo', tone: 'bad', t: c => `A final lost. ${c.clubName}'s players sat on the turf for a long time afterwards.` },
    { k: 'pundit', tone: 'info', t: 'They will be back. Losing one of these is often the price of learning how to win one.' },
    { k: 'club', tone: 'bad', t: 'So close. Thank you for filling that end. We will never forget it. 💙' },
    { k: 'fan', tone: 'bad', t: 'Cannot look at the shirt. Give me a week.' },
    { k: 'stats', tone: 'info', t: c => `Runners-up in the ${c.comp}.` },
    { k: 'rival', tone: 'info', t: 'Rather them than us, but nobody enjoys watching a final lost like that.' }
  ];

  MORE.worldie = [
    { k: 'club', tone: 'good', t: c => `Some goals need replaying. 🔁 ${c.scorer}.` },
    { k: 'fan', tone: 'hot', t: c => `${c.scorer} does that in training apparently. Of course he does.` },
    { k: 'pundit', tone: 'good', t: 'The technique is the thing. Body shape, contact, follow through. Textbook, at speed.' },
    { k: 'journo', tone: 'good', t: c => `A moment of real quality from ${c.scorer} in an otherwise ordinary game.` },
    { k: 'fantv', tone: 'hot', t: 'SLOW IT DOWN. Look at his standing foot. LOOK AT IT.' },
    { k: 'stats', tone: 'info', t: c => `${c.scorer} strikes from distance again. He does not need many chances.` },
    { k: 'fan', tone: 'good', t: 'Whole ground stood up before it hit the net. You just knew.' },
    { k: 'rival', tone: 'info', t: 'Our keeper could not have done anything. Nobody could.' },
    { k: 'fan', tone: 'hot', t: 'Have set it as my lock screen. It is a video. I do not care.' },
    { k: 'pundit', tone: 'info', t: 'He shoots from there because nobody tells him not to. Long may that continue.' }
  ];

  MORE.wonderGoal = [
    { k: 'fan', tone: 'hot', t: 'That is going on every highlights reel for the next ten years.' },
    { k: 'club', tone: 'hot', t: c => `We have run out of words. Watch ${c.scorer}. 🤯🔁` },
    { k: 'journo', tone: 'good', t: c => `Whatever else happens this season, ${c.scorer} has given ${c.clubName} a goal they will show forever.` },
    { k: 'pundit', tone: 'good', t: 'I have rewound it eleven times and I still do not know how he generated that.' },
    { k: 'fantv', tone: 'hot', t: 'Doing a frame-by-frame. It is going to be the most watched thing I ever make.' },
    { k: 'stats', tone: 'info', t: c => `${c.scorer}: a finish from a position almost nobody scores from.` },
    { k: 'fan', tone: 'hot', t: 'Took my son to his first game and he saw THAT. He is ruined for normal football now.' },
    { k: 'rival', tone: 'good', t: 'Beaten by a goal like that, you just applaud and go home.' },
    { k: 'fan', tone: 'hot', t: 'The stadium noise on my phone recording is just distortion. Nothing but distortion.' },
    { k: 'journo', tone: 'hot', t: 'The press box stood up. The press box never stands up.' }
  ];

  MORE.century = [
    { k: 'fantv', tone: 'hot', t: 'I am shaking. Genuinely shaking. Watch it and tell me you are not.' },
    { k: 'club', tone: 'hot', t: c => `Some things you just have to see. ⚽ ${c.scorer}.` },
    { k: 'fan', tone: 'hot', t: c => `Whatever I do with the rest of my life, I saw ${c.scorer} do that in person.` },
    { k: 'journo', tone: 'hot', t: 'Twenty five years in this job. That is the finest individual goal I have ever reported on.' },
    { k: 'pundit', tone: 'hot', t: 'Forget this season. Forget this league. That belongs in a different conversation entirely.' },
    { k: 'stats', tone: 'info', t: c => `${c.scorer}. We are not going to insult it with a number.` },
    { k: 'rival', tone: 'good', t: 'We conceded it and I would pay to watch it again. Ridiculous.' },
    { k: 'fan', tone: 'hot', t: 'The ground did not sit down for four minutes. FOUR MINUTES.' },
    { k: 'fantv', tone: 'hot', t: 'Every channel is running it. Every single one. And they should.' },
    { k: 'journo', tone: 'good', t: c => `${c.scorer} looked as surprised as everybody else. That is the best part.` }
  ];

  MORE.hattrick = [
    { k: 'fan', tone: 'hot', t: c => `${c.scorer} with the ball under his arm. Beautiful sight.` },
    { k: 'fantv', tone: 'hot', t: 'HAT-TRICK. Get him a statue. Get him a bus. Get him the freedom of the city.' },
    { k: 'club', tone: 'good', t: c => `Three for ${c.scorer}. 🎩⚽⚽⚽` },
    { k: 'journo', tone: 'good', t: c => `${c.opp} never solved ${c.scorer}, and by the third they had stopped trying.` },
    { k: 'stats', tone: 'info', t: c => `${c.scorer} takes his tally to ${c.topGoals} for the season.` },
    { k: 'pundit', tone: 'good', t: 'Ruthless. He had four chances and buried three of them.' },
    { k: 'fan', tone: 'hot', t: 'Whatever we paid for him, double it and send it as an apology.' },
    { k: 'rival', tone: 'bad', t: 'Our centre halves need a lie down and possibly a new career.' }
  ];

  MORE.goalOfSeason = [
    { k: 'fan', tone: 'hot', t: c => `Was never in doubt. ${c.scorer} by a mile.` },
    { k: 'fantv', tone: 'good', t: c => `Ran the poll for three days. It was not close. ${c.scorer}.` },
    { k: 'club', tone: 'good', t: c => `Voted for by you. Scored by him. ${c.scorer}. 🏅` },
    { k: 'pundit', tone: 'good', t: 'Some Goal of the Season winners are debatable. This one really was not.' },
    { k: 'journo', tone: 'info', t: c => `${c.scorer} takes the club's Goal of the Season. Nobody else got close in the voting.` },
    { k: 'fan', tone: 'good', t: 'Still get a shiver watching it back. Best thing I saw all year.' }
  ];

  MORE.signing = [
    { k: 'fan', tone: 'info', t: 'Never heard of him. Trusting the manager. Ask me in six months.' },
    { k: 'journo', tone: 'info', t: c => `${c.player} arrives at ${c.clubName}. Medical passed this morning, announced this afternoon.` },
    { k: 'pundit', tone: 'info', t: 'Not a headline signing, but a sensible one. That squad needed exactly that profile.' },
    { k: 'club', tone: 'good', t: c => `Say hello to ${c.player}. 👋 #${c.tagName}` },
    { k: 'fantv', tone: 'good', t: c => `Scout report video on ${c.player} tonight. I have watched four full games. Send help.` },
    { k: 'stats', tone: 'info', t: c => `${c.player}: ${c.ovr} rated, aged ${c.age}. Fee ${c.fee}.` },
    { k: 'fan', tone: 'good', t: 'He kissed the badge in the announcement video. Early days but I am in.' },
    { k: 'rival', tone: 'info', t: 'We looked at him. Decided against. Watch him be brilliant now.' },
    { k: 'fan', tone: 'bad', t: 'That is not the position we needed. It is genuinely not.' },
    { k: 'journo', tone: 'good', t: c => `The manager pushed hard for ${c.player}. If it works, that is on him. If it does not, also on him.` },
    { k: 'pundit', tone: 'good', t: 'Good age, good price, right league. Very little to dislike about that one.' },
    { k: 'fan', tone: 'good', t: 'Announcement video was genuinely excellent. Whoever made it, well done.' }
  ];

  MORE.bigSigning = [
    { k: 'fan', tone: 'hot', t: c => `I have refreshed this app so many times my thumb hurts. ${c.player} IS OURS.` },
    { k: 'club', tone: 'hot', t: c => `He said yes. ✍️ ${c.player}. #${c.tagName}` },
    { k: 'journo', tone: 'hot', t: c => `Confirmed: ${c.player} to ${c.clubName}, ${c.fee}. A signing that reframes this club's ambition.` },
    { k: 'fantv', tone: 'hot', t: 'I have done eleven emergency streams this year and none of them mattered like this one.' },
    { k: 'pundit', tone: 'info', t: 'He makes everyone around him better. That is worth more than the fee, and the fee is enormous.' },
    { k: 'stats', tone: 'info', t: c => `${c.player}, rated ${c.ovr} at ${c.age}. Record business for ${c.clubName}.` },
    { k: 'fan', tone: 'hot', t: 'Twenty years of following this club and I never thought I would type a sentence like that.' },
    { k: 'rival', tone: 'bad', t: 'Genuinely upsetting. Do not want to talk about it.' },
    { k: 'fan', tone: 'info', t: 'Now we have to actually build a team around him. That is the hard bit.' },
    { k: 'journo', tone: 'good', t: c => `Sources say the manager spoke to ${c.player} personally for over an hour. That call did it.` }
  ];

  MORE.sale = [
    { k: 'fantv', tone: 'info', t: c => `Doing a proper tribute video for ${c.player}. Give me the memories in the comments.` },
    { k: 'fan', tone: 'good', t: c => `Thanks for everything ${c.player}. Never let us down.` },
    { k: 'journo', tone: 'info', t: c => `${c.player} leaves for ${c.fee}. The manager said the decision was mutual.` },
    { k: 'pundit', tone: 'info', t: 'Selling from a position of strength is rare and sensible. Selling because you have to is neither.' },
    { k: 'club', tone: 'info', t: c => `Farewell and thank you, ${c.player}. Always welcome back. 💙` },
    { k: 'fan', tone: 'bad', t: 'We always do this. Get somebody good, sell somebody good.' },
    { k: 'stats', tone: 'info', t: c => `${c.player} out for ${c.fee}. Budget updated.` },
    { k: 'rival', tone: 'good', t: 'They have sold him. Their season just got worse and mine just got better.' },
    { k: 'fan', tone: 'info', t: 'Right fee, wrong time. That is football.' }
  ];
  MORE.injury = [
    { k: 'fantv', tone: 'bad', t: c => `${c.player} down again. I cannot watch this club's medical luck any more.` },
    { k: 'journo', tone: 'info', t: c => `${c.player} is expected to miss around ${c.games}. Not a long-term concern, but unhelpful timing.` },
    { k: 'fan', tone: 'info', t: 'Rest him properly. Do not rush him back for one game and lose him for six.' },
    { k: 'club', tone: 'info', t: c => `${c.player} is being assessed. We will update when we know more. 💙` },
    { k: 'pundit', tone: 'info', t: 'Every squad is one injury from a different season. This is theirs, this month.' },
    { k: 'stats', tone: 'info', t: c => `${c.player} joins the list. ${c.label}, roughly ${c.games} games.` },
    { k: 'fan', tone: 'bad', t: 'He looked fine walking off and that is somehow worse.' },
    { k: 'rival', tone: 'info', t: 'Genuinely hope he is alright. Football first, rivalry second.' },
    { k: 'fantv', tone: 'info', t: 'Injury update video tonight, and for once I will keep it calm.' }
  ];

  MORE.longInjury = [
    { k: 'fan', tone: 'bad', t: 'Absolutely heartbroken for him. He has worked so hard to get in that team.' },
    { k: 'journo', tone: 'bad', t: c => `A significant blow. ${c.player} will be out for months with ${c.label}.` },
    { k: 'club', tone: 'bad', t: c => `The whole club is behind you, ${c.player}. Take all the time you need. 💙` },
    { k: 'pundit', tone: 'bad', t: 'Losing him for that long changes what this side can realistically achieve.' },
    { k: 'fantv', tone: 'bad', t: 'Not making a video tonight. Just wishing him a proper recovery.' },
    { k: 'fan', tone: 'info', t: 'Somebody gets a chance now. That is the only good thing about it.' },
    { k: 'stats', tone: 'info', t: c => `${c.player}: ${c.games} games. One of the longest absences at this club in years.` },
    { k: 'rival', tone: 'info', t: 'Awful news. Nobody wants to see that regardless of colours.' }
  ];

  MORE.redCard = [
    { k: 'fan', tone: 'info', t: 'Two footed, off the ground, ninety minutes in. Nothing to argue about.' },
    { k: 'fantv', tone: 'bad', t: 'Doing the referee thread AND the discipline thread. Long night.' },
    { k: 'journo', tone: 'info', t: c => `${c.player} is dismissed. The manager did not defend him afterwards, which tells its own story.` },
    { k: 'stats', tone: 'info', t: c => `${c.player} sent off. Suspension follows.` },
    { k: 'pundit', tone: 'info', t: 'You cannot coach a player out of a moment like that. You can only pick somebody else.' },
    { k: 'fan', tone: 'bad', t: 'Selfish. Genuinely selfish. We had a chance in that game.' },
    { k: 'club', tone: 'info', t: 'Down to ten. The players kept going. 💙' }
  ];

  MORE.suspended = [
    { k: 'fan', tone: 'info', t: 'He has been walking a tightrope for a month. This was coming.' },
    { k: 'journo', tone: 'info', t: c => `${c.player} is unavailable — ${c.why}. A selection headache the manager did not need.` },
    { k: 'fantv', tone: 'bad', t: 'Of course. Of course it is this week.' },
    { k: 'pundit', tone: 'info', t: 'Managing bookings is unglamorous work and clubs lose points to it every season.' },
    { k: 'stats', tone: 'info', t: c => `${c.player} suspended. ${c.why}.` },
    { k: 'club', tone: 'info', t: c => `${c.player} serves a suspension. Somebody else steps up.` }
  ];

  MORE.streakGood = [
    { k: 'fan', tone: 'hot', t: 'I have started believing. I know better. I have started believing anyway.' },
    { k: 'journo', tone: 'good', t: c => `Five straight. ${c.clubName} have not done this in a very long time.` },
    { k: 'club', tone: 'good', t: 'Five in a row. 🔥 Keep it going.' },
    { k: 'pundit', tone: 'good', t: 'Runs are built on selection consistency. He has picked more or less the same side for a month.' },
    { k: 'fantv', tone: 'hot', t: 'WE CANNOT LOSE. Somebody check the fixture list, I need to know how far this goes.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName}: five wins on the bounce. Best run in the ${c.leagueName}.` },
    { k: 'rival', tone: 'bad', t: 'Somebody please beat them. Anybody. I am begging.' },
    { k: 'fan', tone: 'good', t: 'Started checking the fixtures for the run-in. This is how it begins.' }
  ];

  MORE.streakBad = [
    { k: 'fan', tone: 'bad', t: 'Cannot remember the last time we won. Genuinely cannot.' },
    { k: 'journo', tone: 'bad', t: "Five without a win. The manager's press conferences are getting noticeably shorter." },
    { k: 'club', tone: 'info', t: 'A tough run. We are working. Thank you for sticking with us.' },
    { k: 'pundit', tone: 'info', t: 'Confidence is the hardest thing to coach back. That is his whole job right now.' },
    { k: 'fantv', tone: 'bad', t: 'Five games. I have run out of angles. I have run out of jokes.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} have not won in five. Their worst sequence of the campaign.` },
    { k: 'fan', tone: 'info', t: 'Every club goes through this. Get behind them or stay home.' },
    { k: 'rival', tone: 'hot', t: 'Five! FIVE! I check their score first every single week now.' }
  ];

  MORE.topOfTable = [
    { k: 'fan', tone: 'hot', t: 'Top. Of. The. League. I am going to say it every day until it stops being true.' },
    { k: 'journo', tone: 'good', t: c => `${c.clubName} sit top. Their manager insists it means nothing yet. His face says otherwise.` },
    { k: 'club', tone: 'good', t: '📊 Nice place to be. Nothing won.' },
    { k: 'pundit', tone: 'info', t: 'Being top in autumn is fun. Being top in April is a different sport entirely.' },
    { k: 'fantv', tone: 'hot', t: 'Printed the table. Laminated the table. Put the table on my wall.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} lead the ${c.leagueName} with ${c.wins} wins from ${c.played}.` },
    { k: 'rival', tone: 'bad', t: 'Peaked. Absolutely peaked. Screenshot this.' },
    { k: 'fan', tone: 'info', t: 'Enjoying it and expecting nothing. That is the only way to survive being a fan.' }
  ];

  MORE.titleRace = [
    { k: 'fan', tone: 'hot', t: 'Cannot sleep. Cannot eat. Cannot look at the fixture list. Love it.' },
    { k: 'journo', tone: 'hot', t: c => `${c.clubName} are right in it. Every game from here is enormous.` },
    { k: 'pundit', tone: 'info', t: 'Squad depth decides title races and theirs is thinner than the sides around them.' },
    { k: 'fantv', tone: 'hot', t: 'Doing a run-in analysis. Spoiler: it is terrifying and I love it.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} sit ${c.posOrd}. On current form the run-in decides everything.` },
    { k: 'fan', tone: 'info', t: 'Not saying the word. Not typing the word. You all know the word.' },
    { k: 'club', tone: 'good', t: 'Every game from here. 👊 We need you loud.' }
  ];

  MORE.relegationFight = [
    { k: 'fantv', tone: 'bad', t: 'Made a spreadsheet of the run-in. Should not have made a spreadsheet of the run-in.' },
    { k: 'fan', tone: 'info', t: 'Been here before. We got out of it before. Get behind them.' },
    { k: 'journo', tone: 'bad', t: c => `A genuine fight at ${c.clubName}, and the manager knows exactly what is riding on it.` },
    { k: 'pundit', tone: 'info', t: 'They need to be harder to beat, not braver. It is not the time for principles.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName}: ${c.posOrd}, ${c.wins} wins. The maths is getting uncomfortable.` },
    { k: 'club', tone: 'info', t: 'We need every one of you for the last stretch. 💙' },
    { k: 'fan', tone: 'bad', t: 'Have supported this club through two relegations. Not doing a third quietly.' },
    { k: 'rival', tone: 'hot', t: 'Do not want them to go down. Want them to nearly go down, for months.' }
  ];

  MORE.sackWatch = [
    { k: 'fan', tone: 'info', t: 'Sacking him now, mid-season, with this squad, solves precisely nothing.' },
    { k: 'journo', tone: 'bad', t: c => `${c.clubName} have drawn up a shortlist. That is usually the last step.` },
    { k: 'fantv', tone: 'bad', t: 'I do not want him gone. I want him to be better. Those are different things.' },
    { k: 'pundit', tone: 'info', t: 'He has lost the results. Whether he has lost the dressing room is the only question that matters.' },
    { k: 'stats', tone: 'info', t: c => `Board confidence ${c.conf}. Position ${c.posOrd}. Target ${c.target}.` },
    { k: 'fan', tone: 'bad', t: 'Cannot defend it any more. I have tried for months.' },
    { k: 'club', tone: 'info', t: 'The manager retains the full support of the board.' },
    { k: 'rival', tone: 'good', t: 'Sign him up for another five years. He is doing brilliant work for us.' },
    { k: 'fan', tone: 'good', t: 'Sang his name for the whole second half. Whatever happens, he knows we tried.' }
  ];

  MORE.boardHappy = [
    { k: 'fan', tone: 'good', t: 'Back him. Back him properly. Give him the money and get out of the way.' },
    { k: 'journo', tone: 'good', t: c => `Talks over an extension at ${c.clubName} are described as positive and unhurried.` },
    { k: 'club', tone: 'good', t: 'Delighted with the direction of this football club. 📈' },
    { k: 'pundit', tone: 'good', t: 'Stability is undervalued. Every club that has it wins more than the ones that do not.' },
    { k: 'stats', tone: 'info', t: c => `Board confidence at ${c.clubName}: ${c.conf}/100.` },
    { k: 'fantv', tone: 'good', t: 'Never thought I would see this board and this manager agreeing on anything. Lovely.' }
  ];

  MORE.champions = [
    { k: 'fan', tone: 'hot', t: 'WE ARE CHAMPIONS. I have typed it forty times and it still does not feel real.' },
    { k: 'journo', tone: 'hot', t: c => `${c.clubName} are champions of the ${c.leagueName}. An extraordinary achievement by this manager.` },
    { k: 'club', tone: 'hot', t: '🏆 CHAMPIONS. Thank you, every single one of you. 💙' },
    { k: 'pundit', tone: 'good', t: 'They were the best side over a full season. Nobody serious will argue with it.' },
    { k: 'fantv', tone: 'hot', t: 'I started this channel in a bedroom. WE HAVE WON THE LEAGUE.' },
    { k: 'stats', tone: 'info', t: c => `Champions: ${c.clubName}. ${c.wins} wins in ${c.played} games.` },
    { k: 'fan', tone: 'hot', t: 'Bought a flag. Bought a scarf. Bought a hat. Cannot stop buying things.' },
    { k: 'rival', tone: 'bad', t: 'Deleting this app until August. See you all in a happier place.' },
    { k: 'fan', tone: 'hot', t: 'Never thought I would see it. Genuinely never thought I would see it.' },
    { k: 'club', tone: 'good', t: 'The trophy is coming home. 🚌 Details soon.' },
    { k: 'journo', tone: 'good', t: 'The manager cried on the pitch. He will hate that everybody saw it.' }
  ];

  MORE.seasonGood = [
    { k: 'fan', tone: 'good', t: c => `Finished ${c.posOrd}. Best season I have had in years. Roll on August.` },
    { k: 'journo', tone: 'good', t: c => `${c.posOrd} for ${c.clubName}. The manager has earned everything that comes next.` },
    { k: 'pundit', tone: 'good', t: 'A club punching above itself usually collapses. This one got better as the year went on.' },
    { k: 'fantv', tone: 'good', t: 'End of season awards video. Genuinely difficult to pick. What a problem to have.' },
    { k: 'club', tone: 'good', t: c => `${c.posOrd}. Thank you for every away end and every wet Tuesday. 💙` },
    { k: 'stats', tone: 'info', t: c => `Final: ${c.posOrd}, ${c.wins} wins from ${c.played}.` },
    { k: 'fan', tone: 'good', t: 'Renewed for next season within an hour of full time. No hesitation.' }
  ];

  MORE.seasonBad = [
    { k: 'fan', tone: 'bad', t: c => `${c.posOrd}. Not good enough for this club, whoever you blame.` },
    { k: 'journo', tone: 'bad', t: c => `A long summer of questions at ${c.clubName} after a ${c.posOrd} finish.` },
    { k: 'pundit', tone: 'info', t: 'Two things can be true: the squad is short, and the manager has not got the most out of it.' },
    { k: 'fantv', tone: 'bad', t: 'Season review. It is ninety minutes long and none of it is pleasant.' },
    { k: 'club', tone: 'info', t: 'We have fallen short. We know that. Work starts immediately.' },
    { k: 'fan', tone: 'info', t: 'Every summer we say it will be different. Maybe this time.' },
    { k: 'stats', tone: 'info', t: c => `${c.posOrd}, against a target of ${c.target}.` }
  ];
  MORE.linked = [
    { k: 'fan', tone: 'bad', t: 'Every time we get somebody good, somebody bigger comes calling. Every time.' },
    { k: 'journo', tone: 'hot', t: c => `${c.suitor} have identified ${c.clubName}'s manager as their leading candidate.` },
    { k: 'fantv', tone: 'bad', t: 'I am not doing a "will he stay" video. I refuse. (I am doing one tonight.)' },
    { k: 'pundit', tone: 'info', t: 'Every good manager gets linked with a bigger job. Losing him is not a scandal, it is a compliment.' },
    { k: 'club', tone: 'info', t: 'We will not be commenting on speculation.' },
    { k: 'fan', tone: 'info', t: 'If he goes, he goes with my thanks. He owes this club nothing.' },
    { k: 'rival', tone: 'good', t: c => `Fingers crossed for ${c.suitor}. Take him. Please.` },
    { k: 'stats', tone: 'info', t: c => `Reputation ${c.rep}, ${c.trophies} trophies. Of course somebody called.` },
    { k: 'fan', tone: 'bad', t: 'Do not read the rumours. Do not read the rumours. Reads all the rumours.' }
  ];

  MORE.leaving = [
    { k: 'fantv', tone: 'bad', t: 'He is gone and I do not know what to say. Genuinely lost for words.' },
    { k: 'fan', tone: 'good', t: 'Whatever happens next, he gave this club its self respect back. Thank you.' },
    { k: 'journo', tone: 'hot', t: c => `It is done. ${c.suitor} have their man. ${c.clubName} start again.` },
    { k: 'club', tone: 'info', t: c => `Everyone at ${c.clubName} thanks the manager and wishes him well. 💙` },
    { k: 'pundit', tone: 'info', t: 'Managers leave. The trick is having a plan for the day they do, and most clubs do not.' },
    { k: 'fan', tone: 'bad', t: 'Devastated is not a strong enough word. This club will feel different tomorrow.' },
    { k: 'rival', tone: 'hot', t: 'Losing their manager in the same week we signed a striker. Beautiful.' },
    { k: 'fan', tone: 'info', t: 'Not angry. Would have done the same. Still hurts.' },
    { k: 'stats', tone: 'info', t: c => `Departs after ${c.seasons} season${c.seasons === 1 ? '' : 's'} with ${c.trophies} trophies.` }
  ];

  MORE.arrived = [
    { k: 'fan', tone: 'info', t: 'Do not know much about him. Willing to find out.' },
    { k: 'journo', tone: 'info', t: c => `A three-year deal at ${c.clubName}. The board describe it as a long-term appointment.` },
    { k: 'fantv', tone: 'good', t: 'Watched eight of his games from his last job. Cautiously very excited.' },
    { k: 'club', tone: 'good', t: c => `The new era starts here. ✍️ #${c.tagName}` },
    { k: 'pundit', tone: 'info', t: 'He inherits a squad with more in it than the table suggests. That is a good place to start.' },
    { k: 'fan', tone: 'good', t: 'First press conference and he actually said something. Refreshing.' },
    { k: 'stats', tone: 'info', t: c => `New manager, ${c.trophies} career trophies, reputation ${c.rep}.` },
    { k: 'rival', tone: 'bad', t: 'They have appointed somebody competent. Hate it here.' },
    { k: 'fan', tone: 'info', t: 'Every new manager gets one season from me. Clock starts now.' },
    { k: 'fantv', tone: 'good', t: 'Doing a "what to expect" video. Mostly guessing, honestly.' }
  ];

  MORE.sacked = [
    { k: 'fan', tone: 'bad', t: 'Sacking managers is all this club knows how to do.' },
    { k: 'journo', tone: 'hot', t: c => `Confirmed. ${c.clubName} have dismissed their manager after ${c.seasons} season${c.seasons === 1 ? '' : 's'}.` },
    { k: 'pundit', tone: 'info', t: 'He was not helped. That will not be in the statement.' },
    { k: 'fantv', tone: 'info', t: 'Whatever you thought of him, he took it on the chin every single week. Good luck to him.' },
    { k: 'club', tone: 'info', t: 'We thank him for his service and wish him every success. An announcement on his successor will follow.' },
    { k: 'fan', tone: 'good', t: 'He did more with less than most would have. All the best.' },
    { k: 'stats', tone: 'info', t: c => `Out after ${c.seasons} season${c.seasons === 1 ? '' : 's'}, ${c.trophies} trophies, ${c.posOrd} at the end.` },
    { k: 'rival', tone: 'good', t: 'Another one bites the dust over there. Never changes.' }
  ];

  MORE.youth = [
    { k: 'club', tone: 'good', t: c => `From the academy to the first team. 🌱 ${c.kid}.` },
    { k: 'journo', tone: 'good', t: c => `${c.kid} is the latest to make the step at ${c.clubName}. The manager rates him very highly.` },
    { k: 'fan', tone: 'good', t: 'A local lad in the first team. That is what this club should be about.' },
    { k: 'pundit', tone: 'good', t: 'Giving a debut is easy. Giving a second start after a bad one is the real test.' },
    { k: 'fantv', tone: 'good', t: c => `Been watching ${c.kid} in the youth games for two years. He is ready. Trust me.` },
    { k: 'stats', tone: 'info', t: c => `${c.kid} promoted. ${c.clubName} continue to lean on the academy.` },
    { k: 'fan', tone: 'info', t: 'Do not build him up too fast. Let him have a bad game without it being a story.' }
  ];

  MORE.windowQuiet = [
    { k: 'fan', tone: 'bad', t: 'Eleven hours of deadline day for absolutely nothing.' },
    { k: 'journo', tone: 'info', t: c => `${c.clubName} did not add. The manager says he backs the group he has.` },
    { k: 'pundit', tone: 'info', t: 'Panic buying in the last hour is how clubs end up with three of the same player. Doing nothing is sometimes fine.' },
    { k: 'fantv', tone: 'bad', t: 'I sat in a car park with a camera for six hours. Never again. (See you in January.)' },
    { k: 'stats', tone: 'info', t: c => `${c.budget} unspent at ${c.clubName}.` },
    { k: 'fan', tone: 'info', t: 'Better no signing than the wrong signing. I have talked myself into it.' },
    { k: 'club', tone: 'info', t: 'The window is closed. Our focus is entirely on the next match.' }
  ];

  MORE.moneyTalk = [
    { k: 'fantv', tone: 'info', t: 'Doing the finances video. It is more boring and more important than you think.' },
    { k: 'fan', tone: 'bad', t: 'We have the money. We have the need. What we do not have is urgency.' },
    { k: 'journo', tone: 'info', t: c => `${c.clubName}'s wage structure is the real constraint, not the transfer budget.` },
    { k: 'pundit', tone: 'info', t: 'The clubs who spend well, not most, are the ones who move up. Every time.' },
    { k: 'stats', tone: 'info', t: c => `Available to spend at ${c.clubName}: ${c.budget}.` },
    { k: 'fan', tone: 'good', t: 'They have actually backed him. When did that start happening here?' },
    { k: 'club', tone: 'info', t: 'Funds are available. Recruitment decisions rest with the manager.' }
  ];

  MORE.milestone = [
    { k: 'fan', tone: 'good', t: 'Longest-serving manager we have had in years and it shows in everything.' },
    { k: 'journo', tone: 'info', t: c => `${c.seasons} seasons in charge at ${c.clubName}. In this era that is close to remarkable.` },
    { k: 'club', tone: 'good', t: c => `Thank you, boss. 👏 ${c.seasons} season${c.seasons === 1 ? '' : 's'} and counting.` },
    { k: 'pundit', tone: 'good', t: 'Time is the rarest thing in football. He has had it and he has repaid it.' },
    { k: 'fantv', tone: 'good', t: 'A full retrospective on his reign. Nostalgic, and I am not sorry.' },
    { k: 'stats', tone: 'info', t: c => `${c.trophies} trophies, reputation ${c.rep}, ${c.seasons} seasons.` }
  ];

  MORE.pressure = [
    { k: 'fan', tone: 'info', t: "Whatever you think, singing about a man's job in front of his family is not it." },
    { k: 'journo', tone: 'info', t: 'The manager looked drained today. He answered every question, which not all of them do.' },
    { k: 'fantv', tone: 'info', t: 'Reminder that there is a person in that dugout. Criticise the football.' },
    { k: 'pundit', tone: 'info', t: 'Managers do not sleep during runs like this. Whatever else is true, that is.' },
    { k: 'fan', tone: 'bad', t: 'Half the ground booing, half the ground singing his name. Horrible atmosphere.' },
    { k: 'club', tone: 'info', t: 'We would ask supporters to get behind the team on Saturday. 💙' },
    { k: 'fan', tone: 'good', t: 'Stood up and clapped him at full time. Somebody had to start it.' }
  ];

  MORE.rivalNews = [
    { k: 'fan', tone: 'good', t: c => `${c.rival} losing is a genuine mood improver and I make no apology.` },
    { k: 'fantv', tone: 'good', t: c => `Doing a schadenfreude special on ${c.rival}. Purely educational.` },
    { k: 'rival', tone: 'bad', t: c => `Do not @ me about ${c.clubName} today. Just do not.` },
    { k: 'journo', tone: 'info', t: c => `The mood around ${c.rival} is poor. Nobody at ${c.clubName} is losing sleep over it.` },
    { k: 'pundit', tone: 'info', t: 'The gap between these two has closed and it has closed on the training ground.' },
    { k: 'fan', tone: 'info', t: c => `Genuinely do not think about ${c.rival}. (Thinks about ${c.rival} constantly.)` },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} and ${c.rival}: the fixture everybody circles in July.` }
  ];
  /* ---- ambient, part one: the club, the ground, the week ---- */
  MORE.weekly = [
    { k: 'fan', tone: 'info', t: 'Turnstile queue was out to the main road again. Lovely problem to have.' },
    { k: 'fan', tone: 'good', t: 'New flag going up in the corner this week. Took four of us six weekends.' },
    { k: 'journo', tone: 'info', t: c => `${c.clubName} have added an analyst to the coaching staff. Quietly significant.` },
    { k: 'pundit', tone: 'info', t: c => `The thing about ${c.formation} is it only works if your two wide players are honest. Theirs are.` },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} average more passes in the final third than they did last season.` },
    { k: 'fantv', tone: 'info', t: 'Quiz night on the channel. Ten questions, all about the 90s, all unfair.' },
    { k: 'fan', tone: 'bad', t: 'Two hot dogs and a coffee cost more than my ticket did in 2004.' },
    { k: 'club', tone: 'info', t: 'Tickets for the next home game are on general sale from Thursday. 🎟️' },
    { k: 'fan', tone: 'good', t: c => `Saw the squad doing a session on the training pitches. ${c.star} stayed out an extra hour.` },
    { k: 'journo', tone: 'info', t: 'The manager has been watching a lot of the under-18s lately. Read into that what you like.' },
    { k: 'rival', tone: 'info', t: 'Their away support at our place was the loudest we have had all year. Credit.' },
    { k: 'pundit', tone: 'info', t: c => `Nobody at ${c.clubName} runs further than ${c.star2} and nobody outside the club has noticed.` },
    { k: 'fan', tone: 'info', t: 'My season ticket renewal came with a letter thanking me by name. Small thing.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} have conceded fewer from set pieces than at this point last year.` },
    { k: 'fantv', tone: 'good', t: 'Interviewed a bloke who has not missed a home game since 1987. Best thing I have filmed.' },
    { k: 'fan', tone: 'bad', t: 'Wifi in the ground is still a rumour. Still.' },
    { k: 'club', tone: 'good', t: 'Foodbank collection at the next home game. Please bring what you can. 💙' },
    { k: 'journo', tone: 'info', t: c => `A settled week at ${c.clubName}. Everyone available, nothing leaked, nobody arguing.` },
    { k: 'fan', tone: 'good', t: 'The players did a school visit this week. My nephew has not stopped talking about it.' },
    { k: 'pundit', tone: 'info', t: "He has changed the goalkeeper's distribution and the whole first phase looks different." },
    { k: 'stats', tone: 'info', t: c => `${c.topScorer} is involved in more goals than anyone else at ${c.clubName}.` },
    { k: 'fantv', tone: 'bad', t: 'Kick off moved again. Whoever schedules these has never taken a train.' },
    { k: 'fan', tone: 'info', t: 'Sat in a different seat by accident. Whole game felt wrong.' },
    { k: 'rival', tone: 'bad', t: 'Their fans singing about us when we are not even playing. Obsessed.' },
    { k: 'club', tone: 'info', t: 'Open training session on Wednesday. Bring the kids. 🧒' },
    { k: 'fan', tone: 'good', t: 'Watched the reserves on a Tuesday night. Twelve of us there. Loved it.' },
    { k: 'journo', tone: 'info', t: c => `Contract renewal at ${c.clubName} for one of the coaching staff. Continuity matters.` },
    { k: 'pundit', tone: 'info', t: 'Watch the near post at their corners. Somebody has clearly spent a week on that.' },
    { k: 'fan', tone: 'bad', t: 'Third away shirt in two years. They know exactly what they are doing.' },
    { k: 'stats', tone: 'info', t: c => `Attendances at ${c.clubName} are up on last season.` },
    { k: 'fantv', tone: 'info', t: "Long form video on the club's finances. Nobody will watch it. I made it anyway." },
    { k: 'fan', tone: 'good', t: 'Met three lads from the away end at a service station. Talked football for an hour.' },
    { k: 'club', tone: 'good', t: "Congratulations to our women's team on a brilliant result today. 👏" },
    { k: 'journo', tone: 'info', t: c => `${c.clubName} have been watching a midfielder in ${c.country}. Nothing imminent.` },
    { k: 'pundit', tone: 'info', t: 'They are better with the ball than they were and worse without it. That is a trade he has chosen.' },
    { k: 'fan', tone: 'info', t: 'Somebody brought a brass band to the away end. It was magnificent and awful.' },
    { k: 'rival', tone: 'info', t: 'Fair play to their ground staff. Pitch was immaculate.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} have used ${c.formation} more than any other shape this season.` },
    { k: 'fantv', tone: 'good', t: 'Doing a video on our best XI of the last decade. It will start arguments.' },
    { k: 'fan', tone: 'bad', t: 'Stewards moved me for standing up. In the standing section.' },
    { k: 'club', tone: 'info', t: 'Matchday programme is available online for the first time. 📱' },
    { k: 'journo', tone: 'info', t: 'Nothing to report from the training ground, which will suit the manager perfectly.' },
    { k: 'fan', tone: 'good', t: 'Twenty of us on a minibus. Broke down twice. Best day out of the year.' },
    { k: 'pundit', tone: 'info', t: 'He has quietly turned a weakness into a strength this season. Nobody has written about it.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} have the youngest average starting eleven they have fielded in years.` },
    { k: 'fantv', tone: 'info', t: 'Reacting to your reactions. It is very meta and I apologise.' },
    { k: 'fan', tone: 'info', t: 'Nobody warned me that supporting a football club is a lifelong subscription with no unsubscribe.' },
    { k: 'club', tone: 'good', t: 'Happy birthday to a club legend today. 🎂' },
    { k: 'rival', tone: 'bad', t: c => `Cannot go anywhere without hearing about ${c.clubName} at the minute.` },
    { k: 'journo', tone: 'info', t: 'The manager has asked for patience with one of the younger players. He rarely asks for anything.' },
    { k: 'fan', tone: 'good', t: "Chucked a fiver in the bucket for the youth team's trip. Worth every penny." },
    { k: 'pundit', tone: 'info', t: 'The best coaching in this league is happening at clubs nobody talks about.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} are creating more chances per game than at any point under this manager.` },
    { k: 'fantv', tone: 'bad', t: 'Somebody in the comments called me negative. I have been positive for four videos. FOUR.' },
    { k: 'fan', tone: 'info', t: 'Half time draw prize has been the same hamper for nine years.' },
    { k: 'club', tone: 'info', t: 'Away travel is now bookable through the app. 🚌' },
    { k: 'journo', tone: 'info', t: "A player's agent has been spotted near the training ground. Probably nothing. It is never nothing." },
    { k: 'fan', tone: 'good', t: 'The bloke who does the flags spent his own money again. Somebody buy him a pint.' },
    { k: 'pundit', tone: 'info', t: 'He substitutes early and often. Managers who do that are usually ahead of the game.' },
    { k: 'stats', tone: 'info', t: c => `Second half goals are up sharply at ${c.clubName} this season.` },
    { k: 'fantv', tone: 'good', t: 'Fan cam from the away end. Turn your sound down, honestly.' },
    { k: 'fan', tone: 'bad', t: 'Cashless ground. My dad has never used a card in his life.' },
    { k: 'rival', tone: 'info', t: 'Grudging respect for what they are doing over there. Grudging.' },
    { k: 'journo', tone: 'info', t: c => `A new sponsorship deal at ${c.clubName} will fund the academy for three years.` },
    { k: 'fan', tone: 'info', t: 'Arguing about the third choice keeper on a Wednesday. This is my life.' },
    { k: 'club', tone: 'good', t: 'Player of the Month voting is open. 🗳️' },
    { k: 'pundit', tone: 'info', t: c => `${c.style} is only sustainable if the squad is fit. Watch how he manages minutes from here.` },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} have made fewer substitutions before the hour than most in the division.` },
    { k: 'fantv', tone: 'info', t: 'Twenty questions with a first team player on Friday. He said yes! He actually said yes!' },
    { k: 'fan', tone: 'good', t: 'Whole away end sang for the last ten minutes losing 3-0. That is why.' },
    { k: 'journo', tone: 'info', t: 'The manager stayed after training to work with two players individually. It is a small thing and it matters.' },
    { k: 'fan', tone: 'bad', t: 'The tannoy still cuts out at the same corner. Eleven years.' },
    { k: 'pundit', tone: 'info', t: 'They rarely lose the second ball. That is the least glamorous strength in football and it wins games.' },
    { k: 'club', tone: 'info', t: 'Reminder: no re-entry once you have left the stadium. Sorry. 🙃' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} average more headers won than any side in the bottom half.`, when: c => c.pos > 8 },
    { k: 'fan', tone: 'info', t: 'A bloke sold me a badly printed scarf outside the ground. Wearing it forever.' },
    { k: 'fantv', tone: 'good', t: 'Best goals of the season so far. It is a longer video than I expected. Good sign.' },
    { k: 'rival', tone: 'bad', t: 'Their manager doing interviews like he has won something.', when: c => c.trophies === 0 },
    { k: 'journo', tone: 'info', t: 'A calm training ground and a settled team. Not dramatic, but it is how seasons get built.' },
    { k: 'fan', tone: 'good', t: 'My daughter has started asking about the fixtures. It has begun.' },
    { k: 'pundit', tone: 'info', t: 'The under-appreciated skill in management is knowing which arguments not to have.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} have kept the same back four for most of the season.` },
    { k: 'fan', tone: 'info', t: 'Everyone has an opinion on the shape. Nobody has an opinion on the pressing triggers.' },
    { k: 'club', tone: 'good', t: 'Shirt signing session at the club shop on Saturday. ✍️' },
    { k: 'fantv', tone: 'bad', t: 'Someone asked me to be more balanced. I have never been balanced in my life.' },
    { k: 'journo', tone: 'info', t: 'The manager was asked about his shape for the tenth time this month. He smiled and moved on.' },
    { k: 'fan', tone: 'good', t: 'Bloke in front of me explains every decision to his grandson. It is the best commentary in the ground.' },
    { k: 'pundit', tone: 'info', t: 'The gap between the best and worst run clubs in this league is enormous, and it is not about money.' },
    { k: 'stats', tone: 'info', t: c => `Fewest errors leading to shots in the ${c.leagueName}: ${c.clubName}.` },
    { k: 'fan', tone: 'bad', t: 'Pre-match music has been the same six songs since I was a teenager.' },
    { k: 'club', tone: 'info', t: 'Our supporters raised a huge amount for the local hospice this month. Thank you. 💙' },
    { k: 'rival', tone: 'info', t: 'Say what you want, their ground is a proper football ground.' },
    { k: 'fantv', tone: 'info', t: c => `Doing a video on why nobody talks about ${c.star2}. Spoiler: he is superb.` },
    { k: 'fan', tone: 'info', t: 'Missed the first goal queuing for a pie. Classic.' },
    { k: 'journo', tone: 'info', t: c => `${c.clubName} have turned down an approach for one of their coaching staff.` },
    { k: 'pundit', tone: 'info', t: 'Watch their throw-ins. Nothing is accidental with this manager.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} rank highly for distance covered. Fitness is not their problem.` },
    { k: 'fan', tone: 'good', t: 'The manager waved at the away end at the end of a nothing game. Noticed. Appreciated.' },
    { k: 'club', tone: 'info', t: 'Junior season tickets are frozen for another year. 🧒' },
    { k: 'fantv', tone: 'good', t: 'A hundred thousand of you now. From a bedroom. Thank you, genuinely.' },
    { k: 'fan', tone: 'info', t: 'Somebody in the pub called our manager "the professor". It has caught on.' },
    { k: 'journo', tone: 'info', t: c => `Recruitment at ${c.clubName} has become notably more focused since this manager arrived.` },
    { k: 'pundit', tone: 'info', t: 'They are one of very few sides in this division with a clear identity. That is worth points.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} have lost fewer points from winning positions than last season.` },
    { k: 'fan', tone: 'bad', t: 'Away end had no roof and it rained for ninety minutes. Character building.' },
    { k: 'fantv', tone: 'info', t: 'Mailbag: eleven of you asked about the same substitution. I will explain it slowly.' },
    { k: 'club', tone: 'good', t: 'Great to see so many of you at the open day. ☀️' },
    { k: 'fan', tone: 'good', t: 'Went alone for the first time in years. Ended up chatting to strangers all game.' },
    { k: 'rival', tone: 'bad', t: 'Every single one of their fans thinks they are an expert now.' },
    { k: 'journo', tone: 'info', t: c => `Two of ${c.clubName}'s coaching staff have been approached about jobs elsewhere. Both are staying.` },
    { k: 'pundit', tone: 'info', t: 'The way they defend the far post from wide free kicks is genuinely unusual. And effective.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName}: ${c.wins}W from ${c.played}. Currently ${c.posOrd}.` },
    { k: 'fan', tone: 'info', t: 'Nobody tells you that half of supporting a club is the journey home.' },
    { k: 'fantv', tone: 'good', t: 'Doing a groundhop series. First stop: the away end nobody likes.' },
    { k: 'club', tone: 'info', t: 'Please arrive early on Saturday. Bag checks are in operation. 🎒' },
    { k: 'fan', tone: 'good', t: 'Took my mum. She spent the whole game asking why nobody passes forward. She has a point.' },
    { k: 'journo', tone: 'info', t: c => `A quiet confidence around ${c.clubName} at the moment. Nobody wants to jinx it.` },
    { k: 'pundit', tone: 'info', t: 'Managers get judged on signings. They should be judged on what they do with the ones already there.' },
    { k: 'stats', tone: 'info', t: 'Only a handful of managers in this league have a better record over the last twenty games.' },
    { k: 'fan', tone: 'bad', t: 'Booked a train, they moved the game, refunded nothing. Standard.' },
    { k: 'fantv', tone: 'info', t: 'Predicting the run-in. I will be wrong. You will screenshot it. That is the deal.' },
    { k: 'fan', tone: 'good', t: 'Somebody started a new song this week and by the second half the whole end had it.' },
    { k: 'club', tone: 'good', t: 'Behind the scenes at the training ground, out now. 🎥' },
    { k: 'rival', tone: 'info', t: 'Genuinely good atmosphere at their place. Annoying to admit.' },
    { k: 'journo', tone: 'info', t: 'The manager has been reading about periodisation, apparently. Make of that what you will.' },
    { k: 'pundit', tone: 'info', t: 'Nobody has cracked how to press them since Christmas. That is a coaching win.' },
    { k: 'fan', tone: 'info', t: 'Have started watching other games just to compare. This is not healthy.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} are one of the least penalised sides in the ${c.leagueName}.` }
  ];
  /* ---- ambient, part two: tactics, media and the argument ---- */
  MORE.tacticsTalk = [
    { k: 'pundit', tone: 'info', t: c => `The ${c.formation} inverts the left back in possession. That is why the winger keeps getting isolated one-v-one.` },
    { k: 'pundit', tone: 'info', t: 'They defend the box better than they defend the space in front of it. Fixable, but it costs them.' },
    { k: 'fan', tone: 'info', t: 'Why do we always start the second half like we have been asleep for fifteen minutes.' },
    { k: 'fantv', tone: 'info', t: 'Whiteboard video tonight. I have drawn arrows. Many arrows.' },
    { k: 'pundit', tone: 'info', t: 'Their centre backs split wider than anyone in the league. It works until somebody presses properly.' },
    { k: 'fan', tone: 'bad', t: 'Playing out from the back is fine until it is not, and then it is really not.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} build through the left far more often than the right.` },
    { k: 'pundit', tone: 'good', t: 'The rest defence is excellent. Three men behind the ball at all times, without exception.' },
    { k: 'fan', tone: 'info', t: 'Every fan thinks they want more possession until they watch us have 70% and lose.' },
    { k: 'fantv', tone: 'info', t: 'Explaining the difference between a false nine and a bloke who wanders about. There is one. Sort of.' },
    { k: 'pundit', tone: 'info', t: 'He presses in a 4-2-4 and defends in a 4-4-2. It sounds fussy. It is not, it is the whole plan.' },
    { k: 'fan', tone: 'bad', t: 'We have no plan B and everyone in the ground can see it.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} take more shots from the left half-space than anywhere else.` },
    { k: 'pundit', tone: 'good', t: 'The way they counter-press for six seconds and then drop off is straight out of a coaching manual.' },
    { k: 'fan', tone: 'info', t: 'Somebody explain to me why we defend corners zonally. I will wait.' },
    { k: 'fantv', tone: 'good', t: 'The tactical video did numbers. You lot pretend not to care but you care.' },
    { k: 'pundit', tone: 'info', t: c => `${c.star} drops between the lines constantly and nobody has worked out how to mark him.` },
    { k: 'fan', tone: 'good', t: 'The overlaps are back. THE OVERLAPS ARE BACK.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} play more long passes after losing possession than most. Deliberate, that.` },
    { k: 'pundit', tone: 'bad', t: 'Two holding midfielders against a side with no striker is over-caution and it costs him.' },
    { k: 'fan', tone: 'info', t: 'Three at the back away from home. Bold. Terrifying. Possibly correct.' },
    { k: 'fantv', tone: 'info', t: 'Somebody asked what a low block is. Here is nine minutes about it.' },
    { k: 'pundit', tone: 'info', t: 'Their throw-in routine on the right is the most rehearsed thing in this division.' },
    { k: 'fan', tone: 'bad', t: 'Substitutions on 80 minutes when we are chasing a game. Every week.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} press higher than the league average and win the ball back sooner.` },
    { k: 'pundit', tone: 'good', t: 'He has taught a squad of ordinary players an extraordinary defensive habit. That is coaching.' },
    { k: 'fan', tone: 'info', t: 'The formation is not the problem. The gap between the midfield and the defence is the problem.' },
    { k: 'fantv', tone: 'info', t: 'Ranking every shape he has used. There have been more than you think.' },
    { k: 'pundit', tone: 'info', t: 'Nobody in this league man-marks any more. He does, occasionally, and it keeps working.' },
    { k: 'fan', tone: 'good', t: 'We finally have a midfielder who can turn. That is the entire upgrade.' }
  ];

  MORE.mediaTalk = [
    { k: 'fantv', tone: 'info', t: c => `On the radio tonight talking about ${c.clubName}. Be gentle with me.` },
    { k: 'journo', tone: 'info', t: c => `Long read on ${c.clubName}'s rebuild in the paper this weekend. Worth your time, obviously.` },
    { k: 'pundit', tone: 'info', t: 'Doing the co-comms on Saturday. Looking forward to watching this side properly.' },
    { k: 'fan', tone: 'bad', t: 'The national media have not mentioned us once in six weeks. Six weeks!' },
    { k: 'fantv', tone: 'bad', t: 'The pundits on the main show have clearly not watched a full game of ours all season.' },
    { k: 'journo', tone: 'info', t: 'The manager did a rare long interview this week. He talks about the game very well.' },
    { k: 'fan', tone: 'good', t: c => `The commentator pronounced ${c.star}'s name right. Somebody has done their homework.` },
    { k: 'pundit', tone: 'good', t: c => `${c.clubName} are the most watchable side in this league and almost nobody outside it knows.` },
    { k: 'fantv', tone: 'info', t: 'Podcast is out. Two hours. Mostly arguing about one substitution.' },
    { k: 'journo', tone: 'info', t: 'Press box was full for the first time this season. That tells you something.' },
    { k: 'fan', tone: 'bad', t: 'Highlights package gave us ninety seconds. NINETY SECONDS.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} are among the most-searched clubs in the ${c.leagueName} this month.` },
    { k: 'fantv', tone: 'good', t: 'Somebody clipped my reaction and it has gone everywhere. My mum has seen it.' },
    { k: 'pundit', tone: 'info', t: 'I said in August they would struggle. I was wrong and I will say so on air.' },
    { k: 'journo', tone: 'info', t: 'An interesting line from the manager today about how he judges a performance. Not about the result.' },
    { k: 'fan', tone: 'info', t: 'Watched the game on a dodgy stream in a different language. Understood every word.' },
    { k: 'fantv', tone: 'info', t: 'Doing a live Q and A after the next game. Win or lose. Brave, possibly stupid.' },
    { k: 'pundit', tone: 'bad', t: 'Too much analysis is just describing what happened with a straight face. Guilty as charged.' },
    { k: 'journo', tone: 'info', t: 'The manager has stopped reading the coverage. Sensible man.' },
    { k: 'fan', tone: 'good', t: "The club's own media team have got much better. Somebody deserves a raise." }
  ];

  MORE.history = [
    { k: 'fan', tone: 'good', t: 'Twenty years ago today we were nowhere. Look at us now.' },
    { k: 'club', tone: 'good', t: 'On this day. 📅 One of the great nights at this football club.' },
    { k: 'fantv', tone: 'good', t: 'Rewatching an old cup run this week. The commentary alone is worth it.' },
    { k: 'fan', tone: 'info', t: 'My first game was a 4-0 defeat in the rain. Hooked immediately. No idea why.' },
    { k: 'journo', tone: 'info', t: c => `${c.clubName} mark an anniversary this week. Older supporters will need no reminding.` },
    { k: 'pundit', tone: 'info', t: 'This club has a habit of doing something remarkable roughly once a decade. They are about due.' },
    { k: 'fan', tone: 'good', t: 'Found my old programmes in the loft. Lost an entire afternoon.' },
    { k: 'club', tone: 'good', t: 'A club legend is at the ground this weekend. Come and say hello. 👋' },
    { k: 'fan', tone: 'info', t: 'My grandad had this seat. My dad had this seat. Now it is mine.' },
    { k: 'fantv', tone: 'good', t: 'Interviewed a former player. He remembers every single detail. Incredible.' },
    { k: 'fan', tone: 'bad', t: 'We used to be a big club. Some of you are too young to remember and it shows.' },
    { k: 'journo', tone: 'info', t: 'The old stand comes down in the summer. A lot of people have feelings about that.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} have played in this division longer than most of their current rivals.` },
    { k: 'fan', tone: 'good', t: 'Showed my son a video of the old ground. He asked why it looked so brown.' },
    { k: 'club', tone: 'good', t: 'Remembering one of our own today. Always in our thoughts. 💙' }
  ];

  MORE.awayDays = [
    { k: 'fan', tone: 'good', t: 'Five in the morning, service station coffee, three hundred miles. See you there.' },
    { k: 'fan', tone: 'bad', t: 'Rail replacement bus. Rail replacement bus! For a Tuesday night game!' },
    { k: 'fantv', tone: 'good', t: 'Away day vlog going up. Includes a pie review. It scored badly.' },
    { k: 'fan', tone: 'good', t: 'The away end sold out in nine minutes. This club deserves better than it usually gets.' },
    { k: 'club', tone: 'info', t: 'Away ticket details for the next round are now on the website. 🎟️' },
    { k: 'fan', tone: 'info', t: 'Got there early, walked round the town, had a pint with the locals. Best part of the day.' },
    { k: 'rival', tone: 'info', t: 'Their fans were sound in our pub. Genuinely good lot.' },
    { k: 'fan', tone: 'bad', t: 'Kept in the ground for forty minutes after full time. For what?' },
    { k: 'fantv', tone: 'good', t: 'Filming the coach on the way back. If we win it will be unusable. Hopefully unusable.' },
    { k: 'fan', tone: 'good', t: 'Two hundred of us and we out-sang the whole of their ground.' },
    { k: 'journo', tone: 'info', t: c => `${c.clubName} sell out their away allocation again. One of the best travelling supports around.` },
    { k: 'fan', tone: 'info', t: 'Cheaper to fly than take the train. Something has gone wrong somewhere.' },
    { k: 'fan', tone: 'good', t: 'The lad who does the drum has never missed one. Absolute machine.' },
    { k: 'club', tone: 'good', t: c => `Thank you to the ${c.tagName} away support today. Heard you all game. 💙` },
    { k: 'fan', tone: 'bad', t: 'Away end had one working toilet. I will say no more.' }
  ];

  MORE.refs = [
    { k: 'fan', tone: 'bad', t: 'Nothing against the officials personally. Everything against that decision.' },
    { k: 'fantv', tone: 'bad', t: 'Doing the refereeing thread. It is going to be long and it is going to be measured. Ish.' },
    { k: 'pundit', tone: 'info', t: 'You cannot blame a referee for a result. You can absolutely question consistency.' },
    { k: 'fan', tone: 'bad', t: 'Same referee, same problems, every single time.' },
    { k: 'journo', tone: 'info', t: 'The manager declined to discuss the officiating, which is more restraint than most would manage.' },
    { k: 'fan', tone: 'info', t: 'Honestly, watched it back and the referee got it right. Hate saying it.' },
    { k: 'rival', tone: 'good', t: 'Their fans blaming the ref again. Never their fault, is it.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} have had a broadly average number of decisions go their way this season.` },
    { k: 'fan', tone: 'bad', t: 'Six minutes added on. Six! There were no substitutions!' },
    { k: 'pundit', tone: 'info', t: 'Officials get more right than we admit and less credit than they deserve. Both things are true.' }
  ];

  MORE.squadTalk = [
    { k: 'fan', tone: 'info', t: 'We need a left back. We have needed a left back since I was at school.' },
    { k: 'pundit', tone: 'info', t: 'The squad is short in one position and stacked in another. Somebody will leave in the summer.' },
    { k: 'fantv', tone: 'info', t: 'Ranking the squad one to twenty five. Half of you will be furious.' },
    { k: 'fan', tone: 'good', t: c => `${c.star2} has been the signing of the season and nobody talks about him.` },
    { k: 'journo', tone: 'info', t: c => `Two players at ${c.clubName} are into the final year of their contracts. Decisions coming.` },
    { k: 'stats', tone: 'info', t: c => `${c.star} has played the most minutes of anyone in this squad.` },
    { k: 'fan', tone: 'bad', t: 'Playing him out of position for a fourth week running. Somebody say something.' },
    { k: 'pundit', tone: 'good', t: 'The bench is stronger than it was and that is why they are finishing games better.' },
    { k: 'fantv', tone: 'bad', t: 'We have four players who do the same job and none who do the one we need.' },
    { k: 'fan', tone: 'good', t: c => `Whoever scouted ${c.topScorer} deserves a bonus and a holiday.` },
    { k: 'journo', tone: 'info', t: 'The manager has been working with the goalkeepers personally. Unusual, and telling.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} have handed out more debuts than most sides in this division.` },
    { k: 'fan', tone: 'info', t: c => `Every squad has one player everybody argues about. Ours is currently ${c.star2}.` },
    { k: 'pundit', tone: 'info', t: 'Depth is not about quantity. It is about having a second option who plays the same way.' },
    { k: 'fantv', tone: 'good', t: 'Doing a video on the most improved player this season. Not who you think.' }
  ];

  MORE.congestion = [
    { k: 'pundit', tone: 'info', t: 'Three games in eight days. This is where squads get found out.' },
    { k: 'fan', tone: 'bad', t: 'Whoever wrote this fixture list has never watched a game of football.' },
    { k: 'journo', tone: 'info', t: c => `A brutal run of fixtures for ${c.clubName}. The manager will have to rotate whether he likes it or not.` },
    { k: 'fantv', tone: 'info', t: 'Fixture pile-up special. Who plays, who rests, who breaks.' },
    { k: 'fan', tone: 'info', t: 'Do not moan about the fixtures. We are in the cups. That is the point of being good.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} face one of the busiest schedules in the division this month.` },
    { k: 'pundit', tone: 'good', t: 'He has been resting people for weeks, which looked cautious then and looks clever now.' },
    { k: 'club', tone: 'info', t: 'Busy few weeks ahead. We are going to need you. 💙' }
  ];
  MORE.fanCulture = [
    { k: 'fan', tone: 'good', t: c => `New chant for ${c.star} doing the rounds. It is filthy and I love it.` },
    { k: 'fan', tone: 'good', t: 'The whole ground did the flags thing before kick off. Goosebumps every time.' },
    { k: 'fantv', tone: 'good', t: 'Somebody in the away end had a homemade banner about the manager. Framed it in the video.' },
    { k: 'fan', tone: 'info', t: 'Argued with a stranger about a substitution for twenty minutes. We hugged at full time.' },
    { k: 'club', tone: 'good', t: 'Look at that away end. 📸 Every single week. 💙' },
    { k: 'fan', tone: 'good', t: 'Ninety minutes of singing and I have work in the morning. Worth it.' },
    { k: 'fan', tone: 'bad', t: 'Half the ground on their phones during the game. What are you all doing.' },
    { k: 'rival', tone: 'info', t: 'Their fans have one good song and they will not stop playing it.' },
    { k: 'fan', tone: 'good', t: 'Bloke behind me has shouted the same thing at the same minute for six years.' },
    { k: 'fantv', tone: 'good', t: 'Best chants of the season, ranked. Number one is not printable.' },
    { k: 'fan', tone: 'good', t: 'My mate proposed at half time on the big screen. She said yes. Ground went mad.' },
    { k: 'club', tone: 'good', t: 'That noise in the second half. Thank you. 🔊' },
    { k: 'fan', tone: 'info', t: 'Somebody brought a full brass section. Nobody asked. Everybody loved it.' },
    { k: 'fan', tone: 'good', t: "The minute's applause was perfect. Whole ground, no messing about." },
    { k: 'fantv', tone: 'info', t: 'Fan survey results. Ninety percent of you want the standing section back.' },
    { k: 'fan', tone: 'bad', t: 'Whoever keeps starting songs in the eightieth minute of a 3-0 defeat, thank you.' },
    { k: 'fan', tone: 'good', t: "Away end sang the manager's name for a full five minutes. He turned round and applauded." },
    { k: 'club', tone: 'good', t: "Supporters' club coach is full again. See you all on the road. 🚌" },
    { k: 'fan', tone: 'info', t: 'Every club has a bloke who knows the reserve team squad numbers. Ours is called Dave.' },
    { k: 'fan', tone: 'good', t: 'Watching a game with your dad never gets old, even when it is dreadful.' },
    { k: 'fantv', tone: 'good', t: 'You sent in your worst away day stories. Some of these are war crimes.' },
    { k: 'rival', tone: 'bad', t: 'Their away support is genuinely excellent, which annoys me enormously.' },
    { k: 'fan', tone: 'good', t: 'First time back after being ill for months. Cried a bit at kick off. Not sorry.' },
    { k: 'fan', tone: 'info', t: 'The tea bar lady knows my order. That is thirty years of my life explained.' },
    { k: 'club', tone: 'good', t: 'Fan of the month: for twenty years of never missing a home game. 🏅' }
  ];

  MORE.keeperTalk = [
    { k: 'fan', tone: 'good', t: 'Best keeper we have had in twenty years and I will not be arguing about it.' },
    { k: 'pundit', tone: 'good', t: 'His starting position is superb. Half the saves you never see because he is already there.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName}'s goalkeeper has one of the better save percentages in this division.` },
    { k: 'fantv', tone: 'good', t: 'Compilation of every save this season. It is longer than I wanted it to be.' },
    { k: 'fan', tone: 'bad', t: 'Every time he comes for a cross my heart stops.' },
    { k: 'journo', tone: 'info', t: c => `Goalkeeping coaching at ${c.clubName} has been quietly excellent for a few years now.` },
    { k: 'pundit', tone: 'info', t: 'Asking a keeper to play out of a press is a decision the whole team pays for or profits from.' },
    { k: 'fan', tone: 'good', t: 'He organises that back four like a sergeant major. You can hear him from the stands.' }
  ];

  MORE.defenceTalk = [
    { k: 'pundit', tone: 'good', t: 'The centre back pairing has been together long enough to stop talking. That is when it works.' },
    { k: 'fan', tone: 'good', t: 'Our back four have been magnificent and nobody outside this city has noticed.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} concede fewer big chances than most sides around them.` },
    { k: 'fan', tone: 'bad', t: 'Zonal marking at corners is going to kill me before I am fifty.' },
    { k: 'pundit', tone: 'info', t: 'Full backs decide modern football. Theirs are asked to do two jobs and mostly manage both.' },
    { k: 'fantv', tone: 'good', t: 'Doing a video on how good our defending has been. Nobody will watch it. It is the best one.' },
    { k: 'fan', tone: 'good', t: 'A last-ditch block is worth as much as a goal and gets a fraction of the noise.' },
    { k: 'journo', tone: 'info', t: c => `The defensive improvement at ${c.clubName} is the single biggest change under this manager.` }
  ];

  MORE.strikerTalk = [
    { k: 'fan', tone: 'good', t: c => `${c.topScorer} has ${c.topGoals} and half of them have been from nothing.`, when: c => c.topGoals >= 5 },
    { k: 'pundit', tone: 'good', t: 'The movement before the finish is the skill. The finish is just the last bit.' },
    { k: 'stats', tone: 'info', t: c => `${c.topScorer} leads the scoring at ${c.clubName} with ${c.topGoals}.`, when: c => c.topGoals > 0 },
    { k: 'fantv', tone: 'good', t: c => `Every goal ${c.topScorer} has scored this season, in order. Enjoy.`, when: c => c.topGoals >= 4 },
    { k: 'fan', tone: 'bad', t: 'We create enough. We just do not finish enough. Same story every year.' },
    { k: 'pundit', tone: 'info', t: 'A striker who presses properly is worth two who do not. He has one of those.' },
    { k: 'fan', tone: 'good', t: "He missed three and scored the fourth. That is a striker's brain right there." },
    { k: 'journo', tone: 'info', t: c => `Scouts have been watching ${c.topScorer}. That will be a difficult summer.`, when: c => c.topGoals >= 8 }
  ];

  MORE.weekly2 = [
    { k: 'fan', tone: 'info', t: 'Genuinely cannot tell if we are good or if the league is bad.' },
    { k: 'fantv', tone: 'good', t: 'Doing a video on why this is the most enjoyable season in years.' },
    { k: 'journo', tone: 'info', t: c => `A lot of clubs are watching how ${c.clubName} recruit. That is new.` },
    { k: 'pundit', tone: 'info', t: 'They have found a way of playing that does not depend on one player. That is rare.' },
    { k: 'fan', tone: 'good', t: 'Feels like a proper football club again. That is the best thing I can say.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} have improved their points total at this stage compared with last season.` },
    { k: 'club', tone: 'info', t: 'Squad news ahead of the weekend will be released on Friday. 📋' },
    { k: 'fan', tone: 'bad', t: 'Every good run we have is followed by a shocker. Watch this space.' },
    { k: 'rival', tone: 'bad', t: c => `Sick of hearing about ${c.clubName} and their "identity".` },
    { k: 'fantv', tone: 'info', t: 'Live stream before the game. Bring your questions and your low expectations.' },
    { k: 'journo', tone: 'info', t: c => `${c.clubName}'s manager was asked about the table. He said he had not looked. Nobody believed him.` },
    { k: 'fan', tone: 'good', t: 'Bought my first shirt in ten years. The kit is good and the team is worth it.' },
    { k: 'pundit', tone: 'info', t: 'Watch what they do in the last ten minutes of a lead. Very grown up.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} have taken points off five different sides above them at some stage.`, when: c => c.pos >= 4 },
    { k: 'fan', tone: 'info', t: 'Two blokes behind me spent the whole game debating the offside rule. Neither was right.' },
    { k: 'club', tone: 'good', t: 'Our academy sides had a great weekend. 🌱' },
    { k: 'fantv', tone: 'bad', t: 'Somebody told me to stop swearing on the channel. Absolutely not.' },
    { k: 'journo', tone: 'info', t: c => `A number of clubs have enquired about ${c.clubName}'s head of recruitment. He is staying.` },
    { k: 'fan', tone: 'good', t: "The manager did a Q and A with the supporters' club. Answered everything. Class." },
    { k: 'pundit', tone: 'info', t: 'Every good season has a boring month in the middle. This is theirs, and they are getting through it.' },
    { k: 'fan', tone: 'bad', t: 'Ticket office phone line has been engaged since Tuesday.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} have scored in most of their games this season.` },
    { k: 'club', tone: 'info', t: 'Kit launch next month. We think you are going to like it. 👕' },
    { k: 'fantv', tone: 'good', t: 'Twenty thousand of you watched the last one. Genuinely humbled. Back to shouting.' },
    { k: 'fan', tone: 'info', t: 'The thing nobody tells you is that the worse it gets, the more you go.' },
    { k: 'journo', tone: 'info', t: c => `${c.clubName} have been linked with a striker. They have been linked with a striker every year since 1998.` },
    { k: 'pundit', tone: 'good', t: 'The most impressive thing is that the young players look coached, not just picked.' },
    { k: 'fan', tone: 'good', t: 'Somebody left a scarf on the gates for a supporter who passed away. Whole club noticed.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName}'s squad has the fewest changes in the starting eleven of any side in the top half.`, when: c => c.pos <= 10 },
    { k: 'club', tone: 'good', t: "Thank you to everyone who came to the fans' forum. Honest questions, honest answers. 💙" },
    { k: 'fan', tone: 'bad', t: 'The pre-match interview is the same six questions every single week.' },
    { k: 'fantv', tone: 'info', t: 'Doing a video on the best games at this ground. Send me your memories.' },
    { k: 'journo', tone: 'info', t: 'The manager has been quietly praised by his opposite numbers all season. That says a lot.' },
    { k: 'pundit', tone: 'info', t: 'If you want to know how a manager is doing, look at the players who are not playing. Theirs still run.' },
    { k: 'fan', tone: 'good', t: 'Standing at the back with a pint in a plastic cup. Nothing better.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} have won more second halves than first halves this season.` },
    { k: 'club', tone: 'info', t: "Wednesday's game will be streamed for overseas supporters. 🌍" },
    { k: 'rival', tone: 'info', t: 'Their manager gave us credit after we beat them. Classy, that.' },
    { k: 'fan', tone: 'info', t: 'Nothing in my life is as reliable as being disappointed and going back anyway.' },
    { k: 'fantv', tone: 'good', t: 'Made a video about why I started supporting this club. Got a bit emotional. Sorry.' },
    { k: 'journo', tone: 'info', t: 'A club that was a mess three years ago now looks like it knows what it is doing.' },
    { k: 'pundit', tone: 'info', t: 'He does not chase games. That frustrates supporters and wins points. Both are true.' },
    { k: 'fan', tone: 'good', t: 'The ground under floodlights on a cold night. That is the whole sport, that.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} have the same number of points as at this stage in their best recent season.` },
    { k: 'club', tone: 'good', t: 'Matchday mascots for Saturday have been picked. 🧒⚽' },
    { k: 'fan', tone: 'bad', t: 'Programme is six quid now. Six!' },
    { k: 'fantv', tone: 'info', t: 'Doing a video on the fixture list. It is the most watched thing I make and I do not know why.' },
    { k: 'journo', tone: 'info', t: c => `A new medical department structure at ${c.clubName}. Boring, expensive, probably very smart.` },
    { k: 'pundit', tone: 'good', t: 'The pressing triggers are clear and every player knows them. Six months ago that was not true.' },
    { k: 'fan', tone: 'info', t: 'Sat next to the same bloke for eleven years. Do not know his name. Know his opinions on everything.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} have conceded first fewer times than most in the ${c.leagueName}.` },
    { k: 'club', tone: 'info', t: 'Supporters with accessibility needs can now book direct. Details on the site. ♿' },
    { k: 'fan', tone: 'good', t: 'Whole family going on Saturday. Three generations. That is what it is for.' },
    { k: 'rival', tone: 'bad', t: 'Cannot wait for them to have a bad month so it goes quiet again.' },
    { k: 'fantv', tone: 'good', t: 'Been doing this ten years. This is the most fun I have had making videos.' },
    { k: 'journo', tone: 'info', t: 'A settled squad, a settled manager and a settled board. At this club that is almost unheard of.' },
    { k: 'pundit', tone: 'info', t: 'Their weakness is obvious and nobody has exploited it properly yet. Somebody will.' },
    { k: 'fan', tone: 'info', t: 'Football is the only thing I have argued about weekly for thirty years and never resolved.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} are outperforming their expected points total.` },
    { k: 'club', tone: 'good', t: 'Full house on Saturday. Thank you. 🎫' },
    { k: 'fan', tone: 'good', t: 'Somebody handed my lad a matchball at the end. He has slept with it since.' }
  ];
  /* ---- more of what the timeline says back ---- */
  const MORE_REPLIES = {
    hype: [
      'best manager in this division and it is not close', 'the man is building something',
      'we are watching a proper coach at work', 'never doubted him. lying. doubted him loads. sorry.',
      'nine months ago we were a shambles. look at us.', 'sign him until he retires',
      'he has made me care again and I did not think that was possible',
      'every substitution works. EVERY ONE.', 'this is the best we have played in my lifetime',
      'whatever they are paying him, double it', 'the shape is beautiful and I will not be told otherwise',
      'genuinely emotional about a football team again', 'he has fixed things I did not know were broken'
    ],
    doubt: [
      'lovely stuff, now do it in February', 'we have been here before and it ended badly',
      'the underlying numbers do not back this up', 'small sample size, calm down',
      'wake me when we beat somebody good', 'still cannot defend a set piece',
      'one injury away from all of this collapsing', 'good manager, wrong club, wrong time',
      'I want to believe and I have been hurt before', 'this squad flatters him more than he flatters it',
      'ask me again when the fixtures get hard'
    ],
    banter: [
      'nobody outside your city has heard of you', 'a nice little club with a nice little manager',
      'quote tweeting this in April', 'you have peaked and you know it',
      'still cannot fill your ground though', 'imagine being this excited about mid-table',
      'we have more trophies in the toilets', 'enjoy the view, it is a long way down',
      'your best player would be our third choice', 'the noise from that lot is unbearable'
    ],
    stat: [
      'their expected goals against has halved since he arrived', 'best defensive record in the division since December',
      'nobody wins the ball back higher up the pitch', 'the squad cost half of what the sides above it cost',
      'more clean sheets than anyone in the bottom half', 'their set piece conversion is the best in the league',
      'points per game under this manager is the highest in twenty years',
      'they have overperformed expected points for four months straight',
      'youngest average age in the top half and it is not close'
    ],
    tactic: [
      'the answer is a proper number ten and everybody can see it', 'push the full backs and this team is unplayable',
      'stop asking the striker to press alone', 'we need one more body in midfield away from home',
      'the low block is fine. the transition out of it is not.',
      'switch to a back three against the big sides and watch what happens',
      'his in-game changes are the most underrated thing about him',
      'somebody explain the throw-in routine to the right back'
    ],
    joke: [
      'my therapist has heard more about this club than my family have', 'named the dog after him. no regrets.',
      'I have a spreadsheet and it is getting worse', 'told work I had a funeral. spiritually true.',
      'watched it back at 0.25 speed like a lunatic', 'my group chat has 400 unread and it is all about one corner',
      'the wife has banned football talk at dinner. we now eat separately.',
      'set it as my alarm sound. wake up furious every day.',
      'bought a scarf for a game I watched at home', 'checked the table again. still there. checked again.'
    ],
    cope: [
      'we go again', 'onwards. always onwards.', 'not the end of the world, just feels like it',
      'right. Saturday. reset.', 'been through worse. much worse.', 'deleting this app for a week. see you in three hours.',
      'nobody died. it just feels like somebody did.', 'football owes us nothing and we keep lending it more'
    ],
    wholesome: [
      'my dad rang me at full time. we did not say much. did not need to.',
      'took a mate who has been struggling. best I have seen him in months.',
      'the players clapped the disabled section separately. noticed that.',
      'somebody gave my son their seat so he could see. total stranger.',
      'this club has been the one constant in a very strange few years',
      'the away end stayed behind and sang. no idea why. best thing all year.'
    ],
    hope: [
      'we are closer than the table says', 'one more window and this is a very good side',
      'the kids coming through are the real story', 'first time in ages I am looking forward to next season',
      'give him three years and see where we are', 'we have a plan. do you know how long it has been since we had a plan?'
    ],
    anger: [
      'this has been coming for months and nobody did anything', 'we deserve better than this and we always have',
      'somebody upstairs has to answer for it', 'I have spent thousands on this club. thousands.',
      'the same mistakes every single week is a coaching problem', 'no urgency, no fight, no plan. pick one.',
      'stop telling me it is a rebuild. it has been a rebuild for six years.'
    ]
  };

  /* ---- more you can say ---- */
  const MORE_YOU = {
    calm: [
      c => `Same standards, same preparation, same week as any other. That is how we do it here.`,
      c => `We will not be talking about anybody else's season. Only ours.`,
      c => `The table in September tells you nothing. Ask me in May.`,
      c => `Good week on the grass. That is all I have got for you.`,
      c => `Nobody at this club is getting ahead of themselves. Nobody.`,
      c => `The players deserve the credit. I just pick them.`,
      c => `Same eleven, same idea, next opponent. Simple.`,
      c => `Whatever is written this week does not reach the training ground.`
    ],
    fire: [
      c => `We are not here to make up the numbers at ${c.clubName}. Never have been.`,
      c => `Everyone had an opinion in August. Have another look at the table.`,
      c => `Come to our place and try it. That is the invitation.`,
      c => `I will back this group of players against anybody in this division.`,
      c => `The noise does not bother us. It fuels us. Keep it coming.`,
      c => `We are not finished. Not remotely finished.`,
      c => `Anybody who thinks this is a good time to play us has not been paying attention.`
    ],
    honest: [
      c => `We got what we deserved today, which was nothing.`,
      c => `I have to be better. The players took the blame out there and it was not theirs.`,
      c => `I owe those supporters a performance and they have not had one for a month.`,
      c => `We are not good enough at the moment. Saying anything else would be an insult.`,
      c => `Everything about that was my responsibility. The shape, the selection, all of it.`,
      c => `There is no spin to put on it. We were poor and we know it.`,
      c => `I will not talk about anything other than how bad that was.`
    ],
    praise: [
      c => `${c.topScorer} deserves everything he is getting. He has earned every bit of it.`,
      c => `The lad has trained for two years for weeks like this. Delighted for him.`,
      c => `${c.star} did not have his best game and still made the difference. That is a player.`,
      c => `Everyone talks about the eleven. The eleven who did not play were superb this week too.`,
      c => `Our supporters were the difference in that second half. Genuinely.`,
      c => `The medical staff got three players back this week. Nobody writes about them.`,
      c => `${c.kid} has come into a team under pressure and looked like he belongs. Remarkable at his age.`,
      c => `I have coached a lot of groups. This one listens better than any of them.`
    ],
    defiant: [
      c => `I do not need anybody's permission to do this job my way.`,
      c => `The plan has not changed because two results went against us.`,
      c => `People who were not here two years ago do not get to tell me what this club is.`,
      c => `I sleep fine. Thank you for asking.`,
      c => `I answer to the board and to the supporters, in that order, and to nobody on the internet.`,
      c => `We will keep playing this way. If that costs me the job, so be it.`,
      c => `I have been doing this a long time. I know what I am building.`
    ]
  };

  /* Fold every addition into the banks it belongs to. Keeping the new lines
     in one block rather than scattered through the originals means the next
     person can see at a glance what was added and when. */
  const MORE2 = {};

  MORE2.matchdayEve = [
    { k: 'club', tone: 'info', t: 'Matchday tomorrow. 🕒 Gates open two hours before kick off.' },
    { k: 'fan', tone: 'good', t: 'Cannot sleep. Same every Friday. Thirty years of this.' },
    { k: 'fantv', tone: 'info', t: 'Preview video up. Predicted eleven inside. I will be wrong about two of them.' },
    { k: 'journo', tone: 'info', t: c => `${c.clubName} have a full squad available, which has not been true for a while.` },
    { k: 'pundit', tone: 'info', t: c => `The interesting question tomorrow is whether he sticks with the ${c.formation} or reacts.` },
    { k: 'fan', tone: 'info', t: 'Ironed the shirt. Checked the trains. Ready to be let down.' },
    { k: 'club', tone: 'good', t: c => `One more sleep. 💙 #${c.tagName}` },
    { k: 'rival', tone: 'info', t: 'Big one tomorrow. Nervous. Would not admit that anywhere else.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} go into the weekend ${c.posOrd} in the ${c.leagueName}.` },
    { k: 'fantv', tone: 'good', t: 'Doing a build-up stream tonight. Come and be nervous with me.' },
    { k: 'fan', tone: 'good', t: 'Told the family I am unavailable from noon. They have accepted it.' },
    { k: 'pundit', tone: 'info', t: "Watch the first fifteen minutes. This manager's sides tell you everything early." }
  ];

  MORE2.intBreak = [
    { k: 'fan', tone: 'bad', t: 'International break. Two weeks of nothing. I hate it here.' },
    { k: 'journo', tone: 'info', t: c => `A useful break for ${c.clubName} with a couple of players close to returning.` },
    { k: 'pundit', tone: 'info', t: 'Breaks help managers who coach and hurt managers who rely on momentum. He coaches.' },
    { k: 'fantv', tone: 'info', t: 'Doing filler content for a fortnight. Sorry in advance.' },
    { k: 'fan', tone: 'info', t: 'Watching third division football on a Tuesday because I have nothing else. No regrets.' },
    { k: 'club', tone: 'info', t: 'Several of our players are away on international duty. Good luck to all of them. 🌍' },
    { k: 'fan', tone: 'bad', t: 'Please come back fit. Please. That is all I ask.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} return to action after the break ${c.posOrd}.` },
    { k: 'pundit', tone: 'info', t: 'Two weeks on the training ground is worth more to this side than two more matches.' },
    { k: 'fantv', tone: 'good', t: 'Using the break to rewatch every goal this season. It is a nice way to spend a Sunday.' }
  ];

  MORE2.winter = [
    { k: 'fan', tone: 'good', t: 'Freezing, four nil down, still singing. This is the sport.' },
    { k: 'pundit', tone: 'info', t: 'Seasons are decided between November and February. This is the bit that counts.' },
    { k: 'fan', tone: 'bad', t: 'Cannot feel my hands. Cannot feel my feet. Would not be anywhere else.' },
    { k: 'club', tone: 'info', t: 'Wrap up warm tonight. It is going to be cold. 🧣' },
    { k: 'journo', tone: 'info', t: c => `A heavy pitch and a cold night. Not conditions for the football ${c.clubName} want to play.` },
    { k: 'fantv', tone: 'info', t: 'Filmed outside for eleven minutes and lost the use of my face.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} have a busy December. Squads get tested now.` },
    { k: 'fan', tone: 'good', t: 'Midweek, midwinter, half empty ground. Best atmosphere of the season somehow.' }
  ];

  MORE2.contractTalk = [
    { k: 'journo', tone: 'info', t: c => `Contract talks have opened with ${c.star}. Both sides are described as relaxed.` },
    { k: 'fan', tone: 'bad', t: 'Sign him up. Sign him up NOW. Do not do what we always do.' },
    { k: 'fantv', tone: 'bad', t: 'Every year we let one run down. Every single year.' },
    { k: 'pundit', tone: 'info', t: 'Contract management is where well-run clubs quietly make their money.' },
    { k: 'club', tone: 'good', t: c => `✍️ A new deal has been agreed. Delighted to keep him here. #${c.tagName}` },
    { k: 'fan', tone: 'good', t: 'Committed his future to us when he could have gone anywhere. That means something.' },
    { k: 'stats', tone: 'info', t: c => `Two senior players at ${c.clubName} are into the final year of their deals.` },
    { k: 'journo', tone: 'info', t: 'The manager has made keeping this squad together his stated priority.' },
    { k: 'fan', tone: 'info', t: 'Nobody is bigger than the club. Some of them are close, though.' }
  ];

  MORE2.contrarian = [
    { k: 'fan', tone: 'info', t: 'Unpopular opinion: we were better under the old manager. I said what I said.' },
    { k: 'pundit', tone: 'info', t: 'Everybody is very excited. I would wait for a harder run of fixtures before deciding anything.' },
    { k: 'fan', tone: 'bad', t: 'We are getting results in spite of the football, not because of it.' },
    { k: 'fantv', tone: 'info', t: "Playing devil's advocate tonight. The comments are going to be a nightmare." },
    { k: 'fan', tone: 'good', t: 'Everyone panicking after one defeat needs to have a word with themselves.' },
    { k: 'pundit', tone: 'info', t: 'The table flatters them. That is not an insult, it is just what the numbers say.' },
    { k: 'fan', tone: 'info', t: 'Half of you wanted him sacked in October. Say that out loud now.' },
    { k: 'rival', tone: 'info', t: 'Their manager is better than their squad. That is the whole story.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} are outperforming their underlying numbers. That usually corrects.` },
    { k: 'fan', tone: 'bad', t: 'We have been lucky. Nobody wants to hear it but we have been lucky.' }
  ];

  MORE2.debut = [
    { k: 'club', tone: 'good', t: c => `A first appearance for ${c.kid}. 🎉 One he will never forget.` },
    { k: 'fan', tone: 'good', t: 'His family were in the stand. Absolutely made up for him.' },
    { k: 'journo', tone: 'good', t: c => `A debut at ${c.clubName} tonight. The manager has never been shy about handing them out.` },
    { k: 'fantv', tone: 'good', t: 'Filmed the moment he came on and I have watched it back six times.' },
    { k: 'pundit', tone: 'info', t: 'Throwing a young player in with the game finely balanced takes some nerve.' },
    { k: 'fan', tone: 'good', t: 'Whole ground stood up for him. Lovely.' },
    { k: 'stats', tone: 'info', t: c => `Another debutant for ${c.clubName} this season.` }
  ];

  MORE2.comeback = [
    { k: 'fantv', tone: 'hot', t: 'WE WERE DEAD. WE WERE ABSOLUTELY DEAD. AND WE WON IT.' },
    { k: 'fan', tone: 'hot', t: 'I left. I actually left. I heard it from the car park.' },
    { k: 'journo', tone: 'good', t: c => `${c.clubName} were behind and looked it. Then they were not. Extraordinary.` },
    { k: 'pundit', tone: 'good', t: 'That is a side who believe in what they are doing, and belief comes from somewhere.' },
    { k: 'club', tone: 'hot', t: c => `FROM BEHIND. 😅 ${c.us}-${c.them}. What a way to win one.` },
    { k: 'fan', tone: 'hot', t: 'Hugged four strangers. Would do it again.' },
    { k: 'rival', tone: 'bad', t: 'How do you lose that from where we were. HOW.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} take the points after trailing. They have done it more than once now.` }
  ];

  MORE2.retirement = [
    { k: 'club', tone: 'info', t: 'A club servant hangs up his boots. Thank you for everything. 💙' },
    { k: 'fan', tone: 'good', t: 'Watched him for years. Never gave less than everything. All the best.' },
    { k: 'journo', tone: 'info', t: c => `A long career comes to an end at ${c.clubName}. The manager called him a model professional.` },
    { k: 'fantv', tone: 'good', t: 'Tribute video going up. Send me your favourite moment.' },
    { k: 'pundit', tone: 'info', t: 'Knowing when to stop is one of the hardest calls a player makes. He got it right.' },
    { k: 'fan', tone: 'info', t: 'Feels like the end of something. Because it is.' }
  ];

  MORE2.weekly = [
    { k: 'fan', tone: 'info', t: c => `We are ${c.posOrd} and I still check the table four times a day.` },
    { k: 'club', tone: 'info', t: 'Ticket prices frozen for a third season. 🎟️' },
    { k: 'journo', tone: 'info', t: c => `A rare quiet fortnight at ${c.clubName}. The manager will take that.` },
    { k: 'pundit', tone: 'info', t: 'The most interesting side in this league is not the one at the top.' },
    { k: 'fantv', tone: 'info', t: c => `Doing a video on what happens if we finish ${c.posOrd}. Spoiler: not much.` },
    { k: 'fan', tone: 'good', t: 'Bumped into two of the coaching staff in a cafe. Chatted for ten minutes. Sound blokes.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} have picked up points in most of their last ten.` },
    { k: 'fan', tone: 'bad', t: 'Cannot get a ticket for love nor money now we are decent. Typical.' },
    { k: 'club', tone: 'good', t: 'Community team delivered 400 meals this week. Proud of them. 💙' },
    { k: 'rival', tone: 'info', t: 'Would swap managers with them. There, I said it.' },
    { k: 'journo', tone: 'info', t: c => `${c.clubName} have added a set-piece coach. Small budgets, smart decisions.` },
    { k: 'pundit', tone: 'good', t: 'A club with a plan is worth watching whatever division it is in.' },
    { k: 'fan', tone: 'good', t: 'Nothing beats walking up to the ground and hearing the noise start.' },
    { k: 'fantv', tone: 'good', t: 'Ten years of doing this and this is the happiest the fanbase has been.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} have gone longer without a home defeat than most in this division.` },
    { k: 'fan', tone: 'info', t: 'Someone asked me why I bother. Could not answer. Still going Saturday.' }
  ];


  MORE2.topUp = [
    { k: 'fan', tone: 'info', t: 'Every season I promise myself I will be rational. It lasts until the first kick.' },
    { k: 'pundit', tone: 'info', t: 'The best managers make the same decision twice when it fails once. That is nerve, not stubbornness.' },
    { k: 'fantv', tone: 'good', t: 'Somebody asked for a calm video. Here is eleven minutes of me being calm. It was hard.' },
    { k: 'journo', tone: 'info', t: c => `${c.clubName} continue to do the unglamorous things well. It shows up in the table eventually.` },
    { k: 'club', tone: 'good', t: c => `See you Saturday. Bring the noise. 🔊 #${c.tagName}` },
    { k: 'stats', tone: 'info', t: c => `${c.clubName}: ${c.wins} wins, ${c.played} games, ${c.posOrd}. That is the season so far.` },
    { k: 'fan', tone: 'good', t: 'A club is just a lot of people agreeing to care about the same thing. Ours is a good one.' },
    { k: 'rival', tone: 'info', t: 'Hope they do well. In the cups. Only the cups.' },
    { k: 'fan', tone: 'bad', t: 'Twenty quid for a scarf. Bought two. I am the problem.' },
    { k: 'pundit', tone: 'info', t: 'Watch how his team defends a throw-in in their own third. That is a coached detail.' },
    { k: 'fantv', tone: 'info', t: 'Reading out the worst takes of the season. Some of them are mine.' },
    { k: 'journo', tone: 'info', t: 'The manager praised the groundstaff unprompted today. Nobody ever does that.' },
    { k: 'fan', tone: 'good', t: 'My lad asked if we could go again next week before we had left the car park.' },
    { k: 'club', tone: 'info', t: 'Full squad update on the site now. 📋' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} have taken more points from behind than most sides in the ${c.leagueName}.` },
    { k: 'fan', tone: 'info', t: 'Somebody has started bringing a trumpet. Jury is out. Leaning yes.' },
    { k: 'pundit', tone: 'good', t: 'They have become difficult to play against, which is the first thing every good side becomes.' },
    { k: 'fantv', tone: 'bad', t: 'Three people asked me to be positive this week. Three. I am trying.' },
    { k: 'fan', tone: 'good', t: 'Best thing about this season is that Saturdays matter again.' },
    { k: 'journo', tone: 'info', t: c => `A club at peace with itself, which at ${c.clubName} has not always been the case.` },
    { k: 'club', tone: 'good', t: 'Thank you for another sell-out. 🎫 💙' },
    { k: 'fan', tone: 'bad', t: 'Missed a goal because the bloke in front stood up to take a photo of the goal.' },
    { k: 'pundit', tone: 'info', t: 'Nobody remembers the boring 1-0s in November. Every promotion and every title is full of them.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} have used one of the smallest number of different lineups in the division.` },
    { k: 'fan', tone: 'good', t: 'Thirty years, one club, no regrets, several thousand pounds.' }
  ];

  Object.keys(MORE).forEach(k => { POSTS[k] = (POSTS[k] || []).concat(MORE[k]); });
  // the top-up joins the ambient bank rather than getting a trigger of its own
  MORE2.weekly = MORE2.weekly.concat(MORE2.topUp);
  delete MORE2.topUp;
  Object.keys(MORE2).forEach(k => { POSTS[k] = (POSTS[k] || []).concat(MORE2[k]); });
  Object.keys(MORE_REPLIES).forEach(k => {
    MGR_REPLIES[k] = (MGR_REPLIES[k] || []).concat(MORE_REPLIES[k]);
  });
  Object.keys(MORE_YOU).forEach(k => {
    YOU_POSTS[k] = (YOU_POSTS[k] || []).concat(MORE_YOU[k]);
  });
  const MORE3 = {};

  /* ---- the people in the squad, individually ---- */
  MORE3.captainTalk = [
    { k: 'fan', tone: 'good', t: c => `${c.star} dragged that team through the last twenty minutes on his own.` },
    { k: 'pundit', tone: 'good', t: 'A captain who talks all game is worth a yard to everybody around him.' },
    { k: 'journo', tone: 'info', t: c => `The armband at ${c.clubName} has settled. It took a while, and it matters.` },
    { k: 'fan', tone: 'good', t: 'He went to the away end on his own after the final whistle. Nobody asked him to.' },
    { k: 'fantv', tone: 'good', t: c => `Doing a video on what ${c.star} actually does when we do not have the ball. It is a lot.` },
    { k: 'stats', tone: 'info', t: c => `${c.star} has started more games than anyone in this squad.` },
    { k: 'fan', tone: 'bad', t: 'A captain should be dragging people up, not shouting at them for the cameras.' },
    { k: 'pundit', tone: 'info', t: 'The best captains are not always the loudest. Sometimes they are just first to every loose ball.' },
    { k: 'club', tone: 'good', t: c => `Leading from the front. 💙 ${c.star}.` },
    { k: 'fan', tone: 'good', t: 'Watched him spend ten minutes with the young lads after training. That is a captain.' }
  ];

  MORE3.veteran = [
    { k: 'fan', tone: 'good', t: 'He cannot run any more and he does not need to. He just knows where everything is going.' },
    { k: 'pundit', tone: 'good', t: 'Thirty-four and he has not been beaten in a foot race all season, because he never gets into one.' },
    { k: 'journo', tone: 'info', t: c => `The senior players at ${c.clubName} have been credited with holding the dressing room together.` },
    { k: 'fantv', tone: 'good', t: 'Everyone wanted him gone in the summer. Everyone was wrong. Me included.' },
    { k: 'fan', tone: 'info', t: 'Give him a coaching badge and a contract. He is already half a coach.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} have one of the more experienced spines in this division.` },
    { k: 'fan', tone: 'bad', t: 'Playing a thirty-five-year-old twice a week in November is not a plan.' },
    { k: 'pundit', tone: 'info', t: 'Experience is only worth something if the young players are listening. Here, they are.' }
  ];

  MORE3.benchWarmer = [
    { k: 'fan', tone: 'bad', t: 'He has not started since August. Either play him or let him go somewhere he will play.' },
    { k: 'journo', tone: 'info', t: c => `Two players at ${c.clubName} are understood to be unhappy with their minutes.` },
    { k: 'pundit', tone: 'info', t: 'Every squad has four players who think they should be starting. The trick is keeping them working.' },
    { k: 'fantv', tone: 'info', t: 'Doing a video on our forgotten men. Some of these are genuinely good players.' },
    { k: 'fan', tone: 'good', t: 'Came on for eleven minutes and changed the game. Then went straight back to the bench.' },
    { k: 'stats', tone: 'info', t: c => `Several ${c.clubName} squad players are under two hundred minutes for the season.` },
    { k: 'fan', tone: 'info', t: 'Warming up for forty minutes in the rain and not getting on is a specific kind of misery.' },
    { k: 'club', tone: 'info', t: 'Everybody in this squad has a part to play. 💙' }
  ];

  MORE3.crowdFavourite = [
    { k: 'fan', tone: 'good', t: 'He is not our best player and he is my favourite player. Those are different jobs.' },
    { k: 'fantv', tone: 'good', t: 'The song about him is the best one in the ground and it is not close.' },
    { k: 'journo', tone: 'info', t: c => `Certain players get a reaction at ${c.clubName} that has nothing to do with their statistics.` },
    { k: 'fan', tone: 'good', t: 'Every time he touches it the whole ground lifts. Cannot coach that.' },
    { k: 'pundit', tone: 'info', t: 'Crowd favourites give a manager a substitution that is worth more than the player.' },
    { k: 'fan', tone: 'good', t: 'Whole ground on their feet when he came on. He had not kicked it yet.' },
    { k: 'club', tone: 'good', t: 'You know the song. 🎵' }
  ];

  MORE3.returning = [
    { k: 'club', tone: 'good', t: c => `Back in the squad. 💙 Good to have you, ${c.player}.` },
    { k: 'fan', tone: 'good', t: c => `${c.player} back on the bench. Feels like a new signing and it did not cost anything.` },
    { k: 'journo', tone: 'good', t: c => `${c.player} returns for ${c.clubName} after a long spell out. The manager will not rush him.` },
    { k: 'pundit', tone: 'info', t: 'Getting a player back is not the same as having him back. Six weeks of match sharpness to find.' },
    { k: 'fantv', tone: 'good', t: c => `${c.player.toUpperCase()} IS BACK. Best news of the month by miles.` },
    { k: 'fan', tone: 'good', t: 'Whole ground stood up when he came on. He looked like he might cry.' },
    { k: 'stats', tone: 'info', t: c => `${c.player} available again for ${c.clubName}.` },
    { k: 'fan', tone: 'info', t: 'Do not throw him straight back in. Please. We have done this before.' }
  ];

  MORE3.transferRequest = [
    { k: 'journo', tone: 'hot', t: c => `Understand a ${c.clubName} player has asked to leave. The club's position is that he is not for sale.` },
    { k: 'fan', tone: 'bad', t: 'If he does not want to be here, get him out and get somebody who does.' },
    { k: 'fantv', tone: 'bad', t: 'The badge kissing in the announcement video has aged like milk.' },
    { k: 'pundit', tone: 'info', t: 'Players ask to leave every summer. Most of them are still there in September.' },
    { k: 'fan', tone: 'info', t: 'He has given us three good years. He is allowed to want a bigger stage.' },
    { k: 'club', tone: 'info', t: 'We do not comment on individual contract matters.' },
    { k: 'rival', tone: 'good', t: c => `${c.clubName} losing another one. It is basically their business model.` },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} have sold their top scorer in several recent summers.` }
  ];

  MORE3.loanTalk = [
    { k: 'journo', tone: 'info', t: c => `A ${c.clubName} youngster has gone out on loan. The manager wants him playing every week.` },
    { k: 'fan', tone: 'info', t: 'Sending him out is the right call. He needs games, not a seat on a bench.' },
    { k: 'fantv', tone: 'info', t: 'Loan watch is back. Following six of ours across four divisions. Send help.' },
    { k: 'pundit', tone: 'good', t: 'Clubs who use loans properly develop players. Clubs who use them to dump problems do not.' },
    { k: 'fan', tone: 'good', t: 'Our lad scored again on loan. Bring him home in the summer.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} have several players out on loan this season.` },
    { k: 'club', tone: 'good', t: 'Great to see one of our own scoring for his loan club this weekend. 👏' }
  ];

  MORE3.exPlayer = [
    { k: 'pundit', tone: 'info', t: c => `I played for ${c.clubName}. That dressing room is a good place to be right now, you can tell.` },
    { k: 'fan', tone: 'good', t: 'Our old midfielder was in the stand today. Got a standing ovation. Deserved.' },
    { k: 'journo', tone: 'info', t: c => `A former ${c.clubName} player has been critical of the current side. It has not gone down well.` },
    { k: 'fantv', tone: 'bad', t: 'Ex-players who left for money do not get to lecture us about commitment.' },
    { k: 'pundit', tone: 'good', t: 'People forget how hard it is to play for a club under this kind of pressure. I do not.' },
    { k: 'fan', tone: 'good', t: 'He came back for a testimonial and the ground was full. Says everything.' },
    { k: 'club', tone: 'good', t: 'Lovely to welcome a club legend back to the ground today. 💙' },
    { k: 'fan', tone: 'bad', t: 'Being an ex-player does not make your opinion correct. It makes it louder.' }
  ];

  MORE3.awards = [
    { k: 'club', tone: 'good', t: c => `Player of the Month: ${c.topScorer}. 🏅 Voted for by you.` },
    { k: 'fan', tone: 'good', t: c => `${c.topScorer} for Player of the Season and I will hear nothing else.` },
    { k: 'journo', tone: 'info', t: c => `Two ${c.clubName} players are on the divisional team of the season shortlist.` },
    { k: 'fantv', tone: 'info', t: 'My awards video. Player of the season, moment of the season, and worst take of the season. Mine.' },
    { k: 'pundit', tone: 'good', t: 'Individual awards are a nonsense and everybody wants one. Both things are true.' },
    { k: 'stats', tone: 'info', t: c => `${c.topScorer} leads the club for goals with ${c.topGoals}.`, when: c => c.topGoals > 0 },
    { k: 'fan', tone: 'bad', t: 'Player of the Month goes to whoever scored the prettiest goal. Every time.' },
    { k: 'club', tone: 'good', t: 'Awards night details are on the site. Black tie optional, arguments guaranteed. 🎩' }
  ];
  /* ---- the club as an institution ---- */
  MORE3.ownership = [
    { k: 'journo', tone: 'hot', t: c => `Understand there has been contact regarding a possible investment in ${c.clubName}.` },
    { k: 'fan', tone: 'bad', t: 'Do not want new owners. Want the current ones to spend what they already have.' },
    { k: 'fantv', tone: 'info', t: 'Takeover talk video. Ninety percent speculation, ten percent me reading a companies register.' },
    { k: 'fan', tone: 'good', t: 'Any owner who turns up, sits in the stand and says nothing is fine by me.' },
    { k: 'pundit', tone: 'info', t: 'Ownership decides everything and supporters get no say in it. That is the sport now.' },
    { k: 'club', tone: 'info', t: 'The club has no comment to make on ownership speculation.' },
    { k: 'fan', tone: 'bad', t: 'Every takeover rumour costs us three signings and six months.' },
    { k: 'journo', tone: 'info', t: c => `${c.clubName}'s accounts are published this week. Nobody will read them and everybody will have an opinion.` },
    { k: 'stats', tone: 'info', t: c => `${c.clubName}'s wage-to-turnover ratio is healthier than most in this division.` },
    { k: 'fan', tone: 'info', t: 'Owners come and go. We are the club. Sounds cheesy. Is true.' }
  ];

  MORE3.stadium = [
    { k: 'club', tone: 'good', t: 'Plans for the new stand have been submitted. 🏗️ More soon.' },
    { k: 'fan', tone: 'bad', t: 'Do not touch the ground. It is the only thing about this club that has never let me down.' },
    { k: 'journo', tone: 'info', t: c => `${c.clubName} are exploring an expansion. Demand has outstripped capacity for two seasons.` },
    { k: 'fan', tone: 'good', t: 'More seats means more people. That is a good problem and I will take it.' },
    { k: 'fantv', tone: 'info', t: 'Walked the whole ground with a camera before they change it. For the archive.' },
    { k: 'pundit', tone: 'info', t: 'Atmosphere does not survive a rebuild automatically. It has to be designed in.' },
    { k: 'fan', tone: 'info', t: 'They are finally fixing the roof on the away end. Only took a decade.' },
    { k: 'club', tone: 'info', t: 'Pitch relaying work begins after the last home game. 🌱' },
    { k: 'fan', tone: 'bad', t: 'New seats, same leg room. Whoever designed this has never had legs.' }
  ];

  MORE3.commercial = [
    { k: 'club', tone: 'good', t: 'New shirt sponsor announced. 👕 A three-year deal.' },
    { k: 'fan', tone: 'bad', t: 'Another sponsor nobody has heard of on a shirt nobody can afford.' },
    { k: 'fantv', tone: 'info', t: 'Ranking every shirt sponsor we have ever had. Some of them were companies. Allegedly.' },
    { k: 'journo', tone: 'info', t: c => `A commercial deal at ${c.clubName} will fund academy investment.` },
    { k: 'fan', tone: 'good', t: 'The new home kit is genuinely lovely. First time I have said that in years.' },
    { k: 'fan', tone: 'bad', t: 'Sixty-five quid for a shirt and they change it every season. Do the maths on a family of four.' },
    { k: 'pundit', tone: 'info', t: 'Commercial growth is the only lever most clubs have. It is dull and it is the whole game.' },
    { k: 'club', tone: 'good', t: 'The new away kit drops on Friday. You are going to want this one. 👀' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} shirt sales are reportedly up on last season.` }
  ];

  MORE3.staff = [
    { k: 'journo', tone: 'info', t: c => `${c.clubName} have appointed a new assistant. The manager pushed for him.` },
    { k: 'fan', tone: 'good', t: 'Whoever coaches our set pieces deserves a pay rise and a parking space.' },
    { k: 'pundit', tone: 'info', t: 'A manager is only as good as the three people he trusts most. Ask any of them.' },
    { k: 'fantv', tone: 'info', t: 'Doing a video on the backroom staff. Nobody knows their names. They should.' },
    { k: 'club', tone: 'good', t: 'Welcome to the coaching team. 👋 A really strong addition.' },
    { k: 'fan', tone: 'info', t: 'The fitness coach has been here through four managers. He is the actual constant.' },
    { k: 'journo', tone: 'info', t: c => `A member of ${c.clubName}'s staff has been approached by a bigger club. He is staying.` },
    { k: 'pundit', tone: 'good', t: 'The analysts do more to win football matches now than half the coaching staff did twenty years ago.' }
  ];

  MORE3.academy = [
    { k: 'club', tone: 'good', t: 'Our under-18s are through to the next round. 🌱 Well played, lads.' },
    { k: 'fan', tone: 'good', t: 'Went to watch the youth team. Two of them are going to play for the first team. Calling it now.' },
    { k: 'journo', tone: 'info', t: c => `${c.clubName}'s academy has produced more first-team minutes this season than in the previous three combined.` },
    { k: 'fantv', tone: 'good', t: 'Academy watch is back. I have opinions about sixteen-year-olds and that is probably unhealthy.' },
    { k: 'pundit', tone: 'good', t: 'A club that trusts its academy has a floor under it forever. Very few actually do.' },
    { k: 'fan', tone: 'bad', t: 'We produce them and then sell them at nineteen. Same story every generation.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} have handed academy graduates significant minutes this season.` },
    { k: 'club', tone: 'good', t: 'Scholarship offers have gone out to six young players today. 📝' },
    { k: 'fan', tone: 'good', t: 'A local lad in the first team is worth more to this ground than any signing.' }
  ];

  MORE3.preseason = [
    { k: 'club', tone: 'good', t: 'Back in. ☀️ First day of pre-season, and everybody reported in good shape.' },
    { k: 'fan', tone: 'good', t: 'Pre-season friendlies are meaningless and I have watched all of them.' },
    { k: 'fantv', tone: 'good', t: 'Pre-season predictions video. I will be wrong about everything by October.' },
    { k: 'journo', tone: 'info', t: c => `${c.clubName} have started pre-season with a clear plan and, unusually, most of their signings already done.` },
    { k: 'pundit', tone: 'info', t: 'Nothing you see in July means anything. Except the fitness. The fitness means everything.' },
    { k: 'fan', tone: 'info', t: 'Optimism is at an all-time high and it will last until roughly the second Saturday.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} begin the new campaign after a full pre-season together.` },
    { k: 'fan', tone: 'good', t: 'The fixture list is out. Already planned four away days I cannot afford.' },
    { k: 'club', tone: 'good', t: 'Season tickets have sold out for the first time in years. Thank you. 💙' }
  ];

  MORE3.parade = [
    { k: 'club', tone: 'hot', t: 'The bus sets off at two. 🚌 Come and fill these streets.' },
    { k: 'fan', tone: 'hot', t: 'Took the day off. Whole family coming. Never doing anything else with a Sunday again.' },
    { k: 'journo', tone: 'good', t: c => `Tens of thousands expected on the streets for ${c.clubName} today.` },
    { k: 'fantv', tone: 'hot', t: 'Filming the whole parade. My battery will not survive and I do not care.' },
    { k: 'fan', tone: 'hot', t: 'My dad has waited his entire life for this. He has not stopped smiling.' },
    { k: 'pundit', tone: 'good', t: 'Days like this are what all of it is for. Everything else is just build-up.' },
    { k: 'club', tone: 'good', t: 'Thank you to every single person who came out today. 💙' }
  ];

  MORE3.merry = [
    { k: 'journo', tone: 'info', t: 'Three managers have gone in this division in a fortnight. It is that time of year.' },
    { k: 'fan', tone: 'info', t: 'Every club sacking their manager makes ours look more valuable.' },
    { k: 'pundit', tone: 'info', t: 'Nobody gets time any more. The average tenure in this league is under eighteen months.' },
    { k: 'fantv', tone: 'info', t: 'Doing a video on the managerial merry-go-round. It is depressing and you will love it.' },
    { k: 'rival', tone: 'bad', t: 'We have had four managers since their bloke arrived. Four.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName}'s manager is now among the longer-serving in this division.`, when: c => c.seasons >= 2 },
    { k: 'fan', tone: 'good', t: 'Watching other clubs implode is a spectator sport and I am a season ticket holder.' },
    { k: 'journo', tone: 'info', t: c => `${c.clubName}'s manager has been mentioned in connection with two vacancies this week.` }
  ];
  /* ---- weather, betting, numbers, and the rest of the noise ---- */
  MORE3.weather = [
    { k: 'fan', tone: 'bad', t: 'Wind so strong the corner flags were horizontal. Football was not played today, it was survived.' },
    { k: 'pundit', tone: 'info', t: 'You cannot play through a gale. Both managers knew it by the tenth minute.' },
    { k: 'fan', tone: 'good', t: 'Snow on the pitch, orange ball, freezing. Best conditions there are.' },
    { k: 'club', tone: 'info', t: 'The pitch has passed an inspection. The game goes ahead. ❄️' },
    { k: 'fan', tone: 'bad', t: 'Soaked to the bone by the fifteenth minute. Stayed for all ninety. Obviously.' },
    { k: 'journo', tone: 'info', t: 'Driving rain, a heavy pitch and two managers rethinking everything at half time.' },
    { k: 'fantv', tone: 'bad', t: 'My camera got wet. My notes got wet. I got wet. Video is delayed.' },
    { k: 'fan', tone: 'info', t: 'Thirty degrees and a three o clock kick off. Somebody explain the scheduling.' },
    { k: 'pundit', tone: 'info', t: 'In heat like that the pressing goes first. Watch who stops running and when.' },
    { k: 'club', tone: 'info', t: 'Please bring water and take advantage of the cooling breaks today. ☀️' },
    { k: 'fan', tone: 'good', t: 'Sunny day, cold pint, three points on the way. Cannot beat it.' },
    { k: 'fan', tone: 'bad', t: 'Postponed at two hours notice. I was already on the motorway.' }
  ];

  MORE3.betting = [
    { k: 'fan', tone: 'info', t: c => `Had ${c.clubName} at long odds in August. Not looking as stupid as it did.`, when: c => c.pos <= 6 },
    { k: 'stats', tone: 'info', t: c => `The models still have ${c.clubName} finishing lower than they currently are.` },
    { k: 'fantv', tone: 'info', t: 'Doing a prediction video. My record is dreadful and you keep watching anyway.' },
    { k: 'fan', tone: 'bad', t: 'Backed us to win, went two up, lost 3-2. Football is a personal attack.' },
    { k: 'pundit', tone: 'info', t: 'The market has been slow to catch up with this side all season.' },
    { k: 'fan', tone: 'info', t: 'Put a fiver on the manager to still be here in May. Feels like the safest money in the league.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} have beaten their projected points total for three months running.` },
    { k: 'fantv', tone: 'info', t: 'Your predictions from August, read out loud. Some of you should be ashamed.' }
  ];

  MORE3.deepStats = [
    { k: 'stats', tone: 'info', t: c => `${c.clubName} rank near the top for passes into the penalty area per possession.` },
    { k: 'stats', tone: 'info', t: c => `Only two sides in the ${c.leagueName} recover the ball higher up the pitch than ${c.clubName}.` },
    { k: 'stats', tone: 'info', t: c => `${c.clubName}'s shot quality has improved every month since the start of the season.` },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} give up fewer shots from central areas than almost anybody.` },
    { k: 'stats', tone: 'info', t: c => `The average starting position of ${c.clubName}'s defensive line has moved up five yards this season.` },
    { k: 'pundit', tone: 'info', t: 'The numbers say they are better than the table. The table says the numbers are missing something.' },
    { k: 'fan', tone: 'bad', t: 'Do not show me expected goals. Show me actual goals. I was there.' },
    { k: 'fan', tone: 'good', t: 'The stats accounts have been saying we are good for months. Nice of the results to catch up.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} concede the fewest counter-attacking chances in the division.` },
    { k: 'pundit', tone: 'info', t: 'Numbers do not tell you why. They tell you where to look, which is not nothing.' },
    { k: 'fantv', tone: 'info', t: 'Explaining expected goals for the eleventh time. I will keep doing it until you stop asking.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} take a higher share of their shots with their first touch than most.` }
  ];

  MORE3.fantasy = [
    { k: 'fan', tone: 'info', t: c => `Captained ${c.topScorer} and he was substituted at half time. Cheers, boss.`, when: c => c.topGoals > 0 },
    { k: 'fantv', tone: 'info', t: 'Fantasy tips video. I have never won my own mini league. Take the advice anyway.' },
    { k: 'fan', tone: 'good', t: c => `${c.star} is in every fantasy team in the country now and it is our fault.` },
    { k: 'fan', tone: 'bad', t: 'Sold him last week. Of course I did. Of course.' },
    { k: 'stats', tone: 'info', t: c => `${c.topScorer} is among the highest-scoring fantasy picks in the division.`, when: c => c.topGoals >= 6 },
    { k: 'fan', tone: 'info', t: 'Twelve of us in the mini league. Eleven of us support this club. Guess who is winning.' },
    { k: 'fantv', tone: 'info', t: 'Wildcard time. My team is a disgrace. Rebuilding live tonight.' }
  ];

  MORE3.tunnel = [
    { k: 'journo', tone: 'info', t: 'A lively tunnel at half time, by all accounts. Neither manager wanted to discuss it.' },
    { k: 'fan', tone: 'good', t: 'The gaffer was giving somebody an earful going down the tunnel and I have never loved him more.' },
    { k: 'pundit', tone: 'info', t: 'Half time is forty-five seconds of message and fourteen minutes of everything else.' },
    { k: 'fantv', tone: 'info', t: 'Somebody filmed the tunnel. It is very loud and completely inaudible. Uploading anyway.' },
    { k: 'fan', tone: 'info', t: 'Both managers shook hands at the end like nothing happened. Professionals.' },
    { k: 'journo', tone: 'info', t: 'The two benches had words. It was over before anybody got there.' },
    { k: 'fan', tone: 'bad', t: 'Whatever was said at half time did not work. Second half was worse.' },
    { k: 'pundit', tone: 'good', t: 'Second half performance like that tells you the message got through.' }
  ];

  MORE3.money = [
    { k: 'fan', tone: 'bad', t: 'Worked out what I spend on this club a year. Then stopped working it out.' },
    { k: 'fan', tone: 'bad', t: 'Train, ticket, pint, pie. Eighty quid to watch a goalless draw in the rain.' },
    { k: 'journo', tone: 'info', t: 'Ticket prices across the division are up again. Supporters groups are not happy.' },
    { k: 'club', tone: 'good', t: 'Under-16s go free with a paying adult for the next home game. 🧒' },
    { k: 'fan', tone: 'good', t: 'Concession pricing actually being sensible for once. Credit where it is due.' },
    { k: 'fantv', tone: 'bad', t: 'Doing a video on what it now costs to follow this club home and away. It is grim.' },
    { k: 'fan', tone: 'info', t: 'Cancelled everything else to keep the season ticket. Priorities.' },
    { k: 'pundit', tone: 'info', t: 'The people who fill these grounds are the last thing anybody thinks about in the boardroom.' },
    { k: 'club', tone: 'info', t: 'A hardship fund for supporters is now open. Details on the site. 💙' }
  ];

  MORE3.socialMeta = [
    { k: 'fan', tone: 'info', t: 'This app is unbearable after a defeat and unbearable after a win. Never leaving.' },
    { k: 'fantv', tone: 'info', t: 'Reminder that everyone on here is a stranger with a strong opinion, me included.' },
    { k: 'fan', tone: 'bad', t: 'The replies to that club post are a war zone. Stay out of there.' },
    { k: 'pundit', tone: 'info', t: 'Nobody has ever changed their mind about a substitution because of a quote tweet.' },
    { k: 'fan', tone: 'good', t: 'Made three genuine friends through this club and an app. Football is strange.' },
    { k: 'fantv', tone: 'info', t: 'Muted the words "expected goals" for my own health.' },
    { k: 'fan', tone: 'info', t: 'Somebody quoted my post from November back at me. Fair play, I was wrong.' },
    { k: 'rival', tone: 'info', t: 'Following their fan accounts purely for the meltdowns. Great content.' },
    { k: 'fan', tone: 'bad', t: 'Every fanbase has a hundred people who ruin it for the rest. Ours are very loud.' },
    { k: 'fan', tone: 'good', t: 'Best thing on here is the bloke who posts the same photo of the ground every matchday.' }
  ];

  MORE3.tv = [
    { k: 'fan', tone: 'bad', t: 'Moved to a Monday night for television. Two hundred miles. On a Monday.' },
    { k: 'journo', tone: 'info', t: c => `${c.clubName} are on television again. That is the third time this month.`, when: c => c.pos <= 6 },
    { k: 'fan', tone: 'good', t: 'On the telly and I am going anyway. Would not watch it at home if you paid me.' },
    { k: 'fantv', tone: 'bad', t: 'The commentary team clearly did not know who half our players were.' },
    { k: 'pundit', tone: 'info', t: 'This is a side worth putting on television. Not everybody in this league is.' },
    { k: 'club', tone: 'info', t: 'Saturday has been selected for broadcast. New kick off time on the site. 📺' },
    { k: 'fan', tone: 'info', t: 'Watched it in a pub with forty strangers. Better than the sofa every time.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} have appeared on broadcast more this season than last.` }
  ];
  MORE3.win = [
    { k: 'fan', tone: 'good', t: 'Won it in the manner of a team that expects to win. That is new.' },
    { k: 'pundit', tone: 'good', t: 'Two goals from set pieces. Somebody has been working very hard on a training ground.' },
    { k: 'journo', tone: 'info', t: c => `${c.clubName} take care of ${c.opp}. The manager described it as "a professional afternoon".` },
    { k: 'fantv', tone: 'good', t: 'Three points and I did not shout at anybody. Growth.' },
    { k: 'fan', tone: 'good', t: 'The bloke who moans every week said nothing today. Highest praise available.' },
    { k: 'club', tone: 'good', t: c => `⚽ ${c.us}-${c.them}. Well played, everyone.` },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} win again and stay ${c.posOrd}.` },
    { k: 'fan', tone: 'good', t: 'Won without our best player. That has not been possible for years.' },
    { k: 'pundit', tone: 'info', t: 'A good side finds four different ways to win. They have found three of them this month.' },
    { k: 'rival', tone: 'bad', t: 'They keep grinding out wins and it is deeply irritating.' },
    { k: 'journo', tone: 'good', t: 'Not a goal of the season contender among them and nobody in that end cared.' },
    { k: 'fan', tone: 'good', t: 'Sang all the way home on the train. Whole carriage joined in eventually.' },
    { k: 'fantv', tone: 'good', t: 'Player ratings up. Two nines. I have never given a nine before.' },
    { k: 'club', tone: 'good', t: 'Another three. 📈 Onto the next.' },
    { k: 'stats', tone: 'info', t: c => `${c.wins} wins from ${c.played} for ${c.clubName} this season.` },
    { k: 'fan', tone: 'good', t: 'Nothing beats the walk back to the car after a win. Nothing.' }
  ];

  MORE3.loss = [
    { k: 'fan', tone: 'bad', t: 'We had the ball for an hour and did nothing with it. That is a plan failing, not bad luck.' },
    { k: 'pundit', tone: 'info', t: 'They were beaten by a side who defended better and ran further. No mystery in it.' },
    { k: 'journo', tone: 'bad', t: c => `A flat afternoon for ${c.clubName}. ${c.opp} did the simple things better all game.` },
    { k: 'fantv', tone: 'bad', t: 'I have watched it back. It was worse the second time.' },
    { k: 'fan', tone: 'info', t: 'You cannot win them all. Some of you genuinely think you can.' },
    { k: 'club', tone: 'bad', t: 'A disappointing result. We regroup and we go again. 💙' },
    { k: 'fan', tone: 'bad', t: 'Two hundred miles for that. My own fault for expecting anything.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} slip to ${c.posOrd} after the defeat.` },
    { k: 'pundit', tone: 'bad', t: 'Nobody took responsibility on the ball in the second half. That is a confidence problem.' },
    { k: 'rival', tone: 'good', t: c => `Three points at ${c.clubName}. Do not mind if I do.` },
    { k: 'fan', tone: 'good', t: 'Away end sang for the last twenty minutes losing. Proud of that, whatever the score.' },
    { k: 'journo', tone: 'info', t: 'The manager was calm afterwards. Too calm, some will say. Others will call it perspective.' },
    { k: 'fantv', tone: 'bad', t: 'Not one player came over at the end. Noticed. Not impressed.' },
    { k: 'fan', tone: 'bad', t: 'Same soft goal. Same corner. Same everything.' }
  ];

  MORE3.draw = [
    { k: 'fan', tone: 'info', t: 'A point at their place is fine and I will not be told otherwise.' },
    { k: 'pundit', tone: 'info', t: 'Neither manager gambled. Neither will lose their job over it either.' },
    { k: 'journo', tone: 'info', t: c => `${c.clubName} share the points. It felt like a draw from about the twentieth minute.` },
    { k: 'fantv', tone: 'bad', t: 'Drawing games we should win is how seasons quietly disappear.' },
    { k: 'club', tone: 'info', t: c => `Full time: ${c.us}-${c.them}. Thanks for the support today. 💙` },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} draw again and remain ${c.posOrd}.` },
    { k: 'fan', tone: 'good', t: 'Equalised in the ninetieth. Feels like a win. It is not, but it feels like one.' },
    { k: 'fan', tone: 'bad', t: 'Threw away a lead again. It is becoming a personality trait.' },
    { k: 'pundit', tone: 'info', t: 'The substitutions were designed to hold a point. They held a point. Nobody has to like it.' },
    { k: 'rival', tone: 'info', t: 'Point each and everybody goes home mildly annoyed. Perfect football match.' },
    { k: 'fantv', tone: 'info', t: 'Doing a video on our draws. There are too many of them for one video.' }
  ];

  MORE3.bigWin = [
    { k: 'fan', tone: 'hot', t: 'Every single one of them was outstanding. Every single one.' },
    { k: 'pundit', tone: 'good', t: 'That is what happens when a well-coached side meets one with no plan.' },
    { k: 'journo', tone: 'good', t: c => `${c.clubName} were irresistible. ${c.opp} will not want to see the video.` },
    { k: 'fantv', tone: 'hot', t: 'I ran out of superlatives on the livestream and started just shouting names.' },
    { k: 'club', tone: 'hot', t: c => `${c.us}. ⚽⚽⚽ What a day at our place.` },
    { k: 'fan', tone: 'hot', t: 'The away end emptied on the hour. Cannot blame them.' },
    { k: 'stats', tone: 'info', t: c => `${c.us} goals for ${c.clubName}, and it could comfortably have been more.` },
    { k: 'rival', tone: 'bad', t: 'Refunds. We want refunds. That was an insult.' },
    { k: 'pundit', tone: 'good', t: 'The second goal was the best team move you will see in this division all year.' },
    { k: 'fan', tone: 'hot', t: 'Lost my voice by half time. Second half was purely mimed.' },
    { k: 'journo', tone: 'good', t: 'The manager apologised to the opposition bench afterwards. Nobody has ever done that here.' }
  ];

  MORE3.heavyLoss = [
    { k: 'fan', tone: 'bad', t: 'That is the angriest I have ever been walking out of that ground.' },
    { k: 'pundit', tone: 'bad', t: 'After the second there was no organisation at all. That is what should worry the board.' },
    { k: 'journo', tone: 'bad', t: c => `${c.opp} scored ${c.them} and were coasting. ${c.clubName} have serious questions to answer.` },
    { k: 'fantv', tone: 'bad', t: 'I have been shouting for eleven years and I could not get a word out at full time.' },
    { k: 'club', tone: 'bad', t: 'We apologise to every supporter who travelled today.' },
    { k: 'fan', tone: 'bad', t: 'Applauded them off out of habit. Regretted it immediately.' },
    { k: 'stats', tone: 'info', t: c => `${c.them} conceded. That is not a performance, that is a warning.` },
    { k: 'rival', tone: 'hot', t: 'Never enjoyed a football match more in my life.' },
    { k: 'pundit', tone: 'info', t: 'One result does not tell you much. The manner of it tells you plenty.' },
    { k: 'fan', tone: 'info', t: 'Stay behind, clap them, come back next week. That is what we do.' }
  ];

  MORE3.cupThrough = [
    { k: 'fan', tone: 'good', t: 'One round closer. That is all any of this is.' },
    { k: 'club', tone: 'good', t: 'Into the hat again. 🎩' },
    { k: 'journo', tone: 'info', t: c => `${c.clubName} come through the ${c.stageName.toLowerCase()} without alarm.` },
    { k: 'pundit', tone: 'good', t: 'Doing the job on a cold night against a side with nothing to lose is harder than it looks.' },
    { k: 'fantv', tone: 'good', t: 'Cup runs make seasons. I will keep saying it until somebody stops me.' },
    { k: 'fan', tone: 'hot', t: 'I have already checked how many rounds are left. Twice.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} progress in the ${c.comp}.` },
    { k: 'rival', tone: 'info', t: 'Good luck to them in it. It keeps them distracted from the league.' }
  ];

  MORE3.cupOut = [
    { k: 'fan', tone: 'bad', t: 'Gone. And it was there for us. That is what makes it hurt.' },
    { k: 'journo', tone: 'bad', t: c => `${c.clubName} are out. ${c.opp} deserved it over the ninety minutes.` },
    { k: 'pundit', tone: 'info', t: 'That is the cups. One bad half an hour and you wait a year.' },
    { k: 'fantv', tone: 'bad', t: 'Deleting the draw video I had already half made. Devastating.' },
    { k: 'club', tone: 'bad', t: 'Our run ends. Thank you to everyone who followed it. 💙' },
    { k: 'fan', tone: 'info', t: 'League it is then. Ninety percent of the season is still there.' },
    { k: 'rival', tone: 'good', t: c => `Knocked ${c.clubName} out. Best night of my season.` },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} eliminated from the ${c.comp}.` }
  ];

  MORE3.worldie = [
    { k: 'fan', tone: 'hot', t: c => `${c.scorer}. From THERE. On a Tuesday.` },
    { k: 'club', tone: 'good', t: c => `Take a bow. 👏 ${c.scorer}.` },
    { k: 'pundit', tone: 'good', t: 'The best players make the difficult thing look like the obvious thing.' },
    { k: 'stats', tone: 'info', t: c => `A low-probability finish from ${c.scorer}. He specialises in those.` },
    { k: 'fantv', tone: 'hot', t: 'That is on the channel intro from now on. Decision made.' },
    { k: 'journo', tone: 'good', t: c => `${c.scorer} lit up an otherwise forgettable afternoon.` },
    { k: 'fan', tone: 'good', t: 'My phone recording is entirely of my own reaction. Worth nothing. Keeping it forever.' }
  ];

  MORE3.wonderGoal = [
    { k: 'fan', tone: 'hot', t: 'Twenty-six years watching this club. Top three goals I have seen live.' },
    { k: 'club', tone: 'hot', t: c => `Just watch it. 🔁 ${c.scorer}.` },
    { k: 'pundit', tone: 'good', t: 'He had one option and it was the hardest one, and he took it without thinking.' },
    { k: 'journo', tone: 'good', t: c => `An extraordinary goal from ${c.scorer}. The whole press box asked to see it again.` },
    { k: 'fantv', tone: 'hot', t: 'Uploading it on its own, no commentary, no music. It does not need me.' },
    { k: 'stats', tone: 'info', t: c => `${c.scorer}: one of the lowest-probability finishes recorded in this competition.` },
    { k: 'fan', tone: 'hot', t: 'The bloke behind me hugged me. I have never met him. I would die for him now.' },
    { k: 'rival', tone: 'good', t: 'Conceding that is almost a privilege. Almost.' }
  ];

  MORE3.hattrick = [
    { k: 'fan', tone: 'hot', t: c => `${c.scorer} has the match ball and the freedom of the city as far as I am concerned.` },
    { k: 'club', tone: 'good', t: c => `Three for the man of the moment. 🎩 ${c.scorer}.` },
    { k: 'journo', tone: 'good', t: c => `Three goals for ${c.scorer}, and each one was different.` },
    { k: 'pundit', tone: 'good', t: 'Hat-tricks are about staying in the game after you miss. He missed two early on.' },
    { k: 'fantv', tone: 'hot', t: 'HE HAS THE BALL. HE HAS THE BALL UNDER HIS ARM.' },
    { k: 'stats', tone: 'info', t: c => `${c.scorer} now on ${c.topGoals} for the season.` },
    { k: 'fan', tone: 'good', t: 'Whole ground chanting his name as he came off. Deserved every second of it.' }
  ];
  MORE3.weekly = [
    { k: 'fan', tone: 'info', t: 'Spent the whole train home arguing about a substitution that did not happen.' },
    { k: 'club', tone: 'info', t: 'Squad numbers for the new season are confirmed. 📋' },
    { k: 'journo', tone: 'info', t: c => `${c.clubName} have been quietly excellent at the boring parts of running a football club.` },
    { k: 'pundit', tone: 'info', t: 'The hardest thing in this job is doing nothing when everybody wants you to do something.' },
    { k: 'fantv', tone: 'info', t: 'Doing a video nobody asked for about our third choice goalkeeper. He is fascinating.' },
    { k: 'fan', tone: 'good', t: 'The bloke who runs the supporters coach has done it for thirty years. Never taken a penny.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} have won more games away than at home this season.` },
    { k: 'fan', tone: 'bad', t: 'Programme notes are written by somebody who has clearly never watched us play.' },
    { k: 'club', tone: 'good', t: 'Great turnout at the youth game last night. 🌱 Thank you.' },
    { k: 'rival', tone: 'info', t: 'Their manager is the only reason they are where they are. Everybody knows it.' },
    { k: 'journo', tone: 'info', t: c => `A scout from abroad was at ${c.clubName} on Saturday. That is happening more.` },
    { k: 'fan', tone: 'info', t: 'Woke up and checked the table before I checked anything else. Every day.' },
    { k: 'pundit', tone: 'good', t: 'Watch how quickly they get bodies behind the ball after a corner. Drilled.' },
    { k: 'fantv', tone: 'good', t: 'Hit a milestone on the channel. All because of a football club I did not choose.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} have scored more late goals than most in the ${c.leagueName}.` },
    { k: 'fan', tone: 'bad', t: 'The queue for the ladies at half time is a disgrace and has been for twenty years.' },
    { k: 'club', tone: 'info', t: 'Reminder that the club shop is open until five on matchdays. 🛍️' },
    { k: 'journo', tone: 'info', t: 'The manager was seen at a reserve game on Tuesday night. He goes to most of them.' },
    { k: 'fan', tone: 'good', t: 'A stranger gave my son his programme because we could not get one. Small kindness.' },
    { k: 'pundit', tone: 'info', t: 'A team that presses this hard needs a January break and there is not one.' },
    { k: 'fantv', tone: 'bad', t: 'Somebody asked if I have ever been positive. Yes. Twice. In 2019.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} have the best conversion rate from headers in the division.` },
    { k: 'fan', tone: 'info', t: 'The half time draw has been won by the same family three times. Rigged.' },
    { k: 'club', tone: 'good', t: 'Our disability supporters association raised a huge amount this month. 💙' },
    { k: 'journo', tone: 'info', t: c => `Recruitment meetings at ${c.clubName} now include the manager. That was not always the case.` },
    { k: 'fan', tone: 'good', t: 'The pitch looked perfect. Whoever cut those stripes, well done.' },
    { k: 'pundit', tone: 'info', t: 'This side plays with more courage away from home than at home. That is unusual and interesting.' },
    { k: 'fantv', tone: 'info', t: 'Video on our best signings under a hundred grand. There are more than you think.' },
    { k: 'fan', tone: 'bad', t: 'They have moved the away end. Again. For no reason.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} commit fewer fouls than most sides who press this high.` },
    { k: 'club', tone: 'info', t: 'Bag policy has changed for the next home game. Check the site first. 🎒' },
    { k: 'journo', tone: 'info', t: 'Two clubs have asked about the manager. Both were told no conversation would happen.' },
    { k: 'fan', tone: 'good', t: 'Twenty-two years and I still get nervous walking up the steps into the stand.' },
    { k: 'pundit', tone: 'good', t: 'You can tell a coached side by what they do in the ten seconds after losing the ball.' },
    { k: 'fantv', tone: 'good', t: 'The comments on the last video were actually lovely. What has happened to you all.' },
    { k: 'fan', tone: 'info', t: 'Half the ground wants us to play out. The other half wants it in row Z. Both are right sometimes.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} have used the fewest goalkeepers of any side in this division.` },
    { k: 'club', tone: 'good', t: 'Christmas party for the academy families this week. 🎄' },
    { k: 'journo', tone: 'info', t: c => `A settled backroom staff at ${c.clubName} for a third season running.` },
    { k: 'fan', tone: 'bad', t: 'Eight pounds for a pie and a Bovril. Eight!' },
    { k: 'pundit', tone: 'info', t: 'His teams get better in the second half of seasons. That is fitness planning, not luck.' },
    { k: 'fantv', tone: 'info', t: 'Ranking every stadium we have visited this season. Ours is not first. Sorry.' },
    { k: 'fan', tone: 'good', t: 'Someone in the away end started a song about the bus driver. He waved. Magic.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} have conceded fewer goals in the last fifteen minutes than anyone.` },
    { k: 'club', tone: 'info', t: 'Matchday parking has changed. Please read the notes before you travel. 🚗' },
    { k: 'journo', tone: 'info', t: 'The manager rarely gives anything away. This week he gave away that he is enjoying it.' },
    { k: 'fan', tone: 'info', t: 'Went to an away game with my dad and did not speak for three hours. Perfect day.' },
    { k: 'pundit', tone: 'info', t: 'The full backs are the whole system. If one of them goes down it is a different team.' },
    { k: 'fantv', tone: 'good', t: 'Somebody sent me a photo of them watching my video in the away end. Made my year.' },
    { k: 'fan', tone: 'bad', t: 'Turnstile operator scanned my ticket four times and then blamed me.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} have gone behind fewer times this season than last.` },
    { k: 'club', tone: 'good', t: 'A club record for season ticket renewals. Thank you all. 💙' },
    { k: 'journo', tone: 'info', t: c => `The mood inside ${c.clubName} is described as calm and quietly ambitious.` },
    { k: 'fan', tone: 'good', t: 'Watched the warm up properly for once. You learn a lot in twenty minutes.' },
    { k: 'pundit', tone: 'info', t: 'Every manager says they want a settled side. Very few have the nerve to have one.' },
    { k: 'fantv', tone: 'info', t: 'Long form video on our worst season. It was cathartic and I will not do it again.' },
    { k: 'fan', tone: 'info', t: 'Nobody in this fanbase agrees on the best XI and everybody is certain.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} have picked up more points from losing positions than at any point in five years.` },
    { k: 'club', tone: 'info', t: 'Ticket exchange is now live for the sold-out fixture. 🎟️' },
    { k: 'journo', tone: 'info', t: c => `A club that was rudderless three years ago now has a plan, a manager and a squad that fits both.` },
    { k: 'fan', tone: 'good', t: 'Bumped into the kitman in a chip shop. Best twenty minutes of conversation this year.' },
    { k: 'pundit', tone: 'info', t: 'The improvement here has been gradual and unglamorous. That is why it might last.' },
    { k: 'fantv', tone: 'bad', t: 'Three people unsubscribed after the last one. Worth it.' },
    { k: 'fan', tone: 'info', t: 'Sat in the home end at an away game once. Never again. Never.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} rank in the top half for both goals scored and goals prevented.`, when: c => c.pos <= 10 },
    { k: 'club', tone: 'good', t: 'Players visited the childrens ward this morning. Not for the cameras. 💙' },
    { k: 'journo', tone: 'info', t: 'Nothing has leaked out of that training ground all season, which itself says something.' },
    { k: 'fan', tone: 'good', t: 'The old fella next to me has not missed a game since his wife passed. We look out for him.' },
    { k: 'pundit', tone: 'good', t: 'Watch the goalkeeper start the attacks. That is the manager, not the keeper.' },
    { k: 'fantv', tone: 'info', t: 'Doing a video about why we all keep doing this. It got a bit emotional. Sorry.' },
    { k: 'fan', tone: 'bad', t: 'Eleven pounds for a scarf that fell apart in the rain.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} have kept more clean sheets away from home than at home.` },
    { k: 'club', tone: 'info', t: 'The next fans forum is in three weeks. Submit your questions now. 🎤' },
    { k: 'journo', tone: 'info', t: c => `Two directors at ${c.clubName} attended the away game. Small signal, noticed inside the club.` },
    { k: 'fan', tone: 'good', t: 'Everyone in my life thinks I am mad. Everyone at the ground thinks I am normal.' },
    { k: 'pundit', tone: 'info', t: 'A settled side breeds understanding. Understanding is worth more than talent over thirty-eight games.' },
    { k: 'fantv', tone: 'good', t: 'Made a video with my dad about his first game. Most watched thing I have ever done.' },
    { k: 'fan', tone: 'info', t: 'The steward on my gate knows my name and my order. Fifteen years.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} have made fewer errors leading to goals than any side around them.` },
    { k: 'club', tone: 'good', t: 'Thank you for another full away allocation. Best support in the league. 💙' },
    { k: 'journo', tone: 'info', t: 'The manager turned down a media appearance to watch a youth game. That is who he is.' },
    { k: 'fan', tone: 'good', t: 'The floodlights coming on at half four in December. Nothing better in sport.' },
    { k: 'pundit', tone: 'info', t: 'What he has built here is repeatable, which is more than most managers can say.' }
  ];
  MORE3.weekly2 = [
    { k: 'fan', tone: 'info', t: 'I have watched more football this season than I have slept. Not a joke.' },
    { k: 'pundit', tone: 'info', t: 'The interesting sides are the ones doing something specific. This one is.' },
    { k: 'journo', tone: 'info', t: c => `${c.clubName} continue to punch at their weight, which sounds like faint praise and is not.` },
    { k: 'fantv', tone: 'info', t: 'Been asked to do a podcast with a rival channel. Considering it. Reluctantly.' },
    { k: 'club', tone: 'good', t: 'Behind the scenes footage from the week. 🎥 Out now.' },
    { k: 'fan', tone: 'good', t: 'Two of the lads stayed behind signing for an hour after training. Class.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} attempt more progressive passes than the divisional average.` },
    { k: 'rival', tone: 'bad', t: 'Their fans have started calling their manager a genius. It has been six months.' },
    { k: 'fan', tone: 'bad', t: 'Kick off at twelve thirty on a Sunday. Who is this for?' },
    { k: 'pundit', tone: 'info', t: 'The most underrated skill in management is picking the same team when you are being told not to.' },
    { k: 'journo', tone: 'info', t: 'Nothing dramatic to report, which after the last few years is quite the headline.' },
    { k: 'fantv', tone: 'good', t: 'Doing a video on the best atmospheres this season. Ours features twice.' },
    { k: 'fan', tone: 'good', t: 'Whole family in the same row for the first time. Cost a fortune. Worth every penny.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} have improved their goal difference every month this season.` },
    { k: 'club', tone: 'info', t: 'Away travel for the next round is now open to members. 🚌' },
    { k: 'pundit', tone: 'good', t: 'This is a well-coached football team and there is no more useful sentence in the sport.' },
    { k: 'fan', tone: 'info', t: 'Argued with my brother about the formation until two in the morning. Neither of us plays football.' },
    { k: 'journo', tone: 'info', t: c => `${c.clubName} have quietly built one of the better scouting operations at this level.` },
    { k: 'fantv', tone: 'bad', t: 'The algorithm hates tactical videos. I am making them anyway. Out of spite.' },
    { k: 'fan', tone: 'good', t: 'Bought a programme for the first time in years. Actually good. Somebody has tried.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} have taken the lead in more matches than they have trailed.` },
    { k: 'club', tone: 'good', t: 'A thousand school children at the ground today for our community day. 🧒' },
    { k: 'pundit', tone: 'info', t: 'Nobody notices a good back four until it is not there any more.' },
    { k: 'fan', tone: 'bad', t: 'Turnstiles opened late again. Missed the first five minutes with a thousand others.' },
    { k: 'journo', tone: 'info', t: 'The training ground has been described as the calmest it has been in a decade.' },
    { k: 'fantv', tone: 'good', t: 'Somebody stopped me at the ground to say the videos helped them through a bad year. Floored me.' },
    { k: 'fan', tone: 'info', t: 'My group chat is 90% football and 10% arranging to watch football.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} allow fewer shots per game than at any point in this manager's tenure.` },
    { k: 'club', tone: 'info', t: 'Kick off has been confirmed as three o clock. No change. ⏰' },
    { k: 'rival', tone: 'info', t: 'Their away end genuinely does not stop. Give them that.' },
    { k: 'pundit', tone: 'info', t: 'You judge a squad by its eighteenth best player. Theirs is decent, which is rare here.' },
    { k: 'fan', tone: 'good', t: 'Somebody handed my daughter a pennant at the end. She has it on her wall.' },
    { k: 'journo', tone: 'info', t: c => `${c.clubName} have not had an off-field story all season. That is the story.` },
    { k: 'fantv', tone: 'info', t: 'Doing a "where are they now" on the squad from five years ago. Some surprises.' },
    { k: 'fan', tone: 'bad', t: 'Whoever picks the goal music needs a serious conversation with somebody.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} have the highest share of minutes given to homegrown players in the division.` },
    { k: 'club', tone: 'good', t: 'Our women’s side are top of their league. Get down and support them. 💙' },
    { k: 'pundit', tone: 'info', t: 'There is a version of this team that gets relegated and a version that gets promoted. Coaching decides which.' },
    { k: 'fan', tone: 'info', t: 'The bloke who does the half time draw has the same three jokes. I know them by heart.' },
    { k: 'journo', tone: 'info', t: 'Two of the coaching staff have been offered contract extensions.' },
    { k: 'fantv', tone: 'good', t: 'The best thing about this job is that strangers argue with me about a club we both love.' },
    { k: 'fan', tone: 'good', t: 'Been going for thirty years. Missed one game. Still annoyed about it.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} have improved on their points total at this stage in each of the last three seasons.` },
    { k: 'club', tone: 'info', t: 'Please respect the local residents when parking. Thank you. 🏘️' },
    { k: 'pundit', tone: 'good', t: 'Consistency of selection, consistency of message, consistency of shape. It is not complicated. It is just hard.' },
    { k: 'fan', tone: 'bad', t: 'Away game on a Thursday night three hundred miles away. Whoever did that, I hope your tea is cold.' },
    { k: 'journo', tone: 'info', t: c => `${c.clubName} have been credited by opposing managers three times this month.` },
    { k: 'fantv', tone: 'info', t: 'Doing a video on the worst refereeing decisions of the season. It is thirty-five minutes.' },
    { k: 'fan', tone: 'good', t: 'The atmosphere before kick off gave me goosebumps and we were playing nobody.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} are among the least-changed starting elevens in the division.` },
    { k: 'club', tone: 'good', t: 'Two hundred volunteers made today happen. Thank you, every one. 💙' },
    { k: 'pundit', tone: 'info', t: 'The thing about identity is that it survives a bad month. Style does not.' },
    { k: 'fan', tone: 'info', t: 'Have never once left a game early and I never will. It is a principle.' },
    { k: 'journo', tone: 'info', t: 'The manager has been notably generous about his opposite numbers all season.' },
    { k: 'fantv', tone: 'bad', t: 'Filmed for four hours and the audio was broken the whole time. I want to lie down.' },
    { k: 'fan', tone: 'good', t: 'Away end sang the manager’s name unprompted. Whole ground turned round.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} have conceded the fewest set-piece goals of any side in the bottom half.`, when: c => c.pos > 8 },
    { k: 'club', tone: 'info', t: 'Programme collectors: the archive is now digitised and free. 📚' },
    { k: 'pundit', tone: 'info', t: 'A manager who can coach a defence is worth two who can only inspire one.' },
    { k: 'fan', tone: 'info', t: 'The pub before the game is half the reason I go. The other half is complaining afterwards.' },
    { k: 'journo', tone: 'info', t: c => `A rare thing at ${c.clubName}: everybody inside and outside the club wants the same thing.` },
    { k: 'fantv', tone: 'good', t: 'Ten thousand of you watched a video about a goal kick. I love this fanbase.' },
    { k: 'fan', tone: 'good', t: 'Nothing in my week is as certain as this and I need that more than I admit.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName}: ${c.wins} wins, ${c.posOrd}, and trending upwards.`, when: c => c.wins >= 5 },
    { k: 'club', tone: 'good', t: 'Congratulations to our academy graduate on his international call-up. 🌍' },
    { k: 'pundit', tone: 'info', t: 'The clubs who get this right spend years being called boring first.' },
    { k: 'fan', tone: 'bad', t: 'Nothing about modern football is designed for the people who actually go.' },
    { k: 'journo', tone: 'info', t: 'A quiet, competent week. In this league that is worth writing down.' },
    { k: 'fantv', tone: 'info', t: 'Answering the question I get most: no, I will not be nicer about the referee.' },
    { k: 'fan', tone: 'good', t: 'My season ticket is the best money I spend and the worst investment I make.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} have led at half time more often than any side outside the top three.`, when: c => c.pos >= 4 },
    { k: 'club', tone: 'info', t: 'Supporter liaison drop-in sessions start next week. 💬' },
    { k: 'pundit', tone: 'info', t: 'If you want to know whether a manager has a squad with him, watch the substitutes warm up.' },
    { k: 'fan', tone: 'info', t: 'Whole family supports a different club. I chose this one at six and never looked back.' },
    { k: 'journo', tone: 'info', t: c => `${c.clubName} are becoming a club other clubs copy. That has never been said here.` },
    { k: 'fantv', tone: 'good', t: 'Doing a fan Q and A. You have already sent four hundred questions. Calm down.' },
    { k: 'fan', tone: 'good', t: 'Best thing about this season is that I look forward to Saturdays again.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} have had fewer players sent off than most in this division.` },
    { k: 'club', tone: 'good', t: 'A record crowd for a league game at this ground. Thank you. 🎫' },
    { k: 'pundit', tone: 'info', t: 'Nobody is going to make a documentary about a well organised midfield. They should.' },
    { k: 'fan', tone: 'info', t: 'Watched a game on my phone at a wedding. Not proud. Would do it again.' },
    { k: 'journo', tone: 'info', t: 'The manager has stopped being asked whether he can do it. Now he is asked how far he can go.' }
  ];
  const M4 = {};
  M4.win = [
    { k: 'fan', tone: 'good', t: 'Controlled it from the first whistle. Have not been able to say that in years.' },
    { k: 'pundit', tone: 'good', t: 'They scored the goal the game needed at the moment the game needed it.' },
    { k: 'journo', tone: 'info', t: c => `${c.clubName} do enough. In this division doing enough is a skill.` },
    { k: 'fantv', tone: 'good', t: 'Went in expecting nothing. Came out singing. That is the whole hobby.' },
    { k: 'club', tone: 'good', t: 'Three more. 💙 Same again, please.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} move to ${c.wins} wins for the campaign.` },
    { k: 'fan', tone: 'good', t: 'Somebody in the away end had a trumpet and by the end everybody loved him.' },
    { k: 'rival', tone: 'info', t: 'Deserved winners. Do not want to type it but there it is.' },
    { k: 'pundit', tone: 'info', t: 'Not much in it, but they had the clearer idea. That was the difference.' },
    { k: 'fan', tone: 'good', t: 'My mate said we would lose. He has bought the drinks. Justice.' }
  ];
  M4.loss = [
    { k: 'fan', tone: 'bad', t: 'Never got going. Never looked like getting going. Worst kind of defeat.' },
    { k: 'pundit', tone: 'info', t: 'It was the sort of afternoon where nothing they tried came off. It happens to everybody.' },
    { k: 'journo', tone: 'bad', t: c => `${c.opp} were braver and it was that simple.` },
    { k: 'fantv', tone: 'bad', t: 'Did the reaction video in the car. It is thirty seconds long and mostly sighing.' },
    { k: 'club', tone: 'bad', t: 'Not good enough today. We know. 💙' },
    { k: 'fan', tone: 'info', t: 'Take the defeat, learn from it, go again Saturday. Simple as that.' },
    { k: 'stats', tone: 'info', t: c => `Defeat leaves ${c.clubName} ${c.posOrd}.` },
    { k: 'rival', tone: 'good', t: 'Long drive home and I have not stopped smiling once.' },
    { k: 'fan', tone: 'bad', t: 'Somebody explain why we changed a system that was working.' },
    { k: 'pundit', tone: 'bad', t: 'They were passive without the ball and that is not like them at all.' }
  ];
  M4.draw = [
    { k: 'fan', tone: 'info', t: 'Not brilliant, not terrible. Football has a lot of these and nobody talks about them.' },
    { k: 'pundit', tone: 'info', t: 'A point that neither manager will complain about in public and both will privately.' },
    { k: 'journo', tone: 'info', t: c => `${c.clubName} could not find the goal the game was asking for.` },
    { k: 'fantv', tone: 'info', t: 'A draw. My least favourite content. There is nothing to say.' },
    { k: 'club', tone: 'info', t: 'A point on the road. 💙' },
    { k: 'fan', tone: 'bad', t: 'We do not draw enough of the ones we should lose and we draw all of the ones we should win.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} remain ${c.posOrd} after sharing the points.` }
  ];
  M4.signing = [
    { k: 'fan', tone: 'good', t: 'Watched all his highlights twice. Convinced. Completely convinced. Ask me in November.' },
    { k: 'journo', tone: 'info', t: c => `${c.player} becomes ${c.clubName}'s latest addition. Quiet business, done early.` },
    { k: 'pundit', tone: 'info', t: 'A player who fits the system beats a better player who does not. Every time.' },
    { k: 'fantv', tone: 'good', t: c => `Deep dive on ${c.player}. I watched four games so you do not have to.` },
    { k: 'club', tone: 'good', t: c => `He is one of us now. 💙 ${c.player}.` },
    { k: 'stats', tone: 'info', t: c => `${c.player} arrives rated ${c.ovr} at ${c.age}.` },
    { k: 'fan', tone: 'bad', t: 'Another one for the future. We have eleven for the future and none for Saturday.' },
    { k: 'rival', tone: 'info', t: 'Decent signing that. Annoyingly sensible club.' },
    { k: 'fan', tone: 'good', t: 'First interview and he already said the right things about the supporters. In.' }
  ];
  M4.sale = [
    { k: 'fan', tone: 'bad', t: 'Selling him in January is how you turn a good season into a bad one.' },
    { k: 'journo', tone: 'info', t: c => `${c.player} departs for ${c.fee}. The manager said he would not stand in his way.` },
    { k: 'fantv', tone: 'info', t: 'Genuinely gutted. He was one of my favourites and I did not expect that.' },
    { k: 'pundit', tone: 'info', t: 'Every club sells. The good ones replace before they sell.' },
    { k: 'club', tone: 'info', t: c => `Thank you and good luck, ${c.player}. 💙` },
    { k: 'fan', tone: 'good', t: 'Right money at the right time. We have to be sensible sometimes.' },
    { k: 'stats', tone: 'info', t: c => `${c.fee} received. ${c.clubName}'s budget updated accordingly.` }
  ];
  M4.injury = [
    { k: 'fan', tone: 'bad', t: 'You could hear the gasp round the whole ground when he went down.' },
    { k: 'pundit', tone: 'info', t: 'Losing him for a month reshapes the next six games completely.' },
    { k: 'journo', tone: 'info', t: c => `${c.player} is facing a spell out. ${c.clubName} will not put a date on it.` },
    { k: 'club', tone: 'info', t: c => `Get well soon, ${c.player}. 💙 We will be waiting.` },
    { k: 'fantv', tone: 'bad', t: 'Every time we build momentum somebody breaks. Every single time.' },
    { k: 'fan', tone: 'info', t: 'Somebody in that squad is about to get a run of games. Take it with both hands.' },
    { k: 'stats', tone: 'info', t: c => `${c.player} out — ${c.label}, roughly ${c.games} games.` }
  ];
  M4.redCard = [
    { k: 'fan', tone: 'bad', t: 'Reckless, needless, and it cost us the game. No defending that.' },
    { k: 'pundit', tone: 'info', t: 'The referee had no choice. None whatsoever.' },
    { k: 'journo', tone: 'info', t: c => `${c.player} walks. ${c.clubName} finished with ten and stayed in the game longer than they should have.` },
    { k: 'fantv', tone: 'bad', t: 'Somebody in that dressing room needs to have a word with him.' },
    { k: 'fan', tone: 'info', t: 'Honestly? Harsh. Watch it back. Genuinely harsh.' },
    { k: 'club', tone: 'info', t: 'We will review the incident with the player.' }
  ];
  M4.sackWatch = [
    { k: 'fan', tone: 'info', t: 'Four managers in six years has got us here. Doing it again will not get us out.' },
    { k: 'journo', tone: 'bad', t: c => `Pressure is building at ${c.clubName}. The next two results look decisive.` },
    { k: 'pundit', tone: 'info', t: 'The board have a decision and neither option is obviously right. That is the worst kind.' },
    { k: 'fantv', tone: 'bad', t: 'Doing a video about the situation. It gives me no pleasure and it will get a lot of views.' },
    { k: 'fan', tone: 'bad', t: 'The football has been unwatchable for two months. Somebody has to say it.' },
    { k: 'club', tone: 'info', t: 'The board met today as they do every month. No further comment.' },
    { k: 'stats', tone: 'info', t: c => `Board confidence has fallen to ${c.conf}.` },
    { k: 'fan', tone: 'good', t: 'Whole ground sang for him at half time. Whatever happens, that was something.' }
  ];
  M4.champions = [
    { k: 'fan', tone: 'hot', t: 'I have supported this club for thirty-one years for this exact afternoon.' },
    { k: 'journo', tone: 'hot', t: c => `${c.clubName} are champions. Nobody outside that dressing room saw it coming in August.` },
    { k: 'pundit', tone: 'good', t: 'A title built on a defence, a shape and a manager who never blinked.' },
    { k: 'fantv', tone: 'hot', t: 'CHAMPIONS. I have said it two hundred times and I will say it two hundred more.' },
    { k: 'club', tone: 'hot', t: '🏆 Say it with us. CHAMPIONS.' },
    { k: 'fan', tone: 'hot', t: 'Rang everybody I know. Half of them do not like football. Told them anyway.' },
    { k: 'stats', tone: 'info', t: c => `Champions of the ${c.leagueName}: ${c.clubName}.` },
    { k: 'rival', tone: 'bad', t: 'Fair play. Genuinely. Now please be quiet for six weeks.' }
  ];
  M4.arrived = [
    { k: 'fan', tone: 'info', t: 'Cautiously optimistic, which for me is basically a parade.' },
    { k: 'journo', tone: 'info', t: c => `The new man at ${c.clubName} inherits a squad and a fanbase both waiting to be convinced.` },
    { k: 'pundit', tone: 'info', t: 'He will get four months of goodwill. What he does with them decides everything.' },
    { k: 'fantv', tone: 'good', t: 'First impressions: he answered every question and did not once mention a project. Good start.' },
    { k: 'club', tone: 'good', t: 'A new chapter begins. ✍️' },
    { k: 'fan', tone: 'good', t: 'Whatever happens, at least it is something different.' },
    { k: 'rival', tone: 'info', t: 'Underwhelming appointment. Which usually means he is very good.' }
  ];
  M4.leaving = [
    { k: 'fan', tone: 'bad', t: 'The best three years I have had following this club and it ends on a Tuesday afternoon.' },
    { k: 'journo', tone: 'info', t: c => `The ${c.clubName} manager departs. The club now face the hardest appointment they have made in years.` },
    { k: 'pundit', tone: 'info', t: 'Replacing a manager who overachieved is the trap almost every board walks into.' },
    { k: 'fantv', tone: 'bad', t: 'Not making a video. Not today.' },
    { k: 'club', tone: 'info', t: 'We thank him for everything. Nobody here will forget it. 💙' },
    { k: 'fan', tone: 'good', t: 'Give him a standing ovation if he ever comes back. He earned it.' }
  ];
  M4.linked = [
    { k: 'fan', tone: 'info', t: 'Every good thing at this club has an expiry date. Enjoying it while it lasts.' },
    { k: 'journo', tone: 'hot', t: c => `${c.suitor} are said to be admirers. No formal approach has been made.` },
    { k: 'fantv', tone: 'bad', t: 'Refreshing this app every four minutes like a lunatic.' },
    { k: 'pundit', tone: 'info', t: 'He will weigh it up properly. That is what people who are good at this do.' },
    { k: 'club', tone: 'info', t: 'The manager is under contract and fully focused on the next fixture.' },
    { k: 'fan', tone: 'bad', t: 'If he goes I am not sure I can be bothered with the rebuild again.' }
  ];
  const M5 = {};
  M5.weekly = [
    { k: 'fan', tone: 'info', t: 'Told a colleague I was in a bad mood because of a corner. He did not understand.' },
    { k: 'pundit', tone: 'info', t: 'The best thing about this league is that four clubs are trying genuinely different things.' },
    { k: 'journo', tone: 'info', t: c => `${c.clubName} have had one of the quietest injury records in the division this season.` },
    { k: 'fantv', tone: 'info', t: 'Rating every pie I have eaten this season. Data driven. Deeply serious.' },
    { k: 'club', tone: 'good', t: 'Sold out again. 🎫 See you Saturday.' },
    { k: 'fan', tone: 'good', t: 'Took a mate who had never been. He has bought a shirt already.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} have made fewer defensive errors than any side in the division this season.` },
    { k: 'fan', tone: 'bad', t: 'Cannot hear the tannoy in half the ground. Never could.' },
    { k: 'pundit', tone: 'info', t: 'Watch the midfielders point before they receive it. That is a coached team.' },
    { k: 'journo', tone: 'info', t: 'The manager has been described by three opposing coaches this month as the best in this league.' },
    { k: 'fantv', tone: 'good', t: 'Made a video about my dad taking me to my first game. He has watched it eleven times.' },
    { k: 'fan', tone: 'info', t: 'There are four hundred of us who have the same argument every single week and I love them all.' },
    { k: 'club', tone: 'info', t: 'Turnstiles will open earlier for the next fixture. ⏰' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} average more touches in the opposition box than at any point in five seasons.` },
    { k: 'rival', tone: 'bad', t: 'Every single one of their fans is now a tactical analyst. Every one.' },
    { k: 'fan', tone: 'good', t: 'Somebody gave me their spare ticket for nothing. Would not take a penny.' },
    { k: 'pundit', tone: 'info', t: 'The manager has aged five years in two seasons and looks like he is enjoying every one of them.' },
    { k: 'journo', tone: 'info', t: c => `A second consecutive season without significant off-field disruption at ${c.clubName}.` },
    { k: 'fantv', tone: 'bad', t: 'Filmed a whole preview and then the team news made it useless.' },
    { k: 'fan', tone: 'good', t: 'Best part of an away day is the bit where nothing has gone wrong yet.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} concede from set pieces less often than any of their nearest rivals.` },
    { k: 'club', tone: 'good', t: 'Our supporters raised enough to fund a minibus for the academy. Incredible. 💙' },
    { k: 'fan', tone: 'bad', t: 'The bloke behind me has booed every backwards pass since 2011.' },
    { k: 'pundit', tone: 'info', t: 'This side does not need the ball to be dangerous, which is the hardest thing to coach.' },
    { k: 'journo', tone: 'info', t: 'No new injuries, no suspensions, no drama. The manager will take that every week.' },
    { k: 'fantv', tone: 'info', t: 'Doing a video on the goalkeeper. Nobody will watch it and he deserves it.' },
    { k: 'fan', tone: 'info', t: 'Somebody asked me to explain why I care this much. Still working on an answer.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} have used fewer than twenty players in league games this season.` },
    { k: 'club', tone: 'info', t: 'Match tickets are now available to all members. 🎟️' },
    { k: 'fan', tone: 'good', t: 'The kid in front of me got a wave from a player at the warm up. Made his entire life.' },
    { k: 'pundit', tone: 'info', t: 'The gap between a well-drilled side and a talented one narrows every week of a long season.' },
    { k: 'journo', tone: 'info', t: c => `${c.clubName} have started planning for next summer already. That is new here.` },
    { k: 'fantv', tone: 'good', t: 'Best comments section on this app and I will fight anyone who says otherwise.' },
    { k: 'fan', tone: 'bad', t: 'Three quid for a cup of tea in a paper cup that dissolves.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} have won more points in the second half of games than the first.` },
    { k: 'club', tone: 'good', t: 'Nine hundred of you at the away game on a Tuesday. Remarkable. 💙' },
    { k: 'fan', tone: 'info', t: 'Been to ninety grounds. Ours is not the nicest. It is the only one that matters.' },
    { k: 'pundit', tone: 'info', t: 'The clever bit is not the shape. It is that all eleven of them agree on what to do next.' },
    { k: 'journo', tone: 'info', t: 'The manager gave a coaching session to local youth coaches this week. Nobody asked him to.' },
    { k: 'fantv', tone: 'info', t: 'A hundred episodes of this podcast. I have said the same six things a hundred times.' },
    { k: 'fan', tone: 'good', t: 'Away end and home end applauded each other at the end. Rare and lovely.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} rank top ten for chances created from open play.` },
    { k: 'club', tone: 'info', t: 'The pitch inspection has passed. The game is on. ✅' },
    { k: 'fan', tone: 'bad', t: 'Nobody sings in the new stand. Nobody. It is a library with a roof.' },
    { k: 'pundit', tone: 'good', t: 'They have gone from a team that hopes to a team that expects. That is a manager doing his job.' },
    { k: 'journo', tone: 'info', t: c => `Everybody at ${c.clubName} is now pointing in the same direction, which took a very long time.` },
    { k: 'fantv', tone: 'good', t: 'Somebody made a banner from one of my thumbnails. I am never getting over this.' },
    { k: 'fan', tone: 'info', t: 'My whole social life is arranged around a fixture list published in June.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} give the ball away in their own third less than almost anyone.` },
    { k: 'club', tone: 'good', t: 'Thank you for filling this place again. It makes a difference. 💙' }
  ];
  M5.tacticsTalk = [
    { k: 'pundit', tone: 'info', t: 'They never have fewer than three players within ten yards of the ball. That is deliberate.' },
    { k: 'pundit', tone: 'info', t: 'The striker drops in and the winger goes beyond. Same move, twenty times a game, still unstoppable.' },
    { k: 'fan', tone: 'info', t: 'The whole system depends on one midfielder being fit. That is terrifying.' },
    { k: 'fantv', tone: 'info', t: 'Drew the shape on a whiteboard. Realised halfway through I had eleven and a half players.' },
    { k: 'pundit', tone: 'good', t: 'They defend the halfway line better than most sides defend their own box.' },
    { k: 'fan', tone: 'bad', t: 'We have no way of hurting a side that sits deep and we play three of them a month.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} switch play more often than the divisional average.` },
    { k: 'pundit', tone: 'info', t: 'The goalkeeper is the first attacker and the last defender. He has coached both halves of that.' },
    { k: 'fan', tone: 'good', t: 'The rotations on the left are genuinely lovely to watch when they come off.' },
    { k: 'fantv', tone: 'info', t: 'Explaining a rest defence with cutlery on a kitchen table. This is my life now.' }
  ];
  M5.fanCulture = [
    { k: 'fan', tone: 'good', t: 'Our songs are better than yours and that is the only trophy some clubs get.' },
    { k: 'fan', tone: 'good', t: 'Two thousand of us on a Tuesday, four hours each way, and the noise never dropped.' },
    { k: 'fantv', tone: 'good', t: 'Filmed the away end for ninety minutes. Not one person sat down.' },
    { k: 'club', tone: 'good', t: 'That is what a full house sounds like. 🔊 💙' },
    { k: 'fan', tone: 'info', t: 'Somebody has been bringing the same flag since 1998. It has been repaired forty times.' },
    { k: 'fan', tone: 'good', t: 'A stranger bought my son a hot chocolate because he was cold. I never got his name.' },
    { k: 'rival', tone: 'info', t: 'Their fans were class with our lot after the game. Credit to them.' },
    { k: 'fan', tone: 'bad', t: 'Somebody threw a pie. A whole pie. At nobody in particular.' },
    { k: 'fantv', tone: 'good', t: 'Doing a video on the songs and where they came from. Some of them are older than me.' },
    { k: 'fan', tone: 'good', t: 'Standing with the same twelve people for fifteen years. That is a family, basically.' }
  ];
  M5.mediaTalk = [
    { k: 'fantv', tone: 'info', t: 'Got asked for a quote by a national paper. They used one word of it.' },
    { k: 'journo', tone: 'info', t: c => `Interest in ${c.clubName} from the national press has picked up noticeably.` },
    { k: 'pundit', tone: 'good', t: 'I would happily watch this side every week and I do not say that about many.' },
    { k: 'fan', tone: 'bad', t: 'The studio panel spent four minutes on us and got two names wrong.' },
    { k: 'fantv', tone: 'good', t: 'A national outlet nicked my analysis without credit. Flattered and furious.' },
    { k: 'journo', tone: 'info', t: 'The manager remains one of the more thoughtful interviews in this division.' },
    { k: 'fan', tone: 'info', t: 'Radio commentary is better than television and I will not be arguing about it.' },
    { k: 'pundit', tone: 'info', t: 'We spend all our airtime on four clubs and miss the most interesting football in the country.' }
  ];
  M5.history = [
    { k: 'fan', tone: 'good', t: 'My grandad watched this club for sixty years and saw us win one thing. I think about that a lot.' },
    { k: 'club', tone: 'good', t: 'On this day, one of the great comebacks at this ground. 📅' },
    { k: 'journo', tone: 'info', t: c => `${c.clubName} have not been in this position for a very long time.`, when: c => c.pos <= 3 },
    { k: 'fantv', tone: 'good', t: 'Watched an old game on tape. The pitch was mud. The football was better than I remembered.' },
    { k: 'fan', tone: 'info', t: 'Found a ticket stub from 1996 in a coat. Whole afternoon gone.' },
    { k: 'pundit', tone: 'info', t: 'Clubs like this go decades between good sides. You savour them when they arrive.' },
    { k: 'fan', tone: 'good', t: 'My dad still talks about a game from 1989. I have finally got one of my own.' },
    { k: 'club', tone: 'good', t: 'Fifty years since that famous night. We remember. 💙' }
  ];
  M5.awayDays = [
    { k: 'fan', tone: 'good', t: 'Six of us, one car, four hundred miles, no radio. Best day of the season.' },
    { k: 'fan', tone: 'bad', t: 'Coach broke down on the way home. Sang for two hours on a hard shoulder.' },
    { k: 'fantv', tone: 'good', t: 'Away day series continues. This one has a train, a taxi and a wrong turn.' },
    { k: 'club', tone: 'info', t: 'Away coaches depart at nine. Please be on time. 🚌' },
    { k: 'fan', tone: 'good', t: 'Got there four hours early and had the best day out I have had all year.' },
    { k: 'journo', tone: 'info', t: c => `${c.clubName} take another full allocation. Their away support has been extraordinary all season.` },
    { k: 'fan', tone: 'info', t: 'Away end had a roof for the first time in about six trips. Felt like luxury.' },
    { k: 'rival', tone: 'info', t: 'Their away fans were the best we have had here this season by a distance.' }
  ];
  M5.squadTalk = [
    { k: 'fan', tone: 'good', t: 'The squad looks like a squad now. Not eleven players and a lot of hoping.' },
    { k: 'pundit', tone: 'info', t: 'They have two players for every position except one, and everybody knows which one.' },
    { k: 'journo', tone: 'info', t: c => `${c.clubName} will look to add depth rather than a marquee name.` },
    { k: 'fantv', tone: 'info', t: 'Ranked the squad. Number one was obvious. Numbers eight to fourteen caused a war.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} have five players over thirty in the squad.` },
    { k: 'fan', tone: 'bad', t: 'One injury in midfield and this whole thing falls apart.' },
    { k: 'pundit', tone: 'good', t: 'The bench changed the last two games. That is what a squad is for.' },
    { k: 'fan', tone: 'good', t: 'Nobody in that squad looks like they do not want to be there. Rare.' }
  ];
  const M6 = {};
  M6.weekly = [
    { k: 'fan', tone: 'info', t: 'Somebody at work asked how the team is doing. Forty minutes later he regretted it.' },
    { k: 'pundit', tone: 'info', t: 'Watch which player the manager talks to first at full time. It tells you what he saw.' },
    { k: 'journo', tone: 'info', t: c => `${c.clubName}'s recruitment has been aimed at one profile all year. That is discipline.` },
    { k: 'fantv', tone: 'info', t: 'Doing a video on the assistant manager. Nobody knows his name. He is running half of it.' },
    { k: 'club', tone: 'good', t: 'Training ground open day was a sell-out. Thank you all. ☀️' },
    { k: 'fan', tone: 'good', t: 'A kid asked me who my favourite player was. Realised I have four. Told him all of them.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} have improved their expected goals difference every month.` },
    { k: 'fan', tone: 'bad', t: 'Big screen has been broken since November and nobody has mentioned it.' },
    { k: 'pundit', tone: 'info', t: 'A side with no obvious weakness is worth more than a side with two obvious strengths.' },
    { k: 'journo', tone: 'info', t: 'The manager was seen at three different grounds this week. He watches everything.' },
    { k: 'fantv', tone: 'good', t: 'The channel hit a milestone. Doing a giveaway. It is a scarf. Sorry.' },
    { k: 'fan', tone: 'info', t: 'Every fanbase thinks it is the most long-suffering. Ours is objectively correct.' },
    { k: 'club', tone: 'info', t: 'Please note the earlier kick off time this weekend. ⏰' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} have been ahead for more total minutes than behind this season.` },
    { k: 'rival', tone: 'bad', t: 'Cannot open this app without seeing their badge. Enough now.' },
    { k: 'fan', tone: 'good', t: 'Whoever put the flags out in the away end, thank you. Looked brilliant.' },
    { k: 'pundit', tone: 'info', t: 'Managers get sacked for the football and kept for the results. He has both, for now.' },
    { k: 'journo', tone: 'info', t: c => `${c.clubName} have not had a single leak from inside the club this season.` },
    { k: 'fantv', tone: 'bad', t: 'Recorded a whole video and forgot to press record. Twice.' },
    { k: 'fan', tone: 'good', t: 'The moment the teams come out. Every single week. Twenty-five years.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} have the youngest bench in the division on most matchdays.` },
    { k: 'club', tone: 'good', t: 'Well done to our under-16s, who won their cup last night. 🌱🏆' },
    { k: 'fan', tone: 'bad', t: 'Away ticket ballot again. Twelve years of loyalty points and nothing.' },
    { k: 'pundit', tone: 'good', t: 'The difference this season is that the substitutes make the team better, not just different.' },
    { k: 'journo', tone: 'info', t: 'Everything about this club is calmer than it was. That is worth points on its own.' },
    { k: 'fantv', tone: 'info', t: 'The most requested video is about a corner from November. I will make it.' },
    { k: 'fan', tone: 'info', t: 'Told my wife I was going to one more game this season. That was in October.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} press more in the first fifteen minutes than any other period.` },
    { k: 'club', tone: 'info', t: 'The club shop will open late after the game. 🛍️' },
    { k: 'fan', tone: 'good', t: 'Somebody in the pub said our manager is the best thing to happen here in twenty years. Nobody argued.' },
    { k: 'pundit', tone: 'info', t: 'It is easy to coach a press. It is very hard to coach when to stop pressing.' },
    { k: 'fan', tone: 'bad', t: 'Steward told me to sit down in the ninetieth minute of a one-goal game. Genuinely.' },
    { k: 'journo', tone: 'info', t: c => `Season ticket sales at ${c.clubName} have hit a modern record.` },
    { k: 'fantv', tone: 'good', t: 'Doing a video about the tea lady. She has been here longer than anyone.' },
    { k: 'fan', tone: 'info', t: 'Nothing has taken more of my money, time and emotional energy and I have no complaints.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} have taken points off every side in the bottom six.`, when: c => c.pos <= 8 },
    { k: 'club', tone: 'good', t: 'Our foodbank collection has doubled this season. Thank you. 💙' },
    { k: 'pundit', tone: 'info', t: 'Give a good coach three years and a board that does not panic. That is the whole formula.' },
    { k: 'fan', tone: 'good', t: 'I have never once regretted going. Not one game in thirty years.' },
    { k: 'journo', tone: 'info', t: 'The manager thanked the ground staff, the kitman and the analysts by name today.' }
  ];

  const MORE_REPLIES2 = {
    hype: [
      'he is the best thing to happen to this club in my lifetime', 'we have a manager. an actual manager.',
      'nobody works harder and nobody complains less', 'I would follow this side anywhere',
      'give the man a statue and a stand named after him', 'this is what it feels like to be well run',
      'the football is beautiful and the results back it up', 'never been prouder of a team I have no control over',
      'we are not a big club and we play like one', 'he has changed what we think is possible here'
    ],
    doubt: [
      'the second we lose three the mood changes and you all know it', 'we have not beaten anybody good yet',
      'the shape falls apart against a proper press', 'looks great until somebody works it out',
      'I have seen four managers get this reaction and none of them lasted', 'the squad is papering over the cracks',
      'good, not great. there is a difference and it matters in April.', 'talk to me when we have won something'
    ],
    banter: [
      'still cannot believe you are excited about this', 'we have won more this decade than you have this century',
      'lovely little club you have there', 'setting a reminder to laugh in May',
      'you are one bad month from the same meltdown as last year', 'nobody outside your postcode cares',
      'imagine celebrating a point', 'best support in the league? you had two thousand empty seats'
    ],
    stat: [
      'their expected goals against is the best in the division', 'nobody has more clean sheets since Christmas',
      'points per game has doubled under this manager', 'the squad age has come down and the results have gone up',
      'top of the league for shot quality, which nobody talks about', 'their set piece defending is statistically elite',
      'fewest errors leading to goals of anyone around them', 'they have overperformed their model every single month'
    ],
    tactic: [
      'the answer has been a proper six all season and everyone can see it', 'push the line up ten yards and this is a different team',
      'stop taking the winger off on seventy minutes', 'we defend the box brilliantly and the edge of it terribly',
      'the double pivot is why we look calm now', 'give the full backs licence and watch what happens',
      'he changes it at half time better than anyone in this league'
    ],
    joke: [
      'my heart rate monitor thinks I ran a marathon', 'have not slept properly since August',
      'my partner has learned the offside rule out of self defence', 'named the wifi after him',
      'watched it back with the sound off like a psychopath', 'my group chat is unusable on matchdays',
      'have started dreaming about set pieces', 'told the dentist I support this club. he was sympathetic.'
    ],
    cope: [
      'right. next week. clean slate.', 'it is one game in a long season',
      'we have been worse and survived', 'nobody remembers a Tuesday in November',
      'going for a walk. see you all Saturday.', 'football owes me nothing and I keep asking'
    ],
    wholesome: [
      'my son asked if we could go again next week. that is all I need.',
      'the players clapped the away end for a full minute. noticed.',
      'somebody in the crowd was crying at full time. we all understood.',
      'this club has been the best constant in a hard few years',
      'took my grandad. first game since 2009. he sang every song.'
    ],
    hope: [
      'we are two players and one summer away', 'the young ones are going to be special',
      'first time in years the future looks better than the present', 'stick with him and see where this goes',
      'we have a plan and a manager who believes in it. that is enough for now.'
    ],
    anger: [
      'somebody has to be accountable and it is never the people upstairs',
      'we have been let down by this club more times than I can count',
      'I have paid for a season ticket for twenty years and I want an explanation',
      'no fight. that is the bit I cannot forgive.',
      'stop hiding behind the budget'
    ]
  };

  const MORE_YOU2 = {
    calm: [
      c => `Nothing that happens on a phone changes what we do on a Tuesday morning.`,
      c => `We will keep doing the same things. They tend to work.`,
      c => `I am not interested in anybody's predictions, including my own.`,
      c => `Quiet week, good week. That is how most of this job goes.`,
      c => `Every player in that building knows what is expected. That is all I need.`
    ],
    fire: [
      c => `We are going to be very hard to beat and everybody is going to find that out.`,
      c => `Anybody who thinks this group will fold has not met this group.`,
      c => `Bring whoever you like to our place. See how you get on.`,
      c => `I have heard the word 'overachieving' a lot. We will see about that.`,
      c => `Nobody is doing us any favours and nobody needs to.`
    ],
    honest: [
      c => `That is on me. All of it. The players deserved better preparation.`,
      c => `I picked it, I set it up, I got it wrong. Nothing else to say.`,
      c => `We have not been at the level for a month and I am the one who has to fix it.`,
      c => `Anybody who travelled today deserves an apology and they have mine.`,
      c => `I will not pretend that was acceptable, because it was not.`
    ],
    praise: [
      c => `Every one of those players ran until they could not run any more. That is all you can ask.`,
      c => `${c.star2} has been the quietest, best thing about this season.`,
      c => `The young lads have come in and looked like they have been here for years.`,
      c => `Our supporters made that happen. I mean that literally.`,
      c => `${c.topScorer} gets the headlines. The lad next to him does half his running.`
    ],
    defiant: [
      c => `We will do this properly or not at all. Those are the only two options.`,
      c => `Anybody who wants a different manager knows where the boardroom is.`,
      c => `I will be here on Monday, doing the same job, the same way.`,
      c => `Criticism is part of it. Panicking is not, and we will not be doing any.`,
      c => `Judge me at the end. Not in October, not in February. At the end.`
    ]
  };

  const M7 = {};
  M7.weekly = [
    { k: 'fan', tone: 'info', t: 'Booked a hotel for an away game in March. It is October.' },
    { k: 'pundit', tone: 'info', t: 'The best sides make the pitch big with the ball and tiny without it. They do both.' },
    { k: 'journo', tone: 'info', t: c => `${c.clubName}'s medical team have been credited internally for the injury record.` },
    { k: 'fantv', tone: 'info', t: 'Doing a video about our worst ever signing. It was a long shortlist.' },
    { k: 'club', tone: 'good', t: 'Nine hundred kids at the community festival today. 🧒⚽' },
    { k: 'fan', tone: 'good', t: 'A player signed my programme and asked how my season had been. Ten minutes of chat.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} have won more aerial duels than at any point this decade.` },
    { k: 'fan', tone: 'bad', t: 'Cannot see the far corner from my seat. Never could. Renewed anyway.' },
    { k: 'pundit', tone: 'info', t: 'Every good manager has one idea he refuses to give up. His is the high line.' },
    { k: 'journo', tone: 'info', t: 'A calm end to the week at the training ground. Everybody available.' },
    { k: 'fantv', tone: 'good', t: 'Best question in the mailbag was from an eight-year-old. Better than most adults.' },
    { k: 'fan', tone: 'info', t: 'The pre-match ritual has not changed since 2008. Same pub, same seat, same pint.' },
    { k: 'club', tone: 'info', t: 'Digital tickets only from next month. Guides are on the website. 📱' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} take fewer shots but score more than most sides around them.` },
    { k: 'rival', tone: 'info', t: 'Their ground on a night game is genuinely one of the better trips.' },
    { k: 'fan', tone: 'good', t: 'Somebody at the ground remembered my son from last season. He has not stopped talking about it.' },
    { k: 'pundit', tone: 'info', t: 'A side that defends the same way at 0-0 and 2-0 is a side that has been coached properly.' },
    { k: 'journo', tone: 'info', t: c => `${c.clubName} have made no changes to the coaching staff for two seasons.` },
    { k: 'fantv', tone: 'bad', t: 'Somebody told me I should be more like the big channels. Absolutely not.' },
    { k: 'fan', tone: 'good', t: 'Watched the warm-up with a coffee and nobody else in the ground. Peaceful.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} have taken the most points from the bottom half of any side in the top half.`, when: c => c.pos <= 10 },
    { k: 'club', tone: 'good', t: 'Twenty-five years of the supporters trust. Thank you for everything. 💙' },
    { k: 'fan', tone: 'bad', t: 'Half time entertainment is a man with a T-shirt cannon and low expectations.' },
    { k: 'pundit', tone: 'info', t: 'They have not been beaten by a side playing the same way as them all season.' },
    { k: 'journo', tone: 'info', t: 'The manager spent Sunday watching a youth game in the rain. Nobody told him to.' },
    { k: 'fantv', tone: 'info', t: 'Reviewing every kit since 1992. Some of them are hate crimes.' },
    { k: 'fan', tone: 'info', t: 'The bloke who does the announcements got the goalscorer wrong and the whole ground corrected him.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} have started the same eleven more often than anyone in the division.` },
    { k: 'club', tone: 'info', t: 'The away end will be relocated for the next fixture. Details online. 🎟️' },
    { k: 'fan', tone: 'good', t: 'Nothing feels as good as being right about a player nobody rated.' },
    { k: 'pundit', tone: 'info', t: 'The bravest decision this manager makes every week is not changing anything.' },
    { k: 'journo', tone: 'info', t: c => `Interest in ${c.clubName}'s coaching methods has come from outside the division.` },
    { k: 'fantv', tone: 'good', t: 'Somebody sent me a photo of their newborn in a club babygro. This is why I do it.' },
    { k: 'fan', tone: 'bad', t: 'They have changed the crest again. Third time in my life. Leave it alone.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} have kept possession better in the final fifteen minutes than any side around them.` },
    { k: 'club', tone: 'good', t: 'The players funded new kit for a local youth side this week. Quietly. 💙' },
    { k: 'fan', tone: 'info', t: 'Argued with my dad about a substitution and neither of us has backed down in three days.' },
    { k: 'pundit', tone: 'info', t: 'What he has done is unglamorous, repeatable and almost impossible to copy. That is the trick.' },
    { k: 'journo', tone: 'info', t: 'Not a single player has publicly complained about minutes this season. Rare.' },
    { k: 'fantv', tone: 'info', t: 'Doing a video on the ten worst refereeing decisions against us. It is a series now.' },
    { k: 'fan', tone: 'good', t: 'Thirty of us in a pub singing at eleven at night about a one nil win. Perfect.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} have conceded first in fewer than a third of their games.` },
    { k: 'club', tone: 'info', t: 'Please arrive early. We are expecting a full house. 🎫' },
    { k: 'fan', tone: 'bad', t: 'Somebody spilled a full pint down my back at the equaliser and I hugged him anyway.' },
    { k: 'pundit', tone: 'good', t: 'Every player knows exactly what the man next to him is going to do. That takes two years.' },
    { k: 'journo', tone: 'info', t: c => `${c.clubName} are being talked about as a model club, which nobody would have written three years ago.` },
    { k: 'fantv', tone: 'good', t: 'The away end sang my channel name once. I have never recovered.' },
    { k: 'fan', tone: 'info', t: 'Cannot explain to anyone why a nil nil in the rain was one of my favourite days.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} have used the fewest different centre-back pairings in the league.` },
    { k: 'club', tone: 'good', t: 'A record number of you renewed before the deadline. Thank you. 💙' }
  ];
  M7.tacticsTalk = [
    { k: 'pundit', tone: 'info', t: 'They funnel everything into one channel and then double up. It looks passive and it is a trap.' },
    { k: 'pundit', tone: 'good', t: 'Nobody in this division defends a two-goal lead as calmly as they do now.' },
    { k: 'fan', tone: 'info', t: 'We are the only side in this league who look like they have practised a throw-in.' },
    { k: 'fantv', tone: 'info', t: 'Made a diagram. It has fourteen arrows. I regret everything.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} complete more passes in the opposition half than they did last season.` },
    { k: 'pundit', tone: 'info', t: 'The number ten is doing a defensive job that nobody watching would notice.' },
    { k: 'fan', tone: 'bad', t: 'The second striker drops so deep he is basically a midfielder. Pick a plan.' },
    { k: 'pundit', tone: 'good', t: 'They win the ball back within eight seconds more often than anyone. That is the whole side.' }
  ];
  M7.fanCulture = [
    { k: 'fan', tone: 'good', t: 'New song about the manager to the tune of something dreadful. It is perfect.' },
    { k: 'fantv', tone: 'good', t: 'Filmed the tifo going up. Four hundred hours of work by twelve people.' },
    { k: 'club', tone: 'good', t: 'What a display from the stands tonight. Thank you. 🎨' },
    { k: 'fan', tone: 'good', t: 'Everyone stayed behind at full time and nobody knew why. Just did not want to leave.' },
    { k: 'fan', tone: 'info', t: 'We have a song for the third choice goalkeeper. He has played twice in four years.' },
    { k: 'rival', tone: 'info', t: 'Their tifo was better than ours and I am not happy about it.' },
    { k: 'fan', tone: 'good', t: 'The bloke who leads the singing lost his voice in October and has not stopped.' },
    { k: 'fantv', tone: 'good', t: 'Best moment of my season was six thousand people singing on a Tuesday.' }
  ];
  M7.deepStats = [
    { k: 'stats', tone: 'info', t: c => `${c.clubName} have the best defensive record against the top six.`, when: c => c.pos <= 12 },
    { k: 'stats', tone: 'info', t: c => `${c.clubName}'s average possession has fallen and their results have improved.` },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} take a higher proportion of shots from inside the six-yard box than most.` },
    { k: 'pundit', tone: 'info', t: 'The numbers say they should be higher. The numbers usually catch up.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} have the lowest rate of shots conceded from counter-attacks.` },
    { k: 'fan', tone: 'bad', t: 'If the underlying numbers were points we would have won the league four times.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} rank first for defensive actions in the opposition half.` },
    { k: 'pundit', tone: 'info', t: 'You can build a model of what they do because what they do is consistent. That is the compliment.' }
  ];
  M7.pressure = [
    { k: 'fan', tone: 'info', t: 'He has taken more abuse this month than anyone deserves for a job.' },
    { k: 'journo', tone: 'info', t: 'A short press conference today. Nobody could blame him.' },
    { k: 'pundit', tone: 'info', t: 'You can see it in his shoulders. That does not mean he is beaten.' },
    { k: 'fantv', tone: 'info', t: 'Whatever happens, the man has been decent with every one of us all season.' },
    { k: 'fan', tone: 'good', t: 'The whole ground stayed to applaud him off. First time I have seen that here.' },
    { k: 'club', tone: 'info', t: 'The manager has our full support and will take training as normal tomorrow.' }
  ];
  M7.boardHappy = [
    { k: 'journo', tone: 'good', t: c => `An improved deal has been offered at ${c.clubName}. The manager is said to be minded to sign.` },
    { k: 'fan', tone: 'good', t: 'Tie him down for five years and give him a say in everything.' },
    { k: 'club', tone: 'good', t: 'Delighted to confirm an extension. ✍️ 💙' },
    { k: 'pundit', tone: 'good', t: 'Rewarding a manager who is doing well sounds obvious. Very few boards manage it.' },
    { k: 'fantv', tone: 'good', t: 'Best news of the season and it is not close.' },
    { k: 'stats', tone: 'info', t: c => `Board confidence at ${c.clubName} sits at ${c.conf}.` }
  ];

  // fold the v3.6 additions in alongside the earlier ones
  const M8 = {};
  M8.weekly = [
    { k: 'fan', tone: 'good', t: 'Twelve years of misery and one good season wipes all of it. Football is a con and I am in.' },
    { k: 'pundit', tone: 'info', t: 'A manager who trusts his goalkeeper changes what the other ten can do.' },
    { k: 'journo', tone: 'info', t: c => `${c.clubName} have not made a panic decision all season. It shows.` },
    { k: 'fantv', tone: 'info', t: 'New series: bad tackles I still think about. Episode one is from 2004.' },
    { k: 'club', tone: 'good', t: 'Thank you to the volunteers who ran the food drive today. 💙' },
    { k: 'fan', tone: 'bad', t: 'Half the ground leaves on eighty-five and half the ground moans about atmosphere.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} have completed more successful pressures than anyone in the bottom half.`, when: c => c.pos > 8 },
    { k: 'fan', tone: 'good', t: 'Sat with my daughter and explained the offside rule badly for ninety minutes. Great day.' },
    { k: 'pundit', tone: 'info', t: 'Everything good here started with deciding what they were not going to be.' },
    { k: 'journo', tone: 'info', t: 'The manager has been in the building before seven every day for two years.' },
    { k: 'fantv', tone: 'good', t: 'Somebody quoted one of my videos in the away end. I am insufferable now.' },
    { k: 'fan', tone: 'info', t: 'Have watched four hundred games and understood maybe nine of them.' },
    { k: 'club', tone: 'info', t: 'Full ticket details for the away trip are now live. 🎟️' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} have gone unbeaten at home for longer than any side around them.`, when: c => c.pos <= 10 },
    { k: 'rival', tone: 'bad', t: 'Would love one week without hearing about their culture.' },
    { k: 'fan', tone: 'good', t: 'Someone brought a cake for the bloke who has sat behind us for twenty years. He cried.' },
    { k: 'pundit', tone: 'info', t: 'The mark of a good squad is that the eighteenth man knows the plan as well as the first.' },
    { k: 'journo', tone: 'info', t: c => `${c.clubName} have avoided a single disciplinary issue this season.` },
    { k: 'fantv', tone: 'bad', t: 'Two hours of editing and the file corrupted. I am going for a walk.' },
    { k: 'fan', tone: 'good', t: 'Being at a game is the only time I am not thinking about anything else. Worth every penny.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} have scored from more different players than most sides in the division.` },
    { k: 'club', tone: 'good', t: 'The academy graduation ceremony was this evening. Proud night. 🌱' },
    { k: 'fan', tone: 'bad', t: 'Nine quid to park half a mile away in a field. In February.' },
    { k: 'pundit', tone: 'info', t: 'They win the games they are supposed to win. It sounds small. It is the whole thing.' },
    { k: 'journo', tone: 'info', t: 'The manager has never once blamed a player publicly. Not once.' },
    { k: 'fantv', tone: 'info', t: 'Doing a video on the five best games at this ground. I will get all five wrong for somebody.' },
    { k: 'fan', tone: 'info', t: 'My whole personality is a football club and a train timetable.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} have conceded fewer shots on target than at any point in a decade.` },
    { k: 'club', tone: 'info', t: 'Coach travel is sold out. Additional coaches have been added. 🚌' },
    { k: 'fan', tone: 'good', t: 'Somebody in the away end lent me a coat because I was freezing. Never saw him again.' },
    { k: 'pundit', tone: 'info', t: 'Watch how they take a throw-in when they are winning. Everything here is deliberate.' },
    { k: 'journo', tone: 'info', t: c => `Two national outlets have asked to profile the manager. He has declined both.` },
    { k: 'fantv', tone: 'good', t: 'Doing the end of season video early because I cannot wait.' },
    { k: 'fan', tone: 'bad', t: 'Missed the winner because I went for a wee on eighty-eight minutes. Thirty years and I still do it.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} have played more academy minutes than any club in this division.` },
    { k: 'club', tone: 'good', t: 'Great to see so many of you at the memorial garden today. 💙' },
    { k: 'fan', tone: 'good', t: 'The floodlights, the smell of the pies, the noise before kick off. That is it. That is the whole thing.' },
    { k: 'pundit', tone: 'good', t: 'If he leaves, whoever comes next inherits the best-organised squad this club has had in twenty years.' },
    { k: 'journo', tone: 'info', t: 'Nobody at that club has said a word out of turn all year, which is its own achievement.' },
    { k: 'fantv', tone: 'info', t: 'Somebody asked for shorter videos. Here is a forty minute response.' },
    { k: 'fan', tone: 'info', t: 'Every year I say never again and every June I renew within an hour.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} have taken more points per pound of wage bill than anyone in this division.` },
    { k: 'club', tone: 'info', t: 'Player appearance at the club shop on Saturday morning. ✍️' },
    { k: 'fan', tone: 'good', t: 'A club is a place where a thousand strangers stand up at the same moment. Nothing else is like it.' },
    { k: 'pundit', tone: 'info', t: 'They have made themselves boring to play against and interesting to watch. Very few manage both.' }
  ];
  M8.tacticsTalk = [
    { k: 'pundit', tone: 'info', t: 'The centre-halves step out with the ball rather than passing it. That is a decision, not a habit.' },
    { k: 'fan', tone: 'info', t: 'We commit six to the box on corners now. Terrifying. Effective.' },
    { k: 'pundit', tone: 'good', t: 'Their shape without the ball has not changed all season and nobody has solved it.' },
    { k: 'fantv', tone: 'info', t: 'One more video about the double pivot and then I will stop. I will not stop.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} press in a narrow shape and force play wide more than any side here.` },
    { k: 'fan', tone: 'bad', t: 'The full backs are so high I have started watching them instead of the ball.' }
  ];
  M8.awards = [
    { k: 'club', tone: 'good', t: 'Manager of the Month. 🏅 Fully deserved.' },
    { k: 'fan', tone: 'good', t: 'Manager of the Month curse incoming. Worth it.' },
    { k: 'journo', tone: 'info', t: c => `Recognition for ${c.clubName}'s manager after an excellent run.` },
    { k: 'fantv', tone: 'good', t: 'He deserves it and he will hate the attention. Perfect.' },
    { k: 'pundit', tone: 'good', t: 'These awards usually go to whoever won most. Occasionally they go to whoever did most. This is one of those.' },
    { k: 'rival', tone: 'bad', t: 'Manager of the Month. Wonderful. We will hear about this for a decade.' }
  ];
  M8.milestone = [
    { k: 'fan', tone: 'good', t: 'A hundred games in charge. Four managers in the ten years before him did not manage that between them.' },
    { k: 'club', tone: 'good', t: 'A landmark for the boss today. 👏 💙' },
    { k: 'journo', tone: 'info', t: c => `A milestone at ${c.clubName}, reached with the club in a far better place than he found it.` },
    { k: 'pundit', tone: 'good', t: 'Longevity in this job is not luck. It is a hundred small correct decisions.' },
    { k: 'fantv', tone: 'good', t: 'Doing a retrospective. Watching the early games back is genuinely emotional.' },
    { k: 'stats', tone: 'info', t: c => `${c.seasons} seasons, ${c.trophies} trophies, reputation ${c.rep}.` }
  ];


  M8.fanCulture = [
    { k: 'fan', tone: 'good', t: 'Sang the same song for eleven minutes without stopping. Nobody knows why. Everybody joined in.' },
    { k: 'fan', tone: 'good', t: 'Away end unfurled a banner thanking the manager. He pointed at it for a full minute.' },
    { k: 'fantv', tone: 'good', t: 'Filmed the walk to the ground. Twelve thousand people going the same way. Gets me every time.' },
    { k: 'club', tone: 'good', t: 'That was some noise tonight. Thank you. 🔊💙' },
    { k: 'fan', tone: 'info', t: 'The scarf my nan knitted in 1994 is still going. Two holes and a lot of memories.' },
    { k: 'fan', tone: 'good', t: 'Whole away end applauded the home side off. Class from both.' },
    { k: 'rival', tone: 'info', t: 'Have to hand it to them, that away support does not stop when they are losing.' },
    { k: 'fan', tone: 'bad', t: 'Somebody started a chant about the chairman and the whole stand joined in. Awkward.' }
  ];
  M8.squadTalk = [
    { k: 'fan', tone: 'good', t: 'Best squad we have had since I started going and I do not think it is close.' },
    { k: 'pundit', tone: 'info', t: 'The squad has been built for one way of playing. Brave, and it only works if he stays.' },
    { k: 'journo', tone: 'info', t: c => `${c.clubName} will not need to do much in the summer, which is a new experience here.` },
    { k: 'fantv', tone: 'info', t: 'Ranking the squad by how much I would miss them. Controversial. Correct.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} have given minutes to more than twenty players this season.` },
    { k: 'fan', tone: 'bad', t: 'One centre half short and everybody in the ground can see it.' }
  ];
  M8.mediaTalk = [
    { k: 'fantv', tone: 'good', t: 'A national paper quoted the channel. Mum is very proud. I am insufferable.' },
    { k: 'journo', tone: 'info', t: c => `${c.clubName} are the most requested away trip among broadcasters this season.`, when: c => c.pos <= 6 },
    { k: 'pundit', tone: 'good', t: 'I have watched every one of their games this season. Nobody made me. That is the review.' },
    { k: 'fan', tone: 'bad', t: 'The pundits called us a long ball team. We have the second highest pass completion in the league.' },
    { k: 'fantv', tone: 'info', t: 'Doing a media watch video. It is mostly me being annoyed at people with better jobs.' },
    { k: 'journo', tone: 'info', t: 'The manager gave forty minutes to a local podcast and five to a national. Says a lot.' }
  ];
  M8.history = [
    { k: 'fan', tone: 'good', t: 'Twenty-two years ago we nearly went out of business. Look where we are now.' },
    { k: 'club', tone: 'good', t: 'A club legend turns seventy today. Happy birthday. 🎂💙' },
    { k: 'journo', tone: 'info', t: c => `${c.clubName} celebrate an anniversary this month. The old stand has stories in it.` },
    { k: 'fantv', tone: 'good', t: 'Interviewed a supporter who has been coming since 1961. Two hours. Every minute worth it.' },
    { k: 'fan', tone: 'info', t: 'My first shirt is in a frame. It cost my mum a week of wages.' },
    { k: 'pundit', tone: 'info', t: 'Clubs like this measure time in managers, not years.' }
  ];
  M8.moneyTalk = [
    { k: 'fan', tone: 'good', t: 'They have backed him with real money for the first time. Let us see what he does with it.' },
    { k: 'journo', tone: 'info', t: c => `${c.clubName} have made ${c.budget} available. The manager is not expected to spend it all.` },
    { k: 'pundit', tone: 'info', t: 'The clubs that win at this level spend late and spend once.' },
    { k: 'fantv', tone: 'bad', t: 'We have money and a shortlist and it is the middle of August.' },
    { k: 'stats', tone: 'info', t: c => `Transfer budget remaining: ${c.budget}.` },
    { k: 'fan', tone: 'bad', t: 'Money in the bank does not win football matches on a Tuesday.' }
  ];


  M8.deepStats = [
    { k: 'stats', tone: 'info', t: c => `${c.clubName} have the best record in the division from goalless situations after the hour.` },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} concede fewer shots per opposition possession than anyone here.` },
    { k: 'pundit', tone: 'info', t: 'Every number about this side has moved the right way for eighteen months. That is not variance.' },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} rank first for time spent in the opposition third without conceding a counter.` },
    { k: 'fan', tone: 'info', t: 'The stats people have loved us for a year and the results finally agree.' }
  ];
  M8.betting = [
    { k: 'stats', tone: 'info', t: c => `${c.clubName} remain longer odds than their position suggests.`, when: c => c.pos <= 6 },
    { k: 'fan', tone: 'info', t: 'Backed us at the start of the season out of loyalty. Loyalty is paying.' },
    { k: 'fantv', tone: 'info', t: 'Predictions video. Last time I got two of ten. Expectations are appropriately low.' },
    { k: 'pundit', tone: 'info', t: 'The market has underrated this manager since the day he arrived.' }
  ];
  M8.refs = [
    { k: 'fan', tone: 'bad', t: 'Six added on and they blew it after four. With us pushing. Every time.' },
    { k: 'pundit', tone: 'info', t: 'Consistency is all anybody asks for and it is the one thing nobody gets.' },
    { k: 'journo', tone: 'info', t: 'The manager was asked four times about the officials and answered none of them.' },
    { k: 'fan', tone: 'info', t: 'Watched it back. Correct decision. Furious about being wrong.' },
    { k: 'fantv', tone: 'bad', t: 'The referee thread is now a series. I hate that it is a series.' }
  ];
  M8.congestion = [
    { k: 'fan', tone: 'info', t: 'Four games in eleven days. This is what we asked for when we wanted cup runs.' },
    { k: 'pundit', tone: 'info', t: 'Something has to give in a run like this, and it is usually a hamstring.' },
    { k: 'journo', tone: 'info', t: c => `${c.clubName} face a punishing schedule. Rotation stops being optional.` },
    { k: 'club', tone: 'info', t: 'Busy fortnight ahead. We will need every one of you. 💙' },
    { k: 'fantv', tone: 'info', t: 'Fixture congestion video. Mostly me being worried about one midfielder.' }
  ];

  [MORE3, M4, M5, M6, M7, M8].forEach(bank => {
    Object.keys(bank).forEach(k => { POSTS[k] = (POSTS[k] || []).concat(bank[k]); });
  });
  Object.keys(MORE_REPLIES2).forEach(k => {
    MGR_REPLIES[k] = (MGR_REPLIES[k] || []).concat(MORE_REPLIES2[k]);
  });
  Object.keys(MORE_YOU2).forEach(k => {
    YOU_POSTS[k] = (YOU_POSTS[k] || []).concat(MORE_YOU2[k]);
  });

  /* ================= what sets it off =================
     Every call is fed the real event, so nothing in the feed describes
     something that did not happen. */

  const MSocial = {
    CAP, folk, pickFolk, meAccount, ctx, push, fire, burst, tag, handleOf,
    POSTS, YOU_POSTS, MGR_REPLIES,

    /* Count every distinct line the timeline can produce. */
    lineCount() {
      let n = 0;
      Object.keys(POSTS).forEach(k => { n += POSTS[k].length; });
      Object.keys(YOU_POSTS).forEach(k => { n += YOU_POSTS[k].length; });
      Object.keys(MGR_REPLIES).forEach(k => { n += MGR_REPLIES[k].length; });
      return n;
    },

    /* ---- after a match ---- */
    afterMatch(g, entry, fix) {
      if (!g.mgr) return;
      const club = State().club(g.mgr.club);
      const opp = State().club(entry.oppId);
      const c = ctx(g, {
        opp: opp.name, oppRating: opp.rating,
        us: entry.home ? entry.gf : entry.ga,
        them: entry.home ? entry.ga : entry.gf,
        gf: entry.gf, ga: entry.ga,
        comp: entry.compName || State().league(club.league).name,
        stageName: entry.stageName || '',
        replyBank: MGR_REPLIES
      });
      const margin = entry.gf - entry.ga;
      const cup = entry.comp === 'cup';
      const pools = [];

      if (cup) {
        if (entry.lifted) pools.push(POSTS.cupWon);
        else if (entry.out && /final/i.test(entry.stageName || '')) pools.push(POSTS.cupFinalLost);
        else if (entry.out) pools.push(POSTS.cupOut);
        else pools.push(POSTS.cupThrough);
      } else if (entry.result === 'W') {
        pools.push(POSTS.win);
        if (margin >= 3) pools.push(POSTS.bigWin);
        if (margin === 1) pools.push(POSTS.narrowWin);
        if (opp.rating >= club.rating + 3) pools.push(POSTS.derbyWin);
      } else if (entry.result === 'D') {
        pools.push(POSTS.draw);
      } else {
        pools.push(POSTS.loss);
        if (margin <= -3) pools.push(POSTS.heavyLoss);
        if (opp.rating <= club.rating - 3) pools.push(POSTS.derbyLoss);
      }
      if (entry.ga === 0 && entry.result !== 'L') pools.push(POSTS.cleanSheet);
      // won it having been behind at some point: the scoreline is the only
      // evidence there is, so require a win in which they scored at least twice
      if (entry.result === 'W' && entry.ga >= 2 && entry.gf > entry.ga) pools.push(POSTS.comeback);

      burst(g, pools, c, { heat: cup ? 1.9 : 1.25, tags: ['#' + c.tagName] },
        entry.lifted ? 3 : undefined);

      // the goal everyone is talking about gets its own post
      if (entry.wonder) {
        const w = entry.wonder;
        const bank = w.tier === 'century' ? POSTS.century
          : w.tier === 'wonder' ? POSTS.wonderGoal : POSTS.worldie;
        burst(g, [bank], ctx(g, Object.assign({}, c, { scorer: w.name })),
          { heat: w.tier === 'century' ? 3.4 : w.tier === 'wonder' ? 2.4 : 1.5,
            tags: ['#' + c.tagName, '#' + String(w.name).replace(/\W/g, '')] },
          w.tier === 'century' ? 3 : 2);
      }
      // a hat-trick, if anybody got one
      const tally = {};
      (entry.scorers || []).forEach(n => { tally[n] = (tally[n] || 0) + 1; });
      const three = Object.keys(tally).filter(n => tally[n] >= 3)[0];
      if (three) fire(g, POSTS.hattrick, ctx(g, Object.assign({}, c, { scorer: three })), { heat: 2 });

      // and what it cost
      const cas = entry.cas || {};
      (cas.hurt || []).forEach((h, i) => {
        if (i) return;
        const cc = ctx(g, Object.assign({}, c, { player: h.name, games: h.games, label: h.label }));
        fire(g, h.games >= 8 ? POSTS.longInjury : POSTS.injury, cc, { heat: h.games >= 8 ? 1.8 : 1.2 });
      });
      if (cas.red) fire(g, POSTS.redCard, ctx(g, Object.assign({}, c, { player: cas.red })), { heat: 1.7 });
      (cas.banned || []).forEach((b, i) => {
        if (i || b.why === 'sent off') return;
        fire(g, POSTS.suspended, ctx(g, Object.assign({}, c, { player: b.name, why: b.why })), { heat: 1.1 });
      });

      // form, and where that leaves you
      const form = (g.mgr.results || []).slice(-5).map(r => r.result);
      if (form.length === 5 && form.every(r => r === 'W')) fire(g, POSTS.streakGood, c, { heat: 1.7 });
      else if (form.length === 5 && form.indexOf('W') < 0) fire(g, POSTS.streakBad, c, { heat: 1.7 });
      if (c.played >= 6) {
        const table = global.Engine.Season.standings(g, club.league);
        if (c.pos === 1) fire(g, POSTS.topOfTable, c, { heat: 1.6 });
        else if (c.pos <= 3 && c.played > (g.mgr.rounds || []).length * 0.6) fire(g, POSTS.titleRace, c, { heat: 1.5 });
        else if (c.pos >= table.length - 2) fire(g, POSTS.relegationFight, c, { heat: 1.5 });
      }
      // the ambient chatter between fixtures rolls in with the reaction
      if (U().chance(0.55)) MSocial.weekly(g);
      if (c.conf <= 24) { fire(g, POSTS.sackWatch, c, { heat: 1.8 }); fire(g, POSTS.pressure, c, { heat: 1.2 }); }
      else if (c.conf >= 84) fire(g, POSTS.boardHappy, c, { heat: 1.1 });
      // beating somebody well above you is its own story
      if (entry.result === 'W' && opp.rating >= club.rating + 4)
        fire(g, POSTS.bigGameWin, c, { heat: 2.1, tags: ['#' + c.tagName] });
      // a clean sheet is the back four's, not just the keeper's
      if (entry.ga === 0 && U().chance(0.3)) fire(g, POSTS.defenceTalk, c, { heat: 1 });
      if (entry.ga === 0 && U().chance(0.22)) fire(g, POSTS.keeperTalk, c, { heat: 1 });
      if (entry.gf >= 2 && U().chance(0.22)) fire(g, POSTS.strikerTalk, c, { heat: 1 });
      // fixture pile-up, when the cups are actually giving you one
      if ((g.mgr.cups || []).filter(x => x.alive).length >= 2 && U().chance(0.14))
        fire(g, POSTS.congestion, c, { heat: 1 });
      // and the referee, when it went against you
      if (entry.result !== 'W' && U().chance(0.16)) fire(g, POSTS.refs, c, { heat: 1.1 });
      // half time is a story of its own now and then
      if (U().chance(0.09)) fire(g, POSTS.tunnel, c, { heat: 1 });
      // and a captain gets talked about after the games he decides
      if (entry.result === 'W' && U().chance(0.12)) fire(g, POSTS.captainTalk, c, { heat: 1 });
      // 250 games, 500 games — the round numbers
      if (c.played && (g.mgr.board.seasons >= 3) && U().chance(0.05))
        fire(g, POSTS.milestone, c, { heat: 1 });
    },

    /* ---- a quiet week ---- */
    weekly(g) {
      if (!g.mgr) return;
      const c = ctx(g, { replyBank: MGR_REPLIES });
      const n = U().weighted([[1, 5], [2, 4], [3, 2]]);
      for (let i = 0; i < n; i++) fire(g, POSTS.weekly, c, { heat: 0.75, replies: U().int(0, 2) });
      // and the occasional off-topic week — the timeline talks about more than
      // the last result, which is most of what makes it feel like one
      const side = [
        [0.22, POSTS.moneyTalk], [0.16, POSTS.rivalNews], [0.12, POSTS.youth],
        [0.30, POSTS.tacticsTalk], [0.24, POSTS.fanCulture], [0.20, POSTS.mediaTalk],
        [0.18, POSTS.squadTalk], [0.16, POSTS.awayDays], [0.14, POSTS.history],
        [0.14, POSTS.defenceTalk], [0.13, POSTS.strikerTalk], [0.11, POSTS.keeperTalk],
        [0.12, POSTS.contrarian], [0.11, POSTS.contractTalk], [0.10, POSTS.matchdayEve],
        [0.08, POSTS.intBreak], [0.08, POSTS.winter],
        // v3.6: the club as an institution, and the people in it
        [0.13, POSTS.captainTalk], [0.11, POSTS.veteran], [0.11, POSTS.benchWarmer],
        [0.10, POSTS.crowdFavourite], [0.10, POSTS.exPlayer], [0.10, POSTS.awards],
        [0.09, POSTS.academy], [0.09, POSTS.staff], [0.08, POSTS.stadium],
        [0.08, POSTS.commercial], [0.07, POSTS.ownership], [0.09, POSTS.deepStats],
        [0.08, POSTS.socialMeta], [0.08, POSTS.tv], [0.07, POSTS.money],
        [0.07, POSTS.betting], [0.06, POSTS.fantasy], [0.06, POSTS.weather],
        [0.06, POSTS.merry], [0.05, POSTS.loanTalk], [0.05, POSTS.transferRequest],
        [0.05, POSTS.preseason]
      ];
      side.forEach(pair => { if (U().chance(pair[0])) fire(g, pair[1], c, { heat: 0.9 }); });
      if (U().chance(0.5)) fire(g, POSTS.weekly2, c, { heat: 0.8, replies: U().int(0, 2) });
    },

    /* ---- the market ---- */
    signing(g, player, fee, elite) {
      if (!g.mgr) return;
      const c = ctx(g, { player: player.name, ovr: player.ovr, age: player.age,
        fee: U().cash(fee || player.value || 0), replyBank: MGR_REPLIES });
      burst(g, [elite || player.ovr >= 88 ? POSTS.bigSigning : POSTS.signing], c,
        { heat: elite ? 2.6 : 1.5, tags: ['#' + c.tagName] }, elite ? 3 : 2);
    },
    sale(g, player, fee) {
      if (!g.mgr) return;
      const c = ctx(g, { player: player.name, fee: U().cash(fee || 0), replyBank: MGR_REPLIES });
      burst(g, [POSTS.sale], c, { heat: 1.3 }, 2);
    },

    /* ---- the end of a season ---- */
    season(g, review) {
      if (!g.mgr) return;
      const c = ctx(g, { replyBank: MGR_REPLIES });
      if (review.champion) {
        burst(g, [POSTS.champions], c, { heat: 3.2, tags: ['#' + c.tagName, '#Champions'] }, 4);
        burst(g, [POSTS.parade], c, { heat: 2.4 }, 2);
      }
      else if (review.met) burst(g, [POSTS.seasonGood], c, { heat: 1.5 }, 2);
      else burst(g, [POSTS.seasonBad], c, { heat: 1.5 }, 2);
      (review.offers || []).slice(0, 1).forEach(o => {
        fire(g, POSTS.linked, ctx(g, Object.assign({}, c, { suitor: o.name })), { heat: 2.2 });
      });
      if (review.goalOfSeason) {
        fire(g, POSTS.goalOfSeason,
          ctx(g, Object.assign({}, c, { scorer: review.goalOfSeason.name })), { heat: 2.4 });
      }
      // nothing spent, and the timeline noticed
      if (g.mgr.budget > 40000000 && !(g.mgr.log || []).some(l => l.k === 'in'))
        fire(g, POSTS.windowQuiet, c, { heat: 1.3 });
      fire(g, POSTS.preseason, c, { heat: 1 });
      if (U().chance(0.4)) fire(g, POSTS.merry, c, { heat: 1 });
    },

    youth(g, names) {
      if (!g.mgr || !names || !names.length) return;
      const c = ctx(g, { kid: names[0], replyBank: MGR_REPLIES });
      fire(g, POSTS.youth, c, { heat: 1.2 });
      if (U().chance(0.5)) fire(g, POSTS.debut, c, { heat: 1.1 });
    },
    /* Anybody whose absence has just run out. Called from the season roll and
       after a match, so the timeline notices a return the way it noticed the
       injury. */
    backFromInjury(g, names) {
      if (!g.mgr || !names || !names.length) return;
      fire(g, POSTS.returning, ctx(g, { player: names[0], replyBank: MGR_REPLIES }), { heat: 1.2 });
    },
    retired(g, names) {
      if (!g.mgr || !names || !names.length) return;
      fire(g, POSTS.retirement, ctx(g, { player: names[0], replyBank: MGR_REPLIES }), { heat: 1.3 });
    },

    /* ---- the job itself ---- */
    arrived(g) {
      if (!g.mgr) return;
      g.mgr.feed = [];                       // a new club, a new timeline
      g.mgr.folk = null;
      burst(g, [POSTS.arrived], ctx(g, { replyBank: MGR_REPLIES }),
        { heat: 1.9, tags: ['#' + tag(State().club(g.mgr.club).name)] }, 2);
    },
    leaving(g, suitorName) {
      if (!g.mgr) return;
      burst(g, [POSTS.leaving], ctx(g, { suitor: suitorName || 'another club', replyBank: MGR_REPLIES }),
        { heat: 2.6 }, 3);
    },
    sacked(g) {
      if (!g.mgr) return;
      burst(g, [POSTS.sacked], ctx(g, { replyBank: MGR_REPLIES }), { heat: 2.4 }, 3);
    },

    /* ---- you, posting ---- */
    canPost(g) {
      return (g.mgr.lastPost == null) || (g.mgr.round - g.mgr.lastPost) >= 1;
    },
    postAs(g, key) {
      const bank = YOU_POSTS[key] || YOU_POSTS.calm;
      const c = ctx(g, { replyBank: MGR_REPLIES });
      const tone = key === 'honest' ? 'bad' : key === 'fire' || key === 'defiant' ? 'hot' : 'good';
      const post = push(g, { k: 'you', tone, t: U().pick(bank) }, c,
        { heat: 2.2, replies: U().int(2, 3), tags: ['#' + c.tagName] });
      if (post) {
        g.mgr.lastPost = g.mgr.round;
        // saying the right thing lifts a dressing room, slightly
        const swing = key === 'fire' ? U().rnd(0.5, 2.2) : key === 'praise' ? U().rnd(0.4, 1.6)
          : key === 'honest' ? U().rnd(0.2, 1.2) : key === 'defiant' ? U().rnd(-0.8, 1.4) : U().rnd(0, 0.9);
        g.mgr.board.confidence = U().clamp(g.mgr.board.confidence + swing, 0, 100);
      }
      return post;
    },

    trending(g) {
      const feed = g.mgr.feed || [];
      const counts = {};
      feed.slice(0, 24).forEach(f => (f.tags || []).forEach(t => counts[t] = (counts[t] || 0) + 1));
      const club = State().club(g.mgr.club);
      ['#' + tag(club.name), '#' + tag(State().league(club.league).name)]
        .forEach(t => counts[t] = (counts[t] || 0) + 1);
      return Object.keys(counts).sort((a, b) => counts[b] - counts[a]).slice(0, 5);
    },

    followers(g) {
      const rep = global.Manager.reputation(g);
      const club = State().club(g.mgr.club);
      return Math.round(Math.pow(10, 2.6 + rep * 0.048)
        + global.Manager.cabinet(g).length * 14000 + club.rating * 220);
    }
  };

  global.MSocial = MSocial;
})(window);
