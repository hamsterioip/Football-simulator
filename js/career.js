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

    /* Take a squad number. If a team-mate is wearing it, they swap with you —
       which is exactly how it works at a real club. */
    claimShirt(g, number) {
      const p = g.player, old = p.shirt;
      const squad = Engine.Squad.ensure(g);
      const holder = squad.find(sq => sq.shirt === number);
      if (holder) holder.shirt = old;
      p.shirt = number;
      return holder ? holder.name : null;
    },

    bumpTeammates(g, amount) {
      const sq = Engine.Squad.ensure(g);
      U.pickN(sq, 5).forEach(s => s.rel = clamp((s.rel || 50) + amount));
    },

    /* ================= things that happen at a football club ================= */
    EVENTS: [
      { id: 'deadline_day', w: 1, icon: 'transfer', cat: 'Transfer', title: 'Deadline day, 11pm',
        text: 'A bid has landed with two hours of the window left. Your phone has not stopped. The club will not stand in your way if you want it.',
        options: [
          { label: 'Get in the car', hint: 'Medical at midnight. No looking back.', tag: 'Bold',
            run(g) { const p = P(); p.deadlineMove = true; p.managerTrust = clamp(p.managerTrust - 5); State.addReputation(p, 3);
              State.news(`${p.lastName} on the move as the window slams shut`, 'info');
              return { tone: 'neutral', text: 'You drive through the night for a medical you are too wired to sleep before. Whether it was right, you find out in August.' }; } },
          { label: 'Let it pass', hint: 'You are settled. Stay settled.', tag: 'Loyal',
            run(g) { const p = P(); p.managerTrust = clamp(p.managerTrust + 12); p.morale = clamp(p.morale + 6);
              return { tone: 'good', text: 'You turn the phone off at ten. The manager finds out and tells the dressing room exactly what you did.' }; } },
          { label: 'Use it to get a better deal here', hint: 'Leverage, politely applied.', tag: 'Streetwise',
            run(g) { const p = P();
              if (U.chance(0.55)) { p.contract.wage = Math.round(p.contract.wage * 1.4); p.contract.years++;
                return { tone: 'good', text: `The club improve your terms to ${U.cash(p.contract.wage)} a week to keep you. Everyone saves face.` }; }
              p.managerTrust = clamp(p.managerTrust - 12);
              return { tone: 'bad', text: 'They call your bluff and tell you the door is there. Now you look like the one who wanted out.' }; } }
        ]},
      { id: 'penalty_duty', w: 0.9, icon: 'penalty', cat: 'Dressing room', title: 'Who takes the penalties?',
        text: 'The regular taker missed on Saturday. The manager asks the room who wants them, and nobody speaks first.',
        options: [
          { label: 'Take them', hint: 'Own the pressure. Own the misses too.', tag: 'Nerve',
            run(g) { const p = P(); p.penaltyDuty = true; State.addReputation(p, 1.5);
              return { tone: 'good', text: 'You put your hand up. From now on the ball is yours, and so is every headline that follows.' }; } },
          { label: 'Back the regular taker', hint: 'He needs one to go in.', tag: 'Team-mate',
            run(g) { Career.bumpTeammates(g, 8); const p = P(); p.morale = clamp(p.morale + 4);
              return { tone: 'good', text: 'You tell the room he is still the best striker of a ball at the club. He scores the next three.' }; } },
          { label: 'Say nothing', hint: 'Not your problem.', tag: 'Quiet',
            run(g) { return { tone: 'neutral', text: 'Someone else takes them. You keep your average intact and your name out of it.' }; } }
        ]},
      { id: 'setpiece_duty', w: 0.8, icon: 'corner', cat: 'Training ground', title: 'Set-piece practice',
        text: 'Forty minutes of free kicks at the end of training, and the coach is watching who keeps hitting the target.',
        options: [
          { label: 'Stay behind and claim them', hint: 'Hundreds of repetitions.', tag: 'Work Rate',
            run(g) { const p = P(); p.setPieceDuty = true; Engine.Progress.addXp(p, 'shooting', 4);
              p.fitness = clamp(p.fitness - 6);
              return { tone: 'good', text: 'You stay out until the floodlights go off. The dead balls are yours now.' }; } },
          { label: 'Work on your delivery instead', hint: 'Crossing and corners. The boring gold.', tag: 'Passing',
            run(g) { const p = P(); Engine.Progress.addXp(p, 'passing', 4.5); p.fitness = clamp(p.fitness - 5);
              return { tone: 'good', text: 'A hundred crosses onto the same cone. Nobody applauds this work, and it wins matches.' }; } },
          { label: 'Get in the ice bath', hint: 'Recover properly.', tag: 'Smart',
            run(g) { const p = P(); p.fitness = clamp(p.fitness + 14);
              return { tone: 'neutral', text: 'You look after the legs. There are three games next week.' }; } }
        ]},
      { id: 'shirt_number', w: 0.7, icon: 'shirt', cat: 'Club', title: 'The number is free',
        text: 'The club legend has gone and his shirt is available. The kit man asks, carefully, whether you want it.',
        options: [
          { label: 'Take the number', hint: 'The expectation comes with it.', tag: 'Bold',
            run(g) { const p = P(); const old = p.shirt;
              const wanted = U.pick([7, 9, 10, 11].filter(n => n !== old)) || 10;
              const swappedWith = Career.claimShirt(g, wanted);
              State.addReputation(p, 2);
              State.news(`${p.lastName} takes the number ${p.shirt} shirt`, 'info');
              return { tone: 'neutral', text: `You swap ${old} for ${p.shirt}${swappedWith ? `, and ${swappedWith} takes yours` : ''}. `
                + 'Every supporter now expects you to be him. Plenty will say you are not.' }; } },
          { label: 'Leave it be', hint: 'Some shirts should be left alone.', tag: 'Class',
            run(g) { const p = P(); Career.bumpTeammates(g, 4); p.morale = clamp(p.morale + 3);
              return { tone: 'good', text: 'You keep your own number. The old pros in the dressing room nod at that.' }; } }
        ]},
      { id: 'video_review', w: 0.9, icon: 'video', cat: 'Manager', title: 'Video review, whole squad watching',
        text: 'The analyst pauses on your positioning for the third goal. Twenty-four players are looking at the screen. Then at you.',
        options: [
          { label: 'Own it in front of everyone', hint: 'Say it was you. Move on.', tag: 'Character',
            run(g) { const p = P(); p.managerTrust = clamp(p.managerTrust + 10); Career.bumpTeammates(g, 5);
              return { tone: 'good', text: '"That is on me, it will not happen again." The room relaxes. So does the manager.' }; } },
          { label: 'Point out who left you exposed', hint: 'True, and badly timed.', tag: 'Blunt',
            run(g) { const p = P(); Career.bumpTeammates(g, -9); p.managerTrust = clamp(p.managerTrust - 4);
              return { tone: 'bad', text: 'You are right, and it does not matter. Two of them do not speak to you for a fortnight.' }; } },
          { label: 'Ask to see it again', hint: 'Actually learn from it.', tag: 'Professional',
            run(g) { const p = P(); Engine.Progress.addXp(p, 'defending', 4);
              p.managerTrust = clamp(p.managerTrust + 6);
              return { tone: 'good', text: 'You watch it four more times alone that evening. It genuinely does not happen again.' }; } }
        ]},
      { id: 'national_snub', w: 0.8, icon: 'nation', cat: 'International', title: 'Left out of the squad',
        text: 'The squad is announced on television and your name is not on it. Your phone starts buzzing before the presenter has finished.',
        options: [
          { label: 'Call the manager and ask why', hint: 'A straight answer, good or bad.', tag: 'Direct',
            run(g) { const p = P();
              if (U.chance(0.55)) { p.intl.called = true;
                return { tone: 'good', text: 'He tells you exactly what he needs to see. You give him it, and you are in the next squad.' }; }
              return { tone: 'bad', text: '"You are not in my plans." At least you know where you stand.' }; } },
          { label: 'Say nothing and score goals', hint: 'Make it impossible to leave you out.', tag: 'Answer',
            run(g) { const p = P(); p.form = clamp(p.form + 12); p.morale = clamp(p.morale - 4);
              return { tone: 'good', text: 'No comment, no complaint, just a run of form that makes the argument for you.' }; } },
          { label: 'Question the selection publicly', hint: 'Popular with fans. Not with him.', tag: 'Risky',
            run(g) { const p = P(); State.addReputation(p, 2.5);
              State.news(`"I deserve to be there" — ${p.lastName} hits out at national selection`, 'bad');
              return { tone: 'bad', text: 'It leads the news for a day. Getting picked just became considerably harder.' }; } }
        ]},
      { id: 'dual_nation', w: 0.35, icon: 'nation', cat: 'International', title: 'Two countries want you',
        text: 'You qualify for another nation and their federation have made contact. They can promise you tournaments. Yours cannot promise anything.',
        options: [
          { label: 'Switch allegiance', hint: 'Play at major tournaments.', tag: 'Career',
            run(g) { const p = P();
              const pickN = U.pick(D.NATIONS.filter(n => n.name !== p.nation));
              p.nation = pickN.name; p.intl.called = false; p.intl.caps = 0; p.intl.goals = 0;
              State.news(`${p.lastName} switches international allegiance to ${pickN.name}`, 'info');
              return { tone: 'neutral', text: `You file the paperwork and pull on a ${pickN.name} shirt. Some people back home will never forgive it. You will play at a World Cup.` }; } },
          { label: 'Stay where you are from', hint: 'It was never really a question.', tag: 'Heart',
            run(g) { const p = P(); p.morale = clamp(p.morale + 8); State.addReputation(p, 1);
              return { tone: 'good', text: 'You thank them politely and put the phone down. You were only ever going to play for one country.' }; } }
        ]},
      { id: 'leak', w: 0.7, icon: 'microphone', cat: 'Media', title: 'Something private has leaked',
        text: 'Word for word, what was said in the dressing room on Saturday is in a newspaper this morning. Somebody in that room talked.',
        options: [
          { label: 'Call a players-only meeting', hint: 'Sort it internally.', tag: 'Leadership',
            run(g) { const p = P(); Career.bumpTeammates(g, 7); p.managerTrust = clamp(p.managerTrust + 6);
              return { tone: 'good', text: 'No staff, no phones, thirty minutes. Nothing leaks again all season.' }; } },
          { label: 'Let the club investigate', hint: 'Not your job.', tag: 'Quiet',
            run(g) { return { tone: 'neutral', text: 'The club promise an investigation. Nothing is ever announced, and everyone quietly suspects the same person.' }; } },
          { label: 'Name who you think it was', hint: 'If you are wrong, this gets ugly.', tag: 'Risky',
            run(g) { const p = P();
              if (U.chance(0.4)) { Career.bumpTeammates(g, 4);
                return { tone: 'good', text: 'You are right. He is gone in January, and the room respects that you said it out loud.' }; }
              Career.bumpTeammates(g, -12); p.managerTrust = clamp(p.managerTrust - 8);
              return { tone: 'bad', text: 'You are wrong, and you have just accused an innocent team-mate in front of everyone.' }; } }
        ]},
      { id: 'award_night', w: 0.7, icon: 'medal', cat: 'Awards', title: 'You are nominated',
        text: 'The ceremony is on Thursday, four hundred miles away, and there is a match on Sunday.',
        options: [
          { label: 'Go, and enjoy it', hint: 'These nights do not come often.', tag: 'Occasion',
            run(g) { const p = P(); State.addReputation(p, 3); p.fitness = clamp(p.fitness - 8); p.morale = clamp(p.morale + 8);
              return { tone: 'good', text: 'A long night in a suit, a great many photographs, and a trophy you will keep forever. Your legs will complain on Sunday.' }; } },
          { label: 'Send a video message and train', hint: 'The match is what matters.', tag: 'Professional',
            run(g) { const p = P(); p.managerTrust = clamp(p.managerTrust + 8); p.form = clamp(p.form + 5);
              return { tone: 'good', text: 'Thirty seconds recorded at the training ground, then a double session. The manager notices everything.' }; } }
        ]},
      { id: 'scan_results', w: 0.8, icon: 'hospital', cat: 'Fitness', title: 'The scan results are in',
        text: 'There is damage. Not season-ending, but it will not fix itself. Six weeks now, the surgeon says, or manage it and hope.',
        options: [
          { label: 'Have the operation now', hint: 'Six weeks out. Properly fixed.', tag: 'Long View',
            run(g) { const p = P(); Engine.Injuries.give(g, true);
              p.injuries.forEach(i => i.matches = Math.max(i.matches, 5));
              p.morale = clamp(p.morale - 8);
              return { tone: 'bad', text: 'You go under the knife on Monday. Six weeks of rehab, and then no more thinking about it.' }; } },
          { label: 'Manage it and keep playing', hint: 'Injections and physio. Risky.', tag: 'Gamble',
            run(g) { const p = P();
              if (U.chance(0.45)) { Engine.Injuries.give(g, true);
                return { tone: 'bad', text: 'It lasts five weeks before it goes completely, and now it is worse than it was.' }; }
              p.managerTrust = clamp(p.managerTrust + 8); p.fitness = clamp(p.fitness - 10);
              return { tone: 'good', text: 'Painkillers, strapping and a lot of gritted teeth. You get through the season on it.' }; } }
        ]},
      { id: 'fan_forum', w: 0.7, icon: 'fans', cat: 'Club', title: 'Supporters\' forum',
        text: 'Three hundred season-ticket holders in a function room, and the first question is why the team has been so poor away from home.',
        options: [
          { label: 'Answer honestly', hint: 'They can handle the truth.', tag: 'Honest',
            run(g) { const p = P(); State.addReputation(p, 2); p.morale = clamp(p.morale + 5);
              return { tone: 'good', text: 'You tell them exactly what is going wrong and what is being done about it. They applaud a straight answer for once.' }; } },
          { label: 'Defend the manager', hint: 'Close ranks.', tag: 'Loyal',
            run(g) { const p = P(); p.managerTrust = clamp(p.managerTrust + 10);
              return { tone: 'good', text: 'You back him publicly and completely. It gets back to him within the hour.' }; } },
          { label: 'Promise a trophy', hint: 'Say the thing they want to hear.', tag: 'Risky',
            run(g) { const p = P(); State.addReputation(p, 3); p.promisedTrophy = true;
              State.news(`"We will win something this year" — ${p.lastName} makes a promise`, 'info');
              return { tone: 'neutral', text: 'The room erupts. It is also now a stick to beat you with every week until May.' }; } }
        ]},
      { id: 'formation_switch', w: 0.8, icon: 'tactics', cat: 'Manager', title: 'A change of shape',
        text: 'The manager wants to change the system. In the new one, you are asked to do a completely different job.',
        options: [
          { label: 'Learn the new role properly', hint: 'Extra meetings, extra video.', tag: 'Professional',
            run(g) { const p = P(); p.managerTrust = clamp(p.managerTrust + 10);
              const attr = U.pick(['passing', 'defending', 'physical', 'dribbling']);
              Engine.Progress.addXp(p, attr, 5.5);
              return { tone: 'good', text: `A month of feeling lost, then it clicks. Your ${D.ATTR_LABEL[attr].toLowerCase()} is better for it.` }; } },
          { label: 'Tell him it does not suit you', hint: 'Honest, and unwelcome.', tag: 'Blunt',
            run(g) { const p = P(); p.managerTrust = clamp(p.managerTrust - 12); p.morale = clamp(p.morale + 3);
              return { tone: 'bad', text: 'He listens, thanks you, and picks somebody else for it. And for a few other things after that.' }; } },
          { label: 'Play it his way and stay quiet', hint: 'Do the job, say nothing.', tag: 'Quiet',
            run(g) { const p = P(); p.form = clamp(p.form - 5); p.managerTrust = clamp(p.managerTrust + 4);
              return { tone: 'neutral', text: 'You do what you are told. The performances dip while you work it out, but nobody can question the attitude.' }; } }
        ]},
      { id: 'club_crisis', w: 0.6, icon: 'alert', cat: 'Club', title: 'The club is in trouble',
        text: 'Wages are late, the training ground is falling apart, and the owner has stopped returning calls. The senior players are asked to speak.',
        options: [
          { label: 'Speak for the squad', hint: 'Put your name to it.', tag: 'Leadership',
            run(g) { const p = P(); Career.bumpTeammates(g, 10); State.addReputation(p, 2.5);
              State.news(`${p.lastName} speaks for the squad amid boardroom chaos`, 'info');
              return { tone: 'good', text: 'You stand in front of the cameras and say what everyone is thinking. The dressing room will remember it long after the owner has gone.' }; } },
          { label: 'Keep your head down and play', hint: 'Football is the only bit you control.', tag: 'Focus',
            run(g) { const p = P(); p.form = clamp(p.form + 6);
              return { tone: 'neutral', text: 'You let others fight it and put your performances where your opinions might have gone.' }; } },
          { label: 'Ask your agent to find an exit', hint: 'Self-preservation.', tag: 'Pragmatic',
            run(g) { const p = P(); p.managerTrust = clamp(p.managerTrust - 8); p.agitated = true;
              return { tone: 'neutral', text: 'Quiet calls are made. If it all falls apart, you will not be going down with it.' }; } }
        ]},
      { id: 'young_debut', w: 0.7, icon: 'academy', cat: 'Dressing room', title: 'A debut to look after',
        text: 'A seventeen-year-old is starting on Saturday. He has not said a word all week and he looks terrified.',
        options: [
          { label: 'Take him under your wing', hint: 'Sit with him. Talk him through it.', tag: 'Senior Pro',
            run(g) { const p = P(); Career.bumpTeammates(g, 8); p.managerTrust = clamp(p.managerTrust + 6);
              p.morale = clamp(p.morale + 5);
              return { tone: 'good', text: 'You sit next to him on the coach and talk about nothing at all until he laughs. He has a brilliant debut.' }; } },
          { label: 'Give him the ball early and often', hint: 'Confidence through involvement.', tag: 'Football',
            run(g) { Career.bumpTeammates(g, 5);
              return { tone: 'good', text: 'Three easy passes in the first five minutes and you can see his shoulders drop. Simple, and it works.' }; } },
          { label: 'Let him find out for himself', hint: 'Nobody helped you.', tag: 'Cold',
            run(g) { Career.bumpTeammates(g, -5);
              return { tone: 'bad', text: 'He has a nightmare and is hooked at half-time. One of the older lads asks where you were.' }; } }
        ]},
      { id: 'agent_meeting', w: 0.9, icon: 'agent', cat: 'Transfer', title: 'Your agent has news',
        text: 'He wants to meet in person, which he only ever does when there is something worth saying out loud.',
        options: [
          { label: 'Ask him to test the market', hint: 'See what is actually out there.', tag: 'Ambition',
            run(g) { const p = P(); p.marketTested = true; State.addReputation(p, 1.5);
              return { tone: 'neutral', text: 'He starts making calls. Three clubs come back interested and one of them is serious. Something will happen this summer.' }; } },
          { label: 'Get me a new deal here', hint: 'You are happy. Reward it.', tag: 'Settled',
            run(g) { const p = P();
              if (U.chance(0.6)) { p.contract.wage = Math.round(p.contract.wage * 1.25);
                p.contract.years = Math.max(p.contract.years, 3);
                return { tone: 'good', text: `Signed inside a fortnight: ${U.cash(p.contract.wage)} a week and three more years.` }; }
              return { tone: 'neutral', text: 'The club say they will look at it in the summer. Which means no, for now.' }; } },
          { label: 'Change agent', hint: 'You have outgrown him.', tag: 'Cold',
            run(g) { const p = P(); p.agentLevel = 3;
              return { tone: 'neutral', text: 'An awkward hour and a large severance payment. Your new representation opens doors the old one could not find.' }; } }
        ]},
      { id: 'referee_charge', w: 0.5, icon: 'whistle', cat: 'Discipline', title: 'Charged by the federation',
        text: 'Your words to the referee on Saturday were picked up by a microphone. There is a charge, and a hearing on Thursday.',
        options: [
          { label: 'Accept the charge', hint: 'Take the ban and move on.', tag: 'Accept',
            run(g) { const p = P(); p.suspension = Math.max(p.suspension, 1);
              return { tone: 'bad', text: 'One match, a fine, and it is over. Sometimes the quickest way out is straight through.' }; } },
          { label: 'Contest it', hint: 'You were not talking to him.', tag: 'Fight',
            run(g) { const p = P();
              if (U.chance(0.45)) return { tone: 'good', text: 'The charge is dismissed. Your lawyer was very good and very expensive.' };
              p.suspension = Math.max(p.suspension, 2);
              return { tone: 'bad', text: 'Contesting it and losing gets you an extra match. That is how it works.' }; } },
          { label: 'Apologise publicly first', hint: 'Get ahead of it.', tag: 'Smart',
            run(g) { const p = P(); State.addReputation(p, 0.5);
              if (U.chance(0.6)) return { tone: 'good', text: 'A full apology before the hearing, and the panel decide a warning is enough.' };
              p.suspension = Math.max(p.suspension, 1);
              return { tone: 'neutral', text: 'You apologise anyway and still get the one-match ban. At least it reads well.' }; } }
        ]},
      { id: 'testimonial', w: 0.4, icon: 'trophy', cat: 'Club', title: 'They want to give you a testimonial',
        text: 'Ten years at the club. They are talking about a full house on a Sunday in May, with your name on the ticket.',
        options: [
          { label: 'Accept, and give the money away', hint: 'To the academy and the local hospital.', tag: 'Class',
            run(g) { const p = P(); State.addReputation(p, 4); p.morale = clamp(p.morale + 12);
              State.news(`${p.lastName} donates testimonial proceeds to the academy`, 'good');
              return { tone: 'good', text: 'A full house, an unbelievable reception, and not a penny of it kept. That is the day they name a stand after you.' }; } },
          { label: 'Accept it gratefully', hint: 'You earned this.', tag: 'Occasion',
            run(g) { const p = P(); State.addReputation(p, 2.5); p.morale = clamp(p.morale + 10);
              return { tone: 'good', text: 'You walk out with your family to a standing ovation that lasts four minutes. You do not trust yourself to speak.' }; } },
          { label: 'Turn it down', hint: 'Not while you are still playing.', tag: 'Focus',
            run(g) { const p = P(); p.managerTrust = clamp(p.managerTrust + 5);
              return { tone: 'neutral', text: '"When I am finished." The club say the offer stands whenever you want it.' }; } }
        ]},
      { id: 'winter_camp', w: 0.6, icon: 'train', cat: 'Training ground', title: 'Mid-season training camp',
        text: 'Five days of warm weather, double sessions, and a manager who has clearly decided this squad needs running.',
        options: [
          { label: 'Lead every run', hint: 'Set the standard.', tag: 'Work Rate',
            run(g) { const p = P(); Engine.Progress.addXp(p, 'physical', 6); p.fitness = clamp(p.fitness - 4);
              p.managerTrust = clamp(p.managerTrust + 8); Career.bumpTeammates(g, 4);
              return { tone: 'good', text: 'First in every single run for five days. The younger lads start following you around.' }; } },
          { label: 'Work on your weak foot', hint: 'Nobody is watching. Perfect.', tag: 'Detail',
            run(g) { const p = P(); Engine.Progress.addXp(p, 'weakFoot', 6.5); p.fitness = clamp(p.fitness - 5);
              return { tone: 'good', text: 'Two hours a day on your wrong side while everyone else is at the pool. It shows up in April.' }; } },
          { label: 'Coast through it', hint: 'Save yourself for the games.', tag: 'Cynical',
            run(g) { const p = P(); p.fitness = clamp(p.fitness + 10); p.managerTrust = clamp(p.managerTrust - 6);
              return { tone: 'neutral', text: 'You do enough and not a yard more. The staff have a word about your standards.' }; } }
        ]},
      { id: 'manager_row', w: 1, icon: 'manager', cat: 'Manager', title: 'Dressing room row',
        text: 'The manager singles you out in front of the whole squad at half-time. It is brutal, and not entirely fair.',
        options: [
          { label: 'Bite back', hint: 'Say exactly what you think.', tag: 'Hot Head', run(g) { const p = P(); p.managerTrust = clamp(p.managerTrust - 18); p.morale = clamp(p.morale + 6);
            Career.bumpTeammates(g, 3);
            return { tone: 'bad', text: 'You tell him exactly what you think. The lads are stunned. You will be on the bench next week.' }; } },
          { label: 'Answer him on the pitch', hint: 'No words. Just a performance.', tag: 'Character', run(g) { const p = P(); p.form = clamp(p.form + 10); p.managerTrust = clamp(p.managerTrust + 6);
            return { tone: 'good', text: 'You say nothing and produce your best forty-five minutes of the season.' }; } },
          { label: 'Knock on his door on Monday', hint: 'Sort it privately, no audience.', tag: 'Mature', run(g) { const p = P(); p.managerTrust = clamp(p.managerTrust + 12);
            return { tone: 'good', text: 'A quiet conversation with no audience. He admits he went too far, and something shifts between you.' }; } }
        ]},
      { id: 'wonderkid', w: 1, icon: 'academy', cat: 'Dressing room', title: 'A sixteen-year-old arrives',
        text: 'The academy prodigy is training with the first team, in your position, and he is frighteningly good.',
        options: [
          { label: 'Take him under your wing', hint: 'Mentor the kid all season.', tag: 'Senior Pro', run(g) { const p = P(); Career.bumpTeammates(g, 6); p.managerTrust = clamp(p.managerTrust + 8);
            return { tone: 'good', text: 'You mentor him all season. The staff notice. So does he — he will never forget it.' }; } },
          { label: 'Freeze him out', hint: 'Protect your shirt at any cost.', tag: 'Cold', run(g) { const p = P(); p.managerTrust = clamp(p.managerTrust - 10); Career.bumpTeammates(g, -5);
            return { tone: 'bad', text: 'You barely pass to him. It is noticed, and none of it reflects well on you.' }; } },
          { label: 'Raise your own level', hint: 'Use him as fuel.', tag: 'Competitor', run(g) { const p = P(); p.form = clamp(p.form + 10);
            const w = D.POSITIONS[p.pos].w;
            const attr = U.weighted(D.ATTR_KEYS.filter(k => (w[k] || 0) > 0.15).map(k => [k, 1]));
            Engine.Progress.addXp(p, attr, 5);
            return { tone: 'good', text: 'Competition is fuel. You train like a man possessed for a month.' }; } }
        ]},
      { id: 'armband', w: 0.7, icon: 'crown', cat: 'Dressing room', title: 'The armband',
        text: 'The captain is out for three months. The manager asks if you want it.',
        options: [
          { label: 'Take the armband', hint: 'Lead them out on Saturday.', tag: 'Leadership', run(g) { const p = P(); p.captain = true; p.managerTrust = clamp(p.managerTrust + 10);
            State.addReputation(p, 3); State.addTrait(p, 'leader');
            State.news(`${p.lastName} handed the armband`, 'good');
            return { tone: 'good', text: 'You lead them out on Saturday. It feels heavier and better than you expected.' }; } },
          { label: 'Suggest someone older', hint: 'Point them at the veteran.', tag: 'Class', run(g) { const p = P(); Career.bumpTeammates(g, 8); p.managerTrust = clamp(p.managerTrust + 3);
            return { tone: 'good', text: 'You point him towards the veteran centre-half. The dressing room respects the call enormously.' }; } }
        ]},
      { id: 'rumour', w: 1, icon: 'news', cat: 'Media', title: 'A rumour in the press',
        text: 'A story appears linking you with a move. Your club say nothing. The fans want to know where you stand.',
        options: [
          { label: 'Commit to the club publicly', hint: 'Kiss the badge. Mean it.', tag: 'Loyal', run(g) { const p = P(); p.managerTrust = clamp(p.managerTrust + 12); p.morale = clamp(p.morale + 4);
            State.news(`"I am going nowhere" — ${p.lastName} commits his future`, 'good');
            return { tone: 'good', text: 'You kiss the badge in front of the cameras. The terraces are yours.' }; } },
          { label: 'Say nothing at all', hint: 'Let it run and let your price rise.', tag: 'Quiet', run(g) { const p = P(); State.addReputation(p, 1);
            return { tone: 'neutral', text: 'You let it run. The speculation builds all month, and so does your price.' }; } },
          { label: 'Push for the move', hint: 'Force their hand through your agent.', tag: 'Ruthless', run(g) { const p = P(); p.managerTrust = clamp(p.managerTrust - 20); State.addReputation(p, 2.5);
            p.agitated = true;
            State.news(`${p.lastName} wants out: club dig in`, 'bad');
            return { tone: 'bad', text: 'Your agent briefs a journalist. The manager finds out within the hour — but the bigger clubs are circling now.' }; } }
        ]},
      { id: 'loan_offer', w: 0.9, icon: 'transfer', cat: 'Transfer', title: 'A loan on the table',
        text: 'You are barely playing. A club abroad want you for the rest of the season, every week, guaranteed.',
        options: [
          { label: 'Take the loan', hint: 'Play every week somewhere else.', tag: 'Game Time', run(g) { const p = P(); p.managerTrust = clamp(p.managerTrust + 20); p.form = clamp(p.form + 8); p.morale = clamp(p.morale + 8);
            return { tone: 'good', text: 'A change of scenery and a shirt every Saturday. Your parent club will be watching closely.' }; } },
          { label: 'Stay and fight for the shirt', hint: 'Take his place off him.', tag: 'Stubborn', run(g) { const p = P(); p.morale = clamp(p.morale + 5);
            return { tone: 'neutral', text: 'You tell the manager you are staying, and that you intend to take that shirt off his first choice.' }; } }
        ]},
      { id: 'new_manager', w: 0.9, icon: 'manager', cat: 'Manager', title: 'The manager is sacked',
        text: 'Three defeats and he is gone. The new man arrives on Monday with his own ideas and his own favourites.',
        options: [
          { label: 'Impress him from day one', hint: 'First in, last out, for a fortnight.', tag: 'Work Rate', run(g) { const p = P(); p.managerTrust = U.clamp(45 + U.rnd(0, 30), 0, 100); p.fitness = clamp(p.fitness - 8);
            return { tone: 'neutral', text: 'You are first to every session for a fortnight. He notices — though he already had a shortlist.' }; } },
          { label: 'Keep your head down', hint: 'Be judged on Saturdays.', tag: 'Quiet', run(g) { const p = P(); p.managerTrust = U.clamp(35 + U.rnd(0, 30), 0, 100);
            return { tone: 'neutral', text: 'You do your job quietly and wait to be judged on Saturdays.' }; } }
        ]},
      { id: 'derby', w: 0.9, icon: 'fans', cat: 'Club', title: 'Derby week',
        text: 'The whole city has stopped talking about anything else. The supporters are outside the training ground every morning.',
        options: [
          { label: 'Promise them a win', hint: 'Say it out loud to the supporters.', tag: 'Bold', run(g) { const p = P(); p.derbyPromise = true; p.form = clamp(p.form + 6); State.addReputation(p, 1.5);
            State.news(`${p.lastName} to the fans: "We will not lose this one"`, 'info');
            return { tone: 'neutral', text: 'You wind the window down and tell them straight. Now you have to go and do it.' }; } },
          { label: 'Keep the focus internal', hint: 'No noise, no promises.', tag: 'Professional', run(g) { const p = P(); p.managerTrust = clamp(p.managerTrust + 6);
            return { tone: 'good', text: 'No noise, no promises. The manager appreciates a professional.' }; } }
        ]},
      { id: 'fans_award', w: 0.8, icon: 'medal', cat: 'Awards', title: "Fans' Player of the Month",
        text: 'The supporters have voted for you. There is a presentation on the pitch before the next home game.',
        options: [
          { label: 'Give the trophy to a supporter', hint: 'Front row, right there and then.', tag: 'Fans', run(g) { const p = P(); State.addReputation(p, 2.5); p.morale = clamp(p.morale + 6);
            return { tone: 'good', text: 'You hand it to a season-ticket holder in the front row. Instant club folklore.' }; } },
          { label: 'Dedicate it to the squad', hint: 'Eleven of us won this.', tag: 'Team-mate', run(g) { const p = P(); Career.bumpTeammates(g, 7); p.morale = clamp(p.morale + 4);
            return { tone: 'good', text: '"Eleven of us won this." The dressing room hears exactly what it needed to hear.' }; } }
        ]},
      { id: 'rival', w: 0.8, icon: 'alert', cat: 'Media', title: 'A rival takes aim at you',
        text: 'An opponent says you are "all highlights and no substance". It is everywhere by lunchtime.',
        options: [
          { label: 'Answer him in the press', hint: 'Give them the back page they want.', tag: 'Fire', run(g) { const p = P(); State.addReputation(p, 2.5);
            State.news(`${p.lastName} hits back: "He can watch the tape"`, 'info');
            return { tone: 'neutral', text: 'Your reply runs on every back page. The fixture in April is now the only one anyone talks about.' }; } },
          { label: 'Pin it above your locker', hint: 'Circle the date in April.', tag: 'Grudge', run(g) { const p = P(); p.form = clamp(p.form + 8); p.grudge = true;
            return { tone: 'good', text: 'Not a word in public. You just circle the date and train like it is personal, because it is.' }; } }
        ]},
      { id: 'bust_up', w: 0.7, icon: 'card', cat: 'Dressing room', title: 'Training ground flashpoint',
        text: 'A team-mate goes over the top in a small-sided game and squares up to you. The club cameras are rolling.',
        options: [
          { label: 'Square up', hint: 'Chest to chest, cameras rolling.', tag: 'Hot Head', run(g) { const p = P(); p.managerTrust = clamp(p.managerTrust - 8); Career.bumpTeammates(g, -8);
            return { tone: 'bad', text: 'It takes four people to separate you, and the footage leaks within the hour.' }; } },
          { label: 'Pull him up and laugh it off', hint: 'Defuse it in one second.', tag: 'Dressing Room', run(g) { const p = P(); Career.bumpTeammates(g, 6); p.morale = clamp(p.morale + 3);
            return { tone: 'good', text: 'You help him up and ruffle his hair. The dressing room loves you for it.' }; } },
          { label: 'Win the next fifty-fifty', hint: 'Firm, fair, and a message.', tag: 'Message', run(g) { const p = P();
            return U.chance(0.3) ? { tone: 'bad', text: 'You catch him, and he is out for three weeks. The manager is furious.' }
                                 : { tone: 'neutral', text: 'Firm, fair, and nothing more is said about it. Message received.' }; } }
        ]},
      { id: 'fatigue', w: 0.8, icon: 'fitness', cat: 'Fitness', title: 'Three games a week',
        text: 'Travel, recovery, travel again. Your legs have not felt fresh since August.',
        options: [
          { label: 'Ask to be rested', hint: 'Admit the legs have gone.', tag: 'Honest', run(g) { const p = P(); p.fitness = clamp(p.fitness + 22); p.managerTrust = clamp(p.managerTrust - 6);
            return { tone: 'neutral', text: 'He is not thrilled, but you come back a different player.' }; } },
          { label: 'Play through it', hint: 'Start every game regardless.', tag: 'Guts', run(g) { const p = P(); p.fitness = clamp(p.fitness - 10); p.managerTrust = clamp(p.managerTrust + 6);
            return { tone: 'bad', text: 'You start every game. The manager calls you indispensable; your hamstrings disagree.' }; } },
          { label: 'Change your recovery routine', hint: 'Sleep, diet, ice, no phone.', tag: 'Detail', run(g) { const p = P(); p.fitness = clamp(p.fitness + 10);
            Engine.Progress.addXp(p, 'physical', 2);
            return { tone: 'good', text: 'Sleep, diet, cold plunges, no phone after nine. Boring, and it works.' }; } }
        ]},
      { id: 'position_switch', w: 0.6, icon: 'tactics', cat: 'Manager', title: 'A new role',
        text: 'The manager wants to try you somewhere different this season. It might suit you. It might waste you.',
        options: [
          { label: 'Embrace it', hint: 'Learn a whole new job.', tag: 'Adaptable', run(g) { const p = P(); p.managerTrust = clamp(p.managerTrust + 10);
            const attr = U.pick(['passing', 'defending', 'physical']);
            Engine.Progress.addXp(p, attr, 6);
            return { tone: 'good', text: 'A month of feeling lost, then something clicks. Your game is wider than it was.' }; } },
          { label: 'Insist on your position', hint: 'Tell him where you play.', tag: 'Stubborn', run(g) { const p = P(); p.managerTrust = clamp(p.managerTrust - 8); p.morale = clamp(p.morale + 4);
            return { tone: 'neutral', text: 'You tell him where you play. He shrugs — but he does not ask again.' }; } }
        ]},
      { id: 'contract_talks', w: 0.7, icon: 'contract', cat: 'Transfer', title: 'Early contract talks',
        text: 'The club want to open talks a year ahead of schedule. Your agent thinks waiting would be worth more.',
        options: [
          { label: 'Sign now, stay settled', hint: 'Done inside a week.', tag: 'Security', run(g) { const p = P(); p.contract.years++; p.managerTrust = clamp(p.managerTrust + 10); p.morale = clamp(p.morale + 6);
            State.news(`${p.lastName} signs a new deal`, 'good');
            return { tone: 'good', text: 'Done inside a week. One less thing to think about all season.' }; } },
          { label: 'Wait and see how the season goes', hint: 'Bet on yourself.', tag: 'Gamble', run(g) { const p = P(); p.morale = clamp(p.morale - 2);
            return { tone: 'neutral', text: 'You let it run. Play well and the numbers get better; get injured and they vanish.' }; } }
        ]},
      { id: 'documentary', w: 0.5, icon: 'video', cat: 'Media', title: 'The cameras move in',
        text: 'A documentary crew will follow the club all season. They want you as one of the main characters.',
        options: [
          { label: 'Let them in', hint: 'Be one of the main characters.', tag: 'Exposure', run(g) { const p = P(); State.addReputation(p, 4);
            return { tone: 'good', text: 'Your face carries the trailer. By Christmas, people who do not watch football know your name.' }; } },
          { label: 'Stay out of it', hint: 'Keep the season for yourself.', tag: 'Private', run(g) { const p = P(); p.morale = clamp(p.morale + 3); p.managerTrust = clamp(p.managerTrust + 3);
            return { tone: 'neutral', text: 'You keep the season for yourself. No regrets.' }; } }
        ]},
      { id: 'boot_deal', w: 0.6, icon: 'value', cat: 'Media', title: 'The boot brands are calling',
        text: 'Two sportswear giants both want your feet. One offers more money, the other offers a signature boot with your name on it.',
        options: [
          { label: 'Take the signature boot', hint: 'Your name on the boot. Kids wearing it.', tag: 'Image',
            run(g) { const p = P(); State.addReputation(p, 5); p.morale = clamp(p.morale + 6);
              State.news(`${p.lastName} gets a signature boot — the kids' sizes sell out in a day`, 'good');
              return { tone: 'good', text: 'They stitch your name into the tongue. You score in the first pair and the clip does a million views by Monday.' }; } },
          { label: 'Take the bigger cheque', hint: 'Money talks.', tag: 'Business',
            run(g) { const p = P(); State.addReputation(p, 2); p.morale = clamp(p.morale + 3);
              return { tone: 'good', text: 'A very healthy number lands every quarter. The boots are generic, but the bank balance is not.' }; } },
          { label: 'Turn both down', hint: 'Boots are boots. Football first.', tag: 'Pure',
            run(g) { const p = P(); p.managerTrust = clamp(p.managerTrust + 6);
              return { tone: 'neutral', text: 'You play in blacked-out boots and the manager loves you for it. The brands will be back.' }; } }
        ]},
      { id: 'cover_star', w: 0.5, icon: 'star', cat: 'Media', title: 'The cover vote',
        text: 'The big football game is letting fans vote for its cover star. Your name is on the shortlist and the vote closes on Sunday.',
        options: [
          { label: 'Rally the fans online', hint: 'Post the link. Win the vote.', tag: 'Campaign',
            run(g) { const p = P();
              if (U.chance(0.6)) { State.addReputation(p, 7);
                State.news(`${p.lastName} wins the fan vote — your face is on the cover`, 'good');
                return { tone: 'good', text: 'The fans pile in and it is not close. Your face, on the cover, in every shop window.' }; }
              p.morale = clamp(p.morale - 4);
              return { tone: 'neutral', text: 'You finish second to a winger with a bigger following. The dressing room does not let it go for a week.' }; } },
          { label: 'Ignore it', hint: 'Covers win nothing.', tag: 'Focused',
            run(g) { const p = P(); p.managerTrust = clamp(p.managerTrust + 4);
              return { tone: 'neutral', text: 'You let the vote happen without you. The manager approves. The marketing department does not.' }; } }
        ]},
      { id: 'podcast', w: 0.6, icon: 'microphone', cat: 'Media', title: 'The big podcast wants you',
        text: 'Two hours, no PR person, and a host who is very good at getting footballers to say the thing they should not say.',
        options: [
          { label: 'Tell a proper dressing-room story', hint: 'Great television. Risky Monday.', tag: 'Loose Lips',
            run(g) { const p = P();
              if (U.chance(0.5)) { State.addReputation(p, 5); p.morale = clamp(p.morale + 4);
                State.news(`${p.lastName}'s podcast story has the whole country laughing`, 'good');
                return { tone: 'good', text: 'The clip goes everywhere. Even the team-mate it was about admits it was funny. Eventually.' }; }
              p.managerTrust = clamp(p.managerTrust - 10); p.morale = clamp(p.morale - 5);
              State.news(`Manager unimpressed as ${p.lastName} spills dressing-room secrets`, 'bad');
              return { tone: 'bad', text: 'The story lands badly. The manager calls you in before training and it is a short conversation.' }; } },
          { label: 'Keep it vanilla', hint: 'Two hours of nothing. Safe.', tag: 'Professional',
            run(g) { const p = P(); p.managerTrust = clamp(p.managerTrust + 4);
              return { tone: 'neutral', text: 'You give them two hours of weather and teamwork. Nobody clips anything. Nobody complains either.' }; } }
        ]},
      { id: 'rating_reveal', w: 0.7, icon: 'star', cat: 'Media', title: 'The ratings have leaked',
        text: 'The new edition of the game drops next month and the ratings are out early. Yours is doing numbers on social media.',
        options: [
          { label: 'Demand a pace upgrade publicly', hint: 'Join the tradition.', tag: 'Outraged',
            run(g) { const p = P(); State.addReputation(p, 2); p.morale = clamp(p.morale + 5);
              State.news(`${p.lastName} leads the complaints as the new ratings drop`, 'info');
              return { tone: 'good', text: 'You post the screenshot with three laughing emojis. Every player in the league does the same. It is basically a union.' }; } },
          { label: 'Shrug it off', hint: 'It is a video game.', tag: 'Calm',
            run(g) { const p = P(); p.morale = clamp(p.morale + 2);
              return { tone: 'neutral', text: 'You are too busy being good at the actual sport. The kids in the academy are furious on your behalf.' }; } }
        ]},
      { id: 'charity_match', w: 0.5, icon: 'fans', cat: 'Club', title: 'A charity asks for your Tuesday',
        text: 'A children\'s hospital charity wants you at their fundraiser five-a-side night. It is the only evening off this week.',
        options: [
          { label: 'Go and stay late', hint: 'Sign everything. Play the kids.', tag: 'Heart',
            run(g) { const p = P(); State.addReputation(p, 4); p.morale = clamp(p.morale + 7); p.fitness = clamp(p.fitness - 4);
              State.news(`${p.lastName} spends his night off at a charity five-a-side — class`, 'good');
              return { tone: 'good', text: 'You let a nine-year-old goalkeeper save your penalty. He will remember it longer than you will.' }; } },
          { label: 'Send a signed shirt instead', hint: 'You need the rest.', tag: 'Practical',
            run(g) { const p = P(); p.fitness = clamp(p.fitness + 8);
              return { tone: 'neutral', text: 'The shirt raises four figures at auction and you get nine hours of sleep. Everyone wins, quietly.' }; } }
        ]},
      { id: 'intl_captain', w: 0.5, icon: 'crown', cat: 'International', title: 'The armband, internationally',
        text: 'The national team captain has retired, and the coach calls you before the squad announcement. He wants you to lead the next camp.',
        options: [
          { label: 'Take the armband', hint: 'Captain your country.', tag: 'Leader',
            run(g) { const p = P(); p.intlCaptain = true; State.addReputation(p, 6); p.morale = clamp(p.morale + 8);
              State.news(`${p.lastName} named ${p.nation} captain`, 'good');
              return { tone: 'good', text: 'Your mum cries on the phone. You pretend you are not going to. You are.' }; } },
          { label: 'Suggest a senior pro instead', hint: 'It should be his.', tag: 'Humble',
            run(g) { const p = P(); p.morale = clamp(p.morale + 5); State.addReputation(p, 2);
              State.news(`${p.lastName} turns down the ${p.nation} armband: "There is a better man for it"`, 'info');
              return { tone: 'good', text: 'The coach respects it. The senior pro finds out and never forgets it.' }; } }
        ]},
      { id: 'tattoo_fan', w: 0.4, icon: 'fans', cat: 'Club', title: 'A fan has your face tattooed',
        text: 'Forearm, full colour, your face mid-celebration. It is everywhere online. The club media team asks if you want to meet him.',
        options: [
          { label: 'Meet him and sign the arm', hint: 'Permanent ink. Permanent fan.', tag: 'Class',
            run(g) { const p = P(); State.addReputation(p, 3); p.morale = clamp(p.morale + 5);
              State.news(`${p.lastName} meets the fan with the tattoo — and signs it`, 'good');
              return { tone: 'good', text: 'You sign under your own face and he books the laser-proof touch-up. That one is for life, for both of you.' }; } },
          { label: 'Just like the post', hint: 'From a safe distance.', tag: 'Wary',
            run(g) { return { tone: 'neutral', text: 'You like the post and move on. It is a lot of forehead, in fairness.' }; } }
        ]},
      { id: 'academy_recruit', w: 0.5, icon: 'academy', cat: 'Club', title: 'Help sign the next big thing',
        text: 'The club is chasing a seventeen-year-old everyone wants. The director asks if you will host him at training and show him around.',
        options: [
          { label: 'Show him everything', hint: 'Sell the club. Mean it.', tag: 'Ambassador',
            run(g) { const p = P(); p.managerTrust = clamp(p.managerTrust + 8); Career.bumpTeammates(g, 4);
              State.news(`${p.lastName} plays host as the club land the country's top prospect`, 'good');
              return { tone: 'good', text: 'He signs on Friday and tells the press it was your pitch that did it. The director owes you one.' }; } },
          { label: 'Politely pass', hint: 'Recruiting is not your job.', tag: 'Focused',
            run(g) { const p = P(); p.fitness = clamp(p.fitness + 4);
              return { tone: 'neutral', text: 'Someone from the marketing department does it instead. He signs anyway.' }; } }
        ]},
      { id: 'analyst_row', w: 0.6, icon: 'tactics', cat: 'Manager', title: 'The data says you do not run',
        text: 'The performance team presents the pressing numbers. Yours are in red. The manager watches you while they do it.',
        options: [
          { label: 'Accept it and fix it', hint: 'The numbers do not lie.', tag: 'Pro',
            run(g) { const p = P(); p.managerTrust = clamp(p.managerTrust + 9); Engine.Progress.addXp(p, 'physical', 3); p.fitness = clamp(p.fitness - 6);
              return { tone: 'good', text: 'You spend the week with the fitness coach. Next month your column is green and the manager makes a point of saying so.' }; } },
          { label: 'Argue the context', hint: 'You save it for the moments that matter.', tag: 'Stubborn',
            run(g) { const p = P();
              if (U.chance(0.45)) { p.managerTrust = clamp(p.managerTrust + 2); p.morale = clamp(p.morale + 4);
                return { tone: 'good', text: 'You point at the goals column and the room goes quiet. The manager lets you have it. This time.' }; }
              p.managerTrust = clamp(p.managerTrust - 9);
              State.news(`Tension behind the scenes as ${p.lastName} clashes with analysts`, 'bad');
              return { tone: 'bad', text: 'The manager shows your defensive clips in reply. There is not much to say to that.' }; } }
        ]},
      { id: 'hall_of_fame', w: 0.4, icon: 'legacy', cat: 'Club', title: 'The hall of fame calls',
        text: 'The club wants to induct you into its hall of fame while you are still playing. A dinner, a plaque, a speech they would like you to give.',
        options: [
          { label: 'Give the speech', hint: 'Say what the club meant.', tag: 'Legend',
            run(g) { const p = P(); p.hof = true; State.addReputation(p, 8); p.morale = clamp(p.morale + 10);
              State.news(`${p.lastName} inducted into the hall of fame — and he is still playing`, 'good');
              return { tone: 'good', text: 'You thank the kit man by name and the room stands for that alone. A night you will keep.' }; } },
          { label: 'Defer it until you retire', hint: 'It is a full-stop. You are not done.', tag: 'Unfinished',
            run(g) { const p = P(); p.morale = clamp(p.morale + 4);
              State.news(`${p.lastName} puts off the hall of fame: "Ask me when I am finished"`, 'info');
              return { tone: 'good', text: 'You tell them a hall of fame is for endings, and you are not ending yet. The room likes that even more.' }; } }
        ]},
      { id: 'superstition', w: 0.4, icon: 'ball', cat: 'Dressing room', title: 'The ritual is famous now',
        text: 'Left boot first, same urinal, touch the badge twice. A TV segment just dissected your whole pre-match routine in slow motion.',
        options: [
          { label: 'Lean into it', hint: 'Never change a winning routine.', tag: 'Ritual',
            run(g) { const p = P(); p.morale = clamp(p.morale + 5);
              return { tone: 'good', text: 'Kids across the country are now touching the badge twice before Sunday league. The ritual stays.' }; } },
          { label: 'Scrap it all', hint: 'No routine owns you.', tag: 'Ruthless',
            run(g) { const p = P();
              if (U.chance(0.6)) { p.morale = clamp(p.morale + 6); p.form = clamp(p.form + 4);
                return { tone: 'good', text: 'Right boot first, different urinal, and you score on Saturday. Liberating.' }; }
              p.morale = clamp(p.morale - 5); p.form = clamp(p.form - 3);
              return { tone: 'bad', text: 'You play like your boots are on the wrong feet, because spiritually they are. The ritual is back by Thursday.' }; } }
        ]},
      { id: 'old_club_return', w: 0.5, icon: 'back', cat: 'Club', title: 'Back where it started',
        text: 'Your first club is celebrating an anniversary and wants you at the dinner. It is a long flight for a short evening, but they gave you your debut.',
        options: [
          { label: 'Go, and pay your respects', hint: 'They made you.', tag: 'Roots',
            run(g) { const p = P(); State.addReputation(p, 3); p.morale = clamp(p.morale + 8); p.fitness = clamp(p.fitness - 5);
              State.news(`${p.lastName} returns to where it all began: "This club made me"`, 'good');
              return { tone: 'good', text: 'The old academy coach is there. He says he always knew. He absolutely did not, but it is a lovely evening.' }; } },
          { label: 'Send a video message', hint: 'The schedule is the schedule.', tag: 'Busy',
            run(g) { return { tone: 'neutral', text: 'Forty-five seconds, filmed in the boot room. They play it twice. It does the job.' }; } }
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
        if (e.id === 'penalty_duty' && p.penaltyDuty) return false;
        if (e.id === 'setpiece_duty' && p.setPieceDuty) return false;
        if (e.id === 'testimonial' && (p.career.apps < 250 || p.age < 29)) return false;
        if (e.id === 'dual_nation' && (p.intl.caps > 0 || p.age > 26)) return false;
        if (e.id === 'national_snub' && !p.intl.called) return false;
        if (e.id === 'scan_results' && p.injuries.length) return false;
        if (e.id === 'deadline_day' && p.age < 19) return false;
        if (e.id === 'young_debut' && p.age < 24) return false;
        if (e.id === 'boot_deal' && p.reputation < 45) return false;
        if (e.id === 'cover_star' && p.reputation < 60) return false;
        if (e.id === 'intl_captain' && (p.intl.caps < 30 || p.intlCaptain || !p.intl.called || p.intl.retired)) return false;
        if (e.id === 'hall_of_fame' && (p.career.apps < 400 || p.hof)) return false;
        if (e.id === 'old_club_return' && p.career.apps < 150) return false;
        return true;
      });
      if (!pool.length) return null;
      const ev = U.weighted(pool.map(e => [e, e.w || 1]));
      return { id: ev.id, title: ev.title, text: ev.text, icon: ev.icon,
               cat: ev.cat || 'Club', options: ev.options };
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
      p.promisedTrophy = false; p.deadlineMove = false; p.marketTested = false;
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
      { id: 'ntcoach', name: 'Coach your country', icon: 'nation', text: 'A career in the shirt taught you what it means. Now you pick the squad, and a nation holds its breath every other summer.' },
      { id: 'ambassador', name: 'Club ambassador', icon: 'club', text: 'Suit and a smile: opening schools, charming sponsors, applauding from the directors\' box. The badge never leaves your lapel.' },
      { id: 'agent',   name: 'Players\' agent',    icon: 'transfer', text: 'You know every trick because you lived every trick. Your phone never stops, and your clients sign very good contracts.' },
      { id: 'walk',    name: 'Walk away from the game', icon: 'exit', text: 'Phone off. No badges, no punditry, no comeback. Some players need the noise to stop, and you are one of them.' }
    ]
  };

  global.Career = Career;
})(window);
