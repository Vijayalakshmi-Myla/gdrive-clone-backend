import { supabaseAdmin } from '../config/db.js';

export const UserModel = {
  async create(email, password, name) {
    const { data, error } = await supabaseAdmin
      .from('users')
      .insert({ email, password, name })
      .select('*')
      .single();

    if (error) throw error;
    return data;
  },

  async findByEmail(email) {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error) return null;
    return data;
  },

  async findById(id) {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', id)
      .single();

    if (error) return null;
    return data;
  }
};
