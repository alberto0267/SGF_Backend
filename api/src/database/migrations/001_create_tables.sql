CREATE TABLE IF NOT EXISTS roles (
  id   INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS companies (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  uuid       CHAR(36)     NOT NULL UNIQUE,
  name       VARCHAR(100) NOT NULL,
  nif        VARCHAR(20)  NOT NULL UNIQUE,
  address    VARCHAR(255) NOT NULL,
  phone      VARCHAR(20),
  active     TINYINT(1)   NOT NULL DEFAULT 1,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_companies_uuid ON companies(uuid);

CREATE TABLE IF NOT EXISTS users (
  id                    INT AUTO_INCREMENT PRIMARY KEY,
  uuid                  CHAR(36)     NULL UNIQUE,
  email                 VARCHAR(100) NOT NULL UNIQUE,
  password              VARCHAR(255) NOT NULL,
  active                TINYINT(1)   NOT NULL DEFAULT 1,
  role_id               INT          NOT NULL,
  company_id            INT          NOT NULL,
  failed_login_attempts TINYINT      NOT NULL DEFAULT 0,
  locked_until          DATETIME     NULL,
  last_login_at         DATETIME     NULL,
  created_at            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (role_id)    REFERENCES roles(id),
  FOREIGN KEY (company_id) REFERENCES companies(id)
);

CREATE INDEX idx_users_uuid ON users(uuid);

CREATE TABLE IF NOT EXISTS profiles (
  id         INT AUTO_INCREMENT PRIMARY KEY,
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
  id         INT AUTO_INCREMENT PRIMARY KEY,
  uuid       CHAR(36)     NOT NULL UNIQUE,
  name       VARCHAR(100) NOT NULL,
  address    VARCHAR(255),
  email      VARCHAR(100),
  company_id INT          NOT NULL,
  active     TINYINT(1)   NOT NULL DEFAULT 1,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
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
  id         INT          AUTO_INCREMENT PRIMARY KEY,
  user_id    INT          NOT NULL,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  expires_at DATETIME     NOT NULL,
  revoked    TINYINT(1)   NOT NULL DEFAULT 0,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_token_hash (token_hash),
  INDEX idx_user_id (user_id)
);

CREATE TABLE IF NOT EXISTS audit_log (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  actor_id      INT          COMMENT 'Quien ejecuta la acción',
  user_id       INT          COMMENT 'Sobre quien se actúa',
  entity_type   VARCHAR(50)  NOT NULL,
  entity_id     INT,
  action        VARCHAR(50)  NOT NULL,
  source        ENUM('web', 'app') NOT NULL,
  ip            VARCHAR(45)  NOT NULL,
  before_data   JSON,
  after_data    JSON,
  status        ENUM('success', 'failed') NOT NULL DEFAULT 'success',
  error_message TEXT,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (actor_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS mobile_tokens (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT          NOT NULL,
  token      VARCHAR(255) NOT NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT          NOT NULL,
  title      VARCHAR(150) NOT NULL,
  message    TEXT         NOT NULL,
  is_read    TINYINT(1)   NOT NULL DEFAULT 0,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS pdfs (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT          NOT NULL,
  filename   VARCHAR(255) NOT NULL,
  path       VARCHAR(255) NOT NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS refunds (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT            NOT NULL,
  amount      DECIMAL(10, 2) NOT NULL,
  description TEXT,
  status      ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  created_at  DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS truck_deliveries (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT  NOT NULL,
  date        DATE NOT NULL,
  description TEXT,
  status      ENUM('pending', 'completed', 'cancelled') NOT NULL DEFAULT 'pending',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS cash_register_closures (
  id         INT            AUTO_INCREMENT PRIMARY KEY,
  user_id    INT            NOT NULL,
  date       DATE           NOT NULL,
  total      DECIMAL(10, 2) NOT NULL,
  notes      TEXT,
  created_at DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS leave_requests (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT  NOT NULL,
  start_date DATE NOT NULL,
  end_date   DATE NOT NULL,
  reason     TEXT,
  status     ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS overtimes (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT            NOT NULL,
  date       DATE           NOT NULL,
  hours      DECIMAL(4, 2)  NOT NULL,
  reason     TEXT,
  status     ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  created_at DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS bakery (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT  NOT NULL,
  date        DATE NOT NULL,
  description TEXT,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

