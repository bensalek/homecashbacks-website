// HomeCashbacks — Shared JS

// ── GA4 helper ──────────────────────────────────────────────────────────────
function fireEvent(name, params) {
  if (typeof gtag === 'function') gtag('event', name, params);
}

// ── Modal ───────────────────────────────────────────────────────────────────
function openModal() {
  document.getElementById('modal').classList.add('open');
  document.body.style.overflow = 'hidden';
  var sourceEl = document.getElementById('f-source');
  var src = sourceEl ? sourceEl.value : 'unknown';
  fireEvent('modal_open', {
    event_category: 'engagement',
    event_label: src,
    page_path: window.location.pathname
  });
  // Note: modal_open is engagement only, not a key event
}
function closeModal() {
  document.getElementById('modal').classList.remove('open');
  document.body.style.overflow = '';
}
document.addEventListener('DOMContentLoaded', function () {
  var overlay = document.getElementById('modal');
  if (overlay) {
    overlay.addEventListener('click', function (e) {
      if (e.target === this) closeModal();
    });
  }

  // ── Phone click tracking (all tel: links) ────────────────────────────────
  document.querySelectorAll('a[href^="tel:"]').forEach(function (el) {
    el.addEventListener('click', function () {
      fireEvent('close_convert_lead', {
        event_category: 'lead',
        event_label: 'phone',
        page_path: window.location.pathname
      });
    });
  });

  // ── WhatsApp click tracking (all wa.me links) ────────────────────────────
  document.querySelectorAll('a[href*="wa.me"]').forEach(function (el) {
    el.addEventListener('click', function () {
      fireEvent('close_convert_lead', {
        event_category: 'lead',
        event_label: 'whatsapp',
        page_path: window.location.pathname
      });
    });
  });
});
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') closeModal();
});

// ── Nav ──────────────────────────────────────────────────────────────────────
function toggleMobMenu() {
  document.getElementById('nav-links').classList.toggle('open');
  document.getElementById('hamburger').classList.toggle('open');
}
function closeMobMenu() {
  document.getElementById('nav-links').classList.remove('open');
  document.getElementById('hamburger').classList.remove('open');
}

// ── Validation helpers ───────────────────────────────────────────────────────
function isValidEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v); }
function isValidPhone(v) { return v.replace(/\D/g, '').length >= 10; }

// ── Form submission ──────────────────────────────────────────────────────────
function handleFormSubmit(formName) {
  var form = document.getElementById('form-showing');
  if (!form) return;
  var nameEl = document.getElementById('f-name');
  var emailEl = document.getElementById('f-email');
  var phoneEl = document.getElementById('f-phone');
  var errNameEl = document.getElementById('err-name');
  var errContactEl = document.getElementById('err-contact');
  var name = nameEl ? nameEl.value.trim() : '';
  var email = emailEl ? emailEl.value.trim() : '';
  var phone = phoneEl ? phoneEl.value.trim() : '';
  var ok = true;

  document.querySelectorAll('.f-error').forEach(function (el) { el.classList.remove('show'); el.textContent = ''; });
  document.querySelectorAll('.f-input').forEach(function (el) { el.classList.remove('err'); });

  if (!name) {
    if (errNameEl) { errNameEl.textContent = 'Please enter your name.'; errNameEl.classList.add('show'); }
    if (nameEl) nameEl.classList.add('err');
    ok = false;
  }
  if (!email || !phone) {
    if (errContactEl) { errContactEl.textContent = 'Please enter both your email and phone number.'; errContactEl.classList.add('show'); }
    if (emailEl && !email) emailEl.classList.add('err');
    if (phoneEl && !phone) phoneEl.classList.add('err');
    ok = false;
  }
  if (email && !isValidEmail(email)) {
    if (errContactEl) { errContactEl.textContent = 'Please enter a valid email address.'; errContactEl.classList.add('show'); }
    if (emailEl) emailEl.classList.add('err');
    ok = false;
  }
  if (phone && !isValidPhone(phone)) {
    if (errContactEl) { errContactEl.textContent = 'Phone number must be at least 10 digits.'; errContactEl.classList.add('show'); }
    if (phoneEl) phoneEl.classList.add('err');
    ok = false;
  }
  if (!ok) return;

  var sourceEl = document.getElementById('f-source');
  var leadSource = sourceEl ? sourceEl.value : 'buyer';
  var leadPage = window.location.pathname;

  var fd = new FormData(form);
  fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(fd).toString() })
    .then(function () {
      document.getElementById('modal-form-wrap').style.display = 'none';
      document.getElementById('form-success').style.display = 'block';
      fireEvent('qualify_lead', {
        event_category: 'lead',
        event_label: leadSource,
        page_path: leadPage
      });
    })
    .catch(function () {
      document.getElementById('modal-form-wrap').style.display = 'none';
      document.getElementById('form-success').style.display = 'block';
      fireEvent('qualify_lead', {
        event_category: 'lead',
        event_label: leadSource,
        page_path: leadPage
      });
    });
}

// ── Visible breadcrumb trail, built from each page's own BreadcrumbList schema ──
(function () {
  function renderBreadcrumb() {
    var scripts = document.querySelectorAll('script[type="application/ld+json"]');
    var crumbs = null;
    for (var i = 0; i < scripts.length; i++) {
      try {
        var data = JSON.parse(scripts[i].textContent);
        var candidates = Array.isArray(data['@graph']) ? data['@graph'] : [data];
        for (var j = 0; j < candidates.length; j++) {
          var node = candidates[j];
          if (node && node['@type'] === 'BreadcrumbList' && Array.isArray(node.itemListElement)) {
            crumbs = node.itemListElement.slice().sort(function (a, b) { return a.position - b.position; });
            break;
          }
        }
        if (crumbs) break;
      } catch (e) { /* skip malformed blocks */ }
    }
    if (!crumbs || crumbs.length < 2) return;

    var topBar = document.querySelector('.top-bar');
    if (!topBar) return;

    var html = '<nav class="bc-trail" aria-label="Breadcrumb"><div class="bc-trail-inner">';
    crumbs.forEach(function (c, idx) {
      var isLast = idx === crumbs.length - 1;
      var path = '';
      try { path = new URL(c.item).pathname; } catch (e) { path = c.item; }
      if (isLast) {
        html += '<span class="bc-current" aria-current="page">' + c.name + '</span>';
      } else {
        html += '<a href="' + path + '">' + c.name + '</a><span class="bc-sep">/</span>';
      }
    });
    html += '</div></nav>';

    topBar.insertAdjacentHTML('afterend', html);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderBreadcrumb);
  } else {
    renderBreadcrumb();
  }
})();
