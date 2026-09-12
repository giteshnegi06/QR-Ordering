-- "Need Water" / "Call Server" from the customer tracking page previously
-- only showed the customer their own toast — nothing ever reached staff.
-- This table is the actual notification staff see and can resolve.
CREATE TABLE IF NOT EXISTS table_requests (
  id         text PRIMARY KEY,
  cafe_id    text NOT NULL REFERENCES cafes(id) ON DELETE CASCADE,
  table_id   text NOT NULL,
  table_number text NOT NULL,
  type       text NOT NULL CHECK (type IN ('water', 'server')),
  status     text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_table_requests_status ON table_requests (status, created_at DESC);
