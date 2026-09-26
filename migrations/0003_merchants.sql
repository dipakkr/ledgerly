CREATE TABLE merchants (
  id         bigserial PRIMARY KEY,
  name       text NOT NULL,
  category   text NOT NULL,
  city       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
