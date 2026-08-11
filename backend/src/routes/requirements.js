/**
 * @file backend/src/routes/requirements.js
 * @description 需求路由：发布、列表、详情、申请列表、我的发布
 */

const express = require('express');
const { asyncHandler } = require('../middleware/asyncHandler');
const { authRequired, authOptional } = require('../middleware/auth');
const { success } = require('../lib/response');
const { CATEGORY_LABELS, REQUIREMENT_CATEGORIES } = require('../lib/constants');
const requirementService = require('../services/requirementService');

const router = express.Router();

router.get('/meta/categories', (_req, res) => {
  return success(res, {
    categories: REQUIREMENT_CATEGORIES.map((id) => ({
      id,
      label: CATEGORY_LABELS[id],
    })),
  });
});

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const data = await requirementService.listRequirements(req.query);
    return success(res, data);
  }),
);

router.get(
  '/mine',
  authRequired,
  asyncHandler(async (req, res) => {
    const data = await requirementService.listMyRequirements(req.user, req.query);
    return success(res, data);
  }),
);

router.get(
  '/:id/applications',
  authRequired,
  asyncHandler(async (req, res) => {
    const data = await requirementService.listApplications(req.user, req.params.id);
    return success(res, data);
  }),
);

router.get(
  '/:id',
  authOptional,
  asyncHandler(async (req, res) => {
    const data = await requirementService.getRequirement(req.params.id, req.user);
    return success(res, data);
  }),
);

router.post(
  '/',
  authRequired,
  asyncHandler(async (req, res) => {
    const data = await requirementService.createRequirement(req.user, req.body);
    return success(res, data, '需求发布成功');
  }),
);

router.put(
  '/:id',
  authRequired,
  asyncHandler(async (req, res) => {
    const data = await requirementService.updateRequirement(req.user, req.params.id, req.body);
    return success(res, data, '需求已更新');
  }),
);

router.delete(
  '/:id',
  authRequired,
  asyncHandler(async (req, res) => {
    const data = await requirementService.cancelRequirement(req.user, req.params.id);
    return success(res, data);
  }),
);

module.exports = router;
