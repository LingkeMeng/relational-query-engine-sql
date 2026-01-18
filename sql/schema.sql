CREATE TABLE IF NOT EXISTS Stocks (
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
    name TEXT NOT NULL,
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

CREATE TABLE IF NOT EXISTS stocklist(
   listid   SERIAL PRIMARY KEY,
   ownerid   INTEGER NOT NULL REFERENCES users(userid) ON DELETE CASCADE,
   name      VARCHAR(255) NOT NULL,
   is_public    BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS review (
   reviewid   SERIAL PRIMARY KEY,
   listid     INTEGER NOT NULL REFERENCES stocklist(listid) ON DELETE CASCADE,
   userid     INTEGER NOT NULL REFERENCES users(userid) ON DELETE CASCADE,
   content    VARCHAR(4000) NOT NULL,
   created_at TIMESTAMP NOT NULL DEFAULT NOW(),
   updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
   UNIQUE (listid, userid)  
);


CREATE TABLE stocklist_shared_with (
  listid  INTEGER NOT NULL REFERENCES stocklist(listid) ON DELETE CASCADE,
  userid  INTEGER NOT NULL REFERENCES users(userid)     ON DELETE CASCADE,
  PRIMARY KEY (listid, userid)
);

CREATE TABLE stockin (
  listid INTEGER NOT NULL REFERENCES stocklist(listid) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  shares NUMERIC NOT NULL,
  PRIMARY KEY (listid, symbol)
);
 
CREATE UNIQUE INDEX IF NOT EXISTS ux_review_list_user
  ON review(listid, userid);

CREATE TABLE IF NOT EXISTS Portfolio (
    PortfolioID SERIAL PRIMARY KEY,
    UserID INTEGER NOT NULL REFERENCES users(userid),
    Name TEXT NOT NULL,
    CashBalance NUMERIC DEFAULT 0
);

CREATE TABLE IF NOT EXISTS Transaction (
    TransactionID SERIAL PRIMARY KEY,
    PortfolioID INT NOT NULL REFERENCES Portfolio(PortfolioID) ON DELETE CASCADE,
    Amount NUMERIC(12,2) NOT NULL,
    Detail TEXT NOT NULL,
    CreatedAt TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS StockSymbols (
    Symbol TEXT PRIMARY KEY
);

INSERT INTO StockSymbols (Symbol)
SELECT DISTINCT Symbol FROM Stocks
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS Holdings (
    HoldingID     SERIAL PRIMARY KEY,
    PortfolioID   INT NOT NULL REFERENCES Portfolio(PortfolioID) ON DELETE CASCADE,
    Symbol TEXT NOT NULL REFERENCES StockSymbols(Symbol) ON DELETE CASCADE,
    Shares        INT NOT NULL CHECK (Shares >= 0),
    AvgPrice      NUMERIC(12, 4),
    CreatedAt     TIMESTAMP NOT NULL DEFAULT NOW(),
    UpdatedAt     TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE statistics_cache (
    portfolio_id INT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    symbol TEXT NOT NULL,
    cov NUMERIC,
    beta NUMERIC,
    updated_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (portfolio_id, start_date, end_date, symbol)
);

CREATE INDEX idx_review_listid ON review(listid);
CREATE INDEX idx_stockin_listid ON stockin(listid);
CREATE INDEX idx_shared_list_user ON stocklist_shared_with(listid, userid);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_request_from_to ON request(fromuserid, touserid);
CREATE INDEX idx_friend_user1_user2 ON friend(userid1, userid2);
