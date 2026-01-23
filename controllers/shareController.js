import { supabaseAdmin } from '../config/db.js';
import { customAlphabet } from 'nanoid';
import { ENV } from '../config/env.js';

const nanoid = customAlphabet('123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz', 22);

export async function createShareLink(req, res) {
  const userId = req.user?.id;
  const { itemType, itemId, role = 'view', expiresIn } = req.body;

  // Check user permission
  const { data: perm } = await supabaseAdmin
    .from('item_permissions')
    .select('role')
    .eq('item_type', itemType)
    .eq('item_id', itemId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!perm) return res.status(403).json({ error: 'Forbidden' });

  const priority = { owner: 3, edit: 2, view: 1 };
  if (priority[perm.role] < priority[role]) 
    return res.status(403).json({ error: 'Insufficient role to create this link' });

  const token = nanoid();
  const expires_at = expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null;

  const { data, error } = await supabaseAdmin
    .from('share_links')
    .insert({ item_type: itemType, item_id: itemId, token, role, created_by: userId, expires_at })
    .select('*')
    .single();

  if (error) return res.status(400).json({ error: error.message });

  res.status(201).json({ ...data, url: `/api/share/${token}` });
}

export async function revokeShareLink(req, res) {
  const userId = req.user?.id;
  const { id } = req.params;

  // Only creator or owner can revoke
  const { data: link, error } = await supabaseAdmin.from('share_links').select('*').eq('id', id).single();
  if (error || !link) return res.status(404).json({ error: 'Not found' });

  const { data: perm } = await supabaseAdmin
    .from('item_permissions')
    .select('role')
    .eq('item_type', link.item_type)
    .eq('item_id', link.item_id)
    .eq('user_id', userId)
    .in('role', ['owner'])
    .maybeSingle();

  if (link.created_by !== userId && !perm) return res.status(403).json({ error: 'Forbidden' });

  const { data: updated, error: e2 } = await supabaseAdmin
    .from('share_links')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();

  if (e2) return res.status(400).json({ error: e2.message });
  res.json(updated);
}

export async function resolveShareToken(req, res) {
  const { token } = req.params;

  const { data: link } = await supabaseAdmin
    .from('share_links')
    .select('*')
    .eq('token', token)
    .is('revoked_at', null)
    .maybeSingle();

  if (!link) return res.status(404).json({ error: 'Invalid link' });
  if (link.expires_at && new Date(link.expires_at) < new Date()) return res.status(410).json({ error: 'Link expired' });

  if (link.item_type === 'file') {
    const { data: file } = await supabaseAdmin.from('files')
      .select('*')
      .eq('id', link.item_id)
      .is('deleted_at', null)
      .single();
    if (!file) return res.status(404).json({ error: 'File not found' });

    const { data: signed, error } = await supabaseAdmin.storage
      .from(file.storage_bucket)
      .createSignedUrl(file.storage_path, ENV.SIGN_URL_EXPIRES);
    if (error) return res.status(400).json({ error: error.message });

    return res.json({
      type: 'file',
      role: link.role,
      url: signed.signedUrl,
      name: file.name,
      mime_type: file.mime_type,
      size: file.size
    });
  }

  // folder: list immediate children (folders + files)
  const { data: folder } = await supabaseAdmin.from('folders')
    .select('*')
    .eq('id', link.item_id)
    .is('deleted_at', null)
    .single();
  if (!folder) return res.status(404).json({ error: 'Folder not found' });

  const { data: subfolders } = await supabaseAdmin
    .from('folders')
    .select('id,name,created_at')
    .eq('parent_id', folder.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  const { data: files } = await supabaseAdmin
    .from('files')
    .select('id,name,size,mime_type,created_at')
    .eq('folder_id', folder.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  res.json({
    type: 'folder',
    role: link.role,
    folder: { id: folder.id, name: folder.name },
    subfolders,
    files
  });
}
