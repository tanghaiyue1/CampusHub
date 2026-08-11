/**
 * @file frontend/src/router/index.js
 * @description Vue Router 路由表与登录守卫
 */

import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "../stores/auth";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: "/", redirect: "/requirements" },
    { path: "/login", name: "login", component: () => import("../views/LoginView.vue") },
    { path: "/register", name: "register", component: () => import("../views/RegisterView.vue") },
    {
      path: "/verification",
      name: "verification",
      component: () => import("../views/VerificationView.vue"),
      meta: { requiresAuth: true },
    },
    {
      path: "/requirements",
      name: "requirements",
      component: () => import("../views/RequirementsListView.vue"),
    },
    {
      path: "/requirements/new",
      name: "requirement-create",
      component: () => import("../views/RequirementCreateView.vue"),
      meta: { requiresAuth: true },
    },
    {
      path: "/requirements/:id",
      name: "requirement-detail",
      component: () => import("../views/RequirementDetailView.vue"),
    },
    {
      path: "/orders",
      name: "orders",
      component: () => import("../views/OrdersListView.vue"),
      meta: { requiresAuth: true },
    },
    {
      path: "/orders/:id",
      name: "order-detail",
      component: () => import("../views/OrderDetailView.vue"),
      meta: { requiresAuth: true },
    },
    {
      path: "/profile",
      name: "profile",
      component: () => import("../views/ProfileView.vue"),
      meta: { requiresAuth: true },
    },
    {
      path: "/users/:id",
      name: "user-profile",
      component: () => import("../views/UserProfileView.vue"),
      meta: { requiresAuth: true },
    },
    {
      path: "/messages",
      name: "messages",
      component: () => import("../views/MessagesView.vue"),
      meta: { requiresAuth: true },
    },
    {
      path: "/evaluations/user/:userId",
      name: "evaluations",
      component: () => import("../views/EvaluationsView.vue"),
      meta: { requiresAuth: true },
    },
    {
      path: "/ai-assistant",
      name: "ai-assistant",
      component: () => import("../views/AiAssistantView.vue"),
      meta: { requiresAuth: true },
    },
  ],
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  if (to.meta.requiresAuth && !auth.isLoggedIn) {
    return { name: "login", query: { redirect: to.fullPath } };
  }
  if (to.meta.requiresAuth && auth.isLoggedIn && !auth.user) {
    try {
      await auth.fetchProfile();
    } catch {
      auth.clearSession();
      return { name: "login", query: { redirect: to.fullPath } };
    }
  }
  return true;
});

export default router;
