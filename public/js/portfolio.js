// get portfolio cash
export async function loadPortfolioCash(portfolioId) {
    try {
      const res = await fetch(`/api/portfolio/${portfolioId}/cash`, {
        credentials: 'include'
      });
  
      if (!res.ok) {
        console.error("Failed to load cash");
        return;
      }
  
      const data = await res.json();
      const cash = data.cash ?? data.cashbalance ?? 0;
  
      const cashEl = document.getElementById("cash-total");
      if (cashEl) {
        cashEl.textContent = `$${Number(cash).toFixed(2)}`;
      }
  
    } catch (err) {
      console.error("Error loading cash:", err);
    }
  }
// Create a new portfolio
  export async function createPortfolio(name) {
  const res = await fetch('/api/portfolio/add', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ 
      name: name, 
      balance: 0 
    })
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    alert(data.message || "Failed to create portfolio.");
    return;
  }
  const data = await res.json();
  const newId = data.portfolio?.portfolioid;
  if (!newId) {
    alert("Portfolio creation error");
    return;
  }

  localStorage.setItem('currentPortfolioId', newId);
  alert(`Portfolio "${name}" created!`);
}

//deposit cash into portfolio
export async function depositPortfolioCash(portfolioId, amount) {
  const res = await fetch(`/api/portfolio/${portfolioId}/deposit`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ amount: amount })
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    alert(data.message || "Failed to deposit cash.");
    return;
  }
  const data = await res.json();
  alert(`Deposited $${amount} successfully!`);
  await loadPortfolioCash(portfolioId);
}

// withdraw cash from portfolio
export async function withdrawPortfolioCash(portfolioId, amount) {
  const res = await fetch(`/api/portfolio/${portfolioId}/withdraw`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ amount: amount })
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    alert(data.message || "Failed to withdraw cash.");
    return;
  }
  const data = await res.json();
  alert(`Withdrew $${amount} successfully!`);
  await loadPortfolioCash(portfolioId);
}