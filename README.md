<<<<<<< HEAD
# 25F-CSCC43-project

Project repo for CSCC43 project

## run instruction

install npm and run

```bash
node index.js
```

## Running the project on vm

### Running the backend on local terminal and updating repo code to run inside the vm

step 1 : if not, then install google cloud:
[installation steps](https://cloud.google.com/sdk/docs/install)

step 2 : enter the vm, this step is the same as to accessing the vm from google website using SSH

```bash
gcloud compute ssh <google-username>@<vm-name>
```

For my case it is

```bash
gcloud compute ssh chocolates_chen@c43vm-1
```

step 3 : Clone the project repo

```bash
cd ~
rm -rf 25F-CSCC43-project
git clone https://github.com/illumin04/25F-CSCC43-project.git
cd 25F-CSCC43-project
git checkout backend-init // not on main yet
npm install
node src/index.js
node src/db.js
```

There might be permission issue for cloning, use SSH clone or set up a token [here](https://github.com/settings/personal-access-tokens) and use the token and http clone.

step 4 : start and run the postgres db

```bash
sudo su postgres
bash
source ~/.bashrc
```

Check status

```bash
pg_ctl status
pg_ctl start
psql
```

Check existing database:

```bash
\l
```

Enter and exit existing database:

```postgres
\c mydb // it will be running after this
\q // for exiting
```

step 5 : go to the project folder on vm

```bash
cd ~
cd 25F-CSCC43-project
// test code from here
```

## Access the Server From Your Local Machine

# 7. Run the Server Inside the VM

```bash
node src/index.js
```

Expected output:

```
Server running at http://0.0.0.0:3000
[ { now: 2025-xx-xxTxx:xx:xx.xxxZ } ]
```

---

# 8. Access the Server From Your Local Machine

in CMD:

```cmd
gcloud compute ssh <google name>@<vm name> --zone=<zone> -- -L 3000:localhost:3000
```

for me

```cmd
gcloud compute ssh monicalingke@instance-20251023-202418 --zone=us-central1-f -- -L 3000:localhost:3000
```

Keep this window open — it maintains the tunnel.

Then visit:

```
http://localhost:3000
```

You will see the running service from your VM.

---

# 9. Verify the Service

Inside the VM, you can test with:

```bash
curl http://localhost:3000
```

If this returns data, the server is running correctly.

If browser access fails, check your SSH port forwarding session.

### Access endpoints

## Auth

- **POST `/api/auth/register`**  
  Create a new user account with email and password.

- **POST `/api/auth/login`**  
  Authenticate user and start a session (sets `connect.sid` cookie).

- **POST `/api/auth/logout`**  
  Log out the current user by destroying the active session.


## Users

- **GET `/api/users/me`**  
  Return the currently logged-in user's basic profile.

- **GET `/api/users/:userId`**  
  Return public information for a specific user by ID.

- **GET `/api/users/search?q=<email>`**  
  Search for users by partial or full email match.


## Friends

- **GET `/api/users/me/friends`**  
  Retrieve the list of friends for the current user.

- **DELETE `/api/users/me/friends/:friendId`**  
  Remove an existing friend relationship with the specified user.


## Friend Requests

- **POST `/api/users/:userId/friend-requests`**  
  Send a new friend request to the target user.

- **GET `/api/users/me/friend-requests?type=incoming|outgoing`**  
  List incoming or outgoing friend requests for the current user.

- **POST `/api/users/me/friend-requests/:requestId/accept`**  
  Accept a pending friend request addressed to the current user.

- **POST `/api/users/me/friend-requests/:requestId/reject`**  
  Reject a pending friend request addressed to the current user.


## Stock Lists

- **POST `/api/lists`**  
  Create a new stock list owned by the current user. Requires a list name in the request body.

- **GET `/api/lists`**  
  Return all stock lists accessible to the current user (including owned lists and shared lists).

- **GET `/api/lists/:listId`**  
  Return detailed information about a specific stock list, if the user has access.

- **DELETE `/api/lists/:listId`**  
  Delete a stock list owned by the current user. All associated reviews are also deleted.

- **GET `/api/lists/:listId/stocks`**  
  Retrieve all stocks within the specified stock list.

- **POST `/api/lists/:listId/stocks`**  
  Add a stock to the list. Requires a stock symbol in the request body.

- **DELETE `/api/lists/:listId/stocks/:symbol`**  
  Remove a stock (by symbol) from the list.

- **POST `/api/lists/:listId/share/:userId`**  
  Share the specified stock list with another user, granting them read access.

- **DELETE `/api/lists/:listId/share/:userId`**  
  Remove sharing permissions from the specified user.


## Reviews

- **POST `/api/lists/:listId/reviews`**  
  Create or update the current user's review for this list  
  (max one review per user per list, up to 4000 characters).

- **GET `/api/lists/:listId/reviews`**  
  Retrieve all reviews for this list.  
  - Public lists: all reviews visible to all users.  
  - Private lists: reviews visible only to the reviewer and the list owner.

- **DELETE `/api/lists/:listId/reviews/:reviewId`**  
  Delete a review.  
  A review may be deleted by its author or the list owner.

## Stocks

- **GET `/api/stocks`**  
  Returns all unique stock symbols.

- **GET `/api/stocks/:symbol`**  
  Returns full price history for the specified symbol.  
  Optional query parameters: `?limit=100&order=ASC`

- **GET `/api/stocks/:symbol/latest`**  
  Returns the most recent price entry for the specified symbol.

- **GET `/api/stocks/:symbol/:date`**  
  Returns the price for the specified symbol on the specified date  
  Example: `/api/stocks/AAPL/2024-01-15`

- **GET `/api/stocks/:symbol/range/:startDate/:endDate`**  
  Returns historical price records between the two dates (inclusive).

- **GET `/api/stocks/:symbol/stats`**  
  Returns statistical metrics for the stock (record count, earliest/latest date, averages, highs/lows, volume totals).

- **POST `/api/stocks`**  
  Inserts a new stock price record.  
  Body: `{ "symbol", "timestamp", "open", "high", "low", "close", "volume" }`

- **PUT `/api/stocks/:symbol/:date`**  
  Updates an existing record for the given symbol and date.

- **DELETE `/api/stocks/:symbol/:date`**  
  Deletes the price record for the given symbol on the given date.

## Portfolio

- **GET `/api/portfolio`**  
  Returns all portfolios owned by the currently authenticated user.

- **POST `/api/portfolio`**  
  Creates a new portfolio for the current user.  
  Body: `{ "name": string, "cashBalance": number }`

- **GET `/api/portfolio/:portfolioId`**  
  Returns a single portfolio, only if it belongs to the authenticated user.

- **PUT `/api/portfolio/:portfolioId`**  
  Updates the portfolio name or cash balance.  
  Body fields are optional: `{ "name"?: string, "cashBalance"?: number }`

- **DELETE `/api/portfolio/:portfolioId`**  
  Deletes the specified portfolio, only if it belongs to the authenticated user.

- **POST `/api/portfolio/:portfolioId/deposit`**  
  Adds cash to the portfolio's cash balance.  
  Body: `{ "amount": number }`

- **POST `/api/portfolio/:portfolioId/withdraw`**  
  Withdraws cash from the portfolio's cash balance (amount must not exceed current balance).  
  Body: `{ "amount": number }`

- **GET `/api/portfolio/:portfolioId/cash`**  
  Returns the current cash balance of the specified portfolio.

- **GET `/api/portfolio/:portfolioId/summary`**  
  Returns basic portfolio information: ID, name, and cash balance and market value.

- **GET `/api/portfolio/:portfolioId/statistics/:start/:end`**
  Return the COV, beta and Covariance matrix for stocks of the holdings inside the portfolio.

- **GET `/api/portfolio/:portfolioId/value`**
  Return the market value of the portfolio.

- **GET `api/portfolio/:portfolioId/transactions`**
  Return the transaction history of the portfolio

## Holdings

- **GET `/api/holdings/:portfolioId`**
  Get all holdings under a portfolio

- **POST `/api/trading/buy`**
  Buy shares (create / update holdings)
- **POST `/api/trading/sell`**
  Sell shares (reduce / remove holdings)

---

## Running the project on local and Loading the existing data csv

In a separated window run:

```bash
brew services start postgresql@15
brew services list //check running list
```

Run the project back up again:
always remember to configure `db.js` according to the env you are running the project.

```bash
node src/index.js
```

Start backend DB:

```bash
psql postgres
```

Creating db

```postgres
CREATE DATABASE cscc43;
```

Accessing

```postgres
\c cscc43
```

Importing the data csv

```postgres
\copy stocks(timestamp, open, high, low, close, volume, symbol)
FROM 'SP500History.csv'
CSV HEADER;
```

Be sure to have at least this table inside the testing database:

```postgres
CREATE TABLE Stocks (
    symbol VARCHAR(10) NOT NULL,
    timestamp DATE NOT NULL,
    open DECIMAL(10, 2),
    high DECIMAL(10, 2),
    low DECIMAL(10, 2),
    close DECIMAL(10, 2),
    volume BIGINT,
    PRIMARY KEY (symbol, timestamp)
);

CREATE TABLE IF NOT EXISTS users (
   userid SERIAL PRIMARY KEY,
   email TEXT UNIQUE NOT NULL,
   password_hash TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS friend (
  userid1 INTEGER NOT NULL REFERENCES users(userid),
  userid2 INTEGER NOT NULL REFERENCES users(userid),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (userid1, userid2)
);

CREATE TABLE IF NOT EXISTS request (
  requestid SERIAL PRIMARY KEY,
  fromuserid INTEGER NOT NULL REFERENCES users(userid) ON DELETE CASCADE,
  touserid   INTEGER NOT NULL REFERENCES users(userid) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS review (
   reviewid  SERIAL PRIMARY KEY,
   listid    INTEGER NOT NULL REFERENCES stocklist(listid) ON DELETE CASCADE,
   userid    INTEGER NOT NULL REFERENCES users(userid) ON DELETE CASCADE,
   content   VARCHAR(4000) NOT NULL
);
```

---

# Project TODO — Portfolio / Holdings / Stats / Data Integration

This TODO list contains only the requirements related to:

- Portfolios
- Holdings
- Statistics
- Historical + New Daily Stock Data Integration

---

## 1. Portfolio Management

- [x] Create portfolio table and API
- [x] Deposit cash
- [x] Withdraw cash
- [x] Record stock buys
- [x] Record stock sells
- [x] Maintain transaction history
- [ ] View a portfolio (cash + holdings summary and estimate)

---

## 2. Holdings Management

- [x] Holdings table (symbol, shares, avg price)
- [x] Buy logic: update shares and average price
- [x] Sell logic: reduce shares and increase cash
- [x] Prevent selling more shares than owned
- [x] GET all holdings in a portfolio
- [x] Compute market value of each holding (using last close price)
- [x] Compute total market value of portfolio

---

## 3. Stock Data Integration

- [x] Load 5 years of historical daily stock prices (provided data)
- [x] Create `Stocks` table
- [x] Deduplicate symbols into `StockSymbols` table
- [x] Add API to insert new daily stock data (open/high/low/close)
- [x] Merge historical + new data into a unified view （optional）
- [x] New data for charts
- [x] Use the latest available close price for market-value calculations

---

## 4. Portfolio Statistics

For the stocks currently held in the portfolio:

- [x] Compute coefficient of variation (COV)
- [x] Compute Beta of each stock
- [x] Build covariance/correlation matrix of all holdings
- [x] Allow user to select a any time
- [ ] Cache heavy statistical results (optional but recommended)

---

## 5. Historical Price Visualization

- [x] API: GET price history for a stock for a given interval
- [x] Can generate data charts for named symbol for any date interval
- [x] Integrate historical + new data

---

## 6. Future Price Prediction (Simple)

- [x] Implement a very simple predictor (e.g., moving average)
- [x] Provide API to get future predicted prices
- [x] Graph predicted trend in frontend

---

## 7. Optional

- [ ] Connect to Frontend UI
- [ ] Refine query

### Notification

The current sharing logic for stock lists contains several implicit rules that can lead to confusing outcomes:

1. **Creating a list without selecting any friends, but choosing the “Shared” visibility option**  
   In this case, the list is marked as “Shared” in the UI, but since no friends were selected, it is effectively visible **only to the creator**. The list behaves as if it were private, despite the “Shared” label.

2. **Creating a list with visibility set to “Private”, but selecting “Open” and choosing friends to share with**  
   When this happens, the system automatically overrides the “Private” setting. The visibility becomes **Shared**, and the selected friends are granted access. The “Open” option forces the list into shared mode even if the original selection was Private.

3. **Not selecting “Open”, selecting exactly one friend, and choosing “Shared”**  
   In this case, the first list in the user’s collection becomes shared with that friend. This behavior is a side effect of the current implementation and is considered undesirable. It is recommended to avoid relying on this path due to the inconsistent underlying logic.
=======
# relational-query-engine-sql
A miniature relational database system implementing core DBMS concepts.

Implemented components include:

- Relational schema design and normalization (3NF / BCNF)
- Multi-relation SQL query evaluation
- Join processing and aggregation
- Transaction schedules and conflict analysis
- Two-phase locking (2PL) simulation
- ACID property analysis
- Index-based access reasoning

This project emphasizes understanding how relational databases
execute and guarantee correctness beneath SQL.

## Features
- Feature 1
- Feature 2
- Feature 3

## Technical Highlights
- Algorithms
- Data structures
- System concepts

## Tech Stack
- Language
- Tools
- Environment

## What I Learned
Short bullet points explaining engineering insight.
>>>>>>> 3eff7a7495b973d501b77a08efd5353e6b37b3eb
