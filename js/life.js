/* ==========================================================================
   life.js — the "off the pitch" life sim: activities, relationships, money,
   sponsors, social media, scandals and random life events
   ========================================================================== */
(function (global) {
  'use strict';
  const D = global.DATA, U = global.U, State = global.State, Engine = global.Engine;

  function P() { return State.game.player; }
  function clamp(v) { return U.clamp(v, 0, 100); }

  const PARTNER_NAMES = ['Ava','Sofia','Chloe','Maya','Noor','Isla','Zara','Elena','Freya','Nina','Alex','Jordan',
    'Sam','Rio','Luca','Kai','Robin','Mika','Ines','Tess','Amara','Bea','Cleo','Dara'];
  const PARTNER_JOBS = ['influencer','doctor','architect','pop star','lawyer','model','teacher','chef',
    'nurse','TV presenter','photographer','athlete','journalist','engineer','DJ'];

  const Life = {

    /* ================= perks & staff ================= */
    PERKS: [
      { id: 'chef',    name: 'Personal Chef',      icon: '👨‍🍳', cost: 180000,  desc: 'Recover fitness faster every week.' },
      { id: 'physio',  name: 'Private Physio',     icon: '🧑‍⚕️', cost: 320000,  desc: 'Injuries heal noticeably quicker.' },
      { id: 'mind',    name: 'Mental Coach',       icon: '🧠', cost: 260000,  desc: 'Morale decays slower, big-game nerves reduced.' },
      { id: 'pr',      name: 'PR Agency',          icon: '📰', cost: 400000,  desc: 'Scandals hurt half as much, fame grows faster.' },
      { id: 'coach',   name: 'Private Skills Coach', icon: '🎓', cost: 550000, desc: 'Training sessions give +50% progress.' },
      { id: 'analyst', name: 'Data Analyst',       icon: '💻', cost: 300000,  desc: 'Manager trust grows faster from good displays.' }
    ],
    hasPerk(g, id) { return (g.player.perks || []).indexOf(id) >= 0; },
    buyPerk(g, id) {
      const p = g.player, perk = Life.PERKS.find(x => x.id === id);
      if (!perk) return { text: 'Nothing happens.' };
      if (Life.hasPerk(g, id)) return { text: 'You already employ them.', tone: 'neutral' };
      if (p.money < perk.cost) return { text: 'You cannot afford that right now.', tone: 'bad' };
      State.addMoney(p, -perk.cost);
      p.perks = (p.perks || []).concat(id);
      return { title: 'Hired: ' + perk.name, text: perk.desc, tone: 'good' };
    },

    /* ================= weekly activities ================= */
    activities(g) {
      const p = g.player;
      const list = [
        { id: 'train',   name: 'Extra Training', icon: '🏃', desc: 'Pick a drill and grind at it.' },
        { id: 'rest',    name: 'Rest & Recover', icon: '😴', desc: 'Sleep, ice baths, do nothing. Fitness back up.' },
        { id: 'video',   name: 'Video Analysis', icon: '📼', desc: 'Study the next opponent. The manager notices.' },
        { id: 'social',  name: 'Post on Social', icon: '📱', desc: 'Feed the algorithm, grow the brand.' },
        { id: 'party',   name: 'Night Out',      icon: '🍸', desc: 'Great for morale, terrible for everything else.' },
        { id: 'family',  name: 'Time With Loved Ones', icon: '💞', desc: 'Recharge properly.' },
        { id: 'charity', name: 'Charity Work',   icon: '❤️', desc: 'Give something back. Costs money, feels good.' },
        { id: 'media',   name: 'Press Interview', icon: '🎙️', desc: 'Say something. Or say nothing.' },
        { id: 'agent',   name: 'Meet Your Agent', icon: '🕴️', desc: 'Contracts, sponsors, gossip.' },
        { id: 'casino',  name: 'Casino Night',   icon: '🎰', desc: 'What could possibly go wrong?' },
        { id: 'language',name: 'Language Class', icon: '🗣️', desc: 'Settle in abroad, charm the fans.' },
        { id: 'gaming',  name: 'Gaming Marathon', icon: '🎮', desc: 'Twelve hours online with the lads.' }
      ];
      if (p.injuries.length) list.unshift({ id: 'rehab', name: 'Intensive Rehab', icon: '🩹', desc: 'Get back on the pitch sooner.' });
      return list;
    },

    doActivity(g, id, opt) {
      const p = g.player;
      const chef = Life.hasPerk(g, 'chef'), pr = Life.hasPerk(g, 'pr'), coach = Life.hasPerk(g, 'coach');
      switch (id) {
        case 'train': {
          const drill = D.TRAINING.find(t => t.id === opt) || D.TRAINING[0];
          let amount = U.rnd(2.4, 4.6) * (coach ? 1.5 : 1) * (p.fitness > 65 ? 1 : 0.6);
          if (p.age > 30) amount *= 0.75;
          const gains = Engine.Progress.addXp(p, drill.attr, amount);
          p.fitness = clamp(p.fitness - drill.fatigue * (chef ? 0.8 : 1));
          p.morale = clamp(p.morale - 1);
          return { title: drill.icon + ' ' + drill.name, tone: 'good',
            text: gains.length
              ? `Brilliant session. ${D.ATTR_LABEL[drill.attr]} improved to ${p.attrs[drill.attr]}!`
              : `Solid work on your ${D.ATTR_LABEL[drill.attr].toLowerCase()}. Progress is building.`,
            gains };
        }
        case 'rest': {
          const amt = U.rnd(18, 30) * (chef ? 1.25 : 1);
          p.fitness = clamp(p.fitness + amt);
          p.morale = clamp(p.morale + 3);
          p.health = clamp(p.health + 1);
          return { title: '😴 Rest Week', tone: 'good', text: `You do absolutely nothing and it is glorious. Fitness now ${Math.round(p.fitness)}%.` };
        }
        case 'rehab': {
          const speed = Life.hasPerk(g, 'physio') ? 2 : 1;
          p.injuries.forEach(i => i.matches = Math.max(0, i.matches - speed));
          p.injuries = p.injuries.filter(i => i.matches > 0);
          p.fitness = clamp(p.fitness + 6);
          return { title: '🩹 Rehab', tone: 'good',
            text: p.injuries.length ? `Hard work in the gym. ${p.injuries[0].name}: about ${p.injuries[0].matches} more match(es).`
                                    : 'You are declared fully fit! Back in training tomorrow.' };
        }
        case 'video': {
          p.managerTrust = clamp(p.managerTrust + U.rnd(3, 7) * (Life.hasPerk(g, 'analyst') ? 1.5 : 1));
          Engine.Progress.addXp(p, D.POSITIONS[p.pos].group === 'DEF' ? 'defending' : 'passing', 1.4);
          p.morale = clamp(p.morale - 1);
          return { title: '📼 Video Analysis', tone: 'good', text: 'You stay behind with the analysts and pick the opponent apart. The manager mentions it in his team talk.' };
        }
        case 'social': return Life.socialPost(g, opt);
        case 'party': {
          p.morale = clamp(p.morale + U.rnd(8, 16));
          p.fitness = clamp(p.fitness - U.rnd(10, 20));
          p.discipline = clamp(p.discipline - U.rnd(2, 8));
          Life.bumpTeammates(g, 4);
          if (U.chance(pr ? 0.14 : 0.28)) {
            const hit = pr ? 0.5 : 1;
            State.addFame(p, 2 * hit);
            p.managerTrust = clamp(p.managerTrust - 12 * hit);
            p.happiness = clamp(p.happiness - 4);
            return { title: '📸 Front page', tone: 'bad',
              text: 'Someone filmed you at 4am. The clip is everywhere by breakfast and the manager wants a word.' };
          }
          return { title: '🍸 Night Out', tone: 'good', text: 'A brilliant night with the lads. Nobody had a phone out. Probably.' };
        }
        case 'family': {
          const partner = Life.partner(g);
          p.happiness = clamp(p.happiness + U.rnd(8, 14));
          p.morale = clamp(p.morale + 5);
          if (partner) partner.level = clamp(partner.level + U.rnd(6, 12));
          return { title: '💞 Family Time', tone: 'good',
            text: partner ? `A proper week at home with ${partner.name}${(p.children||[]).length ? ' and the kids' : ''}. You feel human again.`
                          : 'You visit your parents. Your mum still asks if you are eating properly.' };
        }
        case 'charity': {
          const cost = Math.min(p.money, Math.max(5000, Math.round(p.money * 0.02)));
          State.addMoney(p, -cost);
          State.addFame(p, 1.2);
          p.happiness = clamp(p.happiness + 8);
          p.karma = (p.karma || 0) + 1;
          return { title: '❤️ Charity Work', tone: 'good',
            text: `You donate ${U.cash(cost)} and spend the day at a local youth club. No cameras. The kids were buzzing.` };
        }
        case 'media': return Life.pressInterview(g, opt);
        case 'agent': return Life.agentMeeting(g);
        case 'casino': {
          const stake = Math.min(p.money, Math.max(2000, Math.round(p.money * 0.06)));
          if (stake < 1000) return { title: '🎰 Casino', tone: 'neutral', text: 'You check your balance at the door and quietly go home.' };
          State.addMoney(p, -stake);
          const r = Math.random();
          if (r < 0.14) { const win = stake * U.int(4, 9); State.addMoney(p, win);
            State.addFame(p, 0.6);
            return { title: '🎰 Casino Night', tone: 'good', text: `You put ${U.cash(stake)} on black… and walk out with ${U.cash(win)}. The pit boss shakes your hand.` }; }
          if (r < 0.42) { State.addMoney(p, stake * 1.6);
            return { title: '🎰 Casino Night', tone: 'good', text: `Up ${U.cash(stake * 0.6)} and sensible enough to leave. Rare.` }; }
          p.discipline = clamp(p.discipline - 4);
          p.gamblingLosses = (p.gamblingLosses || 0) + stake;
          if ((p.gamblingLosses || 0) > 3000000 && U.chance(0.3)) {
            State.addFame(p, 2); p.managerTrust = clamp(p.managerTrust - 8);
            return { title: '🃏 Gambling story leaks', tone: 'bad', text: `Another ${U.cash(stake)} gone — and now a tabloid has your losses. The club offers you support.` };
          }
          return { title: '🎰 Casino Night', tone: 'bad', text: `${U.cash(stake)} gone in ninety minutes. You tell yourself it is entertainment.` };
        }
        case 'language': {
          p.languages = (p.languages || 0) + 1;
          p.happiness = clamp(p.happiness + 5);
          State.addFame(p, 0.4);
          Life.bumpTeammates(g, 3);
          return { title: '🗣️ Language Class', tone: 'good',
            text: `You do your first interview in the local language. The fans absolutely love it. (Languages: ${p.languages})` };
        }
        case 'gaming': {
          p.morale = clamp(p.morale + 7);
          p.fitness = clamp(p.fitness - 3);
          Life.bumpTeammates(g, 3);
          if (U.chance(0.2)) { State.addFollowers(p, 0.02, 2000); State.addFame(p, 0.8);
            return { title: '🎮 Stream night', tone: 'good', text: 'You stream for four hours with two team-mates. 40,000 people watch you rage quit.' }; }
          return { title: '🎮 Gaming Marathon', tone: 'neutral', text: 'You and the lads stay up far too late. Worth it.' };
        }
      }
      return { title: 'Week passes', text: 'Nothing much happens.', tone: 'neutral' };
    },

    /* ================= social media ================= */
    socialPost(g, type) {
      const p = g.player;
      const boost = Life.hasPerk(g, 'pr') ? 1.4 : 1;
      const options = {
        training: { text: 'Grind never stops 💪', gain: [0.3, 0.8], risk: 0 },
        lifestyle: { text: 'New watch, new car, same me ⌚', gain: [0.8, 2.0], risk: 0.12 },
        fans: { text: 'This club, these fans ❤️', gain: [0.6, 1.4], risk: 0.02 },
        spicy: { text: 'A cryptic post about "certain people" 👀', gain: [1.5, 3.5], risk: 0.4 },
        charity: { text: 'Proud to support the foundation 🙏', gain: [0.5, 1.2], risk: 0 }
      };
      const o = options[type] || options.training;
      const gain = U.rnd(o.gain[0], o.gain[1]) * boost;
      State.addFame(p, gain);
      State.addFollowers(p, gain * 0.018 + p.fame / 9000, U.int(400, 6000));
      if (U.chance(o.risk * (Life.hasPerk(g, 'pr') ? 0.5 : 1))) {
        p.managerTrust = clamp(p.managerTrust - U.rnd(6, 14));
        p.morale = clamp(p.morale - 4);
        return { title: '📱 That post did numbers', tone: 'bad',
          text: `"${o.text}" — 2.4 million views, and every single pundit has an opinion. The manager did not enjoy it.` };
      }
      return { title: '📱 Posted', tone: 'good',
        text: `"${o.text}"\n\nYou pick up followers — now on ${U.money(p.followers)}.` };
    },

    pressInterview(g, tone) {
      const p = g.player;
      if (tone === 'humble') {
        p.managerTrust = clamp(p.managerTrust + 5); State.addFame(p, 0.3);
        return { title: '🎙️ "Credit to the team"', tone: 'good', text: 'You say all the right things. Boring, professional, and the coaching staff love it.' };
      }
      if (tone === 'bold') {
        State.addFame(p, 2.5); State.addFollowers(p, 0.025, 3000);
        if (U.chance(0.4)) { p.managerTrust = clamp(p.managerTrust - 10);
          return { title: '🎙️ "We should be winning the league"', tone: 'bad', text: 'Big words. Back page everywhere. Your manager is asked about it and does not defend you.' }; }
        return { title: '🎙️ "We should be winning the league"', tone: 'good', text: 'The fans adore the ambition. Your quotes are on every highlight reel.' };
      }
      if (tone === 'callout') {
        State.addFame(p, 4); p.managerTrust = clamp(p.managerTrust - U.rnd(10, 22));
        p.morale = clamp(p.morale + 4);
        Life.bumpTeammates(g, -6);
        return { title: '🎙️ You call out the club', tone: 'bad',
          text: 'You question the recruitment, the training ground, the ambition. It is explosive — and the dressing room is split.' };
      }
      p.managerTrust = clamp(p.managerTrust + 2);
      return { title: '🎙️ "I just want to help the team"', tone: 'neutral', text: 'Eleven clichés in ninety seconds. Nobody can criticise you for it.' };
    },

    agentMeeting(g) {
      const p = g.player;
      const val = State.marketValue(p);
      const lines = [
        `Your agent orders the most expensive thing on the menu and tells you that you are worth ${U.cash(val)}.`,
        `"Three clubs have called this month," he says, without naming any of them.`,
        `He shows you a spreadsheet. You understand none of it. Apparently you are "trending".`
      ];
      p.agentLevel = (p.agentLevel || 1);
      const offers = Life.sponsorOffers(g);
      return { title: '🕴️ Agent Meeting', tone: 'neutral',
        text: U.pick(lines) + (offers.length ? `\n\nHe has ${offers.length} sponsorship offer(s) on the table — check the Money tab.` : '\n\nNo sponsor interest yet. "Score more goals," he shrugs.'),
        sponsors: offers };
    },

    /* ================= sponsors ================= */
    sponsorOffers(g) {
      const p = g.player;
      return D.SPONSORS.filter(s => p.fame >= s.minFame && !p.sponsors.some(x => x.id === s.id))
        .map(s => ({
          id: s.id, name: s.name, icon: s.icon,
          annual: Math.round(s.base * (0.7 + p.fame / 110) * (1 + Math.min(p.followers / 60000000, 1.2)) / 1000) * 1000,
          years: U.int(2, 4)
        }));
    },
    signSponsor(g, id) {
      const p = g.player;
      const offer = Life.sponsorOffers(g).find(o => o.id === id);
      if (!offer) return { text: 'That deal is off the table.', tone: 'bad' };
      p.sponsors.push({ id: offer.id, name: offer.name, icon: offer.icon, annual: offer.annual, years: offer.years });
      State.addFame(p, 1.5);
      State.addMoney(p, Math.round(offer.annual * 0.25));
      return { title: '🤝 Deal signed: ' + offer.name, tone: 'good',
        text: `${U.cash(offer.annual)} per year for ${offer.years} years, plus a signing payment. Your face is about to be on a lot of billboards.` };
    },

    /* ================= assets / investments ================= */
    buyAsset(g, id) {
      const p = g.player, a = D.ASSETS.find(x => x.id === id);
      if (!a) return { text: 'Nothing happens.' };
      if (p.money < a.cost) return { title: 'Declined', tone: 'bad', text: 'Your card is declined. Embarrassing.' };
      State.addMoney(p, -a.cost);
      p.assets.push({ id: a.id, name: a.name, icon: a.icon, cost: a.cost, year: g.world.year });
      State.addFame(p, a.fame);
      p.happiness = clamp(p.happiness + a.happy);
      return { title: a.icon + ' Bought: ' + a.name, tone: 'good',
        text: `${U.cash(a.cost)} gone. Worth every penny. Probably.` };
    },
    invest(g, id, amount) {
      const p = g.player, inv = D.INVESTMENTS.find(x => x.id === id);
      if (!inv) return { text: 'Nothing happens.' };
      amount = Math.round(amount);
      if (amount < inv.min) return { title: 'Too small', tone: 'bad', text: `Minimum investment is ${U.cash(inv.min)}.` };
      if (amount > p.money) return { title: 'Insufficient funds', tone: 'bad', text: 'You do not have that much liquid.' };
      State.addMoney(p, -amount);
      p.investments.push({ uid: U.id(), id: inv.id, name: inv.name, icon: inv.icon, amount, year: g.world.year });
      return { title: inv.icon + ' Invested', tone: 'good', text: `${U.cash(amount)} into ${inv.name}. Let's see what happens at the end of the season.` };
    },
    resolveInvestments(g) {
      const p = g.player, out = [];
      p.investments.forEach(pos => {
        const inv = D.INVESTMENTS.find(x => x.id === pos.id);
        if (!inv) return;
        const bad = U.chance(inv.risk);
        const mult = bad ? U.rnd(inv.mult[0], 1) : U.rnd(1, inv.mult[1]);
        const value = Math.round(pos.amount * mult);
        State.addMoney(p, value);
        out.push({ name: pos.name, icon: pos.icon, in: pos.amount, out: value, delta: value - pos.amount });
      });
      p.investments = [];
      return out;
    },

    /* ================= relationships ================= */
    partner(g) { return g.player.relationships.find(r => r.type === 'partner' && !r.ended); },
    bumpTeammates(g, amount) {
      const sq = Engine.Squad.ensure(g);
      U.pickN(sq, 5).forEach(s => s.rel = clamp((s.rel || 50) + amount));
    },
    datingApp(g) {
      const p = g.player;
      if (Life.partner(g)) return { title: 'You are already taken', tone: 'neutral', text: 'You close the app immediately. Obviously.' };
      const appeal = p.fame * 0.6 + 25;
      if (!U.chance(U.clamp(appeal / 100, 0.25, 0.95))) {
        return { title: '💔 No luck', tone: 'bad', text: 'A lot of swiping, a lot of silence. Football is your only love this week.' };
      }
      const person = {
        id: U.id(), type: 'partner', name: U.pick(PARTNER_NAMES), job: U.pick(PARTNER_JOBS),
        level: U.int(45, 70), status: 'dating', since: g.world.year, famous: U.chance(p.fame / 160)
      };
      p.relationships.push(person);
      p.happiness = clamp(p.happiness + 10);
      return { title: '💘 New relationship', tone: 'good',
        text: `You start seeing ${person.name}, a ${person.job}${person.famous ? ' with a bigger following than you' : ''}. Things are going well.` };
    },
    interactPartner(g, kind) {
      const p = g.player, r = Life.partner(g);
      if (!r) return { title: 'Nobody to call', tone: 'neutral', text: 'You are single. Try the dating app.' };
      switch (kind) {
        case 'date': {
          const cost = U.int(300, 9000);
          State.addMoney(p, -Math.min(cost, p.money));
          r.level = clamp(r.level + U.rnd(5, 12));
          p.happiness = clamp(p.happiness + 6);
          return { title: '🍷 Date night', tone: 'good', text: `A lovely evening with ${r.name}. ${U.cash(cost)} on dinner and nobody recognised you. Bliss.` };
        }
        case 'gift': {
          const cost = Math.max(5000, Math.round(p.money * 0.03));
          if (p.money < cost) return { title: 'Skint', tone: 'bad', text: 'You cannot afford anything decent right now.' };
          State.addMoney(p, -cost);
          r.level = clamp(r.level + U.rnd(8, 18));
          return { title: '🎁 Extravagant gift', tone: 'good', text: `You spend ${U.cash(cost)} on ${r.name}. The photo gets 300,000 likes.` };
        }
        case 'propose': {
          if (r.status !== 'dating') return { title: 'Already there', tone: 'neutral', text: 'You are past that stage.' };
          if (r.level < 65) { r.level = clamp(r.level - 15);
            return { title: '💍 Rejected', tone: 'bad', text: `${r.name} says it is too soon. The restaurant staff look away politely.` }; }
          r.status = 'engaged'; p.happiness = clamp(p.happiness + 15); State.addFame(p, 2);
          const cost = Math.round(p.money * 0.05);
          State.addMoney(p, -cost);
          return { title: '💍 Engaged!', tone: 'good', text: `${r.name} says yes! The ring cost ${U.cash(cost)} and the internet has thoughts about it.` };
        }
        case 'marry': {
          if (r.status !== 'engaged') return { title: 'Not yet', tone: 'neutral', text: 'You should probably propose first.' };
          const cost = Math.round(Math.max(150000, p.money * 0.12));
          State.addMoney(p, -Math.min(cost, p.money));
          r.status = 'married'; r.marriedYear = g.world.year;
          p.happiness = clamp(p.happiness + 20); State.addFame(p, 4); p.morale = clamp(p.morale + 8);
          return { title: '💒 Married!', tone: 'good',
            text: `You marry ${r.name} in front of 300 guests and a helicopter full of photographers. ${U.cash(cost)} well spent.` };
        }
        case 'child': {
          if (r.status === 'dating' && !U.chance(0.5)) return { title: 'Not the right time', tone: 'neutral', text: `${r.name} wants to wait.` };
          p.children = (p.children || []).concat([{ name: U.pick(PARTNER_NAMES), year: g.world.year }]);
          p.happiness = clamp(p.happiness + 18);
          p.fitness = clamp(p.fitness - 6);
          r.level = clamp(r.level + 10);
          return { title: '👶 A baby!', tone: 'good',
            text: `You are a parent. Sleep is now a distant memory, but you have never been happier. You celebrate your next goal with a thumb-suck.` };
        }
        case 'breakup': {
          r.ended = true;
          const married = r.status === 'married';
          let cost = 0;
          if (married) { cost = Math.round(p.money * U.rnd(0.25, 0.45)); State.addMoney(p, -cost); }
          p.happiness = clamp(p.happiness - (married ? 25 : 12));
          p.morale = clamp(p.morale - 10);
          return { title: married ? '💔 Divorce' : '💔 Break-up', tone: 'bad',
            text: married ? `The divorce costs you ${U.cash(cost)} and a fortnight of headlines.` : `You and ${r.name} go your separate ways.` };
        }
      }
      return { title: '…', text: 'Nothing happens.', tone: 'neutral' };
    },

    /* ================= random life events ================= */
    EVENTS: [
      { id: 'tabloid', w: 1, title: '📰 A story is coming out',
        text: 'A tabloid says they have photos of you leaving a club at 5am with "a mystery companion". They want a comment.',
        options: [
          { label: 'Deny everything', run(g) { const p = P(); State.addFame(p, 1);
            return U.chance(0.6) ? { tone: 'good', text: 'It blows over in two days. Nobody cares by the weekend.' }
              : (p.managerTrust = clamp(p.managerTrust - 8), { tone: 'bad', text: 'They print the photos anyway. You look ridiculous.' }); } },
          { label: 'Pay them off', run(g) { const p = P(); const c = Math.round(Math.max(50000, p.money * 0.04));
            State.addMoney(p, -c); return { tone: 'neutral', text: `${U.cash(c)} makes the story disappear. Your agent handles it with a smile you do not like.` }; } },
          { label: 'Own it publicly', run(g) { const p = P(); State.addFame(p, 3.5); State.addFollowers(p, 0.04, 9000);
            p.managerTrust = clamp(p.managerTrust - 4);
            return { tone: 'good', text: 'You post the photo yourself with a laughing emoji. The internet declares you a legend.' }; } }
        ]},
      { id: 'youthfan', w: 1, title: '🧒 A young fan waits outside',
        text: 'A kid in your shirt has been waiting three hours in the rain by the training ground gate.',
        options: [
          { label: 'Give him your boots', run(g) { const p = P(); State.addFame(p, 1.5); p.happiness = clamp(p.happiness + 8); p.karma = (p.karma || 0) + 1;
            return { tone: 'good', text: 'The photo of his face goes around the world. You get a letter from his mum a week later.' }; } },
          { label: 'Quick photo and go', run() { return { tone: 'neutral', text: 'He is thrilled anyway. You drive off feeling fine about it.' }; } },
          { label: 'Drive past', run(g) { const p = P(); State.addFame(p, -(1)); p.karma = (p.karma || 0) - 1;
            return { tone: 'bad', text: 'Someone films you driving past. It does not look great.' }; } }
        ]},
      { id: 'manager_row', w: 1, title: '😤 Dressing room row',
        text: 'The manager singles you out in front of the whole squad at half-time. It is brutal, and not entirely fair.',
        options: [
          { label: 'Bite back', run(g) { const p = P(); p.managerTrust = clamp(p.managerTrust - 18); p.morale = clamp(p.morale + 6);
            Life.bumpTeammates(g, 3);
            return { tone: 'bad', text: 'You tell him exactly what you think. The lads are stunned. You will be on the bench next week.' }; } },
          { label: 'Take it and respond on the pitch', run(g) { const p = P(); p.form = clamp(p.form + 10); p.managerTrust = clamp(p.managerTrust + 6);
            return { tone: 'good', text: 'You say nothing and produce your best forty-five minutes of the season.' }; } },
          { label: 'Ask for a private chat', run(g) { const p = P(); p.managerTrust = clamp(p.managerTrust + 10);
            return { tone: 'good', text: 'You knock on his door on Monday. He respects it — and admits he went too far.' }; } }
        ]},
      { id: 'sponsor_ad', w: 1, title: '🎬 Advert shoot',
        text: 'A brand wants you for a national TV advert. It involves you singing. Badly.',
        options: [
          { label: 'Do it for the money', run(g) { const p = P(); const fee = Math.round(200000 + p.fame * 40000);
            State.addMoney(p, fee); State.addFame(p, 2);
            return { tone: 'good', text: `${U.cash(fee)} for one day's work. The advert is mocked relentlessly. You do not care.` }; } },
          { label: 'Politely decline', run(g) { const p = P(); p.happiness = clamp(p.happiness + 3);
            return { tone: 'neutral', text: 'You keep your dignity. Your agent does not speak to you for a week.' }; } }
        ]},
      { id: 'teammate_beef', w: 1, title: '🥊 Training ground bust-up',
        text: 'A team-mate goes over the top in a training game and squares up to you. Cameras from the club channel are rolling.',
        options: [
          { label: 'Square up', run(g) { const p = P(); State.addFame(p, 2); p.managerTrust = clamp(p.managerTrust - 8);
            Life.bumpTeammates(g, -8);
            return { tone: 'bad', text: 'It takes four people to separate you. The footage leaks within the hour.' }; } },
          { label: 'Laugh it off', run(g) { Life.bumpTeammates(g, 5); const p = P(); p.morale = clamp(p.morale + 3);
            return { tone: 'good', text: 'You help him up and ruffle his hair. The dressing room loves you for it.' }; } },
          { label: 'Nail him in the next drill', run(g) { const p = P(); p.discipline = clamp(p.discipline - 5);
            return U.chance(0.3) ? { tone: 'bad', text: 'You catch him — and he is out for three weeks. The manager is furious.' }
                                 : { tone: 'neutral', text: 'A firm but fair reminder. Nothing more is said about it.' }; } }
        ]},
      { id: 'business', w: 1, title: '💼 Business opportunity',
        text: 'An old friend pitches you a "guaranteed" investment in a padel club chain.',
        options: [
          { label: 'Go in big', run(g) { const p = P(); const amt = Math.min(p.money, Math.max(100000, Math.round(p.money * 0.2)));
            State.addMoney(p, -amt);
            if (U.chance(0.42)) { const ret = Math.round(amt * U.rnd(2, 4)); State.addMoney(p, ret);
              return { tone: 'good', text: `It takes off. Your ${U.cash(amt)} turns into ${U.cash(ret)}.` }; }
            return { tone: 'bad', text: `Gone. All ${U.cash(amt)} of it. Your "old friend" stops answering.` }; } },
          { label: 'Small stake only', run(g) { const p = P(); const amt = Math.min(p.money, 50000);
            State.addMoney(p, -amt);
            if (U.chance(0.45)) { State.addMoney(p, amt * 2.5); return { tone: 'good', text: `A tidy ${U.cash(amt * 1.5)} profit.` }; }
            return { tone: 'neutral', text: `You lose ${U.cash(amt)}. An acceptable lesson.` }; } },
          { label: 'Walk away', run() { return { tone: 'neutral', text: 'You say no. Six months later the company collapses. Good call.' }; } }
        ]},
      { id: 'doping', w: 0.5, title: '🧪 Random drug test',
        text: 'Testers arrive at 6:30am. You have been taking a supplement your cousin recommended.',
        options: [
          { label: 'Declare it honestly', run(g) { const p = P();
            return U.chance(0.85) ? { tone: 'good', text: 'It is clean. The doctor tells you to run everything past him in future.' }
              : (p.suspension = 6, { tone: 'bad', text: 'A banned substance. You are provisionally suspended for six matches while it is investigated.' }); } },
          { label: 'Say nothing', run(g) { const p = P();
            return U.chance(0.7) ? { tone: 'neutral', text: 'Nothing comes of it. You bin the supplement anyway.' }
              : (p.suspension = 10, State.addFame(p, -(5), { tone: 'bad', text: 'Positive test. Ten-match ban and a reputation to rebuild.' })); } }
        ]},
      { id: 'loan_offer', w: 0.7, title: '📄 Loan approach',
        text: 'You are not playing much. A club abroad wants you on loan for the rest of the season.',
        options: [
          { label: 'Take the loan', run(g) { const p = P(); p.managerTrust = clamp(p.managerTrust + 20); p.form = clamp(p.form + 8);
            return { tone: 'good', text: 'A change of scenery. You will play every week, and your parent club will be watching.' }; } },
          { label: 'Stay and fight', run(g) { const p = P(); p.morale = clamp(p.morale + 5);
            return { tone: 'neutral', text: 'You tell the manager you are staying and taking his shirt off him.' }; } }
        ]},
      { id: 'fan_award', w: 0.8, title: '🏅 Fans\' Player of the Month',
        text: 'The supporters have voted for you. There is a small ceremony before the next home game.',
        options: [
          { label: 'Give the trophy to a fan', run(g) { const p = P(); State.addFame(p, 2.5); p.happiness = clamp(p.happiness + 6);
            return { tone: 'good', text: 'You hand it to a season-ticket holder in the front row. Instant club folklore.' }; } },
          { label: 'Keep it for the cabinet', run(g) { const p = P(); p.happiness = clamp(p.happiness + 4);
            return { tone: 'good', text: 'It goes on the shelf next to the others. You allow yourself a moment.' }; } }
        ]},
      { id: 'car_crash', w: 0.35, title: '🚗 Late night, wet road',
        text: 'You lose control of the supercar on the way home. Nobody else is hurt, but the car is destroyed.',
        options: [
          { label: 'Report it immediately', run(g) { const p = P();
            p.assets = p.assets.filter(a => a.id !== 'car');
            State.addFame(p, 1.5); p.health = clamp(p.health - 6);
            return { tone: 'bad', text: 'Whiplash and a written-off car, but you did everything right. The club backs you publicly.' }; } },
          { label: 'Try to keep it quiet', run(g) { const p = P();
            p.assets = p.assets.filter(a => a.id !== 'car');
            if (U.chance(0.5)) { State.addFame(p, 4); p.managerTrust = clamp(p.managerTrust - 15);
              return { tone: 'bad', text: 'It gets out, and the cover-up is a bigger story than the crash.' }; }
            return { tone: 'neutral', text: 'Nobody ever finds out. You buy a much more sensible car.' }; } }
        ]},
      { id: 'academy', w: 0.6, title: '🎓 Back to the academy',
        text: 'Your old youth coach asks you to speak to the under-15s for an afternoon.',
        options: [
          { label: 'Spend the whole day there', run(g) { const p = P(); p.happiness = clamp(p.happiness + 9); p.karma = (p.karma || 0) + 1;
            State.addFame(p, 0.6);
            return { tone: 'good', text: 'You stay for training, sign everything, and remember exactly why you started.' }; } },
          { label: 'Send signed shirts instead', run(g) { const p = P(); p.happiness = clamp(p.happiness + 2);
            return { tone: 'neutral', text: 'A nice gesture. Your old coach says he understands. He is a little disappointed.' }; } }
        ]},
      { id: 'agent_switch', w: 0.5, title: '🕴️ A super-agent calls',
        text: 'The most powerful agent in the game wants to represent you. His cut is enormous.',
        options: [
          { label: 'Sign with him', run(g) { const p = P(); p.agentLevel = 3; p.superAgent = true;
            State.addMoney(p, -Math.round(p.money * 0.05));
            return { tone: 'good', text: 'Doors open that you did not know existed. Every transfer window is about to get interesting.' }; } },
          { label: 'Stay loyal to your agent', run(g) { const p = P(); p.happiness = clamp(p.happiness + 5); p.agentLevel = (p.agentLevel || 1) + 1;
            return { tone: 'good', text: 'The man who drove you to trials at 14 stays in charge. That means something.' }; } }
        ]},
      { id: 'burnout', w: 0.6, title: '🧠 You are exhausted',
        text: 'Games every three days, travel, noise. You have not felt like yourself for weeks.',
        options: [
          { label: 'Speak to the club psychologist', run(g) { const p = P(); p.morale = clamp(p.morale + 15); p.happiness = clamp(p.happiness + 10);
            return { tone: 'good', text: 'Talking helps more than you expected. The club handles it well and quietly.' }; } },
          { label: 'Push through it', run(g) { const p = P(); p.morale = clamp(p.morale - 8); p.form = clamp(p.form - 6);
            return { tone: 'bad', text: 'You say nothing. The performances dip and the noise gets louder.' }; } },
          { label: 'Ask for a week off', run(g) { const p = P(); p.fitness = clamp(p.fitness + 20); p.morale = clamp(p.morale + 8);
            p.managerTrust = clamp(p.managerTrust - 6);
            return { tone: 'neutral', text: 'You go away, switch the phone off, and come back a different person.' }; } }
        ]},
      { id: 'tattoo', w: 0.6, title: '🎨 Tattoo appointment',
        text: 'You are booked in for a big new piece down the arm.',
        options: [
          { label: 'Full sleeve', run(g) { const p = P(); State.addMoney(p, -12000); State.addFame(p, 1); p.happiness = clamp(p.happiness + 4);
            return { tone: 'good', text: 'Nine hours under the needle. It looks incredible.' }; } },
          { label: 'Something small and meaningful', run(g) { const p = P(); State.addMoney(p, -1500); p.happiness = clamp(p.happiness + 5);
            return { tone: 'good', text: 'Your family\'s initials, just above the wrist. Quiet and permanent.' }; } },
          { label: 'Cancel it', run() { return { tone: 'neutral', text: 'You reschedule for the summer. Again.' }; } }
        ]},
      { id: 'rival_words', w: 0.7, title: '🗣️ A rival takes a shot at you',
        text: 'An opponent says in a podcast that you are "all highlights, no substance".',
        options: [
          { label: 'Reply on social', run(g) { const p = P(); State.addFame(p, 3); State.addFollowers(p, 0.03, 6000);
            return { tone: 'neutral', text: 'Your reply gets 4 million views. The rivalry is now officially A Thing.' }; } },
          { label: 'Say nothing, circle the date', run(g) { const p = P(); p.form = clamp(p.form + 6); p.rivalGrudge = true;
            return { tone: 'good', text: 'You pin the quote above your locker. You will see him in April.' }; } }
        ]},
      { id: 'wonderkid', w: 0.6, title: '🌟 A 16-year-old arrives',
        text: 'The academy prodigy is training with the first team and playing in your position. He is frighteningly good.',
        options: [
          { label: 'Mentor him', run(g) { const p = P(); Life.bumpTeammates(g, 6); p.managerTrust = clamp(p.managerTrust + 8);
            p.happiness = clamp(p.happiness + 5);
            return { tone: 'good', text: 'You take him under your wing. The staff notice. So does he — he will never forget it.' }; } },
          { label: 'Freeze him out', run(g) { const p = P(); p.managerTrust = clamp(p.managerTrust - 10); Life.bumpTeammates(g, -5);
            return { tone: 'bad', text: 'You barely pass to him. It is noticed, and it does not reflect well on you.' }; } },
          { label: 'Raise your own level', run(g) { const p = P(); p.form = clamp(p.form + 10);
            const attr = U.pick(Object.keys(D.POSITIONS[p.pos].w).filter(k => D.POSITIONS[p.pos].w[k] > 0.2));
            Engine.Progress.addXp(p, attr, 4);
            return { tone: 'good', text: 'Competition is fuel. You train like a man possessed for a month.' }; } }
        ]},
      { id: 'boots_deal', w: 0.5, title: '👟 Boot deal renewal',
        text: 'Your boot sponsor wants to renew — but they want you in a garish new colourway.',
        options: [
          { label: 'Wear the pink ones', run(g) { const p = P(); const fee = Math.round(150000 + p.fame * 25000);
            State.addMoney(p, fee); State.addFame(p, 1.5);
            return { tone: 'good', text: `${U.cash(fee)} and everyone will see you from space.` }; } },
          { label: 'Negotiate hard', run(g) { const p = P();
            if (U.chance(0.55)) { const fee = Math.round(320000 + p.fame * 45000); State.addMoney(p, fee);
              return { tone: 'good', text: `They blink first. ${U.cash(fee)} and you keep the black boots.` }; }
            return { tone: 'bad', text: 'They walk away. You are wearing blank boots next month.' }; } }
        ]},
      { id: 'family_help', w: 0.6, title: '👨‍👩‍👦 Family asks for help',
        text: 'A relative is in trouble and needs money. It is not the first time.',
        options: [
          { label: 'Give them whatever they need', run(g) { const p = P(); const c = Math.round(Math.max(20000, p.money * 0.06));
            State.addMoney(p, -c); p.happiness = clamp(p.happiness + 6); p.karma = (p.karma || 0) + 1;
            return { tone: 'good', text: `${U.cash(c)} sent without a word. Family is family.` }; } },
          { label: 'Set up a proper allowance', run(g) { const p = P(); const c = Math.round(Math.max(10000, p.money * 0.02));
            State.addMoney(p, -c); p.happiness = clamp(p.happiness + 3);
            return { tone: 'neutral', text: 'You involve an accountant. It is less warm, but it is sustainable.' }; } },
          { label: 'Say no', run(g) { const p = P(); p.happiness = clamp(p.happiness - 8);
            return { tone: 'bad', text: 'You hold firm. The phone calls stop entirely, which is worse.' }; } }
        ]}
    ],

    rollEvent(g) {
      const p = g.player;
      const chance = 0.42 + (p.fame / 300);
      if (!U.chance(chance)) return null;
      const pool = Life.EVENTS.filter(e => {
        if (e.id === 'car_crash' && !p.assets.some(a => a.id === 'car')) return false;
        if (e.id === 'agent_switch' && p.superAgent) return false;
        if (e.id === 'loan_offer' && (p.managerTrust > 45 || p.season.apps > 8)) return false;
        return true;
      });
      if (!pool.length) return null;
      const ev = U.weighted(pool.map(e => [e, e.w || 1]));
      return { id: ev.id, title: ev.title, text: ev.text, options: ev.options };
    },

    /* ================= season upkeep ================= */
    seasonUpkeep(g) {
      const p = g.player, notes = [];
      // sponsor income
      let sponsorIncome = 0;
      p.sponsors.forEach(s => { sponsorIncome += s.annual; s.years--; });
      const expired = p.sponsors.filter(s => s.years <= 0);
      p.sponsors = p.sponsors.filter(s => s.years > 0);
      if (sponsorIncome) { State.addMoney(p, sponsorIncome); notes.push(`Sponsorships paid ${U.cash(sponsorIncome)}.`); }
      expired.forEach(s => notes.push(`${s.name} deal expired.`));

      // staff costs
      let staffCost = 0;
      (p.perks || []).forEach(id => { const perk = Life.PERKS.find(x => x.id === id); if (perk) staffCost += Math.round(perk.cost * 0.4); });
      if (staffCost) { State.addMoney(p, -staffCost); notes.push(`Staff wages cost ${U.cash(staffCost)}.`); }

      // lifestyle upkeep
      const upkeep = p.assets.reduce((s, a) => s + Math.round(a.cost * 0.02), 0);
      if (upkeep) { State.addMoney(p, -upkeep); notes.push(`Lifestyle upkeep cost ${U.cash(upkeep)}.`); }

      // taxes
      const tax = Math.round((p.season.earned || 0) * 0.42);
      if (tax) { State.addMoney(p, -tax); notes.push(`Tax bill: ${U.cash(tax)}.`); }

      // investments mature
      const inv = Life.resolveInvestments(g);
      inv.forEach(i => notes.push(`${i.icon} ${i.name}: ${i.delta >= 0 ? '+' : ''}${U.cash(i.delta)}`));

      // relationship drift
      const partner = Life.partner(g);
      if (partner) {
        partner.level = clamp(partner.level - U.rnd(2, 9) + (p.happiness > 70 ? 4 : 0));
        if (partner.level < 22 && U.chance(0.5)) {
          partner.ended = true;
          p.happiness = clamp(p.happiness - 18);
          notes.push(`💔 ${partner.name} ended things. The travel and the schedule finally won.`);
        }
      }
      // fame drifts back towards what you actually deserve
      const baseline = State.fameBaseline(p, State.club(p.club));
      if (p.fame > baseline) {
        const drop = (p.fame - baseline) * 0.3;
        p.fame = clamp(p.fame - drop);
        if (drop > 6) notes.push(`The spotlight moves on — fame down to ${Math.round(p.fame)}.`);
      }
      p.health = clamp(p.health - (p.age > 30 ? 1.5 : 0.6) + (Life.hasPerk(g, 'chef') ? 1 : 0));
      p.happiness = clamp(p.happiness - 3 + (p.karma || 0) * 0.5);
      return notes;
    },

    /* ================= retirement & legacy ================= */
    legacyScore(g) {
      const p = g.player;
      let s = 0;
      s += p.career.goals * 2.2;
      s += p.career.assists * 1.4;
      s += p.career.apps * 0.5;
      s += p.career.trophies.length * 26;
      s += p.achievements.length * 18;
      s += p.intl.caps * 1.1 + p.intl.goals * 2.4;
      s += p.fame * 3;
      s += Math.max(0, (State.careerRating(p) - 6.5) * 40);
      s += Math.min(120, p.money / 4000000);
      return Math.round(s);
    },
    legacyRank(score) {
      if (score >= 1400) return { title: 'IMMORTAL', desc: 'Statues. Documentaries. Arguments in pubs for the next fifty years.' };
      if (score >= 1000) return { title: 'ALL-TIME GREAT', desc: 'One of the defining players of your generation.' };
      if (score >= 700) return { title: 'SUPERSTAR', desc: 'A genuine icon. Shirts with your name still sell.' };
      if (score >= 450) return { title: 'CLUB LEGEND', desc: 'Adored where it mattered most. They named a stand after you.' };
      if (score >= 250) return { title: 'TOP PROFESSIONAL', desc: 'A long, respected career at a good level.' };
      if (score >= 120) return { title: 'SOLID SQUAD PLAYER', desc: 'You made a living from the game. Most never do.' };
      return { title: 'JOURNEYMAN', desc: 'It did not quite work out — but you were there.' };
    },
    POST_CAREER: [
      { id: 'manager', name: 'Go into management', icon: '📋', text: 'You take your badges and start in the lower leagues. Within a decade you are back in the big time — in a suit this time.' },
      { id: 'pundit',  name: 'TV punditry',        icon: '📺', text: 'You are surprisingly good on camera. Saturday afternoons are yours again, this time with a microphone.' },
      { id: 'academy', name: 'Coach the academy',  icon: '🎓', text: 'You go back to where it started and spend your days making teenagers better. Nothing has ever felt more right.' },
      { id: 'business',name: 'Full-time business', icon: '💼', text: 'Restaurants, property, a padel empire. You are busier than you ever were as a player.' },
      { id: 'beach',   name: 'Disappear entirely', icon: '🏝️', text: 'Phone off. Boat on. Nobody hears from you for four years and you have never been happier.' },
      { id: 'owner',   name: 'Buy your boyhood club', icon: '🏟️', text: 'You put your money where your heart is and take over the club you grew up supporting.' }
    ]
  };

  global.Life = Life;
})(window);
