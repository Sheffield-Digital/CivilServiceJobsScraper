// Service worker — handles the Sheffield Digital API POST.

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== 'SD_POST_JOB') return false;

  postJob(message)
    .then(sendResponse)
    .catch(err => sendResponse({ ok: false, error: err.message }));

  return true; // keep channel open for async sendResponse
});

async function postJob({ endpoint, authHeader, payload }) {
  const r = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': authHeader,
    },
    body: JSON.stringify(payload),
  });

  const json = await r.json().catch(() => null);
  return { ok: r.ok, status: r.status, json };
}
