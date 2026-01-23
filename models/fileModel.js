import { supabaseAdmin } from '../config/db.js';

export const FileModel = {
  async create(file) {
    const { data, error } = await supabaseAdmin
      .from('files')
      .insert(file)
      .select('*')
      .single();

    if (error) throw error;
    return data;
  },

  async byId(id) {
    const { data, error } = await supabaseAdmin
      .from('files')
      .select('*')
      .eq('id', id)
      .single();

    if (error) return null;
    return data;
  },

  async listByFolder({ userId, folderId, limit = 50, offset = 0 }) {
    let query = supabaseAdmin
      .from('files')
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (folderId) {
      query = query.eq('folder_id', folderId);
    } else {
      query = query.is('folder_id', null);
    }

    const { data, error } = await query.range(
      offset,
      offset + limit - 1
    );

    if (error) throw error;
    return data;
  },

  async rename(id, name) {
    const { data, error } = await supabaseAdmin
      .from('files')
      .update({ name })
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return data;
  },

  async move(id, folderId) {
    const { data, error } = await supabaseAdmin
      .from('files')
      .update({ folder_id: folderId })
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return data;
  },

  async softDelete(id) {
    const { data, error } = await supabaseAdmin
      .from('files')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return data;
  },

  async restore(id) {
    const { data, error } = await supabaseAdmin
      .from('files')
      .update({ deleted_at: null })
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return data;
  }
};
