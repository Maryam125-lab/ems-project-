import pool from '../../config/db.js';
import { AppError } from '../../utils/errors.js';

export async function getAnnouncements(params = {}) {
    const { limit = 20, offset = 0 } = params;
    const res = await pool.query(`
        SELECT a.*, u.email as author_name
        FROM public.announcements a
        LEFT JOIN public.users u ON a.created_by = u.id
        ORDER BY a.is_pinned DESC, a.created_at DESC
        LIMIT $1 OFFSET $2
    `, [limit, offset]);
    return res.rows;
}

export async function createAnnouncement(data, createdBy) {
    const { title, content, type, is_pinned } = data;
    const res = await pool.query(`
        INSERT INTO public.announcements (title, content, type, is_pinned, created_by)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
    `, [title, content, type || 'general', is_pinned || false, createdBy]);
    return res.rows[0];
}

export async function updateAnnouncement(id, data) {
    const { title, content, type, is_pinned } = data;
    const res = await pool.query(`
        UPDATE public.announcements
        SET title = COALESCE($1, title),
            content = COALESCE($2, content),
            type = COALESCE($3, type),
            is_pinned = COALESCE($4, is_pinned),
            updated_at = NOW()
        WHERE id = $5
        RETURNING *
    `, [title, content, type, is_pinned, id]);
    
    if (res.rowCount === 0) throw new AppError(404, 'NOT_FOUND', 'Announcement not found');
    return res.rows[0];
}

export async function deleteAnnouncement(id) {
    const res = await pool.query(`DELETE FROM public.announcements WHERE id = $1 RETURNING *`, [id]);
    if (res.rowCount === 0) throw new AppError(404, 'NOT_FOUND', 'Announcement not found');
    return res.rows[0];
}
