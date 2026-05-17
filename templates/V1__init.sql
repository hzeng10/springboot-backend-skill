-- V1__init.sql — 初始 Schema
-- 所有表使用 utf8mb4_0900_ai_ci，支持全 Unicode（含 Emoji）

CREATE TABLE app_user (
  id            BIGINT        NOT NULL AUTO_INCREMENT,
  first_name    VARCHAR(50)   NOT NULL,
  last_name     VARCHAR(50)   NOT NULL,
  email         VARCHAR(191)  NOT NULL,
  password_hash VARCHAR(255)  NOT NULL,
  created_at    DATETIME(6)   NOT NULL,
  updated_at    DATETIME(6)   NOT NULL,
  version       INT           NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uk_app_user_email (email)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
