/**
 * Homegrown Holiday Bottle Drive: sign-up backend
 * ================================================
 * Lives inside the bottle drive Google Sheet (Extensions > Apps Script) and is
 * deployed as a web app. The website calls it to:
 *   - read the public "Settings" tab (amount raised, bags-out time, FAQ details...)
 *   - register a pickup: save a row, create the HG-XXXX code, send the confirmation email
 *   - run My pickup: look up by code + email, skip/unskip a Thursday, edit details,
 *     change email preferences, stop pickups
 *
 * Setup steps are in README.md. Emails go out from the Google account that deploys this.
 */

var TZ = 'America/Edmonton';
var CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I/L

var TAB = { signups: 'Signups', pickups: 'Pickups', newsletter: 'Newsletter', settings: 'Settings' };

// Signups tab columns. Add new columns at the END only.
var SIGNUP_COLS = [
  'code', 'status', 'created_at', 'name', 'email', 'address', 'city', 'zone', 'bags', 'bag_spot',
  'frequency', 'note', 'first_pickup', 'skipped_dates',
  'consent_pickup_emails', 'consent_pickup_emails_at', 'consent_newsletter', 'consent_newsletter_at',
  'confirmation_sent_at', 'stopped_at', 'updated_at'
];
// Pickups tab: one row per address per Thursday, filled in by the pickup team.
var PICKUP_COLS = ['pickup_date', 'code', 'outcome', 'bags_collected', 'driver', 'recorded_at', 'notes'];
var NEWSLETTER_COLS = ['email', 'name', 'consented_at', 'source', 'withdrawn_at'];

var STATUSES = ['registered', 'confirmed', 'collected', 'counted', 'skipped', 'bags_not_out'];
var CITIES = ['Calgary', 'Red Deer'];
var BAGS = ['1–2', '3–5', '6–10', '10+'];
var SPOTS = ['Front step', 'Side door', 'Back gate / alley', 'Garage pad', 'Other'];
var FREQS = ['Every Thursday', 'Just once'];

// Settings tab rows: [key, value, what it's for]. Blank value = still a [PLACEHOLDER] on the site.
var SETTINGS_SEED = [
  ['goal', '2500', 'Fundraising goal in dollars (confirmed).'],
  ['raised', '', '[$ RAISED] Dollars raised so far. Update after each depot run.'],
  ['households', '', '[N] households signed up so far.'],
  ['businesses', '', '[N] businesses signed up so far.'],
  ['campaign_start', '2026-12-10', 'First pickup Thursday (YYYY-MM-DD).'],
  ['end_date', '', '[END DATE] Last pickup Thursday (YYYY-MM-DD).'],
  ['skip_dates', '', 'Thursdays with NO pickup, comma-separated YYYY-MM-DD (e.g. 2026-12-24, 2026-12-31). Still to decide.'],
  ['bags_out_time', '', '[TIME] Bags-out time as donors should read it, e.g. "8 am".'],
  ['cutoff_day', '', '[CUTOFF] Weekday of the sign-up cutoff, e.g. "Tuesday". Blank = sign-ups close at the end of Wednesday.'],
  ['cutoff_time', '', 'Time of the cutoff, e.g. "6 pm" or "18:00". Blank = 11:59 pm.'],
  ['zones', 'South, North, East, West, Downtown', '[CONFIRM ZONES] Options in the "Area of the city" menu, comma-separated.'],
  ['zones_note', '', '[CONFIRM ZONES] Extra text in the FAQ "Which areas do you cover?" answer. "-" hides the placeholder.'],
  ['accepted_list', '', '[CONFIRM LIST] Extra text in the FAQ "What can I donate?" answer. "-" hides the placeholder.'],
  ['prep_rules', '', '[CONFIRM ANY PREP RULES] Extra text in the "What we take" box. "-" hides the placeholder.'],
  ['contact_email', '', '[BOTTLE DRIVE EMAIL] Public contact address. Also the reply-to on donor emails.'],
  ['site_url', '', 'Web address of the bottle drive page (e.g. https://example.org/bottle-drive). Used for the My pickup link in emails.'],
  ['research_1', '', '[2–3 SENTENCES FROM KATIE\'S RESEARCH]'],
  ['research_2', '', '[WHAT THE SUPPORTS ARE]'],
  ['stat_1', '', '[STAT] card 1 number'], ['stat_1_label', '', 'Card 1: what it measures · source'],
  ['stat_2', '', '[STAT] card 2 number'], ['stat_2_label', '', 'Card 2: what it measures · source'],
  ['stat_3', '', '[STAT] card 3 number'], ['stat_3_label', '', 'Card 3: what it measures · source'],
  ['bucket_1', '', '[BUCKET 1] name'], ['bucket_1_pct', '', 'Bucket 1 %'],
  ['bucket_2', '', '[BUCKET 2] name'], ['bucket_2_pct', '', 'Bucket 2 %'],
  ['bucket_3', '', '[BUCKET 3] name'], ['bucket_3_pct', '', 'Bucket 3 %'],
  ['bucket_4', '', '[BUCKET 4] name'], ['bucket_4_pct', '', 'Bucket 4 %'],
  ['partners', '', 'One venue per line: Name | logo URL | website. The logo grid appears once 3+ are listed.'],
  ['partner_link', '', 'Where "Partner with us" goes (form or mailto:). Blank = email the contact address.']
];

/* =================================================================
   Web app entry points
   ================================================================= */

function doGet(e) {
  var action = e && e.parameter && e.parameter.action;
  if (action === 'settings') return json_({ ok: true, settings: publicSettings_() });
  return json_({ ok: true, service: 'Homegrown bottle drive' });
}

function doPost(e) {
  var body;
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return json_({ ok: false, code: 'bad_request', error: 'Could not read the request.' });
  }
  try {
    switch (body.action) {
      case 'register': return json_(register_(body));
      case 'lookup': return json_(withDonor_(body, function (d) { return { ok: true, profile: profile_(d) }; }));
      case 'skip': return json_(withDonor_(body, function (d) { return skip_(d, body.date, true); }));
      case 'unskip': return json_(withDonor_(body, function (d) { return skip_(d, body.date, false); }));
      case 'update': return json_(withDonor_(body, function (d) { return update_(d, body.changes || {}); }));
      case 'newsletter': return json_(withDonor_(body, function (d) { return newsletter_(d, !!body.subscribe); }));
      case 'stop': return json_(withDonor_(body, function (d) { return stop_(d); }));
      default: return json_({ ok: false, code: 'bad_request', error: 'Unknown action.' });
    }
  } catch (err) {
    console.error(err && err.stack || err);
    return json_({ ok: false, code: err.code || 'server', error: err.code === 'validation' ? err.message : 'Something went wrong on our side.' });
  }
}

/* =================================================================
   Register
   ================================================================= */

function register_(b) {
  if (b.website) return { ok: false, code: 'validation', error: 'Please try again.' }; // honeypot

  var v = {
    name: clean_(b.name, 120),
    email: clean_(b.email, 200).toLowerCase(),
    address: clean_(b.address, 200),
    city: clean_(b.city, 40),
    zone: clean_(b.zone, 60),
    bags: clean_(b.bags, 10),
    bag_spot: clean_(b.bag_spot, 40),
    frequency: clean_(b.frequency, 40),
    note: clean_(b.note, 500)
  };
  var s = settings_();
  var zones = String(s.zones || '').split(/\s*[,\n]\s*/).filter(String);

  if (v.name.length < 2) invalid_('Enter your name.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.email)) invalid_('Enter a valid email address.');
  if (v.address.length < 5) invalid_('Enter the street address for pickup.');
  if (CITIES.indexOf(v.city) === -1) invalid_('Choose Calgary or Red Deer.');
  if (zones.length && zones.indexOf(v.zone) === -1) invalid_('Choose the area of the city.');
  if (BAGS.indexOf(v.bags) === -1) invalid_('Choose roughly how many bags.');
  if (SPOTS.indexOf(v.bag_spot) === -1) invalid_('Tell us where the bags will be.');
  if (FREQS.indexOf(v.frequency) === -1) invalid_('Choose every Thursday or just once.');
  if (v.bag_spot === 'Other' && !v.note) invalid_('Tell the driver where to find your bags.');
  if (b.consent_pickup_emails !== true) invalid_('Tick "Email me about my pickups" so we can send your pickup code.');

  var first = firstPickup_(s, nowAB_());
  if (!first) invalid_('The bottle drive has wrapped up for this season. Thank you!');

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  var code, rowIndex, stamp = isoNow_();
  try {
    var sh = sheet_(TAB.signups, SIGNUP_COLS);
    var existing = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().map(function (r) { return String(r[0]); }) : [];
    do { code = newCode_(); } while (existing.indexOf(code) !== -1);

    var row = {
      code: code, status: 'registered', created_at: stamp,
      name: v.name, email: v.email, address: v.address, city: v.city, zone: v.zone, bags: v.bags,
      bag_spot: v.bag_spot, frequency: v.frequency, note: v.note, first_pickup: first, skipped_dates: '',
      consent_pickup_emails: 'yes', consent_pickup_emails_at: stamp,
      consent_newsletter: b.consent_newsletter === true ? 'yes' : 'no',
      consent_newsletter_at: b.consent_newsletter === true ? stamp : '',
      confirmation_sent_at: '', stopped_at: '', updated_at: stamp
    };
    sh.appendRow(SIGNUP_COLS.map(function (c) { return safe_(row[c]); }));
    rowIndex = sh.getLastRow();

    if (b.consent_newsletter === true) {
      sheet_(TAB.newsletter, NEWSLETTER_COLS).appendRow([safe_(v.email), safe_(v.name), stamp, 'bottle drive sign-up ' + code, '']);
    }
  } finally {
    lock.releaseLock();
  }

  var sent = false;
  try {
    sendConfirmation_(v, code, first, s);
    sent = true;
    var sh2 = sheet_(TAB.signups, SIGNUP_COLS);
    sh2.getRange(rowIndex, col_('status')).setValue('confirmed');
    sh2.getRange(rowIndex, col_('confirmation_sent_at')).setValue(isoNow_());
  } catch (err) {
    console.error('Confirmation email failed for ' + code + ': ' + err);
  }

  return { ok: true, code: code, first_pickup: first, frequency: v.frequency, email_sent: sent };
}

function sendConfirmation_(v, code, first, s) {
  var time = s.bags_out_time || '[TIME]';
  var when = fmtLong_(first);
  var once = v.frequency === 'Just once';
  var link = s.site_url ? String(s.site_url).replace(/\/+$/, '') + '/my-pickup.html?code=' + encodeURIComponent(code) : '';
  var firstName = v.name.split(/\s+/)[0];
  var spot = v.bag_spot === 'Other' ? 'the spot you described' : 'your ' + v.bag_spot.toLowerCase();

  var text = [
    'Hi ' + firstName + ',',
    '',
    'Thanks for joining the Homegrown Holiday Bottle Drive. Every refund funds mental health supports for independent artists in Alberta.',
    '',
    'Your pickup code: ' + code,
    'First pickup: ' + when,
    once ? 'Just this once.' : 'Then every Thursday after that, until you skip or stop.',
    '',
    'Bags out by ' + time + ', marked "Homegrown", at ' + spot + '. No need to be home.',
    '',
    'Pickup address: ' + v.address + ', ' + v.city + ' (' + v.zone + ')',
    'Bags: ' + v.bags,
    '',
    'To skip a week, change your details or stop, open My pickup with your code and this email address' + (link ? ': ' + link : '.'),
    '',
    'Homegrown is a non-profit collective, not a registered charity, so we can\'t issue tax receipts. Your address is only seen by the pickup team and is deleted after the campaign.',
    '',
    'Homegrown Arts & Media Collective'
  ].join('\n');

  var h = escHtml_;
  var html =
    '<div style="background:#f4f3da;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#101e37">' +
    '<div style="max-width:560px;margin:0 auto;background:#ffffff;border:3px solid #0a1428">' +
    '<div style="background:#101e37;color:#f4f3da;padding:20px 24px;font-size:20px;font-weight:bold">Homegrown Holiday Bottle Drive</div>' +
    '<div style="padding:24px;font-size:16px;line-height:1.5">' +
    '<p style="margin:0 0 16px">Hi ' + h(firstName) + ',</p>' +
    '<p style="margin:0 0 20px">Thanks for joining the bottle drive. Every refund funds mental health supports for independent artists in Alberta.</p>' +
    '<table role="presentation" style="width:100%;border-collapse:collapse;background:#101e37;color:#f4f3da;margin:0 0 20px"><tr>' +
    '<td style="padding:16px 20px"><div style="font-size:13px">YOUR PICKUP CODE</div><div style="font-size:30px;font-weight:bold;color:#edbe69;letter-spacing:2px">' + h(code) + '</div></td>' +
    '<td style="padding:16px 20px"><div style="font-size:13px">FIRST PICKUP</div><div style="font-size:18px;font-weight:bold">' + h(when) + '</div></td>' +
    '</tr></table>' +
    '<p style="margin:0 0 12px">' + (once ? 'Just this once.' : 'Then every Thursday after that, until you skip a week or stop.') + '</p>' +
    '<p style="margin:0 0 20px"><strong>Bags out by ' + h(time) + ', marked “Homegrown”</strong>, at ' + h(spot) + '. No need to be home.</p>' +
    '<p style="margin:0 0 20px;font-size:14px;color:#33405a">Pickup address: ' + h(v.address) + ', ' + h(v.city) + ' (' + h(v.zone) + ')<br>Bags: ' + h(v.bags) + '</p>' +
    (link
      ? '<p style="margin:0 0 20px"><a href="' + h(link) + '" style="display:inline-block;background:#ce5352;color:#ffffff;font-weight:bold;padding:12px 20px;text-decoration:none;border:3px solid #0a1428">Open My pickup</a></p>'
      : '<p style="margin:0 0 20px">To skip a week, change your details or stop, open My pickup on the bottle drive page with your code and this email address.</p>') +
    '<p style="margin:0;font-size:13px;color:#33405a">Homegrown is a non-profit collective, not a registered charity, so we can’t issue tax receipts. Your address is only seen by the pickup team and is deleted after the campaign.</p>' +
    '</div></div></div>';

  var opts = { name: 'Homegrown Bottle Drive', htmlBody: html };
  if (s.contact_email && /@/.test(s.contact_email)) opts.replyTo = s.contact_email;
  MailApp.sendEmail(v.email, 'You’re booked: bottle pickup code ' + code, text, opts);
}

/* =================================================================
   My pickup
   ================================================================= */

function withDonor_(b, fn) {
  var code = normCode_(b.code), email = clean_(b.email, 200).toLowerCase();
  if (!code || !email) return { ok: false, code: 'not_found', error: 'Enter your pickup code and email.' };
  var d = findDonor_(code, email);
  if (!d) return { ok: false, code: 'not_found', error: 'We couldn’t find a pickup with that code and email.' };
  return fn(d);
}

function findDonor_(code, email) {
  var sh = sheet_(TAB.signups, SIGNUP_COLS);
  if (sh.getLastRow() < 2) return null;
  var values = sh.getRange(2, 1, sh.getLastRow() - 1, SIGNUP_COLS.length).getValues();
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0]).toUpperCase() === code && String(values[i][col_('email') - 1]).toLowerCase() === email) {
      var d = { _row: i + 2 };
      SIGNUP_COLS.forEach(function (c, j) { d[c] = cellText_(values[i][j]); });
      return d;
    }
  }
  return null;
}

function schedule_(d, s) {
  if (d.stopped_at) return [];
  var skipped = splitDates_(d.skipped_dates);
  var all = pickupThursdays_(s).filter(function (t) { return t >= d.first_pickup; });
  if (d.frequency === 'Just once') all = all.slice(0, 1);
  return all.map(function (t) { return { date: t, skipped: skipped.indexOf(t) !== -1 }; });
}

function profile_(d) {
  var s = settings_(), now = nowAB_();
  var history = pickupsFor_(d.code);
  var upcoming = schedule_(d, s).filter(function (p) { return p.date >= now.ymd; }).slice(0, 8).map(function (p) {
    p.locked = !beforeCutoff_(p.date, s, now);
    return p;
  });
  return {
    code: d.code, status: d.status, name: d.name, email: d.email, address: d.address, city: d.city,
    zone: d.zone, bags: d.bags, bag_spot: d.bag_spot, frequency: d.frequency, note: d.note,
    first_pickup: d.first_pickup, newsletter: d.consent_newsletter === 'yes', stopped: !!d.stopped_at,
    upcoming: upcoming, history: history
  };
}

function pickupsFor_(code) {
  var sh = sheet_(TAB.pickups, PICKUP_COLS);
  if (sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, PICKUP_COLS.length).getValues()
    .filter(function (r) { return String(r[1]).toUpperCase() === code; })
    .map(function (r) { return { date: cellText_(r[0]), outcome: cellText_(r[2]), bags: cellText_(r[3]) }; })
    .sort(function (a, b) { return a.date < b.date ? 1 : -1; });
}

function skip_(d, date, skip) {
  var s = settings_();
  if (!isYmd_(date)) invalid_('Pick a Thursday.');
  var sched = schedule_(d, s).map(function (p) { return p.date; });
  if (sched.indexOf(date) === -1) invalid_('That Thursday isn’t on your schedule.');
  if (!beforeCutoff_(date, s, nowAB_())) invalid_('That pickup is already locked in. The route is set, but you can just leave no bags out.');
  var list = splitDates_(d.skipped_dates).filter(function (x) { return x !== date; });
  if (skip) list.push(date);
  list.sort();
  setCells_(d, { skipped_dates: list.join(', ') });
  d.skipped_dates = list.join(', ');
  return { ok: true, profile: profile_(d) };
}

function update_(d, ch) {
  var s = settings_();
  var zones = String(s.zones || '').split(/\s*[,\n]\s*/).filter(String);
  var out = {};
  if ('address' in ch) { out.address = clean_(ch.address, 200); if (out.address.length < 5) invalid_('Enter the street address for pickup.'); }
  if ('city' in ch) { out.city = clean_(ch.city, 40); if (CITIES.indexOf(out.city) === -1) invalid_('Choose Calgary or Red Deer.'); }
  if ('zone' in ch) { out.zone = clean_(ch.zone, 60); if (zones.length && zones.indexOf(out.zone) === -1) invalid_('Choose the area of the city.'); }
  if ('bags' in ch) { out.bags = clean_(ch.bags, 10); if (BAGS.indexOf(out.bags) === -1) invalid_('Choose roughly how many bags.'); }
  if ('bag_spot' in ch) { out.bag_spot = clean_(ch.bag_spot, 40); if (SPOTS.indexOf(out.bag_spot) === -1) invalid_('Tell us where the bags will be.'); }
  if ('frequency' in ch) { out.frequency = clean_(ch.frequency, 40); if (FREQS.indexOf(out.frequency) === -1) invalid_('Choose every Thursday or just once.'); }
  if ('note' in ch) out.note = clean_(ch.note, 500);
  var spot = out.bag_spot || d.bag_spot, note = 'note' in out ? out.note : d.note;
  if (spot === 'Other' && !note) invalid_('Tell the driver where to find your bags.');
  setCells_(d, out);
  Object.keys(out).forEach(function (k) { d[k] = out[k]; });
  return { ok: true, profile: profile_(d) };
}

function newsletter_(d, subscribe) {
  var stamp = isoNow_();
  setCells_(d, { consent_newsletter: subscribe ? 'yes' : 'no', consent_newsletter_at: stamp });
  var sh = sheet_(TAB.newsletter, NEWSLETTER_COLS);
  if (subscribe) {
    sh.appendRow([safe_(d.email), safe_(d.name), stamp, 'My pickup ' + d.code, '']);
  } else if (sh.getLastRow() > 1) {
    var rows = sh.getRange(2, 1, sh.getLastRow() - 1, NEWSLETTER_COLS.length).getValues();
    rows.forEach(function (r, i) {
      if (String(r[0]).toLowerCase() === d.email && !r[4]) sh.getRange(i + 2, 5).setValue(stamp);
    });
  }
  d.consent_newsletter = subscribe ? 'yes' : 'no';
  return { ok: true, profile: profile_(d) };
}

function stop_(d) {
  var stamp = isoNow_();
  setCells_(d, { stopped_at: stamp });
  d.stopped_at = stamp;
  return { ok: true, profile: profile_(d) };
}

/* =================================================================
   Pickup dates (same rules as js/site.js)
   ================================================================= */

function nowAB_() {
  var d = new Date();
  return { ymd: Utilities.formatDate(d, TZ, 'yyyy-MM-dd'), hm: Utilities.formatDate(d, TZ, 'HH:mm') };
}
function addDays_(ymd, n) {
  var d = new Date(ymd + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function weekday_(ymd) { return new Date(ymd + 'T00:00:00Z').getUTCDay(); }
function isYmd_(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s || '').trim()); }
function splitDates_(s) { return String(s || '').split(/[\s,;]+/).filter(isYmd_); }
function parseTime_(s) {
  s = String(s || '').trim().toLowerCase().replace(/\./g, '');
  if (!s) return null;
  if (s === 'noon') return '12:00';
  if (s === 'midnight') return '23:59';
  var m = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!m) return null;
  var h = +m[1], min = m[2] ? +m[2] : 0;
  if (m[3] === 'pm' && h < 12) h += 12;
  if (m[3] === 'am' && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  return (h < 10 ? '0' : '') + h + ':' + (min < 10 ? '0' : '') + min;
}
function parseDay_(s) {
  var days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  return days.indexOf(String(s || '').trim().toLowerCase().slice(0, 3));
}
function pickupThursdays_(s) {
  var start = isYmd_(s.campaign_start) ? s.campaign_start : '2026-12-10';
  while (weekday_(start) !== 4) start = addDays_(start, 1);
  var end = isYmd_(s.end_date) ? s.end_date : addDays_(start, 7 * 26);
  var skips = splitDates_(s.skip_dates), out = [];
  for (var d = start; d <= end; d = addDays_(d, 7)) if (skips.indexOf(d) === -1) out.push(d);
  return out;
}
// No cutoff set yet: sign-ups close at the end of the Wednesday before (stand-in, not a confirmed rule).
function cutoffFor_(thu, s) {
  var day = parseDay_(s.cutoff_day), time = parseTime_(s.cutoff_time) || '23:59';
  if (day === -1) return { ymd: addDays_(thu, -1), hm: '23:59' };
  return { ymd: addDays_(thu, -((4 - day + 7) % 7)), hm: time };
}
function beforeCutoff_(thu, s, now) {
  var c = cutoffFor_(thu, s);
  return now.ymd < c.ymd || (now.ymd === c.ymd && now.hm <= c.hm);
}
function firstPickup_(s, now) {
  var list = pickupThursdays_(s);
  for (var i = 0; i < list.length; i++) if (beforeCutoff_(list[i], s, now)) return list[i];
  return null;
}
function fmtLong_(ymd) {
  var days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var p = ymd.split('-');
  return days[weekday_(ymd)] + ', ' + months[+p[1] - 1] + ' ' + +p[2];
}

/* =================================================================
   Sheet helpers
   ================================================================= */

function sheet_(name, cols) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    if (cols) {
      sh.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold');
      sh.setFrozenRows(1);
      sh.getRange(1, 1, sh.getMaxRows(), cols.length).setNumberFormat('@'); // plain text: no date auto-conversion
    }
  }
  return sh;
}

function col_(name) { return SIGNUP_COLS.indexOf(name) + 1; }

function setCells_(d, values) {
  var sh = sheet_(TAB.signups, SIGNUP_COLS);
  values.updated_at = isoNow_();
  Object.keys(values).forEach(function (k) {
    var c = col_(k);
    if (c > 0) sh.getRange(d._row, c).setValue(safe_(values[k]));
  });
}

function settings_() {
  var cache = CacheService.getScriptCache();
  var hit = cache.get('settings');
  if (hit) return JSON.parse(hit);
  var out = {};
  SETTINGS_SEED.forEach(function (r) { out[r[0]] = ''; });
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TAB.settings);
  if (sh && sh.getLastRow() > 1) {
    sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues().forEach(function (r) {
      var k = String(r[0]).trim();
      if (k) out[k] = cellText_(r[1]);
    });
  }
  cache.put('settings', JSON.stringify(out), 60); // edits show on the site within a minute
  return out;
}

// Everything in the Settings tab is public page content.
function publicSettings_() { return settings_(); }

function cellText_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, TZ, 'yyyy-MM-dd');
  return v === null || v === undefined ? '' : String(v).trim();
}

/* =================================================================
   Small utilities
   ================================================================= */

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function invalid_(msg) { var e = new Error(msg); e.code = 'validation'; throw e; }
function clean_(v, max) { return String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max); }
// Stop text that starts with = + - @ from being read as a spreadsheet formula.
function safe_(v) { v = v == null ? '' : String(v); return /^[=+\-@]/.test(v) ? "'" + v : v; }
function isoNow_() { return Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd'T'HH:mm:ssXXX"); }
function normCode_(c) {
  c = String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (c.indexOf('HG') === 0 && c.length === 6) c = c.slice(2);
  return /^[A-Z0-9]{4}$/.test(c) ? 'HG-' + c : '';
}
function newCode_() {
  var out = 'HG-';
  for (var i = 0; i < 4; i++) out += CODE_CHARS.charAt(Math.floor(Math.random() * CODE_CHARS.length));
  return out;
}
function escHtml_(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

/* =================================================================
   Sheet menu: setup and end-of-campaign clean-up
   ================================================================= */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Bottle drive')
    .addItem('Set up tabs', 'setup')
    .addItem('Send a test confirmation email to me', 'sendTestEmail')
    .addSeparator()
    .addItem('Delete personal data (after the campaign)', 'purgePersonalData')
    .addToUi();
}

// Creates the four tabs with headers and seeds Settings. Safe to run again.
function setup() {
  sheet_(TAB.signups, SIGNUP_COLS);
  var pk = sheet_(TAB.pickups, PICKUP_COLS);
  pk.getRange('C2:C').setDataValidation(SpreadsheetApp.newDataValidation()
    .requireValueInList(['collected', 'bags_not_out', 'skipped', 'counted'], true).build());
  sheet_(TAB.newsletter, NEWSLETTER_COLS);
  var st = sheet_(TAB.settings, ['key', 'value', 'what it is']);
  var have = st.getLastRow() > 1 ? st.getRange(2, 1, st.getLastRow() - 1, 1).getValues().map(function (r) { return String(r[0]); }) : [];
  SETTINGS_SEED.forEach(function (r) { if (have.indexOf(r[0]) === -1) st.appendRow(r); });
  st.setColumnWidth(1, 160); st.setColumnWidth(2, 320); st.setColumnWidth(3, 520);
  var sg = sheet_(TAB.signups, SIGNUP_COLS);
  sg.getRange('B2:B').setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(STATUSES, true).build());
  CacheService.getScriptCache().remove('settings');
}

function sendTestEmail() {
  var me = Session.getActiveUser().getEmail();
  var s = settings_();
  sendConfirmation_({ name: 'Test Donor', email: me, address: '123 Example St', city: 'Calgary', zone: 'South', bags: '3–5', bag_spot: 'Front step', frequency: 'Every Thursday' },
    'HG-TEST', firstPickup_(s, nowAB_()) || '2026-12-10', s);
  SpreadsheetApp.getUi().alert('Test email sent to ' + me + '.');
}

// After the campaign: blanks names, emails, addresses and notes in Signups.
// Keeps code, city, zone, bags and dates for totals. Newsletter opt-ins (their own tab) are kept.
function purgePersonalData() {
  var ui = SpreadsheetApp.getUi();
  var ok = ui.alert('Delete personal data?', 'This blanks every name, email, address and driver note in the Signups tab. It can\'t be undone. Newsletter opt-ins are kept.', ui.ButtonSet.YES_NO);
  if (ok !== ui.Button.YES) return;
  var sh = sheet_(TAB.signups, SIGNUP_COLS), n = sh.getLastRow() - 1;
  if (n < 1) return;
  ['name', 'email', 'address', 'note'].forEach(function (c) { sh.getRange(2, col_(c), n, 1).clearContent(); });
  ui.alert('Done. Personal data removed from ' + n + ' sign-ups.');
}
