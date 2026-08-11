-- @file backend/db/init.sql
-- @description MySQL 建表与初始数据脚本

-- ============================================
-- CampusHub 数据库初始化脚本
-- 基于 P3 详细设计 (MySQL 8.0)
-- 使用方法: mysql -u root -p < db/init.sql
-- ============================================

CREATE DATABASE IF NOT EXISTS campushub
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE campushub;

-- 1. 用户表
CREATE TABLE IF NOT EXISTS users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  student_id VARCHAR(20) UNIQUE NOT NULL COMMENT '学号，用于校园认证',
  password_hash VARCHAR(255) NOT NULL COMMENT 'Bcrypt加密密码，禁止明文',
  nickname VARCHAR(50) DEFAULT '匿名用户',
  phone VARBINARY(255) COMMENT '手机号，AES-GCM加密存储',
  credit_score INT DEFAULT 100 COMMENT '信用分缓存，初始100',
  is_verified BOOLEAN DEFAULT FALSE COMMENT '是否通过学生认证',
  email VARCHAR(100) UNIQUE COMMENT '校园邮箱',
  avatar_url VARCHAR(500) COMMENT '头像URL',
  hide_phone BOOLEAN DEFAULT TRUE COMMENT '隐私设置',
  hide_wechat BOOLEAN DEFAULT TRUE,
  hide_orders BOOLEAN DEFAULT FALSE,
  hide_reviews BOOLEAN DEFAULT FALSE,
  verification_status ENUM('none', 'pending', 'approved', 'rejected') DEFAULT 'none',
  student_card_url VARCHAR(500) COMMENT '学生证图片',
  failed_login_count INT DEFAULT 0,
  locked_until DATETIME NULL,
  is_graduated BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 2. 需求表
CREATE TABLE IF NOT EXISTS requirements (
  id INT PRIMARY KEY AUTO_INCREMENT,
  publisher_id INT NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT COMMENT '需求描述',
  location VARCHAR(200) DEFAULT '' COMMENT '地点',
  image_url VARCHAR(500) COMMENT '图片URL',
  category VARCHAR(20) NOT NULL COMMENT 'express/tutoring/secondhand/team/lost_found/errand/borrow/consulting',
  reward_type ENUM('cash', 'points', 'free') DEFAULT 'cash',
  reward_amount DECIMAL(10, 2) CHECK (reward_amount > 0),
  is_anonymous BOOLEAN DEFAULT FALSE,
  status ENUM('pending', 'accepted', 'in_progress', 'completed', 'cancelled') DEFAULT 'pending',
  escrow_status ENUM('none', 'escrowed', 'released', 'refunded') DEFAULT 'none' COMMENT '发布时报酬托管',
  deadline DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (publisher_id) REFERENCES users(id),
  INDEX idx_category_status_created (category, status, created_at DESC)
) ENGINE=InnoDB;

-- 3. 订单表
CREATE TABLE IF NOT EXISTS orders (
  id INT PRIMARY KEY AUTO_INCREMENT,
  order_no VARCHAR(50) UNIQUE NOT NULL COMMENT '格式：ORD+YYYYMMDD+6位随机数',
  requirement_id INT NOT NULL,
  publisher_id INT NOT NULL,
  acceptor_id INT NOT NULL,
  status ENUM('pending_confirm', 'accepted', 'in_progress', 'ready_for_acceptance', 'completed', 'cancelled', 'rejected') DEFAULT 'pending_confirm',
  payment_status ENUM('unpaid', 'escrow', 'released', 'refunded') DEFAULT 'unpaid',
  completed_at DATETIME NULL COMMENT '订单完成时间，用于评价时限',
  credit_applied BOOLEAN DEFAULT FALSE COMMENT '是否已结算评价信用分',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (requirement_id) REFERENCES requirements(id),
  FOREIGN KEY (publisher_id) REFERENCES users(id),
  FOREIGN KEY (acceptor_id) REFERENCES users(id),
  INDEX idx_publisher_status_created (publisher_id, status, created_at DESC),
  INDEX idx_acceptor_status_created (acceptor_id, status, created_at DESC)
) ENGINE=InnoDB;

-- 4. 评价表
CREATE TABLE IF NOT EXISTS evaluations (
  id INT PRIMARY KEY AUTO_INCREMENT,
  order_id INT NOT NULL,
  evaluator_id INT NOT NULL,
  evaluatee_id INT NOT NULL,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  is_anonymous BOOLEAN DEFAULT FALSE,
  appeal_status ENUM('none', 'pending', 'approved', 'rejected') DEFAULT 'none',
  appeal_reason TEXT COMMENT '申诉理由',
  is_auto_default BOOLEAN DEFAULT FALSE COMMENT '超时默认5星',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (evaluator_id) REFERENCES users(id),
  FOREIGN KEY (evaluatee_id) REFERENCES users(id),
  UNIQUE KEY unique_order_evaluator (order_id, evaluator_id),
  INDEX idx_evaluatee_created (evaluatee_id, created_at DESC)
) ENGINE=InnoDB;

-- 5. 消息表
CREATE TABLE IF NOT EXISTS messages (
  id INT PRIMARY KEY AUTO_INCREMENT,
  sender_id INT NOT NULL,
  receiver_id INT NOT NULL,
  content TEXT NOT NULL,
  message_type ENUM('text', 'image', 'system') DEFAULT 'text',
  related_type ENUM('order', 'requirement', 'evaluation', 'system'),
  related_id INT COMMENT '关联业务ID，用于前端跳转',
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sender_id) REFERENCES users(id),
  FOREIGN KEY (receiver_id) REFERENCES users(id),
  INDEX idx_receiver_unread (receiver_id, is_read),
  INDEX idx_receiver_created (receiver_id, created_at DESC),
  INDEX idx_sender_receiver_created (sender_id, receiver_id, created_at DESC)
) ENGINE=InnoDB;

-- 6. 订单状态变更日志
CREATE TABLE IF NOT EXISTS order_status_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  order_id INT NOT NULL,
  from_status VARCHAR(30),
  to_status VARCHAR(30) NOT NULL,
  operator_id INT NOT NULL,
  note VARCHAR(500) DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (operator_id) REFERENCES users(id),
  INDEX idx_order_created (order_id, created_at)
) ENGINE=InnoDB;

-- 7. 支付流水（托管模拟）
CREATE TABLE IF NOT EXISTS payment_records (
  id INT PRIMARY KEY AUTO_INCREMENT,
  order_id INT NULL,
  requirement_id INT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  action ENUM('escrow', 'release', 'refund') NOT NULL,
  status ENUM('pending', 'success', 'failed') DEFAULT 'success',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (requirement_id) REFERENCES requirements(id)
) ENGINE=InnoDB;

-- 8. 信用记录表
CREATE TABLE IF NOT EXISTS credit_records (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  change_amount INT NOT NULL COMMENT '正数加分，负数扣分',
  current_score INT NOT NULL COMMENT '变动后分数',
  reason VARCHAR(200) NOT NULL,
  related_type ENUM('order', 'evaluation', 'report', 'admin'),
  related_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_user_history (user_id, created_at DESC)
) ENGINE=InnoDB;