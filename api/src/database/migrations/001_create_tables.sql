CREATE TABLE IF NOT EXISTS roles (
  id   SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS companies (
  id         SERIAL       PRIMARY KEY,
  uuid       UUID         NOT NULL UNIQUE,
  name       VARCHAR(100) NOT NULL,
  nif        VARCHAR(20)  NOT NULL UNIQUE,
  address    VARCHAR(255) NOT NULL,
  phone      VARCHAR(20),
  active     BOOLEAN      NOT NULL DEFAULT true,
  retirada_valor DECIMAL(10, 2) NOT NULL DEFAULT 500,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_companies_uuid ON companies(uuid);

CREATE TABLE IF NOT EXISTS users (
  id                    SERIAL       PRIMARY KEY,
  uuid                  UUID         NULL UNIQUE,
  email                 VARCHAR(100) NOT NULL UNIQUE,
  password              VARCHAR(255) NOT NULL,
  active                BOOLEAN      NOT NULL DEFAULT true,
  role_id               INT          NOT NULL,
  company_id            INT          NOT NULL,
  failed_login_attempts SMALLINT     NOT NULL DEFAULT 0,
  locked_until          TIMESTAMP    NULL,
  last_login_at         TIMESTAMP    NULL,
  created_at            TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (role_id)    REFERENCES roles(id),
  FOREIGN KEY (company_id) REFERENCES companies(id)
);

CREATE INDEX idx_users_uuid ON users(uuid);

CREATE TABLE IF NOT EXISTS profiles (
  id         SERIAL       PRIMARY KEY,
  user_id    INT          NOT NULL UNIQUE,
  first_name VARCHAR(100) NOT NULL,
  last_name  VARCHAR(100) NOT NULL,
  dni        VARCHAR(20)  UNIQUE,
  phone      VARCHAR(20),
  address    VARCHAR(255),
  avatar     VARCHAR(255),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS workcenters (
  id         SERIAL       PRIMARY KEY,
  uuid       UUID         NOT NULL UNIQUE,
  name       VARCHAR(100) NOT NULL,
  address    VARCHAR(255),
  email      VARCHAR(100),
  company_id INT          NOT NULL,
  active     BOOLEAN      NOT NULL DEFAULT true,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id)
);

CREATE TABLE IF NOT EXISTS user_workcenters (
  user_id       INT NOT NULL,
  workcenter_id INT NOT NULL,
  PRIMARY KEY (user_id, workcenter_id),
  FOREIGN KEY (user_id)       REFERENCES users(id),
  FOREIGN KEY (workcenter_id) REFERENCES workcenters(id)
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         SERIAL       PRIMARY KEY,
  user_id    INT          NOT NULL,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMP    NOT NULL,
  revoked    BOOLEAN      NOT NULL DEFAULT false,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_token_hash ON refresh_tokens(token_hash);
CREATE INDEX idx_refresh_user_id ON refresh_tokens(user_id);

CREATE TABLE IF NOT EXISTS audit_log (
  id            SERIAL      PRIMARY KEY,
  actor_id      INT,
  user_id       INT,
  entity_type   VARCHAR(50) NOT NULL,
  entity_id     INT,
  action        VARCHAR(50) NOT NULL,
  source        VARCHAR(10) NOT NULL CHECK (source IN ('web', 'app')),
  ip            VARCHAR(45) NOT NULL,
  before_data   JSONB,
  after_data    JSONB,
  status        VARCHAR(10) NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'failed')),
  error_message TEXT,
  created_at    TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (actor_id) REFERENCES users(id)
);

CREATE INDEX idx_audit_after  ON audit_log USING gin(after_data);
CREATE INDEX idx_audit_before ON audit_log USING gin(before_data);

CREATE TABLE IF NOT EXISTS mobile_tokens (
  id         SERIAL       PRIMARY KEY,
  user_id    INT          NOT NULL,
  token      VARCHAR(255) NOT NULL,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id         SERIAL       PRIMARY KEY,
  user_id    INT          NOT NULL,
  title      VARCHAR(150) NOT NULL,
  message    TEXT         NOT NULL,
  is_read    BOOLEAN      NOT NULL DEFAULT false,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS pdfs (
  id         SERIAL       PRIMARY KEY,
  user_id    INT          NOT NULL,
  filename   VARCHAR(255) NOT NULL,
  path       VARCHAR(255) NOT NULL,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS refunds (
  id          SERIAL         PRIMARY KEY,
  user_id     INT            NOT NULL,
  amount      DECIMAL(10, 2) NOT NULL,
  description TEXT,
  status      VARCHAR(20)    NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at  TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS truck_deliveries (
  id          SERIAL      PRIMARY KEY,
  user_id     INT         NOT NULL,
  date        DATE        NOT NULL,
  description TEXT,
  status      VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  created_at  TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS cash_register_closures (
  id             SERIAL         PRIMARY KEY,
  uuid           UUID           NOT NULL UNIQUE,
  workcenter_id  INT            NOT NULL,
  employee_id    INT            NOT NULL,
  date           DATE           NOT NULL,
  efectivo       DECIMAL(10, 2) NOT NULL,
  n_ret          INT            NOT NULL,
  datafono       DECIMAL(10, 2) NOT NULL,
  c_tarjeta      DECIMAL(10, 2) NOT NULL,
  dif_arqueo_ef  DECIMAL(10, 2) NOT NULL,
  retirada_valor DECIMAL(10, 2) NOT NULL,
  dif_datafono   DECIMAL(10, 2) NOT NULL,
  dif_total      DECIMAL(10, 2) NOT NULL,
  retiradas      DECIMAL(10, 2) NOT NULL,
  t_ventas       DECIMAL(10, 2) NOT NULL,
  t_efectivo     DECIMAL(10, 2) NOT NULL,
  created_at     TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (employee_id, date),
  FOREIGN KEY (workcenter_id) REFERENCES workcenters(id),
  FOREIGN KEY (employee_id)   REFERENCES users(id)
);

CREATE INDEX idx_cash_closures_uuid ON cash_register_closures(uuid);
CREATE INDEX idx_cash_closures_date ON cash_register_closures(date);

CREATE TABLE IF NOT EXISTS cash_register_closure_edits (
  id         SERIAL    PRIMARY KEY,
  closure_id INT       NOT NULL,
  editor_id  INT       NOT NULL,
  comment    TEXT      NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (closure_id) REFERENCES cash_register_closures(id) ON DELETE CASCADE,
  FOREIGN KEY (editor_id)  REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS vacation_requests (
  id          SERIAL       PRIMARY KEY,
  uuid        UUID         NOT NULL UNIQUE,
  employee_id INT          NOT NULL,
  subject     VARCHAR(150) NOT NULL,
  start_date  DATE         NOT NULL,
  end_date    DATE         NOT NULL,
  status      VARCHAR(20)  NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES users(id)
);

CREATE INDEX idx_vacation_requests_uuid ON vacation_requests(uuid);
CREATE INDEX idx_vacation_requests_employee ON vacation_requests(employee_id);

CREATE TABLE IF NOT EXISTS vacation_comments (
  id          SERIAL    PRIMARY KEY,
  vacation_id INT       NOT NULL,
  author_id   INT       NOT NULL,
  text        TEXT      NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (vacation_id) REFERENCES vacation_requests(id) ON DELETE CASCADE,
  FOREIGN KEY (author_id)   REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS absence_requests (
  id          SERIAL       PRIMARY KEY,
  uuid        UUID         NOT NULL UNIQUE,
  employee_id INT          NOT NULL,
  date        DATE         NOT NULL,
  modality    VARCHAR(10)  NOT NULL CHECK (modality IN ('dias', 'horas')),
  days        SMALLINT,
  slot_start  VARCHAR(5),
  slot_end    VARCHAR(5),
  hours       DECIMAL(4, 2),
  reason      TEXT         NOT NULL,
  status      VARCHAR(20)  NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES users(id)
);

CREATE INDEX idx_absence_requests_uuid ON absence_requests(uuid);
CREATE INDEX idx_absence_requests_employee ON absence_requests(employee_id);

CREATE TABLE IF NOT EXISTS absence_comments (
  id         SERIAL    PRIMARY KEY,
  absence_id INT       NOT NULL,
  author_id  INT       NOT NULL,
  text       TEXT      NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (absence_id) REFERENCES absence_requests(id) ON DELETE CASCADE,
  FOREIGN KEY (author_id)  REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS overtime_requests (
  id            SERIAL      PRIMARY KEY,
  uuid          UUID        NOT NULL UNIQUE,
  workcenter_id INT         NOT NULL,
  requested_by  INT         NOT NULL,
  date          DATE        NOT NULL,
  reason        TEXT,
  status        VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by   INT         NULL,
  approved_at   TIMESTAMP   NULL,
  created_at    TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (workcenter_id) REFERENCES workcenters(id),
  FOREIGN KEY (requested_by)  REFERENCES users(id),
  FOREIGN KEY (approved_by)   REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS overtime_request_items (
  id          SERIAL        PRIMARY KEY,
  request_id  INT           NOT NULL,
  employee_id INT           NOT NULL,
  hours       DECIMAL(4, 2) NOT NULL,
  FOREIGN KEY (request_id)  REFERENCES overtime_requests(id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS overtime_accumulation (
  id          SERIAL        PRIMARY KEY,
  employee_id INT           NOT NULL,
  year        SMALLINT      NOT NULL,
  month       SMALLINT      NOT NULL,
  total_hours DECIMAL(6, 2) NOT NULL DEFAULT 0,
  UNIQUE (employee_id, year, month),
  FOREIGN KEY (employee_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS overtime_payments (
  id              SERIAL        PRIMARY KEY,
  accumulation_id INT           NOT NULL,
  hours           DECIMAL(6, 2) NOT NULL,
  method          VARCHAR(20)   NOT NULL CHECK (method IN ('money', 'hours_off')),
  comment         TEXT,
  paid_by         INT           NOT NULL,
  created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (accumulation_id) REFERENCES overtime_accumulation(id) ON DELETE CASCADE,
  FOREIGN KEY (paid_by)         REFERENCES users(id)
);

CREATE INDEX idx_overtime_payments_accumulation ON overtime_payments(accumulation_id);

CREATE TABLE IF NOT EXISTS bakery (
  id          SERIAL    PRIMARY KEY,
  user_id     INT       NOT NULL,
  date        DATE      NOT NULL,
  description TEXT,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
