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
    let text;
    try { text = entry.t(c); } catch (e) { return null; }
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
    { k: 'fan', tone: 'good', t: c => `Three points and I can enjoy my Sunday. That is all I ask for.` },
    { k: 'fan', tone: 'good', t: c => `Whatever the gaffer said at half time, say it again next week.` },
    { k: 'fantv', tone: 'good', t: c => `WE WON. Reaction video is up. I am hoarse. Worth it.` },
    { k: 'journo', tone: 'good', t: c => `${c.clubName} beat ${c.opp} without ever really having to get out of second gear.` },
    { k: 'pundit', tone: 'good', t: c => `That was a manager's win. The shape never broke once, even when they pushed.` },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} have now won ${c.wins} of ${c.played} this season.` },
    { k: 'fan', tone: 'good', t: c => `Not pretty. Do not care. Next.` },
    { k: 'journo', tone: 'info', t: c => `Another three points for ${c.clubName}, who move on with a manager quietly building something.` },
    { k: 'fan', tone: 'good', t: c => `The ${c.formation} is finally clicking. About time somebody trusted it.` },
    { k: 'pundit', tone: 'info', t: c => `${c.opp} will feel they gave that away. ${c.clubName} will say they took it. Both are right.` },
    { k: 'fantv', tone: 'good', t: c => `Some of you were calling for him in August. Where are you now? WHERE ARE YOU NOW.` },
    { k: 'rival', tone: 'info', t: c => `Fair play, ${c.clubName} deserved that. Doesn't mean I have to enjoy it.` },
    { k: 'club', tone: 'good', t: c => `That's another one. 👏 Safe home, everyone.` },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} in ${c.style.toLowerCase()} shape: ${c.us} scored, ${c.them} conceded. The plan worked.` },
    { k: 'fan', tone: 'good', t: c => `My dad has been coming here since 1974 and he was singing on the way out. That'll do.` }
  ];

  POSTS.bigWin = [
    { k: 'fantv', tone: 'hot', t: c => `${c.us}-${c.them}. ${c.us}-${c.them}!! I have no voice left and no regrets.` },
    { k: 'club', tone: 'good', t: c => `FULL TIME | ${c.clubName} ${c.us}-${c.them} ${c.opp} 🔥🔥🔥` },
    { k: 'journo', tone: 'good', t: c => `${c.clubName} did not just beat ${c.opp}, they dismantled them. The manager barely left his seat.` },
    { k: 'fan', tone: 'hot', t: c => `I have watched this club my whole life and that was one of the best halves I have ever seen.` },
    { k: 'pundit', tone: 'good', t: c => `You do not get results like that by accident. That was coached, drilled and executed.` },
    { k: 'stats', tone: 'info', t: c => `${c.us} goals. ${c.clubName}'s biggest win of the season so far.` },
    { k: 'rival', tone: 'bad', t: c => `Embarrassing from us. ${c.clubName} could have had eight and everybody knows it.` },
    { k: 'fan', tone: 'hot', t: c => `TELL ME AGAIN HOW WE ARE IN A CRISIS` },
    { k: 'fantv', tone: 'hot', t: c => `Emergency livestream tonight and it is a happy one for once. Bring snacks.` },
    { k: 'journo', tone: 'good', t: c => `A statement result. ${c.clubName} have not scored ${c.us} in a league game in a very long time.` },
    { k: 'pundit', tone: 'good', t: c => `${c.opp} could not lay a glove on them. That is a side that knows exactly what it is doing.` },
    { k: 'club', tone: 'good', t: c => `Turn the volume up. 🔊 ${c.us}-${c.them}.` },
    { k: 'fan', tone: 'good', t: c => `Told my mate to come to this one and now he wants a season ticket. Sold.` },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} scored ${c.us} against ${c.opp}. Nobody in this division has done that to them this year.` }
  ];

  POSTS.narrowWin = [
    { k: 'fan', tone: 'good', t: c => `1-0. Not a classic. Do not care even slightly.` },
    { k: 'pundit', tone: 'good', t: c => `Winning ugly is a skill. That is a team being managed properly.` },
    { k: 'journo', tone: 'info', t: c => `${c.clubName} got over the line against ${c.opp}. Not much in it, but the table does not ask how.` },
    { k: 'fantv', tone: 'good', t: c => `That was TENSE. My blood pressure cannot take a whole season of this.` },
    { k: 'fan', tone: 'good', t: c => `Ninety minutes of my life I will never get back and three points I will never give back.` },
    { k: 'stats', tone: 'info', t: c => `Fourth one-goal win of the season for ${c.clubName}. Fine margins, right side of them.` },
    { k: 'rival', tone: 'bad', t: c => `They got away with one there and the timeline will call it a masterclass.` },
    { k: 'pundit', tone: 'info', t: c => `The interesting bit was the last fifteen minutes. They saw it out without panicking, which is new.` },
    { k: 'club', tone: 'good', t: c => `Hard-earned. 💪 ${c.us}-${c.them}.` },
    { k: 'fan', tone: 'good', t: c => `I aged four years in stoppage time and I would do it again.` }
  ];

  POSTS.draw = [
    { k: 'club', tone: 'info', t: c => `FULL TIME | ${c.clubName} ${c.us}-${c.them} ${c.opp}. A point.` },
    { k: 'fan', tone: 'info', t: c => `A point away from home is a point. Some of you need to hear that.` },
    { k: 'fantv', tone: 'bad', t: c => `Two dropped, not one gained. I am not doing the positive spin tonight.` },
    { k: 'journo', tone: 'info', t: c => `${c.clubName} and ${c.opp} cancelled each other out. Nobody will remember it by Tuesday.` },
    { k: 'pundit', tone: 'info', t: c => `The manager will take it. The supporters will not. Both positions are defensible.` },
    { k: 'fan', tone: 'bad', t: c => `We do not win enough of these to be drawing them.` },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} have drawn too many. Points dropped from winning positions is becoming a theme.` },
    { k: 'rival', tone: 'info', t: c => `Point each, everyone goes home. Boring, but I will take it against them.` },
    { k: 'pundit', tone: 'info', t: c => `A ${c.formation} against a side sitting that deep was always going to end like this.` },
    { k: 'fan', tone: 'info', t: c => `Draw. Fine. Onwards.` },
    { k: 'journo', tone: 'info', t: c => `Neither side did enough. The manager's face at full time said more than the press conference will.` }
  ];

  POSTS.loss = [
    { k: 'club', tone: 'bad', t: c => `FULL TIME | ${c.clubName} ${c.us}-${c.them} ${c.opp}. We go again on Saturday.` },
    { k: 'fantv', tone: 'bad', t: c => `Same problems. Same result. I am tired of making the same video.` },
    { k: 'fan', tone: 'bad', t: c => `Four hours on a coach for that. FOUR HOURS.` },
    { k: 'fan', tone: 'bad', t: c => `We were second to everything. That is on the manager, not the players.` },
    { k: 'journo', tone: 'bad', t: c => `${c.opp} deserved it. ${c.clubName} never got going and the manager knew it by the half hour.` },
    { k: 'pundit', tone: 'info', t: c => `Losing happens. Losing like that, without a plan B, is the bit that should worry them.` },
    { k: 'rival', tone: 'good', t: c => `Away at ${c.clubName}, three points, lovely stuff. Thanks for the hospitality.` },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} are ${c.posOrd} and have lost ${c.played - c.wins} of ${c.played}.` },
    { k: 'fan', tone: 'info', t: c => `Everyone calm down. It is one game. We have all seen worse.` },
    { k: 'fantv', tone: 'bad', t: c => `Right. Somebody explain the ${c.formation} to me. Slowly. With diagrams.` },
    { k: 'pundit', tone: 'bad', t: c => `They had no way of hurting ${c.opp} and they had ninety minutes to work one out.` },
    { k: 'club', tone: 'bad', t: c => `Not our night. Thank you to everyone who travelled. 💙` },
    { k: 'fan', tone: 'bad', t: c => `I am not angry. I am just very, very tired.` }
  ];

  POSTS.heavyLoss = [
    { k: 'fantv', tone: 'bad', t: c => `${c.us}-${c.them}. I have nothing. No analysis, no jokes, nothing.` },
    { k: 'fan', tone: 'bad', t: c => `That is the worst I have seen us play in years and I have seen some things.` },
    { k: 'journo', tone: 'bad', t: c => `${c.them} goals conceded. The manager stood on the touchline for the last twenty minutes and did not move.` },
    { k: 'pundit', tone: 'bad', t: c => `You can lose. You cannot lose like that. There was no shape and no fight after the second goal.` },
    { k: 'rival', tone: 'hot', t: c => `Framing this scoreline. ${c.us}-${c.them} at ${c.clubName}. What a day out.` },
    { k: 'fan', tone: 'bad', t: c => `Half the ground was gone by the eightieth minute. That tells you everything.` },
    { k: 'club', tone: 'bad', t: c => `That was not good enough. We know it. We are sorry.` },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} conceded ${c.them}. Their heaviest defeat of the season.` },
    { k: 'fantv', tone: 'bad', t: c => `Do not @ me tonight. I will be back tomorrow when I can form sentences.` },
    { k: 'fan', tone: 'bad', t: c => `I want to see fight. I do not need us to be good, I need us to try.` },
    { k: 'pundit', tone: 'info', t: c => `The manager has some serious thinking to do this week, and not about tactics.` }
  ];

  POSTS.cleanSheet = [
    { k: 'club', tone: 'good', t: c => `Another clean sheet. 🧱 Not a thing got past them.` },
    { k: 'pundit', tone: 'good', t: c => `The back four barely had to make a tackle. That is what good structure looks like.` },
    { k: 'fan', tone: 'good', t: c => `Do not care about the goals. That was a defensive performance and I loved every second.` },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} keep another clean sheet. Their expected goals against is among the best in the division.` },
    { k: 'journo', tone: 'good', t: c => `${c.opp} had chances and found a wall. The manager has fixed the thing everybody said he could not fix.` },
    { k: 'fantv', tone: 'good', t: c => `NOTHING. They got NOTHING. Best defensive display of the season.` },
    { k: 'fan', tone: 'good', t: c => `Clean sheets win you leagues. Write that down.` }
  ];

  POSTS.derbyWin = [
    { k: 'fantv', tone: 'hot', t: c => `BEAT ${c.opp.toUpperCase()}. Nothing else in football feels like this. NOTHING.` },
    { k: 'fan', tone: 'hot', t: c => `I do not care about anything else this season now. We beat ${c.opp}.` },
    { k: 'club', tone: 'good', t: c => `Bragging rights stay here. 😌 ${c.us}-${c.them}.` },
    { k: 'rival', tone: 'bad', t: c => `Losing to ${c.clubName} is the one I cannot take. Every year. Every single year.` },
    { k: 'journo', tone: 'good', t: c => `The manager celebrated that one like a supporter. He understands what this fixture is.` },
    { k: 'fan', tone: 'hot', t: c => `Booking Monday off work. Do not need a reason.` },
    { k: 'pundit', tone: 'good', t: c => `He got the big call right in the big game. That is what they pay him for.` }
  ];

  POSTS.derbyLoss = [
    { k: 'fan', tone: 'bad', t: c => `Losing to ${c.opp} is the one that actually hurts. I will be quiet for a week.` },
    { k: 'fantv', tone: 'bad', t: c => `Of all the games. Of ALL the games. I cannot look at my phone.` },
    { k: 'rival', tone: 'hot', t: c => `Beat ${c.clubName}. Best day of the year and it is not close.` },
    { k: 'pundit', tone: 'bad', t: c => `He set up not to lose that one and lost it anyway. That is the worst of both worlds.` },
    { k: 'fan', tone: 'bad', t: c => `Avoiding the group chat, the office and the internet until Thursday.` },
    { k: 'journo', tone: 'bad', t: c => `A long, quiet walk down the tunnel for the manager. This is the result they judge you on here.` }
  ];
  /* ---- the cups ---- */
  POSTS.cupThrough = [
    { k: 'club', tone: 'good', t: c => `Through to the next round of the ${c.comp}. 🏆` },
    { k: 'fan', tone: 'good', t: c => `Cup runs are the best part of football and nobody will convince me otherwise.` },
    { k: 'fantv', tone: 'good', t: c => `THROUGH. Get the hat out. We are dreaming again and I refuse to be sensible.` },
    { k: 'journo', tone: 'good', t: c => `${c.clubName} navigate the ${c.stageName.toLowerCase()} of the ${c.comp} without much fuss.` },
    { k: 'pundit', tone: 'info', t: c => `He rotated and still won it. That is a squad being managed properly across a long season.` },
    { k: 'fan', tone: 'good', t: c => `Next round. Do not tell me who we want. I want everyone.` },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} are still in the ${c.comp}. One tie closer.` },
    { k: 'fan', tone: 'hot', t: c => `WEMBLEY. I said it. I am saying it in the ${c.stageName.toLowerCase()} and I do not care.` },
    { k: 'club', tone: 'good', t: c => `Job done. Onto the next one. 🎩` }
  ];

  POSTS.cupOut = [
    { k: 'fantv', tone: 'bad', t: c => `Out of the ${c.comp}. In the ${c.stageName.toLowerCase()}. To THEM.` },
    { k: 'fan', tone: 'bad', t: c => `One game. One chance. Gone for another year.` },
    { k: 'journo', tone: 'bad', t: c => `${c.clubName} are out of the ${c.comp}, beaten by ${c.opp} in the ${c.stageName.toLowerCase()}.` },
    { k: 'pundit', tone: 'info', t: c => `Knockout football does not care how well you have been playing. It only asks about one night.` },
    { k: 'fan', tone: 'info', t: c => `Right. League it is. Fewer distractions, they always say.` },
    { k: 'rival', tone: 'good', t: c => `Knocked ${c.clubName} out. Bus back is going to be lively.` },
    { k: 'club', tone: 'bad', t: c => `Our ${c.comp} ends here. Thank you to everyone who followed us in it. 💙` },
    { k: 'fan', tone: 'bad', t: c => `I had booked the day off for the final. That is the bit that stings.` },
    { k: 'fantv', tone: 'bad', t: c => `Every year. EVERY YEAR. I am going to bed.` }
  ];

  POSTS.cupWon = [
    { k: 'club', tone: 'hot', t: c => `🏆 ${c.comp.toUpperCase()} WINNERS 🏆 Enjoy this, all of you.` },
    { k: 'fantv', tone: 'hot', t: c => `WE HAVE WON THE ${c.comp.toUpperCase()}. I am crying on a livestream and I do not care.` },
    { k: 'fan', tone: 'hot', t: c => `Silverware. Actual silverware. My grandad never saw us win one of these.` },
    { k: 'journo', tone: 'good', t: c => `${c.clubName} lift the ${c.comp}. The manager's first trophy here, and it will not be the last.` },
    { k: 'pundit', tone: 'good', t: c => `He built to that final all season. Rotated in the early rounds, went full strength when it mattered.` },
    { k: 'stats', tone: 'info', t: c => `${c.comp} winners: ${c.clubName}. That is ${c.trophies} for this manager.` },
    { k: 'rival', tone: 'bad', t: c => `Congratulations to ${c.clubName}. Said through absolutely gritted teeth.` },
    { k: 'fan', tone: 'hot', t: c => `Getting the date tattooed. My wife says no. It is happening.` },
    { k: 'club', tone: 'good', t: c => `Bus parade details to follow. 🚌 Yes, really.` },
    { k: 'fan', tone: 'hot', t: c => `I was at the ${c.stageName.toLowerCase()}. I was at all of them. This is OURS.` }
  ];

  POSTS.cupFinalLost = [
    { k: 'fan', tone: 'bad', t: c => `So close. So, so close. I do not want to talk about it.` },
    { k: 'journo', tone: 'bad', t: c => `${c.clubName} fall at the last. A final is the cruellest place to lose one.` },
    { k: 'fantv', tone: 'bad', t: c => `Losing a final is worse than not getting there. I said it. Fight me.` },
    { k: 'pundit', tone: 'info', t: c => `They were the better side for an hour. Finals do not always reward that.` },
    { k: 'club', tone: 'bad', t: c => `Heartbreaking. Proud of every one of them. We will be back. 💙` },
    { k: 'fan', tone: 'info', t: c => `We got to a final. Two years ago we would have taken that. Chin up.` }
  ];

  /* ---- the goals people remember ---- */
  POSTS.worldie = [
    { k: 'fantv', tone: 'hot', t: c => `${c.scorer.toUpperCase()}. WHAT WAS THAT. Slow motion, four angles, tonight.` },
    { k: 'fan', tone: 'hot', t: c => `Have watched ${c.scorer}'s goal eleven times. Going for twelve.` },
    { k: 'club', tone: 'good', t: c => `⚽ ${c.scorer}. Watch it again. And again. 🔁` },
    { k: 'journo', tone: 'good', t: c => `${c.scorer} produced the best goal of this round of fixtures and it was not close.` },
    { k: 'stats', tone: 'info', t: c => `${c.scorer}'s strike had an xG of about 0.04. Some players do not read the numbers.` },
    { k: 'pundit', tone: 'good', t: c => `Do not overthink it. That is a player of real quality doing something the rest cannot.` },
    { k: 'rival', tone: 'info', t: c => `Hate to say it but ${c.scorer}'s goal was ridiculous. Credit where it is due.` },
    { k: 'fan', tone: 'good', t: c => `Sent that to my brother who supports nobody. Even he replied.` }
  ];

  POSTS.wonderGoal = [
    { k: 'fantv', tone: 'hot', t: c => `I HAVE BEEN DOING THIS CHANNEL FOR NINE YEARS. THAT IS THE BEST GOAL I HAVE EVER FILMED.` },
    { k: 'club', tone: 'hot', t: c => `We are not sure what to say. ⚽ ${c.scorer}. 🤯` },
    { k: 'journo', tone: 'good', t: c => `${c.scorer} has just scored a goal that will be on television for the next twenty years.` },
    { k: 'fan', tone: 'hot', t: c => `I was in the ground for it. I will be telling people about it when I am eighty.` },
    { k: 'pundit', tone: 'good', t: c => `I have watched football for forty years and I stood up in the studio. That does not happen.` },
    { k: 'stats', tone: 'info', t: c => `${c.scorer}'s goal: the lowest-probability finish recorded in this division all season.` },
    { k: 'rival', tone: 'good', t: c => `We lost and I am still applauding. ${c.scorer}, that was absurd.` },
    { k: 'fan', tone: 'hot', t: c => `The noise in the ground. I have never heard anything like it. My ears are still ringing.` },
    { k: 'fantv', tone: 'hot', t: c => `Cancelling everything. Doing a full breakdown. This deserves an hour.` }
  ];

  POSTS.century = [
    { k: 'club', tone: 'hot', t: c => `No caption. Just watch. ⚽ ${c.scorer}. 🐐` },
    { k: 'journo', tone: 'hot', t: c => `Whatever you are doing, stop, and go and watch what ${c.scorer} has just done. Goal of the century talk, and it is not hyperbole.` },
    { k: 'fantv', tone: 'hot', t: c => `THE GREATEST GOAL I HAVE EVER SEEN. NOT AT THIS CLUB. ANYWHERE. EVER.` },
    { k: 'pundit', tone: 'hot', t: c => `I have never said this on air before. That is the best goal I have seen in my lifetime.` },
    { k: 'fan', tone: 'hot', t: c => `I was THERE. I was there for that. Nothing that happens to me for the rest of the season matters.` },
    { k: 'rival', tone: 'good', t: c => `I hate ${c.clubName} with everything I have and I stood up and applauded. That was history.` },
    { k: 'stats', tone: 'info', t: c => `We do not have a model for what ${c.scorer} just did. Genuinely. It is off the chart.` },
    { k: 'fan', tone: 'hot', t: c => `Naming my son after him. Consulted nobody. It is done.` },
    { k: 'journo', tone: 'good', t: c => `Every newspaper front page tomorrow. Not the back page. The front.` }
  ];

  POSTS.hattrick = [
    { k: 'club', tone: 'good', t: c => `Match ball secured. 🎩 ${c.scorer} with three.` },
    { k: 'fantv', tone: 'hot', t: c => `THREE GOALS. ${c.scorer.toUpperCase()}. Get him a statue, get him a road, get him whatever he wants.` },
    { k: 'fan', tone: 'hot', t: c => `${c.scorer} has taken that game and put it in his pocket.` },
    { k: 'journo', tone: 'good', t: c => `A hat-trick for ${c.scorer}, and the manager took him off to a standing ovation.` },
    { k: 'stats', tone: 'info', t: c => `${c.scorer} now has ${c.topGoals} for the season.` },
    { k: 'pundit', tone: 'good', t: c => `Three different finishes. Power, placement, composure. That is a complete striker's day.` },
    { k: 'rival', tone: 'bad', t: c => `Our defenders should not be allowed home tonight. ${c.scorer} did what he liked.` }
  ];

  /* ---- the market ---- */
  POSTS.signing = [
    { k: 'club', tone: 'good', t: c => `✍️ ${c.player} has signed for ${c.clubName}. Welcome. #${c.tagName}` },
    { k: 'fan', tone: 'good', t: c => `We have actually signed ${c.player}. I refreshed this app forty times today.` },
    { k: 'journo', tone: 'info', t: c => `${c.clubName} complete the signing of ${c.player} for ${c.fee}. The manager has been pushing for this one for weeks.` },
    { k: 'fantv', tone: 'hot', t: c => `${c.player.toUpperCase()} IS OURS. Emergency stream. Now. GO.` },
    { k: 'stats', tone: 'info', t: c => `${c.player} joins ${c.clubName}: rated ${c.ovr}, aged ${c.age}, for ${c.fee}.` },
    { k: 'pundit', tone: 'good', t: c => `Good business. He fills the exact hole that has cost them points all season.` },
    { k: 'rival', tone: 'bad', t: c => `Of course they signed him. Of course they did.` },
    { k: 'fan', tone: 'hot', t: c => `Shirt ordered. Name on the back. No I will not be talked out of it.` },
    { k: 'journo', tone: 'info', t: c => `${c.fee} for ${c.player}. A statement of intent from ${c.clubName}, and from the manager.` },
    { k: 'pundit', tone: 'info', t: c => `The fee will get the headlines. The fit is the interesting part, and the fit is right.` },
    { k: 'fan', tone: 'good', t: c => `Finally. FINALLY. We have been crying out for this since August.` },
    { k: 'club', tone: 'good', t: c => `He's here. 📸 More from ${c.player}'s first day soon.` }
  ];

  POSTS.bigSigning = [
    { k: 'fantv', tone: 'hot', t: c => `${c.fee.toUpperCase()}. FOR ${c.player.toUpperCase()}. AT OUR CLUB. I need a moment.` },
    { k: 'journo', tone: 'hot', t: c => `Extraordinary. ${c.player} to ${c.clubName} for ${c.fee}. This changes what this club is.` },
    { k: 'fan', tone: 'hot', t: c => `I have supported this club for thirty years and we have never signed anybody like ${c.player}.` },
    { k: 'club', tone: 'hot', t: c => `Some signings need a caption. This one does not. ${c.player}. 🔴 #${c.tagName}` },
    { k: 'rival', tone: 'bad', t: c => `Money ruining football again. Nothing to do with the fact I wish we had him.` },
    { k: 'pundit', tone: 'info', t: c => `${c.fee} is a lot. He is also the difference between fourth and first, so it is not a lot.` },
    { k: 'stats', tone: 'info', t: c => `${c.player}, ${c.ovr} rated, is now the highest-rated player at ${c.clubName}.` },
    { k: 'fan', tone: 'hot', t: c => `Ticket prices going up and I do not even care. Worth it.` },
    { k: 'journo', tone: 'good', t: c => `The manager got his man. The board found the money. Now they have to live up to it.` }
  ];

  POSTS.sale = [
    { k: 'club', tone: 'info', t: c => `${c.player} leaves ${c.clubName}. Thank you for everything. 💙` },
    { k: 'fan', tone: 'bad', t: c => `Selling ${c.player} is a decision I will be angry about in May. Mark it down.` },
    { k: 'journo', tone: 'info', t: c => `${c.clubName} bank ${c.fee} for ${c.player}. The manager insists it was his call.` },
    { k: 'fantv', tone: 'bad', t: c => `Why. WHY. Somebody in that building explain this to me.` },
    { k: 'pundit', tone: 'info', t: c => `Good business if they reinvest it. A disaster if they do not. We will know by September.` },
    { k: 'fan', tone: 'info', t: c => `Fair fee, right time. Not everything has to be a crisis.` },
    { k: 'stats', tone: 'info', t: c => `${c.player} departs having played his part. ${c.fee} received.` },
    { k: 'rival', tone: 'info', t: c => `They have sold their best player again. Same club, different season.` },
    { k: 'fan', tone: 'good', t: c => `All the best ${c.player}. Never gave less than everything. 👏` }
  ];

  /* ---- the treatment room ---- */
  POSTS.injury = [
    { k: 'club', tone: 'bad', t: c => `${c.player} will be assessed after leaving the pitch. Updates to follow. 💙` },
    { k: 'fan', tone: 'bad', t: c => `Not ${c.player}. Please not him. Not now.` },
    { k: 'journo', tone: 'bad', t: c => `${c.player} is out for around ${c.games} game${c.games === 1 ? '' : 's'} — ${c.label}.` },
    { k: 'fantv', tone: 'bad', t: c => `Of all the players. Of all the weeks. The luck at this club is unbelievable.` },
    { k: 'pundit', tone: 'info', t: c => `That is a real problem for them. There is no like-for-like replacement in that squad.` },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} now have players missing. The rotation the manager gets criticised for looks smarter every week.` },
    { k: 'rival', tone: 'info', t: c => `No club wants to see that. Get well soon ${c.player}.` },
    { k: 'fan', tone: 'info', t: c => `Next man up. That is what a squad is for.` }
  ];

  POSTS.longInjury = [
    { k: 'fantv', tone: 'bad', t: c => `${c.games} GAMES. Our season just changed shape in one challenge.` },
    { k: 'journo', tone: 'bad', t: c => `A serious blow: ${c.player} faces around ${c.games} games out with ${c.label}.` },
    { k: 'club', tone: 'bad', t: c => `${c.player} will undergo surgery. Everyone here is behind you. 💙 #${c.tagName}` },
    { k: 'fan', tone: 'bad', t: c => `Devastated for him. He has been our best player for months.` },
    { k: 'pundit', tone: 'bad', t: c => `That is the kind of injury that decides where a club finishes. No way around it.` },
    { k: 'fan', tone: 'info', t: c => `Right. Somebody in that squad is about to get the season of their life. Take it.` },
    { k: 'stats', tone: 'info', t: c => `${c.player}: out for approximately ${c.games} matches. ${c.label}.` }
  ];

  POSTS.redCard = [
    { k: 'journo', tone: 'bad', t: c => `Red card for ${c.player}. He did not wait for the referee to reach for it.` },
    { k: 'fan', tone: 'bad', t: c => `We needed him for the next three games. Absolutely gutted.` },
    { k: 'fantv', tone: 'bad', t: c => `WHAT ARE YOU DOING. What are you DOING.` },
    { k: 'pundit', tone: 'bad', t: c => `You can talk about passion. That is letting ten team-mates down, and he knows it.` },
    { k: 'rival', tone: 'good', t: c => `Sending yourself off in that game is a bold career choice. Enjoy the ban.` },
    { k: 'club', tone: 'info', t: c => `${c.player} is sent off. We play on.` },
    { k: 'fan', tone: 'info', t: c => `Harsh. Genuinely harsh. But he gave the referee the decision to make.` }
  ];

  POSTS.suspended = [
    { k: 'stats', tone: 'info', t: c => `${c.player} misses the next game — ${c.why}.` },
    { k: 'fan', tone: 'bad', t: c => `Suspended. In this week of all weeks. Someone is having a laugh.` },
    { k: 'journo', tone: 'info', t: c => `${c.clubName} will be without ${c.player}, suspended. The manager will not be pleased about the timing.` },
    { k: 'pundit', tone: 'info', t: c => `Bookings catch up with everybody eventually. Managing that is part of the job.` },
    { k: 'fantv', tone: 'bad', t: c => `Missing him for that fixture is the definition of avoidable.` }
  ];
  /* ---- form and the table ---- */
  POSTS.streakGood = [
    { k: 'stats', tone: 'info', t: c => `${c.clubName}: ${c.form}. Nobody in this division is in better form.` },
    { k: 'fantv', tone: 'hot', t: c => `WE CANNOT STOP WINNING. Do not wake me up.` },
    { k: 'fan', tone: 'good', t: c => `Whatever is happening on that training ground, do not change a thing.` },
    { k: 'journo', tone: 'good', t: c => `${c.clubName} are the form side in the ${c.leagueName}, and the manager is finally getting credit for it.` },
    { k: 'pundit', tone: 'good', t: c => `Runs like this are not luck. Same shape, same principles, week after week.` },
    { k: 'fan', tone: 'hot', t: c => `I have started checking the table three times a day. Send help. Do not send help.` },
    { k: 'rival', tone: 'bad', t: c => `Nobody talk about ${c.clubName}. If we ignore it maybe it stops.` },
    { k: 'club', tone: 'good', t: c => `Another one. 📈 Long may it continue.` },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} have taken more points in their last five than anyone else in the ${c.leagueName}.` }
  ];

  POSTS.streakBad = [
    { k: 'stats', tone: 'info', t: c => `${c.clubName}: ${c.form}. That is their worst run of the season.` },
    { k: 'fantv', tone: 'bad', t: c => `Five games. FIVE. At what point does somebody in that boardroom pick up a phone?` },
    { k: 'fan', tone: 'bad', t: c => `I have stopped setting an alarm for kick-off. That is where we are.` },
    { k: 'journo', tone: 'bad', t: c => `The run continues for ${c.clubName}. The manager's post-match answers are getting shorter.` },
    { k: 'pundit', tone: 'info', t: c => `The performances are not as bad as the results. That is the only thing keeping him in a job.` },
    { k: 'fan', tone: 'info', t: c => `Everyone breathe. We have been through worse than this and come out fine.` },
    { k: 'rival', tone: 'hot', t: c => `Every week I check ${c.clubName}'s score and every week football gives me a gift.` },
    { k: 'fantv', tone: 'bad', t: c => `I am not calling for him. I am just saying I would understand.` },
    { k: 'fan', tone: 'bad', t: c => `Something has to change. Anything. Pick a different shape, pick different players, I don't care.` }
  ];

  POSTS.topOfTable = [
    { k: 'stats', tone: 'info', t: c => `${c.clubName} are top of the ${c.leagueName}.` },
    { k: 'fantv', tone: 'hot', t: c => `TOP OF THE LEAGUE. Say it out loud. TOP OF THE LEAGUE.` },
    { k: 'fan', tone: 'hot', t: c => `Screenshotted the table. Set it as my wallpaper. Judge me.` },
    { k: 'journo', tone: 'good', t: c => `${c.clubName} lead the ${c.leagueName}. Very few people had that in August.` },
    { k: 'pundit', tone: 'info', t: c => `They are top on merit. The question now is whether the squad is deep enough to stay there.` },
    { k: 'rival', tone: 'bad', t: c => `They will bottle it. They always bottle it. (Please bottle it.)` },
    { k: 'fan', tone: 'good', t: c => `Not getting carried away. Definitely not. Absolutely calm. TOP OF THE LEAGUE.` },
    { k: 'club', tone: 'good', t: c => `Nice view from up here. 👀` }
  ];

  POSTS.titleRace = [
    { k: 'journo', tone: 'hot', t: c => `${c.posOrd} and in it. ${c.clubName} have a genuine title race on their hands.` },
    { k: 'fan', tone: 'hot', t: c => `I have not dared say the word. I am not saying it. You know the word.` },
    { k: 'pundit', tone: 'info', t: c => `Whoever holds their nerve in the next six games wins this league. Simple as that.` },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} are ${c.posOrd}. On this form the run-in is the whole season.` },
    { k: 'fantv', tone: 'hot', t: c => `I have not slept properly in three weeks and there are eight games left.` },
    { k: 'fan', tone: 'info', t: c => `Whatever happens, this has been the most fun I have had following this club in years.` }
  ];

  POSTS.relegationFight = [
    { k: 'stats', tone: 'info', t: c => `${c.clubName} are ${c.posOrd}. The bottom is closer than the middle now.` },
    { k: 'fan', tone: 'bad', t: c => `I did not think we would be in this conversation. I really did not.` },
    { k: 'journo', tone: 'bad', t: c => `A serious relegation fight for ${c.clubName}, and the manager knows exactly what that means for him.` },
    { k: 'fantv', tone: 'bad', t: c => `Doing the maths every night like a madman. It is not good maths.` },
    { k: 'pundit', tone: 'info', t: c => `They need points, not performances. Sometimes a manager has to accept that and set up accordingly.` },
    { k: 'fan', tone: 'info', t: c => `Behind them until the last kick. Whatever happens.` },
    { k: 'rival', tone: 'hot', t: c => `${c.clubName} going down would make my entire decade.` }
  ];

  /* ---- the board and the job ---- */
  POSTS.boardHappy = [
    { k: 'journo', tone: 'good', t: c => `Sources at ${c.clubName} say the board could not be happier. Talk of a new contract has started.` },
    { k: 'club', tone: 'good', t: c => `Full backing from everyone at this football club. 👏` },
    { k: 'pundit', tone: 'good', t: c => `He has earned the right to be trusted with the money. That is not nothing at that club.` },
    { k: 'fan', tone: 'good', t: c => `Give him a five year deal and let him build something. For once.` },
    { k: 'stats', tone: 'info', t: c => `Board confidence in the manager at ${c.clubName}: ${c.conf}/100.` },
    { k: 'fantv', tone: 'good', t: c => `I owe him an apology for what I said in October. Publicly. There, done.` }
  ];

  POSTS.sackWatch = [
    { k: 'journo', tone: 'bad', t: c => `${c.clubName}'s board held a meeting today. The manager's position was on the agenda.` },
    { k: 'fantv', tone: 'bad', t: c => `Sack watch is officially on and I hate that we are here again.` },
    { k: 'stats', tone: 'info', t: c => `Board confidence at ${c.clubName}: ${c.conf}/100. Managers rarely survive below twenty.` },
    { k: 'fan', tone: 'bad', t: c => `Not his fault entirely but somebody has to go and it is never the board.` },
    { k: 'fan', tone: 'info', t: c => `Sacking him solves nothing. The problems at this club are older than he is.` },
    { k: 'pundit', tone: 'info', t: c => `He has three games. Maybe four. That is the reality and everybody inside the building knows it.` },
    { k: 'rival', tone: 'good', t: c => `Do not sack him. Please do not sack him. He is doing brilliant work.` },
    { k: 'journo', tone: 'info', t: c => `No decision yet at ${c.clubName}. But nobody is denying anything either.` },
    { k: 'fantv', tone: 'bad', t: c => `Bookies have suspended betting on the next manager. That is never a good sign.` }
  ];

  POSTS.champions = [
    { k: 'club', tone: 'hot', t: c => `🏆 CHAMPIONS OF THE ${c.leagueName.toUpperCase()} 🏆` },
    { k: 'fantv', tone: 'hot', t: c => `WE HAVE WON THE LEAGUE. I have waited my entire life for this video.` },
    { k: 'fan', tone: 'hot', t: c => `Champions. CHAMPIONS. My phone is at 4% and I do not care.` },
    { k: 'journo', tone: 'hot', t: c => `${c.clubName} are champions. Whatever anybody said about the manager in ${c.year}, this is the answer.` },
    { k: 'pundit', tone: 'good', t: c => `A deserved title. Best defensive record, best structure, the clearest idea of what it wanted to be.` },
    { k: 'stats', tone: 'info', t: c => `${c.clubName}: champions. ${c.wins} wins from ${c.played}.` },
    { k: 'rival', tone: 'bad', t: c => `Congratulations to ${c.clubName}. Now please go away for the summer.` },
    { k: 'fan', tone: 'hot', t: c => `My dad is 78 and he is crying in the kitchen. That is what this means.` },
    { k: 'club', tone: 'good', t: c => `Thank you. All of you. Every away end, every wet Tuesday. This is yours. 💙` },
    { k: 'fan', tone: 'hot', t: c => `Not going to work tomorrow. Not going to work Tuesday either, probably.` }
  ];

  POSTS.seasonGood = [
    { k: 'journo', tone: 'good', t: c => `${c.clubName} finish ${c.posOrd}. Above where anyone expected, and the manager is the reason.` },
    { k: 'fan', tone: 'good', t: c => `Best season I have had following this club in a long time. Thank you, seriously.` },
    { k: 'pundit', tone: 'good', t: c => `Overachievement is a horrible word. He has made a squad better than the sum of its parts. Call it that.` },
    { k: 'stats', tone: 'info', t: c => `Final position: ${c.posOrd}. Target was ${c.target}${c.pos <= c.target ? '. Met.' : '.'}` },
    { k: 'club', tone: 'good', t: c => `That's a wrap on the season. ${c.posOrd}. See you in August. 💙` },
    { k: 'fantv', tone: 'good', t: c => `End of season review coming this week and for once it is a positive one.` }
  ];

  POSTS.seasonBad = [
    { k: 'fantv', tone: 'bad', t: c => `${c.posOrd}. That is where we finished. Somebody has to answer for this summer.` },
    { k: 'journo', tone: 'bad', t: c => `${c.clubName} finish ${c.posOrd}, well short of what was asked. Questions will be asked of everyone.` },
    { k: 'fan', tone: 'bad', t: c => `Renewing my season ticket out of habit, not hope.` },
    { k: 'pundit', tone: 'info', t: c => `He inherited problems. He has also not solved many of them. Both things are true.` },
    { k: 'club', tone: 'info', t: c => `Not the season we wanted. Thank you for standing by us. We will do better.` },
    { k: 'fan', tone: 'info', t: c => `Give him a summer and a budget before you write him off.` },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} finish ${c.posOrd}. The board asked for ${c.target}.` }
  ];

  /* ---- the career ---- */
  POSTS.linked = [
    { k: 'journo', tone: 'hot', t: c => `Understand ${c.suitor} have made contact about ${c.clubName}'s manager. Early, but real.` },
    { k: 'fantv', tone: 'bad', t: c => `If ${c.suitor} take our manager I am going to lose it. Genuinely.` },
    { k: 'fan', tone: 'bad', t: c => `Please stay. Please. We have not had somebody who knows what he is doing in years.` },
    { k: 'pundit', tone: 'info', t: c => `He would be mad not to listen. That does not mean he goes.` },
    { k: 'rival', tone: 'good', t: c => `Take him. Take him now. Do it for me.` },
    { k: 'stats', tone: 'info', t: c => `Manager reputation: ${c.rep}/100. That is why the phone is ringing.` },
    { k: 'fan', tone: 'info', t: c => `Nothing in this story. There is never anything in these stories. (There is always something.)` },
    { k: 'journo', tone: 'info', t: c => `No approach has been confirmed. ${c.suitor} have not denied it either.` }
  ];

  POSTS.leaving = [
    { k: 'club', tone: 'info', t: c => `${c.clubName} can confirm the manager has left the club. We thank him and wish him well. 💙` },
    { k: 'fantv', tone: 'bad', t: c => `He has gone. Just like that. I need to sit down.` },
    { k: 'fan', tone: 'bad', t: c => `Gutted. Absolutely gutted. Best manager we have had in my lifetime.` },
    { k: 'journo', tone: 'hot', t: c => `Done deal. The ${c.clubName} manager is on his way to ${c.suitor}.` },
    { k: 'fan', tone: 'bad', t: c => `Everybody leaves this club eventually. Doesn't make it easier.` },
    { k: 'pundit', tone: 'info', t: c => `Hard to blame him. Bigger club, bigger budget, bigger stage. That is football.` },
    { k: 'rival', tone: 'hot', t: c => `Lost their manager. Their season is over and it is August.` },
    { k: 'fan', tone: 'good', t: c => `Thanks for everything. Genuinely. Good luck. (Except against us.)` }
  ];

  POSTS.arrived = [
    { k: 'club', tone: 'good', t: c => `Welcome to ${c.clubName}. ✍️ Our new manager has signed.` },
    { k: 'fan', tone: 'good', t: c => `Right. New manager. New start. I am choosing to be optimistic and you cannot stop me.` },
    { k: 'journo', tone: 'info', t: c => `${c.clubName} appoint their new manager. ${c.trophies} trophies on the CV and a reputation of ${c.rep}.` },
    { k: 'fantv', tone: 'good', t: c => `New gaffer. First impressions video tonight. I am cautiously excited and that is rare for me.` },
    { k: 'pundit', tone: 'info', t: c => `Sensible appointment. He has done it at a level below and earned the step up.` },
    { k: 'fan', tone: 'info', t: c => `Judging nobody until Christmas. That is the deal I make with myself every time.` },
    { k: 'rival', tone: 'info', t: c => `Decent appointment that, annoyingly.` },
    { k: 'stats', tone: 'info', t: c => `New manager at ${c.clubName}. Career trophies: ${c.trophies}.` },
    { k: 'fan', tone: 'good', t: c => `Anybody is an upgrade at this point. Welcome, whoever you are.` }
  ];

  POSTS.sacked = [
    { k: 'club', tone: 'bad', t: c => `${c.clubName} have parted company with the manager. We thank him for his efforts.` },
    { k: 'journo', tone: 'hot', t: c => `The ${c.clubName} manager has been sacked after ${c.seasons} season${c.seasons === 1 ? '' : 's'}.` },
    { k: 'fantv', tone: 'info', t: c => `He's gone. I called for it in November and I feel worse about it than I expected.` },
    { k: 'fan', tone: 'info', t: c => `Never his fault alone. Never is. Good luck to him.` },
    { k: 'fan', tone: 'bad', t: c => `Fourth manager in five years. The problem is not in the dugout, it is upstairs.` },
    { k: 'pundit', tone: 'info', t: c => `Sacking is the easy decision. The hard one is who they get next, and they have not been good at that.` },
    { k: 'rival', tone: 'good', t: c => `Gutted for them, obviously. Devastated. Can barely type through the laughter.` }
  ];
  /* ---- ambient: the timeline between matches ----
     Fires on a quiet week. This is where most of the noise lives. */
  POSTS.weekly = [
    { k: 'fan', tone: 'info', t: c => `Genuine question: is the ${c.formation} the right shape for these players? I am not being funny, I want to know.` },
    { k: 'pundit', tone: 'info', t: c => `Watch ${c.clubName}'s build-up again. The whole thing is designed to get ${c.star} the ball facing forward.` },
    { k: 'stats', tone: 'info', when: c => c.topGoals > 0,
      t: c => `${c.topScorer} has ${c.topGoals} for ${c.clubName} this season.` },
    { k: 'fantv', tone: 'info', t: c => `Doing a mailbag tonight. Send me your questions and please, PLEASE, not all about the shape.` },
    { k: 'fan', tone: 'info', t: c => `Prices up again next season. Same football, more money. Funny that.` },
    { k: 'journo', tone: 'info', t: c => `Quiet week at ${c.clubName}. The manager used it to work on set pieces, apparently.` },
    { k: 'fan', tone: 'good', t: c => `${c.kid} in training this week looked like a first team player. Remember the name.` },
    { k: 'pundit', tone: 'info', t: c => `Nobody talks about how much running ${c.star2} does. It is the reason the whole shape works.` },
    { k: 'rival', tone: 'info', t: c => `Looking forward to ${c.clubName} away. Best pies in the division and I will not be taking questions.` },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} are ${c.posOrd} with ${c.wins} wins from ${c.played}.` },
    { k: 'fan', tone: 'info', t: c => `Wet Tuesday night, three quid on the train, standing in the rain. Would not change it.` },
    { k: 'fantv', tone: 'info', t: c => `Tier list of every manager we have had since 2010. It is going to upset people.` },
    { k: 'journo', tone: 'info', t: c => `The manager has been at the training ground before seven every day this week. Make of that what you will.` },
    { k: 'fan', tone: 'bad', t: c => `The pitch is a disgrace. How are they meant to play football on that.` },
    { k: 'pundit', tone: 'info', t: c => `Every side in this league now has a plan for ${c.star}. The interesting bit is whether the manager has a plan for that.` },
    { k: 'fan', tone: 'info', t: c => `Who is picking the music at half time. I need names.` },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} have the ${c.pos <= 4 ? 'best' : 'a mid-table'} points-per-game in the ${c.leagueName} since December.` },
    { k: 'fan', tone: 'good', t: c => `Took my daughter to her first game. She asked why everyone was shouting. Told her that's just Tuesday.` },
    { k: 'fantv', tone: 'info', t: c => `Poll: is this squad better than the one three years ago? Be honest, not nostalgic.` },
    { k: 'journo', tone: 'info', t: c => `Contract talks at ${c.clubName} are ongoing with two senior players. No panic yet.` },
    { k: 'rival', tone: 'info', t: c => `Say what you like about ${c.clubName}, their away support is proper.` },
    { k: 'fan', tone: 'bad', t: c => `Kick off moved for television again. Some of us have to get home.` },
    { k: 'pundit', tone: 'info', t: c => `${c.clubName} press higher than anyone gives them credit for. It is the least fashionable good idea in the league.` },
    { k: 'fan', tone: 'info', t: c => `Every year I say I will not get emotionally invested. Every year, by September, I am gone.` },
    { k: 'stats', tone: 'info', t: c => `Squad average age at ${c.clubName} is one of the lowest in the division.` },
    { k: 'fantv', tone: 'good', t: c => `Went to watch the under 21s. Two of them are ready. I am telling you now so I can say I told you.` },
    { k: 'fan', tone: 'info', t: c => `The bloke behind me has been telling the manager what to do for eleven years. He has never been right once.` },
    { k: 'journo', tone: 'info', t: c => `${c.clubName} scouting in ${c.country} again. The manager likes players who can play in two positions.` },
    { k: 'fan', tone: 'good', t: c => `Club shop has finally restocked. Only took until March.` },
    { k: 'pundit', tone: 'info', t: c => `The best thing this manager does is not on the ball. Watch where his midfield stand when they lose it.` },
    { k: 'fan', tone: 'bad', t: c => `Away tickets sold out in nine minutes and half of them are on resale sites. Sort it out.` },
    { k: 'stats', tone: 'info', t: c => `Board confidence: ${c.conf}. Position: ${c.posOrd}. Target: ${c.target}.` },
    { k: 'fantv', tone: 'info', t: c => `Somebody asked me to rank the kits. Twelve minutes of my life, gone, and I loved it.` },
    { k: 'fan', tone: 'info', t: c => `Nobody in this fanbase has ever agreed on anything and that is honestly the best part.` },
    { k: 'journo', tone: 'info', t: c => `Understand ${c.clubName}'s manager turned down an approach to discuss another job earlier this year.` },
    { k: 'rival', tone: 'bad', when: c => c.pos <= 5,
      t: c => `Their fans have been unbearable since they hit ${c.posOrd}. Unbearable.` },
    { k: 'fan', tone: 'good', t: c => `Signed shirt raffle for the local hospice raised a fortune. Proper club, this.` },
    { k: 'pundit', tone: 'info', t: c => `${c.style} as an approach only works if the front two press together. Right now they do.` },
    { k: 'fan', tone: 'info', t: c => `Nine months of the year I am miserable about this club. I would not swap it.` },
    { k: 'stats', tone: 'info', t: c => `${c.star} leads ${c.clubName} for minutes played. The manager clearly trusts him.` },
    { k: 'fantv', tone: 'bad', t: c => `Why do we always start slowly. Every season. Somebody at that club must know.` },
    { k: 'journo', tone: 'info', t: c => `Training ground redevelopment at ${c.clubName} signed off. Not glamorous, but it matters.` },
    { k: 'fan', tone: 'good', t: c => `Bumped into ${c.star} in a supermarket. Lovely with my lad. Took photos with everyone.` },
    { k: 'fan', tone: 'info', t: c => `Whoever does the club's social media deserves a raise and a lie down.` },
    { k: 'pundit', tone: 'info', t: c => `People underrate how hard it is to keep a dressing room with you in a season like this one.` },
    { k: 'rival', tone: 'info', t: c => `Weirdly, I do not mind ${c.clubName}. Their manager seems alright.` },
    { k: 'fan', tone: 'bad', t: c => `Third kit is an abomination and I have bought two.` },
    { k: 'stats', tone: 'info', when: c => c.pos <= 4 || c.pos >= 11,
      t: c => `Wage bill at ${c.clubName} is mid-table. Their position is not.` },
    { k: 'fantv', tone: 'info', t: c => `Ten years of this channel today. Thanks for putting up with me shouting.` },
    { k: 'journo', tone: 'info', t: c => `The manager gave a genuinely interesting press conference today, which almost never happens.` },
    { k: 'fan', tone: 'info', t: c => `Booked the whole family in for the last home game. Rain or shine, we are there.` },
    { k: 'pundit', tone: 'info', t: c => `If ${c.clubName} keep this squad together for two more years, they are a problem for everybody.` },
    { k: 'fan', tone: 'good', t: c => `We are not a big club and I do not want us to be. This is enough.` },
    { k: 'fan', tone: 'bad', t: c => `Sick of hearing about "the project". Show me a result.` },
    { k: 'stats', tone: 'info', when: c => c.pos > 8,
      t: c => `${c.clubName} concede fewer shots than any side in the bottom half of the ${c.leagueName}.` },
    { k: 'fantv', tone: 'good', t: c => `Doing a watchalong for the next away game. Bring your own beer and low expectations.` },
    { k: 'journo', tone: 'info', t: c => `No news from ${c.clubName} today, which at this club counts as good news.` },
    { k: 'fan', tone: 'info', t: c => `My season ticket is in the same seat my grandad had. That is the whole thing, really.` },
    { k: 'pundit', tone: 'info', t: c => `${c.topScorer} is doing the unglamorous work as well as scoring. That is why the manager never takes him off.` },
    { k: 'rival', tone: 'bad', t: c => `Their manager gets far too much credit for having decent players.` },
    { k: 'fan', tone: 'good', t: c => `Whoever put the young lads on the pitch at half time to play, that was lovely.` },
    { k: 'fan', tone: 'info', t: c => `Debating the ${c.formation} in a pub car park at half eleven at night. Football.` },
    { k: 'stats', tone: 'info', t: c => `${c.clubName}'s manager: ${c.seasons} season${c.seasons === 1 ? '' : 's'} in charge, ${c.trophies} trophies.` },
    { k: 'fantv', tone: 'info', t: c => `Reading out your worst transfer predictions from August. Some of you should be embarrassed.` },
    { k: 'journo', tone: 'info', t: c => `A scout from a bigger club was at ${c.clubName}'s last game. That happens a lot lately.` },
    { k: 'fan', tone: 'bad', t: c => `Every away end I go to has better singing than us. It is embarrassing.` },
    { k: 'pundit', tone: 'info', t: c => `The bravest thing this manager does is keep playing out from the back when it goes wrong.` },
    { k: 'fan', tone: 'good', t: c => `Away day in the rain, 2-0 down, still singing. That's my lot, that.` },
    { k: 'stats', tone: 'info', t: c => `Only two clubs in the ${c.leagueName} have used fewer players this season than ${c.clubName}.` },
    { k: 'fan', tone: 'info', t: c => `Somebody explain offside to my mum. I have tried for twenty years.` },
    { k: 'fantv', tone: 'bad', t: c => `The referee thread. It is long. It is angry. It is up now.` },
    { k: 'journo', tone: 'info', t: c => `${c.clubName} have been quietly excellent at set pieces since Christmas. Somebody on that staff is very good at their job.` },
    { k: 'fan', tone: 'good', t: c => `Twenty three years, home and away. Never regretted a mile of it.` },
    { k: 'rival', tone: 'info', t: c => `Their ground is a nightmare to get to and worth it every time.` },
    { k: 'pundit', tone: 'info', t: c => `The gap between what this squad cost and where it is sitting is the story of the season.` },
    { k: 'fan', tone: 'bad', t: c => `I do not want to hear about the wage structure. I want to hear about a winger.` },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} have scored more from outside the box than anyone in this division.` },
    { k: 'fantv', tone: 'good', t: c => `Just want to say thank you. This club has got me through some rough years.` },
    { k: 'fan', tone: 'info', t: c => `Nobody at work understands why I care this much. I have stopped explaining.` },
    { k: 'journo', tone: 'info', t: c => `Club sources describe the mood at ${c.clubName} as calm. That is either good or very bad.` },
    { k: 'pundit', tone: 'info', t: c => `The manager keeps saying it is a process. Annoyingly for everybody, the process appears to be working.` },
    { k: 'fan', tone: 'good', t: c => `Renewed. Same seat. Same misery. Same joy. See you in August.` },
    { k: 'fan', tone: 'info', t: c => `Every club thinks their referees are the worst. Ours actually are.` },
    { k: 'stats', tone: 'info', when: c => c.wins > c.played - c.wins,
      t: c => `${c.clubName} have led at half time in more games than they have lost all season.` },
    { k: 'fantv', tone: 'info', t: c => `Ranking every away trip by pie quality. Purely scientific. Thread below.` },
    { k: 'fan', tone: 'bad', t: c => `Sat behind a bloke on his phone the whole game. Why come?` },
    { k: 'journo', tone: 'info', t: c => `The manager's contract situation at ${c.clubName} will need addressing sooner rather than later.` },
    { k: 'pundit', tone: 'info', t: c => `Watch what ${c.clubName} do in the first ten minutes after conceding. That is coached, and it is very good.` },
    { k: 'fan', tone: 'good', t: c => `We are not going to win anything and I love this football club with everything I have.` },
    { k: 'rival', tone: 'good', t: c => `Genuinely wish them well in the cup. Not the league. Never the league.` },
    { k: 'stats', tone: 'info', when: c => c.pos >= 5,
      t: c => `${c.clubName}'s squad is worth less than four clubs above them. Make of that what you will.` },
    { k: 'fan', tone: 'info', t: c => `The bloke who does the tannoy has been there since 1991. National treasure.` },
    { k: 'fantv', tone: 'bad', t: c => `I am begging this club to sign a left back. Begging.` },
    { k: 'journo', tone: 'info', t: c => `Recruitment meeting at ${c.clubName} today. The manager was in it, which has not always been true here.` },
    { k: 'fan', tone: 'good', t: c => `Standing in the away end singing about a manager. Only football does this.` },
    { k: 'pundit', tone: 'info', t: c => `They are one injury away from a very different season. Every side is. Not every side admits it.` },
    { k: 'fan', tone: 'info', t: c => `Somebody in the ground shouted a tactical instruction and it actually worked. He has not shut up since.` },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} have used ${c.formation} in almost every league game this season.` },
    { k: 'fan', tone: 'bad', t: c => `Getting rid of the standing section was the worst thing this club ever did.` },
    { k: 'fantv', tone: 'good', t: c => `Best atmosphere in years on Saturday. Whatever we are doing, keep doing it.` },
    { k: 'journo', tone: 'info', t: c => `Nothing to report from ${c.clubName}. Everybody fit, everybody available, nobody arguing.` },
    { k: 'pundit', tone: 'info', t: c => `The manager has changed his shape twice this season and been right both times. That is a good habit.` },
    { k: 'fan', tone: 'info', t: c => `Twelve of us in a car for six hours for a goalless draw. Best weekend of the year.` },
    { k: 'rival', tone: 'bad', t: c => `${c.clubName} fans acting like they invented football again.` },
    { k: 'stats', tone: 'info', t: c => `Home form at ${c.clubName} is markedly better than away. It has been for three years.` },
    { k: 'fan', tone: 'good', t: c => `My mate came for the first time in fifteen years and said the ground felt alive again.` },
    { k: 'fantv', tone: 'info', t: c => `Bringing back the phone-in. Please be nicer to me than last time.` },
    { k: 'journo', tone: 'info', t: c => `${c.clubName} have quietly become one of the better-run clubs in this division.` },
    { k: 'fan', tone: 'bad', t: c => `Do not talk to me about the ${c.leagueName} broadcast schedule. Do not.` },
    { k: 'pundit', tone: 'info', t: c => `Give a manager three transfer windows and you find out what he actually believes. He is two in.` },
    { k: 'fan', tone: 'info', t: c => `Have started watching games with the sound off. Genuinely improves the experience.` },
    { k: 'stats', tone: 'info', when: c => c.topGoals >= 4,
      t: c => `${c.clubName} win far more often than not when ${c.topScorer} scores. Small sample, nice stat.` },
    { k: 'fan', tone: 'good', t: c => `Been coming since I was six. My kids come now. That is the whole point of it.` },
    { k: 'fantv', tone: 'info', t: c => `Making a video about the manager's first season. It has aged in unexpected ways.` },
    { k: 'journo', tone: 'info', t: c => `A calm week at ${c.clubName}, which given the last few years is an achievement in itself.` },
    { k: 'fan', tone: 'info', t: c => `New signing spotted at a coffee shop in town. This is what passes for news in June.` },
    { k: 'pundit', tone: 'info', t: c => `Nobody in the ${c.leagueName} has a clearer idea of what they are than ${c.clubName} right now.` },
    { k: 'fan', tone: 'bad', t: c => `Bored of hearing we are punching above our weight. Let us punch.` },
    { k: 'rival', tone: 'info', t: c => `Their manager is doing a proper job. Hate that I have to say it.` },
    { k: 'stats', tone: 'info', t: c => `${c.clubName}: ${c.wins} wins, ${c.played} played, ${c.posOrd} in the table.` },
    { k: 'fan', tone: 'good', t: c => `The moment the floodlights come on. Every time. Twenty years and it still gets me.` },
    { k: 'fantv', tone: 'good', t: c => `Genuinely enjoying following this team again. Did not expect to type that.` },
    { k: 'journo', tone: 'info', t: c => `Expect ${c.clubName} to be active but not extravagant in the window. That is the manager's preference.` },
    { k: 'fan', tone: 'info', t: c => `Started a group chat for away travel. It is now 40 people and mostly arguing.` },
    { k: 'pundit', tone: 'info', t: c => `The academy at ${c.clubName} is producing again. That is worth more than any signing.` },
    { k: 'fan', tone: 'bad', t: c => `Half time queue was longer than the half. Sort the concourse out.` },
    { k: 'stats', tone: 'info', when: c => c.pos <= 6 && c.wins >= 5,
      t: c => `${c.clubName} have taken points off sides well above them this season.` },
    { k: 'fan', tone: 'good', t: c => `Football gave me a rubbish decade and one incredible afternoon. Still worth it.` }
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
    { k: 'pundit', tone: 'info', t: c => `Playing kids is easy. Playing them when you are under pressure is the hard part. He does.` },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} have given more minutes to under-21s than most of this division.` },
    { k: 'fan', tone: 'info', t: c => `Do not put too much on him. Let the lad grow up first.` },
    { k: 'rival', tone: 'info', t: c => `Their academy is genuinely good and it is annoying.` }
  ];

  POSTS.windowQuiet = [
    { k: 'fantv', tone: 'bad', t: c => `Deadline day and we have signed nobody. Nobody! I sat here for eleven hours.` },
    { k: 'fan', tone: 'bad', t: c => `Same squad, same problems, different season. Brilliant.` },
    { k: 'journo', tone: 'info', t: c => `${c.clubName} end the window quietly. The manager insists he is happy with what he has.` },
    { k: 'pundit', tone: 'info', t: c => `Not signing is a decision too. Sometimes it is the right one. Sometimes it is just cheaper.` },
    { k: 'fan', tone: 'info', t: c => `Trusting the group we have. Radical, I know.` },
    { k: 'stats', tone: 'info', t: c => `${c.budget} still unspent at ${c.clubName}.` },
    { k: 'rival', tone: 'good', t: c => `They had all summer and did nothing. Beautiful.` }
  ];

  POSTS.milestone = [
    { k: 'club', tone: 'good', t: c => `${c.played} games in charge. Thank you, boss. 👏` },
    { k: 'stats', tone: 'info', t: c => `${c.seasons} season${c.seasons === 1 ? '' : 's'}, ${c.trophies} trophies, reputation ${c.rep}. Not bad.` },
    { k: 'journo', tone: 'info', t: c => `A milestone for ${c.clubName}'s manager. Longevity is rare in this job and rarer at this club.` },
    { k: 'fan', tone: 'good', t: c => `Been through a lot with this gaffer. Would not swap him.` },
    { k: 'fantv', tone: 'good', t: c => `Doing a full retrospective on his time here. It has been a ride.` },
    { k: 'pundit', tone: 'info', t: c => `Managers do not get time any more. He has had it and he has used it well.` }
  ];

  POSTS.moneyTalk = [
    { k: 'fan', tone: 'info', t: c => `${c.budget} in the bank and a squad crying out for a winger. Do the maths.` },
    { k: 'journo', tone: 'info', t: c => `${c.clubName} have made ${c.budget} available to the manager. Whether he spends it is another matter.` },
    { k: 'fantv', tone: 'bad', t: c => `We have money. We have needs. We have a board. Two out of three is the problem.` },
    { k: 'pundit', tone: 'info', t: c => `A budget is not a plan. What he does with it will tell you what he actually thinks of this squad.` },
    { k: 'stats', tone: 'info', t: c => `Transfer budget at ${c.clubName}: ${c.budget}.` },
    { k: 'fan', tone: 'good', t: c => `Backing the manager with real money. When did we become a proper club?` },
    { k: 'rival', tone: 'bad', t: c => `Buying the league again. Some of us develop players.` }
  ];

  POSTS.goalOfSeason = [
    { k: 'club', tone: 'hot', t: c => `Goal of the Season. 🏅 There was only ever one winner. ${c.scorer}.` },
    { k: 'fantv', tone: 'hot', t: c => `GOAL OF THE SEASON AND IT IS NOT EVEN CLOSE. ${c.scorer.toUpperCase()}.` },
    { k: 'fan', tone: 'hot', t: c => `Voted for ${c.scorer}'s one about forty times. No regrets.` },
    { k: 'journo', tone: 'good', t: c => `${c.scorer} takes Goal of the Season. Nobody at ${c.clubName} needed a vote.` },
    { k: 'pundit', tone: 'good', t: c => `I have watched it every week since. It gets better, not worse.` },
    { k: 'stats', tone: 'info', t: c => `Goal of the Season: ${c.scorer}, ${c.clubName}.` }
  ];

  POSTS.rivalNews = [
    { k: 'rival', tone: 'bad', t: c => `Our manager has gone. Enjoy your week, ${c.clubName} fans, you insufferable lot.` },
    { k: 'fan', tone: 'good', t: c => `${c.rival} in crisis again. I am eating this up with a spoon.` },
    { k: 'fantv', tone: 'good', t: c => `Doing a whole video on ${c.rival}'s season. Purely to be cruel. No apologies.` },
    { k: 'journo', tone: 'info', t: c => `${c.rival} are having a difficult season, which will not be causing much sadness at ${c.clubName}.` },
    { k: 'fan', tone: 'info', t: c => `Genuinely do not care what ${c.rival} do. (Checks their score.) (Cares enormously.)` },
    { k: 'pundit', tone: 'info', t: c => `The balance of power in this city has shifted, and it has shifted because of coaching.` },
    { k: 'stats', tone: 'info', when: c => c.pos <= 3,
      t: c => `${c.clubName} are ${c.posOrd}, and ${c.rival} are not enjoying it.` }
  ];

  POSTS.pressure = [
    { k: 'journo', tone: 'info', t: c => `The manager was asked about his future four times today. He answered once.` },
    { k: 'fan', tone: 'info', t: c => `The bloke has taken more abuse this month than most take in a career. Give him a break.` },
    { k: 'fantv', tone: 'bad', t: c => `I do not enjoy being right about this. I would genuinely rather be wrong.` },
    { k: 'pundit', tone: 'info', t: c => `He looks tired. Not beaten — tired. There is a difference and it matters.` },
    { k: 'fan', tone: 'bad', t: c => `Boos at full time. Never nice to hear. Cannot say it was undeserved.` },
    { k: 'club', tone: 'info', t: c => `The manager will speak to the media as normal tomorrow morning.` },
    { k: 'rival', tone: 'good', t: c => `Their fans turning on their own manager. Best content on this app.` },
    { k: 'fan', tone: 'good', t: c => `Sang his name for ten minutes at the end. Whatever happens, he knows.` }
  ];

  POSTS.bigGameWin = [
    { k: 'fantv', tone: 'hot', t: c => `WE BEAT ${c.opp.toUpperCase()}. Rated ${c.oppRating}. AT THEIR PLACE.` },
    { k: 'journo', tone: 'good', t: c => `${c.clubName} beat ${c.opp}, a side rated ${c.oppRating}. That is the manager's best result here.` },
    { k: 'pundit', tone: 'good', t: c => `That is a tactical win. He picked a shape specifically for ${c.opp} and it worked perfectly.` },
    { k: 'fan', tone: 'hot', t: c => `Nobody gave us a prayer. NOBODY. And we went and did it.` },
    { k: 'stats', tone: 'info', t: c => `${c.clubName} (rated below ${c.opp}) win it. Upsets like that are rarer than you think.` },
    { k: 'rival', tone: 'bad', t: c => `Losing to ${c.clubName} at home is unacceptable. Genuinely unacceptable.` },
    { k: 'club', tone: 'hot', t: c => `On a night like this, there is nothing better. ${c.us}-${c.them}. 💙` },
    { k: 'fan', tone: 'hot', t: c => `Away end did not stop for ninety minutes. Voice gone. Worth every second.` }
  ];

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
      // and the occasional off-topic week
      if (U().chance(0.22)) fire(g, POSTS.moneyTalk, c, { heat: 0.9 });
      if (U().chance(0.16)) fire(g, POSTS.rivalNews, c, { heat: 0.9 });
      if (U().chance(0.12)) fire(g, POSTS.youth, c, { heat: 0.9 });
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
      if (review.champion) burst(g, [POSTS.champions], c, { heat: 3.2, tags: ['#' + c.tagName, '#Champions'] }, 4);
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
    },

    youth(g, names) {
      if (!g.mgr || !names || !names.length) return;
      fire(g, POSTS.youth, ctx(g, { kid: names[0], replyBank: MGR_REPLIES }), { heat: 1.2 });
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
