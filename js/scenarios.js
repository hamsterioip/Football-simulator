/* ==========================================================================
   scenarios.js — interactive in-match decision moments
   Every scenario returns options; each option resolves to an effects object
   consumed by engine.js.
   ========================================================================== */
(function (global) {
  'use strict';
  const D = global.DATA, U = global.U, State = global.State;

  /* ---------- style traits ----------
     Each option is given a style (from the moment it belongs to and the kind of
     choice it is), and a matching trait makes that style more likely to come
     off. This keeps the bonus in one place instead of in fifty probabilities. */
  const STYLE_TRAITS = {
    finesse:   { style: 'finesse',  attrs: ['shooting', 'dribbling'], mult: .12 },
    power:     { style: 'power',    attrs: ['shooting', 'physical'],  mult: .12 },
    poacher:   { style: 'poacher',  attrs: ['shooting'],              mult: .15 },
    aerial:    { style: 'aerial',   attrs: ['physical', 'shooting', 'defending'], mult: .13 },
    visionary: { style: 'vision',   attrs: ['passing'],               mult: .12 },
    burst:     { style: 'pace',     attrs: ['pace'],                  mult: .12 },
    pressres:  { style: 'pressres', attrs: ['dribbling', 'passing'],  mult: .15 },
    longrange: { style: 'longshot', attrs: ['shooting'],              mult: .18 },
    shotstop:  { style: 'shotstop', attrs: ['gk'],                    mult: .13 },
    sweeperk:  { style: 'sweeper',  attrs: ['gk', 'pace'],            mult: .13 }
  };

  // which style an option belongs to, from its moment and the choice it offers
  const TAG_STYLE = {
    // power
    'Power': 'power', 'Physical': 'power', 'Shooting': 'power', 'Risk': 'power',
    // finesse
    'Placement': 'finesse', 'Technique': 'finesse', 'Composure': 'finesse', 'Nerve': 'finesse',
    'Dribbling': 'finesse', 'Flair': 'finesse', 'Audacity': 'finesse', 'Icon': 'finesse',
    // vision
    'Passing': 'vision', 'Vision': 'vision', 'Smart': 'vision', 'Cunning': 'vision',
    'Delivery': 'vision', 'Set Piece': 'vision', 'Team Player': 'vision',
    // pace
    'Pace': 'pace', 'Work Rate': 'pace',
    // poaching
    'Instinct': 'poacher',
    // keeping
    'Goalkeeping': 'shotstop', 'Handling': 'shotstop', 'Reflex': 'shotstop', 'Patience': 'shotstop',
    'Bravery': 'sweeper', 'Commitment': 'sweeper',
    // the dark arts
    'Dark Arts': 'dive', 'Streetwise': 'dive'
  };
  const SCENARIO_STYLE = {
    header: 'aerial', aerial: 'aerial', volley: 'aerial', flick_on: 'aerial',
    long_shot: 'longshot', keeper_rush: 'longshot',
    rebound: 'poacher', tight_angle: 'poacher',
    own_box: 'pressres', gk_backpass: 'pressres',
    gk_sweeper: 'sweeper', gk_distribution: 'sweeper',
    gk_save: 'shotstop', gk_longshot: 'shotstop', gk_wall: 'shotstop', gk_penalty: 'shotstop',
    dive: 'dive'
  };
  function styleFor(scn, opt) {
    return (opt && opt.style)
      || SCENARIO_STYLE[scn && scn.id]
      || TAG_STYLE[opt && opt.tag]
      || null;
  }
  function styleMult(ctx, attr) {
    if (!ctx.style) return 1;
    let m = 1;
    Object.keys(STYLE_TRAITS).forEach(id => {
      const t = STYLE_TRAITS[id];
      if (t.style === ctx.style && t.attrs.indexOf(attr) >= 0 && State.hasTrait(ctx.player, id)) m += t.mult;
    });
    return m;
  }

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
    return raw * formF * fitF * nerve * styleMult(ctx, attr);
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
      rating: 0, fitness: -1.2, card: null, injuryRisk: 0, rep: 0, morale: 0,
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
        sub: U.pick([
          `You are clean through with only the keeper to beat. ${ctx.oppName}'s goalkeeper narrows the angle.`,
          'The offside flag stays down and the whole ground stands up. Just you and him now.',
          'One touch has taken you past the last man. Forty thousand people go quiet at once.'
        ]) + weakNote(ctx),
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
              if (U.chance(p)) return E({ goal: true, rating: 1.9, rep: 1.2, crowd: 14, tone: GOOD,
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
              if (U.chance(p)) return E({ goal: true, rating: 1.8, rep: 1.5, crowd: 12, tone: GOOD,
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
        sub: U.pick([
          'The ball drops to you 20 yards out. A defender is closing and two team-mates make runs.',
          'It breaks off a defender and sits up perfectly, right on the edge of the box.',
          'You have got it on the angle of the area with a yard of room and a decision to make.'
        ]) + weakNote(ctx),
        art: 'ball',
        options: [
          { label: 'Shoot first time', hint: 'Catch it sweet or slice it.', tag: 'Shooting',
            run() {
              let p = odds(eff(ctx, 'shooting') + (trait(ctx, 'clinical') ? 7 : 0), ctx.keeper + 20, 0.015, 0.32);
              p = luck(ctx, p);
              if (U.chance(p)) return E({ goal: true, rating: 2.0, rep: 1.4, crowd: 15, tone: GOOD,
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
                if (U.chance(0.5)) return E({ goal: true, rating: 2.1, rep: 2, crowd: 16, tone: GOOD,
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
        sub: U.pick([
          'It is whipped towards the six-yard box and you rise above your marker.',
          'The delivery is deep and hanging, and you have half a yard on the centre-half.',
          'A near-post ball, flat and quick. You have to attack it or it is gone.'
        ]),
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
              if (U.chance(luck(ctx, p))) return E({ assist: true, teamGoal: true, rating: 1.3, rep: .6, tone: GOOD,
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
          if (U.chance(0.45)) return E({ rating: -1.4, morale: -8, tone: BAD, rep: -0.5, how: 'saved',
            text: 'SAVED! He guessed right and pushed it away. You cannot look up.' });
          return E({ rating: -1.5, morale: -10, tone: BAD, rep: -0.5, how: 'missed',
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
        sub: U.pick([
          'The wall lines up. The keeper shouts. It is your call — you are on set pieces today.',
          'Dead centre, twenty-two yards, five in the wall. Perfect distance.',
          'Just outside the D on your favoured side. You have scored from here before.'
        ]),
        art: 'wall',
        options: [
          { label: 'Curl it over the wall', hint: 'Whip and dip.', tag: 'Technique',
            run() {
              let p = odds(eff(ctx, 'shooting') + (trait(ctx, 'wizard') ? 12 : 0), ctx.keeper + 26, 0.014, 0.3);
              if (U.chance(luck(ctx, p))) return E({ goal: true, rating: 2.2, rep: 2.5, crowd: 18, tone: GOOD,
                xp: { shooting: .6 }, text: 'Over the wall, dipping, top bins. The stadium erupts. What a hit!' });
              if (U.chance(.25)) return E({ rating: 0.1, tone: NEU, text: 'Off the crossbar! Inches away.' });
              return E({ rating: -0.2, tone: BAD, text: 'The wall does its job. Deflected behind.' });
            } },
          { label: 'Drill it low under the wall', hint: 'They always jump.', tag: 'Cunning',
            run() {
              let p = odds(eff(ctx, 'shooting') + (trait(ctx, 'wizard') ? 10 : 0), ctx.keeper + 30, 0.014, 0.27);
              if (U.chance(luck(ctx, p))) return E({ goal: true, rating: 2.3, rep: 2.2, crowd: 16, tone: GOOD,
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
        sub: U.pick([
          'You jog over to take it. The box is packed and the referee checks his watch.',
          'Both centre-halves have come up. The keeper is shouting at everyone.',
          'Late in the half, and this is the last ball of it.'
        ]),
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
              if (U.chance(luck(ctx, U.clamp(p, .02, .3)))) return E({ goal: true, rating: 2.5, rep: 5, crowd: 25,
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
        sub: U.pick([
          'You break from your own half with numbers. The defence is scrambling back.',
          'Their corner comes to nothing and now you are away, three against two.',
          'Turnover in midfield and the whole pitch opens up in front of you.'
        ]),
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
        sub: U.pick([
          `You take the ball wide with ${ctx.oppName}'s full-back right in front of you. The crowd rises.`,
          'One defender, no cover, and the touchline. This is what you are paid for.',
          'He backs off, then plants his feet. He has decided he is not being beaten again.'
        ]),
        art: 'duel',
        options: [
          { label: 'Nutmeg him', hint: 'Humiliation or embarrassment.', tag: 'Flair',
            run() {
              let p = odds(eff(ctx, 'dribbling'), ctx.defender + 10, 0.017, 0.44)
                + flairBonus(ctx) * 1.4 + (trait(ctx, 'showman') ? .1 : 0);
              if (U.chance(luck(ctx, p))) return E({ rating: 1.0, rep: 2, crowd: 14, tone: GOOD, xp: { dribbling: .6 },
                assist: U.chance(.4), teamGoal: U.chance(.4),
                text: 'MEGS! Straight through his legs and the stadium howls. The cross that follows is dangerous too.' });
              return E({ rating: -0.5, rep: -0.3, tone: BAD, xp: { dribbling: .2 },
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
        sub: U.pick([
          'Their striker is through and you are the only thing between him and the goal.',
          'The pass splits your back line. You are the last man and you are running backwards.',
          'A mistake in midfield, and suddenly it is him, you, and eighty yards of grass.'
        ]),
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
                tone: red ? BAD : NEU, rep: 0.3,
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
        sub: U.pick([
          'One-v-one. Everything slows down. What do you do?',
          'He is through, and the noise in the stadium drops away completely.',
          'Your defenders have been played through. It is on you now.'
        ]),
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
              return E({ rating: 0.7, morale: 4, trust: 5, rep: .4, fitness: -8, tone: GOOD,
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
        art: 'varscreen',
        options: [
          { label: 'Get in his face', hint: 'Say what you think.', tag: 'Hot Head',
            run() {
              if (U.chance(trait(ctx, 'hothead') ? 0.62 : 0.45)) return E({ card: 'yellow', rating: -0.5, rep: .5,
                tone: BAD, text: 'Booked for dissent. Predictable — and now you have to be careful.' });
              return E({ rating: 0.1, morale: 3, rep: .4, tone: NEU,
                text: 'He takes it, this time. "One more word," he says. The captain drags you away.' });
            } },
          { label: 'Sarcastic applause', hint: 'Petty and glorious.', tag: 'Flair',
            run() {
              if (U.chance(0.5)) return E({ card: 'yellow', rating: -0.4, rep: 1.2, tone: BAD,
                text: 'He does not appreciate the applause. Yellow. The clip goes viral anyway.' });
              return E({ rep: 1.5, rating: 0.1, tone: NEU, text: 'The cameras catch your slow clap. The internet does the rest.' });
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
              const r = Math.random() - (trait(ctx, 'theatrical') ? 0.18 : 0);
              if (r < 0.42) return E({ penalty: true, rating: 0.7, tone: GOOD, rep: .5,
                text: 'The whistle blows — PENALTY! The defender cannot believe it.' });
              if (r < 0.72) return E({ card: 'yellow', rating: -0.8, rep: -1, tone: BAD,
                text: 'Booked for simulation. The pundits will not let this one go.' });
              return E({ rating: -0.3, tone: NEU, text: 'Waved away. You get up looking sheepish.' });
            } },
          { label: 'Stay up and shoot', hint: 'Honest. Difficult.', tag: 'Integrity',
            run() {
              const p = luck(ctx, odds(eff(ctx, 'shooting'), ctx.keeper + 14, 0.014, 0.34));
              if (U.chance(p)) return E({ goal: true, rating: 2.0, rep: 2, crowd: 14, tone: GOOD, xp: { shooting: .5 },
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
            run() { return E({ assist: true, teamGoal: true, rating: 1.1, morale: 6, trust: 4, rep: .6, tone: GOOD,
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
        sub: U.pick([
          'The ball is loose six yards out with defenders throwing themselves at it.',
          'He parries it straight back out and the ball is sitting there, begging.',
          'It squirms out of his gloves and rolls invitingly across the face of goal.'
        ]),
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
              if (U.chance(p)) return E({ goal: true, rating: 2.4, rep: 3, crowd: 22, tone: GOOD, xp: { shooting: .6 },
                text: 'THIRTY YARDS AND IT FLIES IN! Absolutely unstoppable. Goal of the season contender.' });
              return E({ rating: -0.3, tone: NEU, xp: { shooting: .2 }, text: 'Ambitious, but it clears the bar comfortably.' });
            } },
          { label: 'Chip the keeper from range', hint: 'He is off his line…', tag: 'Audacity',
            run() {
              const p = luck(ctx, 0.14 + (eff(ctx, 'shooting') - 60) * 0.004 + flairBonus(ctx) + (trait(ctx, 'showman') ? .05 : 0));
              if (U.chance(U.clamp(p, .03, .4))) return E({ goal: true, rating: 2.6, rep: 5, crowd: 26, tone: GOOD,
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
            run() { return E({ rep: 2, morale: 3, tone: GOOD, text: 'The pose. The cameras. The merchandise team is already on it.' }); } },
          { label: 'Run to the fans', hint: 'They love you for it.', tag: 'Fans',
            run() {
              if (U.chance(0.25)) return E({ card: 'yellow', rep: 1.5, tone: NEU,
                text: 'You climb the fence into the away end. Worth the booking.' });
              return E({ rep: 1.2, morale: 4, crowd: 8, tone: GOOD, text: 'You disappear into a mass of supporters. Pure joy.' });
            } },
          { label: 'Shirt off', hint: 'Guaranteed yellow, guaranteed poster.', tag: 'Icon',
            run() { return E({ card: 'yellow', rep: 3, morale: 3, tone: NEU,
              text: 'Shirt off, badge in the air. Booked, iconic, and all over social media within 90 seconds.' }); } },
          { label: 'Refuse to celebrate', hint: 'Against a former club? Respect.', tag: 'Class',
            run() { return E({ rep: 0.8, morale: 2, tone: GOOD, text: 'Hands up, head down. The neutrals respect it enormously.' }); } },
          { label: 'Straight back to the halfway line', hint: 'Job is not done.', tag: 'Focus',
            run() { return E({ trust: 3, rating: 0.1, tone: NEU, text: 'You grab the ball and sprint back. Serious business.' }); } }
        ]
      };
    }
  });

  /* ---------- 21. volley at the back post ---------- */
  add({
    id: 'volley', kind: 'shot',
    weight: ctx => isPos(ctx, ATT) ? 2 : isPos(ctx, MID) ? 1 : 0.4,
    build(ctx) {
      return {
        title: 'It drops over your shoulder',
        sub: U.pick([
          'The cross is deep and hangs. You are at the back post with a yard of space.',
          'It loops off a defender and falls out of the sky, six yards out.'
        ]) + weakNote(ctx),
        art: 'ball',
        options: [
          { label: 'First-time volley', hint: 'Meet it sweetly or slice it into the stand.', tag: 'Technique',
            run() {
              let p = odds(eff(ctx, 'shooting') + flairBonus(ctx) * 60, ctx.keeper + 16, 0.015, 0.34);
              if (U.chance(luck(ctx, p))) return E({ goal: true, rating: 2.1, rep: 2, crowd: 16, tone: GOOD,
                xp: { shooting: .6 }, text: 'You catch it perfectly on the volley and it flies in off the underside of the bar!' });
              return E({ rating: -0.4, tone: BAD, xp: { shooting: .2 },
                text: 'You get underneath it and it clears everything. Ambitious.' });
            } },
          { label: 'Chest it down first', hint: 'Take the pace off, then finish.', tag: 'Composure',
            run() {
              const p = luck(ctx, odds((eff(ctx, 'dribbling') + eff(ctx, 'shooting')) / 2, ctx.keeper + 6, 0.015, 0.48));
              if (U.chance(p)) return E({ goal: true, rating: 1.7, crowd: 9, tone: GOOD, xp: { dribbling: .3, shooting: .3 },
                text: 'Chest, bounce, side-foot. Calm as you like.' });
              return E({ rating: -0.5, tone: BAD, text: 'The extra touch invites a block and it is hacked away.' });
            } },
          { label: 'Head it back across', hint: 'Unselfish and awkward for the keeper.', tag: 'Passing',
            run() {
              const p = luck(ctx, odds(eff(ctx, 'passing'), 50, 0.014, 0.46));
              if (U.chance(p)) return E({ assist: true, teamGoal: true, rating: 1.3, tone: GOOD, xp: { passing: .4 },
                text: 'You nod it back across goal and it is bundled over the line. Assist.' });
              return E({ rating: -0.2, tone: NEU, text: 'Nobody gambles on it and the keeper claims.' });
            } }
        ]
      };
    }
  });

  /* ---------- 22. back to goal ---------- */
  add({
    id: 'back_to_goal', kind: 'run',
    weight: ctx => ctx.player.pos === 'ST' ? 2.2 : isPos(ctx, ATT) ? 1 : 0.3,
    build(ctx) {
      return {
        title: 'Back to goal, centre-half tight',
        sub: 'The long ball is coming and you can feel him breathing on your neck.',
        art: 'block',
        options: [
          { label: 'Hold it up', hint: 'Bring the midfield into it.', tag: 'Physical',
            run() {
              const p = luck(ctx, odds(eff(ctx, 'physical'), ctx.defender + 2, 0.015, 0.55));
              if (U.chance(p)) return E({ rating: 0.7, tone: GOOD, xp: { physical: .45 },
                assist: U.chance(.35), teamGoal: U.chance(.35),
                text: 'You back into him, hold him off and lay it into midfield. The whole team moves up.' });
              return E({ rating: -0.4, fitness: -2, tone: BAD, text: 'He nicks it round you and the move dies.' });
            } },
          { label: 'Spin him', hint: 'One touch and you are away.', tag: 'Dribbling',
            run() {
              let p = odds(eff(ctx, 'dribbling'), ctx.defender + 8, 0.016, 0.45) + flairBonus(ctx);
              if (U.chance(luck(ctx, p))) return E({ rating: 1.2, crowd: 9, tone: GOOD, xp: { dribbling: .5 },
                goal: U.chance(.4), text: 'You roll him on the half-turn and suddenly you are running at the back four.' });
              return E({ rating: -0.5, tone: BAD, text: 'He reads the spin and stands you up. Foul given against you.' });
            } },
          { label: 'Flick it round the corner', hint: 'First time, into the channel.', tag: 'Flair',
            run() {
              let p = odds(eff(ctx, 'passing'), 52, 0.014, 0.44) + flairBonus(ctx) * 1.2;
              if (U.chance(luck(ctx, p))) return E({ assist: U.chance(.55), teamGoal: U.chance(.55), rating: 1.1,
                tone: GOOD, xp: { passing: .45 }, text: 'A clever flick round the corner and the winger is in behind!' });
              return E({ rating: -0.3, tone: NEU, text: 'The flick runs through to the keeper.' });
            } },
          { label: 'Win the foul', hint: 'Draw the contact, kill the pressure.', tag: 'Streetwise',
            run() {
              if (U.chance(0.6)) return E({ rating: 0.4, tone: NEU,
                text: 'You lean in, he leans back, the whistle goes. A breather and forty yards of territory.' });
              return E({ rating: -0.3, card: U.chance(.2) ? 'yellow' : null, tone: BAD,
                text: 'The referee gives it the other way and books you for the elbow.' });
            } }
        ]
      };
    }
  });

  /* ---------- 23. tight angle on the byline ---------- */
  add({
    id: 'tight_angle', kind: 'shot',
    weight: ctx => isPos(ctx, ATT) ? 1.6 : 0.4,
    build(ctx) {
      return {
        title: 'Tight angle by the byline',
        sub: 'You have got there first, but the angle is almost impossible and bodies are pouring back.',
        art: 'net',
        options: [
          { label: 'Smash it at the near post', hint: 'Keepers hate it. So do managers.', tag: 'Audacity',
            run() {
              const p = luck(ctx, odds(eff(ctx, 'shooting'), ctx.keeper + 24, 0.014, 0.26));
              if (U.chance(p)) return E({ goal: true, rating: 2.2, rep: 2.5, crowd: 17, tone: GOOD,
                xp: { shooting: .5 }, text: 'Straight through the keeper at his near post. He will not sleep tonight.' });
              if (U.chance(.4)) return E({ rating: 0.1, tone: NEU, text: 'Blocked behind. Corner.' });
              return E({ rating: -0.5, tone: BAD, text: 'Into the side netting. The crowd groans at the selfishness.' });
            } },
          { label: 'Cut it back', hint: 'Someone is arriving.', tag: 'Passing',
            run() {
              const p = luck(ctx, odds(eff(ctx, 'passing'), ctx.defender, 0.015, 0.56));
              if (U.chance(p)) return E({ assist: U.chance(.7), teamGoal: true, rating: 1.4, trust: 2, tone: GOOD,
                xp: { passing: .5 }, text: 'You pull it back into the danger zone and it is swept in first time.' });
              return E({ rating: -0.4, tone: BAD, text: 'The cutback hits the first defender.' });
            } },
          { label: 'Win a corner off him', hint: 'Nothing on. Take the set piece.', tag: 'Streetwise',
            run() {
              if (U.chance(luck(ctx, 0.65))) return E({ rating: 0.3, tone: NEU,
                text: 'You bounce it off his shins and out. Corner, and a chance to reset.' });
              return E({ rating: -0.2, tone: NEU, text: 'He shepherds it out for a goal kick. Smart defending.' });
            } }
        ]
      };
    }
  });

  /* ---------- 24. one-two on the edge ---------- */
  add({
    id: 'wall_pass', kind: 'run',
    weight: ctx => isPos(ctx, ATT) || isPos(ctx, MID) ? 1.7 : 0.3,
    build(ctx) {
      return {
        title: 'Their line has stepped up',
        sub: 'You are on the edge with your back to the defender and a team-mate short for the return.',
        art: 'passing',
        options: [
          { label: 'Play the one-two', hint: 'Give it, spin, take the return.', tag: 'Passing',
            run() {
              const p = luck(ctx, odds(eff(ctx, 'passing'), ctx.defender + 6, 0.015, 0.5));
              if (U.chance(p)) {
                if (U.chance(0.5)) return E({ goal: true, rating: 2.0, crowd: 13, tone: GOOD, xp: { passing: .4, shooting: .3 },
                  text: 'Give and go, straight through the middle of them, finished first time. Beautiful football.' });
                return E({ penalty: true, rating: 0.9, tone: GOOD, xp: { passing: .4 },
                  text: 'The return puts you clean through and he can only bring you down. Penalty!' });
              }
              return E({ rating: -0.4, tone: BAD, text: 'The return ball is heavy and the move breaks down.' });
            } },
          { label: 'Turn and drive at them', hint: 'Run at the retreating line.', tag: 'Dribbling',
            run() {
              const p = luck(ctx, odds(eff(ctx, 'dribbling'), ctx.defender + 4, 0.016, 0.48));
              if (U.chance(p)) return E({ rating: 1.0, crowd: 7, fitness: -2, tone: GOOD, xp: { dribbling: .5 },
                goal: U.chance(.35), text: 'You turn into space and drive right at the heart of them. Panic everywhere.' });
              return E({ rating: -0.4, fitness: -2, tone: BAD, text: 'Crowded out by three of them.' });
            } },
          { label: 'Spread it wide', hint: 'Switch the point of attack.', tag: 'Safe',
            run() { return E({ rating: 0.25, tone: NEU, xp: { passing: .25 },
              text: 'You clip it out to the overlap. The attack keeps its shape.' }); } }
        ]
      };
    }
  });

  /* ---------- 25. overhead kick ---------- */
  add({
    id: 'bicycle', kind: 'shot',
    weight: ctx => isPos(ctx, ATT) ? 0.9 : 0.2,
    build(ctx) {
      return {
        title: 'It comes in behind you',
        sub: 'Too high to head, too good to waste, and you have half a second to decide.',
        art: 'flair',
        options: [
          { label: 'Overhead kick', hint: 'The one they show forever.', tag: 'Icon',
            run() {
              let p = 0.13 + (eff(ctx, 'shooting') - 62) * 0.004 + flairBonus(ctx) * 2
                + (trait(ctx, 'showman') ? .06 : 0);
              if (U.chance(luck(ctx, U.clamp(p, .04, .42)))) return E({ goal: true, rating: 2.8, rep: 6, crowd: 30,
                tone: GOOD, xp: { shooting: .7, flair: .8 },
                text: 'OVERHEAD KICK — AND IT IS IN! Nobody in this stadium will ever forget that.' });
              if (U.chance(.2)) return E({ rating: -0.4, injuryRisk: .1, tone: BAD,
                text: 'You catch nothing but air and land flat on your back. Everything hurts.' });
              return E({ rating: -0.3, tone: NEU, xp: { flair: .3 },
                text: 'A glorious attempt, four rows back. Worth it for the noise alone.' });
            } },
          { label: 'Chest it down and turn', hint: 'Sensible. Still dangerous.', tag: 'Composure',
            run() {
              const p = luck(ctx, odds(eff(ctx, 'dribbling'), ctx.defender + 6, 0.015, 0.47));
              if (U.chance(p)) return E({ rating: 0.9, tone: GOOD, xp: { dribbling: .4 },
                goal: U.chance(.35), text: 'Chest, turn, and you are facing goal with the ball under control.' });
              return E({ rating: -0.3, tone: BAD, text: 'The defender is all over you before it drops.' });
            } },
          { label: 'Leave it for the winger', hint: 'Dummy and let it run.', tag: 'Smart',
            run() {
              if (U.chance(luck(ctx, 0.45))) return E({ assist: U.chance(.5), teamGoal: true, rating: 0.9, tone: GOOD,
                text: 'You step over it, the winger runs on, and it is in the net. The dummy made the goal.' });
              return E({ rating: -0.1, tone: NEU, text: 'The dummy fools your own team-mate as well. Out for a throw.' });
            } }
        ]
      };
    }
  });

  /* ---------- 26. the last minute ---------- */
  add({
    id: 'last_minute', kind: 'shot',
    weight: ctx => ctx.minute >= 80 ? 2.2 : 0,
    build(ctx) {
      const level = ctx.losing ? 'You are behind.' : 'It is level.';
      return {
        title: 'Ninety-first minute',
        sub: `${level} The ball breaks to you on the edge of their box and the whole ground is on its feet.`,
        art: 'clock',
        options: [
          { label: 'Hit it first time', hint: 'No time to think.', tag: 'Nerve',
            run() {
              let p = odds(eff(ctx, 'shooting'), ctx.keeper + 18, 0.015, 0.33);
              if (trait(ctx, 'ice')) p += 0.08;
              if (U.chance(luck(ctx, p))) return E({ goal: true, rating: 2.5, rep: 4, crowd: 28, morale: 10, tone: GOOD,
                xp: { shooting: .6 }, text: 'LAST KICK OF THE GAME AND YOU HAVE WON IT! Absolute bedlam.' });
              return E({ rating: -0.6, tone: BAD, text: 'You snatch at it and drag it wide. The final whistle goes seconds later.' });
            } },
          { label: 'Take one touch', hint: 'Buy the half-yard you need.', tag: 'Composure',
            run() {
              const p = luck(ctx, odds((eff(ctx, 'dribbling') + eff(ctx, 'shooting')) / 2, ctx.keeper + 22, 0.015, 0.3));
              if (U.chance(p)) return E({ goal: true, rating: 2.6, rep: 4, crowd: 28, morale: 10, tone: GOOD,
                xp: { dribbling: .4, shooting: .4 }, text: 'One touch to set, one to finish, and the stadium comes apart at the seams.' });
              return E({ rating: -0.7, tone: BAD, text: 'The touch is heavy and the block comes in. Full time.' });
            } },
          { label: 'Square it to the better position', hint: 'The unselfish call, with everything on it.', tag: 'Team Player',
            run() {
              const p = luck(ctx, odds(eff(ctx, 'passing'), 46, 0.015, 0.55));
              if (U.chance(p)) return E({ assist: true, teamGoal: true, rating: 1.8, trust: 5, morale: 8, tone: GOOD,
                xp: { passing: .5 }, text: 'You give it to the man in the better position and he does not miss. Ice cold decision.' });
              return E({ rating: -0.9, morale: -6, tone: BAD, text: 'Intercepted. You will be asked about that one all week.' });
            } }
        ]
      };
    }
  });

  /* ---------- 27. keeper comes and misses ---------- */
  add({
    id: 'keeper_rush', kind: 'shot',
    weight: ctx => isPos(ctx, ATT) || isPos(ctx, MID) ? 1.1 : 0.3,
    build(ctx) {
      return {
        title: 'The keeper is stranded',
        sub: 'He came for a cross, got nowhere near it, and the ball has dropped to you 30 yards out with an empty net.',
        art: 'net',
        options: [
          { label: 'Hit it first time into the empty net', hint: 'Do not think. Just hit it.', tag: 'Instinct',
            run() {
              const p = luck(ctx, odds(eff(ctx, 'shooting'), 48, 0.015, 0.55));
              if (U.chance(p)) return E({ goal: true, rating: 2.3, rep: 3, crowd: 20, tone: GOOD, xp: { shooting: .5 },
                text: 'Into the empty net from thirty yards! One for the compilation videos.' });
              return E({ rating: -0.8, tone: BAD, text: 'You lean back and put it over. From thirty yards. Into an empty net.' });
            } },
          { label: 'Take a touch and walk it in', hint: 'Make sure. Let them get back.', tag: 'Composure',
            run() {
              const p = luck(ctx, odds(eff(ctx, 'dribbling'), 56, 0.015, 0.5));
              if (U.chance(p)) return E({ goal: true, rating: 2.0, crowd: 15, tone: GOOD, xp: { dribbling: .4 },
                text: 'You carry it in and roll it over the line as the defender slides past. Cruel and lovely.' });
              return E({ rating: -0.7, tone: BAD, text: 'The recovering defender gets back and hooks it off the line. You had the net at your mercy.' });
            } }
        ]
      };
    }
  });

  /* ---------- 28. switching play ---------- */
  add({
    id: 'switch_play', kind: 'run',
    weight: ctx => isPos(ctx, MID) ? 1.9 : isPos(ctx, DEF) ? 1.2 : 0.4,
    build(ctx) {
      return {
        title: 'Time on the ball',
        sub: 'Nobody presses you. The whole pitch opens up in front of you and the far winger is screaming for it.',
        art: 'passing',
        options: [
          { label: 'Switch it forty yards', hint: 'Cross-field, first time.', tag: 'Vision',
            run() {
              const p = luck(ctx, odds(eff(ctx, 'passing'), 62, 0.014, 0.44));
              if (U.chance(p)) return E({ rating: 1.2, crowd: 8, tone: GOOD, xp: { passing: .6 },
                assist: U.chance(.4), teamGoal: U.chance(.4),
                text: 'Whipped forty yards onto his instep without breaking stride. The crowd applauds the pass itself.' });
              return E({ rating: -0.5, tone: BAD, text: 'It sails out of play. A cheap way to give it up.' });
            } },
          { label: 'Drive forward yourself', hint: 'Nobody is stopping you.', tag: 'Pace',
            run() {
              const p = luck(ctx, odds(eff(ctx, 'pace'), ctx.defender, 0.015, 0.5));
              if (U.chance(p)) return E({ rating: 0.9, fitness: -3, tone: GOOD, xp: { pace: .3, dribbling: .3 },
                goal: U.chance(.25), text: 'You carry it thirty yards and drag their whole shape out of position.' });
              return E({ rating: -0.3, fitness: -3, tone: NEU, text: 'They close the space and you have to go backwards.' });
            } },
          { label: 'Keep it simple', hint: 'Short, safe, keep the ball.', tag: 'Safe',
            run() { return E({ rating: 0.2, tone: NEU, xp: { passing: .2 },
              text: 'Ten yards to feet. Nothing lost, nothing gained.' }); } }
        ]
      };
    }
  });

  /* ---------- 29. press trigger ---------- */
  add({
    id: 'press_trigger', kind: 'defend',
    weight: ctx => isPos(ctx, MID) || isPos(ctx, ATT) ? 1.5 : 0.5,
    build(ctx) {
      return {
        title: 'Their centre-half is dawdling',
        sub: 'He has taken a heavy touch in his own third. The trigger is there — but your legs are heavy.',
        art: 'counter',
        options: [
          { label: 'Press him', hint: 'Sprint and force the mistake.', tag: 'Work Rate',
            run() {
              const p = luck(ctx, odds(eff(ctx, 'pace') * 0.6 + eff(ctx, 'physical') * 0.4, ctx.defender, 0.016, 0.47));
              if (U.chance(p)) {
                if (U.chance(0.45)) return E({ goal: true, rating: 1.9, fitness: -4, crowd: 14, trust: 4, tone: GOOD,
                  xp: { pace: .4, shooting: .3 }, text: 'You close him down, block the clearance and roll it into the empty net!' });
                return E({ rating: 1.0, fitness: -4, trust: 4, tone: GOOD, xp: { pace: .4 },
                  text: 'You force him into a panicked hoof out of play. The bench is up applauding.' });
              }
              return E({ rating: -0.2, fitness: -5, tone: NEU, xp: { pace: .2 },
                text: 'He plays around you and now you have forty yards to run back. Legs gone.' });
            } },
          { label: 'Hold the shape', hint: 'Stay in the block. Conserve.', tag: 'Discipline',
            run() { return E({ rating: 0.3, fitness: -0.5, trust: 2, tone: NEU, xp: { defending: .25 },
              text: 'You stay on your line of the press. The shape holds and they go nowhere.' }); } },
          { label: 'Signal the press and lead it', hint: 'Take the whole team with you.', tag: 'Leadership',
            run() {
              const p = luck(ctx, 0.42 + (trait(ctx, 'leader') ? .25 : 0));
              if (U.chance(p)) return E({ rating: 1.1, fitness: -5, teamBoost: 5, trust: 5, crowd: 10, tone: GOOD,
                text: 'Your arm goes up and eleven players go with you. They cannot get out of their own half for ten minutes.' });
              return E({ rating: -0.4, fitness: -5, tone: BAD,
                text: 'You go, nobody follows, and they play straight through where you used to be standing.' });
            } }
        ]
      };
    }
  });

  /* ---------- 30. midfield 50/50 ---------- */
  add({
    id: 'fifty_fifty', kind: 'defend',
    weight: ctx => isPos(ctx, MID) ? 1.8 : isPos(ctx, DEF) ? 1.2 : 0.5,
    build(ctx) {
      return {
        title: 'A fifty-fifty in the middle',
        sub: U.pick([
          'The ball is sitting up between you and their midfielder. Neither of you is pulling out.',
          'Both of you arrive at the same time. This is going to hurt somebody.'
        ]),
        art: 'block',
        options: [
          { label: 'Go through him', hint: 'Set the tone for the whole match.', tag: 'Physical',
            run() {
              const p = luck(ctx, odds(eff(ctx, 'physical') + (trait(ctx, 'tank') ? 9 : 0), ctx.defender + 4, 0.016, 0.52));
              if (U.chance(p)) return E({ rating: 1.1, crowd: 11, teamBoost: 3, tone: GOOD, xp: { physical: .5, defending: .3 },
                text: 'You win it clean and he stays down. The crowd roars and your bench is on its feet.' });
              if (U.chance(trait(ctx, 'hothead') ? .5 : .35)) return E({ rating: -0.9, card: 'yellow', tone: BAD, injuryRisk: .08,
                text: 'You are late and you know it. Booked, and your ankle is ringing.' });
              return E({ rating: -0.5, tone: BAD, text: 'He gets there first and you end up on the floor.' });
            } },
          { label: 'Get your body across', hint: 'Win the position, not the tackle.', tag: 'Technique',
            run() {
              const p = luck(ctx, odds(eff(ctx, 'defending'), ctx.defender, 0.015, 0.55));
              if (U.chance(p)) return E({ rating: 0.9, tone: GOOD, xp: { defending: .5 },
                text: 'You get across him, shield it, and come away with the ball. Textbook.' });
              return E({ rating: -0.4, tone: BAD, text: 'He rolls you and drives into the space you left.' });
            } },
          { label: 'Pull out of it', hint: 'Nobody gets hurt. Nobody wins it.', tag: 'Safe',
            run() { return E({ rating: -0.2, trust: -2, tone: NEU,
              text: 'You take your foot out. He collects it, and the manager saw exactly what happened.' }); } }
        ]
      };
    }
  });

  /* ---------- 31. quick free kick ---------- */
  add({
    id: 'quick_free', kind: 'set',
    weight: ctx => isPos(ctx, MID) || isPos(ctx, ATT) ? 1.2 : 0.4,
    build(ctx) {
      return {
        title: 'Free kick in a dangerous area',
        sub: 'Their defence has switched off completely and nobody has picked up the runner.',
        art: 'whistle',
        options: [
          { label: 'Take it quickly', hint: 'They are not ready. Punish them.', tag: 'Streetwise',
            run() {
              const p = luck(ctx, odds(eff(ctx, 'passing'), 44, 0.015, 0.58));
              if (U.chance(p)) return E({ assist: U.chance(.7), teamGoal: true, rating: 1.5, crowd: 12, tone: GOOD,
                xp: { passing: .5 }, text: 'Played before anyone blinks — and it is in! The defenders are still arguing with the referee.' });
              return E({ rating: -0.3, tone: BAD, text: 'The referee calls it back for the wall. Opportunity gone.' });
            } },
          { label: 'Wait for the wall and shoot', hint: 'Do it properly.', tag: 'Technique',
            run() {
              let p = odds(eff(ctx, 'shooting') + (trait(ctx, 'wizard') ? 12 : 0), ctx.keeper + 26, 0.014, 0.29);
              if (U.chance(luck(ctx, p))) return E({ goal: true, rating: 2.2, rep: 2.5, crowd: 18, tone: GOOD,
                xp: { shooting: .6 }, text: 'Up, over, and down into the corner. Perfect technique.' });
              return E({ rating: -0.2, tone: NEU, text: 'Into the wall. They clear their lines.' });
            } },
          { label: 'Get everyone up for it', hint: 'Even the keeper. Load the box.', tag: 'Set Piece',
            run() {
              const p = luck(ctx, odds(eff(ctx, 'passing') + (trait(ctx, 'wizard') ? 8 : 0), 58, 0.013, 0.42));
              if (U.chance(p)) return E({ assist: U.chance(.6), teamGoal: true, rating: 1.3, tone: GOOD, xp: { passing: .4 },
                text: 'Eight bodies in the box and your delivery finds the tallest one of them.' });
              return E({ rating: -0.2, tone: NEU, text: 'Headed clear at the front post.' });
            } }
        ]
      };
    }
  });

  /* ---------- 32. playing out of your own box ---------- */
  add({
    id: 'own_box', kind: 'defend',
    weight: ctx => isPos(ctx, DEF) ? 2 : isPos(ctx, MID) ? 1 : 0.2,
    build(ctx) {
      return {
        title: 'The ball comes to you in your own box',
        sub: 'Their striker is five yards away and closing. The keeper is screaming for it. So is the crowd.',
        art: 'block',
        options: [
          { label: 'Play out through the press', hint: 'Trust your feet.', tag: 'Composure',
            run() {
              const p = luck(ctx, odds((eff(ctx, 'passing') + eff(ctx, 'dribbling')) / 2, ctx.attackerRating + 8, 0.016, 0.48));
              if (U.chance(p)) return E({ rating: 1.1, crowd: 8, tone: GOOD, xp: { passing: .5, dribbling: .3 },
                text: 'One touch out of the pressure, one pass through the line. The away end is silenced.' });
              return E({ rating: -1.6, concede: U.chance(.6), tone: BAD,
                text: 'He nicks it off your toe six yards out. Catastrophic.' });
            } },
          { label: 'Row Z', hint: 'Ugly. Effective. Nobody ever got sacked for it.', tag: 'Safe',
            run() { return E({ rating: 0.2, tone: NEU, xp: { defending: .2 },
              text: 'You launch it into the second tier. Not pretty, but the danger is over.' }); } },
          { label: 'Roll it back to the keeper', hint: 'Let him deal with it.', tag: 'Simple',
            run() {
              const p = luck(ctx, odds(eff(ctx, 'passing'), 40, 0.015, 0.7));
              if (U.chance(p)) return E({ rating: 0.4, tone: NEU, text: 'Weighted perfectly. The keeper clears it long.' });
              return E({ rating: -1.8, concede: U.chance(.7), tone: BAD,
                text: 'You underhit it. The striker gets there first. You cannot watch.' });
            } }
        ]
      };
    }
  });

  /* ---------- 33. offside trap ---------- */
  add({
    id: 'offside_trap', kind: 'defend',
    weight: ctx => isPos(ctx, ['CB', 'LB', 'RB']) ? 1.6 : 0.2,
    build(ctx) {
      return {
        title: 'Their striker is on the shoulder',
        sub: 'The pass is being lined up. The back four are looking at you to make the call.',
        art: 'defending',
        options: [
          { label: 'Step up and spring the trap', hint: 'Brave. Requires everyone to move.', tag: 'Leadership',
            run() {
              const p = luck(ctx, odds(eff(ctx, 'defending') + (trait(ctx, 'leader') ? 8 : 0), ctx.attackerRating, 0.016, 0.5));
              if (U.chance(p)) return E({ rating: 1.2, crowd: 9, tone: GOOD, xp: { defending: .6 },
                text: 'Four arms go up as one and the flag follows. Perfectly drilled.' });
              return E({ rating: -1.3, concede: U.chance(.7), tone: BAD,
                text: 'One of them steps late and the trap fails completely. He is through on goal.' });
            } },
          { label: 'Drop and stay goal-side', hint: 'No risk. Give him the ball in front of you.', tag: 'Safe',
            run() {
              const p = luck(ctx, odds(eff(ctx, 'pace'), ctx.attackerRating, 0.015, 0.55));
              if (U.chance(p)) return E({ rating: 0.6, tone: GOOD, xp: { defending: .3 },
                text: 'You drop, he takes it to feet, and you show him onto his weaker side. Nothing comes of it.' });
              return E({ rating: -0.6, concede: U.chance(.4), tone: BAD, text: 'Dropping invites them on, and they come.' });
            } },
          { label: 'Go with him, man to man', hint: 'Your pace against his.', tag: 'Pace',
            run() {
              const p = luck(ctx, odds(eff(ctx, 'pace'), ctx.attackerRating + 5, 0.017, 0.48));
              if (U.chance(p)) return E({ rating: 1.0, fitness: -3, tone: GOOD, xp: { pace: .5 },
                text: 'You match him stride for stride and nick it away at the last moment.' });
              return E({ rating: -1.0, concede: U.chance(.6), fitness: -3, tone: BAD, text: 'He is simply quicker than you. It happens.' });
            } }
        ]
      };
    }
  });

  /* ---------- 34. protecting a lead ---------- */
  add({
    id: 'protect_lead', kind: 'defend',
    weight: ctx => (!ctx.losing && ctx.minute >= 78) ? 1.8 : 0,
    build(ctx) {
      return {
        title: 'Eighty-eighth minute, holding on',
        sub: 'You are in front and they have thrown everyone forward. The ball is at your feet in the corner.',
        art: 'clock',
        options: [
          { label: 'Take it to the corner flag', hint: 'Kill every second.', tag: 'Streetwise',
            run() {
              const p = luck(ctx, odds(eff(ctx, 'physical'), ctx.defender, 0.015, 0.6));
              if (U.chance(p)) return E({ rating: 0.9, trust: 5, tone: GOOD, xp: { physical: .3 },
                text: 'Down by the flag, arms out, back in. They cannot get near it and the clock runs down.' });
              return E({ rating: -0.4, card: U.chance(.25) ? 'yellow' : null, tone: BAD,
                text: 'He nips in front of you and wins it back. The crowd turns instantly.' });
            } },
          { label: 'Keep playing properly', hint: 'Score again and end it.', tag: 'Brave',
            run() {
              if (U.chance(luck(ctx, 0.4))) return E({ goal: U.chance(.4), teamGoal: true, rating: 1.4, crowd: 12, tone: GOOD,
                text: 'You keep the ball moving forward and the second goal finishes the game off completely.' });
              return E({ rating: -0.5, concede: U.chance(.35), tone: BAD,
                text: 'You give it away in a dangerous area and suddenly they are level again. Wasteful.' });
            } },
          { label: 'Go down with cramp', hint: 'Every professional has done it.', tag: 'Dark Arts',
            run() {
              if (U.chance(0.7)) return E({ rating: 0.2, trust: 3, tone: NEU,
                text: 'Ninety seconds of physio, ninety seconds off the clock. Their manager is apoplectic.' });
              return E({ rating: -0.3, card: 'yellow', tone: BAD,
                text: 'The referee has seen it a hundred times. Booked for time-wasting.' });
            } }
        ]
      };
    }
  });

  /* ---------- 35. man-marking job ---------- */
  add({
    id: 'man_mark', kind: 'defend',
    weight: ctx => isPos(ctx, DEF) || ctx.player.pos === 'CDM' ? 1.4 : 0.2,
    build(ctx) {
      return {
        title: 'You have got their best player',
        sub: 'The manager has given you one job today: he does not get a kick.',
        art: 'manager',
        options: [
          { label: 'Follow him everywhere', hint: 'Into the dugout if you have to.', tag: 'Discipline',
            run() {
              const p = luck(ctx, odds(eff(ctx, 'defending'), ctx.attackerRating + 6, 0.015, 0.48));
              if (U.chance(p)) return E({ rating: 1.4, trust: 8, fitness: -5, tone: GOOD, xp: { defending: .6 },
                text: 'He touches it eleven times all half and every one is going backwards. The job is done.' });
              return E({ rating: -0.6, fitness: -5, tone: BAD,
                text: 'He drifts, you follow, and the space you leave gets used again and again.' });
            } },
          { label: 'Rough him up early', hint: 'Let him know you are there.', tag: 'Dark Arts',
            run() {
              if (U.chance(trait(ctx, 'hothead') ? 0.45 : 0.3)) return E({ rating: -0.7, card: 'yellow', tone: BAD,
                text: 'Booked inside ten minutes — and now he knows he can run at you all afternoon.' });
              return E({ rating: 1.0, tone: GOOD, xp: { physical: .4 }, crowd: 7,
                text: 'One firm early challenge and he spends the rest of the game looking for you instead of the ball.' });
            } },
          { label: 'Play the ball, not the man', hint: 'Trust your reading of the game.', tag: 'Positioning',
            run() {
              const p = luck(ctx, odds(eff(ctx, 'defending'), ctx.attackerRating, 0.015, 0.5));
              if (U.chance(p)) return E({ rating: 1.1, tone: GOOD, xp: { defending: .5 },
                text: 'You read every pass into him and intercept three of them. Nobody notices, except the analysts.' });
              return E({ rating: -0.5, concede: U.chance(.3), tone: BAD, text: 'He finds a pocket you never saw and hurts you from it.' });
            } }
        ]
      };
    }
  });

  /* ---------- 36. goalkeeper distribution ---------- */
  add({
    id: 'gk_distribution', kind: 'gk',
    weight: ctx => ctx.player.pos === 'GK' ? 1.8 : 0,
    build(ctx) {
      return {
        title: 'You have got the ball in your hands',
        sub: 'They have pushed right up. Your full-backs are showing, and your striker is pointing over the top.',
        art: 'keeper',
        options: [
          { label: 'Roll it to the full-back', hint: 'Play out. Invite them on.', tag: 'Composure',
            run() {
              const p = luck(ctx, odds(eff(ctx, 'passing'), 50, 0.015, 0.55));
              if (U.chance(p)) return E({ rating: 0.7, tone: GOOD, xp: { passing: .5 },
                text: 'You break the press with one roll and the whole team is out. That is modern goalkeeping.' });
              return E({ rating: -1.2, concede: U.chance(.45), tone: BAD,
                text: 'Straight into trouble. He is robbed twenty yards from your goal.' });
            } },
          { label: 'Launch it', hint: 'Halfway line, let them fight for it.', tag: 'Safe',
            run() {
              if (U.chance(luck(ctx, 0.5))) return E({ rating: 0.3, tone: NEU, xp: { physical: .2 },
                text: 'Sixty yards, contested, headed on. Territory won, possession lost.' });
              return E({ rating: 0, tone: NEU, text: 'Straight to their centre-half. Here they come again.' });
            } },
          { label: 'Throw it long over the press', hint: 'Pick out the run behind.', tag: 'Vision',
            run() {
              const p = luck(ctx, odds(eff(ctx, 'passing'), 62, 0.014, 0.42));
              if (U.chance(p)) return E({ assist: U.chance(.45), teamGoal: U.chance(.45), rating: 1.2, crowd: 10, tone: GOOD,
                xp: { passing: .6 }, text: 'A seventy-yard throw right into his stride and you have an assist from your own box!' });
              return E({ rating: -0.2, tone: NEU, text: 'Overcooked. Straight through to their keeper.' });
            } }
        ]
      };
    }
  });

  /* ---------- 37. goalkeeper facing a penalty ---------- */
  add({
    id: 'gk_penalty', kind: 'gk',
    weight: ctx => ctx.player.pos === 'GK' ? 0.9 : 0,
    build(ctx) {
      return {
        title: 'Penalty against you',
        sub: 'He places the ball and will not look at you. You have about twenty seconds to get inside his head.',
        art: 'penalty',
        options: [
          { label: 'Study his run-up and react', hint: 'Reflexes over guesswork.', tag: 'Goalkeeping',
            run() {
              const p = luck(ctx, U.clamp(0.16 + (eff(ctx, 'gk') - 60) * 0.005, 0.06, 0.45));
              if (U.chance(p)) return E({ save: true, rating: 2.2, crowd: 20, tone: GOOD, xp: { gk: .7 },
                text: 'You wait, wait, and fling out a hand. SAVED! The place erupts.' });
              return E({ concede: true, rating: -0.2, tone: BAD, text: 'He picks his corner and you never had a chance.' });
            } },
          { label: 'Dive early and commit', hint: 'Guess. Cover more ground.', tag: 'Instinct',
            run() {
              const p = luck(ctx, U.clamp(0.24 + (eff(ctx, 'gk') - 65) * 0.003, 0.08, 0.42));
              if (U.chance(p)) return E({ save: true, rating: 2.0, crowd: 18, tone: GOOD, xp: { gk: .6 },
                text: 'You go early, guess right, and push it round the post!' });
              return E({ concede: true, rating: -0.3, tone: BAD, text: 'Wrong way. He rolled it down the middle.' });
            } },
          { label: 'Play mind games on the line', hint: 'Point at a corner. Take your time.', tag: 'Dark Arts',
            run() {
              const p = luck(ctx, 0.2 + flairBonus(ctx));
              if (U.chance(p)) return E({ save: true, rating: 2.1, rep: 2, crowd: 19, tone: GOOD, xp: { gk: .6 },
                text: 'You point to his left, grin, and he puts it exactly there. Saved, and completely humiliated.' });
              if (U.chance(0.2)) return E({ concede: true, card: 'yellow', rating: -0.6, tone: BAD,
                text: 'The referee books you for delaying it — and then he buries the penalty anyway.' });
              return E({ concede: true, rating: -0.2, tone: BAD, text: 'He ignores you completely and scores. Worth a try.' });
            } }
        ]
      };
    }
  });

  /* ---------- 38. goalkeeper as sweeper ---------- */
  add({
    id: 'gk_sweeper', kind: 'gk',
    weight: ctx => ctx.player.pos === 'GK' ? 1.5 : 0,
    build(ctx) {
      return {
        title: 'Ball over the top, you are off your line',
        sub: 'The through ball is running into no-man\'s land and their striker is favourite to get there.',
        art: 'save',
        options: [
          { label: 'Sprint out and head it clear', hint: 'Outside the box. No hands.', tag: 'Bravery',
            run() {
              const p = luck(ctx, odds(eff(ctx, 'pace') * 0.5 + eff(ctx, 'gk') * 0.5, ctx.attackerRating + 6, 0.016, 0.48));
              if (U.chance(p)) return E({ save: true, rating: 1.5, crowd: 12, tone: GOOD, xp: { gk: .5, pace: .3 },
                text: 'Thirty yards out, up like a centre-half, and you head it into the stand. Enormous.' });
              return E({ concede: U.chance(.65), rating: -1.3, tone: BAD,
                text: 'You misjudge the bounce completely and he lobs it into the empty net.' });
            } },
          { label: 'Slide and take everything', hint: 'Ball, man, whatever arrives.', tag: 'Commitment',
            run() {
              const p = luck(ctx, odds(eff(ctx, 'gk'), ctx.attackerRating + 10, 0.016, 0.45));
              if (U.chance(p)) return E({ save: true, rating: 1.4, tone: GOOD, xp: { gk: .5 },
                text: 'You get there first and slide it away for a throw. Heart-in-mouth stuff, but it worked.' });
              if (U.chance(.4)) return E({ concede: false, card: 'red', rating: -2.0, tone: BAD,
                text: 'You take the man, outside the box, denying a clear chance. Red card. Nothing to argue about.' });
              return E({ concede: true, rating: -1.0, tone: BAD, text: 'He goes round you and rolls it in.' });
            } },
          { label: 'Retreat and set yourself', hint: 'Back to the line, make the angle.', tag: 'Positioning',
            run() {
              const p = luck(ctx, odds(eff(ctx, 'gk'), ctx.attackerRating + 2, 0.015, 0.47));
              if (U.chance(p)) return E({ save: true, rating: 1.2, tone: GOOD, xp: { gk: .5 },
                text: 'You backpedal, get set, and block the shot with your legs. Good, boring goalkeeping.' });
              return E({ concede: true, rating: -0.6, tone: BAD, text: 'He takes a touch and finishes past you.' });
            } }
        ]
      };
    }
  });

  /* ---------- 39. being substituted ---------- */
  add({
    id: 'subbed_off', kind: 'social',
    weight: ctx => ctx.minute >= 60 ? 1.1 : 0,
    build(ctx) {
      return {
        title: 'Your number is up',
        sub: `The fourth official holds up your number on ${ctx.minute} minutes. You did not expect it.`,
        art: 'sub',
        options: [
          { label: 'Applaud the fans on the way off', hint: 'Professional to the last.', tag: 'Class',
            run() { return E({ rating: 0.2, trust: 4, rep: 0.5, subbed: true, tone: GOOD,
              text: 'You clap all four sides and shake the manager\'s hand. The stadium gives you an ovation.' }); } },
          { label: 'Walk off slowly', hint: 'Make them wait. Make your point.', tag: 'Petty',
            run() { return E({ rating: 0, trust: -6, subbed: true, tone: NEU,
              text: 'The longest walk in football, and everyone in the ground understands exactly what it means.' }); } },
          { label: 'Refuse to come off', hint: 'Wave him away. Consequences guaranteed.', tag: 'Ego',
            run() {
              if (U.chance(0.35)) return E({ rating: 0.4, trust: -14, morale: 6, tone: BAD,
                text: 'You wave him away and stay on. You win the argument, and lose the manager.' });
              return E({ rating: -0.3, trust: -18, morale: -6, subbed: true, tone: BAD,
                text: 'You gesture at the bench, then come off anyway. It looks worse than doing either one properly.' });
            } }
        ]
      };
    }
  });

  /* ---------- 40. a team-mate goes down ---------- */
  add({
    id: 'teammate_down', kind: 'social',
    weight: () => 0.8,
    build(ctx) {
      return {
        title: 'A team-mate is down and not moving',
        sub: 'It looked bad. The physio is already sprinting on and the ball is still in play.',
        art: 'injury',
        options: [
          { label: 'Put the ball out', hint: 'The game stops. Obviously.', tag: 'Sportsmanship',
            run() { return E({ rating: 0.3, morale: 3, rep: 0.5, tone: GOOD,
              text: 'You hook it into touch without a moment\'s thought. Both sets of fans applaud.' }); } },
          { label: 'Play on — the ref has not stopped it', hint: 'Cold. Legal.', tag: 'Ruthless',
            run() {
              if (U.chance(0.45)) return E({ goal: U.chance(.4), teamGoal: true, rating: 0.8, morale: -4, tone: NEU,
                text: 'You play on and score. Nobody celebrates, and their bench is on the pitch screaming at you.' });
              return E({ rating: -0.4, morale: -5, tone: BAD,
                text: 'You play on, lose it anyway, and every single person in the ground boos you for it.' });
            } },
          { label: 'Get to him first', hint: 'Forget the ball.', tag: 'Team-mate',
            run() { return E({ rating: 0.2, morale: 5, trust: 3, tone: GOOD,
              text: 'You are the first one there, holding his head still and shouting for the stretcher. He remembers that.' }); } }
        ]
      };
    }
  });

  /* ---------- 41. hostile crowd ---------- */
  add({
    id: 'hostile_crowd', kind: 'social',
    weight: ctx => ctx.crowdHostile ? 1.1 : 0.2,
    build(ctx) {
      return {
        title: 'The corner of the ground has turned on you',
        sub: `Every touch you take at ${ctx.oppName} is met with a wall of noise, and it is getting personal.`,
        art: 'fans',
        options: [
          { label: 'Feed off it', hint: 'Let it make you play better.', tag: 'Mentality',
            run() {
              const p = luck(ctx, 0.55 + (trait(ctx, 'ice') ? .2 : 0));
              if (U.chance(p)) return E({ rating: 0.8, morale: 5, crowd: 5, tone: GOOD,
                text: 'You demand the ball every single time and start running the game in front of them. They go quiet.' });
              return E({ rating: -0.4, morale: -4, tone: BAD, text: 'You try too hard to prove a point and force everything.' });
            } },
          { label: 'Silence them', hint: 'Score and stand in front of them.', tag: 'Provocation',
            run() {
              if (U.chance(0.35)) return E({ goal: true, rating: 1.8, rep: 3, card: U.chance(.4) ? 'yellow' : null,
                crowd: 8, tone: GOOD, text: 'You score, wheel away to their corner and put a finger to your lips. Absolute chaos.' });
              return E({ rating: -0.3, tone: NEU, text: 'The moment never comes, and they let you know about it all afternoon.' });
            } },
          { label: 'Point it out to the referee', hint: 'Some of it has crossed a line.', tag: 'Right Call',
            run() { return E({ rating: 0.2, rep: 1, tone: NEU,
              text: 'You stop and speak to the referee, who talks to the stewards. It is dealt with properly, and the noise dies down.' }); } }
        ]
      };
    }
  });

  /* ---------- 42. keeper: shot from distance ---------- */
  add({
    id: 'gk_longshot', kind: 'gk',
    weight: ctx => ctx.player.pos === 'GK' ? 1.6 : 0,
    build(ctx) {
      return {
        title: 'Struck from thirty yards',
        sub: U.pick([
          'It is dipping and swerving late through a crowd of bodies.',
          'A clean hit from distance, and you picked it up late through the traffic.'
        ]),
        art: 'save',
        options: [
          { label: 'Catch it clean', hint: 'No rebound, no second chance.', tag: 'Handling',
            run() {
              const p = luck(ctx, odds(eff(ctx, 'gk'), 64, 0.015, 0.5));
              if (U.chance(p)) return E({ save: true, rating: 1.0, tone: GOOD, xp: { gk: .5 },
                text: 'Taken cleanly at the second attempt-free first attempt. Not a flicker of doubt.' });
              return E({ concede: U.chance(.5), rating: -1.1, tone: BAD,
                text: 'It squirms through your hands and over the line. That is on you.' });
            } },
          { label: 'Push it round the post', hint: 'Safety first. Concede the corner.', tag: 'Safe',
            run() {
              const p = luck(ctx, odds(eff(ctx, 'gk'), 56, 0.015, 0.62));
              if (U.chance(p)) return E({ save: true, rating: 0.8, crowd: 6, tone: GOOD, xp: { gk: .4 },
                text: 'Strong wrist, round the post. Corner, and no danger.' });
              return E({ concede: U.chance(.45), rating: -0.8, tone: BAD, text: 'You get a hand to it but only help it in.' });
            } },
          { label: 'Parry it back into play', hint: 'Only if you fancy the follow-up.', tag: 'Risk',
            run() {
              const p = luck(ctx, odds(eff(ctx, 'gk'), 60, 0.015, 0.55));
              if (U.chance(p)) return E({ save: true, rating: 0.6, tone: NEU, xp: { gk: .35 },
                text: 'Parried away, and your centre-half hacks the rebound clear.' });
              return E({ concede: true, rating: -1.0, tone: BAD, text: 'Parried straight to their striker, who cannot miss.' });
            } }
        ]
      };
    }
  });

  /* ---------- 43. keeper: setting the wall ---------- */
  add({
    id: 'gk_wall', kind: 'gk',
    weight: ctx => ctx.player.pos === 'GK' ? 1.3 : 0,
    build(ctx) {
      return {
        title: 'Free kick, twenty yards out',
        sub: 'You are building the wall. Their specialist is standing over it, waiting for you to commit.',
        art: 'wall',
        options: [
          { label: 'Five in the wall, cover your near post', hint: 'Textbook. Trust the wall.', tag: 'Positioning',
            run() {
              const p = luck(ctx, odds(eff(ctx, 'gk'), 58, 0.015, 0.58));
              if (U.chance(p)) return E({ save: true, rating: 0.9, tone: GOOD, xp: { gk: .45 },
                text: 'It comes over the wall exactly where you expected and you claw it away.' });
              return E({ concede: true, rating: -0.5, tone: BAD, text: 'He goes round the outside of the wall. Nothing you could do.' });
            } },
          { label: 'Four in the wall, cheat towards the far side', hint: 'Guess where he is going.', tag: 'Cunning',
            run() {
              const p = luck(ctx, luck(ctx, 0.45 + (eff(ctx, 'gk') - 65) * 0.004));
              if (U.chance(p)) return E({ save: true, rating: 1.5, crowd: 12, tone: GOOD, xp: { gk: .55 },
                text: 'You read him completely, are moving before he strikes it, and turn it round the post. Brilliant.' });
              return E({ concede: true, rating: -0.9, tone: BAD, text: 'He drills it through the gap you left. You cheated and you got punished.' });
            } },
          { label: 'Put a man behind the wall', hint: 'Kill the low one under it.', tag: 'Smart',
            run() {
              if (U.chance(luck(ctx, 0.62))) return E({ save: true, rating: 0.8, tone: GOOD, xp: { gk: .4 },
                text: 'He goes under the wall and your man on the floor blocks it. Prepared for exactly that.' });
              return E({ concede: U.chance(.5), rating: -0.4, tone: NEU, text: 'He clears the wall instead and it flashes just over.' });
            } }
        ]
      };
    }
  });

  /* ---------- 44. keeper: back pass under pressure ---------- */
  add({
    id: 'gk_backpass', kind: 'gk',
    weight: ctx => ctx.player.pos === 'GK' ? 1.5 : 0,
    build(ctx) {
      return {
        title: 'Back pass, striker closing',
        sub: 'It is a poor one — short, bobbling, and their forward has read it from twenty yards away.',
        art: 'keeper',
        options: [
          { label: 'First time, straight down the line', hint: 'Get rid. Immediately.', tag: 'Safe',
            run() {
              const p = luck(ctx, odds(eff(ctx, 'passing'), 46, 0.015, 0.66));
              if (U.chance(p)) return E({ rating: 0.4, tone: NEU, xp: { passing: .3 },
                text: 'Hooked away first time under pressure. Ugly, and completely correct.' });
              return E({ concede: U.chance(.5), rating: -1.4, tone: BAD, text: 'You slice it straight to him and he rolls it into the empty net.' });
            } },
          { label: 'Take a touch round him', hint: 'Ice cold, or a disaster.', tag: 'Audacity',
            run() {
              let p = odds(eff(ctx, 'dribbling'), ctx.attackerRating + 14, 0.016, 0.4) + flairBonus(ctx);
              if (U.chance(luck(ctx, p))) return E({ rating: 1.3, crowd: 12, rep: 1.5, tone: GOOD, xp: { dribbling: .5 },
                text: 'You dummy him inside your own six-yard box and stroll out with it. The bench cannot watch.' });
              return E({ concede: true, rating: -2.0, tone: BAD,
                text: 'He takes it off your toe and taps into an empty net. Unforgivable, and it is all over the highlights.' });
            } },
          { label: 'Concede the corner deliberately', hint: 'Put it behind and reset.', tag: 'Streetwise',
            run() { return E({ rating: 0.2, tone: NEU,
              text: 'You slam it against his shins and out for a corner. Your captain nods at you: right call.' }); } }
        ]
      };
    }
  });

  /* ---------- 45. block the shot ---------- */
  add({
    id: 'block_shot', kind: 'defend',
    weight: ctx => isPos(ctx, DEF) ? 1.7 : isPos(ctx, MID) ? 1 : 0.3,
    build(ctx) {
      return {
        title: 'He is pulling the trigger',
        sub: 'The shot is coming from the edge of your box and you are the closest body to it.',
        art: 'block',
        options: [
          { label: 'Throw yourself in front of it', hint: 'Face, chest, whatever it takes.', tag: 'Bravery',
            run() {
              const p = luck(ctx, odds(eff(ctx, 'defending') + (trait(ctx, 'tank') ? 8 : 0), ctx.attackerRating, 0.016, 0.55));
              if (U.chance(p)) return E({ rating: 1.2, crowd: 12, tone: GOOD, xp: { defending: .5, physical: .3 },
                text: 'You get everything behind it and it cannons away off your chest. The crowd roars like it was a goal.' });
              if (U.chance(.25)) return E({ rating: -0.3, injuryRisk: .12, tone: BAD,
                text: 'It catches you flush and you go down badly. That is going to leave a mark.' });
              return E({ rating: -0.5, concede: U.chance(.4), tone: BAD, text: 'It takes a deflection off you and loops over your keeper.' });
            } },
          { label: 'Close the angle, stay on your feet', hint: 'Make him shoot where you want.', tag: 'Positioning',
            run() {
              const p = luck(ctx, odds(eff(ctx, 'defending'), ctx.attackerRating - 2, 0.015, 0.58));
              if (U.chance(p)) return E({ rating: 0.8, tone: GOOD, xp: { defending: .45 },
                text: 'You show him onto his weaker side and the shot is straight at the keeper.' });
              return E({ rating: -0.4, concede: U.chance(.35), tone: BAD, text: 'He shifts it and finds the corner past you.' });
            } },
          { label: 'Dive out of the way', hint: 'It is going to hurt. Nobody would blame you.', tag: 'Honest',
            run() { return E({ rating: -0.8, trust: -4, concede: U.chance(.5), tone: BAD,
              text: 'You turn your back and it flies through the gap where you were standing. Everyone saw it.' }); } }
        ]
      };
    }
  });

  /* ---------- 46. the recovery run ---------- */
  add({
    id: 'recovery_run', kind: 'defend',
    weight: ctx => isPos(ctx, DEF) || isPos(ctx, MID) ? 1.5 : 0.4,
    build(ctx) {
      return {
        title: 'Sixty yards to make up',
        sub: 'You gave the ball away and now they are running at your defence. You have got one sprint left in you.',
        art: 'counter',
        options: [
          { label: 'Empty the tank chasing back', hint: 'Fix your own mistake.', tag: 'Character',
            run() {
              const p = luck(ctx, odds(eff(ctx, 'pace'), ctx.attackerRating + 4, 0.017, 0.47));
              if (U.chance(p)) return E({ rating: 1.5, fitness: -8, trust: 6, crowd: 14, tone: GOOD,
                xp: { pace: .5, defending: .3 }, text: 'You catch him on the edge of the box and take the ball clean. The whole stadium is on its feet.' });
              return E({ rating: -0.6, fitness: -8, concede: U.chance(.5), tone: BAD,
                text: 'You cannot get there. He finishes it and you are on your knees sixty yards away.' });
            } },
          { label: 'Trust your defenders and hold position', hint: 'Save your legs for the rest.', tag: 'Discipline',
            run() {
              if (U.chance(luck(ctx, 0.5))) return E({ rating: 0.1, tone: NEU, text: 'They deal with it without you. No harm done.' });
              return E({ rating: -0.7, concede: U.chance(.5), trust: -4, tone: BAD,
                text: 'They are short at the back and it costs a goal. The replay shows you jogging.' });
            } },
          { label: 'Take him down from behind', hint: 'Stop it now, take the card.', tag: 'Dark Arts',
            run() {
              const red = U.chance(0.28);
              return E({ rating: red ? -1.6 : 0.1, card: red ? 'red' : 'yellow', trust: red ? -6 : 2,
                fitness: -5, tone: red ? BAD : NEU,
                text: red ? 'Last man, clear chance, cynical. The referee has no choice at all.'
                          : 'You clip his heels and take the booking. The attack is dead and your manager applauds.' });
            } }
        ]
      };
    }
  });

  /* ---------- 47. through his legs ---------- */
  add({
    id: 'nutmeg', kind: 'run',
    weight: ctx => isPos(ctx, ATT) ? 1.6 : isPos(ctx, MID) ? 1.1 : 0.2,
    build(ctx) {
      return {
        title: 'He is square on',
        sub: U.pick([
          `Their defender plants his feet and spreads himself wide. There is daylight between his boots.`,
          `One man to beat and he is backing off, legs open, daring you to try something silly.`,
          `The full-back plants himself like a traffic cone with ambition. His stance is an invitation.`
        ]) + weakNote(ctx),
        art: 'dribbling',
        options: [
          { label: 'Through his legs', hint: 'The nutmeg. Maximum humiliation.', tag: 'Flair',
            run() {
              let p = odds(eff(ctx, 'dribbling'), 52, 0.016, 0.42) + flairBonus(ctx);
              if (trait(ctx, 'showman')) p += 0.08;
              p = luck(ctx, p);
              if (U.chance(p)) return E({ rating: 1.4, rep: 1, crowd: 16, tone: GOOD, xp: { dribbling: .5 },
                text: 'You pop it through his legs and collect on the other side. The crowd\'s "oooh" lasts thirty seconds.' });
              return E({ rating: -0.5, tone: BAD, xp: { dribbling: .2 },
                text: 'He closes the gate and you run straight into his shin. He wags a finger at you.' });
            } },
          { label: 'Knock it past and run', hint: 'Pure pace. No subtlety.', tag: 'Pace',
            run() {
              const p = luck(ctx, odds(eff(ctx, 'pace'), 50, 0.016, 0.5));
              if (U.chance(p)) return E({ rating: 1.1, tone: GOOD, xp: { pace: .4 }, crowd: 8,
                text: 'Ten yards of separation in five strides. He is still turning as you hit the byline.' });
              return E({ rating: -0.4, tone: BAD, xp: { pace: .2 },
                text: 'He matches you stride for stride and shepherds it out for a goal kick.' });
            } },
          { label: 'Lay it back and keep the move going', hint: 'Recycle it. Nothing silly.', tag: 'Smart',
            run() {
              const p = luck(ctx, odds(eff(ctx, 'passing'), 40, 0.014, 0.78));
              if (U.chance(p)) return E({ rating: 0.3, tone: NEU, xp: { passing: .2 },
                text: 'You roll it back and the attack resets. Boring. Correct.' });
              return E({ rating: -0.3, tone: BAD, text: 'The safe pass goes straight down his shin and out for a throw.' });
            } }
        ]
      };
    }
  });

  /* ---------- 48. goal-line clearance ---------- */
  add({
    id: 'goal_line', kind: 'defend',
    weight: ctx => isPos(ctx, DEF) ? 1.5 : isPos(ctx, ['GK']) ? 0 : 0.4,
    build(ctx) {
      return {
        title: 'It is bouncing towards the empty net',
        sub: U.pick([
          `The keeper is stranded, the net is gaping, and the ball is rolling in slow motion towards your line.`,
          `A scramble, a ricochet, and suddenly the only thing between ${ctx.oppName} and a goal is you.`,
          `You are sprinting back as it spins towards the corner of the goal. Nobody else is getting there.`
        ]),
        art: 'defending',
        options: [
          { label: 'Hack it into the stands', hint: 'Safety first. Row Z.', tag: 'Defending',
            run() {
              const p = luck(ctx, odds(eff(ctx, 'defending'), 42, 0.014, 0.8));
              if (U.chance(p)) return E({ rating: 0.9, tone: GOOD, xp: { defending: .4 }, crowd: 10,
                text: 'You leather it into the third row off the line. The keeper claps you all the way back.' });
              return E({ rating: -0.8, concede: true, tone: BAD, xp: { defending: .2 },
                text: 'You slice it horribly and it spins in off the post. An own goal off the goal-line clearance. Agony.' });
            } },
          { label: 'Cushion it back to the keeper', hint: 'Ice in your veins, one yard from your own line.', tag: 'Composure',
            run() {
              let p = odds((eff(ctx, 'passing') + eff(ctx, 'defending')) / 2, 48, 0.015, 0.55);
              if (trait(ctx, 'pressres')) p += 0.08;
              p = luck(ctx, p);
              if (U.chance(p)) return E({ rating: 1.3, rep: 0.5, tone: GOOD, xp: { passing: .4 }, crowd: 12,
                text: 'One yard out, you kill it dead and roll it calmly to your keeper. The away end cannot believe it.' });
              return E({ rating: -0.9, concede: true, tone: BAD,
                text: 'The touch is too cute. It squirms under your boot and over the line. Calamity.' });
            } },
          { label: 'Launch yourself at it', hint: 'Full-length slide, everything on it.', tag: 'Bravery',
            run() {
              const p = luck(ctx, odds(eff(ctx, 'physical'), 50, 0.015, 0.6));
              if (U.chance(p)) return E({ rating: 1.2, tone: GOOD, xp: { physical: .4 }, crowd: 14, injuryRisk: 0.08,
                text: 'You hurl yourself at it and clear off the line by a stud\'s length. The stadium erupts.' });
              return E({ rating: -0.6, tone: BAD, injuryRisk: 0.18,
                text: 'You arrive a boot late and clatter the post instead. The physio is on.' });
            } }
        ]
      };
    }
  });

  /* ---------- 49. the backheel chance ---------- */
  add({
    id: 'backheel', kind: 'shot',
    weight: ctx => isPos(ctx, ATT) ? 1.3 : isPos(ctx, MID) ? 0.5 : 0.1,
    build(ctx) {
      return {
        title: 'It arrives behind you',
        sub: U.pick([
          `The cross is slightly behind your run — a proper finish is impossible, but something cheeky is not.`,
          `It fizzes in at your heels, six yards out. The keeper has not set. Something unorthodox is on.`,
          `The cut-back arrives at your standing leg. Conventional is off the menu.`
        ]),
        art: 'flair',
        options: [
          { label: 'Backheel it', hint: 'The audacious flick. Goal of the month if it lands.', tag: 'Audacity',
            run() {
              let p = odds(eff(ctx, 'shooting') * 0.7 + eff(ctx, 'dribbling') * 0.3, ctx.keeper + 8, 0.016, 0.34) + flairBonus(ctx);
              if (trait(ctx, 'showman')) p += 0.07;
              p = luck(ctx, p);
              if (U.chance(p)) return E({ goal: true, rating: 2, rep: 2, crowd: 18, tone: GOOD, xp: { shooting: .5, flair: .4 },
                text: 'You flick it with your heel, wrong-footing everyone including the cameraman. GOAL — an outrageous one!' });
              return E({ rating: -0.6, tone: BAD, xp: { flair: .2 },
                text: 'Your heel meets mostly air. The ball rolls sadly through to the keeper. The bench looks away.' });
            } },
          { label: 'Step over it and let the runner behind you finish', hint: 'A dummy. Selfless.', tag: 'Vision',
            run() {
              const p = luck(ctx, odds(eff(ctx, 'passing'), 44, 0.015, 0.6));
              if (U.chance(p)) return E({ assist: true, teamGoal: true, rating: 1.3, morale: 3, tone: GOOD, xp: { passing: .4 }, crowd: 9,
                text: 'You step over it completely and the man arriving behind you buries it. The dummy sold everyone.' });
              return E({ rating: -0.4, tone: BAD, xp: { passing: .2 },
                text: 'Nobody reads the dummy. It rolls through everyone and out for a goal kick.' });
            } },
          { label: 'Swivel and scuff it anyway', hint: 'Ugly. Might work.', tag: 'Instinct',
            run() {
              const p = luck(ctx, odds(eff(ctx, 'shooting'), ctx.keeper + 4, 0.014, 0.4));
              if (U.chance(p)) return E({ goal: true, rating: 1.4, tone: GOOD, xp: { shooting: .4 }, crowd: 9,
                text: 'A half-volley off your shin bobbles past the keeper. They all count. GOAL!' });
              return E({ rating: -0.4, tone: BAD, xp: { shooting: .2 },
                text: 'You swipe at it and connect with nothing but night air.' });
            } }
        ]
      };
    }
  });

  /* ---------- 50. the quick throw ---------- */
  add({
    id: 'quick_throw', kind: 'set',
    weight: ctx => isPos(ctx, DEF.concat(MID)) ? 1 : 0.4,
    build(ctx) {
      return {
        title: 'Quick throw?',
        sub: U.pick([
          `The ball is out by the halfway line and ${ctx.oppName} are still walking back. One runner is pointing into space.`,
          `You have the ball in your hands for the throw and their whole left side is empty for three seconds more.`,
          `The winger is screaming for it early. Their defence has not noticed yet.`
        ]),
        art: 'corner',
        options: [
          { label: 'Take it quickly', hint: 'Catch them cold.', tag: 'Vision',
            run() {
              const p = luck(ctx, odds(eff(ctx, 'passing'), 42, 0.015, 0.62));
              if (U.chance(p)) {
                if (U.chance(0.3)) return E({ assist: true, teamGoal: true, rating: 1.4, rep: 0.5, tone: GOOD, xp: { passing: .5 }, crowd: 10,
                  text: 'You hurl it into the channel, the runner is clean through, and he finishes. The throw-in assist. Genius!' });
                return E({ rating: 0.7, tone: GOOD, xp: { passing: .3 },
                  text: 'Quick, flat, into space — you are three on two before they wake up. The move dies at the edge of the box, but the intent is noted.' });
              }
              return E({ rating: -0.4, tone: BAD, xp: { passing: .2 },
                text: 'You rush it and throw it straight to their midfielder. The manager is gesturing at you to calm down.' });
            } },
          { label: 'Wait for the shape', hint: 'Keep the ball. Nothing on yet.', tag: 'Patient',
            run() {
              return E({ rating: 0.2, tone: NEU, xp: { passing: .1 },
                text: 'You wait, find the full-back, and the game restarts in order. The safe choice.' });
            } }
        ]
      };
    }
  });

  /* ---------- 51. the near-post flick ---------- */
  add({
    id: 'flick_on', kind: 'shot',
    weight: ctx => isPos(ctx, ATT) ? 1.2 : isPos(ctx, MID) ? 0.6 : 0.3,
    build(ctx) {
      return {
        title: 'Near-post corner, front man',
        sub: U.pick([
          `The corner is whipped towards the near post and you have lost your marker. First contact is yours.`,
          `It comes in flat and fast to the front stick. You are the one attacking it.`,
          `You spin off the front of the zone and the delivery is heading exactly where you want it.`
        ]),
        art: 'header',
        options: [
          { label: 'Flick it on across goal', hint: 'Glance it towards the far post.', tag: 'Technique',
            run() {
              let p = odds((eff(ctx, 'shooting') + eff(ctx, 'physical')) / 2, ctx.keeper + 4, 0.015, 0.42);
              if (trait(ctx, 'aerial')) p += 0.07;
              p = luck(ctx, p);
              if (U.chance(p)) return E({ goal: true, rating: 1.7, tone: GOOD, xp: { shooting: .45 }, crowd: 12,
                text: 'The merest glance and it arrows inside the far post. The keeper never moved. GOAL!' });
              if (U.chance(0.4)) return E({ assist: true, teamGoal: true, rating: 1.1, tone: GOOD, xp: { shooting: .3 }, crowd: 8,
                text: 'Your flick skims on and your centre-back bundles it in at the back post. They will give you the assist.' });
              return E({ rating: -0.4, tone: BAD, xp: { shooting: .2 },
                text: 'You get too much on it and it flies a yard over the angle. Hands on heads.' });
            } },
          { label: 'Attack it with everything', hint: 'Power through the near post.', tag: 'Physical',
            run() {
              let p = odds(eff(ctx, 'physical') * 0.6 + eff(ctx, 'shooting') * 0.4, ctx.keeper + 6, 0.015, 0.4);
              if (trait(ctx, 'aerial')) p += 0.07;
              p = luck(ctx, p);
              if (U.chance(p)) return E({ goal: true, rating: 1.6, tone: GOOD, xp: { physical: .3, shooting: .3 }, crowd: 12,
                text: 'You bully through two bodies and thump it home at the near stick. The keeper just watches it in. GOAL!' });
              return E({ rating: -0.5, tone: BAD, xp: { physical: .2 },
                text: 'You climb well but their centre-half gets his head in the way. It spins behind for another corner.' });
            } },
          { label: 'Leave it for the man behind', hint: 'He is screaming for it.', tag: 'Smart',
            run() {
              const p = luck(ctx, odds(eff(ctx, 'passing'), 45, 0.013, 0.55));
              if (U.chance(p)) return E({ assist: true, teamGoal: true, rating: 1.1, morale: 2, tone: GOOD, xp: { passing: .3 }, crowd: 8,
                text: 'You duck out of it and the man arriving behind you crashes it in. Perfectly read.' });
              return E({ rating: -0.3, tone: BAD,
                text: 'You both leave it for each other and it bounces through the six-yard box untouched. Criminal.' });
            } }
        ]
      };
    }
  });

  /* ---------- 52. the overlapping run (full-backs) ---------- */
  add({
    id: 'overlap', kind: 'run',
    weight: ctx => isPos(ctx, ['LB', 'RB']) ? 2 : 0,
    build(ctx) {
      return {
        title: 'The overlap is on',
        sub: U.pick([
          `Your winger has the ball and two defenders on him. You are flying up the outside, completely free.`,
          `You have made forty yards at full sprint and the channel is wide open. The winger sees you. Maybe.`,
          `Classic overlap — you are outside him, the full-back\'s position is yours, and the box is filling up.`
        ]),
        art: 'pace',
        options: [
          { label: 'Scream for the ball', hint: 'Demand it, then deliver.', tag: 'Work Rate',
            run() {
              const p = luck(ctx, odds((eff(ctx, 'pace') + eff(ctx, 'passing')) / 2, 46, 0.015, 0.58));
              if (U.chance(p)) {
                if (U.chance(0.4)) return E({ assist: true, teamGoal: true, rating: 1.5, tone: GOOD, xp: { passing: .5, pace: .3 }, crowd: 11,
                  text: 'He slips you in, and your first-time cross is met on the volley. Assist from the overlap — textbook!' });
                return E({ rating: 0.9, tone: GOOD, xp: { pace: .4 }, crowd: 7,
                  text: 'You get it at full tilt and your cross flashes across the six-yard box. Nobody gambles, but the intent was perfect.' });
              }
              return E({ rating: -0.4, tone: BAD, xp: { pace: .2 },
                text: 'He ignores you, runs into trouble and loses it. Forty yards of sprinting, wasted. You hold your arms out.' });
            } },
          { label: 'The decoy run', hint: 'Drag a man away. Never touch it.', tag: 'Team Player',
            run() {
              const p = luck(ctx, odds(eff(ctx, 'pace'), 44, 0.013, 0.62));
              if (U.chance(p)) {
                if (U.chance(0.35)) return E({ teamGoal: true, rating: 1.1, trust: 2, tone: GOOD, xp: { pace: .3 }, crowd: 8,
                  text: 'Their full-back goes with you, the winger cuts inside and scores. Your run made the whole goal.' });
                return E({ rating: 0.5, tone: GOOD, xp: { pace: .2 },
                  text: 'You take a defender with you and the winger wins a corner. Unselfish, unseen, appreciated by the staff.' });
              }
              return E({ rating: -0.2, tone: NEU,
                text: 'Nobody follows you. You are just a man standing very wide, very alone.' });
            } }
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
      built.id = id; built.kind = def.kind; built.ctx = ctx;
      return built;
    },

    /* Pick a moment.
       opts.kinds   — restrict to these kinds ('shot', 'defend', 'gk', 'set', …)
       opts.exclude — ids already used in this match: never shown twice
       opts.recent  — ids seen in recent matches, most recent first: heavily
                      down-weighted so the same moments stop cycling round.  */
    pick(ctx, opts) {
      opts = opts || {};
      const ex = opts.exclude || [], recent = opts.recent || [], kinds = opts.kinds;
      const candidates = LIB.filter(s => !s.explicitOnly
        && ex.indexOf(s.id) < 0
        && (!kinds || kinds.indexOf(s.kind) >= 0));

      const pool = candidates.map(s => {
        let w = s.weight(ctx);
        if (w <= 0) return null;
        const seen = recent.indexOf(s.id);
        if (seen >= 0) w *= seen < 3 ? 0.05 : seen < 6 ? 0.18 : seen < 10 ? 0.45 : 0.75;
        return [s, w];
      }).filter(Boolean);

      if (!pool.length) {
        // every option is either used or filtered out — fall back to anything legal
        const any = candidates.map(s => [s, s.weight(ctx)]).filter(pr => pr[1] > 0);
        if (!any.length) return null;
        return Scenarios.build(U.weighted(any).id, ctx);
      }
      return Scenarios.build(U.weighted(pool).id, ctx);
    },

    // kept for older call sites
    random(ctx, excludeIds) { return Scenarios.pick(ctx, { exclude: excludeIds }); },

    /* Run one option. Tags the shared context with the option's style first so
       style traits (Finesse Expert, Power Shooter, …) apply automatically. */
    resolve(scn, index) {
      const opt = scn.options[index];
      if (!opt) return null;
      if (scn.ctx) scn.ctx.style = styleFor(scn, opt);
      const fx = opt.run();
      if (scn.ctx) scn.ctx.style = null;
      return fx;
    },

    styleOf(scn, opt) { return styleFor(scn, opt); },

    // A penalty shootout kick (used by engine for cup ties)
    shootoutKick(ctx) {
      return {
        id: 'shootout', kind: 'set',
        title: 'Penalty shootout',
        sub: ctx.shootoutSub || 'Your turn. The whole season comes down to this.',
        art: 'penalty',
        options: penaltyOptions(ctx, scored => {
          const saved = !scored && U.chance(0.62);
          return E({
            goal: scored, tone: scored ? GOOD : BAD,
            how: scored ? 'goal' : (saved ? 'saved' : 'missed'),
            text: scored ? 'Buried it. You do not even look at the keeper.'
                 : saved ? 'Saved! He got a strong hand to it and you sink to your knees.'
                         : 'You blaze it over the bar. You cannot bring yourself to look up.'
          });
        })
      };
    },

    list() { return LIB; }
  };

  global.Scenarios = Scenarios;
})(window);
