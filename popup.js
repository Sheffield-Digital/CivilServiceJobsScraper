// This function is injected into the CS Jobs page — must be self-contained.
function extractCSJobData() {
  const main = document.querySelector('main');
  if (!main) return null;

  function getText(el) {
    return el ? el.textContent.trim().replace(/\s+/g, ' ') : '';
  }

  // ── Title, organisation, closing date ──
  const titleBlock = main.querySelector('.vac_display_title_block');
  if (!titleBlock) return null;

  const title = getText(titleBlock.querySelector('h1'));
  const organisation = getText(titleBlock.querySelector('.csr-page-subtitle'));
  const closingDateRaw = getText(titleBlock.querySelector('.vac_display_closing_date'));
  const closingDate = closingDateRaw.replace(/^Apply before\s*/i, '').trim();

  // ── Side panel metadata ──
  // Orphan vac_display_field elements (no h3) are associated with the previous labelled field,
  // e.g. the salary range detail rows that follow the primary "Salary" field.
  const fields = {};
  var lastLabel = null;
  main.querySelectorAll('.vac_display_panel_side .vac_display_field').forEach(function(fieldEl) {
    var label = getText(fieldEl.querySelector('h3'));
    var values = Array.from(
      fieldEl.querySelectorAll('.vac_display_field_value, .vac_display_nullclass')
    ).map(function(v) { return getText(v); }).filter(Boolean);
    if (label) {
      lastLabel = label;
      fields[label] = (fields[label] || []).concat(values);
    } else if (lastLabel && values.length) {
      fields[lastLabel] = (fields[lastLabel] || []).concat(values);
    }
  });

  // ── Location ──
  var location = '';
  var locationHTML = '';
  var inner = main.querySelector('.vac_display_panel_main_inner');
  if (inner) {
    var locationHeading = inner.querySelector('#section_link_location');
    if (locationHeading) {
      var sib = locationHeading.nextElementSibling;
      while (sib && !sib.classList.contains('vac_display_section_heading')) {
        if (sib.classList.contains('vac_display_field')) {
          var valEl = sib.querySelector('.vac_display_field_value');
          if (valEl) {
            location = getText(valEl);
            locationHTML = valEl.innerHTML;
          }
        }
        sib = sib.nextElementSibling;
      }
    }
  }

  // Extract city names from the full location string (e.g. "Sheffield, Yorkshire : Manchester, North West")
  var locationCities = location
    .split(' : ')
    .map(function(loc) { return loc.split(',')[0].trim(); })
    .filter(Boolean)
    .join(', ');

  // ── About the job: Job summary, Job description, Person specification ──
  var contentFields = {};
  if (inner) {
    var inAbout = false;
    Array.from(inner.children).forEach(function(el) {
      if (el.classList.contains('vac_display_section_heading')) {
        inAbout = el.id === 'section_link_about';
      } else if (inAbout && el.classList.contains('vac_display_field')) {
        var subLabel = getText(el.querySelector('h3'));
        var valueEl = el.querySelector('.vac_display_field_value');
        if (subLabel && valueEl) {
          contentFields[subLabel] = valueEl.innerHTML;
        }
      }
    });
  }

  // ── Canonical job URL ──
  var canonicalURL = window.location.href;
  var emailLink = main.querySelector('a[href^="mailto:?subject="]');
  if (emailLink) {
    try {
      var decoded = decodeURIComponent(emailLink.href);
      var match = decoded.match(/https?:\/\/www\.civilservicejobs\.service\.gov\.uk\/csr\/jobs\.cgi\?jcode=(\d+)/);
      if (match) {
        canonicalURL = 'https://www.civilservicejobs.service.gov.uk/csr/jobs.cgi?jcode=' + match[1];
      }
    } catch (e) { /* ignore decode errors */ }
  }

  // ── Map to Sheffield Digital job type ──
  var contractTypeLower = ((fields['Contract type'] || [])[0] || '').toLowerCase();
  var workingPatternLower = ((fields['Working pattern'] || [])[0] || '').toLowerCase();

  var jobType = 'Full Time';
  if (/fixed.?term|temporary|secondment|loan/.test(contractTypeLower)) {
    jobType = 'Temporary';
  } else if (/apprenticeship|intern|graduate scheme/.test(contractTypeLower)) {
    jobType = 'Internship';
  } else if (/part.?time/.test(workingPatternLower) && !/full.?time|full time/.test(workingPatternLower)) {
    jobType = 'Part Time';
  }

  var isRemote = /remote|home.?working|home.?based/.test(workingPatternLower);

  // ── Format salary ──
  var salaryValues = fields['Salary'] || [];
  var primarySalary = salaryValues[0] || '';

  // Try to extract a clean salary range (e.g. £58,185 – £62,336)
  var salaryDetail = salaryValues.find(function(v) { return /pay band minimum|salary range|–|\-/.test(v); }) || '';
  var rangeMatch = salaryDetail.match(/£([\d,]+).*?£([\d,]+)/);
  var salaryFormatted = primarySalary;
  if (rangeMatch && rangeMatch[1] !== rangeMatch[2]) {
    salaryFormatted = '£' + rangeMatch[1] + ' – £' + rangeMatch[2];
  }

  // ── Build description HTML ──
  var descOrder = ['Job summary', 'Job description', 'Person specification'];
  var descParts = [];
  descOrder.forEach(function(key) {
    if (contentFields[key]) {
      descParts.push('<h2>' + key + '</h2>\n' + contentFields[key]);
    }
  });
  // Any extra content fields not in the standard order
  Object.keys(contentFields).forEach(function(key) {
    if (descOrder.indexOf(key) === -1) {
      descParts.push('<h2>' + key + '</h2>\n' + contentFields[key]);
    }
  });

  return {
    title: title,
    organisation: organisation,
    closingDate: closingDate,
    salary: salaryFormatted,
    grade: ((fields['Job grade'] || fields['Grade'] || [])[0] || '').trim(),
    contractType: ((fields['Contract type'] || [])[0] || '').trim(),
    workingPattern: ((fields['Working pattern'] || [])[0] || '').trim(),
    referenceNumber: ((fields['Reference number'] || [])[0] || '').trim(),
    location: locationCities,
    jobType: jobType,
    isRemote: isRemote,
    applicationURL: canonicalURL,
    descriptionHTML: descParts.join('\n\n'),
  };
}

// ── Popup UI ──

let extractedJobData = null; // shared between populate and post

document.addEventListener('DOMContentLoaded', async () => {
  const elLoading  = document.getElementById('state-loading');
  const elNotJob   = document.getElementById('state-not-job');
  const elError    = document.getElementById('state-error');
  const elErrorMsg = document.getElementById('error-message');
  const elContent  = document.getElementById('content');

  function showState(which, message) {
    [elLoading, elNotJob, elError, elContent].forEach(el => el.classList.add('hidden'));
    which.classList.remove('hidden');
    if (message && which === elError) elErrorMsg.textContent = message;
  }

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab?.url?.includes('civilservicejobs.service.gov.uk')) {
      showState(elNotJob);
      return;
    }

    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractCSJobData,
    });

    if (!result || !result.title) {
      showState(elError, 'Could not find job data. Make sure you\'re on a job detail page.');
      return;
    }

    extractedJobData = result;
    populateUI(result);
    showState(elContent);

  } catch (err) {
    showState(elError, err.message || 'An unexpected error occurred.');
  }
});

function populateUI(data) {
  // Header display
  document.getElementById('display-title').textContent = data.title;
  document.getElementById('display-org').textContent = data.organisation;

  // Sheffield Digital form fields
  setField('f-title', data.title);
  setField('f-company', data.organisation);
  setField('f-location', data.location);
  setField('f-jobtype', data.jobType);
  setField('f-salary', data.salary);
  setField('f-url', data.applicationURL);

  // Meta bar
  document.getElementById('display-closing').textContent = data.closingDate || '—';
  document.getElementById('display-grade').textContent = data.grade || '—';
  document.getElementById('display-ref').textContent = data.referenceNumber || '—';

  // Remote badge
  const remoteEl = document.getElementById('f-remote');
  if (data.isRemote) {
    remoteEl.textContent = '✓ Tick "Remote Position"';
    remoteEl.className = 'remote-badge remote-yes';
  } else {
    remoteEl.textContent = '✗ Not remote';
    remoteEl.className = 'remote-badge remote-no';
  }

  // Description
  document.getElementById('f-description').value = data.descriptionHTML;
}

function setField(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value || '';
}

// ── Copy button handler ──
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('.btn-copy');
  if (!btn) return;

  let text = '';
  if (btn.id === 'btn-copy-desc') {
    text = document.getElementById('f-description').value;
  } else {
    const targetId = btn.dataset.target;
    const el = document.getElementById(targetId);
    text = el ? el.value : '';
  }

  await copyToClipboard(btn, text);
});

async function copyToClipboard(btn, text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Fallback for contexts where clipboard API is restricted
    const tmp = document.createElement('textarea');
    tmp.value = text;
    tmp.style.cssText = 'position:fixed;top:-9999px;left:-9999px';
    document.body.appendChild(tmp);
    tmp.select();
    document.execCommand('copy');
    document.body.removeChild(tmp);
  }
  const orig = btn.textContent;
  btn.textContent = '✓ Copied';
  btn.classList.add('copied');
  setTimeout(() => {
    btn.textContent = orig;
    btn.classList.remove('copied');
  }, 1500);
}

// ── Preview toggle ──
document.getElementById('btn-toggle-preview')?.addEventListener('click', function() {
  const textarea = document.getElementById('f-description');
  const preview  = document.getElementById('desc-preview');
  const isShowing = !preview.classList.contains('hidden');

  if (isShowing) {
    preview.classList.add('hidden');
    textarea.classList.remove('hidden');
    this.textContent = 'Preview';
    this.classList.remove('active');
  } else {
    preview.innerHTML = textarea.value;
    preview.classList.remove('hidden');
    textarea.classList.add('hidden');
    this.textContent = 'HTML';
    this.classList.add('active');
  }
});

// ── Post to Sheffield Digital ──

document.getElementById('btn-post')?.addEventListener('click', async () => {
  if (!extractedJobData) return;

  const statusEl = document.getElementById('post-status');
  const postBtn  = document.getElementById('btn-post');

  // Load credentials
  const stored = await chrome.storage.sync.get(['sdEndpoint', 'sdUsername', 'sdPassword']);

  if (!stored.sdUsername || !stored.sdPassword) {
    showPostStatus('info', 'No credentials saved. <button class="status-link" id="open-options">Open Settings</button> to add them.');
    document.getElementById('open-options')?.addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });
    return;
  }

  postBtn.textContent = 'Posting…';
  postBtn.disabled = true;
  postBtn.classList.add('posting');
  hidePostStatus();

  try {
    const payload = buildJobPayload(extractedJobData);
    const endpoint = stored.sdEndpoint || 'https://sheffield.digital/wp-json/jobboard/v1/job';
    const authHeader = `Basic ${btoa(`${stored.sdUsername}:${stored.sdPassword}`)}`;

    // Delegate the fetch to the background service worker, which bypasses CORS.
    const result = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { type: 'SD_POST_JOB', endpoint, authHeader, payload },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        }
      );
    });

    const json = result.json;

    if (!result.ok || json?.code === 'Error' || json?.code === 'rest_forbidden') {
      throw new Error(json?.message || result.error || `HTTP ${result.status}`);
    }

    const jobId = json?.job_id;
    postBtn.textContent = '✓ Posted';
    postBtn.classList.remove('posting');
    postBtn.style.background = '#16a34a';
    showPostStatus('ok',
      `Submitted for approval (job #${jobId}). ` +
      `<a href="https://sheffield.digital/jobs/job-dashboard/" target="_blank" class="status-link">View dashboard →</a>`
    );

  } catch (err) {
    postBtn.textContent = 'Post to Sheffield Digital';
    postBtn.disabled = false;
    postBtn.classList.remove('posting');
    showPostStatus('err', 'Post failed: ' + err.message);
  }
});

// ── Build the JSON payload for the Sheffield Digital API ──

function buildJobPayload(data) {
  return {
    job_ref:         data.referenceNumber.substring(0, 20),
    job_title:       data.title.substring(0, 200),
    job_description: htmlToMarkdown(data.descriptionHTML).substring(0, 40000),
    job_type:        data.jobType.toLowerCase(),
    job_location:    sheffieldLocation(data.location),
    job_remote:      data.isRemote ? 'true' : 'false',
    job_expires:     parseISODate(data.closingDate),
    job_application: data.applicationURL,
    job_salary:      data.salary.replace(/\s+/g, ' ').trim().substring(0, 40),
  };
}

// Extract "Sheffield" if present, otherwise first city truncated to 20 chars.
function sheffieldLocation(locationCities) {
  const cities = locationCities.split(', ');
  if (cities.some(c => /sheffield/i.test(c))) return 'Sheffield';
  return (cities[0] || locationCities).substring(0, 20);
}

// Parse "11:55 pm on Sunday 31st May 2026" → "2026-05-31"
function parseISODate(str) {
  const months = {
    january:'01', february:'02', march:'03', april:'04', may:'05', june:'06',
    july:'07', august:'08', september:'09', october:'10', november:'11', december:'12',
  };
  const m = str.match(/(\d+)(?:st|nd|rd|th)?\s+(\w+)\s+(\d{4})/i);
  if (!m) return '';
  const day   = m[1].padStart(2, '0');
  const month = months[m[2].toLowerCase()] || '01';
  return `${m[3]}-${month}-${day}`;
}

// ── HTML → CommonMark Markdown converter ──
// The SD API accepts Markdown in job_description and rejects HTML tags.

function htmlToMarkdown(html) {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');

  function walk(node) {
    if (node.nodeType === 3) return node.textContent; // text node
    if (node.nodeType !== 1) return '';               // non-element

    const tag      = node.tagName.toLowerCase();
    const children = () => Array.from(node.childNodes).map(walk).join('');

    switch (tag) {
      case 'h1': return `# ${children().trim()}\n\n`;
      case 'h2': return `## ${children().trim()}\n\n`;
      case 'h3': return `### ${children().trim()}\n\n`;
      case 'h4': return `#### ${children().trim()}\n\n`;
      case 'p': {
        const t = children().trim();
        return t ? `${t}\n\n` : '';
      }
      case 'strong':
      case 'b': {
        const t = children().trim();
        return t ? `**${t}**` : '';
      }
      case 'em':
      case 'i': {
        const t = children().trim();
        return t ? `*${t}*` : '';
      }
      case 'ul': {
        return Array.from(node.children)
          .filter(el => el.tagName.toLowerCase() === 'li')
          .map(li => `- ${walk(li).trim()}\n`)
          .join('') + '\n';
      }
      case 'ol': {
        return Array.from(node.children)
          .filter(el => el.tagName.toLowerCase() === 'li')
          .map((li, i) => `${i + 1}. ${walk(li).trim()}\n`)
          .join('') + '\n';
      }
      case 'li':   return children();
      case 'br':   return '\n';
      case 'a':    return children();
      case 'div':  return children() + '\n';
      default:     return children();
    }
  }

  return walk(doc.querySelector('div'))
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function showPostStatus(type, html) {
  const el = document.getElementById('post-status');
  el.innerHTML = html;
  el.className = `post-status status-${type}`;
  el.classList.remove('hidden');
}

function hidePostStatus() {
  const el = document.getElementById('post-status');
  el.classList.add('hidden');
  el.textContent = '';
}
