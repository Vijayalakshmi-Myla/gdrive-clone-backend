import { supabaseAdmin } from '../config/db.js';
import { FileModel } from '../models/fileModel.js';
import { ENV } from '../config/env.js';
import crypto from 'crypto';
import {
  buildOffsetPagination,
  decodeCursor,
  encodeCursor
} from '../utils/pagination.js';

/**
 * List files (offset pagination)
 */
export async function listFiles(req, res) {
  const userId = req.user.id;
  const folderId = req.query.folderId ?? null;
  const { limit = 50, page = 1 } = req.query || {};

  const { limit: l, offset } = buildOffsetPagination({
    limit: Number(limit),
    page: Number(page)
  });

  const rows = await FileModel.listByFolder({
    userId,
    folderId,
    limit: l,
    offset
  });

  res.json({ items: rows, page: Number(page), limit: l });
}

/**
 * List files (keyset pagination)
 */
export async function listFilesKeyset(req, res) {
  const userId = req.user.id;
  const folderId = req.query.folderId ?? null;
  const limit = Math.min(Number(req.query.limit || 50), 200);
  const cursor = decodeCursor(req.query.cursor || null);

  let query = supabaseAdmin
    .from('files')
    .select('*')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false });

  if (folderId) {
    query = query.eq('folder_id', folderId);
  } else {
    query = query.is('folder_id', null);
  }

  if (cursor) {
    query = query
      .lt('created_at', cursor.created_at)
      .or(`created_at.eq.${cursor.created_at},id.lt.${cursor.id}`);
  }

  const { data, error } = await query.limit(limit);
  if (error) throw error;

  const nextCursor =
    data?.length
      ? encodeCursor({
          created_at: data[data.length - 1].created_at,
          id: data[data.length - 1].id
        })
      : null;

  res.json({ items: data, nextCursor });
}

/**
 * Upload file
 */
export async function uploadFile(req, res) {
  const userId = req.user.id;
  
  // 1. Check if file exists
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'No file uploaded' });

  // 2. Ensure folderId is handled correctly (convert "null" string to actual null)
  let folderId = req.body.folderId;
  if (!folderId || folderId === 'null' || folderId === 'undefined') {
    folderId = null;
  }

  try {
    const checksum = crypto
      .createHash('sha256')
      .update(file.buffer)
      .digest('hex');

    const storagePath = `${userId}/${Date.now()}_${file.originalname}`;
    const storageBucket = ENV.STORAGE_BUCKET ?? '';

    // 3. Upload to Supabase Storage
    const { error: uploadError } = await supabaseAdmin.storage
      .from(storageBucket)
      .upload(storagePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false
      });

    if (uploadError) throw uploadError;

    // 4. Create DB Entry
    const row = await FileModel.create({
      name: file.originalname,
      user_id: userId,
      folder_id: folderId, // This places it in the correct folder!
      storage_bucket: storageBucket,
      storage_path: storagePath,
      size: file.size,
      mime_type: file.mimetype,
      checksum
    });

    // 5. Permissions
    await supabaseAdmin.from('item_permissions').insert({
      item_type: 'file',
      item_id: row.id,
      user_id: userId,
      role: 'owner'
    });

    res.status(201).json(row);
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Create signed URL
 */
export async function signedUrl(req, res) {
  const id = req.params.id;
  const userId = req.user.id;

  const { data: perm } = await supabaseAdmin
    .from('item_permissions')
    .select('role')
    .eq('item_type', 'file')
    .eq('item_id', id)
    .eq('user_id', userId)
    .in('role', ['owner', 'edit', 'view'])
    .maybeSingle();

  if (!perm) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const file = await FileModel.byId(id);
  if (!file) {
    return res.status(404).json({ error: 'Not found' });
  }

  const { data, error } = await supabaseAdmin.storage
    .from(file.storage_bucket)
    .createSignedUrl(
      file.storage_path,
      ENV.SIGN_URL_EXPIRES
    );

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  res.json({
    url: data.signedUrl,
    expiresIn: ENV.SIGN_URL_EXPIRES
  });
}

/**
 * Rename file
 */
export async function renameFile(req, res) {
  const userId = req.user.id;
  const id = req.params.id;
  const { name } = req.body;

  const { data: perm } = await supabaseAdmin
    .from('item_permissions')
    .select('role')
    .eq('item_type', 'file')
    .eq('item_id', id)
    .eq('user_id', userId)
    .in('role', ['owner', 'edit'])
    .maybeSingle();

  if (!perm) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const updated = await FileModel.rename(id, name);
  res.json(updated);
}

/**
 * Move file
 */
export async function moveFile(req, res) {
  const userId = req.user.id;
  const id = req.params.id;
  const { folderId } = req.body;

  const { data: perm } = await supabaseAdmin
    .from('item_permissions')
    .select('role')
    .eq('item_type', 'file')
    .eq('item_id', id)
    .eq('user_id', userId)
    .in('role', ['owner', 'edit'])
    .maybeSingle();

  if (!perm) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const updated = await FileModel.move(id, folderId);
  res.json(updated);
}

/**
 * Soft delete file
 */
export async function deleteFile(req, res) {
  const userId = req.user.id;
  const id = req.params.id;

  const { data: perm } = await supabaseAdmin
    .from('item_permissions')
    .select('role')
    .eq('item_type', 'file')
    .eq('item_id', id)
    .eq('user_id', userId)
    .in('role', ['owner'])
    .maybeSingle();

  if (!perm) {
    return res.status(403).json({ error: 'Owner required' });
  }

  const updated = await FileModel.softDelete(id);
  res.json(updated);
}

/**
 * Restore file
 */
export async function restoreFile(req, res) {
  const userId = req.user.id;
  const id = req.params.id;

  const { data: perm } = await supabaseAdmin
    .from('item_permissions')
    .select('role')
    .eq('item_type', 'file')
    .eq('item_id', id)
    .eq('user_id', userId)
    .in('role', ['owner'])
    .maybeSingle();

  if (!perm) {
    return res.status(403).json({ error: 'Owner required' });
  }

  const updated = await FileModel.restore(id);
  res.json(updated);
}
