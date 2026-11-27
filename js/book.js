/* Homegrown Holiday Bottle Drive: landing page (index.html) behaviour */
(function () {
  'use strict';
  var HG = window.HG, $ = HG.$, $$ = HG.$$, esc = HG.esc;
  var CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I/L

  /* ---------- parts of the page driven by the Settings tab ---------- */
  HG.onSettings = function (s) {
    renderProgress(s);
    renderBuckets(s);
    renderPartners(s);
    renderZones(s);
    var link = $('#hg-partner-link');
    if (link) {
      if (!HG.blank(s.partner_link)) link.href = s.partner_link;
      else if (!HG.blank(s.contact_email)) link.href = 'mailto:' + s.contact_email + '?subject=' + encodeURIComponent('Bottle drive partnership');
    }
  };

  function num(v) {
    var n = parseFloat(String(v == null ? '' : v).replace(/[^0-9.]/g, ''));
    return isFinite(n) ? n : null;
  }

  // 20-block bar. Until an amount is entered, the mockup's bar stays as designed.
  function renderProgress(s) {
    var bar = $('#hg-progress'), raised = num(s.raised), goal = num(s.goal) || 2500;
    if (!bar || raised === null) return;
    var filled = Math.min(20, Math.round((raised / goal) * 20));
    if (raised > 0 && filled === 0) filled = 1;
    if (bar.getAttribute('data-filled') === String(filled)) return;
    bar.setAttribute('data-filled', filled);
    var html = '';
    for (var i = 0; i < 20; i++) {
      html += i < filled
        ? '<span class="hg-cell" style="animation-delay: ' + (0.9 + 0.09 * (i + 1)).toFixed(2) + 's; flex: 1 1 0; height: 22px; background: #edbe69"></span>'
        : '<span style="flex: 1 1 0; height: 22px; background: #2a3a57"></span>';
    }
    bar.innerHTML = html;
  }

  function renderBuckets(s) {
    var all = true;
    for (var n = 1; n <= 4; n++) {
      var pct = num(s['bucket_' + n + '_pct']), seg = $('[data-bucket="' + n + '"]');
      if (pct === null) { all = false; continue; }
      if (seg) seg.style.flex = pct + ' 1 0';
    }
    var note = $('#hg-split-note');
    if (note) note.hidden = all;
  }

  // One partner per line in the Settings tab: Name | logo URL | website (logo and website optional)
  function renderPartners(s) {
    var box = $('#hg-partners'), grid = $('#hg-logos');
    if (!box || !grid) return;
    var list = String(s.partners || '').split(/\n+/).map(function (line) {
      var p = line.split('|').map(function (x) { return x.trim(); });
      return { name: p[0], logo: p[1], url: p[2] };
    }).filter(function (p) { return p.name; });
    box.hidden = list.length < 3; // the brief: hide the grid until 3+ venues sign on
    if (list.length < 3) return;
    var slot = 'height: 88px; border: 3px solid #0a1428; display: flex; align-items: center; justify-content: center; font-family: \'Silkscreen\', monospace; font-size: 16px; color: #101e37; text-align: center; padding: 8px; box-sizing: border-box; background: #ffffff; text-decoration: none';
    grid.innerHTML = list.map(function (p) {
      var inner = p.logo && /^https?:\/\//.test(p.logo) ? '<img src="' + esc(p.logo) + '" alt="' + esc(p.name) + '">' : esc(p.name);
      return p.url && /^https?:\/\//.test(p.url)
        ? '<a class="hg-logo-slot" href="' + esc(p.url) + '" rel="noopener" style="' + slot + '">' + inner + '</a>'
        : '<div class="hg-logo-slot" style="' + slot + '">' + inner + '</div>';
    }).join('');
  }

  function renderZones(s) {
    var sel = $('#h-zone');
    if (!sel || HG.blank(s.zones)) return;
    var zones = String(s.zones).split(/\s*[,\n]\s*/).filter(Boolean);
    var current = sel.value;
    sel.innerHTML = '<option value="">Choose your area</option>' + zones.map(function (z) {
      return '<option' + (z === current ? ' selected' : '') + '>' + esc(z) + '</option>';
    }).join('');
  }

  /* ---------- validation ---------- */
  var form, alertBox, button;

  function setError(el, errId, msg) {
    var err = document.getElementById(errId);
    if (err) err.textContent = msg || '';
    if (el) {
      if (msg) el.setAttribute('aria-invalid', 'true');
      else el.removeAttribute('aria-invalid');
    }
    return !msg;
  }

  function value(name) {
    var el = form.elements[name];
    if (!el) return '';
    if (el.type === 'checkbox') return el.checked;
    return (el.value || '').trim();
  }

  function validate() {
    var firstBad = null;
    function check(ok, el) { if (!ok && !firstBad) firstBad = el; }
    var name = value('name'), email = value('email'), address = value('address');

    check(setError(form.elements.name, 'h-name-err', name.length < 2 ? 'Enter your name.' : ''), form.elements.name);
    check(setError(form.elements.email, 'h-email-err',
      !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ? 'Enter an email address, like name@example.com.' : ''), form.elements.email);
    check(setError(form.elements.address, 'h-addr-err', address.length < 5 ? 'Enter the street address we should pick up from.' : ''), form.elements.address);
    var cityOk = !!form.querySelector('input[name="city"]:checked');
    check(setError(null, 'err-city', cityOk ? '' : 'Choose Calgary or Red Deer.'), form.querySelector('input[name="city"]'));
    check(setError(form.elements.zone, 'h-zone-err', value('zone') ? '' : 'Choose the area of the city you’re in.'), form.elements.zone);
    var bagsOk = !!form.querySelector('input[name="bags"]:checked');
    check(setError(null, 'err-bags', bagsOk ? '' : 'Choose roughly how many bags.'), form.querySelector('input[name="bags"]'));
    check(setError(form.elements.bag_spot, 'h-spot-err', value('bag_spot') ? '' : 'Tell us where the bags will be.'), form.elements.bag_spot);
    var freqOk = !!form.querySelector('input[name="frequency"]:checked');
    check(setError(null, 'err-frequency', freqOk ? '' : 'Choose every Thursday or just once.'), form.querySelector('input[name="frequency"]'));
    check(setError(form.elements.note, 'h-note-err',
      value('bag_spot') === 'Other' && !value('note') ? 'You chose “Other”: tell the driver where to find your bags.' : ''), form.elements.note);
    var consent = form.elements.consent_pickup_emails;
    check(setError(consent, 'err-consent', consent.checked ? '' : 'Tick “Email me about my pickups”. We need it to send your pickup code and reminders.'), consent);

    if (firstBad) firstBad.focus();
    return !firstBad;
  }

  function radio(name) {
    var el = form.querySelector('input[name="' + name + '"]:checked');
    return el ? el.value : '';
  }

  function payload() {
    return {
      name: value('name'),
      email: value('email'),
      address: value('address'),
      city: radio('city'),
      zone: value('zone'),
      bags: radio('bags'),
      bag_spot: value('bag_spot'),
      frequency: radio('frequency'),
      note: value('note'),
      consent_pickup_emails: form.elements.consent_pickup_emails.checked,
      consent_newsletter: form.elements.consent_newsletter.checked,
      website: value('website') // honeypot
    };
  }

  function previewCode() {
    var out = 'HG-', buf = new Uint32Array(4);
    (window.crypto || window.msCrypto).getRandomValues(buf);
    for (var i = 0; i < 4; i++) out += CODE_CHARS[buf[i] % CODE_CHARS.length];
    return out;
  }

  function showAlert(html) {
    alertBox.innerHTML = html;
    alertBox.hidden = false;
    alertBox.focus();
  }

  /* ---------- confirmation screen ---------- */
  function renderConfirm(data, sent) {
    var s = HG.settings;
    var time = HG.blank(s.bags_out_time) ? '[TIME]' : s.bags_out_time;
    var first = data.first_pickup ? HG.fmtLong(data.first_pickup) : 'the next pickup Thursday';
    var once = sent.frequency === 'Just once';
    var spot = sent.bag_spot === 'Other' ? 'the spot you described' : 'your ' + sent.bag_spot.toLowerCase();
    var firstName = sent.name.split(/\s+/)[0];
    var mail = HG.blank(s.contact_email) ? '' : ' or email <a href="mailto:' + esc(s.contact_email) + '">' + esc(s.contact_email) + '</a>';

    var html = '';
    if (data.preview) {
      html += '<div class="hg-alert"><strong>Preview only</strong>The sign-up form isn’t connected to the Google Sheet yet, so nothing was saved and no email was sent. This code is a sample.</div>';
    }
    html +=
      '<div><p class="hg-eyebrow">You’re on the route</p>' +
      '<h3 class="hg-h3" id="hg-confirm-title" tabindex="-1">Thanks, ' + esc(firstName) + '! You’re booked.</h3></div>' +
      '<div class="hg-codebox">' +
        '<div><span class="hg-label">Your pickup code</span><span class="hg-code">' + esc(data.code) + '</span></div>' +
        '<div><span class="hg-label">First pickup</span><span class="hg-date">' + esc(first) + '</span></div>' +
      '</div>' +
      '<p style="margin:0;font-size:18px;line-height:1.5">' +
        (once ? 'Just this once: we’ll come by on ' + esc(first) + '.'
              : 'Then every Thursday after that, until you skip a week or stop.') +
      '</p>' +
      '<div><h4 class="hg-eyebrow" style="font-weight:700">Next steps</h4><ol class="hg-steps">' +
        '<li><span class="hg-n" aria-hidden="true">1</span><span><strong>Check your email.</strong> ' +
          (data.email_sent === false && !data.preview
            ? 'We couldn’t send your confirmation email just now, so keep a note of your code. We’ll try again.'
            : 'We sent your code to ' + esc(sent.email) + '. Not there? Check your spam folder.') + '</span></li>' +
        '<li><span class="hg-n" aria-hidden="true">2</span><span><strong>Mark your bags “Homegrown”.</strong> Any marker or sticky note works.</span></li>' +
        '<li><span class="hg-n" aria-hidden="true">3</span><span><strong>Bags out by ' + esc(time) + ' on Thursday</strong>, at ' + esc(spot) + '. No need to be home.</span></li>' +
      '</ol></div>' +
      '<div class="hg-note">Need to skip a week, change your details or stop? Use <strong>My pickup</strong> with your code and email' + mail + '.</div>' +
      '<div class="hg-actions">' +
        '<a class="hg-button hg-btn" href="my-pickup.html?code=' + encodeURIComponent(data.code) + '">Go to My pickup</a>' +
        '<button type="button" class="hg-linkbtn" data-again>Book another address</button>' +
      '</div>';

    var box = $('#hg-confirm');
    box.innerHTML = html;
    form.hidden = true;
    box.hidden = false;
    var card = $('#hg-book-card');
    if (card && card.getBoundingClientRect().top < 0) card.scrollIntoView({ block: 'start' });
    $('#hg-confirm-title').focus({ preventScroll: true });

    box.querySelector('[data-again]').addEventListener('click', function () {
      form.reset();
      form.elements.consent_pickup_emails.checked = false;
      HG.syncChoices(form);
      box.hidden = true;
      form.hidden = false;
      form.elements.name.focus();
    });
  }

  /* ---------- submit ---------- */
  function onSubmit(e) {
    e.preventDefault();
    alertBox.hidden = true;
    if (!validate()) return;
    var data = payload();
    if (data.website) return; // bot

    button.disabled = true;
    var label = button.textContent;
    button.textContent = 'Booking…';

    var done = function () { button.disabled = false; button.textContent = label; };

    if (HG.preview) {
      setTimeout(function () {
        done();
        renderConfirm({ code: previewCode(), first_pickup: HG.firstPickup(HG.settings), preview: true }, data);
      }, 500);
      return;
    }

    HG.api('register', data).then(function (res) {
      done();
      renderConfirm(res, data);
    }).catch(function (err) {
      done();
      var mail = HG.blank(HG.settings.contact_email) ? '' :
        ' If it keeps happening, email <a href="mailto:' + esc(HG.settings.contact_email) + '">' + esc(HG.settings.contact_email) + '</a>.';
      showAlert('<strong>We couldn’t book your pickup.</strong>' +
        esc(err && err.code === 'validation' ? err.message : 'Check your connection and try again.') + mail);
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    form = $('#hg-form');
    if (!form) return;
    alertBox = $('#hg-form-alert');
    button = form.querySelector('button[type="submit"]');
    form.addEventListener('submit', onSubmit);
    // Clear a field's error as soon as it's fixed
    form.addEventListener('input', function (e) {
      if (e.target.getAttribute('aria-invalid') === 'true') {
        e.target.removeAttribute('aria-invalid');
        var ids = (e.target.getAttribute('aria-describedby') || '').split(' ');
        ids.forEach(function (id) { if (/err/.test(id)) { var el = document.getElementById(id); if (el) el.textContent = ''; } });
      }
    });
    form.addEventListener('change', function (e) {
      if (e.target.type === 'radio' || e.target.type === 'checkbox') {
        var fs = e.target.closest('fieldset');
        var errId = fs ? fs.getAttribute('aria-describedby') : e.target.getAttribute('aria-describedby');
        if (errId) { var el = document.getElementById(errId); if (el) el.textContent = ''; }
        e.target.removeAttribute('aria-invalid');
      }
    });
  });
})();
