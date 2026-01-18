/* ==================== Lists Page Logic ==================== */
let currentListId = null;

export async function loadListsPage() {
  const listsBody = document.getElementById('lists-body');
  const detailRoot = document.getElementById('list-detail');
  const shareForm = document.getElementById('share-form');
  const shareSelect = document.getElementById('share-friend-select');
  // revirews elements
  const reviewsSection = document.getElementById('reviews-section');
  const reviewForm = document.getElementById('review-form');
  const reviewTextarea = document.getElementById('review-content');
  const reviewsListEl = document.getElementById('reviews-list');
  // ADD THESE TWO LINES:
  const newListDlg = document.getElementById('dlg-new-list');
  const newListForm = newListDlg ? newListDlg.querySelector('form') : null;

  if (!listsBody || !detailRoot) return;

  console.log('Lists page detected, initializing…');

  function getOrCreateInfoContainer() {
    let info = detailRoot.querySelector('#list-main');
    if (!info) {
      info = document.createElement('div');
      info.id = 'list-main';
      detailRoot.insertBefore(info, detailRoot.firstChild);
    }
    return info;
  }

  function renderEmptyLists(text) {
    listsBody.innerHTML = `<tr><td colspan="5" class="muted">${text}</td></tr>`;
  }

  function renderEmptyDetail() {
    const info = getOrCreateInfoContainer();
    info.innerHTML = `<p class="muted">Pick a list to see entries, visibility, and reviews.</p>`;
    if (shareForm) {
      delete shareForm.dataset.listid;
    }
  }

  async function loadLists() {
    try {
      const res = await fetch('/api/lists', {
        credentials: 'include',
      });
      if (!res.ok) {
        console.error('loadLists status =', res.status);
        renderEmptyLists('Error loading lists');
        renderEmptyDetail();
        return;
      }

      const data = await res.json();
      console.log('lists data =', data);

      const lists = Array.isArray(data.lists) ? data.lists : [];

      if (!lists.length) {
        renderEmptyLists('No lists');
        renderEmptyDetail();
        return;
      }

      listsBody.innerHTML = '';
      lists.forEach((lst) => {
        const tr = document.createElement('tr');
        tr.dataset.listid = lst.listid;

        const visibility =
          lst.visibility || (lst.is_public ? 'public' : 'private');
        const owner = lst.owner_email || `User ${lst.ownerid}`;

        tr.innerHTML = `
          <td>${lst.name}</td>
          <td>${visibility}</td>
          <td>${owner}</td>
          <td>-</td>
          <td>
            <button class="btn" data-open-list="${lst.listid}">Open</button>
            ${
              lst.ownerid
                ? `<button class="btn danger" data-delete-list="${lst.listid}">Delete</button>`
                : ''
            }
          </td>
        `;

        listsBody.appendChild(tr);
      });

      const first = lists[0];
      if (first) {
        await renderListDetail(first.listid);
      } else {
        renderEmptyDetail();
      }
    } catch (err) {
      console.error('loadLists error:', err);
      renderEmptyLists('Error loading lists');
      renderEmptyDetail();
    }
  }
  document
    .getElementById('share-form')
    .addEventListener('submit', async (e) => {
      e.preventDefault();

      if (!currentListId) {
        alert('Please select a list first.');
        return;
      }

      const friendId = document.getElementById('share-friend-select').value;
      if (!friendId) {
        alert('Please select a friend');
        return;
      }

      try {
        const res = await fetch(
          `/api/lists/${currentListId}/share/${friendId}`,
          {
            method: 'POST',
            credentials: 'include',
          },
        );

        const data = await res.json();
        if (!res.ok || data.success === false) {
          alert(data.message || 'Failed to share list.');
          return;
        }

        alert('List shared successfully!');
      } catch (err) {
        console.error(err);
        alert('Network error.');
      }
    });
  async function loadFriendsForSharing() {
    const select = document.getElementById('share-friend-select');
    select.innerHTML = `<option value="">Select a friend</option>`;

    const res = await fetch('/api/users/me/friends', {
      credentials: 'include',
    });

    const data = await res.json();
    const friends = data.friends || [];

    friends.forEach((f) => {
      const op = document.createElement('option');
      op.value = f.userid;
      op.textContent = f.email;
      select.appendChild(op);
    });
  }

  async function renderListDetail(listId) {
    currentListId = listId;

    if (!listId) {
      renderEmptyDetail();
      return;
    }

    try {
      const res = await fetch(`/api/lists/${listId}`, {
        credentials: 'include',
      });
      if (!res.ok) {
        console.error('GET /api/lists/:id status =', res.status);
        renderEmptyDetail();
        return;
      }

      const data = await res.json();
      console.log('list detail =', data);

      const list = data.list;
      const stocks = Array.isArray(data.stocks) ? data.stocks : [];

      if (!list) {
        renderEmptyDetail();
        return;
      }

      const info = getOrCreateInfoContainer();

      const visibility =
        list.visibility || (list.is_public ? 'public' : 'private');
      const owner = list.owner_email || `User ${list.ownerid}`;

      info.innerHTML = `
  <h3>${list.name}</h3>
  <p class="muted">
    Visibility: <strong>${visibility}</strong> · Owner: ${owner}
  </p>

  <h4>Stocks in this list</h4>
  ${
    stocks.length
      ? `<ul class="muted">
           ${stocks
             .map((s) => `<li>${s.symbol} — ${s.shares} shares</li>`)
             .join('')}
         </ul>`
      : `<p class="muted">No stocks yet.</p>`
  }

  <!-- Add stock form -->
  <form id="add-stock-form" style="margin-top: 0.75rem">
    <div class="row" style="gap: 8px; align-items: center;">
      <input
        name="symbol"
        placeholder="Symbol (e.g. AAPL)"
        required
        style="flex: 1;"
      />
      <input
        name="shares"
        type="number"
        min="1"
        placeholder="Shares"
        required
        style="width: 90px;"
      />
      <button class="btn primary" type="submit">Add stock</button>
    </div>
  </form>
`;

      if (shareForm) {
        shareForm.dataset.listid = String(listId);
      }
      const addStockForm = info.querySelector('#add-stock-form');
      if (addStockForm) {
        addStockForm.addEventListener('submit', async (e) => {
          e.preventDefault();

          if (!currentListId) {
            alert('Please select a list first.');
            return;
          }

          const symbol = addStockForm.symbol.value.trim().toUpperCase();
          const shares = parseInt(addStockForm.shares.value, 10);

          if (!symbol) {
            alert('Please enter a symbol.');
            return;
          }
          if (!Number.isFinite(shares) || shares <= 0) {
            alert('Please enter a positive number of shares.');
            return;
          }

          try {
            const res = await fetch(`/api/lists/${currentListId}/stocks`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                stocks: [{ symbol, shares }],
              }),
            });

            const data = await res.json().catch(() => ({}));
            if (!res.ok || data.success === false) {
              alert(data.message || 'Failed to add stock to list.');
              return;
            }

            addStockForm.reset();
            await renderListDetail(currentListId);
          } catch (err) {
            console.error('add stock error:', err);
            alert('Network error when adding stock.');
          }
        });
      }

      await loadReviews(listId);
    } catch (err) {
      console.error('renderListDetail error:', err);
      renderEmptyDetail();
    }
  }

  async function populateFriendSelect() {
    if (!shareSelect) return;
    try {
      const res = await fetch('/api/users/me/friends', {
        credentials: 'include',
      });
      if (!res.ok) {
        console.error('populateFriendSelect status =', res.status);
        return;
      }
      const data = await res.json();
      console.log('friends for share =', data);

      const friends = Array.isArray(data)
        ? data
        : Array.isArray(data.friends)
        ? data.friends
        : [];

      shareSelect.innerHTML =
        '<option value="">Select a friend</option>' +
        friends
          .map((f) => {
            const label = f.name || f.email || `User ${f.userid}`;
            return `<option value="${f.userid}">${label}</option>`;
          })
          .join('');
    } catch (err) {
      console.error('populateFriendSelect error:', err);
    }
  }

  if (reviewForm && reviewTextarea) {
    reviewForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const content = reviewTextarea.value.trim();
      if (!currentListId) {
        alert('Please select a list first.');
        return;
      }
      if (!content) {
        alert('Review content cannot be empty.');
        return;
      }

      try {
        const res = await fetch(`/api/lists/${currentListId}/reviews`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ content }),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.success === false) {
          alert(data.message || 'Failed to save review.');
          return;
        }

        await loadReviews(currentListId);
      } catch (err) {
        console.error('POST review error:', err);
        alert('Network error when saving review.');
      }
    });
  }

  if (newListForm && newListDlg) {
    newListForm.addEventListener('submit', async (event) => {
      event.preventDefault();

      const name = newListForm.name.value.trim();
      const vis = newListForm.visibility.value; 
      if (!name) return;

      const is_public = vis === 'public';

      try {
        const res = await fetch('/api/lists', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ name, is_public }),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.success === false) {
          alert(data.message || 'Failed to create list');
          return;
        }

        newListForm.reset();
        newListDlg.close();
        await loadLists();
      } catch (err) {
        console.error('create list error:', err);
        alert('Network error when creating list.');
      }
    });
  }

  async function loadReviews(listId) {
    if (!reviewsListEl) return;

    try {
      const res = await fetch(`/api/lists/${listId}/reviews`, {
        credentials: 'include',
      });
      if (!res.ok) {
        console.error('GET /api/lists/:id/reviews status =', res.status);
        reviewsListEl.innerHTML =
          '<li class="muted">Failed to load reviews.</li>';
        return;
      }

      const data = await res.json();
      const reviews = Array.isArray(data.reviews) ? data.reviews : [];

      if (!reviews.length) {
        reviewsListEl.innerHTML = '<li class="muted">No reviews yet.</li>';
        return;
      }

      reviewsListEl.innerHTML = '';
      reviews.forEach((r) => {
        const li = document.createElement('li');
        const created = r.created_at
          ? new Date(r.created_at).toLocaleString()
          : '';
        li.innerHTML = `
          <div>${r.content.replace(/</g, '&lt;')}</div>
          <div class="muted" style="font-size: 0.8rem">
            by ${r.user_email || 'Unknown'} · ${created}
          </div>
          <button
            class="btn danger"
            type="button"
            data-delete-review="${r.reviewid}"
            style="margin-top: 4px"
          >
            Delete
          </button>
        `;
        reviewsListEl.appendChild(li);
      });
    } catch (err) {
      console.error('loadReviews error:', err);
      reviewsListEl.innerHTML = '<li class="muted">Error loading reviews.</li>';
    }
  }

  document.addEventListener('click', async (e) => {
    // delete review
    if (e.target.matches('[data-delete-review]')) {
      const reviewId = e.target.dataset.deleteReview;
      if (!currentListId || !reviewId) return;

      if (!confirm('Delete this review?')) {
        return;
      }

      try {
        const res = await fetch(
          `/api/lists/${currentListId}/reviews/${reviewId}`,
          {
            method: 'DELETE',
            credentials: 'include',
          },
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.success === false) {
          alert(data.message || 'Failed to delete review.');
          return;
        }
        await loadReviews(currentListId);
      } catch (err) {
        console.error('DELETE review error:', err);
        alert('Network error when deleting review.');
      }
    }
  });

  // Open / Delete
  document.addEventListener('click', async (e) => {
    // Open
    if (e.target.matches('[data-open-list]')) {
      const listId = e.target.dataset.openList;
      await renderListDetail(listId);
      return;
    }

    // Delete
    if (e.target.matches('[data-delete-list]')) {
      const listId = e.target.dataset.deleteList;
      if (!confirm('Delete this list? This cannot be undone.')) {
        return;
      }

      try {
        const res = await fetch(`/api/lists/${listId}`, {
          method: 'DELETE',
          credentials: 'include',
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.success === false) {
          alert(data.message || 'Failed to delete list');
          return;
        }

        await loadLists();
      } catch (err) {
        console.error('delete list error:', err);
        alert('Network error when deleting list.');
      }
    }
  });

  // share list 
  if (shareForm && shareSelect) {
    shareForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const listId = shareForm.dataset.listid;
      const friendId = shareSelect.value;

      if (!listId) {
        alert('Please select a list first.');
        return;
      }
      if (!friendId) {
        alert('Please select a friend.');
        return;
      }

      try {
        const res = await fetch(`/api/lists/${listId}/share/${friendId}`, {
          method: 'POST',
          credentials: 'include',
        });
        const body = await res.json().catch(() => ({}));

        if (!res.ok || body.success === false) {
          alert(body.message || 'Failed to share list.');
          return;
        }

        alert('List shared with selected friend.');
        await loadLists();
      } catch (err) {
        console.error('share list error:', err);
        alert('Network error when sharing list.');
      }
    });
  }

  await populateFriendSelect();
  await loadLists();
  await loadFriendsForSharing();
}
