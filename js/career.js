/* ==========================================================================
   career.js — everything between the matches, all of it football:
   the training week, dressing-room and press events, and the legacy you
   leave when you finally stop.
   ========================================================================== */
(function (global) {
  'use strict';
  const D = global.DATA, U = global.U, State = global.State, Engine = global.Engine;

  function P() { return State.game.player; }
  function clamp(v) { return U.clamp(v, 0, 100); }

  const Career = {

    /* ================= the training week ================= */
    activities(g) {
      const p = g.player;
      const list = [
        { id: 'train',   name: 'Extra Training', icon: 'train',   desc: 'Pick a drill and stay behind.' },
        { id: 'rest',    name: 'Rest & Recover', icon: 'rest',    desc: 'Ice baths, sleep, nothing else.' },
        { id: 'video',   name: 'Video Analysis', icon: 'video',   desc: 'Study the next opponent. The staff notice.' },
        { id: 'gaffer',  name: 'Talk to the Manager', icon: 'manager', desc: 'Ask where you stand.' },
        { id: 'media',   name: 'Press Duty',     icon: 'press',   desc: 'Face the cameras.' },
        { id: 'academy', name: 'Train With the Kids', icon: 'academy', desc: 'An afternoon with the academy.' }
      ];
      if (p.injuries.length) list.unshift({ id: 'rehab', name: 'Intensive Rehab', icon: 'hospital', desc: 'Get back on the pitch sooner.' });
      return list;
    },

    doActivity(g, id, opt) {
      const p = g.player;
      switch (id) {
        case 'train': {
          const drill = D.TRAINING.find(t => t.id === opt) || D.TRAINING[0];
          const cap = Engine.Progress.cap(p, drill.attr);
          if (p.attrs[drill.attr] >= cap) {
            p.fitness = clamp(p.fitness - drill.fatigue * 0.5);
            return { title: drill.name, icon: drill.icon, tone: 'neutral',
              text: `You have taken your ${D.ATTR_LABEL[drill.attr].toLowerCase()} as far as it goes — ${cap} was the ceiling you drafted. Nothing left to squeeze out here.` };
          }
          let amount = U.rnd(2.6, 5.0) * (p.fitness > 65 ? 1 : 0.6);
          if (p.age > 30) amount *= 0.75;
          const gains = Engine.Progress.addXp(p, drill.attr, amount);
          p.fitness = clamp(p.fitness - drill.fatigue);
          return { title: drill.name, icon: drill.icon, tone: 'good',
            text: gains.length
              ? `Session after session pays off. ${D.ATTR_LABEL[drill.attr]} is now ${p.attrs[drill.attr]} — ceiling ${cap}.`
              : `Hard graft on your ${D.ATTR_LABEL[drill.attr].toLowerCase()}. It is coming.`,
            gains };
        }
        case 'rest': {
          p.fitness = clamp(p.fitness + U.rnd(20, 32));
          p.morale = clamp(p.morale + 3);
          return { title: 'Rest & Recover', icon: 'rest', tone: 'good',
            text: `Three days off your feet. Fitness back up to ${Math.round(p.fitness)}%.` };
        }
        case 'rehab': {
          p.injuries.forEach(i => i.matches = Math.max(0, i.matches - 1));
          p.injuries = p.injuries.filter(i => i.matches > 0);
          p.fitness = clamp(p.fitness + 6);
          return { title: 'Rehab', icon: 'hospital', tone: 'good',
            text: p.injuries.length
              ? `Long mornings in the gym. ${p.injuries[0].name}: about ${p.injuries[0].matches} more match(es).`
              : 'The physio signs you off. Back in full training tomorrow.' };
        }
        case 'video': {
          p.managerTrust = clamp(p.managerTrust + U.rnd(4, 8));
          Engine.Progress.addXp(p, D.POSITIONS[p.pos].group === 'DEF' ? 'defending' : 'passing', 1.6);
          return { title: 'Video Analysis', icon: 'video', tone: 'good',
            text: 'You stay behind with the analysts and pick the opponent apart. The manager mentions it in his team talk.' };
        }
        case 'gaffer': {
          const trust = p.managerTrust;
          if (trust >= 70) {
            p.morale = clamp(p.morale + 8);
            return { title: 'A word with the manager', icon: 'manager', tone: 'good',
              text: '"You are the first name on my team sheet," he says, and you can tell he means it.' };
          }
          if (trust >= 40) {
            p.managerTrust = clamp(trust + 5);
            return { title: 'A word with the manager', icon: 'manager', tone: 'neutral',
              text: 'He tells you exactly what he wants: more in the box, more without the ball. At least you know.' };
          }
          p.morale = clamp(p.morale - 5);
          return { title: 'A word with the manager', icon: 'manager', tone: 'bad',
            text: 'He barely looks up. "Show me in training." The message is not subtle.' };
        }
        case 'media': return Career.pressDuty(g, opt);
        case 'academy': {
          Career.bumpTeammates(g, 3);
          p.morale = clamp(p.morale + 5);
          State.addReputation(p, 0.6);
          Engine.Progress.addXp(p, 'flair', 1.2);
          return { title: 'An afternoon with the academy', icon: 'academy', tone: 'good',
            text: 'You take the under-15s for a finishing session and stay for an hour of rondos afterwards. The best fun you have had all month.' };
        }
      }
      return { title: 'The week passes', text: 'Nothing much happens.', tone: 'neutral' };
    },

    pressDuty(g, tone) {
      const p = g.player;
      if (tone === 'humble') {
        p.managerTrust = clamp(p.managerTrust + 5);
        State.addReputation(p, 0.3);
        State.news(`"All that matters is the three points" — ${p.lastName} keeps it simple`, 'info');
        return { title: 'Press duty', icon: 'press', tone: 'good',
          text: 'Every answer is a straight bat. Dull, professional, and the staff love you for it.' };
      }
      if (tone === 'ambitious') {
        State.addReputation(p, 2.2);
        if (U.chance(0.4)) {
          p.managerTrust = clamp(p.managerTrust - 10);
          State.news(`"We should be winning this league" — ${p.lastName} raises the stakes`, 'bad');
          return { title: 'Press duty', icon: 'press', tone: 'bad',
            text: 'Big words, back page everywhere. Your manager is asked about it and pointedly does not back you.' };
        }
        State.news(`"We should be winning this league" — ${p.lastName} throws down the gauntlet`, 'good');
        return { title: 'Press duty', icon: 'press', tone: 'good',
          text: 'The supporters love the ambition. The quotes are on every highlight reel by teatime.' };
      }
      if (tone === 'teammates') {
        Career.bumpTeammates(g, 6);
        p.morale = clamp(p.morale + 4);
        State.news(`${p.lastName} defends his team-mates: "The criticism is unfair"`, 'good');
        return { title: 'Press duty', icon: 'press', tone: 'good',
          text: 'You take the heat for the whole dressing room. They notice — every single one of them.' };
      }
      p.managerTrust = clamp(p.managerTrust + 1);
      return { title: 'Press duty', icon: 'press', tone: 'neutral',
        text: 'Eleven clichés in ninety seconds. Nobody can criticise you for it, which is the point.' };
    },

    bumpTeammates(g, amount) {
      const sq = Engine.Squad.ensure(g);
      U.pickN(sq, 5).forEach(s => s.rel = clamp((s.rel || 50) + amount));
    },

    /* ================= things that happen at a football club ================= */
    EVENTS: [
      { id: 'manager_row', w: 1, icon: 'manager', title: 'Dressing room row',
        text: 'The manager singles you out in front of the whole squad at half-time. It is brutal, and not entirely fair.',
        options: [
          { label: 'Bite back', run(g) { const p = P(); p.managerTrust = clamp(p.managerTrust - 18); p.morale = clamp(p.morale + 6);
            Career.bumpTeammates(g, 3);
            return { tone: 'bad', text: 'You tell him exactly what you think. The lads are stunned. You will be on the bench next week.' }; } },
          { label: 'Answer him on the pitch', run(g) { const p = P(); p.form = clamp(p.form + 10); p.managerTrust = clamp(p.managerTrust + 6);
            return { tone: 'good', text: 'You say nothing and produce your best forty-five minutes of the season.' }; } },
          { label: 'Knock on his door on Monday', run(g) { const p = P(); p.managerTrust = clamp(p.managerTrust + 12);
            return { tone: 'good', text: 'A quiet conversation with no audience. He admits he went too far, and something shifts between you.' }; } }
        ]},
      { id: 'wonderkid', w: 1, icon: 'academy', title: 'A sixteen-year-old arrives',
        text: 'The academy prodigy is training with the first team, in your position, and he is frighteningly good.',
        options: [
          { label: 'Take him under your wing', run(g) { const p = P(); Career.bumpTeammates(g, 6); p.managerTrust = clamp(p.managerTrust + 8);
            return { tone: 'good', text: 'You mentor him all season. The staff notice. So does he — he will never forget it.' }; } },
          { label: 'Freeze him out', run(g) { const p = P(); p.managerTrust = clamp(p.managerTrust - 10); Career.bumpTeammates(g, -5);
            return { tone: 'bad', text: 'You barely pass to him. It is noticed, and none of it reflects well on you.' }; } },
          { label: 'Raise your own level', run(g) { const p = P(); p.form = clamp(p.form + 10);
            const w = D.POSITIONS[p.pos].w;
            const attr = U.weighted(D.ATTR_KEYS.filter(k => (w[k] || 0) > 0.15).map(k => [k, 1]));
            Engine.Progress.addXp(p, attr, 5);
            return { tone: 'good', text: 'Competition is fuel. You train like a man possessed for a month.' }; } }
        ]},
      { id: 'armband', w: 0.7, icon: 'crown', title: 'The armband',
        text: 'The captain is out for three months. The manager asks if you want it.',
        options: [
          { label: 'Take the armband', run(g) { const p = P(); p.captain = true; p.managerTrust = clamp(p.managerTrust + 10);
            State.addReputation(p, 3); State.addTrait(p, 'leader');
            State.news(`${p.lastName} handed the armband`, 'good');
            return { tone: 'good', text: 'You lead them out on Saturday. It feels heavier and better than you expected.' }; } },
          { label: 'Suggest someone older', run(g) { const p = P(); Career.bumpTeammates(g, 8); p.managerTrust = clamp(p.managerTrust + 3);
            return { tone: 'good', text: 'You point him towards the veteran centre-half. The dressing room respects the call enormously.' }; } }
        ]},
      { id: 'rumour', w: 1, icon: 'news', title: 'A rumour in the press',
        text: 'A story appears linking you with a move. Your club say nothing. The fans want to know where you stand.',
        options: [
          { label: 'Commit to the club publicly', run(g) { const p = P(); p.managerTrust = clamp(p.managerTrust + 12); p.morale = clamp(p.morale + 4);
            State.news(`"I am going nowhere" — ${p.lastName} commits his future`, 'good');
            return { tone: 'good', text: 'You kiss the badge in front of the cameras. The terraces are yours.' }; } },
          { label: 'Say nothing at all', run(g) { const p = P(); State.addReputation(p, 1);
            return { tone: 'neutral', text: 'You let it run. The speculation builds all month, and so does your price.' }; } },
          { label: 'Push for the move', run(g) { const p = P(); p.managerTrust = clamp(p.managerTrust - 20); State.addReputation(p, 2.5);
            p.agitated = true;
            State.news(`${p.lastName} wants out: club dig in`, 'bad');
            return { tone: 'bad', text: 'Your agent briefs a journalist. The manager finds out within the hour — but the bigger clubs are circling now.' }; } }
        ]},
      { id: 'loan_offer', w: 0.9, icon: 'transfer', title: 'A loan on the table',
        text: 'You are barely playing. A club abroad want you for the rest of the season, every week, guaranteed.',
        options: [
          { label: 'Take the loan', run(g) { const p = P(); p.managerTrust = clamp(p.managerTrust + 20); p.form = clamp(p.form + 8); p.morale = clamp(p.morale + 8);
            return { tone: 'good', text: 'A change of scenery and a shirt every Saturday. Your parent club will be watching closely.' }; } },
          { label: 'Stay and fight for the shirt', run(g) { const p = P(); p.morale = clamp(p.morale + 5);
            return { tone: 'neutral', text: 'You tell the manager you are staying, and that you intend to take that shirt off his first choice.' }; } }
        ]},
      { id: 'new_manager', w: 0.9, icon: 'manager', title: 'The manager is sacked',
        text: 'Three defeats and he is gone. The new man arrives on Monday with his own ideas and his own favourites.',
        options: [
          { label: 'Impress him from day one', run(g) { const p = P(); p.managerTrust = U.clamp(45 + U.rnd(0, 30), 0, 100); p.fitness = clamp(p.fitness - 8);
            return { tone: 'neutral', text: 'You are first to every session for a fortnight. He notices — though he already had a shortlist.' }; } },
          { label: 'Keep your head down', run(g) { const p = P(); p.managerTrust = U.clamp(35 + U.rnd(0, 30), 0, 100);
            return { tone: 'neutral', text: 'You do your job quietly and wait to be judged on Saturdays.' }; } }
        ]},
      { id: 'derby', w: 0.9, icon: 'fans', title: 'Derby week',
        text: 'The whole city has stopped talking about anything else. The supporters are outside the training ground every morning.',
        options: [
          { label: 'Promise them a win', run(g) { const p = P(); p.derbyPromise = true; p.form = clamp(p.form + 6); State.addReputation(p, 1.5);
            State.news(`${p.lastName} to the fans: "We will not lose this one"`, 'info');
            return { tone: 'neutral', text: 'You wind the window down and tell them straight. Now you have to go and do it.' }; } },
          { label: 'Keep the focus internal', run(g) { const p = P(); p.managerTrust = clamp(p.managerTrust + 6);
            return { tone: 'good', text: 'No noise, no promises. The manager appreciates a professional.' }; } }
        ]},
      { id: 'fans_award', w: 0.8, icon: 'medal', title: "Fans' Player of the Month",
        text: 'The supporters have voted for you. There is a presentation on the pitch before the next home game.',
        options: [
          { label: 'Give the trophy to a supporter', run(g) { const p = P(); State.addReputation(p, 2.5); p.morale = clamp(p.morale + 6);
            return { tone: 'good', text: 'You hand it to a season-ticket holder in the front row. Instant club folklore.' }; } },
          { label: 'Dedicate it to the squad', run(g) { const p = P(); Career.bumpTeammates(g, 7); p.morale = clamp(p.morale + 4);
            return { tone: 'good', text: '"Eleven of us won this." The dressing room hears exactly what it needed to hear.' }; } }
        ]},
      { id: 'rival', w: 0.8, icon: 'alert', title: 'A rival takes aim at you',
        text: 'An opponent says you are "all highlights and no substance". It is everywhere by lunchtime.',
        options: [
          { label: 'Answer him in the press', run(g) { const p = P(); State.addReputation(p, 2.5);
            State.news(`${p.lastName} hits back: "He can watch the tape"`, 'info');
            return { tone: 'neutral', text: 'Your reply runs on every back page. The fixture in April is now the only one anyone talks about.' }; } },
          { label: 'Pin it above your locker', run(g) { const p = P(); p.form = clamp(p.form + 8); p.grudge = true;
            return { tone: 'good', text: 'Not a word in public. You just circle the date and train like it is personal, because it is.' }; } }
        ]},
      { id: 'bust_up', w: 0.7, icon: 'card', title: 'Training ground flashpoint',
        text: 'A team-mate goes over the top in a small-sided game and squares up to you. The club cameras are rolling.',
        options: [
          { label: 'Square up', run(g) { const p = P(); p.managerTrust = clamp(p.managerTrust - 8); Career.bumpTeammates(g, -8);
            return { tone: 'bad', text: 'It takes four people to separate you, and the footage leaks within the hour.' }; } },
          { label: 'Pull him up and laugh it off', run(g) { const p = P(); Career.bumpTeammates(g, 6); p.morale = clamp(p.morale + 3);
            return { tone: 'good', text: 'You help him up and ruffle his hair. The dressing room loves you for it.' }; } },
          { label: 'Win the next fifty-fifty', run(g) { const p = P();
            return U.chance(0.3) ? { tone: 'bad', text: 'You catch him, and he is out for three weeks. The manager is furious.' }
                                 : { tone: 'neutral', text: 'Firm, fair, and nothing more is said about it. Message received.' }; } }
        ]},
      { id: 'fatigue', w: 0.8, icon: 'fitness', title: 'Three games a week',
        text: 'Travel, recovery, travel again. Your legs have not felt fresh since August.',
        options: [
          { label: 'Ask to be rested', run(g) { const p = P(); p.fitness = clamp(p.fitness + 22); p.managerTrust = clamp(p.managerTrust - 6);
            return { tone: 'neutral', text: 'He is not thrilled, but you come back a different player.' }; } },
          { label: 'Play through it', run(g) { const p = P(); p.fitness = clamp(p.fitness - 10); p.managerTrust = clamp(p.managerTrust + 6);
            return { tone: 'bad', text: 'You start every game. The manager calls you indispensable; your hamstrings disagree.' }; } },
          { label: 'Change your recovery routine', run(g) { const p = P(); p.fitness = clamp(p.fitness + 10);
            Engine.Progress.addXp(p, 'physical', 2);
            return { tone: 'good', text: 'Sleep, diet, cold plunges, no phone after nine. Boring, and it works.' }; } }
        ]},
      { id: 'position_switch', w: 0.6, icon: 'tactics', title: 'A new role',
        text: 'The manager wants to try you somewhere different this season. It might suit you. It might waste you.',
        options: [
          { label: 'Embrace it', run(g) { const p = P(); p.managerTrust = clamp(p.managerTrust + 10);
            const attr = U.pick(['passing', 'defending', 'physical']);
            Engine.Progress.addXp(p, attr, 6);
            return { tone: 'good', text: 'A month of feeling lost, then something clicks. Your game is wider than it was.' }; } },
          { label: 'Insist on your position', run(g) { const p = P(); p.managerTrust = clamp(p.managerTrust - 8); p.morale = clamp(p.morale + 4);
            return { tone: 'neutral', text: 'You tell him where you play. He shrugs — but he does not ask again.' }; } }
        ]},
      { id: 'contract_talks', w: 0.7, icon: 'contract', title: 'Early contract talks',
        text: 'The club want to open talks a year ahead of schedule. Your agent thinks waiting would be worth more.',
        options: [
          { label: 'Sign now, stay settled', run(g) { const p = P(); p.contract.years++; p.managerTrust = clamp(p.managerTrust + 10); p.morale = clamp(p.morale + 6);
            State.news(`${p.lastName} signs a new deal`, 'good');
            return { tone: 'good', text: 'Done inside a week. One less thing to think about all season.' }; } },
          { label: 'Wait and see how the season goes', run(g) { const p = P(); p.morale = clamp(p.morale - 2);
            return { tone: 'neutral', text: 'You let it run. Play well and the numbers get better; get injured and they vanish.' }; } }
        ]},
      { id: 'documentary', w: 0.5, icon: 'video', title: 'The cameras move in',
        text: 'A documentary crew will follow the club all season. They want you as one of the main characters.',
        options: [
          { label: 'Let them in', run(g) { const p = P(); State.addReputation(p, 4);
            return { tone: 'good', text: 'Your face carries the trailer. By Christmas, people who do not watch football know your name.' }; } },
          { label: 'Stay out of it', run(g) { const p = P(); p.morale = clamp(p.morale + 3); p.managerTrust = clamp(p.managerTrust + 3);
            return { tone: 'neutral', text: 'You keep the season for yourself. No regrets.' }; } }
        ]}
    ],

    rollEvent(g) {
      const p = g.player;
      if (!U.chance(0.45)) return null;
      const pool = Career.EVENTS.filter(e => {
        if (e.id === 'loan_offer' && (p.managerTrust > 45 || p.season.apps > 8)) return false;
        if (e.id === 'armband' && p.captain) return false;
        if (e.id === 'contract_talks' && (!p.contract || p.contract.years > 2)) return false;
        if (e.id === 'wonderkid' && p.age < 21) return false;
        return true;
      });
      if (!pool.length) return null;
      const ev = U.weighted(pool.map(e => [e, e.w || 1]));
      return { id: ev.id, title: ev.title, text: ev.text, icon: ev.icon, options: ev.options };
    },

    /* ================= between seasons ================= */
    seasonUpkeep(g) {
      const p = g.player, notes = [];
      // reputation drifts back towards what you are actually worth
      const baseline = State.reputationBaseline(p, State.club(p.club));
      if (p.reputation > baseline) {
        const drop = (p.reputation - baseline) * 0.3;
        p.reputation = clamp(p.reputation - drop);
        if (drop > 6) notes.push(`The spotlight moves on — reputation down to ${Math.round(p.reputation)}.`);
      }
      const val = State.marketValue(p);
      const prev = p.lastValue || val;
      p.lastValue = val;
      notes.push(`Market value: ${U.cash(val)}${val > prev ? ' (up)' : val < prev ? ' (down)' : ''}.`);
      if (p.peakValue && val >= p.peakValue) notes.push('That is the highest you have ever been valued.');
      p.captain = p.captain && U.chance(0.8);
      p.agitated = false; p.grudge = false; p.derbyPromise = false;
      return notes;
    },

    /* ================= how you are remembered ================= */
    legacyScore(g) {
      const p = g.player;
      let s = 0;
      s += p.career.goals * 2.2;
      s += p.career.assists * 1.4;
      s += p.career.apps * 0.5;
      s += p.career.trophies.length * 26;
      s += p.achievements.length * 18;
      s += p.intl.caps * 1.1 + p.intl.goals * 2.4;
      s += p.reputation * 3;
      s += Math.max(0, (State.careerRating(p) - 6.5) * 40);
      s += Math.max(0, (p.peakOvr || 0) - 70) * 6;
      return Math.round(s);
    },
    legacyRank(score) {
      if (score >= 1400) return { title: 'IMMORTAL', desc: 'Statues. Documentaries. Arguments in pubs for the next fifty years.' };
      if (score >= 1000) return { title: 'ALL-TIME GREAT', desc: 'One of the defining players of your generation.' };
      if (score >= 700) return { title: 'SUPERSTAR', desc: 'A genuine icon. Shirts with your name on still sell.' };
      if (score >= 450) return { title: 'CLUB LEGEND', desc: 'Adored where it mattered most. They named a stand after you.' };
      if (score >= 250) return { title: 'TOP PROFESSIONAL', desc: 'A long, respected career at a good level.' };
      if (score >= 120) return { title: 'SOLID SQUAD PLAYER', desc: 'You made a living from the game. Almost nobody does.' };
      return { title: 'JOURNEYMAN', desc: 'It never quite happened — but you were there.' };
    },
    POST_CAREER: [
      { id: 'manager', name: 'Go into management', icon: 'manager', text: 'You take your badges and start in the lower leagues. Within a decade you are back in the big time, in a suit this time.' },
      { id: 'pundit',  name: 'Television punditry', icon: 'video', text: 'You are surprisingly good on camera. Saturday afternoons are yours again, with a microphone instead of a shirt.' },
      { id: 'academy', name: 'Coach the academy',  icon: 'academy', text: 'You go back to where it started and spend your days making teenagers better. Nothing has ever felt more right.' },
      { id: 'scout',   name: 'Head of recruitment', icon: 'tactics', text: 'You always saw the game a beat early. Now you get paid to spot it in seventeen-year-olds.' },
      { id: 'director',name: 'Sporting director',  icon: 'contract', text: 'You take the job upstairs at a club that needed rebuilding, and rebuild it properly.' },
      { id: 'walk',    name: 'Walk away from the game', icon: 'exit', text: 'Phone off. No badges, no punditry, no comeback. Some players need the noise to stop, and you are one of them.' }
    ]
  };

  global.Career = Career;
})(window);
