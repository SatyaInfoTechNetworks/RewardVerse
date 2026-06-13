import pool from '../db.js';
import { v4 as uuidv4 } from 'uuid';

// ----------------------------------------------------
// USER ENDPOINT
// ----------------------------------------------------
export const listOtherAppsUser = async (req, res) => {
  try {
    const query = `
      SELECT id, name, icon_url, description, app_url, display_order, is_active
      FROM other_apps
      WHERE is_active = 1
      ORDER BY display_order ASC, created_at DESC
    `;
    const [rows] = await pool.query(query);

    // Map database fields to standard JSON camelCase formatting for frontend consumption
    const apps = rows.map(row => ({
      id: row.id,
      name: row.name,
      iconUrl: row.icon_url,
      description: row.description,
      appUrl: row.app_url,
      displayOrder: row.display_order,
      isActive: !!row.is_active
    }));

    res.json({
      success: true,
      apps
    });
  } catch (error) {
    console.error('List Other Apps (User) Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ----------------------------------------------------
// ADMIN CRUD ENDPOINTS
// ----------------------------------------------------

// 1. List all apps for admin management
export const adminListOtherApps = async (req, res) => {
  try {
    const query = `
      SELECT id, name, icon_url, description, app_url, display_order, is_active, created_at
      FROM other_apps
      ORDER BY display_order ASC, created_at DESC
    `;
    const [rows] = await pool.query(query);

    res.json({
      success: true,
      apps: rows
    });
  } catch (error) {
    console.error('Admin List Other Apps Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// 2. Create a new app promotion
export const adminCreateOtherApp = async (req, res) => {
  try {
    const { name, icon_url, description, app_url, display_order = 0, is_active = true } = req.body;

    if (!name || !icon_url || !app_url) {
      return res.status(400).json({ success: false, message: 'Name, Icon URL, and App URL are required' });
    }

    const id = uuidv4();
    await pool.query(
      `INSERT INTO other_apps (id, name, icon_url, description, app_url, display_order, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [id, name, icon_url, description || '', app_url, parseInt(display_order || 0), is_active ? 1 : 0]
    );

    res.json({
      success: true,
      message: 'Other App promotion created successfully',
      id
    });
  } catch (error) {
    console.error('Admin Create Other App Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// 3. Update an existing app promotion
export const adminUpdateOtherApp = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, icon_url, description, app_url, display_order, is_active } = req.body;

    if (!name || !icon_url || !app_url) {
      return res.status(400).json({ success: false, message: 'Name, Icon URL, and App URL are required' });
    }

    // Verify app exists
    const [exist] = await pool.query('SELECT id FROM other_apps WHERE id = ? LIMIT 1', [id]);
    if (exist.length === 0) {
      return res.status(404).json({ success: false, message: 'App promotion not found' });
    }

    await pool.query(
      `UPDATE other_apps
       SET name = ?, icon_url = ?, description = ?, app_url = ?, display_order = ?, is_active = ?
       WHERE id = ?`,
      [
        name,
        icon_url,
        description || '',
        app_url,
        parseInt(display_order || 0),
        is_active ? 1 : 0,
        id
      ]
    );

    res.json({
      success: true,
      message: 'Other App promotion updated successfully'
    });
  } catch (error) {
    console.error('Admin Update Other App Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// 4. Delete an app promotion
export const adminDeleteOtherApp = async (req, res) => {
  try {
    const { id } = req.params;

    // Verify app exists
    const [exist] = await pool.query('SELECT id FROM other_apps WHERE id = ? LIMIT 1', [id]);
    if (exist.length === 0) {
      return res.status(404).json({ success: false, message: 'App promotion not found' });
    }

    await pool.query('DELETE FROM other_apps WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'App promotion deleted successfully'
    });
  } catch (error) {
    console.error('Admin Delete Other App Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
