/**
 * @file backend/src/db/memoryStore.js
 * @description 内存数据库实现（开发/测试默认）
 */

const bcrypt = require('bcryptjs');

function nextId(counter) {
  counter.value += 1;
  return counter.value;
}

function generateOrderNo() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0');
  return `ORD${date}${rand}`;
}

function createMemoryStore() {
  const ids = {
    users: { value: 0 },
    requirements: { value: 0 },
    orders: { value: 0 },
    orderLogs: { value: 0 },
    payments: { value: 0 },
    evaluations: { value: 0 },
    messages: { value: 0 },
    creditRecords: { value: 0 },
  };

  const state = {
    users: [],
    requirements: [],
    orders: [],
    orderLogs: [],
    payments: [],
    evaluations: [],
    messages: [],
    creditRecords: [],
  };

  async function seedDemoUsers() {
    const hash = await bcrypt.hash('demo123456', 10);
    const publisher = {
      id: nextId(ids.users),
      student_id: '2021001001',
      email: 'pub@campus.edu.cn',
      password_hash: hash,
      nickname: '发布者小明',
      phone: '13800001001',
      avatar_url: null,
      credit_score: 100,
      is_verified: true,
      verification_status: 'approved',
      hide_phone: true,
      hide_wechat: true,
      hide_orders: false,
      hide_reviews: false,
      failed_login_count: 0,
      locked_until: null,
      is_graduated: false,
      created_at: new Date().toISOString(),
    };
    const acceptor = {
      id: nextId(ids.users),
      student_id: '2021001002',
      email: 'acc@campus.edu.cn',
      password_hash: hash,
      nickname: '接单者小红',
      phone: '13800001002',
      avatar_url: null,
      credit_score: 100,
      is_verified: true,
      verification_status: 'approved',
      hide_phone: false,
      hide_wechat: true,
      hide_orders: false,
      hide_reviews: false,
      failed_login_count: 0,
      locked_until: null,
      is_graduated: false,
      created_at: new Date().toISOString(),
    };
    state.users.push(publisher, acceptor);
    return { publisher, acceptor };
  }

  return {
    async reset() {
      state.users = [];
      state.requirements = [];
      state.orders = [];
      state.orderLogs = [];
      state.payments = [];
      state.evaluations = [];
      state.messages = [];
      state.creditRecords = [];
      ids.users.value = 0;
      ids.requirements.value = 0;
      ids.orders.value = 0;
      ids.orderLogs.value = 0;
      ids.payments.value = 0;
      ids.evaluations.value = 0;
      ids.messages.value = 0;
      ids.creditRecords.value = 0;
    },

    seedDemoUsers,

    async findUserByStudentId(studentId) {
      return state.users.find((u) => u.student_id === studentId) || null;
    },

    async findUserByEmail(email) {
      return state.users.find((u) => u.email === email) || null;
    },

    async findUserById(id) {
      return state.users.find((u) => u.id === Number(id)) || null;
    },

    async createUser(payload) {
      const user = {
        id: nextId(ids.users),
        student_id: payload.student_id,
        email: payload.email || null,
        password_hash: payload.password_hash,
        nickname: payload.nickname || '新用户',
        phone: payload.phone || null,
        avatar_url: null,
        credit_score: 100,
        is_verified: false,
        verification_status: 'none',
        hide_phone: true,
        hide_wechat: true,
        hide_orders: false,
        hide_reviews: false,
        failed_login_count: 0,
        locked_until: null,
        is_graduated: false,
        created_at: new Date().toISOString(),
      };
      state.users.push(user);
      return user;
    },

    async updateUser(id, patch) {
      const user = await this.findUserById(id);
      if (!user) return null;
      Object.assign(user, patch);
      return user;
    },

    async createRequirement(payload) {
      const req = {
        id: nextId(ids.requirements),
        publisher_id: payload.publisher_id,
        title: payload.title,
        description: payload.description || '',
        category: payload.category,
        reward_type: payload.reward_type,
        reward_amount: payload.reward_amount ?? null,
        is_anonymous: Boolean(payload.is_anonymous),
        location: payload.location || '',
        image_url: payload.image_url || null,
        status: 'pending',
        escrow_status: payload.escrow_status || 'none',
        deadline: payload.deadline,
        created_at: new Date().toISOString(),
      };
      state.requirements.push(req);
      return req;
    },

    async findRequirementById(id) {
      return state.requirements.find((r) => r.id === Number(id)) || null;
    },

    async listRequirements(filters) {
      let list = [...state.requirements];
      if (filters.publisher_id) {
        list = list.filter((r) => r.publisher_id === Number(filters.publisher_id));
      }
      if (filters.category) list = list.filter((r) => r.category === filters.category);
      if (filters.reward_type) list = list.filter((r) => r.reward_type === filters.reward_type);
      if (filters.status) list = list.filter((r) => r.status === filters.status);
      if (filters.location) {
        const loc = filters.location.toLowerCase();
        list = list.filter((r) => (r.location || '').toLowerCase().includes(loc));
      }
      if (filters.keyword) {
        const kw = filters.keyword.toLowerCase();
        list = list.filter(
          (r) =>
            r.title.toLowerCase().includes(kw) ||
            (r.description || '').toLowerCase().includes(kw),
        );
      }
      const sortBy = filters.sort_by || 'created_at';
      const sortOrder = filters.sort_order === 'asc' ? 1 : -1;
      list.sort((a, b) => {
        const av = new Date(a[sortBy] || a.created_at);
        const bv = new Date(b[sortBy] || b.created_at);
        return (av - bv) * sortOrder;
      });
      const page = filters.page || 1;
      const limit = filters.limit || 10;
      const total = list.length;
      const start = (page - 1) * limit;
      return { items: list.slice(start, start + limit), total, page, limit };
    },

    async updateRequirement(id, patch) {
      const req = await this.findRequirementById(id);
      if (!req) return null;
      Object.assign(req, patch);
      return req;
    },

    async createOrder(payload) {
      const order = {
        id: nextId(ids.orders),
        order_no: generateOrderNo(),
        requirement_id: payload.requirement_id,
        publisher_id: payload.publisher_id,
        acceptor_id: payload.acceptor_id,
        status: 'pending_confirm',
        payment_status: 'unpaid',
        completed_at: null,
        credit_applied: false,
        created_at: new Date().toISOString(),
      };
      state.orders.push(order);
      await this.addOrderLog(order.id, null, 'pending_confirm', payload.acceptor_id, '申请接单');
      return order;
    },

    async findOrderById(id) {
      return state.orders.find((o) => o.id === Number(id)) || null;
    },

    async findApplicationByUserAndRequirement(userId, requirementId) {
      return (
        state.orders.find(
          (o) =>
            o.requirement_id === Number(requirementId) &&
            o.acceptor_id === Number(userId) &&
            o.status === 'pending_confirm',
        ) || null
      );
    },

    async findAcceptedOrderByRequirement(requirementId) {
      return (
        state.orders.find(
          (o) =>
            o.requirement_id === Number(requirementId) &&
            ['accepted', 'in_progress', 'ready_for_acceptance', 'completed'].includes(o.status),
        ) || null
      );
    },

    async listApplicationsByRequirement(requirementId, status = 'pending_confirm') {
      return state.orders.filter(
        (o) => o.requirement_id === Number(requirementId) && o.status === status,
      );
    },

    async rejectOtherApplications(requirementId, exceptOrderId) {
      const others = state.orders.filter(
        (o) =>
          o.requirement_id === Number(requirementId) &&
          o.id !== Number(exceptOrderId) &&
          o.status === 'pending_confirm',
      );
      for (const o of others) {
        o.status = 'rejected';
        await this.addOrderLog(o.id, 'pending_confirm', 'rejected', o.publisher_id, '发布者选择了其他接单者');
      }
      return others.length;
    },

    async listOrders(filters) {
      let list = [...state.orders];
      if (filters.user_id) {
        const uid = Number(filters.user_id);
        list = list.filter((o) => o.publisher_id === uid || o.acceptor_id === uid);
      }
      if (filters.role === 'publisher') {
        list = list.filter((o) => o.publisher_id === Number(filters.user_id));
      }
      if (filters.role === 'acceptor') {
        list = list.filter((o) => o.acceptor_id === Number(filters.user_id));
      }
      if (filters.status) list = list.filter((o) => o.status === filters.status);
      list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      const page = filters.page || 1;
      const limit = filters.limit || 10;
      const total = list.length;
      const start = (page - 1) * limit;
      return { items: list.slice(start, start + limit), total, page, limit };
    },

    async updateOrder(id, patch) {
      const order = await this.findOrderById(id);
      if (!order) return null;
      Object.assign(order, patch);
      return order;
    },

    async addOrderLog(orderId, fromStatus, toStatus, operatorId, note) {
      const log = {
        id: nextId(ids.orderLogs),
        order_id: orderId,
        from_status: fromStatus,
        to_status: toStatus,
        operator_id: operatorId,
        note: note || '',
        created_at: new Date().toISOString(),
      };
      state.orderLogs.push(log);
      return log;
    },

    async getOrderLogs(orderId) {
      return state.orderLogs
        .filter((l) => l.order_id === Number(orderId))
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    },

    async createPayment(payload) {
      const payment = {
        id: nextId(ids.payments),
        order_id: payload.order_id || null,
        requirement_id: payload.requirement_id || null,
        amount: payload.amount,
        action: payload.action,
        status: payload.status || 'success',
        created_at: new Date().toISOString(),
      };
      state.payments.push(payment);
      return payment;
    },

    async listPaymentsByOrder(orderId) {
      return state.payments.filter((p) => p.order_id === Number(orderId));
    },

    async listPaymentsByRequirement(requirementId) {
      return state.payments.filter((p) => p.requirement_id === Number(requirementId));
    },

    async createEvaluation(payload) {
      const ev = {
        id: nextId(ids.evaluations),
        order_id: payload.order_id,
        evaluator_id: payload.evaluator_id,
        evaluatee_id: payload.evaluatee_id,
        rating: payload.rating,
        comment: payload.comment || '',
        is_anonymous: Boolean(payload.is_anonymous),
        is_auto_default: Boolean(payload.is_auto_default),
        appeal_status: 'none',
        appeal_reason: null,
        created_at: new Date().toISOString(),
      };
      state.evaluations.push(ev);
      return ev;
    },

    async findEvaluationById(id) {
      return state.evaluations.find((e) => e.id === Number(id)) || null;
    },

    async findEvaluationByOrderAndEvaluator(orderId, evaluatorId) {
      return (
        state.evaluations.find(
          (e) => e.order_id === Number(orderId) && e.evaluator_id === Number(evaluatorId),
        ) || null
      );
    },

    async listEvaluationsByOrder(orderId) {
      return state.evaluations.filter((e) => e.order_id === Number(orderId));
    },

    async listEvaluationsByEvaluatee(evaluateeId, filters) {
      let list = state.evaluations.filter((e) => e.evaluatee_id === Number(evaluateeId));
      list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      const page = filters.page || 1;
      const limit = filters.limit || 10;
      const total = list.length;
      const start = (page - 1) * limit;
      return { items: list.slice(start, start + limit), total, page, limit };
    },

    async updateEvaluation(id, patch) {
      const ev = await this.findEvaluationById(id);
      if (!ev) return null;
      Object.assign(ev, patch);
      return ev;
    },

    async createMessage(payload) {
      const msg = {
        id: nextId(ids.messages),
        sender_id: payload.sender_id,
        receiver_id: payload.receiver_id,
        content: payload.content,
        message_type: payload.message_type || 'system',
        related_type: payload.related_type || 'system',
        related_id: payload.related_id || null,
        is_read: Boolean(payload.is_read),
        created_at: new Date().toISOString(),
      };
      state.messages.push(msg);
      return msg;
    },

    async findMessageById(id) {
      return state.messages.find((m) => m.id === Number(id)) || null;
    },

    async listMessages(receiverId, filters) {
      let list = state.messages.filter((m) => m.receiver_id === Number(receiverId));
      if (filters.is_read === false) list = list.filter((m) => !m.is_read);
      if (filters.is_read === true) list = list.filter((m) => m.is_read);
      list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      const page = filters.page || 1;
      const limit = filters.limit || 20;
      const total = list.length;
      const start = (page - 1) * limit;
      return { items: list.slice(start, start + limit), total, page, limit };
    },

    async updateMessage(id, patch) {
      const msg = await this.findMessageById(id);
      if (!msg) return null;
      Object.assign(msg, patch);
      return msg;
    },

    async countUnreadMessages(receiverId) {
      return state.messages.filter((m) => m.receiver_id === Number(receiverId) && !m.is_read).length;
    },

    async markAllMessagesRead(receiverId) {
      let count = 0;
      for (const m of state.messages) {
        if (m.receiver_id === Number(receiverId) && !m.is_read) {
          m.is_read = true;
          count += 1;
        }
      }
      return count;
    },

    async createCreditRecord(payload) {
      const rec = {
        id: nextId(ids.creditRecords),
        user_id: payload.user_id,
        change_amount: payload.change_amount,
        current_score: payload.current_score,
        reason: payload.reason,
        related_type: payload.related_type,
        related_id: payload.related_id,
        created_at: new Date().toISOString(),
      };
      state.creditRecords.push(rec);
      return rec;
    },

    async listCreditRecords(userId, filters) {
      let list = state.creditRecords.filter((r) => r.user_id === Number(userId));
      list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      const page = filters.page || 1;
      const limit = filters.limit || 20;
      const total = list.length;
      const start = (page - 1) * limit;
      return { items: list.slice(start, start + limit), total, page, limit };
    },
  };
}

let singleton = null;

function getMemoryStore() {
  if (!singleton) singleton = createMemoryStore();
  return singleton;
}

function resetMemorySingleton() {
  singleton = null;
}

module.exports = { createMemoryStore, getMemoryStore, resetMemorySingleton };
