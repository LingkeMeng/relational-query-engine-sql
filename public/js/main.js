//imports
import {
  loadPortfolioCash,
  createPortfolio,
  depositPortfolioCash,
  withdrawPortfolioCash,
} from './portfolio.js';
import {
  loadHoldings,
  buyStocks,
  sellStocks,
  loadTransactions,
} from './transaction.js';
import { loadListsPage } from './list.js';

//global variables
export let globalStartDate = '2017-01-01';
export let globalEndDate = '2019-01-01';

//global date setters
export function initDateInputs() {
  const startInput = document.getElementById('start-date');
  const endInput = document.getElementById('end-date');

  startInput.value = globalStartDate;
  endInput.value = globalEndDate;

  const setStartBtn = document.getElementById('set-start-btn');
  const setEndBtn = document.getElementById('set-end-btn');

  setStartBtn.addEventListener('click', () => {
    globalStartDate = startInput.value;
    console.log('>> Confirmed start =', globalStartDate);
    alert('Start date set to: ' + globalStartDate);
    refreshStatisticsIfPresent();
  });

  setEndBtn.addEventListener('click', () => {
    globalEndDate = endInput.value;
    console.log('>> Confirmed end =', globalEndDate);
    alert('End date set to: ' + globalEndDate);
    refreshStatisticsIfPresent();
  });
}
// Utility: add activity log rows , Fake log for debug purposes
function logActivity(evt, detail) {
  const tbody = document.getElementById('activity-log');
  if (!tbody) return;
  if (tbody.children.length === 1 && tbody.children[0].children.length === 1) {
    tbody.innerHTML = '';
  }
  const tr = document.createElement('tr');
  tr.innerHTML = `<td>${new Date().toLocaleString()}</td><td>${evt}</td><td class="muted">${detail}</td>`;
  tbody.prepend(tr);
}

// Sample holdings used across pages
const sampleHoldings = [
  {
    symbol: 'AAPL',
    name: 'Apple Inc.',
    shares: 20,
    close: 230.12,
    mv: 4602.4,
    beta: 1.15,
    cov: 0.21,
  },
  {
    symbol: 'MSFT',
    name: 'Microsoft',
    shares: 10,
    close: 410.55,
    mv: 4105.5,
    beta: 0.98,
    cov: 0.17,
  },
  {
    symbol: 'NVDA',
    name: 'NVIDIA',
    shares: 5,
    close: 900.22,
    mv: 4501.1,
    beta: 1.28,
    cov: 0.29,
  },
];

// Render holdings & stats (Portfolios / Dashboard)
function loadHoldingsIfPresent() {
  const tb = document.getElementById('holdings');
  if (!tb) return;

  tb.innerHTML = '';
  let mv = 0;
  sampleHoldings.forEach((h) => {
    mv += h.mv;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span class="kbd">${h.symbol}</span></td>
      <td>${h.name}</td>
      <td>${h.shares}</td>
      <td>$${h.close.toFixed(2)}</td>
      <td>$${h.mv.toFixed(2)}</td>
      <td>${h.beta.toFixed(2)}</td>
      <td>${h.cov.toFixed(2)}</td>
      <td><button class="btn" data-sel="${h.symbol}">Detail</button></td>`;
    tb.appendChild(tr);
  });

  const mvEl = document.getElementById('holdings-mv');
  const cashEl = document.getElementById('cash-total');
  const betaEl = document.getElementById('portfolio-beta');
  const covEl = document.getElementById('portfolio-cov');
  if (mvEl) mvEl.textContent = '$' + mv.toFixed(2);
  if (cashEl) cashEl.textContent = '$' + (10000.0).toFixed(2);
  if (betaEl) betaEl.textContent = '~1.10';
  if (covEl) covEl.textContent = '~0.22';

  // Fill select lists for history / forecast if present
  const sel1 = document.getElementById('history-symbol');
  const sel2 = document.getElementById('forecast-symbol');
  [sel1, sel2].forEach((sel) => {
    if (!sel) return;
    sel.innerHTML =
      `<option value="">Select symbol</option>` +
      sampleHoldings.map((h) => `<option>${h.symbol}</option>`).join('');
  });

  // Correlation matrix if present
  const corrHeadRow = document.querySelector('#corr-table thead tr');
  const corrBody = document.querySelector('#corr-table tbody');
  if (corrHeadRow && corrBody) {
    const symbols = sampleHoldings.map((h) => h.symbol);
    corrHeadRow.innerHTML =
      '<th>—</th>' + symbols.map((s) => `<th>${s}</th>`).join('');
    corrBody.innerHTML = symbols
      .map((r) => {
        const row = symbols
          .map((c) => {
            const v = r === c ? 1 : (Math.random() * 0.6 + 0.2).toFixed(2);
            return `<td>${v}</td>`;
          })
          .join('');
        return `<tr><th class="muted">${r}</th>${row}</tr>`;
      })
      .join('');
  }
}

// Canvas mock chart
function drawNoise(canvasId, label) {
  const c = document.getElementById(canvasId);
  if (!c) return;
  const ctx = c.getContext('2d');
  const w = (c.width = c.clientWidth),
    h = (c.height = c.clientHeight);
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle =
    getComputedStyle(document.documentElement).getPropertyValue('--accent') ||
    '#4ea1ff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  let y = h * 0.6;
  for (let x = 0; x <= w; x += 6) {
    const dy = (Math.random() - 0.5) * 8;
    y = Math.max(10, Math.min(h - 10, y + dy));
    x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.fillStyle = '#93a0b4';
  ctx.font = '12px ui-monospace, monospace';
  ctx.fillText(label, 12, 18);
}

// Dialog open/submit wiring
function setupDialogs() {
  document.querySelectorAll('[data-open]').forEach((b) => {
    b.addEventListener('click', () => {
      const dlg = document.querySelector(b.dataset.open);
      if (dlg?.showModal) dlg.showModal();
    });
  });
  document.querySelectorAll('dialog form').forEach((f) => {
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      f.closest('dialog').close();
      logActivity('Form submit', f.dataset.action || 'local placeholder');
    });
  });
}

async function fetchCurrentUser() {
  try {
    const res = await fetch('/api/users/me', {
      method: 'GET',
      credentials: 'include',
    });
    if (!res.ok) return null; 
    const data = await res.json().catch(() => null);
    if (!data) return null;
    return data.user || data;
  } catch (err) {
    console.error('fetchCurrentUser error:', err);
    return null;
  }
}

function renderNavForGuest(nav) {
  if (!nav) return;
  let authLink = nav.querySelector('a[href="auth.html"]');
  if (!authLink) {
    authLink = document.createElement('a');
    authLink.href = 'auth.html';
    authLink.className = 'btn';
    authLink.textContent = 'Sign in / Sign up';
    nav.appendChild(authLink);
  }

  // remove user name and logout button if any
  const userSpan = nav.querySelector('#nav-user');
  const logoutBtn = nav.querySelector('#logout-btn');
  if (userSpan) userSpan.remove();
  if (logoutBtn) logoutBtn.remove();
}

// if user is logged in, render user name and logout button
function renderNavForUser(nav, user) {
  if (!nav) return;
  const authLink = nav.querySelector('a[href="auth.html"]');
  if (authLink) authLink.remove();

  // render user name and logout button
  const oldUserSpan = nav.querySelector('#nav-user');
  const oldLogout = nav.querySelector('#logout-btn');
  if (oldUserSpan) oldUserSpan.remove();
  if (oldLogout) oldLogout.remove();

  const span = document.createElement('span');
  span.id = 'nav-user';
  span.className = 'muted';
  const displayName = user.name || user.displayName || user.email || 'User';
  span.textContent = `Hi, ${displayName}`;

  const btn = document.createElement('button');
  btn.id = 'logout-btn';
  btn.className = 'btn';
  btn.type = 'button';
  btn.textContent = 'Logout';

  nav.appendChild(span);
  nav.appendChild(btn);

  btn.addEventListener('click', async () => {
    localStorage.removeItem('currentPortfolioId');
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch (err) {
      console.error('Logout error:', err);
    }
    window.location.href = 'auth.html';
  });
}

async function updateNavAuthState(nav) {
  const user = await fetchCurrentUser();
  console.log('current user =', user);
  const isAuthPage = location.pathname.endsWith('auth.html');

  if (user) {
    renderNavForUser(nav, user);
    if (isAuthPage) {
      window.location.href = 'index.html';
    }
  } else {
    renderNavForGuest(nav);
  }
}

/* ==================  initialization  ================== */

document.addEventListener('DOMContentLoaded', () => {
  const nav = document.querySelector('header nav.right');
  if (nav) {
    updateNavAuthState(nav);
  }

  // load when portfolio is selected
  setupDialogs();
  loadUserPortfolios();

  //============================dialog setup============================
  // listen for create portfolio button
  const btnCreate = document.getElementById('btn-create-portfolio');

  if (btnCreate) {
    btnCreate.addEventListener('click', () => {
      document.getElementById('dlg-create-portfolio').showModal();
    });
  }
  // listen for deposit/withdraw button
  const btnDeposit = document.getElementById('btn-deposit');
  const btnWithdraw = document.getElementById('btn-withdraw');

  if (btnDeposit) {
    btnDeposit.addEventListener('click', () => {
      document.getElementById('dlg-deposit').showModal();
    });
  }

  if (btnWithdraw) {
    btnWithdraw.addEventListener('click', () => {
      document.getElementById('dlg-withdraw').showModal();
    });
  }

  // =========  end of portfolio dialog setup =========

  // listen for buy/sell button
  const btnBuy = document.getElementById('tr-buy');
  const btnSell = document.getElementById('tr-sell');
  if (btnBuy) {
    btnBuy.addEventListener('click', () => {
      document.getElementById('dlg-buy').showModal();
    });
  }
  if (btnSell) {
    btnSell.addEventListener('click', () => {
      document.getElementById('dlg-sell').showModal();
    });
  }
  // Toggle cancel buttons
  // cancel button doesn't trigger sumbit
  const cancelDepositBtn = document.getElementById('cancel-deposit');
  if (cancelDepositBtn) {
    cancelDepositBtn.addEventListener('click', (e) => {
      e.preventDefault();
      document.getElementById('dlg-deposit').close();
    });
  }
  // cancel withdraw button doesn't trigger submit
  const cancelWithdrawBtn = document.getElementById('cancel-withdraw');
  if (cancelWithdrawBtn) {
    cancelWithdrawBtn.addEventListener('click', (e) => {
      e.preventDefault();
      document.getElementById('dlg-withdraw').close();
    });
  }
  // cancel buy button doesn't trigger submit
  const cancelBuyBtn = document.getElementById('cancel-buy');
  if (cancelBuyBtn) {
    cancelBuyBtn.addEventListener('click', (e) => {
      e.preventDefault();
      document.getElementById('dlg-buy').close();
    });
  }
  // cancel sell button doesn't trigger submit
  const cancelSellBtn = document.getElementById('cancel-sell');
  if (cancelSellBtn) {
    cancelSellBtn.addEventListener('click', (e) => {
      e.preventDefault();
      document.getElementById('dlg-sell').close();
    });
  }

  //===============================end of dialog setup============================

  const loginForm = document.querySelector('form[aria-label="Sign in form"]');
  const signupForm = document.querySelector('form[aria-label="Sign up form"]');
  const messageEl = document.getElementById('auth-message');

  function showMessage(text, type = 'info') {
    if (!messageEl) return;
    messageEl.textContent = text;
    messageEl.className = 'muted ' + type;
  }

  // Handle login
  if (loginForm) {
    loginForm.addEventListener('submit', async (event) => {
      event.preventDefault();

      const action = loginForm.getAttribute('data-action') || '/api/auth/login';
      const email = loginForm.email.value.trim();
      const password = loginForm.password.value;

      if (!email || !password) {
        showMessage('Please enter email and password.', 'error');
        return;
      }

      try {
        const res = await fetch(action, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include', // send / receive cookies
          body: JSON.stringify({ email, password }),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok || data.success === false) {
          showMessage(data.message || 'Sign in failed.', 'error');
          return;
        }

        showMessage('Signed in successfully. Redirecting…', 'success');
        window.location.href = 'index.html';
      } catch (err) {
        console.error('Login error', err);
        showMessage('Network error. Please try again.', 'error');
      }
    });
  }

  // Handle sign up
  if (signupForm) {
    signupForm.addEventListener('submit', async (event) => {
      event.preventDefault();

      const action =
        signupForm.getAttribute('data-action') || '/api/auth/register';
      const name = signupForm.name.value.trim();
      const email = signupForm.email.value.trim();
      const password = signupForm.password.value;

      if (!name || !email || !password) {
        showMessage('Please fill in all fields.', 'error');
        return;
      }

      try {
        const res = await fetch(action, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ name, email, password }),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok || data.success === false) {
          showMessage(data.message || 'Sign up failed.', 'error');
          return;
        }

        showMessage('Account created. Redirecting…', 'success');
        window.location.href = 'index.html';
      } catch (err) {
        console.error('Register error', err);
        showMessage('Network error. Please try again.', 'error');
      }
    });
  }

  // ======================== Portfolio  Logic ======================== //
  // refresh portfolio if present
  const savedID = localStorage.getItem('currentPortfolioId');
  if (savedID) {
    loadPortfolioCash(savedID);
    loadHoldings(savedID);
    loadTransactions(savedID);
  }
  // create portfolio
  const dlgCreate = document.getElementById('dlg-create-portfolio');
  if (dlgCreate) {
    const form = dlgCreate.querySelector('form');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = form.name.value.trim();
      if (!name) {
        alert('Please enter a valid name.');
        return;
      }
      await createPortfolio(name);
      form.reset();
      dlgCreate.close();
    });
  }
  // make a deposit
  const dlgDeposit = document.getElementById('dlg-deposit');
  if (dlgDeposit) {
    const form = dlgDeposit.querySelector('form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const amount = parseFloat(form.amount.value);
      if (isNaN(amount) || amount <= 0) {
        alert('Please enter a valid amount.');
        return;
      }
      await depositPortfolioCash(savedID, amount);
      form.reset();
      dlgDeposit.close();
    });
  }
  // make a withdraw
  const dlgWithdraw = document.getElementById('dlg-withdraw');
  if (dlgWithdraw) {
    const form = dlgWithdraw.querySelector('form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const amount = parseFloat(form.amount.value);
      if (isNaN(amount) || amount <= 0) {
        alert('Please enter a valid amount.');
        return;
      }
      await withdrawPortfolioCash(savedID, amount);
      form.reset();
      dlgWithdraw.close();
    });
  }
  // ======================== End of Portfolio Logic ======================== //

  // ========================== trading Logic ======================== //
  // Buy stocks
  const dlgBuy = document.getElementById('dlg-buy');
  if (dlgBuy) {
    const form = dlgBuy.querySelector('form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      buyStocks(
        savedID,
        form.symbol.value.trim(),
        parseInt(form.shares.value),
        parseFloat(form.price.value),
      );
      form.reset();
      dlgBuy.close();
    });
  }
  // Sell stocks
  const dlgSell = document.getElementById('dlg-sell');
  if (dlgSell) {
    const form = dlgSell.querySelector('form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      sellStocks(
        savedID,
        form.symbol.value.trim(),
        parseInt(form.shares.value),
        parseFloat(form.price.value),
      );
      form.reset();
      dlgSell.close();
    });
  }
  if (document.getElementById('lists-body')) {
    loadListsPage();
  }
});
// ==================== end of trading Logic ==================== //

// ============dev logic ===================//

// load a stock info
// check if this button exist
const loadStockBtn = document.getElementById('dev-add-stock-btn');
if (loadStockBtn) {
  document
    .getElementById('dev-add-stock-btn')
    .addEventListener('click', async () => {
      const symbol = document.getElementById('dev-symbol').value.trim();
      const timestamp = document.getElementById('dev-date').value;
      const open = document.getElementById('dev-open').value;
      const high = document.getElementById('dev-high').value;
      const low = document.getElementById('dev-low').value;
      const close = document.getElementById('dev-close').value;
      const volume = document.getElementById('dev-volume').value;

      const msg = document.getElementById('dev-msg');

      if (!symbol || !timestamp) {
        msg.style.visibility = 'visible';
        msg.style.color = 'orange';
        msg.textContent = 'Symbol and date are required.';
        return;
      }

      const payload = {
        symbol,
        timestamp,
        open: open ? Number(open) : null,
        high: high ? Number(high) : null,
        low: low ? Number(low) : null,
        close: close ? Number(close) : null,
        volume: volume ? Number(volume) : null,
      };

      try {
        const res = await fetch('/api/stocks/add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          throw new Error('Server error');
        }

        msg.style.visibility = 'visible';
        msg.style.color = 'lightgreen';
        msg.textContent = 'Stock record added successfully!';
      } catch (err) {
        msg.style.visibility = 'visible';
        msg.style.color = 'red';
        msg.textContent = 'Failed to add record.';
      }
    });
}
/* ==================== Friends Page Logic ==================== */

async function loadFriendsPage() {
  const friendsBody = document.getElementById('friends-body');
  const incomingBody = document.getElementById('req-in');
  const outgoingBody = document.getElementById('req-out');
  const sendForm = document.querySelector(
    'form[aria-label="Send friend request"]',
  );
  if (!friendsBody || !incomingBody || !outgoingBody || !sendForm) return;

  console.log('Friends page detected, initializing…');

  function renderEmpty(tbody, text) {
    tbody.innerHTML = `<tr><td colspan="3" class="muted">${text}</td></tr>`;
  }

  async function loadFriends() {
    try {
      const res = await fetch('/api/users/me/friends', {
        credentials: 'include',
      });
      if (!res.ok) {
        console.error('loadFriends status =', res.status);
        renderEmpty(friendsBody, 'Error loading friends');
        return;
      }

      const data = await res.json();
      console.log('friends data =', data);

      // [{ userid, email }, ...]
      const friends = Array.isArray(data)
        ? data
        : Array.isArray(data.friends)
        ? data.friends
        : [];

      if (!friends.length) {
        renderEmpty(friendsBody, 'No friends yet');
        return;
      }

      friendsBody.innerHTML = '';
      friends.forEach((f) => {
        const userid = f.userid;
        const email = f.email;
        const displayName =
          f.name || f.display_name || f.username || email || `User ${userid}`;

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${displayName}</td>
          <td>${email}</td>
          <td><button class="btn danger" data-remove="${userid}">Remove</button></td>
        `;
        friendsBody.appendChild(tr);
      });
    } catch (err) {
      console.error('loadFriends error:', err);
      renderEmpty(friendsBody, 'Error loading friends');
    }
  }

  /* ---------- Incoming Requests ---------- */
  async function loadIncoming() {
    try {
      const res = await fetch('/api/users/me/friend-requests?type=incoming', {
        credentials: 'include',
      });
      if (!res.ok) {
        console.error('loadIncoming status =', res.status);
        renderEmpty(incomingBody, 'Error');
        return;
      }

      const data = await res.json();
      console.log('incoming data =', data);

      const rawReqs = Array.isArray(data)
        ? data
        : Array.isArray(data.requests)
        ? data.requests
        : [];

      // Only show PENDING requests
      const reqs = rawReqs.filter((r) => r.status === 'PENDING');

      if (!reqs.length) {
        renderEmpty(incomingBody, 'None');
        return;
      }

      incomingBody.innerHTML = '';
      reqs.forEach((r) => {
        const requestId = r.requestid;
        const created = r.created_at || r.createdat;
        const timeText = created ? new Date(created).toLocaleString() : '-';

        // Prefer name fields
        const fromName =
          r.from_name ||
          r.fromName ||
          r.name ||
          r.from_email ||
          `User ${r.fromuserid}`;

        const tr = document.createElement('tr');
        tr.innerHTML = `
        <td>${fromName}</td>
        <td>${timeText}</td>
        <td>
          <button class="btn primary" data-accept="${requestId}">Accept</button>
          <button class="btn danger" data-reject="${requestId}">Reject</button>
        </td>
      `;
        incomingBody.appendChild(tr);
      });
    } catch (err) {
      console.error('loadIncoming error:', err);
      renderEmpty(incomingBody, 'Error');
    }
  }

  /* ---------- Outgoing Requests ---------- */
  async function loadOutgoing() {
    try {
      const res = await fetch('/api/users/me/friend-requests?type=outgoing', {
        credentials: 'include',
      });
      if (!res.ok) {
        console.error('loadOutgoing status =', res.status);
        renderEmpty(outgoingBody, 'Error');
        return;
      }

      const data = await res.json();
      console.log('outgoing data =', data);

      const reqs = Array.isArray(data)
        ? data
        : Array.isArray(data.requests)
        ? data.requests
        : [];

      if (!reqs.length) {
        renderEmpty(outgoingBody, 'None');
        return;
      }

      outgoingBody.innerHTML = '';
      reqs.forEach((r) => {
        const created = r.created_at || r.createdat;
        const timeText = created ? new Date(created).toLocaleString() : '-';
        const status = r.status;

        // Prefer name fields if available
        const toName =
          r.to_name || r.toName || r.name || r.to_email || `User ${r.touserid}`;

        const tr = document.createElement('tr');
        tr.innerHTML = `
        <td>${toName}</td>
        <td>${timeText}</td>
        <td>${status}</td>
      `;
        outgoingBody.appendChild(tr);
      });
    } catch (err) {
      console.error('loadOutgoing error:', err);
      renderEmpty(outgoingBody, 'Error');
    }
  }

  sendForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = sendForm.email.value.trim();
    if (!email) return;

    try {
      const lookup = await fetch(
        `/api/users/search?q=${encodeURIComponent(email)}`,
        {
          credentials: 'include',
        },
      );

      if (!lookup.ok) {
        alert('Search failed.');
        return;
      }

      const data = await lookup.json();
      console.log('search result =', data);

      // { results: [{ userid, email }, ...] }
      const results = Array.isArray(data.results) ? data.results : [];
      if (!results.length) {
        alert('User not found.');
        return;
      }

      const userId = results[0].userid;
      if (!userId) {
        alert('User found but no userid field in response.');
        return;
      }

      const res = await fetch(`/api/users/${userId}/friend-requests`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        alert(body.message || 'Failed to send request');
        return;
      }

      alert('Request sent!');
      loadOutgoing();
    } catch (err) {
      console.error('send friend request error:', err);
      alert('Network error.');
    }
  });

  document.addEventListener('click', async (e) => {
    if (e.target.matches('[data-remove]')) {
      const friendId = e.target.dataset.remove;
      try {
        const res = await fetch(`/api/users/me/friends/${friendId}`, {
          method: 'DELETE',
          credentials: 'include',
        });
        if (!res.ok) {
          console.error('remove friend status =', res.status);
        }
        loadFriends();
      } catch (err) {
        console.error('remove friend error:', err);
      }
      return;
    }

    // POST /api/users/me/friend-requests/:requestId/accept
    if (e.target.matches('[data-accept]')) {
      const reqId = e.target.dataset.accept;
      try {
        const res = await fetch(
          `/api/users/me/friend-requests/${reqId}/accept`,
          {
            method: 'POST',
            credentials: 'include',
          },
        );
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          console.error('accept error =', body);
          alert(body.message || 'Failed to accept request');
        }
        loadFriends();
        loadIncoming();
        loadOutgoing();
      } catch (err) {
        console.error('accept error:', err);
      }
      return;
    }

    //POST /api/users/me/friend-requests/:requestId/reject
    if (e.target.matches('[data-reject]')) {
      const reqId = e.target.dataset.reject;
      try {
        const res = await fetch(
          `/api/users/me/friend-requests/${reqId}/reject`,
          {
            method: 'POST',
            credentials: 'include',
          },
        );
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          console.error('reject error =', body);
          alert(body.message || 'Failed to reject request');
        }
        loadIncoming();
        loadOutgoing();
      } catch (err) {
        console.error('reject error:', err);
      }
      return;
    }
  });
  /* ---------- Initial load ---------- */
  loadFriends();
  loadIncoming();
  loadOutgoing();
}

document.addEventListener('DOMContentLoaded', () => {
  loadFriendsPage();
});

// load portfolio for selection
async function loadUserPortfolios() {
  const container = document.getElementById('portfolio-list');
  if (!container) return;

  const res = await fetch('/api/portfolio', { credentials: 'include' });
  if (!res.ok) {
    container.innerHTML = `<p class="muted">Failed to load portfolios</p>`;
    return;
  }

  const data = await res.json().catch(() => []);
  const portfolios = Array.isArray(data) ? data : data.portfolios || [];

  if (!portfolios.length) {
    container.innerHTML = `<p class="muted">No portfolios yet, create one in portfolio page</p>`;
    return;
  }

  const selected = localStorage.getItem('currentPortfolioId');
  container.innerHTML = '';

  portfolios.forEach((p) => {
    const card = document.createElement('div');
    card.className = 'portfolio-card';
    card.dataset.pid = p.portfolioid;

    if (selected == p.portfolioid) {
      card.classList.add('selected');
    }

    // portfolio inner card
    card.innerHTML = `
      <div class="portfolio-card-title">${
        p.name || 'Portfolio ' + p.portfolioid
      }</div>    `;

    card.addEventListener('click', () => {
      document
        .querySelectorAll('.portfolio-card')
        .forEach((c) => c.classList.remove('selected'));
      card.classList.add('selected');

      localStorage.setItem('currentPortfolioId', p.portfolioid);
      if (p.portfolioid) {
        loadPortfolioCash(p.portfolioid);
        loadHoldings(p.portfolioid);
        loadTransactions(p.portfolioid);
      }
    });

    container.appendChild(card);
  });
}
//refresh statistics if present
function refreshStatisticsIfPresent() {
  const savedID = localStorage.getItem('currentPortfolioId');
  if (!savedID) return;
  loadHoldings(savedID);
}
