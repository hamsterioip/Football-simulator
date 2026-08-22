/* ==========================================================================
   social.js — the timeline.

   Football is only half the sport; the other half is everyone arguing about
   it. This builds a feed of posts about you and about the rest of the game's
   world: club fans, rival fans, reporters, ex-pros with a podcast, the stats
   accounts, the club's own social team — plus the replies underneath, which
   are where the real damage is done.

   Accounts persist (g.feedFolk), so the same fan keeps turning up in your
   mentions all career. Posts live in g.feed, newest first.
   ========================================================================== */
(function (global) {
  'use strict';

  const CAP = 60;          // posts kept in the save
  const ROSTER = 11;       // recurring accounts

  /* ---------------- handles & accounts ---------------- */

  const FAN_TAGS = ['TilIDie', 'Ultra', 'Faithful', 'Forever', 'Diehard', 'Army',
    'Block7', 'HomeEnd', 'AwayDays', 'SeasonTicket', 'Til_Death', 'Support',
    'Obsessed', 'Loyal', 'Since99', 'Everyweek'];
  const FAN_FIRST = ['Danny', 'Kev', 'Sam', 'Marco', 'Luca', 'Paulo', 'Tobi', 'Nico',
    'Rob', 'Aylin', 'Jules', 'Milo', 'Sofia', 'Hana', 'Dre', 'Bram', 'Cato', 'Rafa'];
  const OUTLETS = ['Back Page', 'Touchline', 'Match Weekly', 'El Diario', 'Gazzetta Live',
    'Kicker Daily', 'Fútbol Total', 'The Terrace', 'Radio Deportiva'];
  const PUNDIT_TAG = ['Podcast', 'Show', 'Says', 'Talks', 'Breakdown', 'Analysis'];
  const STATS_NAMES = ['FootyNumbers', 'xG Weekly', 'The Data Room', 'Chalkboard',
    'Heatmap HQ', 'Expected Goals'];
  const FANTV_TAIL = ['Fan TV', 'Ultras TV', 'Matchday Live', 'Terrace TV', 'Full Time Show'];

  function tag(clubName) {
    const compact = String(clubName).replace(/[^A-Za-z]/g, '');
    if (compact.length <= 12) return compact || 'Club';
    const words = String(clubName).replace(/[^A-Za-z ]/g, '').split(' ').filter(w => w.length >= 4);
    return words.sort((a, b) => b.length - a.length)[0] || compact || 'Club';
  }
  function handleOf(base) { return '@' + String(base).replace(/[^A-Za-z0-9_]/g, ''); }
  function initials(name) {
    const parts = String(name).replace(/[^A-Za-z ]/g, '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    return ((parts[0][0] || '?') + (parts[1] ? parts[1][0] : '')).toUpperCase();
  }
  function hue(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 360;
    return h;
  }

  function makeFan(clubName, country) {
    const U = global.U;
    const who = global.Names.person(country || 'England');
    const first = U.chance(0.5) ? who.name.split(' ')[0] : U.pick(FAN_FIRST);
    const style = U.int(0, 2);
    const t = tag(clubName);
    const h = style === 0 ? t + U.pick(FAN_TAGS)
      : style === 1 ? first + '_' + t
        : t + first + U.int(2, 99);
    return { n: first, h: handleOf(h), kind: 'fan', club: clubName };
  }
  function makeRival(clubName, country) {
    const f = makeFan(clubName, country);
    f.kind = 'rival';
    return f;
  }
  function makeJourno(country) {
    const who = global.Names.person(country || 'England');
    return { n: who.name, h: handleOf(who.name.replace(/\s/g, '')), kind: 'journo',
      v: true, bio: global.U.pick(OUTLETS) };
  }
  function makePundit(country) {
    const U = global.U;
    const who = global.Names.person(country || 'England');
    return { n: who.name, h: handleOf(who.name.split(' ')[1] + U.pick(PUNDIT_TAG)),
      kind: 'pundit', v: true, bio: 'Ex-pro · ' + U.pick(['podcast', 'co-commentator', 'columnist', 'pundit']) };
  }
  function makeStats() {
    const n = global.U.pick(STATS_NAMES);
    return { n, h: handleOf(n), kind: 'stats', v: true, bio: 'Numbers, no opinions' };
  }
  function makeFanTV(clubName) {
    const n = tag(clubName) + ' ' + global.U.pick(FANTV_TAIL);
    return { n, h: handleOf(n), kind: 'fantv', bio: 'Post-match reaction' };
  }
  function makeClub(club) {
    return { n: club.name, h: handleOf(club.name), kind: 'club', v: true, club: club.name };
  }
  function you(p) {
    return { n: p.firstName + ' ' + p.lastName, h: handleOf(p.firstName + p.lastName + p.shirt),
      kind: 'you', v: (p.reputation || 0) >= 35 };
  }

  /* The recurring cast. Rebuilt when you change club so the local accounts
     always support the badge you are actually wearing. */
  function folk(g) {
    const U = global.U, State = global.State;
    const club = State.club(g.player.club);
    if (g.feedFolk && g.feedFolk.club === club.name) return g.feedFolk;
    const country = (State.league(club.league) || {}).country;
    const rivals = Object.values(g.world.clubs).filter(c => c.league === club.league && c.id !== club.id);
    const list = [makeClub(club), makeFanTV(club.name), makeStats(),
      makeJourno(country), makePundit(country), makePundit(null)];
    for (let i = 0; i < 3; i++) list.push(makeFan(club.name, country));
    for (let i = 0; i < 2; i++) {
      const r = rivals.length ? U.pick(rivals) : null;
      if (r) list.push(makeRival(r.name, country));
    }
    g.feedFolk = { club: club.name, list: list.slice(0, ROSTER) };
    return g.feedFolk;
  }
  function pickFolk(g, kind) {
    const U = global.U, all = folk(g).list;
    const want = all.filter(f => f.kind === kind);
    return want.length ? U.pick(want) : U.pick(all);
  }

  /* ---------------- replies ---------------- */

  const REPLIES = {
    hype: [
      'no notes. none.', 'THIS is what I pay for', 'best in the league and it is not close',
      'goosebumps every time', 'he is different gravy', 'framed. printed. on my wall.',
      'I was there. I will tell my kids.', 'give the man the armband',
      'if he played for a bigger club you would all be calling him elite',
      'genuinely the only reason I still watch', 'he cooked and left no crumbs',
      'the away end was SHAKING'
    ],
    doubt: [
      'do it against a proper side and then talk', 'one good week and the timeline loses it',
      'stats are nice, trophies are nicer', 'flat track bully', 'wait until winter',
      'he disappears in the big ones though', 'ask me again in May',
      'I have seen this film before, it ends with a hamstring',
      'lovely player, terrible defensively', 'we are getting carried away here lads'
    ],
    banter: [
      'imagine being a fan of any other club right now', 'and you lot said we overpaid',
      'our right back would have him in his pocket', 'won nothing though',
      'this aged like milk', 'quote tweeting this in six months',
      'you have one player and a stadium with a leaky roof',
      'careful, the bandwagon has a weight limit'
    ],
    stat: [
      'that is 4 goal involvements in 3 games by the way', 'his xG this season is absurd',
      'nobody in the division touches his progressive carries', 'top of the league for shots on target. quietly.',
      'per 90 that is the best number in the league', 'he is outperforming his xG by a mile. sustainable? no. fun? yes.',
      'third season running he has improved every single metric'
    ],
    joke: [
      'my wife asked why I was shouting at 11pm. this.', 'sold him on my fantasy team last week. of course.',
      'the lad works harder than I do and I have a mortgage', 'me explaining this to my mrs for 40 minutes',
      'putting this on the fridge', 'nobody tell the gaffer he can do that',
      'the ball did nothing wrong, it just wanted a rest', 'I have watched this 41 times, send help'
    ],
    tactic: [
      'give him a free role and stop asking him to track back', 'the shape is the problem, not him',
      'play him centrally. it is not hard.', 'we need a proper 6 behind him and this team wins the league',
      'the manager is holding this team back and you all know it',
      'he does the pressing of two players, nobody clips that'
    ],
    cope: [
      'referee decided this one, as usual', 'we were the better side for 20 minutes',
      'no complaints, they wanted it more', 'right. season starts now.',
      'I am not angry, I am just tired', 'delete the app until Saturday'
    ],
    wholesome: [
      'my daughter has his name on the back of her shirt. she was buzzing.',
      'he signed my lad\'s ball outside the ground last month. class act.',
      'football is good sometimes', 'whatever happens next, thanks for this one',
      'stayed behind and clapped the away end. small thing, means a lot.'
    ]
  };

  const STANCE_BY_TONE = {
    good: ['hype', 'hype', 'stat', 'joke', 'doubt', 'wholesome', 'banter'],
    bad: ['doubt', 'cope', 'banter', 'tactic', 'joke'],
    info: ['doubt', 'stat', 'joke', 'tactic', 'hype', 'banter'],
    hot: ['banter', 'doubt', 'hype', 'tactic', 'joke']
  };

  function replyFor(g, stance, c, used) {
    const U = global.U;
    const pool = REPLIES[stance] || REPLIES.joke;
    const kind = stance === 'banter' ? 'rival' : stance === 'stat' ? 'stats'
      : stance === 'tactic' ? 'pundit' : 'fan';
    let who = pickFolk(g, kind);
    // nobody replies to themselves twice in the same thread
    for (let i = 0; i < 6 && used && used.indexOf(who.h) >= 0; i++) who = pickFolk(g, i > 2 ? null : kind);
    if (used) used.push(who.h);
    return { who, t: U.pick(pool),
      likes: Math.max(0, Math.round(U.rnd(0, 40) * (c.reach * 0.35 + 0.3))) };
  }
  function repliesFor(g, tone, c, n) {
    const U = global.U;
    const stances = U.shuffle(STANCE_BY_TONE[tone] || STANCE_BY_TONE.info);
    const out = [], used = [];
    const want = n != null ? n : U.weighted([[1, 3], [2, 5], [3, 3]]);
    for (let i = 0; i < want; i++) out.push(replyFor(g, stances[i % stances.length], c, used));
    return out;
  }

  /* ---------------- posts about you ---------------- */
  /* Each entry: { k: author kind, tone, t: ctx -> text }. */

  const MATCH = {
    hattrick: [
      { k: 'fantv', tone: 'good', t: c => `THREE. GOALS. ${c.last.toUpperCase()} HAS DONE IT AGAIN. Reaction video up in ten minutes, I need to sit down first.` },
      { k: 'club', tone: 'good', t: c => `Match ball secured. 🎩 ${c.name} — ${c.goals} goals against ${c.opp}.` },
      { k: 'journo', tone: 'good', t: c => `${c.name} has just taken ${c.opp} apart on his own. Three goals, and it could have been five. Whatever ${c.clubName} paid, it was not enough.` },
      { k: 'fan', tone: 'good', t: c => `I have supported this club for twenty three years and I have never seen a performance like that. Never.` },
      { k: 'stats', tone: 'good', t: c => `${c.last} v ${c.opp}: ${c.goals} goals from ${(c.goals * 0.7).toFixed(1)} xG. Ruthless.` },
      { k: 'rival', tone: 'bad', t: c => `Our defending was a disgrace but fair play, ${c.last} is a problem for everyone.` }
    ],
    brace: [
      { k: 'fan', tone: 'good', t: c => `TWO for ${c.last} 🔥 the boy is on another level right now` },
      { k: 'club', tone: 'good', t: c => `Two goals for ${c.name}. ⚽⚽ ${c.us}-${c.them}.` },
      { k: 'pundit', tone: 'good', t: c => `Both finishes were different. One power, one placement. That is a striker who has been paying attention.` },
      { k: 'stats', tone: 'good', t: c => `${c.last} has now scored ${c.seasonGoals} this season in ${c.seasonApps} appearances.` },
      { k: 'journo', tone: 'good', t: c => `Two goals, and the second one was pure instinct. ${c.opp} never worked him out.` }
    ],
    goal: [
      { k: 'fan', tone: 'good', t: c => `${c.last} scores AGAIN. Never doubted him. (I doubted him in August.)` },
      { k: 'club', tone: 'good', t: c => `⚽ ${c.min}' ${c.name}!` },
      { k: 'stats', tone: 'info', t: c => `Goal ${c.seasonGoals} of the season for ${c.last}.` },
      { k: 'fantv', tone: 'good', t: c => `WHAT A FINISH. Say what you want about this team, that lad can play.` },
      { k: 'journo', tone: 'good', t: c => `${c.last} again. Quietly having the kind of season people only notice in May.` }
    ],
    assist: [
      { k: 'stats', tone: 'info', t: c => `${c.last}: ${c.assists} assist${c.assists > 1 ? 's' : ''} today. Nobody at ${c.clubName} creates more.` },
      { k: 'fan', tone: 'good', t: c => `The pass. THE PASS. He saw that before anyone else in the stadium did.` },
      { k: 'pundit', tone: 'good', t: c => `People will clip the finish. Watch the pass again — that is the hard part.` },
      { k: 'fantv', tone: 'good', t: c => `Assists do not trend but that ball was better than most goals I have seen this month.` }
    ],
    motm: [
      { k: 'journo', tone: 'good', t: c => `Man of the match, and it was not close. ${c.name} ran that game from the first whistle.` },
      { k: 'fan', tone: 'good', t: c => `Give him the captaincy. Give him the keys. Give him my house.` },
      { k: 'pundit', tone: 'good', t: c => `Best player on the pitch by a distance. When he plays like that, ${c.clubName} look like a different side.` },
      { k: 'club', tone: 'good', t: c => `Your Player of the Match: ${c.name}. 🌟` }
    ],
    red: [
      { k: 'journo', tone: 'bad', t: c => `Red card for ${c.name}. He knew it the second he did it — did not even wait for the card.` },
      { k: 'fan', tone: 'bad', t: c => `WHAT ARE YOU DOING. We needed him for the next three games. Absolutely gutted.` },
      { k: 'rival', tone: 'bad', t: c => `Sending yourself off in a game like that is a career choice. Enjoy the ban ${c.last}.` },
      { k: 'pundit', tone: 'bad', t: c => `You can talk about passion all you like. That is letting your team-mates down, plain and simple.` },
      { k: 'fantv', tone: 'bad', t: c => `I am not doing a reaction video tonight. I am going to bed.` }
    ],
    stinker: [
      { k: 'fantv', tone: 'bad', t: c => `${c.last.toUpperCase()} WAS ANONYMOUS. I said it live and I will say it again — he did not want it today.` },
      { k: 'rival', tone: 'bad', t: c => `They keep telling us ${c.last} is world class. I have watched him twice now. Twice!` },
      { k: 'fan', tone: 'bad', t: c => `Off day. It happens. Some of you need to calm down before you type.` },
      { k: 'stats', tone: 'info', t: c => `${c.last}: ${c.rating} rating, ${global.U.int(11, 22)} touches, 0 shots on target. A quiet afternoon.` },
      { k: 'pundit', tone: 'bad', t: c => `He is being asked to do too much. That is not an excuse for today, but it is context.` }
    ],
    cleansheet: [
      { k: 'club', tone: 'good', t: c => `Clean sheet number ${c.cs}. 🧱 ${c.name} was immense.` },
      { k: 'fan', tone: 'good', t: c => `Not a single shot got past that back line. ${c.last} was a wall.` },
      { k: 'stats', tone: 'info', t: c => `${c.last} has kept ${c.cs} clean sheets this season.` }
    ],
    keeper: [
      { k: 'fantv', tone: 'good', t: c => `${c.saves} SAVES. He kept us in that on his own and some of you still want him dropped.` },
      { k: 'journo', tone: 'good', t: c => `${c.name} made ${c.saves} saves tonight. Two of them should not have been possible.` },
      { k: 'fan', tone: 'good', t: c => `Best keeper we have had in twenty years and I will hear nothing else.` }
    ],
    win: [
      { k: 'club', tone: 'good', t: c => `FULL TIME: ${c.clubName} ${c.us}-${c.them} ${c.opp}. 3️⃣ points.` },
      { k: 'fan', tone: 'good', t: c => `Get in. Away days like that are why I do this.` },
      { k: 'fantv', tone: 'good', t: c => `WE ARE BACK. Do not let anyone tell you this season is over.` }
    ],
    loss: [
      { k: 'fantv', tone: 'bad', t: c => `Same mistakes, same result, same manager. I am done pretending this is fine.` },
      { k: 'fan', tone: 'bad', t: c => `Four hours on a coach for that. Four hours.` },
      { k: 'rival', tone: 'bad', t: c => `${c.clubName} away, three points, lovely stuff. Thanks for the hospitality.` },
      { k: 'pundit', tone: 'info', t: c => `They had the better player on the pitch and still lost. That is a coaching problem.` }
    ],
    bench: [
      { k: 'fan', tone: 'bad', t: c => `Why is ${c.last} on the bench. Genuine question. Somebody explain it to me slowly.` },
      { k: 'fantv', tone: 'bad', t: c => `Benching your best player away from home is a bold way to run a football club.` },
      { k: 'journo', tone: 'info', t: c => `${c.name} starts on the bench again. The manager insists it is workload management.` }
    ],
    injury: [
      { k: 'club', tone: 'bad', t: c => `${c.name} left the pitch injured. Assessments to follow. 💙` },
      { k: 'fan', tone: 'bad', t: c => `Please no. Please not him. I cannot do this again.` },
      { k: 'rival', tone: 'info', t: c => `No club wants to see that. Get well soon ${c.last}.` },
      { k: 'journo', tone: 'bad', t: c => `${c.last} went down without a challenge near him, which is never a good sign.` }
    ]
  };

  /* Ambient posts — the timeline talking about you between matches. */
  const WEEKLY = [
    { when: c => c.p.form >= 78, k: 'fan', tone: 'good',
      t: c => `${c.last} is in the form of his life and nobody outside this city is talking about it. As usual.` },
    { when: c => c.p.form <= 35 && c.seasonApps >= 5, k: 'fantv', tone: 'bad',
      t: c => `Serious question: does ${c.last} need dropping for a few weeks? Reply with your honest answer.` },
    { when: c => c.p.age <= 21, k: 'journo', tone: 'good',
      t: c => `${c.name} is ${c.p.age}. Remember that when you are judging him. The ceiling on this one is frightening.` },
    { when: c => c.p.age >= 33, k: 'pundit', tone: 'info',
      t: c => `${c.last} at ${c.p.age} has changed his game completely. He does not run past you any more, he thinks past you.` },
    { when: c => c.p.reputation >= 60, k: 'stats', tone: 'info',
      t: c => `Most talked about players this week: 1. ${c.last} 2. ${c.star} 3. ${c.star2}` },
    { when: c => c.p.reputation >= 45, k: 'fan', tone: 'hot',
      t: c => `${c.last} or ${c.star}? And be honest, not clever.` },
    { when: c => c.p.ovr >= 84, k: 'pundit', tone: 'hot',
      t: c => `I will say it: ${c.last} is a top three player in his position on the planet right now. Come and argue.` },
    { when: c => c.p.contract && c.p.contract.years <= 1, k: 'journo', tone: 'info',
      t: c => `Understand ${c.clubName} have made a new offer to ${c.name}. No agreement yet. Several clubs watching this closely.` },
    { when: c => c.p.reputation >= 50 && c.p.ovr >= 78, k: 'journo', tone: 'hot',
      t: c => `Told there has been contact between ${c.bigClub} and the representatives of ${c.name}. Early, but real.` },
    { when: c => c.p.morale <= 35, k: 'fantv', tone: 'bad',
      t: c => `Something is off with ${c.last}. You can see it in the body language. Somebody at that club needs to put an arm round him.` },
    { when: c => c.p.morale >= 80, k: 'fan', tone: 'good',
      t: c => `${c.last} stayed behind after training signing shirts for the kids. That is why we love him.` },
    { when: c => c.seasonGoals >= 10, k: 'stats', tone: 'info',
      t: c => `${c.last} has ${c.seasonGoals} goals. At this rate he finishes on ${Math.round(c.seasonGoals / Math.max(c.seasonApps, 1) * 34)}.` },
    { when: c => c.p.career.apps >= 200, k: 'fan', tone: 'good',
      t: c => `${c.p.career.apps} games for this club. Whatever happens next, he gave us everything.` },
    { when: () => true, k: 'fan', tone: 'hot',
      t: c => `Unpopular opinion: ${c.last} is the most underrated player in the league and it is not even an argument.` },
    { when: () => true, k: 'rival', tone: 'hot',
      t: c => `${c.last} is a good player. He is not a great player. There is a difference and this timeline cannot handle it.` },
    { when: () => true, k: 'fantv', tone: 'info',
      t: c => `New video up: "Is ${c.last} actually as good as we think?" — link in bio, be nice in the comments.` },
    { when: () => true, k: 'stats', tone: 'info',
      t: c => `${c.last} this season: ${c.seasonGoals} goals, ${c.seasonAssists} assists, ${c.seasonApps} apps. Judge it how you like.` },
    { when: c => c.p.traits && c.p.traits.length, k: 'pundit', tone: 'good',
      t: c => `The thing about ${c.last} that does not show up on a stat sheet: ${c.traitLine}.` },
    { when: c => c.club.rating >= 82, k: 'journo', tone: 'info',
      t: c => `${c.clubName} training notes: ${c.last} looked sharp, the manager watched him closely. Make of that what you will.` },
    { when: c => c.club.rating <= 72, k: 'fan', tone: 'bad',
      t: c => `${c.last} is too good for this football club and every single one of you knows it.` },
    { when: () => true, k: 'fan', tone: 'info',
      t: c => `My five year old asked me who my favourite player is. I said ${c.last}. She said "the one who falls over". Devastating.` },
    { when: c => c.p.pos === 'GK', k: 'pundit', tone: 'info',
      t: c => `Keepers get judged on mistakes and nothing else. ${c.last} has had a fine season and one clip has decided his reputation.` },
    { when: c => c.p.reputation >= 70, k: 'club', tone: 'good',
      t: c => `Shirt sales for ${c.last} have broken a club record this month. Thank you for backing him. 💙` },
    { when: c => (c.p.injuries || []).length, k: 'fan', tone: 'bad',
      t: c => `Squad without ${c.last} looks like a completely different team. Get back soon lad.` }
  ];

  /* Posts about the rest of the world's players — the timeline does not
     revolve around you, whatever your agent says. */
  const WORLD = [
    { k: 'fan', tone: 'hot', t: c => `${c.star} or ${c.star2}. You can only pick one. GO.` },
    { k: 'rival', tone: 'hot', t: c => `${c.star} is finished. Has been for a year. You are all watching highlights from 2019.` },
    { k: 'stats', tone: 'info', t: c => `${c.star} is the only player in Europe averaging a goal involvement every 78 minutes.` },
    { k: 'journo', tone: 'info', t: c => `${c.star} to ${c.bigClub}: talks are advanced. Not signed, not sealed — but advanced.` },
    { k: 'fantv', tone: 'hot', t: c => `Say what you want about ${c.star}, he would walk into our team tomorrow and you know it.` },
    { k: 'pundit', tone: 'info', t: c => `The best thing about ${c.star} is that he has never once looked interested in being famous.` },
    { k: 'fan', tone: 'info', t: c => `Someone on here just told me ${c.star} is "decent". Decent. I need to lie down.` },
    { k: 'stats', tone: 'info', t: c => `Youngest players to 100 career goals: it is going to be ${c.star} at this rate.` },
    { k: 'journo', tone: 'bad', t: c => `${c.star} out for six weeks. ${c.bigClub} will feel that one in the run-in.` },
    { k: 'fan', tone: 'hot', t: c => `Ranking the front three in this league: 1. ${c.last} 2. ${c.star} 3. ${c.star2}. Fight me in the replies.` },
    { k: 'pundit', tone: 'hot', t: c => `We have completely lost the ability to enjoy a player without deciding whether he is better than ${c.star}.` }
  ];

  /* Season-defining moments. */
  const SEASON = {
    title: [
      { k: 'club', tone: 'good', t: c => `CHAMPIONS. 🏆 Thank you, every single one of you.` },
      { k: 'fan', tone: 'good', t: c => `I am crying in a kebab shop and I do not care who knows.` },
      { k: 'journo', tone: 'good', t: c => `${c.clubName} are champions, and ${c.name} was the difference in about nine of those games.` },
      { k: 'rival', tone: 'bad', t: c => `Congratulations. Genuinely. We will be back next year and you will not enjoy it.` }
    ],
    trophy: [
      { k: 'club', tone: 'good', t: c => `WE HAVE WON THE ${String(c.trophy).toUpperCase()}. 🏆` },
      { k: 'fan', tone: 'good', t: c => `${c.trophy} winners. Say it again. ${c.trophy} WINNERS.` },
      { k: 'fantv', tone: 'good', t: c => `I have supported this club through absolute rubbish for years. Tonight was worth all of it.` }
    ],
    award: [
      { k: 'journo', tone: 'good', t: c => `${c.name} wins ${c.award}. Nobody who watched this season will argue.` },
      { k: 'rival', tone: 'hot', t: c => `${c.award} for ${c.last}? Robbery. Absolute robbery. There were three better players.` },
      { k: 'fan', tone: 'good', t: c => `${c.award}. Our lad. From our club. 🥹` }
    ],
    flop: [
      { k: 'fantv', tone: 'bad', t: c => `${c.pos}th. That is where we finished. Somebody has to answer for this season.` },
      { k: 'fan', tone: 'bad', t: c => `Renewing my season ticket anyway. I am unwell.` },
      { k: 'pundit', tone: 'info', t: c => `${c.clubName} had one player worth the ticket price and wasted a year of him.` }
    ]
  };

  const TRANSFER = {
    joined: [
      { k: 'club', tone: 'good', t: c => `Welcome, ${c.name}. ✍️ #Welcome${tag(c.clubName)}` },
      { k: 'fan', tone: 'good', t: c => `We have actually signed ${c.last}. I refreshed this app for nine hours and it was worth it.` },
      { k: 'journo', tone: 'info', t: c => `Done deal: ${c.name} to ${c.clubName}. Medical completed this morning.` },
      { k: 'rival', tone: 'hot', t: c => `Overpaid. Wildly overpaid. He had one good season.` },
      { k: 'pundit', tone: 'info', t: c => `Good business if they build the team around him. Waste of money if they do not.` }
    ],
    left: [
      { k: 'fan', tone: 'bad', t: c => `Gutted. Absolutely gutted. Thanks for everything ${c.last} ❤️` },
      { k: 'fan', tone: 'hot', t: c => `He kissed the badge. THE BADGE. And now he is gone.` },
      { k: 'club', tone: 'info', t: c => `${c.name} leaves the club. Thank you for the memories. Good luck. 💙` },
      { k: 'fantv', tone: 'bad', t: c => `Selling him was a decision made by people who do not watch football.` }
    ],
    rejected: [
      { k: 'journo', tone: 'info', t: c => `${c.name} has turned down a move. He wants to finish what he started at ${c.clubName}.` },
      { k: 'fan', tone: 'good', t: c => `HE STAYED. He actually stayed. Loyalty is not dead.` },
      { k: 'rival', tone: 'hot', t: c => `He stayed because nobody serious came in. Let us not rewrite this.` }
    ],
    intl: [
      { k: 'journo', tone: 'good', t: c => `${c.name} is in the ${c.nation} squad. About time.` },
      { k: 'fan', tone: 'good', t: c => `Our player. International. I am not normal about this.` },
      { k: 'rival', tone: 'hot', t: c => `${c.last} in the ${c.nation} squad is the single funniest thing I have read this year.` }
    ]
  };

  const RETIRE = [
    { k: 'club', tone: 'good', t: c => `One club. One shirt in the rafters. Thank you, ${c.name}. 💙` },
    { k: 'journo', tone: 'good', t: c => `${c.name} retires at ${c.p.age}. ${c.p.career.apps} appearances, ${c.p.career.goals} goals, and a generation of kids who copied his celebration.` },
    { k: 'fan', tone: 'good', t: c => `I have never cried at a football match. I have now. Thanks for everything, ${c.last}.` },
    { k: 'rival', tone: 'good', t: c => `Hated playing against him. Loved watching him. All the best ${c.last}.` },
    { k: 'fantv', tone: 'good', t: c => `No reaction video today. Just a thank you. Enjoy your retirement, ${c.last}.` },
    { k: 'stats', tone: 'info', t: c => `${c.last}, final numbers: ${c.p.career.apps} apps, ${c.p.career.goals} goals, ${c.p.career.assists} assists, ${(c.p.career.trophies || []).length} trophies.` },
    { k: 'pundit', tone: 'good', t: c => `You will hear people argue about where ${c.last} ranks. Ignore them. Just be glad you got to watch him.` }
  ];

  /* What you can post yourself, and how the room takes it. */
  const YOUR_POSTS = {
    humble: { t: c => `Not about me. The lads were unbelievable today and the travelling support were even better. On to the next one. 💙`,
      tone: 'good', morale: 3, rep: 0.4, stances: ['wholesome', 'hype', 'doubt'] },
    cocky: { t: c => `Funny how quiet it gets. 🤫`,
      tone: 'hot', morale: 6, rep: 1.2, stances: ['banter', 'hype', 'doubt', 'joke'] },
    funny: { t: c => `My mum has just texted me "who was number 9" and I have never felt less famous in my life 😭`,
      tone: 'good', morale: 5, rep: 0.8, stances: ['joke', 'wholesome', 'hype'] },
    fireback: { t: c => `I read everything. All of it. Keep going, it helps. 📌`,
      tone: 'hot', morale: 2, rep: 1.5, stances: ['banter', 'hype', 'doubt', 'tactic'] }
  };

  /* ---------------- assembly ---------------- */

  function starNames(g, n) {
    const U = global.U, State = global.State;
    const map = global.Eras.starMap(g.era, g.world);
    const clubs = Object.keys(map).filter(k => (map[k] || []).length);
    const out = [];
    for (let i = 0; i < 24 && out.length < n; i++) {
      if (!clubs.length) break;
      const s = U.pick(map[U.pick(clubs)]);
      if (s && out.indexOf(s[0]) < 0) out.push(s[0]);
    }
    while (out.length < n) out.push('the new lad');
    return out;
  }

  function ctx(g, extra) {
    const U = global.U, State = global.State, p = g.player, club = State.club(p.club);
    const stars = starNames(g, 2);
    const giants = Object.values(g.world.clubs).filter(c => c.rating >= 84 && c.id !== club.id);
    const traits = (p.traits || []).map(t => (global.DATA.TRAITS[t] || {}).name).filter(Boolean);
    const c = {
      g, p, club,
      clubName: club.name,
      name: p.firstName + ' ' + p.lastName,
      last: p.lastName,
      first: p.firstName,
      pos: p.pos,
      nation: p.nation,
      star: stars[0], star2: stars[1],
      bigClub: giants.length ? U.pick(giants).name : 'a European giant',
      traitLine: traits.length ? U.pick(traits).toLowerCase() : 'he never stops moving',
      seasonGoals: p.season.goals, seasonAssists: p.season.assists, seasonApps: p.season.apps,
      cs: p.season.cleanSheets || 0,
      reach: reach(p)
    };
    if (extra) for (const k in extra) c[k] = extra[k];
    return c;
  }

  function reach(p) {
    return 0.35 + (p.reputation || 0) / 100 * 2.4 + (p.ovr >= 85 ? 0.7 : 0);
  }

  function push(g, entry, c, opts) {
    const U = global.U;
    const o = opts || {};
    const who = entry.k === 'you' ? you(g.player) : pickFolk(g, entry.k);
    const text = entry.t(c);
    g.feed = g.feed || [];
    if (g.feed.some(f => f.t === text)) return null;   // never the same post twice
    const heat = (o.heat || 1) * (entry.tone === 'hot' ? 1.5 : 1)
      * (who.kind === 'club' || who.kind === 'journo' ? 1.4 : 1);
    const likes = Math.max(3, Math.round(U.rnd(30, 260) * c.reach * heat));
    const post = {
      t: text,
      who: { n: who.n, h: who.h, kind: who.kind, v: !!who.v, bio: who.bio || '' },
      tone: entry.tone || 'info',
      tick: (g.world.year * 60) + (g.fixtureIndex || 0),
      season: g.world.year,
      likes,
      reposts: Math.round(likes * U.rnd(0.08, 0.3)),
      tags: o.tags || [],
      replies: repliesFor(g, entry.tone || 'info', c, o.replies)
    };
    g.feedCount = (g.feedCount || 0) + 1;
    g.feed.unshift(post);
    if (g.feed.length > CAP) g.feed.length = CAP;
    return post;
  }

  function fire(g, pool, c, opts) {
    const U = global.U;
    const usable = pool.filter(e => !e.when || e.when(c));
    if (!usable.length) return null;
    return push(g, U.pick(usable), c, opts);
  }

  const Social = {
    CAP,
    folk, you, initials, hue, reach,

    /* every match you were involved in */
    afterMatch(g, m, played) {
      const U = global.U, p = g.player;
      if (!g.feed) g.feed = [];
      const c = ctx(g, {
        m, opp: m.oppName, us: m.us, them: m.them,
        goals: m.stats ? m.stats.goals : 0,
        assists: m.stats ? m.stats.assists : 0,
        rating: m.stats ? m.stats.rating : 0,
        saves: m.stats ? m.stats.saves : 0,
        min: U.int(12, 88)
      });
      const s = m.stats || {};
      const fired = [];
      const go = (pool, heat, tags) => { const r = fire(g, pool, c, { heat, tags }); if (r) fired.push(r); };

      if (!played) {
        if (U.chance(0.4)) go(MATCH.bench, 0.8, ['#Start' + c.last]);
      } else {
        if (s.goals >= 3) { go(MATCH.hattrick, 2.4, ['#' + c.last]); go(MATCH.hattrick, 2, []); }
        else if (s.goals === 2) go(MATCH.brace, 1.7, ['#' + c.last]);
        else if (s.goals === 1) go(MATCH.goal, 1.2, []);
        if (s.assists >= 1 && U.chance(0.65)) go(MATCH.assist, 1.1, []);
        if (m.motm && U.chance(0.8)) go(MATCH.motm, 1.5, ['#MOTM']);
        if (s.card === 'red') { go(MATCH.red, 2, ['#' + c.last + 'Red']); go(MATCH.red, 1.6, []); }
        if (s.rating <= 5.4) go(MATCH.stinker, 1.3, []);
        if (s.saves >= 4) go(MATCH.keeper, 1.4, []);
        if (m.them === 0 && (p.pos === 'GK' || (global.DATA.POSITIONS[p.pos] || {}).group === 'DEF'))
          go(MATCH.cleansheet, 1.1, []);
        if (m.postInjury || m.injuredDuring) go(MATCH.injury, 1.6, ['#GetWellSoon']);
        if (!fired.length) {
          if (m.result === 'W' && U.chance(0.5)) go(MATCH.win, 0.9, []);
          else if (m.result === 'L' && U.chance(0.55)) go(MATCH.loss, 1, []);
        }
      }
      return fired;
    },

    /* between matches — chatter about you and about everyone else */
    weekly(g) {
      const U = global.U;
      if (!g.feed) g.feed = [];
      const c = ctx(g);
      if (U.chance(0.55)) fire(g, WEEKLY, c, { heat: 0.9 });
      if (U.chance(0.4)) fire(g, WORLD, c, { heat: 0.8 });
    },

    season(g, results) {
      const U = global.U;
      const c = ctx(g, { pos: results.pos, trophy: (results.trophies || [])[0], award: (results.awards || [])[0] });
      if (results.pos === 1) fire(g, SEASON.title, c, { heat: 3, tags: ['#Champions'] });
      (results.trophies || []).forEach(t => {
        if (/title$/i.test(t)) return;
        fire(g, SEASON.trophy, ctx(g, { trophy: t }), { heat: 2.6, tags: ['#' + String(t).replace(/\W/g, '')] });
      });
      (results.awards || []).forEach(a => {
        if (U.chance(0.8)) fire(g, SEASON.award, ctx(g, { award: a }), { heat: 2.2 });
      });
      if (results.pos >= 12) fire(g, SEASON.flop, c, { heat: 1.4 });
    },

    transfer(g, kind) {
      const c = ctx(g);
      const pool = TRANSFER[kind];
      if (!pool) return;
      // a move rebuilds the local accounts around the new badge
      if (kind === 'joined') g.feedFolk = null;
      fire(g, pool, c, { heat: 2.2, tags: ['#' + tag(c.clubName)] });
      if (global.U.chance(0.6)) fire(g, pool, c, { heat: 1.6 });
    },

    /* the last day */
    retire(g) {
      const c = ctx(g);
      for (let i = 0; i < 3; i++) fire(g, RETIRE, c, { heat: 3, tags: ['#ThankYou' + c.last], replies: 3 });
    },

    /* your own account */
    canPost(g) {
      const now = (g.world.year * 60) + (g.fixtureIndex || 0);
      return (g.lastPostTick == null) || now > g.lastPostTick;
    },
    postAs(g, styleKey) {
      const U = global.U, p = g.player;
      const style = YOUR_POSTS[styleKey];
      if (!style) return null;
      const c = ctx(g);
      const post = push(g, { k: 'you', tone: style.tone, t: style.t }, c, { heat: 2.2, replies: 3 });
      if (post) {
        const used = [];
        post.replies = U.shuffle(style.stances).slice(0, 3).map(s => replyFor(g, s, c, used));
        post.mine = true;
      }
      g.lastPostTick = (g.world.year * 60) + (g.fixtureIndex || 0);
      p.morale = U.clamp(p.morale + style.morale, 0, 100);
      global.State.addReputation(p, style.rep);
      return post;
    },
    POST_STYLES: [
      { id: 'humble', label: 'Keep it humble', icon: 'ok', hint: 'Credit the team. Nobody can attack it.' },
      { id: 'cocky', label: 'Let them know', icon: 'morale', hint: 'Louder. Riskier. More fun.' },
      { id: 'funny', label: 'Be funny', icon: 'celebrate', hint: 'The internet forgives a good joke.' },
      { id: 'fireback', label: 'Answer the critics', icon: 'alert', hint: 'Tell them you read everything.' }
    ],

    /* what the timeline is arguing about right now */
    trending(g) {
      const feed = g.feed || [];
      const counts = {};
      feed.slice(0, 24).forEach(f => (f.tags || []).forEach(t => counts[t] = (counts[t] || 0) + 1));
      const p = g.player;
      const base = ['#' + p.lastName, '#' + tag(global.State.club(p.club).name)];
      base.forEach(t => counts[t] = (counts[t] || 0) + 1);
      return Object.keys(counts).sort((a, b) => counts[b] - counts[a]).slice(0, 5);
    },

    followers(g) {
      const p = g.player;
      const rep = Math.max(p.reputation || 0, 0);
      const base = Math.pow(10, 2.75 + rep * 0.052)
        * (1 + (p.career.trophies || []).length * 0.02)
        + (p.career.goals || 0) * 800 + 900;
      return Math.round(base);
    },

    compact(n) {
      if (n >= 1000000) return (n / 1000000).toFixed(n >= 10000000 ? 0 : 1).replace(/\.0$/, '') + 'M';
      if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '') + 'K';
      return String(Math.round(n));
    },

    /* "3d" style stamps, from the match clock rather than a real one */
    when(g, post) {
      const now = (g.world.year * 60) + (g.fixtureIndex || 0);
      const d = Math.max(0, now - (post.tick || now));
      if (d === 0) return 'now';
      if (d === 1) return '3d';
      if (d < 4) return d * 3 + 'd';
      if (d < 30) return Math.round(d / 4) + 'w';
      return Math.max(1, Math.round(d / 52)) + 'y';
    }
  };

  global.Social = Social;
})(window);
