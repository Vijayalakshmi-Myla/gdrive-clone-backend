import { supabaseAdmin } from '../config/db.js';
import { buildOffsetPagination } from '../utils/pagination.js';

export async function search(req, res) {
  const userId = req.user?.id;
  const q = req.query?.q || '';
  const { limit = 50, page = 1 } = req.query || {};
  const { limit: l, offset } = buildOffsetPagination({ limit: Number(limit), page: Number(page) });

  if (!q.trim()) return res.json({ items: [], page: Number(page), limit: l });

  // Search files and folders for this user (union)
  // Using PostgREST text search via Supabase: .textSearch on generated tsvector columns
  const filesPromise = supabaseAdmin
    .from('files')
    .select(
      'id,name,created_at,mime_type,size,folder_id',
      { count: 'estimated' }
    )
    .eq('user_id', userId)
    .is('deleted_at', null)
    .textSearch('search_tsv', q, { type: 'websearch' })
    .order('created_at', { ascending: false })
    .range(offset, offset + l - 1);

  const foldersPromise = supabaseAdmin
    .from('folders')
    .select('id,name,created_at,parent_id', { count: 'estimated' })
    .eq('user_id', userId)
    .is('deleted_at', null)
    .textSearch('search_tsv', q, { type: 'websearch' })
    .order('created_at', { ascending: false })
    .range(offset, offset + l - 1);

  const [files, folders] = await Promise.all([filesPromise, foldersPromise]);
  if (files.error) throw files.error;
  if (folders.error) throw folders.error;

  res.json({
    files: files.data,
    folders: folders.data,
    page: Number(page),
    limit: l
  });
}
