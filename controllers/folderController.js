import { FolderModel } from '../models/folderModel.js';
import { buildOffsetPagination } from '../utils/pagination.js';
import { supabaseAdmin } from '../config/db.js';

export async function listFolders(req, res) {
  const userId = req.user?.id;
  const parentId = req.query?.parentId ?? null;
  const { limit = 50, page = 1 } = req.query || {};
  const { limit: l, offset } = buildOffsetPagination({ limit: Number(limit), page: Number(page) });

  const rows = await FolderModel.listChildren({ userId, parentId, limit: l, offset });
  res.json({ items: rows, page: Number(page), limit: l });
}

export async function createFolder(req, res) {
  const userId = req.user?.id;
  const { name, parentId } = req.body;
  const row = await FolderModel.create({ name, userId, parentId });

  // grant ownership
  await supabaseAdmin
    .from('item_permissions')
    .insert({ item_type: 'folder', item_id: row.id, user_id: userId, role: 'owner' });

  res.status(201).json(row);
}

export async function renameFolder(req, res) {
  const userId = req.user?.id;
  const id = req.params.id;
  const { name } = req.body;

  // permission check: owner or edit
  const { data: perm } = await supabaseAdmin
    .from('item_permissions')
    .select('role')
    .eq('item_type', 'folder')
    .eq('item_id', id)
    .eq('user_id', userId)
    .in('role', ['owner', 'edit'])
    .maybeSingle();

  if (!perm) return res.status(403).json({ error: 'Forbidden' });

  const updated = await FolderModel.rename(id, name);
  res.json(updated);
}

export async function moveFolder(req, res) {
  const userId = req.user?.id;
  const id = req.params.id;
  const { newParentId } = req.body;

  const { data: perm } = await supabaseAdmin
    .from('item_permissions')
    .select('role')
    .eq('item_type', 'folder')
    .eq('item_id', id)
    .eq('user_id', userId)
    .in('role', ['owner', 'edit'])
    .maybeSingle();

  if (!perm) return res.status(403).json({ error: 'Forbidden' });

  const updated = await FolderModel.move(id, newParentId);
  res.json(updated);
}

export async function deleteFolder(req, res) {
  const userId = req.user?.id;
  const id = req.params.id;

  const { data: perm } = await supabaseAdmin
    .from('item_permissions')
    .select('role')
    .eq('item_type', 'folder')
    .eq('item_id', id)
    .eq('user_id', userId)
    .in('role', ['owner'])
    .maybeSingle();

  if (!perm) return res.status(403).json({ error: 'Owner required' });

  const updated = await FolderModel.softDelete(id);
  res.json(updated);
}

export async function restoreFolder(req, res) {
  const userId = req.user?.id;
  const id = req.params.id;

  const { data: perm } = await supabaseAdmin
    .from('item_permissions')
    .select('role')
    .eq('item_type', 'folder')
    .eq('item_id', id)
    .eq('user_id', userId)
    .in('role', ['owner'])
    .maybeSingle();

  if (!perm) return res.status(403).json({ error: 'Owner required' });

  const updated = await FolderModel.restore(id);
  res.json(updated);
}
