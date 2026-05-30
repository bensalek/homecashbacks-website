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
  if (!email && !phone) {
    if (errContactEl) { errContactEl.textContent = 'Please enter your email or phone number.'; errContactEl.classList.add('show'); }
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
