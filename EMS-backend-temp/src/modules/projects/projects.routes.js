import { Router } from 'express';
import { verifyToken } from '../../middleware/auth.js';
import { sendSuccess } from '../../utils/respond.js';

const router = Router();

router.use(verifyToken);

router.get('/status', (req, res) => {
  return sendSuccess(
    res,
    {
      module: 'projects',
      status: 'coming_soon',
      auth: 'connected',
      next_step: 'Define project master fields, workflows, teams, and inventory consumption rules.',
      planned_entities: [
        'projects',
        'milestones',
        'tasks',
        'project_members',
        'timesheets',
        'project_inventory_usage',
        'project_costs',
      ],
    },
    200
  );
});

export default router;
