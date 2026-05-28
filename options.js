const DEFAULT_ENDPOINT = 'https://sheffield.digital/wp-json/jobboard/v1/job';

const elEndpoint = document.getElementById('endpoint');
const elUsername = document.getElementById('username');
const elPassword = document.getElementById('password');
const elSave     = document.getElementById('btn-save');
const elStatus   = document.getElementById('save-status');
const elShowPass = document.getElementById('btn-show-pass');

// Load saved settings
chrome.storage.sync.get(['sdEndpoint', 'sdUsername', 'sdPassword'], (stored) => {
  elEndpoint.value = stored.sdEndpoint || DEFAULT_ENDPOINT;
  elUsername.value = stored.sdUsername || '';
  elPassword.value = stored.sdPassword || '';
});

// Save settings
elSave.addEventListener('click', () => {
  const endpoint = elEndpoint.value.trim() || DEFAULT_ENDPOINT;
  const username = elUsername.value.trim();
  const password = elPassword.value;

  if (!username || !password) {
    showStatus('Please enter both username and password.', false);
    return;
  }

  chrome.storage.sync.set({ sdEndpoint: endpoint, sdUsername: username, sdPassword: password }, () => {
    if (chrome.runtime.lastError) {
      showStatus('Error saving: ' + chrome.runtime.lastError.message, false);
    } else {
      showStatus('Settings saved.', true);
    }
  });
});

// Show/hide password toggle
elShowPass.addEventListener('click', () => {
  const isHidden = elPassword.type === 'password';
  elPassword.type = isHidden ? 'text' : 'password';
  elShowPass.textContent = isHidden ? 'Hide' : 'Show';
});

function showStatus(msg, ok) {
  elStatus.textContent = msg;
  elStatus.className = ok ? 'status-ok' : 'status-err';
  if (ok) setTimeout(() => { elStatus.textContent = ''; }, 3000);
}
