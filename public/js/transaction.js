import { loadPortfolioCash } from './portfolio.js';
import { globalStartDate, globalEndDate } from "./main.js";
// load transaction data for a portfolio
export async function loadTransactions(portfolioId) {
    const tbody = document.getElementById("activity-log");
    if (!tbody) return;
  
    tbody.innerHTML = `<tr><td colspan="3" class="muted">Loading…</td></tr>`;
  
    try {
      const res = await fetch(`/api/portfolio/${portfolioId}/transactions`, {
        credentials: "include"
      });
  
      if (!res.ok) {
        tbody.innerHTML = `<tr><td colspan="3" class="muted">Error loading transactions</td></tr>`;
        return;
      }
  
      const data = await res.json();
      const txs = data.transactions || [];
  
      if (txs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" class="muted">No activity yet</td></tr>`;
        return;
      }
      // order
      txs.sort((a, b) => new Date(b.createdat) - new Date(a.createdat));
      // keep 10
        txs.splice(10);

      tbody.innerHTML = txs.map(t => {
        const time = t.createdat
            ? new Date(t.createdat).toLocaleString()
            : "—";
        const detail = t.detail;
        const match = detail.match(/of ([A-Z]{1,5})/i);
        const symbol = match ? match[1] : "—";
  
        return `
          <tr>
            <td>${time}</td>
            <td>${symbol}</td>
            <td>${detail}</td>
          </tr>
        `;
      }).join("");
  
    } catch (err) {
      console.error("loadTransactions error", err);
      tbody.innerHTML = `<tr><td colspan="3" class="muted">Error loading transactions</td></tr>`;
    }
  }
  
// get holdings statistics （COV,Beta,Matrix）
export async function loadPortfolioStats(portfolioId) {
    const today = new Date();
    const end = today.toISOString().slice(0, 10);
  
    if (!globalStartDate || !globalEndDate) {
        //alert("Please set both Start and End date first!");
        return;
      }
  
    try {
      const res = await fetch(`/api/portfolio/${portfolioId}/statistics/${globalStartDate}/${globalEndDate}`, {
        credentials: "include"
      });
  
      if (!res.ok) return null;
      const data = await res.json();
      //print the matrix to console
      console.log("###Covariance Matrix:", data);
      return data.stats || [];
    } catch (err) {
      console.error("stats error:", err);
      return null;
    }
  }
// Get holding latests price and mv
export async function loadHoldingsValue(portfolioId) {
    try {
      const res = await fetch(`/api/holdings/${portfolioId}/holdingsValue`, {
        credentials: "include"
      });
  
      if (!res.ok) {
        console.error("Error fetching holdings value");
        return [];
      }
  
      const data = await res.json();
      return data.holdings || [];
    } catch (err) {
      console.error("holdings value error:", err);
      return [];
    }
  }
// render the holdings list
export async function loadHoldings(portfolioId) {
    const tbody = document.getElementById("holdings-body");
    if (!tbody) return;
  
    tbody.innerHTML = `
      <tr><td colspan="5" class="muted">Loading…</td></tr>
    `;
  
    try {
      const res = await fetch(`/api/holdings/${portfolioId}`, {
        credentials: "include"
      });
  
      if (!res.ok) {
        tbody.innerHTML = `<tr><td colspan="5" class="muted">Error loading holdings</td></tr>`;
        return;
      }
  
      const data = await res.json();
      const holdings = data.holdings || [];
  
      if (holdings.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="muted">No holdings yet</td></tr>`;
        return;
      }
      const stats = await loadPortfolioStats(portfolioId);
      const statsMap = {};
        if (stats) {
        stats.forEach(s => {
            statsMap[s.symbol] = {
            cov: s.COV ?? "-",
            beta: s.Beta ?? "-"
            };
        });
        }
        const hv = await loadHoldingsValue(portfolioId);
        const hvMap = {};
        hv.forEach(v => {
          hvMap[v.symbol] = v;
        });
  
      tbody.innerHTML = holdings.map(h => {
        const sym = h.symbol;
        const avg = Number(h.avgprice).toFixed(2);
        const lastClose = Number(hvMap[sym]?.lastClose ?? "-").toFixed(2) || "-";
        const mv = Number(hvMap[sym]?.mv ?? "-").toFixed(2) || "-";     
        const cov = Number(statsMap[sym]?.cov ?? "-").toFixed(6) || "-";
        const beta = Number(statsMap[sym]?.beta ?? "-").toFixed(6) || "-";
        return `
          <tr>
            <td class="symbol clickable" data-symbol="${sym}">${sym}</td>
            <td>${h.shares}</td>
            <td>$${lastClose}</td>
            <td>$${avg}</td>
            <td>$${mv}</td>
            <td>${cov}</td>
            <td>${beta}</td>
          </tr>
        `;
      }).join("");
  
      // holdings clickable
      attachSymbolClickHandlers();
    } catch (err) {
      console.error("holdings error:", err);
      tbody.innerHTML = `<tr><td colspan="5" class="muted">Error loading holdings</td></tr>`;
    }
  }

  // buy stocks
  export async function buyStocks(portfolioId, symbol, sharesCount, pricePerShare) {
    const price = isNaN(pricePerShare) ? null : pricePerShare;
    const res = await fetch('/api/trading/buy', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        portfolioId: portfolioId,
        symbol: symbol,
        sharesCount: sharesCount,
        pricePerShare: price
      })
    });
  
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "Failed to buy stocks.");
      return;
    }
  
    alert(`Successfully bought ${sharesCount} shares of ${symbol}.`);
    await loadHoldings(portfolioId);
    await loadPortfolioCash(portfolioId);
  }

  // sell stocks
    export async function sellStocks(portfolioId, symbol, sharesCount, pricePerShare) {
        const price = isNaN(pricePerShare) ? null : pricePerShare;
        const res = await fetch('/api/trading/sell', {
        method: 'POST',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
            portfolioId: portfolioId,
            symbol: symbol,
            sharesCount: sharesCount,
            pricePerShare: price
        })
        });
    
        if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Failed to sell stocks.");
        return;
        }
    
        alert(`Successfully sold ${sharesCount} shares of ${symbol}.`);
        await loadHoldings(portfolioId);
        await loadPortfolioCash(portfolioId);
    }
let selectedSymbol = null;
// click handler
function attachSymbolClickHandlers() {
    document.querySelectorAll(".symbol.clickable").forEach(cell => {
      cell.addEventListener("click", () => {
        console.log("##clicked symbol cell");
        const sym = cell.dataset.symbol;
        console.log("##symbol:", sym);
        selectedSymbol = sym;
        document.getElementById("stock-dialog").showModal();
      });
    });
  }
  export function initDialogButtons() {
    document.getElementById("history-btn").addEventListener("click", async () => {
      console.log("Clicked history");
      if (!globalStartDate || !globalEndDate) {
        //alert("Please set both Start and End date first!");
        return;
      }
      await fetch(`api/chart/${selectedSymbol}/${globalStartDate}/${globalEndDate}`, {
        method: "GET"
      });
  
      document.getElementById("stock-dialog").close();
      alert(`${selectedSymbol} history plot requested.`);
    });
  
    document.getElementById("predict-btn").addEventListener("click", async () => {
      console.log("Clicked prediction");
      await fetch(`/api/chart/predict/${selectedSymbol}`, {
        method: "GET"
      });
  
      document.getElementById("stock-dialog").close();
      alert(`${selectedSymbol} prediction plot requested.`);
    });
  
    document.getElementById("close-dialog").addEventListener("click", () => {
      console.log("Clicked close");
  
      document.getElementById("stock-dialog").close();
    });
  }