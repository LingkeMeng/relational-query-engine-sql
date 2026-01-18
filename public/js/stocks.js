async function loadStocks() {
    const tbody = document.getElementById("stocks-body");
    tbody.innerHTML = `<tr><td colspan="7" class="muted">Loading…</td></tr>`;
  
    try {
      const res = await fetch("/api/stocks/all/limit", { credentials: "include" });
      if (!res.ok) {
        tbody.innerHTML = `<tr><td colspan="7" class="muted">Failed to load stocks</td></tr>`;
        return;
      }
  
      const all = await res.json(); 
  
      if (!Array.isArray(all) || all.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="muted">No stock data</td></tr>`;
        return;
      }
      all.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));  
      // backendsliced already
      const latest = all;  
      tbody.innerHTML = latest
        .map(row => `
          <tr>
            <td>${row.symbol}</td>
            <td>${row.timestamp.slice(0, 10)}</td>
            <td>${Number(row.open).toFixed(2)}</td>
            <td>${Number(row.high).toFixed(2)}</td>
            <td>${Number(row.low).toFixed(2)}</td>
            <td>${Number(row.close).toFixed(2)}</td>
            <td>${row.volume}</td>
          </tr>
        `)
        .join("");
  
    } catch (err) {
      console.error("Stocks load error:", err);
      tbody.innerHTML = `<tr><td colspan="7" class="muted">Error loading stocks</td></tr>`;
    }
  }
  
  // init big board for stocks
  window.addEventListener("DOMContentLoaded", loadStocks);