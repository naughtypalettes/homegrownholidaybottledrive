/* Homegrown Holiday Bottle Drive: shared runtime for index.html and my-pickup.html */
(function () {
  'use strict';

  var CFG = window.HG_CONFIG || {};
  var HG = (window.HG = {});
  var TZ = 'America/Edmonton';
  var CACHE_KEY = 'hg-settings-v1';
  var MOTION_KEY = 'hg-motion';
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  HG.config = CFG;
  HG.preview = !CFG.appsScriptUrl;

  /* ---------- small utilities ---------- */
  function store(fn) { try { return fn(window.localStorage); } catch (e) { return null; } }
  function blank(v) { return v === undefined || v === null || String(v).trim() === ''; }
  HG.blank = blank;
  HG.$ = function (sel, root) { return (root || document).querySelector(sel); };
  HG.$$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  HG.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  /* ---------- dates (all in Alberta time) ----------
     Same rules as apps-script/Code.gs, which has the final say on a donor's first pickup. */
  function addDays(ymd, n) {
    var d = new Date(ymd + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }
  function weekday(ymd) { return new Date(ymd + 'T00:00:00Z').getUTCDay(); }
  function isYmd(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s || '').trim()); }

  // "18:00", "6pm", "6:30 pm", "noon" -> "18:00" (null when it can't be read)
  function parseTime(s) {
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
  function prettyTime(hm) {
    var h = +hm.slice(0, 2), m = hm.slice(3);
    var suffix = h >= 12 ? 'pm' : 'am';
    h = h % 12 || 12;
    return h + (m === '00' ? '' : ':' + m) + ' ' + suffix;
  }
  function parseDay(s) {
    s = String(s || '').trim().toLowerCase();
    if (!s) return -1;
    for (var i = 0; i < 7; i++) if (DAYS[i].toLowerCase().indexOf(s.slice(0, 3)) === 0) return i;
    return -1;
  }

  // Current date and time in Alberta, e.g. { ymd: '2026-12-08', hm: '14:05' }
  HG.nowAB = function () {
    var parts = {};
    new Intl.DateTimeFormat('en-CA', {
      timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(new Date()).forEach(function (p) { parts[p.type] = p.value; });
    return { ymd: parts.year + '-' + parts.month + '-' + parts.day, hm: parts.hour + ':' + parts.minute };
  };

  function skipList(s) {
    return String(s.skip_dates || '').split(/[\s,;]+/).filter(isYmd);
  }

  // Every pickup Thursday in the campaign (minus skip_dates). Without an end date: 26 weeks.
  HG.pickupThursdays = function (s) {
    var start = isYmd(s.campaign_start) ? s.campaign_start : '2026-12-10';
    while (weekday(start) !== 4) start = addDays(start, 1);
    var end = isYmd(s.end_date) ? s.end_date : addDays(start, 7 * 26);
    var skips = skipList(s), out = [];
    for (var d = start; d <= end; d = addDays(d, 7)) if (skips.indexOf(d) === -1) out.push(d);
    return out;
  };

  // Sign-up cutoff for a given Thursday. With no cutoff set yet, the fallback is
  // the end of the Wednesday before (a technical stand-in, not a confirmed rule).
  HG.cutoffFor = function (thu, s) {
    var day = parseDay(s.cutoff_day), time = parseTime(s.cutoff_time) || '23:59';
    if (day === -1) return { ymd: addDays(thu, -1), hm: '23:59' };
    return { ymd: addDays(thu, -((4 - day + 7) % 7)), hm: time };
  };
  HG.beforeCutoff = function (thu, s, now) {
    now = now || HG.nowAB();
    var c = HG.cutoffFor(thu, s);
    return now.ymd < c.ymd || (now.ymd === c.ymd && now.hm <= c.hm);
  };
  HG.firstPickup = function (s, now) {
    var list = HG.pickupThursdays(s);
    for (var i = 0; i < list.length; i++) if (HG.beforeCutoff(list[i], s, now)) return list[i];
    return null;
  };

  HG.fmtShort = function (ymd) { // "Thu · Dec 10"
    var p = ymd.split('-');
    return DAYS[weekday(ymd)].slice(0, 3) + ' · ' + MONTHS[+p[1] - 1] + ' ' + +p[2];
  };
  HG.fmtLong = function (ymd) { // "Thursday, December 10"
    var p = ymd.split('-');
    return DAYS[weekday(ymd)] + ', ' + MONTHS_LONG[+p[1] - 1] + ' ' + +p[2];
  };
  HG.fmtMonthDay = function (ymd) { // "Jan 28"
    var p = ymd.split('-');
    return MONTHS[+p[1] - 1] + ' ' + +p[2];
  };
  HG.cutoffText = function (s) {
    var day = parseDay(s.cutoff_day);
    if (day === -1) return '';
    var t = parseTime(s.cutoff_time);
    return DAYS[day] + (t ? ' at ' + prettyTime(t) : '');
  };

  /* ---------- settings: config.js defaults + Sheet "Settings" tab ---------- */
  HG.settings = Object.assign({}, CFG.settings || {});

  HG.api = function (action, payload) {
    if (HG.preview) return Promise.reject(new Error('preview'));
    // text/plain keeps this a "simple" request, so Apps Script needs no CORS preflight.
    return fetch(CFG.appsScriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(Object.assign({ action: action }, payload || {}))
    }).then(function (r) {
      if (!r.ok) throw new Error('Network error ' + r.status);
      return r.json();
    }).then(function (data) {
      if (!data || data.ok !== true) {
        var err = new Error((data && data.error) || 'Something went wrong.');
        err.code = data && data.code;
        throw err;
      }
      return data;
    });
  };

  function merge(remote) {
    Object.keys(remote || {}).forEach(function (k) {
      if (!blank(remote[k])) HG.settings[k] = String(remote[k]);
      else if (!(k in (CFG.settings || {}))) HG.settings[k] = '';
    });
  }

  HG.loadSettings = function () {
    var cached = store(function (ls) { return JSON.parse(ls.getItem(CACHE_KEY) || 'null'); });
    if (cached) merge(cached);
    HG.applySettings();
    if (HG.preview) return Promise.resolve(HG.settings);
    return fetch(CFG.appsScriptUrl + '?action=settings')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data && data.ok && data.settings) {
          merge(data.settings);
          store(function (ls) { ls.setItem(CACHE_KEY, JSON.stringify(data.settings)); });
          HG.applySettings();
        }
        return HG.settings;
      })
      .catch(function () { return HG.settings; });
  };

  function money(v) {
    var n = Number(String(v).replace(/[^0-9.]/g, ''));
    if (!isFinite(n) || String(v).replace(/[^0-9.]/g, '') === '') return String(v);
    return '$' + n.toLocaleString('en-CA', { maximumFractionDigits: 0 });
  }
  HG.money = money;

  // Fills every [data-cfg] slot. A blank setting keeps the [PLACEHOLDER];
  // a single "-" hides the slot (for "confirmed: nothing to add").
  HG.applySettings = function () {
    var s = HG.settings;
    HG.$$('[data-cfg]').forEach(function (el) {
      if (!el.hasAttribute('data-placeholder')) el.setAttribute('data-placeholder', el.textContent);
      var key = el.getAttribute('data-cfg'), fmt = el.getAttribute('data-fmt'), v = s[key];
      el.hidden = false;
      if (blank(v)) { el.textContent = el.getAttribute('data-placeholder'); return; }
      if (String(v).trim() === '-') { el.hidden = true; return; }
      if (fmt === 'money') v = money(v);
      if (fmt === 'date' && isYmd(v)) v = HG.fmtMonthDay(v);
      if (fmt === 'pct') v = String(v).replace(/%?\s*$/, '%');
      if (fmt === 'email') {
        el.innerHTML = '<a href="mailto:' + HG.esc(v) + '" style="color:inherit">' + HG.esc(v) + '</a>';
        return;
      }
      el.textContent = v;
    });

    var cutoff = HG.cutoffText(s);
    HG.$$('[data-cutoff]').forEach(function (el) {
      if (!el.hasAttribute('data-placeholder')) el.setAttribute('data-placeholder', el.textContent);
      el.textContent = cutoff || el.getAttribute('data-placeholder');
    });

    var next = HG.firstPickup(s);
    HG.$$('[data-next-pickup]').forEach(function (el) {
      el.textContent = next ? HG.fmtShort(next) : 'Drive has wrapped';
    });

    HG.$$('a[data-link]').forEach(function (a) {
      var href = (CFG.links || {})[a.getAttribute('data-link')];
      if (href) a.setAttribute('href', href);
    });

    if (HG.onSettings) HG.onSettings(s);
  };

  /* ---------- motion: prefers-reduced-motion + a manual pause switch ---------- */
  function setMotion(still) {
    HG.$$('.hg-root').forEach(function (r) {
      r.classList.toggle('hg-still', still);
      r.classList.toggle('hg-moving', !still);
    });
    HG.$$('[data-motion-toggle]').forEach(function (b) {
      b.setAttribute('aria-pressed', still ? 'true' : 'false');
      b.textContent = still ? 'Play animations' : 'Pause animations';
    });
  }

  /* ---------- scroll reveal fallback for browsers without view() timelines ---------- */
  function revealFallback() {
    var supported = window.CSS && CSS.supports && CSS.supports('animation-timeline: view()');
    if (supported || !('IntersectionObserver' in window)) return;
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (document.querySelector('.hg-still')) return;
    var els = HG.$$('.hg-reveal, .hg-grow');
    els.forEach(function (el) {
      el.style.opacity = '0';
      el.style.transform = el.classList.contains('hg-grow') ? 'scaleX(0)' : 'translateY(24px)';
      el.style.transformOrigin = el.classList.contains('hg-grow') ? '0 50%' : '';
      el.style.transition = 'opacity .6s cubic-bezier(.2,.8,.2,1), transform .6s cubic-bezier(.2,.8,.2,1)';
    });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.style.opacity = '';
        e.target.style.transform = '';
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -10% 0px' });
    els.forEach(function (el) { io.observe(el); });
  }

  /* ---------- radio chips mirror their checked state (for browsers without :has) ---------- */
  HG.syncChoices = function (root) {
    HG.$$('.hg-choice', root).forEach(function (label) {
      var input = label.querySelector('input');
      label.classList.toggle('is-checked', !!(input && input.checked));
    });
  };

  HG.toast = function (msg) {
    var t = HG.$('#hg-toast');
    if (!t) return;
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(HG._toastTimer);
    HG._toastTimer = setTimeout(function () { t.hidden = true; }, 3500);
  };

  document.addEventListener('DOMContentLoaded', function () {
    var saved = store(function (ls) { return ls.getItem(MOTION_KEY); });
    setMotion(saved === 'still');
    HG.$$('[data-motion-toggle]').forEach(function (b) {
      b.addEventListener('click', function () {
        var still = b.getAttribute('aria-pressed') !== 'true';
        setMotion(still);
        store(function (ls) { ls.setItem(MOTION_KEY, still ? 'still' : 'moving'); });
      });
    });

    document.addEventListener('change', function (e) {
      if (e.target && e.target.type === 'radio') HG.syncChoices(document);
    });
    HG.syncChoices(document);

    HG.$$('[data-share]').forEach(function (b) {
      b.addEventListener('click', function () {
        var data = { title: document.title, text: 'Free bottle pickup every Thursday in Calgary and Red Deer. Every refund funds artist mental health.', url: location.href.split('#')[0] };
        if (navigator.share) { navigator.share(data).catch(function () {}); return; }
        if (navigator.clipboard) {
          navigator.clipboard.writeText(data.url).then(function () { HG.toast('Link copied. Paste it anywhere to share.'); },
            function () { HG.toast(data.url); });
        } else HG.toast(data.url);
      });
    });

    revealFallback();
    HG.loadSettings();
  });
})();
