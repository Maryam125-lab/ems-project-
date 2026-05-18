import * as announcementService from './announcements.service.js';

export async function listAnnouncements(req, res, next) {
    try {
        const announcements = await announcementService.getAnnouncements(req.query);
        res.json({ success: true, data: announcements });
    } catch (error) {
        next(error);
    }
}

export async function createAnnouncement(req, res, next) {
    try {
        const announcement = await announcementService.createAnnouncement(req.body, req.user.id);
        res.status(201).json({ success: true, data: announcement });
    } catch (error) {
        next(error);
    }
}

export async function updateAnnouncement(req, res, next) {
    try {
        const announcement = await announcementService.updateAnnouncement(req.params.id, req.body);
        res.json({ success: true, data: announcement });
    } catch (error) {
        next(error);
    }
}

export async function deleteAnnouncement(req, res, next) {
    try {
        await announcementService.deleteAnnouncement(req.params.id);
        res.json({ success: true, message: 'Announcement deleted' });
    } catch (error) {
        next(error);
    }
}
