/* Homegrown Holiday Bottle Drive: My pickup (my-pickup.html) */
(function () {
  'use strict';
  var HG = window.HG, $ = HG.$, $$ = HG.$$, esc = HG.esc;
  var SESSION_KEY = 'hg-mypickup';
  var BAGS = ['1–2', '3–5', '6–10', '10+'];
  var SPOTS = [['Front step', 'Front step'], ['Side door', 'Side door'], ['Back gate / alley', 'Back gate / alley'], ['Garage pad', 'Garage pad'], ['Other', 'Other (add a note)']];
  var TRACK = [['registered', 'Signed up'], ['confirmed', 'Confirmed'], ['collected', 'Collected'], ['counted', 'Counted']];
  var OUTCOME = { collected: 'Collected', counted: 'Counted', bags_not_out: 'Bags not out', skipped: 'Skipped' };

  var creds = null, profile = null, editing = false;

  function session(set) {
    try {
      if (set === null) sessionStorage.removeItem(SESSION_KEY);
      else if (set) sessionStorage.setItem(SESSION_KEY, JSON.stringify(set));
      else return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
    } catch (e) { return null; }
  }

  function normCode(c) {
    c = String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (c.indexOf('HG') === 0 && c.length === 6) c = c.slice(2);
    return /^[A-Z0-9]{4}$/.test(c) ? 'HG-' + c : '';
  }

  /* ---------- preview data (no Apps Script URL yet) ---------- */
  function previewProfile(code, email) {
    var s = HG.settings, now = HG.nowAB();
    var first = HG.firstPickup(s) || '2026-12-10';
    var up = HG.pickupThursdays(s).filter(function (d) { return d >= first; }).slice(0, 6)
      .map(function (d) { return { date: d, skipped: false, locked: !HG.beforeCutoff(d, s, now) }; });
    return {
      code: code, status: 'confirmed', name: 'Sample Donor', email: email, address: '123 Sample St SW',
      city: 'Calgary', zone: 'South', bags: '3–5', bag_spot: 'Front step', frequency: 'Every Thursday', note: '',
      first_pickup: first, newsletter: false, stopped: false, upcoming: up, history: [], preview: true
    };
  }
  function previewAction(action, payload) {
    var p = JSON.parse(JSON.stringify(profile));
    if (action === 'skip' || action === 'unskip') p.upcoming.forEach(function (u) { if (u.date === payload.date) u.skipped = action === 'skip'; });
    if (action === 'update') Object.keys(payload.changes).forEach(function (k) { p[k] = payload.changes[k]; });
    if (action === 'update' && p.frequency === 'Just once') p.upcoming = p.upcoming.slice(0, 1);
    if (action === 'newsletter') p.newsletter = payload.subscribe;
    if (action === 'stop') { p.stopped = true; p.upcoming = []; }
    return Promise.resolve({ ok: true, profile: p });
  }

  function call(action, extra) {
    var payload = Object.assign({ code: creds.code, email: creds.email }, extra || {});
    if (HG.preview) return previewAction(action, payload);
    return HG.api(action, payload);
  }

  /* ---------- lookup ---------- */
  function showLookupError(msg) {
    var a = $('#mp-alert');
    a.innerHTML = msg;
    a.hidden = false;
    a.focus();
  }

  function lookup(code, email, quiet) {
    var btn = $('#mp-form button[type="submit"]');
    btn.disabled = true;
    var label = btn.textContent;
    btn.textContent = 'Looking…';
    var p = HG.preview
      ? Promise.resolve({ ok: true, profile: previewProfile(code, email) })
      : HG.api('lookup', { code: code, email: email });
    return p.then(function (res) {
      btn.disabled = false; btn.textContent = label;
      creds = { code: code, email: email };
      session(creds);
      show(res.profile, true);
    }).catch(function (err) {
      btn.disabled = false; btn.textContent = label;
      session(null);
      if (quiet) return;
      var mail = HG.blank(HG.settings.contact_email) ? '' : ' Still stuck? Email <a href="mailto:' + esc(HG.settings.contact_email) + '">' + esc(HG.settings.contact_email) + '</a>.';
      showLookupError(err && err.code === 'not_found'
        ? '<strong>No pickup found.</strong>Check the code and use the same email you signed up with.' + mail
        : '<strong>We couldn’t reach the pickup list.</strong>Check your connection and try again.' + mail);
    });
  }

  function onLookup(e) {
    e.preventDefault();
    $('#mp-alert').hidden = true;
    var codeEl = $('#mp-code'), emailEl = $('#mp-email');
    var code = normCode(codeEl.value), email = emailEl.value.trim().toLowerCase();
    var bad = null;
    $('#mp-code-err').textContent = code ? '' : 'Enter your code. It looks like HG-7KQ4.';
    codeEl.toggleAttribute('aria-invalid', !code);
    if (!code) bad = codeEl;
    var emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
    $('#mp-email-err').textContent = emailOk ? '' : 'Enter the email you signed up with.';
    emailEl.toggleAttribute('aria-invalid', !emailOk);
    if (!emailOk && !bad) bad = emailEl;
    if (bad) { bad.focus(); return; }
    codeEl.value = code;
    lookup(code, email);
  }

  /* ---------- profile ---------- */
  function show(p, focus) {
    profile = p;
    editing = false;
    $('#mp-lookup').hidden = true;
    $('#mp-title').textContent = 'Hi, ' + p.name.split(/\s+/)[0];
    $('#mp-intro').textContent = p.stopped
      ? 'Your pickups are stopped. Thanks for every bottle!'
      : 'Here’s your bottle drive pickup. Changes save right away.';
    render();
    $('#mp-profile').hidden = false;
    if (focus) { $('#mp-title').setAttribute('tabindex', '-1'); $('#mp-title').focus(); }
  }

  function card(title, inner, extra) {
    return '<div class="hg-card hg-card--white"' + (extra || '') + '><h2 class="hg-panel-title">' + title + '</h2>' + inner + '</div>';
  }

  function render() {
    var p = profile, s = HG.settings;
    var time = HG.blank(s.bags_out_time) ? '[TIME]' : s.bags_out_time;

    // Summary on the navy band: code, next pickup, tracker
    var next = (p.upcoming || []).filter(function (u) { return !u.skipped; })[0];
    var stage = TRACK.map(function (t) { return t[0]; }).indexOf(p.status);
    var tracker = '<ol class="hg-tracker" aria-label="Pickup status">' + TRACK.map(function (t, i) {
      var cls = i < stage ? 'is-done' : i === stage ? 'is-current' : '';
      return '<li class="' + cls + '"' + (i === stage ? ' aria-current="step"' : '') + '>' + t[1] + '</li>';
    }).join('') + '</ol>';
    var note = '';
    if (p.status === 'bags_not_out') note = '<p style="margin: 12px 0 0; color: #f4f3da">Last Thursday we didn’t find bags out. No problem: we’ll try again next week.</p>';

    $('#mp-summary').innerHTML =
      (p.preview ? '<div class="hg-alert" style="margin-bottom: 28px; max-width: 760px"><strong>Preview only</strong>My pickup isn’t connected to the Google Sheet yet, so this is sample data.</div>' : '') +
      '<div class="hg-codebox" style="margin-bottom: 28px">' +
        '<div><span class="hg-label">Pickup code</span><span class="hg-code">' + esc(p.code) + '</span></div>' +
        '<div><span class="hg-label">Next pickup</span><span class="hg-date">' +
          (p.stopped ? 'Stopped' : next ? esc(HG.fmtLong(next.date)) : 'None scheduled') + '</span></div>' +
        (p.stopped || !next ? '' : '<div><span class="hg-label">Bags out by</span><span class="hg-date">' + esc(time) + '</span></div>') +
      '</div>' + tracker + note +
      '<p style="margin: 24px 0 0"><button type="button" class="hg-linkbtn" data-signout style="color: #edbe69">Not you? Sign out</button></p>';
    $('#mp-summary').hidden = false;

    var cards = '';

    // Upcoming Thursdays
    if (!p.stopped) {
      var rows = (p.upcoming || []).map(function (u) {
        var right = u.locked
          ? '<span class="hg-tag hg-tag--warn">Locked in</span>'
          : u.skipped
            ? '<span class="hg-tag hg-tag--skip">Skipped</span> <button type="button" class="hg-button hg-button--ghost hg-button--small" data-unskip="' + u.date + '">Undo skip</button>'
            : '<button type="button" class="hg-button hg-button--ghost hg-button--small" data-skip="' + u.date + '" aria-label="Skip ' + esc(HG.fmtLong(u.date)) + '">Skip this week</button>';
        return '<li><span class="hg-when">' + esc(HG.fmtShort(u.date)) + '</span><span style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap">' + right + '</span></li>';
      }).join('');
      cards += card('Upcoming Thursdays',
        (rows ? '<ul class="hg-rows">' + rows + '</ul>' : '<p style="margin: 0">No more pickups on your schedule.</p>') +
        '<p class="hg-hint" style="margin: 16px 0 0">' + (p.frequency === 'Just once' ? 'You chose a one-time pickup. Switch to every Thursday under Your details.' : 'Skip any week before its sign-up cutoff. “Locked in” means the route is set; just leave no bags out.') + '</p>');
    }

    // Past pickups
    var hist = (p.history || []).map(function (h) {
      return '<li><span class="hg-when">' + esc(HG.fmtShort(h.date)) + '</span><span>' + esc(OUTCOME[h.outcome] || h.outcome) +
        (h.bags ? ' · <strong>' + esc(h.bags) + (String(h.bags) === '1' ? ' bag' : ' bags') + '</strong>' : '') + '</span></li>';
    }).join('');
    cards += card('Past pickups', hist ? '<ul class="hg-rows">' + hist + '</ul>' : '<p style="margin: 0">Nothing yet. After each Thursday we log your bags here.</p>');

    // Details
    cards += card('Your details', editing ? detailsForm(p) : detailsView(p), ' id="mp-details"');

    // Email preferences
    cards += card('Email preferences',
      '<p style="margin: 0 0 16px">Pickup emails (confirmation, reminders and thank-yous) go to <strong>' + esc(p.email) + '</strong> while your pickups are on.</p>' +
      '<label style="display: flex; gap: 14px; align-items: flex-start; min-height: 44px; cursor: pointer"><input type="checkbox" data-newsletter ' + (p.newsletter ? 'checked' : '') + ' style="width: 22px; height: 22px; margin: 2px 0 0; flex: none; accent-color: #ce5352"><span><span style="font-weight: 700">Homegrown’s email list</span><span class="hg-hint" style="display: block">Events, SPARKS and more ways to back Alberta artists.</span></span></label>');

    // Stop
    if (!p.stopped) {
      cards += card('Stop pickups',
        '<p style="margin: 0 0 16px">Done for the season? We’ll take you off the route. You can sign up again anytime.</p>' +
        '<div id="mp-stop"><button type="button" class="hg-button hg-button--small" data-stop-ask>Stop my pickups</button></div>');
    } else {
      cards += card('Pickups stopped', '<p style="margin: 0 0 16px">You’re off the route. Want to start again?</p><a class="hg-button hg-button--small" href="./#book">Book a pickup</a>');
    }

    $('#mp-cards').innerHTML = cards;
    HG.syncChoices($('#mp-cards'));
  }

  function detailsView(p) {
    var rows = [['Name', p.name], ['Address', p.address], ['City', p.city], ['Area', p.zone], ['Bags', p.bags],
      ['Bags left at', p.bag_spot === 'Other' ? 'Other' : p.bag_spot], ['How often', p.frequency], ['Driver note', p.note || '—']];
    return '<dl class="hg-dl">' + rows.map(function (r) { return '<dt>' + r[0] + '</dt><dd>' + esc(r[1]) + '</dd>'; }).join('') + '</dl>' +
      '<p style="margin: 20px 0 0"><button type="button" class="hg-button hg-button--ghost hg-button--small" data-edit>Edit details</button></p>';
  }

  function chips(name, options, current) {
    return '<div class="hg-chips">' + options.map(function (o) {
      return '<label class="hg-choice"><input type="radio" name="' + name + '" value="' + esc(o) + '"' + (o === current ? ' checked' : '') + '>' + esc(o) + '</label>';
    }).join('') + '</div>';
  }

  function detailsForm(p) {
    var zones = String(HG.settings.zones || '').split(/\s*[,\n]\s*/).filter(Boolean);
    if (zones.indexOf(p.zone) === -1) zones.unshift(p.zone);
    return '<form id="mp-edit" novalidate style="display: flex; flex-direction: column; gap: 20px">' +
      '<div class="hg-field"><label for="mp-addr">Pickup address</label><input class="hg-input" id="mp-addr" name="address" autocomplete="street-address" value="' + esc(p.address) + '" required aria-describedby="mp-addr-err"><span class="hg-error" id="mp-addr-err"></span></div>' +
      '<fieldset class="hg-fieldset"><legend class="hg-legend">City</legend>' + chips('city', ['Calgary', 'Red Deer'], p.city) + '</fieldset>' +
      '<div class="hg-field"><label for="mp-zone">Area of the city</label><select class="hg-input" id="mp-zone" name="zone">' +
        zones.map(function (z) { return '<option' + (z === p.zone ? ' selected' : '') + '>' + esc(z) + '</option>'; }).join('') + '</select></div>' +
      '<fieldset class="hg-fieldset"><legend class="hg-legend">Roughly how many bags?</legend>' + chips('bags', BAGS, p.bags) + '</fieldset>' +
      '<div class="hg-field"><label for="mp-spot">Where will the bags be?</label><select class="hg-input" id="mp-spot" name="bag_spot">' +
        SPOTS.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (o[0] === p.bag_spot ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select></div>' +
      '<fieldset class="hg-fieldset"><legend class="hg-legend">How often?</legend>' + chips('frequency', ['Every Thursday', 'Just once'], p.frequency) + '</fieldset>' +
      '<div class="hg-field"><label for="mp-note">Note for the driver <span style="font-weight: 400; color: #33405a">(optional)</span></label><textarea class="hg-input" id="mp-note" name="note" maxlength="500" rows="3" aria-describedby="mp-note-err">' + esc(p.note) + '</textarea><span class="hg-error" id="mp-note-err"></span></div>' +
      '<div class="hg-actions"><button type="submit" class="hg-button hg-button--small">Save changes</button><button type="button" class="hg-linkbtn" data-cancel>Cancel</button></div>' +
      '</form>';
  }

  function act(action, extra, btn, okMsg) {
    if (btn) btn.disabled = true;
    return call(action, extra).then(function (res) {
      profile = res.profile;
      if (HG.preview) profile.preview = true;
      editing = false;
      render();
      if (okMsg) HG.toast(okMsg);
    }).catch(function (err) {
      if (btn) btn.disabled = false;
      HG.toast(err && err.code === 'validation' ? err.message : 'That didn’t save. Check your connection and try again.');
    });
  }

  function onClick(e) {
    var t = e.target.closest('button');
    if (!t) return;
    if (t.hasAttribute('data-signout')) {
      session(null); creds = null; profile = null;
      $('#mp-profile').hidden = true; $('#mp-summary').hidden = true; $('#mp-lookup').hidden = false;
      $('#mp-title').textContent = 'Your pickups, your way';
      $('#mp-intro').textContent = 'See your Thursdays, skip a week, update your details or stop pickups.';
      $('#mp-email').value = ''; $('#mp-code').focus();
      return;
    }
    if (t.hasAttribute('data-skip')) act('skip', { date: t.getAttribute('data-skip') }, t, 'Skipped ' + HG.fmtShort(t.getAttribute('data-skip')) + '.');
    if (t.hasAttribute('data-unskip')) act('unskip', { date: t.getAttribute('data-unskip') }, t, 'You’re back on for ' + HG.fmtShort(t.getAttribute('data-unskip')) + '.');
    if (t.hasAttribute('data-edit')) { editing = true; $('#mp-details').innerHTML = '<h2 class="hg-panel-title">Your details</h2>' + detailsForm(profile); HG.syncChoices($('#mp-details')); $('#mp-addr').focus(); }
    if (t.hasAttribute('data-cancel')) { editing = false; render(); $('#mp-details [data-edit]').focus(); }
    if (t.hasAttribute('data-stop-ask')) {
      $('#mp-stop').innerHTML = '<p style="margin: 0 0 14px; font-weight: 700">Stop all future pickups?</p><div class="hg-actions"><button type="button" class="hg-button hg-button--small" data-stop>Yes, stop</button><button type="button" class="hg-linkbtn" data-stop-cancel>Keep my pickups</button></div>';
      $('#mp-stop [data-stop-cancel]').focus();
    }
    if (t.hasAttribute('data-stop-cancel')) render();
    if (t.hasAttribute('data-stop')) act('stop', {}, t, 'Pickups stopped. Thank you!').then(function () { show(profile, true); });
  }

  function onSubmitEdit(e) {
    if (!e.target || e.target.id !== 'mp-edit') return;
    e.preventDefault();
    var f = e.target, radio = function (n) { var el = f.querySelector('input[name="' + n + '"]:checked'); return el ? el.value : ''; };
    var changes = {
      address: f.elements.address.value.trim(), city: radio('city'), zone: f.elements.zone.value,
      bags: radio('bags'), bag_spot: f.elements.bag_spot.value, frequency: radio('frequency'), note: f.elements.note.value.trim()
    };
    var addrBad = changes.address.length < 5, noteBad = changes.bag_spot === 'Other' && !changes.note;
    $('#mp-addr-err').textContent = addrBad ? 'Enter the street address we should pick up from.' : '';
    $('#mp-note-err').textContent = noteBad ? 'You chose “Other”: tell the driver where to find your bags.' : '';
    f.elements.address.toggleAttribute('aria-invalid', addrBad);
    f.elements.note.toggleAttribute('aria-invalid', noteBad);
    if (addrBad) return f.elements.address.focus();
    if (noteBad) return f.elements.note.focus();
    act('update', { changes: changes }, f.querySelector('button[type="submit"]'), 'Details saved.').then(function () {
      var b = $('#mp-details [data-edit]'); if (b) b.focus();
    });
  }

  function onChange(e) {
    if (e.target && e.target.hasAttribute('data-newsletter')) {
      var on = e.target.checked;
      act('newsletter', { subscribe: on }, e.target, on ? 'You’re on Homegrown’s email list.' : 'You’re off Homegrown’s email list.');
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    $('#mp-form').addEventListener('submit', onLookup);
    document.addEventListener('click', onClick);
    document.addEventListener('submit', onSubmitEdit);
    document.addEventListener('change', onChange);

    var params = new URLSearchParams(location.search);
    var qcode = normCode(params.get('code'));
    var saved = session();
    if (saved && saved.code && (!qcode || qcode === saved.code)) {
      $('#mp-code').value = saved.code; $('#mp-email').value = saved.email;
      lookup(saved.code, saved.email, true);
    } else if (qcode) {
      $('#mp-code').value = qcode;
      $('#mp-email').focus();
    }
  });
})();
