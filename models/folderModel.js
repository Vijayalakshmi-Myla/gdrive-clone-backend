import { supabaseAdmin } from '../config/db.js';

/**
 * Helper to sanitize names for ltree paths (ltree only allows alphanumeric and underscores)
 */
const sanitizeForPath = (name) => name.replace(/[^a-zA-Z0-9]/g, '_');

export const FolderModel = {
  async create({ name, userId, parentId }) {
    let computedPath = sanitizeForPath(name);

    // 1. If there is a parent, fetch its path to build the new path
    if (parentId) {
      const { data: parent, error: pErr } = await supabaseAdmin
        .from('folders')
        .select('path')
        .eq('id', parentId)
        .single();

      if (pErr || !parent) throw new Error("Parent folder not found");
      
      // Build ltree path: parent.path.current_name
      computedPath = `${parent.path}.${sanitizeForPath(name)}`;
    }

    // 2. Insert with the path included to satisfy NOT NULL constraint
    const { data, error } = await supabaseAdmin
      .from('folders')
      .insert({ 
        name, 
        user_id: userId, 
        parent_id: parentId ?? null,
        path: computedPath 
      })
      .select('*')
      .single();

    if (error) {
      console.error("Database Insert Error:", error);
      throw error;
    }

    return data;
  },

  async byId(id) {
    const { data, error } = await supabaseAdmin
      .from('folders')
      .select('*')
      .eq('id', id)
      .single();

    if (error) return null;
    return data;
  },

  async listChildren({ userId, parentId, limit = 50, offset = 0 }) {
    let query = supabaseAdmin
      .from('folders')
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Handle root vs nested children
    if (parentId) {
      query = query.eq('parent_id', parentId);
    } else {
      query = query.is('parent_id', null);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async rename(id, name) {
    const { data, error } = await supabaseAdmin
      .from('folders')
      .update({ name })
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return data;
  },

  async move(id, newParentId) {
    // 1. Determine the new parent's path
    const { data: parent, error: pErr } = newParentId
      ? await supabaseAdmin.from('folders').select('path').eq('id', newParentId).single()
      : { data: { path: '' }, error: null }; 

    if (pErr) throw pErr;

    // 2. Update the parent_id
    const { data: updated, error } = await supabaseAdmin
      .from('folders')
      .update({ parent_id: newParentId })
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;

    // 3. Recompute path for the folder and all descendants using your RPC
    const { error: e2 } = await supabaseAdmin.rpc('repath_folder_and_descendants', {
      p_folder_id: id,
      p_new_parent_path: parent.path
    });

    if (e2) throw e2;
    return updated;
  },

  async softDelete(id) {
    const { data, error } = await supabaseAdmin
      .from('folders')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return data;
  },

  async restore(id) {
    const { data, error } = await supabaseAdmin
      .from('folders')
      .update({ deleted_at: null })
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return data;
  }
};