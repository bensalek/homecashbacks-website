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
  // ── Phone click tracking (all tel: links) ──
  document.querySelectorAll('a[href^="tel:"]').forEach(function (el) {
    el.addEventListener('click', function () {
      fireEvent('close_convert_lead', {
        event_category: 'lead',
        event_label: 'phone',
        page_path: window.location.pathname
      });
    });
  });

  // ── WhatsApp click tracking (all wa.me links) ──
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

// ── Nav ─────────────────────────────────────────────────────────────────────
function toggleMobMenu() {
  document.getElementById('nav-links').classList.toggle('open');
  document.getElementById('hamburger').classList.toggle('open');
}
function closeMobMenu() {
  document.getElementById('nav-links').classList.remove('open');
  document.getElementById('hamburger').classList.remove('open');
}

// ── Validation helpers ──────────────────────────────────────────────────────
function isValidEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v); }
function isValidPhone(v) { return v.replace(/\D/g, '').length >= 10; }

// ── HubSpot ─────────────────────────────────────────────────────────────────
// Sends each booking-form lead to the "Contact Us" form in HubSpot, alongside
// Netlify Forms. The consent text below must match the wording in the HubSpot
// form and in components/modal.html, since HubSpot stores it as the record of
// what the person agreed to.
var HC_HUBSPOT = {
  portalId: '343715542',
  formId: '236d40c0-aa1b-4819-86d7-398fc51cd30d',
  marketingSubscriptionId: 3708911144,
  // Custom contact property (hidden field on the HubSpot form) that records
  // which page and form button the lead came from, e.g. "buyer-our-story | /our-story.html"
  leadSourceProperty: 'lead_source',
  // Custom single-checkbox contact property (hidden field on the HubSpot form)
  // set to true/false from the market updates checkbox, for easy filtering.
  optinProperty: 'market_updates_optin',
  processText: 'By submitting, you agree to be contacted by Home Cashbacks about your inquiry.',
  optinText: 'Yes, email me occasional GTA market updates and home buying tips from Home Cashbacks. You can unsubscribe at any time.'
};

function sendToHubSpot(lead) {
  try {
    var fields = [
      { objectTypeId: '0-1', name: 'firstname', value: lead.firstname },
      { objectTypeId: '0-1', name: 'lastname', value: lead.lastname },
      { objectTypeId: '0-1', name: 'email', value: lead.email },
      { objectTypeId: '0-1', name: 'phone', value: lead.phone }
    ];
    if (lead.note) fields.push({ objectTypeId: '0-1', name: 'message', value: lead.note });
    if (lead.source) fields.push({ objectTypeId: '0-1', name: HC_HUBSPOT.leadSourceProperty, value: lead.source });
    if (!lead.basicOnly) fields.push({ objectTypeId: '0-1', name: HC_HUBSPOT.optinProperty, value: lead.optin ? 'true' : 'false' });

    // hubspotutk is the HubSpot tracking cookie; passing it links the visitor's
    // earlier page views to the new contact.
    var context = { pageUri: window.location.href, pageName: document.title };
    var cookie = document.cookie.match(/(?:^|;\s*)hubspotutk=([^;]+)/);
    if (cookie) context.hutk = cookie[1];

    var body = {
      submittedAt: String(Date.now()),
      fields: fields,
      context: context,
      legalConsentOptions: {
        consent: {
          consentToProcess: true,
          text: HC_HUBSPOT.processText,
          communications: [{
            value: !!lead.optin,
            subscriptionTypeId: HC_HUBSPOT.marketingSubscriptionId,
            text: HC_HUBSPOT.optinText
          }]
        }
      }
    };

    var url = 'https://api.hsforms.com/submissions/v3/integration/submit/' +
      HC_HUBSPOT.portalId + '/' + HC_HUBSPOT.formId;

    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      keepalive: true
    }).then(function (res) {
      if (!res.ok) {
        return res.text().then(function (t) {
          console.warn('HubSpot submission failed:', res.status, t);
          // If a custom property (lead source or opt-in) is missing or rejected,
          // retry once without the custom fields so the contact is still created.
          if (!lead.basicOnly) {
            var retry = Object.assign({}, lead, { source: '', basicOnly: true });
            return sendToHubSpot(retry);
          }
        });
      }
    }).catch(function (err) {
      console.warn('HubSpot submission error:', err);
    });
  } catch (err) {
    console.warn('HubSpot submission error:', err);
    return Promise.resolve();
  }
}

// ── Form submission ─────────────────────────────────────────────────────────
function hcHandleFormSubmit(formName) {
  var form = document.getElementById('form-showing');
  if (!form) return;
  var firstEl = document.getElementById('f-name');
  var lastEl = document.getElementById('f-lastname');
  var emailEl = document.getElementById('f-email');
  var phoneEl = document.getElementById('f-phone');
  var noteEl = document.getElementById('f-note');
  var optinEl = document.getElementById('f-optin');
  var errNameEl = document.getElementById('err-name');
  var errContactEl = document.getElementById('err-contact');
  var firstname = firstEl ? firstEl.value.trim() : '';
  var lastname = lastEl ? lastEl.value.trim() : '';
  var email = emailEl ? emailEl.value.trim() : '';
  var phone = phoneEl ? phoneEl.value.trim() : '';
  var ok = true;

  document.querySelectorAll('.f-error').forEach(function (el) { el.classList.remove('show'); el.textContent = ''; });
  document.querySelectorAll('.f-input').forEach(function (el) { el.classList.remove('err'); el.style.borderColor = ''; });

  if (!firstname || !lastname) {
    if (errNameEl) { errNameEl.textContent = 'Please enter your first and last name.'; errNameEl.classList.add('show'); }
    if (firstEl && !firstname) firstEl.classList.add('err');
    if (lastEl && !lastname) lastEl.classList.add('err');
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

  // HubSpot runs in parallel with Netlify; a HubSpot failure never blocks the lead.
  sendToHubSpot({
    firstname: firstname,
    lastname: lastname,
    email: email,
    phone: phone,
    note: noteEl ? noteEl.value.trim() : '',
    optin: optinEl ? optinEl.checked : false,
    source: leadSource + ' | ' + leadPage
  });

  function showSuccess() {
    document.getElementById('modal-form-wrap').style.display = 'none';
    document.getElementById('form-success').style.display = 'block';
    fireEvent('qualify_lead', {
      event_category: 'lead',
      event_label: leadSource,
      page_path: leadPage
    });
  }

  var fd = new FormData(form);
  fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(fd).toString() })
    .then(showSuccess)
    .catch(showSuccess);
}

// Some pages (homepage, our-story) still define their own older
// handleFormSubmit inline. Point the global back to this version once the
// page has loaded, so every page sends leads the same way.
function handleFormSubmit(formName) { return hcHandleFormSubmit(formName); }
(function () {
  function useSharedSubmit() { window.handleFormSubmit = hcHandleFormSubmit; }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', useSharedSubmit);
  } else {
    useSharedSubmit();
  }
  window.addEventListener('load', useSharedSubmit);
})();

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

// ── Dynamic city placeholder for the note field on city pages ───────────────
(function () {
  function setCityPlaceholder() {
    var noteField = document.getElementById('f-note');
    if (!noteField) return;
    var slug = window.location.pathname.split('/').pop().replace('.html', '');
    var match = slug.match(/^(.+)-cashback-realtor$/);
    if (!match) return;
    var cityName = match[1].split('-').map(function (w) {
      return w.charAt(0).toUpperCase() + w.slice(1);
    }).join(' ');
    noteField.placeholder = "I'm looking for a $1M house in " + cityName;
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setCityPlaceholder);
  } else {
    setCityPlaceholder();
  }
})();

// ── FAQ expansion tracking (site-wide, works on any page with .faq-q) ───────
// Uses event delegation so it doesn't require editing individual pages,
// and doesn't interfere with each page's own existing toggle-open logic.
document.addEventListener('click', function (e) {
  var q = e.target.closest('.faq-q');
  if (!q) return;
  var textEl = q.querySelector('.faq-q-text');
  var text = textEl ? textEl.textContent.trim() : (q.textContent || '').trim().slice(0, 80);
  fireEvent('faq_expand', {
    event_category: 'engagement',
    faq_question: text,
    page_path: window.location.pathname
  });
});

// ── Calculator engagement tracking (any slider on any calculator variant) ───
// Fires once per page load on first interaction, not on every slider tick,
// so it signals genuine engagement rather than flooding GA4 with noise.
(function () {
  var calcTracked = false;
  document.addEventListener('input', function (e) {
    if (calcTracked) return;
    var el = e.target;
    if (el.tagName === 'INPUT' && el.type === 'range') {
      calcTracked = true;
      fireEvent('calculator_interact', {
        event_category: 'engagement',
        page_path: window.location.pathname
      });
    }
  });
})();
