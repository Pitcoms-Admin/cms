// PITCOMS site worker: serves the existing static assets unchanged, and
// patches the registration form's submit handler (on the fly, in the HTML
// response) so it posts directly to /api/apply and writes to D1 instead of
// building a mailto: link. The underlying static asset file is never
// modified — this only rewrites the served HTML in memory per request.

const OLD_SUBMIT_START = "form.addEventListener('submit', function(e){";
const NEXT_ANCHOR = "\n\n  copyBtn.addEventListener";

const NEW_SUBMIT_HANDLER = `form.addEventListener('submit', function(e){
    e.preventDefault();
    if(!validate()) return;

    var submitBtn = form.querySelector('button[type="submit"]');
    var originalBtnText = submitBtn ? submitBtn.textContent : '';
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Submitting…'; }

    var payload = {
      name: form.name.value.trim(),
      email: form.email.value.trim(),
      phone: form.phone.value.trim(),
      program: form.program.value,
      cohort: form.cohort.value,
      background: form.background.value,
      notes: form.notes.value.trim()
    };

    fetch('/api/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function(res){
      return res.json().catch(function(){
      return {}; }).then(function(data){
      return { ok: res.ok, data: data }; });
    }).then(function(result){
      if (!result.ok || !result.data || !result.data.success) {
        throw new Error((result.data && result.data.error) || 'Submission failed');
      }
      successPanel.querySelector('h3').textContent = 'Your application has been submitted!';
      successPanel.querySelector('p').textContent = "Thanks — we've received your application and saved it in our admissions system. Our team will reach out to you at " + payload.email + " soon.";
      previewText.textContent = 'Name: ' + payload.name + '\\nEmail: ' + payload.email + '\\nPhone: ' + (payload.phone || '–') + '\\nProgram: ' + payload.program + '\\nCohort: ' + payload.cohort + '\\nBackground: ' + payload.background + '\\nNotes: ' + (payload.notes || '–');
      openMailBtn.style.display = 'none';
      successPanel.classList.remove('error');
      form.classList.add('hide');
      successPanel.classList.add('show');
      successPanel.scrollIntoView({behavior:'smooth', block:'start'});
    }).catch(function(err){
      var body = buildApplication();
      var subject = 'PITCOMS Application — ' + form.name.value.trim();
      var mailto = 'mailto:' + ADMISSIONS_EMAIL + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
      successPanel.querySelector('h3').textContent = "We couldn't submit that automatically";
      successPanel.querySelector('p').textContent = 'Please use the button below to send your application by email instead, or try again in a moment.';
      previewText.textContent = 'To: ' + ADMISSIONS_EMAIL + '\\nSubject: ' + subject + '\\n\\n' + body;
      openMailBtn.setAttribute('href', mailto);
      openMailBtn.style.display = '';
      successPanel.classList.add('error');
      form.classList.add('hide');
      successPanel.classList.add('show');
      successPanel.scrollIntoView({behavior:'smooth', block:'start'});
    }).finally(function(){
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = originalBtnText || 'Prepare application →'; }
    });
  });

  copyBtn.addEventListener`;

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { 'content-type': 'application/json; charset=utf-8' }
  });
}

async function handleApply(request, env) {
  let payload;
  try {
    payload = await request.json();
  } catch (err) {
    return json({ success: false, error: 'Invalid JSON body' }, 400);
  }

  const name = (payload.name || '').toString().trim().slice(0, 200);
  const email = (payload.email || '').toString().trim().slice(0, 200);
  const phone = (payload.phone || '').toString().trim().slice(0, 60);
  const program = (payload.program || '').toString().trim().slice(0, 200);
  const cohort = (payload.cohort || '').toString().trim().slice(0, 200);
  const background = (payload.background || '').toString().trim().slice(0, 200);
  const notes = (payload.notes || '').toString().trim().slice(0, 2000);

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!name || !emailOk || !program) {
    return json({ success: false, error: 'Missing or invalid required fields' }, 400);
  }

  try {
    await env.DB.prepare(
      `INSERT INTO applications (name, email, phone, program, cohort, background, notes, source, raw_message)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        name,
        email,
        phone || null,
        program,
        cohort || null,
        background || null,
        notes || null,
        'website',
        JSON.stringify(payload).slice(0, 10000)
      )
      .run();
  } catch (err) {
    console.error('D1 insert failed', err);
    return json({ success: false, error: 'Database error' }, 500);
  }

  return json({ success: true });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === 'POST' && url.pathname === '/api/apply') {
      return handleApply(request, env);
    }

    const assetResponse = await env.ASSETS.fetch(request);
    const contentType = assetResponse.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) {
      return assetResponse;
    }

    let html = await assetResponse.text();
    const startIdx = html.indexOf(OLD_SUBMIT_START);
    const anchorIdx = startIdx === -1 ? -1 : html.indexOf(NEXT_ANCHOR, startIdx);

    if (startIdx !== -1 && anchorIdx !== -1) {
      html = html.slice(0, startIdx) + NEW_SUBMIT_HANDLER + html.slice(anchorIdx + NEXT_ANCHOR.length);
    }

    const newHeaders = new Headers(assetResponse.headers);
    newHeaders.delete('content-length');
    return new Response(html, { status: assetResponse.status, headers: newHeaders });
  }
};
