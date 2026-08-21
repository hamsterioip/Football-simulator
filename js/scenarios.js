/* ==========================================================================
   scenarios.js — interactive in-match decision moments
   Every scenario returns options; each option resolves to an effects object
   consumed by engine.js.
   ========================================================================== */
(function (global) {
  'use strict';
  const D = global.DATA, U = global.U, State = global.State;

  /* ---------- helpers ---------- */
  function eff(ctx, attr) {
    const p = ctx.player;
    let raw = p.attrs[attr] || 20;
    // the ball does not always sit up on your good side
    if (ctx.weakSide && (attr === 'shooting' || attr === 'dribbling')) {
      const wf = p.attrs.weakFoot || 40;
      raw *= State.hasTrait(p, 'twofooted') ? 1 : (0.55 + (wf / 100) * 0.45);
    }
    const formF = 0.88 + (p.form / 100) * 0.24;
    const fitF = 0.82 + (p.fitness / 100) * 0.22;
    const nerve = ctx.pressure ? (State.hasTrait(p, 'ice') ? 1.0 : 0.94) : 1.0;
    return raw * formF * fitF * nerve;
  }

  // flair is what makes the outrageous option come off
  function flairBonus(ctx) {
    return ((ctx.player.attrs.flair || 50) - 58) * 0.005;
  }
  function weakNote(ctx) {
    return ctx.weakSide ? ' It has dropped onto your weaker foot.' : '';
  }
  function trait(ctx, id) { return State.hasTrait(ctx.player, id); }
  function luck(ctx, p) { return trait(ctx, 'lucky') ? Math.min(0.95, p + 0.05) : p; }
  function odds(value, opposition, k, base) {
    return U.clamp((base || 0.5) + (value - opposition) * (k || 0.014), 0.04, 0.95);
  }
  function E(o) { // effects with defaults
    return Object.assign({
      goal: false, assist: false, teamGoal: false, concede: false, save: false,
      rating: 0, fitness: -1.2, card: null, injuryRisk: 0, fame: 0, morale: 0,
      trust: 0, xp: null, penalty: false, shootout: false, text: '', tone: 'neutral',
      crowd: 0, money: 0
    }, o);
  }
  const GOOD = 'good', BAD = 'bad', NEU = 'neutral';

  /* ==========================================================================
     Scenario definitions
     each: { id, kind, weight(ctx), build(ctx) -> {title, sub, options[]} }
     ========================================================================== */
  const LIB = [];
  function add(def) { LIB.push(def); }

  const ATT = ['ST', 'LW', 'RW', 'CAM'];
  const MID = ['CM', 'CDM', 'CAM'];
  const DEF = ['CB', 'LB', 'RB', 'CDM'];
  function isPos(ctx, list) { return list.indexOf(ctx.player.pos) >= 0; }

  /* ---------- 1. one v one with the keeper ---------- */
  add({
    id: 'one_on_one', kind: 'shot',
    weight: ctx => isPos(ctx, ATT) ? 3 : isPos(ctx, MID) ? 1.2 : 0.3,
    build(ctx) {
      const gk = ctx.keeper;
      return {
        title: 'One-on-one!',
        sub: `You are clean through with only the keeper to beat. ${ctx.oppName}'s goalkeeper narrows the angle.` + weakNote(ctx),
        art: 'net',
        options: [
          { label: 'Blast it', hint: 'Power. Simple. Risky if he stands tall.', tag: 'Shooting',
            run() {
              const p = luck(ctx, odds(eff(ctx, 'shooting') + (trait(ctx, 'clinical') ? 8 : 0), gk, 0.016, 0.47));
              if (U.chance(p)) return E({ goal: true, rating: 1.6, tone: GOOD, xp: { shooting: .5 }, crowd: 8,
                text: 'You smash it straight through him. The net rips. GOAL!' });
              return E({ rating: -0.5, tone: BAD, xp: { shooting: .2 },
                text: 'The keeper stands big and it cannons off his chest. Huge chance gone.' });
            } },
          { label: 'Round the keeper', hint: 'High risk, high reward showboat.', tag: 'Dribbling',
            run() {
              let p = odds(eff(ctx, 'dribbling'), gk + 6, 0.017, 0.46) + flairBonus(ctx);
              if (trait(ctx, 'showman')) p += 0.08;
              p = luck(ctx, p);
              if (U.chance(p)) return E({ goal: true, rating: 1.9, fame: 1.2, crowd: 14, tone: GOOD,
                xp: { dribbling: .6 }, text: 'You drop the shoulder, glide around him and roll it in. Ice cold.' });
              if (U.chance(0.35)) return E({ rating: -0.7, tone: BAD, injuryRisk: 0.12, xp: { dribbling: .2 },
                text: 'He reads it and takes your legs — no penalty given, and you land badly.' });
              return E({ rating: -0.6, tone: BAD, xp: { dribbling: .2 },
                text: 'Too heavy a touch. The keeper smothers it at your feet.' });
            } },
          { label: 'Dink it over him', hint: 'Composure and touch.', tag: 'Composure',
            run() {
              let p = odds((eff(ctx, 'shooting') + eff(ctx, 'dribbling')) / 2, gk + 2, 0.016, 0.5);
              if (trait(ctx, 'ice')) p += 0.07;
              p = luck(ctx, p);
              if (U.chance(p)) return E({ goal: true, rating: 1.8, fame: 1.5, crowd: 12, tone: GOOD,
                xp: { shooting: .45 }, text: 'A cheeky dink, floating over the diving keeper. The away end loses it.' });
              return E({ rating: -0.8, tone: BAD, text: 'You scoop it over the bar. The bench holds their heads.' });
            } },
          { label: 'Square it to the striker', hint: 'The unselfish ball. Assist or nothing.', tag: 'Passing',
            run() {
              const p = luck(ctx, odds(eff(ctx, 'passing'), 44, 0.015, 0.62));
              if (U.chance(p)) return E({ assist: true, teamGoal: true, rating: 1.2, morale: 3, trust: 2,
                tone: GOOD, xp: { passing: .5 }, crowd: 7,
                text: 'You slide it across and your strike partner taps into an empty net. Assist!' });
              return E({ rating: -0.4, tone: BAD, xp: { passing: .2 },
                text: 'The pass is cut out by a recovering defender. Everyone groans.' });
            } }
        ]
      };
    }
  });

  /* ---------- 2. shoot or pass at the edge of the box ---------- */
  add({
    id: 'edge_box', kind: 'shot',
    weight: ctx => isPos(ctx, ATT) ? 2.4 : isPos(ctx, MID) ? 2.2 : 0.5,
    build(ctx) {
      return {
        title: 'Edge of the box',
        sub: 'The ball drops to you 20 yards out. A defender is closing and two team-mates make runs.' + weakNote(ctx),
        art: 'ball',
        options: [
          { label: 'Shoot first time', hint: 'Catch it sweet or slice it.', tag: 'Shooting',
            run() {
              let p = odds(eff(ctx, 'shooting') + (trait(ctx, 'clinical') ? 7 : 0), ctx.keeper + 20, 0.015, 0.32);
              p = luck(ctx, p);
              if (U.chance(p)) return E({ goal: true, rating: 2.0, fame: 1.4, crowd: 15, tone: GOOD,
                xp: { shooting: .6 }, text: 'You catch it flush and it flies into the top corner. Goal of the month?' });
              if (U.chance(0.3)) return E({ rating: -0.2, tone: NEU, xp: { shooting: .25 },
                text: 'Well struck, but the keeper claws it round the post. Corner.' });
              return E({ rating: -0.5, tone: BAD, xp: { shooting: .15 },
                text: 'You lean back and hammer it into row Z.' });
            } },
          { label: 'Slide a through ball', hint: 'Find the run behind.', tag: 'Passing',
            run() {
              const p = luck(ctx, odds(eff(ctx, 'passing'), ctx.defender + 6, 0.015, 0.5));
              if (U.chance(p)) {
                if (U.chance(0.62)) return E({ assist: true, teamGoal: true, rating: 1.5, trust: 2, tone: GOOD,
                  xp: { passing: .6 }, crowd: 9, text: 'Perfectly weighted. He rounds the keeper and scores. Assist!' });
                return E({ rating: 0.6, tone: NEU, xp: { passing: .4 },
                  text: 'Gorgeous ball — but he drags the finish wide. You can only laugh.' });
              }
              return E({ rating: -0.4, tone: BAD, text: 'Overhit. The keeper collects easily.' });
            } },
          { label: 'Take a touch, beat your man', hint: 'Create the extra yard.', tag: 'Dribbling',
            run() {
              const p = luck(ctx, odds(eff(ctx, 'dribbling'), ctx.defender + 4, 0.016, 0.48));
              if (U.chance(p)) {
                if (U.chance(0.5)) return E({ goal: true, rating: 2.1, fame: 2, crowd: 16, tone: GOOD,
                  xp: { dribbling: .5, shooting: .3 }, text: 'Touch, shimmy, finish. That is a highlight-reel goal.' });
                return E({ penalty: true, rating: 0.9, tone: GOOD, xp: { dribbling: .4 },
                  text: 'You skin him and he hauls you down. PENALTY!' });
              }
              return E({ rating: -0.6, tone: BAD, fitness: -2, xp: { dribbling: .2 },
                text: 'He nicks it off your toe and the counter is on. Sloppy.' });
            } },
          { label: 'Recycle it back', hint: 'Safe. Keeps possession.', tag: 'Safe',
            run() {
              return E({ rating: 0.1, fitness: -0.6, tone: NEU, xp: { passing: .15 },
                text: 'You roll it back to midfield. Sensible, if unspectacular. A few whistles.' });
            } }
        ]
      };
    }
  });

  /* ---------- 3. header from a cross ---------- */
  add({
    id: 'header', kind: 'shot',
    weight: ctx => isPos(ctx, ['ST', 'CB']) ? 2 : isPos(ctx, ATT) ? 1 : 0.6,
    build(ctx) {
      return {
        title: 'Cross comes in',
        sub: 'It is whipped towards the six-yard box and you rise above your marker.',
        art: 'header',
        options: [
          { label: 'Power header', hint: 'Neck muscles and aggression.', tag: 'Physical',
            run() {
              const p = luck(ctx, odds((eff(ctx, 'physical') + eff(ctx, 'shooting')) / 2, ctx.keeper + 8, 0.015, 0.4));
              if (U.chance(p)) return E({ goal: true, rating: 1.7, crowd: 10, tone: GOOD, xp: { physical: .4, shooting: .3 },
                text: 'You bullet it downwards and it bounces up into the roof of the net!' });
              return E({ rating: -0.3, tone: BAD, text: 'You get too much on it and it sails over.' });
            } },
          { label: 'Placed header', hint: 'Direct it into the corner.', tag: 'Technique',
            run() {
              const p = luck(ctx, odds(eff(ctx, 'shooting'), ctx.keeper + 4, 0.015, 0.42));
              if (U.chance(p)) return E({ goal: true, rating: 1.7, crowd: 9, tone: GOOD, xp: { shooting: .45 },
                text: 'Cushioned into the far corner. The keeper never moved.' });
              return E({ rating: -0.25, tone: BAD, text: 'Straight at the keeper. Comfortable save.' });
            } },
          { label: 'Cheeky flick-on', hint: 'Glance it for a runner.', tag: 'Flair',
            run() {
              let p = odds(eff(ctx, 'passing'), 48, 0.014, 0.45) + flairBonus(ctx) + (trait(ctx, 'showman') ? .08 : 0);
              if (U.chance(luck(ctx, p))) return E({ assist: true, teamGoal: true, rating: 1.3, fame: .6, tone: GOOD,
                xp: { passing: .4 }, text: 'The faintest flick — and your team-mate nods in behind you. Assist!' });
              return E({ rating: -0.2, tone: NEU, text: 'The flick finds nobody. Cleared.' });
            } }
        ]
      };
    }
  });

  /* ---------- 4. penalty ---------- */
  function penaltyOptions(ctx, onResult) {
    const gk = ctx.keeper;
    const skill = (eff(ctx, 'shooting') * 0.7 + (ctx.player.attrs.dribbling || 40) * 0.3)
      + (trait(ctx, 'ice') ? 12 : 0);
    const mk = (label, hint, base, tag) => ({
      label, hint, tag,
      run() {
        let p = luck(ctx, U.clamp(base + (skill - gk) * 0.006, 0.25, 0.96));
        if (ctx.pressure) p -= 0.05;
        const scored = U.chance(p);
        return onResult(scored, label);
      }
    });
    return [
      mk('Bottom left', 'Side-footed, low and hard.', 0.80, 'Placement'),
      mk('Top left', 'Unsaveable if you get it right.', 0.72, 'Risk'),
      mk('Straight down the middle', 'Nerve of steel required.', 0.74, 'Nerve'),
      mk('Bottom right', 'The classic. Keeper might guess.', 0.80, 'Placement'),
      mk('Top right', 'Postage stamp or the stands.', 0.72, 'Risk'),
      mk('Panenka', 'Chip it. Legend or clown.', 0.58 + flairBonus(ctx), 'Flair')
    ];
  }

  add({
    id: 'penalty', kind: 'set', explicitOnly: true,
    weight: () => 0,
    build(ctx) {
      return {
        title: 'PENALTY',
        sub: `${ctx.minute}' — you place the ball on the spot. ${(ctx.crowdHostile ? 'The whole stadium is whistling.' : 'Your fans hold their breath.')}`,
        art: 'penalty',
        options: penaltyOptions(ctx, (scored, label) => {
          if (scored) {
            const icon = label === 'Panenka';
            return E({ goal: true, rating: 1.4, fame: icon ? 3 : 0.8, crowd: icon ? 18 : 10, tone: GOOD,
              xp: { shooting: .35 },
              text: icon ? 'You chip it straight down the middle as he dives. Absolute audacity — and it works.'
                         : 'Sent the keeper the wrong way. Cool as you like.' });
          }
          if (U.chance(0.45)) return E({ rating: -1.4, morale: -8, tone: BAD, fame: -0.5,
            text: 'SAVED! He guessed right and pushed it away. You cannot look up.' });
          return E({ rating: -1.5, morale: -10, tone: BAD, fame: -0.5,
            text: 'You drag it wide of the post. That will be on every highlight show tonight.' });
        })
      };
    }
  });

  /* ---------- 5. free kick ---------- */
  add({
    id: 'free_kick', kind: 'set',
    weight: ctx => (ctx.player.attrs.shooting > 60 || ctx.player.attrs.passing > 65) ? 1.4 : 0.5,
    build(ctx) {
      return {
        title: 'Free kick, 22 yards',
        sub: 'The wall lines up. The keeper shouts. It is your call — you are on set pieces today.',
        art: 'wall',
        options: [
          { label: 'Curl it over the wall', hint: 'Whip and dip.', tag: 'Technique',
            run() {
              let p = odds(eff(ctx, 'shooting') + (trait(ctx, 'wizard') ? 12 : 0), ctx.keeper + 26, 0.014, 0.3);
              if (U.chance(luck(ctx, p))) return E({ goal: true, rating: 2.2, fame: 2.5, crowd: 18, tone: GOOD,
                xp: { shooting: .6 }, text: 'Over the wall, dipping, top bins. The stadium erupts. What a hit!' });
              if (U.chance(.25)) return E({ rating: 0.1, tone: NEU, text: 'Off the crossbar! Inches away.' });
              return E({ rating: -0.2, tone: BAD, text: 'The wall does its job. Deflected behind.' });
            } },
          { label: 'Drill it low under the wall', hint: 'They always jump.', tag: 'Cunning',
            run() {
              let p = odds(eff(ctx, 'shooting') + (trait(ctx, 'wizard') ? 10 : 0), ctx.keeper + 30, 0.014, 0.27);
              if (U.chance(luck(ctx, p))) return E({ goal: true, rating: 2.3, fame: 2.2, crowd: 16, tone: GOOD,
                xp: { shooting: .5 }, text: 'Under the jumping wall and in! The keeper is furious with his defenders.' });
              return E({ rating: -0.15, tone: BAD, text: 'Blocked by the one man who stayed down.' });
            } },
          { label: 'Whip it into the box', hint: 'Let the big men attack it.', tag: 'Passing',
            run() {
              const p = luck(ctx, odds(eff(ctx, 'passing') + (trait(ctx, 'wizard') ? 8 : 0), 55, 0.013, 0.42));
              if (U.chance(p)) return E({ assist: true, teamGoal: true, rating: 1.4, tone: GOOD, xp: { passing: .5 },
                text: 'Devilish delivery — your centre-half powers it home. Assist!' });
              return E({ rating: -0.1, tone: NEU, text: 'Claimed by the keeper at the near post.' });
            } },
          { label: 'Let a team-mate take it', hint: 'Zero risk, zero glory.', tag: 'Safe',
            run() {
              if (U.chance(0.18)) return E({ teamGoal: true, rating: 0.2, tone: NEU,
                text: 'Your captain steps up and scores. You applaud… through slightly gritted teeth.' });
              return E({ rating: 0, tone: NEU, text: 'He blazes it over. Maybe you should have taken it.' });
            } }
        ]
      };
    }
  });

  /* ---------- 6. corner ---------- */
  add({
    id: 'corner', kind: 'set',
    weight: ctx => isPos(ctx, ['LW', 'RW', 'CAM', 'CM', 'LB', 'RB']) ? 1.2 : 0.2,
    build(ctx) {
      return {
        title: 'Corner kick',
        sub: 'You jog over to take it. The box is packed and the referee checks his watch.',
        art: 'corner',
        options: [
          { label: 'Whip it near post', hint: 'Attack the first head.', tag: 'Delivery',
            run() {
              const p = luck(ctx, odds(eff(ctx, 'passing') + (trait(ctx, 'wizard') ? 10 : 0), 58, 0.013, 0.4));
              if (U.chance(p)) return E({ assist: true, teamGoal: true, rating: 1.3, tone: GOOD, xp: { passing: .45 },
                text: 'Flicked on at the near post and bundled in. Your assist!' });
              return E({ rating: -0.1, tone: NEU, text: 'Punched clear by the keeper.' });
            } },
          { label: 'Float it to the back post', hint: 'Find the tall lad.', tag: 'Delivery',
            run() {
              const p = luck(ctx, odds(eff(ctx, 'passing') + (trait(ctx, 'wizard') ? 8 : 0), 61, 0.013, 0.38));
              if (U.chance(p)) return E({ assist: true, teamGoal: true, rating: 1.35, tone: GOOD, xp: { passing: .45 },
                text: 'Hangs in the air forever — headed back across and in. Assist!' });
              return E({ rating: -0.1, tone: NEU, text: 'Too deep, out for a goal kick.' });
            } },
          { label: 'Short corner', hint: 'Work an angle.', tag: 'Smart',
            run() {
              const p = luck(ctx, odds(eff(ctx, 'passing'), 50, 0.012, 0.45));
              if (U.chance(p)) return E({ assist: U.chance(.6), teamGoal: true, rating: 1.0, tone: GOOD,
                xp: { passing: .3 }, text: 'The short routine works perfectly and the cutback is finished first time.' });
              return E({ rating: -0.2, tone: BAD, text: 'The short corner breaks down. The crowd hate it.' });
            } },
          { label: 'Go for the Olimpico', hint: 'Straight in. Absurd. Iconic.', tag: 'Audacity',
            run() {
              let p = 0.07 + (eff(ctx, 'passing') - 60) * 0.003 + (trait(ctx, 'wizard') ? .05 : 0)
                + flairBonus(ctx) + (trait(ctx, 'showman') ? .03 : 0);
              if (U.chance(luck(ctx, U.clamp(p, .02, .3)))) return E({ goal: true, rating: 2.5, fame: 5, crowd: 25,
                tone: GOOD, xp: { passing: .6 }, text: 'STRAIGHT IN FROM THE CORNER! An Olimpico! Nobody can believe it.' });
              return E({ rating: -0.3, tone: NEU, text: 'It curls just past the far post. Ambitious.' });
            } }
        ]
      };
    }
  });

  /* ---------- 7. counter attack ---------- */
  add({
    id: 'counter', kind: 'run',
    weight: ctx => isPos(ctx, ATT) || isPos(ctx, MID) ? 1.6 : 0.6,
    build(ctx) {
      return {
        title: 'Three on two!',
        sub: 'You break from your own half with numbers. The defence is scrambling back.',
        art: 'counter',
        options: [
          { label: 'Drive at them yourself', hint: 'Pace and power.', tag: 'Pace',
            run() {
              const p = luck(ctx, odds(eff(ctx, 'pace'), ctx.defender + 8, 0.016, 0.5));
              if (U.chance(p)) {
                if (U.chance(0.55)) return E({ goal: true, rating: 1.9, crowd: 12, fitness: -3, tone: GOOD,
                  xp: { pace: .4, shooting: .3 }, text: 'You burn past the last man and finish across the keeper!' });
                return E({ penalty: true, rating: 0.9, fitness: -3, tone: GOOD, xp: { pace: .4 },
                  text: 'The last defender cannot live with you and clips your heels. Penalty!' });
              }
              return E({ rating: -0.5, fitness: -3.5, tone: BAD, text: 'You run into traffic and the chance dies.' });
            } },
          { label: 'Slip in the winger', hint: 'The right ball, first time.', tag: 'Passing',
            run() {
              const p = luck(ctx, odds(eff(ctx, 'passing'), ctx.defender, 0.015, 0.56));
              if (U.chance(p)) return E({ assist: U.chance(.75), teamGoal: true, rating: 1.4, trust: 3, tone: GOOD,
                xp: { passing: .5 }, text: 'Inch-perfect release and it is buried. Textbook counter-attack.' });
              return E({ rating: -0.4, tone: BAD, text: 'Cut out. The move breaks down and the crowd sighs.' });
            } },
          { label: 'Slow it down, wait for support', hint: 'Control the tempo.', tag: 'Composure',
            run() {
              if (U.chance(luck(ctx, 0.42))) return E({ teamGoal: true, rating: 0.8, tone: GOOD, xp: { passing: .25 },
                text: 'You hold it up, bodies pile in, and the cutback is smashed home.' });
              return E({ rating: 0.05, tone: NEU, text: 'The moment passes. They get everyone back behind the ball.' });
            } }
        ]
      };
    }
  });

  /* ---------- 8. dribble duel ---------- */
  add({
    id: 'duel', kind: 'run',
    weight: ctx => isPos(ctx, ['LW', 'RW', 'CAM']) ? 2.4 : 1,
    build(ctx) {
      return {
        title: 'Isolated one-v-one',
        sub: `You take the ball wide with ${ctx.oppName}'s full-back right in front of you. The crowd rises.`,
        art: 'duel',
        options: [
          { label: 'Nutmeg him', hint: 'Humiliation or embarrassment.', tag: 'Flair',
            run() {
              let p = odds(eff(ctx, 'dribbling'), ctx.defender + 10, 0.017, 0.44)
                + flairBonus(ctx) * 1.4 + (trait(ctx, 'showman') ? .1 : 0);
              if (U.chance(luck(ctx, p))) return E({ rating: 1.0, fame: 2, crowd: 14, tone: GOOD, xp: { dribbling: .6 },
                assist: U.chance(.4), teamGoal: U.chance(.4),
                text: 'MEGS! Straight through his legs and the stadium howls. The cross that follows is dangerous too.' });
              return E({ rating: -0.5, fame: -0.3, tone: BAD, xp: { dribbling: .2 },
                text: 'He shuts his legs and wins it. The away fans mock you for the next ten minutes.' });
            } },
          { label: 'Stepover and cut inside', hint: 'Reliable trick.', tag: 'Dribbling',
            run() {
              const p = luck(ctx, odds(eff(ctx, 'dribbling'), ctx.defender + 2, 0.016, 0.52));
              if (U.chance(p)) return E({ rating: 0.8, crowd: 6, tone: GOOD, xp: { dribbling: .45 },
                goal: U.chance(.3), text: 'Stepover, cut inside, and you are away into the box.' });
              return E({ rating: -0.3, tone: BAD, text: 'Well defended. He forces you back the way you came.' });
            } },
          { label: 'Knock and run', hint: 'Pure pace.', tag: 'Pace',
            run() {
              const p = luck(ctx, odds(eff(ctx, 'pace'), ctx.defender + 4, 0.018, 0.52));
              if (U.chance(p)) return E({ rating: 0.9, fitness: -2.5, crowd: 7, tone: GOOD, xp: { pace: .5 },
                assist: U.chance(.45), teamGoal: U.chance(.45),
                text: 'You knock it past him and simply outrun him to the byline. Cutback… and it is in!' });
              if (U.chance(0.25)) return E({ rating: 0.4, tone: NEU, card: null,
                text: 'He cannot catch you and takes one for the team. Free kick, and he is booked.' });
              return E({ rating: -0.3, fitness: -2.5, tone: BAD, text: 'Too heavy — it runs out for a throw.' });
            } },
          { label: 'Lay it off, keep it simple', hint: 'No risk.', tag: 'Safe',
            run() { return E({ rating: 0.15, fitness: -0.6, tone: NEU, xp: { passing: .15 },
              text: 'You recycle to the full-back and reset the attack.' }); } }
        ]
      };
    }
  });

  /* ---------- 9. last-ditch defending ---------- */
  add({
    id: 'last_ditch', kind: 'defend',
    weight: ctx => isPos(ctx, DEF) ? 3 : 0.5,
    build(ctx) {
      return {
        title: 'Last man back',
        sub: 'Their striker is through and you are the only thing between him and the goal.',
        art: 'block',
        options: [
          { label: 'Slide tackle', hint: 'All or nothing.', tag: 'Defending',
            run() {
              const p = luck(ctx, odds(eff(ctx, 'defending') + (trait(ctx, 'tank') ? 8 : 0), ctx.attackerRating + 6, 0.016, 0.5));
              if (U.chance(p)) return E({ rating: 1.4, crowd: 10, tone: GOOD, xp: { defending: .6 },
                text: 'Perfectly timed! You take the ball cleanly and the whole ground applauds.' });
              if (U.chance(trait(ctx, 'hothead') ? 0.55 : 0.4)) return E({ rating: -2.2, card: 'red', concede: false,
                tone: BAD, morale: -10, text: 'You miss it completely and take him down. Straight red. Long walk.' });
              return E({ rating: -1.2, concede: true, tone: BAD, text: 'You slide past him and he rolls it into the empty net.' });
            } },
          { label: 'Stay on your feet, jockey', hint: 'Delay and force him wide.', tag: 'Positioning',
            run() {
              const p = luck(ctx, odds(eff(ctx, 'defending'), ctx.attackerRating, 0.015, 0.54));
              if (U.chance(p)) return E({ rating: 1.0, tone: GOOD, xp: { defending: .5 },
                text: 'You shepherd him to the touchline and the danger fizzles out. Textbook.' });
              return E({ rating: -0.9, concede: U.chance(.65), tone: BAD, text: 'He goes past you far too easily.' });
            } },
          { label: 'Cynical foul, take the card', hint: 'Kill the attack. Accept the punishment.', tag: 'Dark Arts',
            run() {
              const red = U.chance(0.35);
              return E({ rating: red ? -1.6 : -0.1, card: red ? 'red' : 'yellow', trust: red ? -6 : 2,
                tone: red ? BAD : NEU, fame: 0.3,
                text: red ? 'Denying a clear goalscoring opportunity — the referee has no choice. Red card.'
                          : 'You clip him and stop the counter. Booked, but the manager nods approvingly.' });
            } },
          { label: 'Sprint back and shoulder him', hint: 'Physical duel.', tag: 'Physical',
            run() {
              const p = luck(ctx, odds(eff(ctx, 'physical') + (trait(ctx, 'tank') ? 9 : 0), ctx.attackerRating + 4, 0.016, 0.5));
              if (U.chance(p)) return E({ rating: 1.2, fitness: -3, tone: GOOD, xp: { physical: .5, pace: .2 },
                text: 'You muscle him off the ball at full sprint. Absolute monster of a recovery.' });
              return E({ rating: -1.0, concede: U.chance(.6), fitness: -3, tone: BAD,
                text: 'He rides the challenge and finishes coolly.' });
            } }
        ]
      };
    }
  });

  /* ---------- 10. aerial duel in your own box ---------- */
  add({
    id: 'aerial', kind: 'defend',
    weight: ctx => isPos(ctx, ['CB', 'CDM']) ? 2 : 0.4,
    build(ctx) {
      return {
        title: 'Corner against you',
        sub: 'The ball is swung into your box and their giant centre-half attacks it.',
        art: 'wall',
        options: [
          { label: 'Attack the ball', hint: 'Get there first.', tag: 'Physical',
            run() {
              const p = luck(ctx, odds(eff(ctx, 'physical'), ctx.attackerRating, 0.016, 0.53));
              if (U.chance(p)) return E({ rating: 0.8, tone: GOOD, xp: { physical: .4, defending: .2 },
                text: 'You climb highest and head it clear. Danger over.' });
              return E({ rating: -0.8, concede: U.chance(.55), tone: BAD, text: 'He beats you to it and nods it goalwards.' });
            } },
          { label: 'Body-block your man', hint: 'Stop him jumping. Risky.', tag: 'Dark Arts',
            run() {
              if (U.chance(0.22)) return E({ rating: -1.5, tone: BAD, concede: U.chance(.5),
                text: 'The referee spots the shirt pull. Penalty against you.' });
              return E({ rating: 0.6, tone: GOOD, xp: { defending: .3 },
                text: 'You wrestle him out of the jump and the ball is cleared. He is furious.' });
            } },
          { label: 'Drop and cover the line', hint: 'Trust the keeper.', tag: 'Positioning',
            run() {
              const p = luck(ctx, odds(eff(ctx, 'defending'), 55, 0.014, 0.55));
              if (U.chance(p)) return E({ rating: 0.9, tone: GOOD, xp: { defending: .5 },
                text: 'The header is goal-bound — and you hook it off the line! Heroic.' });
              return E({ rating: -0.4, concede: U.chance(.4), tone: NEU, text: 'It flashes past you and just wide.' });
            } }
        ]
      };
    }
  });

  /* ---------- 11. goalkeeper: one-on-one save ---------- */
  add({
    id: 'gk_save', kind: 'gk',
    weight: ctx => ctx.player.pos === 'GK' ? 4 : 0,
    build(ctx) {
      return {
        title: 'Their striker is through',
        sub: 'One-v-one. Everything slows down. What do you do?',
        art: 'save',
        options: [
          { label: 'Spread yourself big', hint: 'Star-jump. Block the angle.', tag: 'Goalkeeping',
            run() {
              const p = luck(ctx, odds(eff(ctx, 'gk'), ctx.attackerRating + 4, 0.016, 0.48));
              if (U.chance(p)) return E({ save: true, rating: 0.95, crowd: 12, tone: GOOD, xp: { gk: .6 },
                text: 'You make yourself enormous and it thumps off your chest. Massive save!' });
              return E({ concede: true, rating: -0.6, tone: BAD, text: 'He picks his spot and slots it past you.' });
            } },
          { label: 'Rush out and smother', hint: 'Aggressive, all-in.', tag: 'Bravery',
            run() {
              const p = luck(ctx, odds(eff(ctx, 'gk') + eff(ctx, 'pace') * .3, ctx.attackerRating + 12, 0.016, 0.46));
              if (U.chance(p)) return E({ save: true, rating: 1.1, crowd: 13, tone: GOOD, xp: { gk: .6, pace: .2 },
                text: 'You devour the space and smother it at his feet. Brave keeping.' });
              if (U.chance(.3)) return E({ concede: true, rating: -1.4, card: 'yellow', tone: BAD, injuryRisk: .1,
                text: 'You clatter into him — and he had already knocked it past you. Booked, and 1-0.' });
              return E({ concede: true, rating: -0.8, tone: BAD, text: 'He dinks it over you as you commit. Ouch.' });
            } },
          { label: 'Stand tall and wait', hint: 'Make him decide.', tag: 'Patience',
            run() {
              const p = luck(ctx, odds(eff(ctx, 'gk'), ctx.attackerRating, 0.015, 0.5));
              if (U.chance(p)) return E({ save: true, rating: 0.9, tone: GOOD, xp: { gk: .5 },
                text: 'You hold your ground, he blinks first, and you push it round the post.' });
              return E({ concede: true, rating: -0.5, tone: BAD, text: 'He goes early and finds the bottom corner.' });
            } }
        ]
      };
    }
  });

  /* ---------- 12. goalkeeper: cross ---------- */
  add({
    id: 'gk_cross', kind: 'gk',
    weight: ctx => ctx.player.pos === 'GK' ? 2.2 : 0,
    build(ctx) {
      return {
        title: 'Ball into the mixer',
        sub: 'A dangerous cross hangs over a crowded six-yard box.',
        art: 'keeper',
        options: [
          { label: 'Come and claim it', hint: 'Command your area.', tag: 'Goalkeeping',
            run() {
              const p = luck(ctx, odds(eff(ctx, 'gk'), 58, 0.015, 0.55));
              if (U.chance(p)) return E({ save: true, rating: 0.55, tone: GOOD, xp: { gk: .45 },
                text: 'Plucked out of the sky one-handed. Your defenders love you for it.' });
              return E({ concede: U.chance(.6), rating: -1.0, tone: BAD, text: 'You flap at it and it drops for a tap-in.' });
            } },
          { label: 'Punch clear', hint: 'Safety first.', tag: 'Safe',
            run() {
              const p = luck(ctx, odds(eff(ctx, 'gk'), 50, 0.014, 0.62));
              if (U.chance(p)) return E({ save: true, rating: 0.3, tone: NEU, xp: { gk: .3 },
                text: 'Two fists, thirty yards. Not pretty, but effective.' });
              return E({ concede: U.chance(.4), rating: -0.6, tone: BAD, text: 'You only half-clear it and they smash the rebound in.' });
            } },
          { label: 'Hold your line', hint: 'Trust the defenders.', tag: 'Positioning',
            run() {
              if (U.chance(luck(ctx, 0.6))) return E({ rating: 0.3, tone: NEU, text: 'Your centre-back heads it clear. Good decision.' });
              return E({ concede: U.chance(.55), rating: -0.7, tone: BAD, text: 'Nobody attacks it and it is nodded in at the back post.' });
            } }
        ]
      };
    }
  });

  /* ---------- 13. play through pain ---------- */
  add({
    id: 'knock', kind: 'life',
    weight: ctx => ctx.player.fitness < 62 ? 1.4 : 0.35,
    build(ctx) {
      return {
        title: 'You feel something go',
        sub: 'A twinge in the hamstring after a sprint. The physio is looking over. There are 25 minutes left.',
        art: 'injury',
        options: [
          { label: 'Play through it', hint: 'Heroic. Or stupid.', tag: 'Guts',
            run() {
              if (U.chance(trait(ctx, 'glass') ? 0.5 : 0.32)) return E({ injuryRisk: 1, rating: -0.5, tone: BAD, fitness: -12,
                text: 'Two minutes later it goes properly. You collapse untouched. That is a serious one.' });
              return E({ rating: 0.7, morale: 4, trust: 5, fame: .4, fitness: -8, tone: GOOD,
                text: 'You grit your teeth and get through it. The manager notes your bravery.' });
            } },
          { label: 'Signal to the bench', hint: 'Sensible.', tag: 'Smart',
            run() { return E({ rating: 0, fitness: 4, trust: -2, tone: NEU, subbed: true,
              text: 'You come off as a precaution. Frustrating, but nothing torn.' }); } },
          { label: 'Ask to be moved to a safer role', hint: 'Stay on, contribute less.', tag: 'Compromise',
            run() { return E({ rating: -0.2, fitness: -3, tone: NEU,
              text: 'You drop deeper and coast through the last twenty minutes.' }); } }
        ]
      };
    }
  });

  /* ---------- 14. referee flashpoint ---------- */
  add({
    id: 'ref', kind: 'discipline',
    weight: () => 0.9,
    build(ctx) {
      return {
        title: 'The referee has given a shocker',
        sub: 'A clear foul on you, waved away. The bench is up in arms and you are already fuming.',
        art: 'card',
        options: [
          { label: 'Get in his face', hint: 'Say what you think.', tag: 'Hot Head',
            run() {
              if (U.chance(trait(ctx, 'hothead') ? 0.62 : 0.45)) return E({ card: 'yellow', rating: -0.5, fame: .5,
                tone: BAD, text: 'Booked for dissent. Predictable — and now you have to be careful.' });
              return E({ rating: 0.1, morale: 3, fame: .4, tone: NEU,
                text: 'He takes it, this time. "One more word," he says. The captain drags you away.' });
            } },
          { label: 'Sarcastic applause', hint: 'Petty and glorious.', tag: 'Flair',
            run() {
              if (U.chance(0.5)) return E({ card: 'yellow', rating: -0.4, fame: 1.2, tone: BAD,
                text: 'He does not appreciate the applause. Yellow. The clip goes viral anyway.' });
              return E({ fame: 1.5, rating: 0.1, tone: NEU, text: 'The cameras catch your slow clap. The internet does the rest.' });
            } },
          { label: 'Say nothing, get on with it', hint: 'Professional.', tag: 'Safe',
            run() { return E({ rating: 0.3, trust: 2, tone: NEU, text: 'You bite your tongue and jog back. The captain nods.' }); } }
        ]
      };
    }
  });

  /* ---------- 15. go down or stay up ---------- */
  add({
    id: 'dive', kind: 'discipline',
    weight: () => 1.1,
    build(ctx) {
      return {
        title: 'Contact in the box',
        sub: 'The defender catches you — maybe. You are still on your feet, but the angle is terrible.',
        art: 'dive',
        options: [
          { label: 'Go down', hint: 'The referee decides your reputation.', tag: 'Dark Arts',
            run() {
              const r = Math.random();
              if (r < 0.42) return E({ penalty: true, rating: 0.7, tone: GOOD, fame: .5,
                text: 'The whistle blows — PENALTY! The defender cannot believe it.' });
              if (r < 0.72) return E({ card: 'yellow', rating: -0.8, fame: -1, tone: BAD,
                text: 'Booked for simulation. The pundits will not let this one go.' });
              return E({ rating: -0.3, tone: NEU, text: 'Waved away. You get up looking sheepish.' });
            } },
          { label: 'Stay up and shoot', hint: 'Honest. Difficult.', tag: 'Integrity',
            run() {
              const p = luck(ctx, odds(eff(ctx, 'shooting'), ctx.keeper + 14, 0.014, 0.34));
              if (U.chance(p)) return E({ goal: true, rating: 2.0, fame: 2, crowd: 14, tone: GOOD, xp: { shooting: .5 },
                text: 'You ride the challenge and finish anyway! Everyone in the ground stands up.' });
              return E({ rating: -0.2, tone: NEU, text: 'You stay on your feet but scuff the shot wide. Honest, at least.' });
            } }
        ]
      };
    }
  });

  /* ---------- 16. team-mate on a hat-trick ---------- */
  add({
    id: 'unselfish', kind: 'social',
    weight: ctx => isPos(ctx, ATT) ? 1.1 : 0.3,
    build(ctx) {
      return {
        title: 'He is on a hat-trick',
        sub: 'You are in on goal — but your strike partner is completely free, and he has two already.',
        art: 'agent',
        options: [
          { label: 'Take it yourself', hint: 'Goals are your currency.', tag: 'Selfish',
            run() {
              const p = luck(ctx, odds(eff(ctx, 'shooting'), ctx.keeper + 6, 0.015, 0.5));
              if (U.chance(p)) return E({ goal: true, rating: 1.4, morale: -3, tone: GOOD, xp: { shooting: .4 },
                text: 'You score — but your team-mate turns away without celebrating. Awkward dressing room later.' });
              return E({ rating: -1.0, morale: -8, trust: -4, tone: BAD,
                text: 'You miss, and he throws his arms up. That will be replayed on the analysis screen.' });
            } },
          { label: 'Roll it to him', hint: 'Assist and goodwill.', tag: 'Team Player',
            run() { return E({ assist: true, teamGoal: true, rating: 1.1, morale: 6, trust: 4, fame: .6, tone: GOOD,
              xp: { passing: .35 }, text: 'You square it and he completes his hat-trick. He lifts you off the ground.' }); } }
        ]
      };
    }
  });

  /* ---------- 17. tap-in / rebound ---------- */
  add({
    id: 'rebound', kind: 'shot',
    weight: ctx => isPos(ctx, ATT) ? 1.6 : 0.6,
    build(ctx) {
      return {
        title: 'The keeper spills it!',
        sub: 'The ball is loose six yards out with defenders throwing themselves at it.',
        art: 'rebound',
        options: [
          { label: 'Poke it in first time', hint: 'React fastest.', tag: 'Instinct',
            run() {
              const p = luck(ctx, odds(eff(ctx, 'shooting') + (trait(ctx, 'clinical') ? 10 : 0), 46, 0.016, 0.56));
              if (U.chance(p)) return E({ goal: true, rating: 1.3, tone: GOOD, xp: { shooting: .35 },
                text: 'Gambled, reacted, tapped in. The poacher strikes.' });
              return E({ rating: -0.5, tone: BAD, text: 'A defender gets a block in on the line.' });
            } },
          { label: 'Take a touch to steady', hint: 'Make sure of it.', tag: 'Composure',
            run() {
              const p = luck(ctx, odds(eff(ctx, 'dribbling'), 52, 0.015, 0.5));
              if (U.chance(p)) return E({ goal: true, rating: 1.5, tone: GOOD, xp: { dribbling: .3, shooting: .3 },
                text: 'One touch, then side-foot into the empty net. Never in doubt.' });
              return E({ rating: -0.8, tone: BAD, text: 'The extra touch lets them recover and it is hacked clear. Should have hit it.' });
            } }
        ]
      };
    }
  });

  /* ---------- 18. long range effort ---------- */
  add({
    id: 'long_shot', kind: 'shot',
    weight: () => 1.0,
    build(ctx) {
      return {
        title: 'Space 30 yards out',
        sub: 'They have dropped off you and the keeper is a couple of steps off his line.' + weakNote(ctx),
        art: 'shooting',
        options: [
          { label: 'Rip it', hint: 'Worldie or wasted possession.', tag: 'Power',
            run() {
              const p = luck(ctx, odds(eff(ctx, 'shooting'), ctx.keeper + 34, 0.013, 0.22));
              if (U.chance(p)) return E({ goal: true, rating: 2.4, fame: 3, crowd: 22, tone: GOOD, xp: { shooting: .6 },
                text: 'THIRTY YARDS AND IT FLIES IN! Absolutely unstoppable. Goal of the season contender.' });
              return E({ rating: -0.3, tone: NEU, xp: { shooting: .2 }, text: 'Ambitious, but it clears the bar comfortably.' });
            } },
          { label: 'Chip the keeper from range', hint: 'He is off his line…', tag: 'Audacity',
            run() {
              const p = luck(ctx, 0.14 + (eff(ctx, 'shooting') - 60) * 0.004 + flairBonus(ctx) + (trait(ctx, 'showman') ? .05 : 0));
              if (U.chance(U.clamp(p, .03, .4))) return E({ goal: true, rating: 2.6, fame: 5, crowd: 26, tone: GOOD,
                xp: { shooting: .7 }, text: 'From the halfway line — over the keeper and in! You will never pay for a drink in this city again.' });
              return E({ rating: -0.2, tone: NEU, text: 'He backpedals and catches it. Worth a try.' });
            } },
          { label: 'Work it into the channel', hint: 'Patient build-up.', tag: 'Safe',
            run() { return E({ rating: 0.2, tone: NEU, xp: { passing: .2 }, text: 'You switch play and the attack builds again.' }); } }
        ]
      };
    }
  });

  /* ---------- 19. big-game nerves / captaincy moment ---------- */
  add({
    id: 'captain_talk', kind: 'social',
    weight: ctx => ctx.losing ? 1.3 : 0.3,
    build(ctx) {
      return {
        title: 'Heads are dropping',
        sub: 'You are behind, the crowd is turning, and the team looks beaten with 20 minutes left.',
        art: 'fans',
        options: [
          { label: 'Rally the team', hint: 'Grab them by the collar.', tag: 'Leadership',
            run() {
              const p = luck(ctx, 0.42 + (trait(ctx, 'leader') ? .25 : 0) + ctx.player.fame / 400);
              if (U.chance(p)) return E({ rating: 0.8, morale: 6, trust: 5, teamBoost: 6, tone: GOOD,
                text: 'You drag them back into it with sheer force of will. The tempo lifts immediately.' });
              return E({ rating: 0.1, tone: NEU, text: 'You shout, they nod, nothing much changes.' });
            } },
          { label: 'Demand the ball every time', hint: 'Take it on yourself.', tag: 'Ego',
            run() { return E({ rating: 0.2, fitness: -4, soloBoost: true, tone: NEU,
              text: 'You start showing for everything. More touches, more risk, more chances of both kinds.' }); } },
          { label: 'Keep quiet and work', hint: 'Lead by example.', tag: 'Quiet',
            run() { return E({ rating: 0.4, fitness: -2, trust: 2, tone: NEU,
              text: 'No speeches. You just run harder than anyone else on the pitch.' }); } }
        ]
      };
    }
  });

  /* ---------- 20. celebration ---------- */
  add({
    id: 'celebration', kind: 'social', explicitOnly: true,
    weight: () => 0,
    build(ctx) {
      return {
        title: 'You scored! How do you celebrate?',
        sub: 'The stadium is bouncing and every camera in the ground is on you.',
        art: 'celebrate',
        options: [
          { label: 'Signature celebration', hint: 'One the cameras will learn.', tag: 'Trademark',
            run() { return E({ fame: 2, morale: 3, tone: GOOD, text: 'The pose. The cameras. The merchandise team is already on it.' }); } },
          { label: 'Run to the fans', hint: 'They love you for it.', tag: 'Fans',
            run() {
              if (U.chance(0.25)) return E({ card: 'yellow', fame: 1.5, tone: NEU,
                text: 'You climb the fence into the away end. Worth the booking.' });
              return E({ fame: 1.2, morale: 4, crowd: 8, tone: GOOD, text: 'You disappear into a mass of supporters. Pure joy.' });
            } },
          { label: 'Shirt off', hint: 'Guaranteed yellow, guaranteed poster.', tag: 'Icon',
            run() { return E({ card: 'yellow', fame: 3, morale: 3, tone: NEU,
              text: 'Shirt off, badge in the air. Booked, iconic, and all over social media within 90 seconds.' }); } },
          { label: 'Refuse to celebrate', hint: 'Against a former club? Respect.', tag: 'Class',
            run() { return E({ fame: 0.8, morale: 2, tone: GOOD, text: 'Hands up, head down. The neutrals respect it enormously.' }); } },
          { label: 'Straight back to the halfway line', hint: 'Job is not done.', tag: 'Focus',
            run() { return E({ trust: 3, rating: 0.1, tone: NEU, text: 'You grab the ball and sprint back. Serious business.' }); } }
        ]
      };
    }
  });

  /* ==========================================================================
     Selection
     ========================================================================== */
  const Scenarios = {
    byId(id) { return LIB.find(s => s.id === id); },

    build(id, ctx) {
      const def = Scenarios.byId(id);
      if (!def) return null;
      const built = def.build(ctx);
      built.id = id; built.kind = def.kind;
      return built;
    },

    random(ctx, excludeIds) {
      const ex = excludeIds || [];
      const pool = LIB.filter(s => !s.explicitOnly && ex.indexOf(s.id) < 0)
        .map(s => [s, s.weight(ctx)])
        .filter(pair => pair[1] > 0);
      if (!pool.length) return Scenarios.build('edge_box', ctx);
      const def = U.weighted(pool);
      return Scenarios.build(def.id, ctx);
    },

    // A penalty shootout kick (used by engine for cup ties)
    shootoutKick(ctx) {
      return {
        id: 'shootout', kind: 'set',
        title: 'Penalty shootout',
        sub: ctx.shootoutSub || 'Your turn. The whole season comes down to this.',
        art: 'penalty',
        options: penaltyOptions(ctx, scored => E({
          goal: scored, tone: scored ? GOOD : BAD,
          text: scored ? 'Buried it. You do not even look at the keeper.' : 'Saved! You sink to your knees.'
        }))
      };
    },

    list() { return LIB; }
  };

  global.Scenarios = Scenarios;
})(window);
