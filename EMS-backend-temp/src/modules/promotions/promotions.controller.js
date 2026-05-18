import * as promotionService from './promotions.service.js';

export async function listPromotions(req, res, next) {
    try {
        const promotions = await promotionService.getPromotions();
        res.json({ success: true, data: promotions });
    } catch (error) {
        next(error);
    }
}

export async function createPromotion(req, res, next) {
    try {
        const promotion = await promotionService.createPromotion(req.body);
        res.status(201).json({ success: true, data: promotion });
    } catch (error) {
        next(error);
    }
}

export async function approvePromotion(req, res, next) {
    try {
        const promotion = await promotionService.approvePromotion(req.params.id, req.user.user_id);
        res.json({ success: true, data: promotion });
    } catch (error) {
        next(error);
    }
}

export async function rejectPromotion(req, res, next) {
    try {
        const promotion = await promotionService.rejectPromotion(req.params.id);
        res.json({ success: true, data: promotion });
    } catch (error) {
        next(error);
    }
}
