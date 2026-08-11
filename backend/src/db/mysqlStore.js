/**
 * @file backend/src/db/mysqlStore.js
 * @description MySQL 数据库实现（USE_MEMORY_DB=0）
 */

const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const config = require('../config');

function mapUser(row) {
  if (!row) return null;
  return {
    ...row,
    is_verified: Boolean(row.is_verified),
    hide_phone: Boolean(row.hide_phone),
    hide_wechat: Boolean(row.hide_wechat),
    hide_orders: Boolean(row.hide_orders),
    hide_reviews: Boolean(row.hide_reviews),
    is_graduated: Boolean(row.is_graduated),
    phone: row.phone ? String(row.phone) : null,
    locked_until: row.locked_until ? row.locked_until.toISOString?.() || row.locked_until : null,
    created_at: row.created_at?.toISOString?.() || row.created_at,
  };
}

function mapRequirement(row) {
  if (!row) return null;
  return {
    ...row,
    is_anonymous: Boolean(row.is_anonymous),
    reward_amount: row.reward_amount != null ? Number(row.reward_amount) : null,
    deadline: row.deadline?.toISOString?.() || row.deadline,
    created_at: row.created_at?.toISOString?.() || row.created_at,
    escrow_status: row.escrow_status || 'none',
  };
}

function mapOrder(row) {
  if (!row) return null;
  return {
    ...row,
    credit_applied: Boolean(row.credit_applied),
    completed_at: row.completed_at?.toISOString?.() || row.completed_at,
    created_at: row.created_at?.toISOString?.() || row.created_at,
  };
}

function generateOrderNo() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0');
  return `ORD${date}${rand}`;
}

async function createMysqlStore() {
  const pool = mysql.createPool({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
    waitForConnections: true,
    connectionLimit: config.db.poolMax || 10,
  });

  await pool.query('SELECT 1');

  return {
    pool,

    async reset() {
      await pool.query('SET FOREIGN_KEY_CHECKS = 0');
      const tables = [
        'payment_records',
        'order_status_logs',
        'evaluations',
        'messages',
        'credit_records',
        'orders',
        'requirements',
        'users',
      ];
      for (const t of tables) {
        await pool.query(`TRUNCATE TABLE ${t}`);
      }
      await pool.query('SET FOREIGN_KEY_CHECKS = 1');
    },

    async seedDemoUsers() {
      const hash = await bcrypt.hash('demo123456', 10);
      await pool.query(
        `INSERT INTO users (student_id, email, password_hash, nickname, phone, credit_score, is_verified, verification_status)
         VALUES (?, ?, ?, ?, ?, 100, TRUE, 'approved'),
                (?, ?, ?, ?, ?, 100, TRUE, 'approved')`,
        [
          '2021001001',
          'pub@campus.edu.cn',
          hash,
          '发布者小明',
          '13800001001',
          '2021001002',
          'acc@campus.edu.cn',
          hash,
          '接单者小红',
          '13800001002',
        ],
      );
      const [rows] = await pool.query(`SELECT * FROM users WHERE student_id IN ('2021001001','2021001002')`);
      return { publisher: mapUser(rows[0]), acceptor: mapUser(rows[1]) };
    },

    async findUserByStudentId(studentId) {
      const [rows] = await pool.query('SELECT * FROM users WHERE student_id = ?', [studentId]);
      return mapUser(rows[0]);
    },

    async findUserByEmail(email) {
      const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
      return mapUser(rows[0]);
    },

    async findUserById(id) {
      const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
      return mapUser(rows[0]);
    },

    async createUser(payload) {
      const [result] = await pool.query(
        `INSERT INTO users (student_id, email, password_hash, nickname, phone)
         VALUES (?, ?, ?, ?, ?)`,
        [
          payload.student_id,
          payload.email,
          payload.password_hash,
          payload.nickname || '新用户',
          payload.phone,
        ],
      );
      return this.findUserById(result.insertId);
    },

    async updateUser(id, patch) {
      const fields = [];
      const values = [];
      for (const [k, v] of Object.entries(patch)) {
        fields.push(`${k} = ?`);
        values.push(v);
      }
      if (!fields.length) return this.findUserById(id);
      values.push(id);
      await pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
      return this.findUserById(id);
    },

    async createRequirement(payload) {
      const [result] = await pool.query(
        `INSERT INTO requirements (publisher_id, title, description, category, reward_type, reward_amount,
          is_anonymous, location, image_url, status, escrow_status, deadline)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
        [
          payload.publisher_id,
          payload.title,
          payload.description || '',
          payload.category,
          payload.reward_type,
          payload.reward_amount,
          payload.is_anonymous ? 1 : 0,
          payload.location || '',
          payload.image_url,
          payload.escrow_status || 'none',
          payload.deadline,
        ],
      );
      return this.findRequirementById(result.insertId);
    },

    async findRequirementById(id) {
      const [rows] = await pool.query('SELECT * FROM requirements WHERE id = ?', [id]);
      return mapRequirement(rows[0]);
    },

    async listRequirements(filters) {
      const where = ['1=1'];
      const params = [];
      if (filters.publisher_id) {
        where.push('publisher_id = ?');
        params.push(filters.publisher_id);
      }
      if (filters.category) {
        where.push('category = ?');
        params.push(filters.category);
      }
      if (filters.reward_type) {
        where.push('reward_type = ?');
        params.push(filters.reward_type);
      }
      if (filters.status) {
        where.push('status = ?');
        params.push(filters.status);
      }
      if (filters.location) {
        where.push('location LIKE ?');
        params.push(`%${filters.location}%`);
      }
      if (filters.keyword) {
        where.push('(title LIKE ? OR description LIKE ?)');
        const kw = `%${filters.keyword}%`;
        params.push(kw, kw);
      }
      const sortBy = filters.sort_by === 'deadline' ? 'deadline' : 'created_at';
      const sortOrder = filters.sort_order === 'asc' ? 'ASC' : 'DESC';
      const page = filters.page || 1;
      const limit = filters.limit || 10;
      const offset = (page - 1) * limit;

      const [countRows] = await pool.query(
        `SELECT COUNT(*) AS total FROM requirements WHERE ${where.join(' AND ')}`,
        params,
      );
      const [rows] = await pool.query(
        `SELECT * FROM requirements WHERE ${where.join(' AND ')} ORDER BY ${sortBy} ${sortOrder} LIMIT ? OFFSET ?`,
        [...params, limit, offset],
      );
      return {
        items: rows.map(mapRequirement),
        total: countRows[0].total,
        page,
        limit,
      };
    },

    async updateRequirement(id, patch) {
      const fields = [];
      const values = [];
      for (const [k, v] of Object.entries(patch)) {
        fields.push(`${k} = ?`);
        values.push(typeof v === 'boolean' ? (v ? 1 : 0) : v);
      }
      if (!fields.length) return this.findRequirementById(id);
      values.push(id);
      await pool.query(`UPDATE requirements SET ${fields.join(', ')} WHERE id = ?`, values);
      return this.findRequirementById(id);
    },

    async createOrder(payload) {
      const orderNo = generateOrderNo();
      const [result] = await pool.query(
        `INSERT INTO orders (order_no, requirement_id, publisher_id, acceptor_id, status, payment_status)
         VALUES (?, ?, ?, ?, 'pending_confirm', 'unpaid')`,
        [orderNo, payload.requirement_id, payload.publisher_id, payload.acceptor_id],
      );
      const order = await this.findOrderById(result.insertId);
      await this.addOrderLog(order.id, null, 'pending_confirm', payload.acceptor_id, '申请接单');
      return order;
    },

    async findOrderById(id) {
      const [rows] = await pool.query('SELECT * FROM orders WHERE id = ?', [id]);
      return mapOrder(rows[0]);
    },

    async findApplicationByUserAndRequirement(userId, requirementId) {
      const [rows] = await pool.query(
        `SELECT * FROM orders WHERE requirement_id = ? AND acceptor_id = ? AND status = 'pending_confirm'`,
        [requirementId, userId],
      );
      return mapOrder(rows[0]);
    },

    async findAcceptedOrderByRequirement(requirementId) {
      const [rows] = await pool.query(
        `SELECT * FROM orders WHERE requirement_id = ? AND status IN ('accepted','in_progress','ready_for_acceptance','completed') LIMIT 1`,
        [requirementId],
      );
      return mapOrder(rows[0]);
    },

    async listApplicationsByRequirement(requirementId, status = 'pending_confirm') {
      const [rows] = await pool.query(
        'SELECT * FROM orders WHERE requirement_id = ? AND status = ?',
        [requirementId, status],
      );
      return rows.map(mapOrder);
    },

    async rejectOtherApplications(requirementId, exceptOrderId) {
      const [rows] = await pool.query(
        `SELECT * FROM orders WHERE requirement_id = ? AND id != ? AND status = 'pending_confirm'`,
        [requirementId, exceptOrderId],
      );
      for (const o of rows) {
        await pool.query(`UPDATE orders SET status = 'rejected' WHERE id = ?`, [o.id]);
        await this.addOrderLog(o.id, 'pending_confirm', 'rejected', o.publisher_id, '发布者选择了其他接单者');
      }
      return rows.length;
    },

    async listOrders(filters) {
      const where = [];
      const params = [];
      if (filters.role === 'publisher') {
        where.push('publisher_id = ?');
        params.push(filters.user_id);
      } else if (filters.role === 'acceptor') {
        where.push('acceptor_id = ?');
        params.push(filters.user_id);
      } else {
        where.push('(publisher_id = ? OR acceptor_id = ?)');
        params.push(filters.user_id, filters.user_id);
      }
      if (filters.status) {
        where.push('status = ?');
        params.push(filters.status);
      }
      const page = filters.page || 1;
      const limit = filters.limit || 10;
      const offset = (page - 1) * limit;
      const [countRows] = await pool.query(
        `SELECT COUNT(*) AS total FROM orders WHERE ${where.join(' AND ')}`,
        params,
      );
      const [rows] = await pool.query(
        `SELECT * FROM orders WHERE ${where.join(' AND ')} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [...params, limit, offset],
      );
      return { items: rows.map(mapOrder), total: countRows[0].total, page, limit };
    },

    async updateOrder(id, patch) {
      const fields = [];
      const values = [];
      for (const [k, v] of Object.entries(patch)) {
        fields.push(`${k} = ?`);
        values.push(v);
      }
      if (!fields.length) return this.findOrderById(id);
      values.push(id);
      await pool.query(`UPDATE orders SET ${fields.join(', ')} WHERE id = ?`, values);
      return this.findOrderById(id);
    },

    async addOrderLog(orderId, fromStatus, toStatus, operatorId, note) {
      const [result] = await pool.query(
        `INSERT INTO order_status_logs (order_id, from_status, to_status, operator_id, note)
         VALUES (?, ?, ?, ?, ?)`,
        [orderId, fromStatus, toStatus, operatorId, note || ''],
      );
      const [rows] = await pool.query('SELECT * FROM order_status_logs WHERE id = ?', [result.insertId]);
      const log = rows[0];
      log.created_at = log.created_at?.toISOString?.() || log.created_at;
      return log;
    },

    async getOrderLogs(orderId) {
      const [rows] = await pool.query(
        'SELECT * FROM order_status_logs WHERE order_id = ? ORDER BY created_at ASC',
        [orderId],
      );
      return rows.map((r) => ({
        ...r,
        created_at: r.created_at?.toISOString?.() || r.created_at,
      }));
    },

    async createPayment(payload) {
      const [result] = await pool.query(
        `INSERT INTO payment_records (order_id, requirement_id, amount, action, status)
         VALUES (?, ?, ?, ?, ?)`,
        [
          payload.order_id || null,
          payload.requirement_id || null,
          payload.amount,
          payload.action,
          payload.status || 'success',
        ],
      );
      const [rows] = await pool.query('SELECT * FROM payment_records WHERE id = ?', [result.insertId]);
      const p = rows[0];
      p.created_at = p.created_at?.toISOString?.() || p.created_at;
      return p;
    },

    async listPaymentsByOrder(orderId) {
      const [rows] = await pool.query('SELECT * FROM payment_records WHERE order_id = ?', [orderId]);
      return rows;
    },

    async listPaymentsByRequirement(requirementId) {
      const [rows] = await pool.query('SELECT * FROM payment_records WHERE requirement_id = ?', [
        requirementId,
      ]);
      return rows;
    },

    async createEvaluation(payload) {
      const [result] = await pool.query(
        `INSERT INTO evaluations (order_id, evaluator_id, evaluatee_id, rating, comment, is_anonymous, is_auto_default)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          payload.order_id,
          payload.evaluator_id,
          payload.evaluatee_id,
          payload.rating,
          payload.comment || '',
          payload.is_anonymous ? 1 : 0,
          payload.is_auto_default ? 1 : 0,
        ],
      );
      return this.findEvaluationById(result.insertId);
    },

    async findEvaluationById(id) {
      const [rows] = await pool.query('SELECT * FROM evaluations WHERE id = ?', [id]);
      const r = rows[0];
      if (!r) return null;
      r.is_anonymous = Boolean(r.is_anonymous);
      r.is_auto_default = Boolean(r.is_auto_default);
      r.created_at = r.created_at?.toISOString?.() || r.created_at;
      return r;
    },

    async findEvaluationByOrderAndEvaluator(orderId, evaluatorId) {
      const [rows] = await pool.query(
        'SELECT * FROM evaluations WHERE order_id = ? AND evaluator_id = ?',
        [orderId, evaluatorId],
      );
      return rows[0] ? this.findEvaluationById(rows[0].id) : null;
    },

    async listEvaluationsByOrder(orderId) {
      const [rows] = await pool.query('SELECT * FROM evaluations WHERE order_id = ?', [orderId]);
      return Promise.all(rows.map((r) => this.findEvaluationById(r.id)));
    },

    async listEvaluationsByEvaluatee(evaluateeId, filters) {
      const page = filters.page || 1;
      const limit = filters.limit || 10;
      const offset = (page - 1) * limit;
      const [countRows] = await pool.query(
        'SELECT COUNT(*) AS total FROM evaluations WHERE evaluatee_id = ?',
        [evaluateeId],
      );
      const [rows] = await pool.query(
        'SELECT id FROM evaluations WHERE evaluatee_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
        [evaluateeId, limit, offset],
      );
      const items = await Promise.all(rows.map((r) => this.findEvaluationById(r.id)));
      return { items, total: countRows[0].total, page, limit };
    },

    async updateEvaluation(id, patch) {
      const fields = [];
      const values = [];
      for (const [k, v] of Object.entries(patch)) {
        fields.push(`${k} = ?`);
        values.push(v);
      }
      if (!fields.length) return this.findEvaluationById(id);
      values.push(id);
      await pool.query(`UPDATE evaluations SET ${fields.join(', ')} WHERE id = ?`, values);
      return this.findEvaluationById(id);
    },

    async createMessage(payload) {
      const [result] = await pool.query(
        `INSERT INTO messages (sender_id, receiver_id, content, message_type, related_type, related_id, is_read)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          payload.sender_id,
          payload.receiver_id,
          payload.content,
          payload.message_type || 'system',
          payload.related_type || 'system',
          payload.related_id || null,
          payload.is_read ? 1 : 0,
        ],
      );
      return this.findMessageById(result.insertId);
    },

    async findMessageById(id) {
      const [rows] = await pool.query('SELECT * FROM messages WHERE id = ?', [id]);
      const r = rows[0];
      if (!r) return null;
      r.is_read = Boolean(r.is_read);
      r.created_at = r.created_at?.toISOString?.() || r.created_at;
      return r;
    },

    async listMessages(receiverId, filters) {
      const where = ['receiver_id = ?'];
      const params = [receiverId];
      if (filters.is_read === false) {
        where.push('is_read = 0');
      } else if (filters.is_read === true) {
        where.push('is_read = 1');
      }
      const page = filters.page || 1;
      const limit = filters.limit || 20;
      const offset = (page - 1) * limit;
      const [countRows] = await pool.query(
        `SELECT COUNT(*) AS total FROM messages WHERE ${where.join(' AND ')}`,
        params,
      );
      const [rows] = await pool.query(
        `SELECT id FROM messages WHERE ${where.join(' AND ')} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [...params, limit, offset],
      );
      const items = await Promise.all(rows.map((r) => this.findMessageById(r.id)));
      return { items, total: countRows[0].total, page, limit };
    },

    async updateMessage(id, patch) {
      const fields = [];
      const values = [];
      for (const [k, v] of Object.entries(patch)) {
        fields.push(`${k} = ?`);
        values.push(typeof v === 'boolean' ? (v ? 1 : 0) : v);
      }
      if (!fields.length) return this.findMessageById(id);
      values.push(id);
      await pool.query(`UPDATE messages SET ${fields.join(', ')} WHERE id = ?`, values);
      return this.findMessageById(id);
    },

    async countUnreadMessages(receiverId) {
      const [rows] = await pool.query(
        'SELECT COUNT(*) AS c FROM messages WHERE receiver_id = ? AND is_read = 0',
        [receiverId],
      );
      return rows[0].c;
    },

    async markAllMessagesRead(receiverId) {
      const [result] = await pool.query(
        'UPDATE messages SET is_read = 1 WHERE receiver_id = ? AND is_read = 0',
        [receiverId],
      );
      return result.affectedRows || 0;
    },

    async createCreditRecord(payload) {
      const [result] = await pool.query(
        `INSERT INTO credit_records (user_id, change_amount, current_score, reason, related_type, related_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          payload.user_id,
          payload.change_amount,
          payload.current_score,
          payload.reason,
          payload.related_type,
          payload.related_id,
        ],
      );
      const [rows] = await pool.query('SELECT * FROM credit_records WHERE id = ?', [result.insertId]);
      const r = rows[0];
      r.created_at = r.created_at?.toISOString?.() || r.created_at;
      return r;
    },

    async listCreditRecords(userId, filters) {
      const page = filters.page || 1;
      const limit = filters.limit || 20;
      const offset = (page - 1) * limit;
      const [countRows] = await pool.query(
        'SELECT COUNT(*) AS total FROM credit_records WHERE user_id = ?',
        [userId],
      );
      const [rows] = await pool.query(
        'SELECT * FROM credit_records WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
        [userId, limit, offset],
      );
      return {
        items: rows.map((r) => ({
          ...r,
          created_at: r.created_at?.toISOString?.() || r.created_at,
        })),
        total: countRows[0].total,
        page,
        limit,
      };
    },
  };
}

module.exports = { createMysqlStore };
