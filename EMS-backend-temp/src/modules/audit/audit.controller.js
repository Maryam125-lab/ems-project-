import * as auditService from './audit.service.js';

export async function listLogs(req, res, next) {
    try {
        const logs = await auditService.getAuditLogs();
        res.json({ success: true, data: logs });
    } catch (error) {
        next(error);
    }
}
