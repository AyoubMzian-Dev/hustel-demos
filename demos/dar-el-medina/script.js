/* ============================================================
   Restaurant landing template — behavior layer (vanilla JS)
   Integrator build:
   - Business facts come from config.js -> window.CONFIG
     (compiled from config.json: brand/business/seo/images)
   - ALL visible strings come from locales/<lang>.json
     (copywriter's rich section structures)
   - RTL for Arabic, mobile nav, open/closed status,
     lightbox, language switcher.
   ============================================================ */
(function () {
  'use strict';

  var CFG = window.CONFIG || {};
  var LOCALES = {};          // cache of fetched locale JSON
  var lang = null;
  var ITEMS_ORDER = ['starters', 'mains', 'desserts', 'drinks'];

  function detectLang() {
    var saved = null;
    try { saved = localStorage.getItem('tpl-lang'); } catch (e) {}
    var l = saved || (navigator.language || 'fr').slice(0, 2).toLowerCase();
    if (['fr', 'en', 'ar'].indexOf(l) === -1) l = 'fr';
    return l;
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* dotted-path getter over the active locale file */
  function t(path) {
    var parts = path.split('.');
    var v = LOCALES[lang];
    for (var i = 0; i < parts.length; i++) {
      if (v == null) break;
      v = v[parts[i]];
    }
    if (v == null) { // fall back to French
      v = LOCALES.fr;
      for (var j = 0; j < parts.length && v != null; j++) v = v[parts[j]];
    }
    return v == null ? path : v;
  }

  /* ---------- Config helpers ---------- */
  function applyTheme() {
    var th = CFG.theme || {};
    var map = {
      primary: '--color-primary', primaryDark: '--color-primary-dark',
      accent: '--color-accent', bg: '--color-bg', surface: '--color-surface',
      surface2: '--color-surface-2',
      text: '--color-text', text2: '--color-text-2', textMuted: '--color-text-2',
      open: '--color-open', closed: '--color-closed',
      overlay: '--color-overlay',
      fontHeading: '--font-heading', fontBody: '--font-body'
    };
    // gold hairline alphas derived from primary color if provided
    function hexToRgb(hex) {
      hex = hex.replace('#','');
      if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
      var n = parseInt(hex,16);
      return [(n>>16)&255,(n>>8)&255,n&255].join(',');
    }
    if (th.primary) {
      var rgb = th.primary.startsWith('#') ? hexToRgb(th.primary) : '201,162,39';
      var alphas = {'--line-gold-07':'.07','--line-gold-08':'.08','--line-gold-12':'.12','--line-gold-15':'.15'};
      Object.keys(alphas).forEach(function(k){
        document.documentElement.style.setProperty(k,'rgba('+rgb+','+alphas[k]+')');
      });
      document.documentElement.style.setProperty('--line','rgba('+rgb+',.28)');
    }
    Object.keys(map).forEach(function (k) {
      if (th[k]) document.documentElement.style.setProperty(map[k], th[k]);
    });
  }
  /* ---------- Marquee ---------- */
  function applyMarquee() {
    var track = document.getElementById('marqueeTrack');
    if (!track) return;
    var items = (LOCALES[lang] && LOCALES[lang].marquee) || ['Cuisine marocaine', 'Fait maison', 'Produits frais'];
    track.innerHTML = '';
    for (var r = 0; r < 4; r++) items.forEach(function (it) {
      var sp = document.createElement('span'); sp.textContent = it; track.appendChild(sp);
    });
  }

  /* ---------- Rating badge ---------- */
  function applyRating() {
    var badge = document.getElementById('ratingBadge');
    if (!badge) return;
    var seo = CFG.seo || {}, rating = CFG.rating || {};
    var val = rating.value, count = rating.count;
    if (!val) return;
    document.getElementById('ratingValue').textContent = val + '/5';
    var cnt = (LOCALES[lang] && LOCALES[lang].reviews_count) || 'avis';
    document.getElementById('ratingCount').textContent = '(' + (count || '') + ' ' + cnt + ')';
    badge.hidden = false;
  }

  /* ---------- Sticky contact bar ---------- */
  function applyContactBar() {
    var call = document.getElementById('barCall');
    var wa = document.getElementById('barWa');
    if (call && CFG.phone) call.href = 'tel:' + String(CFG.phone).replace(/\s+/g,'');
    if (wa) {
      var num = CFG.whatsapp ? String(CFG.whatsapp).replace(/[^0-9]/g,'') : String(CFG.phone||'').replace(/[^0-9]/g,'');
      wa.href = 'https://wa.me/' + num;
      wa.style.display = num ? '' : 'none';
    }
  }

  function addressOneLine() {
    var a = CFG.address || {};
    return [a.street, a.district, a.city].filter(Boolean).join(', ');
  }

  /* ---------- Apply static text hooks ---------- */
  function applyI18n() {
    document.documentElement.lang = lang;
    document.documentElement.dir = (lang === 'ar') ? 'rtl' : 'ltr';
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var v = t(el.getAttribute('data-i18n'));
      el.textContent = typeof v === 'string' ? v : el.getAttribute('data-i18n');
    });
    // title & meta description from config.seo (localized)
    if (CFG.seo && CFG.seo.title && CFG.seo.title[lang]) {
      document.title = CFG.seo.title[lang];
    } else {
      document.title = (CFG.name || '') +
        (document.body.classList.contains('page-menu') ? ' — ' + t('menu.title') : '');
    }
    var md = document.querySelector('meta[name="description"]');
    if (md && CFG.seo && CFG.seo.description && CFG.seo.description[lang]) {
      md.setAttribute('content', CFG.seo.description[lang]);
    }
    var sel = document.getElementById('langSwitch');
    if (sel) sel.value = lang;
  }

  /* ---------- Open / closed status ---------- */
  function parseHM(hm) {
    var p = String(hm).split(':');
    return (+p[0]) * 60 + (+p[1]);
  }
  /* Returns array of 7 booleans (Mon..Sun): is this group open that day */
  function groupDays(g) {
    if (g.days) return g.days;
    return [];
  }
  function allHours() {
    return CFG.hours || (CFG.business && CFG.business.hours) || [];
  }
  function groupsForDay(idx) {
    return allHours().filter(function (g) {
      return groupDays(g).indexOf(idx) !== -1;
    });
  }
  function isOpenNow() {
    var now = new Date();
    var idx = (now.getDay() + 6) % 7;         // Monday = 0
    var mins = now.getHours() * 60 + now.getMinutes();
    // today's groups
    var open = groupsForDay(idx).some(function (g) {
      var o = parseHM(g.open), c = parseHM(g.close);
      if (c <= o) c += 1440;
      return mins >= o && mins < c;
    });
    if (open) return true;
    // yesterday's groups that spill past midnight (e.g. close 00:30)
    return groupsForDay((idx + 6) % 7).some(function (g) {
      var o = parseHM(g.open), c = parseHM(g.close);
      if (c <= o) return mins + 1440 >= o && mins + 1440 < c; // crosses midnight
      return false;
    });
  }
  function updateStatus() {
    var badge = document.getElementById('openStatus');
    var txt = document.getElementById('openStatusText');
    if (!badge || !txt) return;
    var open = isOpenNow();
    badge.classList.toggle('is-closed', !open);
    txt.textContent = t(open ? 'status.open_now' : 'status.closed_now');
  }

  /* ---------- Hours list ---------- */
  function renderHours() {
    var ul = document.getElementById('hoursList');
    var groups = allHours();
    if (!ul || !groups.length) return;
    var todayIdx = (new Date().getDay() + 6) % 7;
    var html = '';
    groups.forEach(function (g) {
      var days = groupDays(g);
      var isToday = days.indexOf(todayIdx) !== -1;
      var dayLabel = (g.days_label && g.days_label[lang]) ||
        (g.label && g.label[lang]) || '';
      var time = g.open ? g.open + ' – ' + g.close : '—';
      html += '<li class="' + (isToday ? 'is-today' : '') + '">' +
        '<span>' + esc(dayLabel) + '</span><span>' + esc(time) + '</span></li>';
    });
    ul.innerHTML = html;
  }

  /* ---------- Contact / links ---------- */
  function applyLinks() {
    var tel = 'tel:' + String(CFG.phone || '').replace(/[^+\d]/g, '');
    document.querySelectorAll('[data-link="tel"]').forEach(function (a) { a.href = tel; });
    var reserve = (CFG.reservation && CFG.reservation.enabled && CFG.reservation.url) || tel;
    document.querySelectorAll('[data-link="reserve"]').forEach(function (a) { a.href = reserve; });
    var wa = CFG.whatsapp ||
      (CFG.phone ? 'https://wa.me/' + String(CFG.phone).replace(/[^\d]/g, '') : '');
    document.querySelectorAll('[data-link="whatsapp"]').forEach(function (a) { a.href = wa; });
    var ig = CFG.social && CFG.social.instagram;
    if (ig) document.querySelectorAll('[data-link="instagram"]').forEach(function (a) { a.href = ig; });
    var fb = CFG.social && CFG.social.facebook;
    if (fb) document.querySelectorAll('[data-link="facebook"]').forEach(function (a) { a.href = fb; });
    var ta = CFG.social && CFG.social.tripadvisor;
    if (ta) document.querySelectorAll('[data-link="tripadvisor"]').forEach(function (a) { a.href = ta; });
    var em = CFG.email;
    if (em) document.querySelectorAll('[data-link="email"]').forEach(function (a) { a.href = 'mailto:' + em; });
    var mq = CFG.address && CFG.address.mapsQuery;
    if (mq) document.querySelectorAll('[data-link="maps"]').forEach(function (a) {
      a.href = 'https://maps.google.com/?q=' + encodeURIComponent(mq);
      a.target = '_blank'; a.rel = 'noopener';
    });

    // plain-text business facts
    document.querySelectorAll('[data-cfg="name"]').forEach(function (el) { el.textContent = CFG.name || ''; });
    document.querySelectorAll('[data-cfg="address"]').forEach(function (el) { el.textContent = addressOneLine(); });
    document.querySelectorAll('[data-cfg="phone_display"]').forEach(function (el) { el.textContent = CFG.phone || ''; });
    document.querySelectorAll('[data-cfg="email"]').forEach(function (el) { el.textContent = CFG.email || ''; });

    var map = document.getElementById('mapEmbed');
    if (map) map.src = 'https://www.google.com/maps?q=' +
      encodeURIComponent((CFG.address && CFG.address.mapsQuery) || addressOneLine()) + '&output=embed';
    var yr = document.getElementById('year');
    if (yr) yr.textContent = new Date().getFullYear();
  }

  /* ---------- Hero media (circular gold ring) ---------- */
  function applyHeroMedia() {
    var el = document.getElementById('heroRing');
    if (!el) return;
    /* hero image comes from config.images.hero — restaurant interior beats food */
    var src = (CFG.images && CFG.images.hero) || '';
    if (src) {
      var img = document.createElement('img');
      img.src = src;
      img.alt = '';
      img.onerror = function () { img.remove(); };
      el.appendChild(img);
    }
  }

  /* ---------- About / stats / features ---------- */
  function renderAbout() {
    var wrap = document.getElementById('aboutStats');
    if (!wrap) return;
    wrap.innerHTML = '';   // clear so language switches don't append duplicates
    ['statYears', 'statDishes', 'statGuests'].forEach(function (k) {
      var v = t('about.' + k);
      if (typeof v === 'string') wrap.innerHTML += '<div class="stat">' + esc(v) + '</div>';
    });
  }
  /* inline SVG icon set (stroke = currentColor) — no emojis per design rules */
  var ICONS = {
    terrace: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20"/><path d="M2 9l10-5 10 5"/><path d="M4 9v3a2 2 0 0 0 4 0V9"/><path d="M10 9v3a2 2 0 0 0 4 0V9"/><path d="M16 9v3a2 2 0 0 0 4 0V9"/></svg>',
    music: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
    leaf: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>',
    chef: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 1.05-1.54 5 5 0 0 1 7.08 0A5.11 5.11 0 0 1 16.59 6 4 4 0 0 1 18 13.87V21H6Z"/><line x1="6" x2="18" y1="17" y2="17"/></svg>',
    wifi: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13a10 10 0 0 1 14 0"/><path d="M8.5 16.5a5 5 0 0 1 7 0"/><path d="M2 8.82a15 15 0 0 1 20 0"/><line x1="12" x2="12.01" y1="20" y2="20"/></svg>',
    group: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>'
  };
  function renderFeatures() {
    var grid = document.getElementById('featureGrid');
    if (!grid) return;
    var items = t('features.items');
    if (!Array.isArray(items)) return;
    grid.innerHTML = items.map(function (f) {
      var icon = ICONS[f.icon] || '';
      return '<article class="feature-card">' +
        '<span class="feature-icon" aria-hidden="true">' + icon + '</span>' +
        '<h3>' + esc(f.title) + '</h3>' +
        '<p>' + esc(f.desc) + '</p></article>';
    }).join('');
  }

  /* ---------- Menu ---------- */
  function itemsByCat() {
    var items = t('menu.items');
    var by = {};
    (Array.isArray(items) ? items : []).forEach(function (it) {
      (by[it.category] = by[it.category] || []).push(it);
    });
    return by;
  }
  /* name-keyed photo map so each dish shows ITS OWN image */
  function photoMap() {
    var m = {};
    ((CFG.images && CFG.images.dishes) || []).forEach(function (d) {
      if (d && d.name && d.src) m[d.name] = d.src;
    });
    return m;
  }
  function renderFeatured() {
    var grid = document.getElementById('dishGrid');
    if (!grid) return;
    var by = itemsByCat();
    var picks = (by.mains || []).slice(0, 3).concat((by.desserts || []).slice(0, 1));
    var pm = photoMap();
    var gal = ((CFG.images && CFG.images.gallery) || []).slice(0, 5);
    grid.innerHTML = picks.map(function (d, i) {
      var photo = pm[d.name] || gal[i % Math.max(gal.length, 1)] || '';
      return '<article class="dish-card">' +
      '<div class="dish-photo">' +
        '<img src="' + esc(photo) + '" alt="' + esc(d.name) + '" loading="lazy">' +
      '</div>' +
      '<div class="dish-body"><div class="dish-row">' +
        '<span class="dish-name">' + esc(d.name) + '</span>' +
        '<span class="dish-price">' + esc(d.price) + '</span>' +
      '</div>' +
      '<p class="dish-desc">' + esc(d.desc) + '</p></div></article>';
    }).join('');
  }
  function renderFullMenu() {
    var wrap = document.getElementById('fullMenu');
    if (!wrap) return;
    var cats = t('menu.categories') || {};
    var by = itemsByCat();
    var total = 0;
    var rendered = [];
    /* category nav pills */
    var nav = document.getElementById('menuCats');
    ITEMS_ORDER.filter(function (c) { return by[c] && by[c].length; })
      .forEach(function (c) { rendered.push(c); });
    if (nav) {
      nav.innerHTML = rendered.map(function (c, i) {
        return '<a href="#cat-' + c + '" class="menu-cat-link' + (i === 0 ? ' is-active' : '') + '"' +
          ' data-cat="' + c + '">' + esc(cats[c] || c) +
          '<span class="menu-cat-count">' + by[c].length + '</span></a>';
      }).join('');
      /* smooth scroll for pills (sticky offset) */
      nav.querySelectorAll('a').forEach(function (a) {
        a.addEventListener('click', function (e) {
          e.preventDefault();
          var target = document.getElementById('cat-' + a.dataset.cat);
          if (!target) return;
          window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - 90, behavior: 'smooth' });
        });
      });
      /* highlight pill while scrolling */
      if ('IntersectionObserver' in window) {
        var spy = new IntersectionObserver(function (entries) {
          entries.forEach(function (en) {
            if (en.isIntersecting) {
              nav.querySelectorAll('a').forEach(function (a) {
                a.classList.toggle('is-active', a.dataset.cat === en.target.dataset.cat);
              });
            }
          });
        }, { rootMargin: '-30% 0px -60% 0px' });
        rendered.forEach(function (c) {
          var sec = document.getElementById('cat-' + c);
          if (sec) spy.observe(sec);
        });
      }
    }
    wrap.innerHTML = rendered.map(function (c) {
      total += by[c].length;
      var items = by[c].map(function (it) {
        return '<div class="menu-item">' +
          '<span class="menu-item-name">' + esc(it.name) +
            (it.desc ? '<span class="menu-item-desc">' + esc(it.desc) + '</span>' : '') +
          '</span>' +
          '<span class="menu-item-price">' + esc(it.price) + '</span></div>';
      }).join('');
      return '<section class="menu-category" id="cat-' + c + '" data-cat="' + c + '"><h2>' +
        esc(cats[c] || c) + '</h2>' + items + '</section>';
    }).join('');
    wrap.setAttribute('data-dish-count', String(total));
    if (document.documentElement.getAttribute('data-ready') === '1') initReveal();
  }

  /* ---------- Gallery + lightbox ---------- */
  function renderGallery() {
    var grid = document.getElementById('galleryGrid');
    var gal = ((CFG.images && CFG.images.gallery) || []).slice(0, 5);
    if (!grid) return;
    grid.innerHTML = gal.map(function (src, i) {
      var cls = (i % 5 === 0) ? 'g-item tall' : 'g-item';
      var label = String(src).split('/').pop().replace(/\.[a-z]+$/i, '').replace(/[-_]+/g, ' ');
      label = label.charAt(0).toUpperCase() + label.slice(1);
      return '<figure class="' + cls + '" data-full="' + esc(src) + '" tabindex="0" role="button" aria-label="' + esc(label) + '">' +
        '<img src="' + esc(src) + '" alt="' + esc(label) + '" loading="lazy"></figure>';
    }).join('');
  }
  function initLightbox() {
    var box = document.getElementById('lightbox');
    if (!box) return;
    var imgEl = document.getElementById('lightboxImg');
    function close() { box.hidden = true; imgEl.removeAttribute('src'); }
    document.addEventListener('click', function (e) {
      var fig = e.target.closest('.g-item[data-full]');
      if (fig) { imgEl.src = fig.getAttribute('data-full'); box.hidden = false; }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !box.hidden) close();
      if ((e.key === 'Enter' || e.key === ' ') &&
          e.target.classList && e.target.classList.contains('g-item') &&
          e.target.hasAttribute('data-full')) {
        imgEl.src = e.target.getAttribute('data-full'); box.hidden = false;
      }
    });
    var btn = document.getElementById('lightboxClose');
    btn && btn.addEventListener('click', close);
    box.addEventListener('click', function (e) { if (e.target === box) close(); });
  }

  /* ---------- Reviews ---------- */
  var SAMPLE_NOTE = {
    fr: "Avis d\u2019exemple pour la d\u00e9monstration \u2014 ils seront remplac\u00e9s par de v\u00e9ritables avis clients avant la mise en ligne.",
    en: "Sample reviews shown for demonstration \u2014 these will be replaced with verified guest reviews before launch.",
    ar: "\u0647\u0630\u0647 \u062a\u0642\u064a\u064a\u0645\u0627\u062a \u062a\u0648\u0636\u064a\u062d\u064a\u0629 \u0644\u0644\u0639\u0631\u0636 \u0641\u0642\u0637 \u2014 \u0633\u064a\u062a\u0645 \u0627\u0633\u062a\u0628\u062f\u0627\u0644\u0647\u0627 \u0628\u062a\u0642\u064a\u064a\u0645\u0627\u062a \u062d\u0642\u064a\u0642\u064a\u0629 \u0642\u0628\u0644 \u0627\u0644\u0625\u0637\u0644\u0627\u0642."
  };
  function renderReviews() {
    var grid = document.getElementById('reviewGrid');
    if (!grid) return;
    var items = t('reviews.items');
    if (!Array.isArray(items)) return;
    grid.innerHTML = items.map(function (r) {
      return '<blockquote class="review-card">' +
        '<div class="review-stars" aria-hidden="true">' + '★'.repeat(r.rating || 5) + '</div>' +
        '<p class="review-text">\u201C' + esc(r.text) + '\u201D</p>' +
        '<footer class="review-author">' + esc(r.name) +
          (r.origin ? ' · ' + esc(r.origin) : '') + '</footer></blockquote>';
    }).join('');
    if (CFG.reviewsSample && SAMPLE_NOTE[lang]) {
      grid.innerHTML += '<p class="reviews-sample-note">' + esc(SAMPLE_NOTE[lang]) + '</p>';
    }
  }

  /* ---------- Nav ---------- */
  function initNav() {
    var btn = document.getElementById('navToggle');
    var nav = document.getElementById('navMobile');
    if (!btn || !nav) return;
    btn.addEventListener('click', function () {
      var open = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!open));
      nav.hidden = open;
    });
    nav.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        btn.setAttribute('aria-expanded', 'false');
        nav.hidden = true;
      });
    });
  }

  /* ---------- Scroll reveal (luxury entrance, CSS-driven) ---------- */
  function initReveal() {
    var targets = document.querySelectorAll(
      '.section-head, .dish-card, .g-item, .review-card, .feature-card, .stat, .about-grid > div, .map-wrap, .find-info'
    );
    /* FAIL-SAFE FIRST: if anything goes wrong below, a timer reveals everything.
       Content must NEVER stay invisible — a black void reads as broken. */
    var allIn = function () {
      targets.forEach(function (el) { el.classList.add('is-in'); });
    };
    var failsafe = setTimeout(allIn, 4000);   /* absolute cap: everything visible after 4s */
    if (!('IntersectionObserver' in window)) {
      clearTimeout(failsafe);
      allIn();
      return;
    }
    targets.forEach(function (el) { el.classList.add('reveal'); });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('is-in');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -30px 0px' });
    targets.forEach(function (el) { io.observe(el); });
    /* safety net: reveal anything above OR inside the viewport that IO missed */
    setInterval(function () {
      var pending = document.querySelectorAll('.reveal:not(.is-in)');
      if (!pending.length) return;
      pending.forEach(function (el) {
        var r = el.getBoundingClientRect();
        if (r.top < window.innerHeight && r.bottom > 0) el.classList.add('is-in');
      });
    }, 600);
  }

  /* ---------- Language switch ---------- */
  function initLangSwitch() {
    var sel = document.getElementById('langSwitch');
    if (!sel) return;
    sel.value = lang;
    sel.addEventListener('change', function () {
      lang = sel.value;
      try { localStorage.setItem('tpl-lang', lang); } catch (e) {}
      boot(true);
    });
  }

  /* ---------- Boot ---------- */
  document.documentElement.classList.add('js');   /* enables reveal animations only when JS runs */
  function fetchLocale(l) {
    if (LOCALES[l]) return Promise.resolve(LOCALES[l]);
    if (window.LOCALES_INLINE && window.LOCALES_INLINE[l]) {
      LOCALES[l] = window.LOCALES_INLINE[l];
      return Promise.resolve(LOCALES[l]);
    }
    return fetch('locales/' + l + '.json').then(function (r) {
      if (!r.ok) throw new Error('locale ' + l + ': HTTP ' + r.status);
      return r.json();
    }).then(function (j) { LOCALES[l] = j; return j; });
  }

  function boot(langChanged) {
    fetchLocale(lang).then(function () {
      // pre-warm FR fallback
      return fetchLocale('fr');
    }).then(function () {
      applyTheme();
      applyI18n();
      applyLinks();
      updateStatus();
      renderHours();
      renderAbout();
      renderFeatures();
      renderFeatured();
      renderGallery();
      renderReviews();
      renderFullMenu();
      if (!langChanged) {
        applyHeroMedia();
applyMarquee();
applyRating();
applyContactBar();
        initNav();
        initLightbox();
        initLangSwitch();
        initReveal();
      }
      document.documentElement.setAttribute('data-ready', '1');
    }).catch(function (err) {
      console.error('[tpl] failed to load locale:', err);
    });
  }

  lang = detectLang();
  setInterval(updateStatus, 60000);
  boot(false);
})();
