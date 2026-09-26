CREATE TABLE customers (
  id         bigserial PRIMARY KEY,
  full_name  text NOT NULL,
  email      text NOT NULL,
  phone      text,
  upi_id     text,
  pan        text,
  created_at timestamptz NOT NULL DEFAULT now()
);
