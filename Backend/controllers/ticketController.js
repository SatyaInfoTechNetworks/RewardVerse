import pool from '../db.js';
import { v4 as uuidv4 } from 'uuid';

// ----------------------------------------------------
// CREATE TICKET
// ----------------------------------------------------
export const createTicket = async (req, res) => {
  try {
    const userId = req.user.id;
    const { subject, message } = req.body;

    if (!subject || !message) {
      return res.status(400).json({ success: false, message: 'Subject and message are required' });
    }

    const ticketId = uuidv4();

    await pool.query(
      'INSERT INTO tickets (id, user_id, subject, message, status, created_at) VALUES (?, ?, ?, ?, "OPEN", NOW())',
      [ticketId, userId, subject, message]
    );

    res.json({
      success: true,
      message: 'Support ticket created successfully',
      ticket_id: ticketId
    });
  } catch (error) {
    console.error('Create Ticket Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ----------------------------------------------------
// LIST USER TICKETS
// ----------------------------------------------------
export const listTickets = async (req, res) => {
  try {
    const userId = req.user.id;

    const [rows] = await pool.query(
      'SELECT id, subject, status, created_at FROM tickets WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );

    res.json({
      success: true,
      tickets: rows
    });
  } catch (error) {
    console.error('List Tickets Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ----------------------------------------------------
// GET TICKET DETAIL & REPLIES
// ----------------------------------------------------
export const getTicketDetail = async (req, res) => {
  try {
    const userId = req.user.id;
    const ticketId = req.params.id || req.query.id;

    if (!ticketId) {
      return res.status(400).json({ success: false, message: 'Ticket ID is required' });
    }

    // Get main ticket
    const [tickets] = await pool.query(
      'SELECT * FROM tickets WHERE id = ? AND user_id = ? LIMIT 1',
      [ticketId, userId]
    );

    if (tickets.length === 0) {
      return res.status(404).json({ success: false, message: 'Support ticket not found' });
    }

    // Get replies
    const [replies] = await pool.query(
      'SELECT id, sender_type, message, created_at FROM ticket_replies WHERE ticket_id = ? ORDER BY created_at ASC',
      [ticketId]
    );

    res.json({
      success: true,
      ticket: tickets[0],
      replies: replies
    });
  } catch (error) {
    console.error('Get Ticket Detail Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ----------------------------------------------------
// REPLY TO TICKET
// ----------------------------------------------------
export const replyToTicket = async (req, res) => {
  try {
    const userId = req.user.id;
    const ticketId = req.params.id || req.body.ticket_id;
    const { message } = req.body;

    if (!ticketId || !message) {
      return res.status(400).json({ success: false, message: 'Ticket ID and message are required' });
    }

    // Ensure ticket exists and is owned by the user
    const [tickets] = await pool.query(
      'SELECT id, status FROM tickets WHERE id = ? AND user_id = ? LIMIT 1',
      [ticketId, userId]
    );

    if (tickets.length === 0) {
      return res.status(404).json({ success: false, message: 'Support ticket not found' });
    }

    const replyId = uuidv4();

    // Insert reply
    await pool.query(
      'INSERT INTO ticket_replies (id, ticket_id, user_id, sender_type, message, created_at) VALUES (?, ?, ?, "USER", ?, NOW())',
      [replyId, ticketId, userId, message]
    );

    // Update main ticket status to OPEN (signaling user has responded and needs admin review)
    await pool.query('UPDATE tickets SET status = "OPEN" WHERE id = ?', [ticketId]);

    res.json({
      success: true,
      message: 'Reply sent successfully',
      reply_id: replyId
    });
  } catch (error) {
    console.error('Reply to Ticket Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ----------------------------------------------------
// CLOSE TICKET (USER SIDE)
// ----------------------------------------------------
export const closeUserTicket = async (req, res) => {
  try {
    const userId = req.user.id;
    const ticketId = req.params.id || req.body.ticket_id;

    if (!ticketId) {
      return res.status(400).json({ success: false, message: 'Ticket ID is required' });
    }

    // Ensure the ticket exists and belongs to the user
    const [tickets] = await pool.query(
      'SELECT id FROM tickets WHERE id = ? AND user_id = ? LIMIT 1',
      [ticketId, userId]
    );

    if (tickets.length === 0) {
      return res.status(404).json({ success: false, message: 'Support ticket not found' });
    }

    await pool.query('UPDATE tickets SET status = "CLOSED" WHERE id = ?', [ticketId]);

    res.json({
      success: true,
      message: 'Support ticket closed successfully'
    });
  } catch (error) {
    console.error('Close Ticket Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
