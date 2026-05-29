import pool from '../db.js';
import { v4 as uuidv4 } from 'uuid';
import { sendNotification } from '../utils/notifications.js';

// ==========================================
// ADMIN CONTEST CONTROLLERS
// ==========================================

// 1. List all contests with summary stats
export const listAdminContests = async (req, res) => {
  try {
    const query = `
      SELECT c.*, 
             COALESCE(SUM(ce.entries_count), 0) as total_entries, 
             COUNT(DISTINCT ce.user_id) as total_participants,
             (SELECT COUNT(*) FROM contest_winners WHERE contest_id = c.id) as total_winners_drawn
      FROM contests c
      LEFT JOIN contest_entries ce ON c.id = ce.contest_id
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `;
    const [rows] = await pool.query(query);

    const contests = [];
    for (const row of rows) {
      // Fetch rewards for each contest
      const [rewards] = await pool.query(
        'SELECT reward_position, reward_type, reward_value FROM contest_rewards WHERE contest_id = ? ORDER BY reward_position ASC',
        [row.id]
      );
      contests.push({
        ...row,
        total_entries: parseInt(row.total_entries),
        total_participants: parseInt(row.total_participants),
        rewards
      });
    }

    res.json({ success: true, contests });
  } catch (error) {
    console.error('Admin List Contests Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// 2. Create a new contest with tiered reward structures
export const createContest = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { 
      title, description, type, start_time, end_time, 
      max_entries_per_day = 3, total_winners = 1, rewards,
      slug = '', banner_image = '', prize_text = '',
      allow_free_entry = true, allow_ad_entry = true,
      max_ad_entries_per_day = 3, allow_coins_entry = false,
      ticket_coins_cost = 0, max_tickets_per_user = 10
    } = req.body;

    if (!title || !type || !start_time || !end_time) {
      return res.status(400).json({ success: false, message: 'Missing required contest properties' });
    }

    await connection.beginTransaction();

    const contestId = uuidv4();
    await connection.query(
      `INSERT INTO contests (id, title, description, type, start_time, end_time, max_entries_per_day, total_winners, status, created_at, slug, banner_image, prize_text, allow_free_entry, allow_ad_entry, max_ad_entries_per_day, allow_coins_entry, ticket_coins_cost, max_tickets_per_user)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        contestId, title, description || '', type, start_time, end_time, parseInt(max_entries_per_day), parseInt(total_winners),
        slug || '', banner_image || '', prize_text || '',
        allow_free_entry !== undefined ? Boolean(allow_free_entry) : true,
        allow_ad_entry !== undefined ? Boolean(allow_ad_entry) : true,
        parseInt(max_ad_entries_per_day !== undefined ? max_ad_entries_per_day : 3),
        allow_coins_entry !== undefined ? Boolean(allow_coins_entry) : false,
        parseFloat(ticket_coins_cost !== undefined ? ticket_coins_cost : 0),
        parseInt(max_tickets_per_user !== undefined ? max_tickets_per_user : 10)
      ]
    );

    // Sync rewards
    if (Array.isArray(rewards)) {
      for (const r of rewards) {
        const rewardId = uuidv4();
        await connection.query(
          `INSERT INTO contest_rewards (id, contest_id, reward_position, reward_type, reward_value, created_at)
           VALUES (?, ?, ?, ?, ?, NOW())`,
          [rewardId, contestId, parseInt(r.reward_position || 1), r.reward_type, parseFloat(r.reward_value || 0)]
        );
      }
    }

    await connection.commit();
    res.json({ success: true, message: 'Contest launched successfully', contest_id: contestId });
  } catch (error) {
    await connection.rollback();
    console.error('Admin Create Contest Error:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  } finally {
    connection.release();
  }
};

// 3. Update an existing contest details
export const updateContest = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const contestId = req.params.id;
    const { 
      title, description, start_time, end_time, 
      max_entries_per_day, total_winners, status, rewards,
      slug = '', banner_image = '', prize_text = '',
      allow_free_entry = true, allow_ad_entry = true,
      max_ad_entries_per_day = 3, allow_coins_entry = false,
      ticket_coins_cost = 0, max_tickets_per_user = 10
    } = req.body;

    await connection.beginTransaction();

    const [rows] = await connection.query('SELECT id FROM contests WHERE id = ?', [contestId]);
    if (rows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Contest not found' });
    }

    await connection.query(
      `UPDATE contests 
       SET title=?, description=?, start_time=?, end_time=?, max_entries_per_day=?, total_winners=?, status=?,
           slug=?, banner_image=?, prize_text=?, allow_free_entry=?, allow_ad_entry=?, max_ad_entries_per_day=?, allow_coins_entry=?, ticket_coins_cost=?, max_tickets_per_user=?
       WHERE id=?`,
      [
        title, description || '', start_time, end_time, parseInt(max_entries_per_day), parseInt(total_winners), status || 'ACTIVE',
        slug || '', banner_image || '', prize_text || '',
        allow_free_entry !== undefined ? Boolean(allow_free_entry) : true,
        allow_ad_entry !== undefined ? Boolean(allow_ad_entry) : true,
        parseInt(max_ad_entries_per_day !== undefined ? max_ad_entries_per_day : 3),
        allow_coins_entry !== undefined ? Boolean(allow_coins_entry) : false,
        parseFloat(ticket_coins_cost !== undefined ? ticket_coins_cost : 0),
        parseInt(max_tickets_per_user !== undefined ? max_tickets_per_user : 10),
        contestId
      ]
    );

    // Sync rewards
    if (rewards !== undefined && Array.isArray(rewards)) {
      await connection.query('DELETE FROM contest_rewards WHERE contest_id = ?', [contestId]);
      for (const r of rewards) {
        const rewardId = uuidv4();
        await connection.query(
          `INSERT INTO contest_rewards (id, contest_id, reward_position, reward_type, reward_value, created_at)
           VALUES (?, ?, ?, ?, ?, NOW())`,
          [rewardId, contestId, parseInt(r.reward_position || 1), r.reward_type, parseFloat(r.reward_value || 0)]
        );
      }
    }

    await connection.commit();
    res.json({ success: true, message: 'Contest updated successfully' });
  } catch (error) {
    await connection.rollback();
    console.error('Admin Update Contest Error:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  } finally {
    connection.release();
  }
};

// 4. Delete/Cancel a contest
export const deleteContest = async (req, res) => {
  try {
    const contestId = req.params.id;
    const [rows] = await pool.query('SELECT id FROM contests WHERE id = ?', [contestId]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Contest not found' });
    }

    await pool.query('DELETE FROM contests WHERE id = ?', [contestId]);
    res.json({ success: true, message: 'Contest deleted successfully' });
  } catch (error) {
    console.error('Admin Delete Contest Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// 5. Fetch all entries for audit list
export const getContestEntries = async (req, res) => {
  try {
    const contestId = req.params.id;
    const query = `
      SELECT ce.id, ce.entries_count, ce.entry_source, ce.created_at,
             u.name as user_name, u.email as user_email, u.user_id as user_public_id, u.id as user_internal_id
      FROM contest_entries ce
      JOIN users u ON ce.user_id = u.id
      WHERE ce.contest_id = ?
      ORDER BY ce.entries_count DESC, ce.created_at DESC
    `;
    const [entries] = await pool.query(query, [contestId]);
    res.json({ success: true, entries });
  } catch (error) {
    console.error('Admin Get Entries Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// 6. Draw winners using weighted random selection raffle or Competition Standings
export const drawContestWinners = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const contestId = req.params.id;

    await connection.beginTransaction();

    // A. FETCH CONTEST details
    const [contestRows] = await connection.query('SELECT * FROM contests WHERE id = ? FOR UPDATE', [contestId]);
    if (contestRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Contest not found' });
    }
    const contest = contestRows[0];

    if (contest.status === 'COMPLETED') {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'Contest winners have already been drawn.' });
    }

    // B. FETCH ALL REWARDS
    const [rewards] = await connection.query(
      'SELECT * FROM contest_rewards WHERE contest_id = ? ORDER BY reward_position ASC',
      [contestId]
    );

    const winnersDrawn = [];
    const isRaffle = contest.type === 'LUCKY_DRAW';

    if (isRaffle) {
      // -----------------------------------------------------------------
      // LUCKY_DRAW DRAWING (Weighted Raffle Basket)
      // -----------------------------------------------------------------
      // FETCH ALL ENTRIES GROUPED BY USER
      const [entries] = await connection.query(
        'SELECT user_id, SUM(entries_count) as total_tickets FROM contest_entries WHERE contest_id = ? GROUP BY user_id',
        [contestId]
      );

      if (entries.length === 0) {
        // No participants - mark completed and return
        await connection.query("UPDATE contests SET status = 'COMPLETED' WHERE id = ?", [contestId]);
        await connection.commit();
        return res.json({ success: true, message: 'No entries found. Contest closed with zero winners.' });
      }

      let raffleBasket = [];
      entries.forEach(e => {
        const count = parseInt(e.total_tickets || 0);
        for (let i = 0; i < count; i++) {
          raffleBasket.push(e.user_id);
        }
      });

      // Sort rewards by position to select Rank 1 first
      for (const reward of rewards) {
        if (raffleBasket.length === 0) break;

        // Select random index from the basket
        const randIdx = Math.floor(Math.random() * raffleBasket.length);
        const winnerUserId = raffleBasket[randIdx];

        winnersDrawn.push({
          userId: winnerUserId,
          position: reward.reward_position,
          type: reward.reward_type,
          value: parseFloat(reward.reward_value)
        });

        // Remove this user completely from the raffle basket so they cannot win multiple positions
        raffleBasket = raffleBasket.filter(uid => uid !== winnerUserId);
      }
    } else {
      // -----------------------------------------------------------------
      // REFERRAL or EARNINGS DRAWING (Ranked Leaderboard Competition)
      // -----------------------------------------------------------------
      let rankedQuery = '';
      let rankedParams = [];

      if (contest.type === 'REFERRAL_CONTEST') {
        rankedQuery = `
          SELECT cp.user_id, u.name as userName, COUNT(ru.id) as scoreValue
          FROM contest_participants cp
          JOIN users u ON cp.user_id = u.id
          LEFT JOIN referral_uses ru ON ru.referrer_id = cp.user_id AND ru.created_at > cp.joined_at AND ru.created_at BETWEEN ? AND ?
          WHERE cp.contest_id = ?
          GROUP BY cp.user_id, u.name
          ORDER BY scoreValue DESC, MIN(cp.joined_at) ASC
        `;
        rankedParams = [contest.start_time, contest.end_time, contestId];
      } else if (contest.type === 'EARNINGS_CONTEST') {
        rankedQuery = `
          SELECT cp.user_id, u.name as userName, COALESCE(SUM(t.amount), 0) as scoreValue
          FROM contest_participants cp
          JOIN users u ON cp.user_id = u.id
          LEFT JOIN transactions t ON t.user_id = cp.user_id AND t.type = 'CREDIT' AND t.source IN ('OFFER', 'TASK', 'WATCH_VIDEO', 'VIDEO_AD', 'OFFER_COMPLETION') AND t.created_at > cp.joined_at AND t.created_at BETWEEN ? AND ?
          WHERE cp.contest_id = ?
          GROUP BY cp.user_id, u.name
          ORDER BY scoreValue DESC, MIN(cp.joined_at) ASC
        `;
        rankedParams = [contest.start_time, contest.end_time, contestId];
      } else {
        // Fallback or event-based
        rankedQuery = `
          SELECT cp.user_id, u.name as userName, 0 as scoreValue
          FROM contest_participants cp
          JOIN users u ON cp.user_id = u.id
          WHERE cp.contest_id = ?
          GROUP BY cp.user_id, u.name
          ORDER BY MIN(cp.joined_at) ASC
        `;
        rankedParams = [contestId];
      }

      const [rankedParticipants] = await connection.query(rankedQuery, rankedParams);

      if (rankedParticipants.length === 0) {
        await connection.query("UPDATE contests SET status = 'COMPLETED' WHERE id = ?", [contestId]);
        await connection.commit();
        return res.json({ success: true, message: 'No registered participants found. Contest closed with zero winners.' });
      }

      // Map positions to the top ranked participants
      for (let i = 0; i < rewards.length; i++) {
        if (i >= rankedParticipants.length) break;
        const reward = rewards[i];
        const participant = rankedParticipants[i];

        winnersDrawn.push({
          userId: participant.user_id,
          position: reward.reward_position,
          type: reward.reward_type,
          value: parseFloat(reward.reward_value)
        });
      }
    }

    // E. ATOMIC REWARD CREDITING LEDGER
    for (const w of winnersDrawn) {
      const winnerId = uuidv4();
      const giveInstant = (w.type === 'COINS' || w.type === 'CASH');

      await connection.query(
        `INSERT INTO contest_winners (id, contest_id, user_id, reward_position, reward_type, reward_value, reward_given, selected_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
        [winnerId, contestId, w.userId, w.position, w.type, w.value, giveInstant ? 1 : 0]
      );

      // Ledger credit immediately for Coins or cash wallet balance
      if (giveInstant) {
        // Credit user balance
        await connection.query('UPDATE users SET balance = balance + ? WHERE id = ?', [w.value, w.userId]);

        // Insert ledger double-entry transaction record
        const transId = uuidv4();
        const description = `Won Rank #${w.position} in Contest: ${contest.title}`;
        await connection.query(
          `INSERT INTO transactions (id, user_id, amount, type, source, description, reference_id, created_at)
           VALUES (?, ?, ?, 'CREDIT', 'CONTEST_REWARD', ?, ?, NOW())`,
          [transId, w.userId, w.value, description, winnerId]
        );

        // Notify winner
        sendNotification(
          w.userId, 
          'Contest Winner! 🏆', 
          `Congratulations! You won ${w.value.toFixed(0)} ${w.type === 'COINS' ? 'Coins' : 'UPI Cash'} (Rank #${w.position}) in: "${contest.title}"`
        ).catch(err => console.error('Push notification error:', err));
      } else {
        // Gift Card (Requires manual review / approval by admin to send code)
        sendNotification(
          w.userId,
          'Contest Winner! 🏆',
          `You won Rank #${w.position} (Gift Card Reward)! The admin will review and dispatch your code shortly.`
        ).catch(err => console.error('Push notification error:', err));
      }
    }

    // F. MARK CONTEST COMPLETED
    await connection.query("UPDATE contests SET status = 'COMPLETED' WHERE id = ?", [contestId]);

    await connection.commit();
    res.json({ success: true, message: `Successfully drew ${winnersDrawn.length} winners!`, winners: winnersDrawn });
  } catch (error) {
    await connection.rollback();
    console.error('Admin Contest Draw Error:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  } finally {
    connection.release();
  }
};

// 7. Get winners list for contest
export const getContestWinnersAdmin = async (req, res) => {
  try {
    const contestId = req.params.id;
    const query = `
      SELECT cw.*, u.name as user_name, u.email as user_email, u.user_id as user_public_id
      FROM contest_winners cw
      JOIN users u ON cw.user_id = u.id
      WHERE cw.contest_id = ?
      ORDER BY cw.reward_position ASC
    `;
    const [winners] = await pool.query(query, [contestId]);
    res.json({ success: true, winners });
  } catch (error) {
    console.error('Admin Get Winners Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// 8. Deliver pending Gift Card code or mark cash as paid
export const giveContestRewardAdmin = async (req, res) => {
  try {
    const winnerId = req.params.winnerId;
    const { remark } = req.body; // e.g. "Google Play Code: GC-XXXX"

    if (!remark) {
      return res.status(400).json({ success: false, message: 'Delivery code / proof details are required' });
    }

    const [rows] = await pool.query('SELECT * FROM contest_winners WHERE id = ?', [winnerId]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Winner log not found' });
    }
    const winner = rows[0];

    await pool.query('UPDATE contest_winners SET reward_given = 1 WHERE id = ?', [winnerId]);

    // Send push notification containing the code
    sendNotification(
      winner.user_id,
      'Gift Card Delivered! 🎁',
      `Your code for Rank #${winner.reward_position} is: ${remark}. Thanks for participating!`
    ).catch(console.error);

    res.json({ success: true, message: 'Reward marked as delivered successfully' });
  } catch (error) {
    console.error('Admin Give Reward Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};


// ==========================================
// USER / MOBILE APP CONTEST CONTROLLERS
// ===================================// 1. Get all active and upcoming contests with my ticket counts
export const getActiveContestsUser = async (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;

    const query = `
      SELECT c.*
      FROM contests c
      WHERE c.status = 'ACTIVE' AND c.end_time > NOW()
      ORDER BY c.end_time ASC
    `;
    const [contests] = await pool.query(query);

    const formattedContests = [];
    for (const c of contests) {
      // Get rewards
      const [rewards] = await pool.query(
        'SELECT reward_position, reward_type, reward_value FROM contest_rewards WHERE contest_id = ? ORDER BY reward_position ASC',
        [c.id]
      );

      // Get registration or tickets
      let myTickets = 0;
      let globalEntriesCount = 0;

      const isRaffle = c.type === 'LUCKY_DRAW';

      if (isRaffle) {
        const [globalRows] = await pool.query(
          'SELECT SUM(entries_count) as total FROM contest_entries WHERE contest_id = ?',
          [c.id]
        );
        globalEntriesCount = parseInt(globalRows[0]?.total || 0);

        if (userId) {
          const [entryRows] = await pool.query(
            'SELECT SUM(entries_count) as tickets FROM contest_entries WHERE contest_id = ? AND user_id = ?',
            [c.id, userId]
          );
          myTickets = parseInt(entryRows[0]?.tickets || 0);
        }
      } else {
        const [globalRows] = await pool.query(
          'SELECT COUNT(*) as total FROM contest_participants WHERE contest_id = ?',
          [c.id]
        );
        globalEntriesCount = parseInt(globalRows[0]?.total || 0);

        if (userId) {
          const [partRows] = await pool.query(
            'SELECT COUNT(*) as registered FROM contest_participants WHERE contest_id = ? AND user_id = ?',
            [c.id, userId]
          );
          myTickets = parseInt(partRows[0]?.registered || 0) > 0 ? 1 : 0;
        }
      }

      formattedContests.push({
        id: c.id,
        title: c.title,
        description: c.description,
        type: c.type,
        startTime: c.start_time,
        endTime: c.end_time,
        maxEntriesPerDay: c.max_entries_per_day,
        totalWinners: c.total_winners,
        globalEntriesCount: globalEntriesCount,
        myTickets,
        slug: c.slug || '',
        bannerImage: c.banner_image || '',
        prizeText: c.prize_text || '',
        allowFreeEntry: Boolean(c.allow_free_entry),
        allowAdEntry: Boolean(c.allow_ad_entry),
        maxAdEntriesPerDay: parseInt(c.max_ad_entries_per_day || 3),
        allowCoinsEntry: Boolean(c.allow_coins_entry),
        ticketCoinsCost: parseFloat(c.ticket_coins_cost || 0),
        maxTicketsPerUser: parseInt(c.max_tickets_per_user || 10),
        rewards: rewards.map(r => ({
          position: r.reward_position,
          type: r.reward_type,
          value: parseFloat(r.reward_value)
        }))
      });
    }

    res.json({ success: true, contests: formattedContests });
  } catch (error) {
    console.error('User Get Contests Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// 2. Fetch details for a specific contest
export const getContestDetailUser = async (req, res) => {
  try {
    const contestId = req.params.id;
    const userId = req.user ? req.user.id : null;

    const [rows] = await pool.query('SELECT * FROM contests WHERE id = ?', [contestId]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Contest not found' });
    }
    const c = rows[0];

    const [rewards] = await pool.query(
      'SELECT reward_position, reward_type, reward_value FROM contest_rewards WHERE contest_id = ? ORDER BY reward_position ASC',
      [contestId]
    );

    const isRaffle = c.type === 'LUCKY_DRAW';

    // Get total entries / participants
    let totalEntries = 0;
    if (isRaffle) {
      const [totalRows] = await pool.query(
        'SELECT SUM(entries_count) as total FROM contest_entries WHERE contest_id = ?',
        [contestId]
      );
      totalEntries = parseInt(totalRows[0]?.total || 0);
    } else {
      const [totalRows] = await pool.query(
        'SELECT COUNT(*) as total FROM contest_participants WHERE contest_id = ?',
        [contestId]
      );
      totalEntries = parseInt(totalRows[0]?.total || 0);
    }

    // Get my tickets details
    let myTickets = 0;
    let entriesLeftToday = c.max_entries_per_day;
    let freeEntriesLeftToday = c.allow_free_entry ? 1 : 0;
    let adEntriesLeftToday = c.allow_ad_entry ? c.max_ad_entries_per_day : 0;
    let overallEntriesLeft = c.max_tickets_per_user;
    let myScore = 0;

    if (userId) {
      if (isRaffle) {
        const [entryRows] = await pool.query(
          'SELECT SUM(entries_count) as tickets FROM contest_entries WHERE contest_id = ? AND user_id = ?',
          [contestId, userId]
        );
        myTickets = parseInt(entryRows[0]?.tickets || 0);

        // Daily limit remaining checker (overall limit backward compatibility)
        const today = new Date().toISOString().split('T')[0];
        const [todayRows] = await pool.query(
          'SELECT SUM(entries_count) as tickets FROM contest_entries WHERE contest_id = ? AND user_id = ? AND DATE(created_at) = ?',
          [contestId, userId, today]
        );
        const todayEntries = parseInt(todayRows[0]?.tickets || 0);
        entriesLeftToday = Math.max(0, c.max_entries_per_day - todayEntries);

        // Free entry limit check today
        const [freeRows] = await pool.query(
          "SELECT SUM(entries_count) as tickets FROM contest_entries WHERE contest_id = ? AND user_id = ? AND entry_source = 'FREE' AND DATE(created_at) = ?",
          [contestId, userId, today]
        );
        const todayFree = parseInt(freeRows[0]?.tickets || 0);
        freeEntriesLeftToday = c.allow_free_entry ? Math.max(0, 1 - todayFree) : 0;

        // Ad entry limit check today
        const [adRows] = await pool.query(
          "SELECT SUM(entries_count) as tickets FROM contest_entries WHERE contest_id = ? AND user_id = ? AND entry_source = 'AD' AND DATE(created_at) = ?",
          [contestId, userId, today]
        );
        const todayAds = parseInt(adRows[0]?.tickets || 0);
        adEntriesLeftToday = c.allow_ad_entry ? Math.max(0, c.max_ad_entries_per_day - todayAds) : 0;

        // Total sweepstakes ticket limit per user
        overallEntriesLeft = Math.max(0, c.max_tickets_per_user - myTickets);
      } else {
        // For referral & earnings contests: user joins ONCE (acts as registration flag)
        const [partRows] = await pool.query(
          'SELECT joined_at FROM contest_participants WHERE contest_id = ? AND user_id = ?',
          [contestId, userId]
        );
        
        const hasJoined = partRows.length > 0;
        myTickets = hasJoined ? 1 : 0;
        
        freeEntriesLeftToday = 0;
        adEntriesLeftToday = 0;
        entriesLeftToday = 0;
        overallEntriesLeft = hasJoined ? 0 : 1;

        if (hasJoined) {
          const joinedAt = partRows[0].joined_at;
          if (c.type === 'REFERRAL_CONTEST') {
            const [scoreRows] = await pool.query(
              'SELECT COUNT(*) as count FROM referral_uses WHERE referrer_id = ? AND created_at > ? AND created_at BETWEEN ? AND ?',
              [userId, joinedAt, c.start_time, c.end_time]
            );
            myScore = parseInt(scoreRows[0]?.count || 0);
          } else if (c.type === 'EARNINGS_CONTEST') {
            const [scoreRows] = await pool.query(
              "SELECT SUM(amount) as total FROM transactions WHERE user_id = ? AND type = 'CREDIT' AND source IN ('OFFER', 'TASK', 'WATCH_VIDEO', 'VIDEO_AD', 'OFFER_COMPLETION') AND created_at > ? AND created_at BETWEEN ? AND ?",
              [userId, joinedAt, c.start_time, c.end_time]
            );
            myScore = parseFloat(scoreRows[0]?.total || 0);
          }
        }
      }
    } else {
      if (!isRaffle) {
        freeEntriesLeftToday = 0;
        adEntriesLeftToday = 0;
        entriesLeftToday = 0;
        overallEntriesLeft = 1;
      }
    }

    res.json({
      success: true,
      contest: {
        id: c.id,
        title: c.title,
        description: c.description,
        type: c.type,
        startTime: c.start_time,
        endTime: c.end_time,
        maxEntriesPerDay: c.max_entries_per_day,
        totalWinners: c.total_winners,
        status: c.status,
        slug: c.slug || '',
        bannerImage: c.banner_image || '',
        prizeText: c.prize_text || '',
        allowFreeEntry: Boolean(c.allow_free_entry),
        allowAdEntry: Boolean(c.allow_ad_entry),
        maxAdEntriesPerDay: parseInt(c.max_ad_entries_per_day || 3),
        allowCoinsEntry: Boolean(c.allow_coins_entry),
        ticketCoinsCost: parseFloat(c.ticket_coins_cost || 0),
        maxTicketsPerUser: parseInt(c.max_tickets_per_user || 10),
        totalEntries,
        myTickets,
        entriesLeftToday,
        freeEntriesLeftToday,
        adEntriesLeftToday,
        overallEntriesLeft,
        myScore, // dynamic live scoring
        rewards: rewards.map(r => ({
          position: r.reward_position,
          type: r.reward_type,
          value: parseFloat(r.reward_value)
        }))
      }
    });
  } catch (error) {
    console.error('User Get Contest Detail Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// 3. User claims ticket (Free, Ad, or Coins purchased) or Registers for Competitions
export const enterContestUser = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const contestId = req.params.id;
    const userId = req.user.id;
    const { source = 'FREE' } = req.body; // FREE, AD, COINS (used for LUCKY_DRAW)

    await connection.beginTransaction();

    const [contestRows] = await connection.query('SELECT * FROM contests WHERE id = ? FOR UPDATE', [contestId]);
    if (contestRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Contest not found' });
    }
    const contest = contestRows[0];

    if (contest.status !== 'ACTIVE') {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'This contest has already ended or is inactive.' });
    }

    const isRaffle = contest.type === 'LUCKY_DRAW';

    if (isRaffle) {
      // ------------------------------------------
      // LUCKY_DRAW (RAFFLE TICKETS PROCESS)
      // ------------------------------------------
      // Check overall max ticket limit
      const [userEntriesRows] = await connection.query(
        'SELECT SUM(entries_count) as total FROM contest_entries WHERE contest_id = ? AND user_id = ?',
        [contestId, userId]
      );
      const userTotalTickets = parseInt(userEntriesRows[0]?.total || 0);
      if (userTotalTickets >= contest.max_tickets_per_user) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: `Sweepstakes limit reached! You can hold a maximum of ${contest.max_tickets_per_user} tickets for this draw.`
        });
      }

      const today = new Date().toISOString().split('T')[0];

      if (source === 'FREE') {
        if (!contest.allow_free_entry) {
          await connection.rollback();
          return res.status(400).json({ success: false, message: 'Free ticket entry is not enabled for this draw.' });
        }

        const [todayFreeRows] = await connection.query(
          "SELECT SUM(entries_count) as tickets FROM contest_entries WHERE contest_id = ? AND user_id = ? AND entry_source = 'FREE' AND DATE(created_at) = ?",
          [contestId, userId, today]
        );
        const todayFreeCount = parseInt(todayFreeRows[0]?.tickets || 0);
        if (todayFreeCount >= 1) {
          await connection.rollback();
          return res.status(400).json({ success: false, message: 'You have already claimed your daily free ticket.' });
        }
      } 
      else if (source === 'AD') {
        if (!contest.allow_ad_entry) {
          await connection.rollback();
          return res.status(400).json({ success: false, message: 'Ad ticket entry is not enabled for this draw.' });
        }

        const [todayAdRows] = await connection.query(
          "SELECT SUM(entries_count) as tickets FROM contest_entries WHERE contest_id = ? AND user_id = ? AND entry_source = 'AD' AND DATE(created_at) = ?",
          [contestId, userId, today]
        );
        const todayAdCount = parseInt(todayAdRows[0]?.tickets || 0);
        if (todayAdCount >= contest.max_ad_entries_per_day) {
          await connection.rollback();
          return res.status(400).json({ 
            success: false, 
            message: `Daily ad entry limit reached. You can only earn up to ${contest.max_ad_entries_per_day} ad tickets per day.` 
          });
        }
      } 
      else if (source === 'COINS') {
        if (!contest.allow_coins_entry) {
          await connection.rollback();
          return res.status(400).json({ success: false, message: 'Coins purchased tickets are not enabled for this draw.' });
        }

        const [userRows] = await connection.query('SELECT balance FROM users WHERE id = ? FOR UPDATE', [userId]);
        const userBalance = parseFloat(userRows[0]?.balance || 0);
        const ticketCost = parseFloat(contest.ticket_coins_cost || 0);

        if (userBalance < ticketCost) {
          await connection.rollback();
          return res.status(400).json({
            success: false,
            message: `Insufficient coins. Each ticket costs ${ticketCost.toFixed(0)} coins, but your balance is ${userBalance.toFixed(0)} coins.`
          });
        }

        // Deduct coins from user balance
        await connection.query('UPDATE users SET balance = balance - ? WHERE id = ?', [ticketCost, userId]);

        // Write transaction ledger entry
        const transId = uuidv4();
        const description = `Purchased Raffle Ticket for Giveaway: ${contest.title}`;
        await connection.query(
          `INSERT INTO transactions (id, user_id, amount, type, source, description, reference_id, created_at)
           VALUES (?, ?, ?, 'DEBIT', 'CONTEST_TICKET_PURCHASE', ?, ?, NOW())`,
          [transId, userId, ticketCost, description, contestId]
        );
      } 
      else {
        await connection.rollback();
        return res.status(400).json({ success: false, message: 'Invalid ticket entry source method.' });
      }

      // Insert or increment entry count
      await connection.query(
        `INSERT INTO contest_entries (id, user_id, contest_id, entry_source, entries_count, created_at, updated_at)
         VALUES (?, ?, ?, ?, 1, NOW(), NOW())
         ON DUPLICATE KEY UPDATE entries_count = entries_count + 1, updated_at = NOW()`,
        [uuidv4(), userId, contestId, source]
      );

      await connection.commit();
      res.json({ 
        success: true, 
        message: source === 'FREE' ? 'Daily free ticket claimed!' : 
                 source === 'COINS' ? 'Raffle ticket purchased successfully!' : 
                 'Congratulations! You earned 1 raffle ticket.'
      });
    } else {
      // ------------------------------------------
      // REFERRAL or EARNINGS (ONE-TIME REGISTRATION)
      // ------------------------------------------
      const [existing] = await connection.query(
        'SELECT COUNT(*) as count FROM contest_participants WHERE contest_id = ? AND user_id = ?',
        [contestId, userId]
      );
      const isRegistered = parseInt(existing[0]?.count || 0) > 0;

      if (isRegistered) {
        await connection.rollback();
        return res.status(400).json({ success: false, message: 'You have already registered/joined this contest.' });
      }

      // Insert into contest_participants
      await connection.query(
        `INSERT INTO contest_participants (id, user_id, contest_id, joined_at)
         VALUES (?, ?, ?, NOW())`,
        [uuidv4(), userId, contestId]
      );

      await connection.commit();
      res.json({
        success: true,
        message: contest.type === 'REFERRAL_CONTEST' 
          ? 'Successfully registered! Your referrals are now being actively tracked.' 
          : 'Successfully joined the Earnings League! Your coins accumulated during the contest window will determine your rank.'
      });
    }
  } catch (error) {
    await connection.rollback();
    console.error('User Enter Contest Error:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  } finally {
    connection.release();
  }
};

// 4. Get list of historical winners for completed contests
export const getContestWinnersUser = async (req, res) => {
  try {
    const query = `
      SELECT cw.reward_position, cw.reward_type, cw.reward_value, cw.selected_at,
             c.title as contest_title, u.name as user_name
      FROM contest_winners cw
      JOIN contests c ON cw.contest_id = c.id
      JOIN users u ON cw.user_id = u.id
      ORDER BY cw.selected_at DESC, cw.reward_position ASC
      LIMIT 100
    `;
    const [winners] = await pool.query(query);
    res.json({ success: true, winners });
  } catch (error) {
    console.error('User Get Winners Feed Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// 5. Get leaderboard standings for a contest (Separated Architecture v2.5)
export const getContestLeaderboard = async (req, res) => {
  try {
    const contestId = req.params.id;
    const userId = req.user.id;

    // 1. Fetch contest configuration
    const [contestRows] = await pool.query('SELECT * FROM contests WHERE id = ?', [contestId]);
    if (contestRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Contest not found.' });
    }
    const contest = contestRows[0];
    
    let leaderboardQuery = '';
    let leaderboardParams = [];

    if (contest.type === 'REFERRAL_CONTEST') {
      leaderboardQuery = `
        SELECT cp.user_id, u.name as userName, COUNT(ru.id) as scoreValue
        FROM contest_participants cp
        JOIN users u ON cp.user_id = u.id
        LEFT JOIN referral_uses ru ON ru.referrer_id = cp.user_id AND ru.created_at > cp.joined_at AND ru.created_at BETWEEN ? AND ?
        WHERE cp.contest_id = ?
        GROUP BY cp.user_id, u.name
        ORDER BY scoreValue DESC, MIN(cp.joined_at) ASC
        LIMIT 10
      `;
      leaderboardParams = [contest.start_time, contest.end_time, contestId];
    } else if (contest.type === 'EARNINGS_CONTEST') {
      leaderboardQuery = `
        SELECT cp.user_id, u.name as userName, COALESCE(SUM(t.amount), 0) as scoreValue
        FROM contest_participants cp
        JOIN users u ON cp.user_id = u.id
        LEFT JOIN transactions t ON t.user_id = cp.user_id AND t.type = 'CREDIT' AND t.source IN ('OFFER', 'TASK', 'WATCH_VIDEO', 'VIDEO_AD', 'OFFER_COMPLETION') AND t.created_at > cp.joined_at AND t.created_at BETWEEN ? AND ?
        WHERE cp.contest_id = ?
        GROUP BY cp.user_id, u.name
        ORDER BY scoreValue DESC, MIN(cp.joined_at) ASC
        LIMIT 10
      `;
      leaderboardParams = [contest.start_time, contest.end_time, contestId];
    } else {
      // standard lucky draw tickets
      leaderboardQuery = `
        SELECT e.user_id, u.name as userName, COALESCE(SUM(e.entries_count), 0) as scoreValue
        FROM contest_entries e
        JOIN users u ON e.user_id = u.id
        WHERE e.contest_id = ?
        GROUP BY e.user_id, u.name
        ORDER BY scoreValue DESC, MIN(e.created_at) ASC
        LIMIT 10
      `;
      leaderboardParams = [contestId];
    }

    const [topRows] = await pool.query(leaderboardQuery, leaderboardParams);

    // Format top list with rank numbers
    const leaderboard = topRows.map((r, index) => ({
      rank: index + 1,
      userName: r.userName,
      score: contest.type === 'REFERRAL_CONTEST' ? `${r.scoreValue} Referrals` :
             contest.type === 'EARNINGS_CONTEST' ? `${parseFloat(r.scoreValue).toFixed(0)} Coins` :
             `${r.scoreValue} Tickets`
    }));

    // 2. Fetch Calling User's standing and rank position
    let myRank = 0;
    let myScore = 0;

    // Resolve user join time if joined
    const [partRows] = await pool.query(
      'SELECT joined_at FROM contest_participants WHERE contest_id = ? AND user_id = ?',
      [contestId, userId]
    );

    const hasJoined = partRows.length > 0;
    const joinedAt = hasJoined ? partRows[0].joined_at : contest.start_time;

    if (contest.type === 'REFERRAL_CONTEST') {
      if (hasJoined) {
        const [[userScoreRow]] = await pool.query(
          `SELECT COUNT(*) as score FROM referral_uses WHERE referrer_id = ? AND created_at > ? AND created_at BETWEEN ? AND ?`,
          [userId, joinedAt, contest.start_time, contest.end_time]
        );
        myScore = userScoreRow ? parseInt(userScoreRow.score || 0) : 0;

        const [[rankRow]] = await pool.query(
          `SELECT COUNT(*) + 1 as rankPosition
           FROM (
             SELECT cp.user_id, COUNT(ru.id) as scoreVal
             FROM contest_participants cp
             LEFT JOIN referral_uses ru ON ru.referrer_id = cp.user_id AND ru.created_at > cp.joined_at AND ru.created_at BETWEEN ? AND ?
             WHERE cp.contest_id = ?
             GROUP BY cp.user_id
           ) as standings
           WHERE scoreVal > ?`,
          [contest.start_time, contest.end_time, contestId, myScore]
        );
        myRank = rankRow ? parseInt(rankRow.rankPosition || 1) : 1;
      }
    } else if (contest.type === 'EARNINGS_CONTEST') {
      if (hasJoined) {
        const [[userScoreRow]] = await pool.query(
          `SELECT COALESCE(SUM(amount), 0) as score FROM transactions 
           WHERE user_id = ? AND type = 'CREDIT' AND source IN ('OFFER', 'TASK', 'WATCH_VIDEO', 'VIDEO_AD', 'OFFER_COMPLETION') 
             AND created_at > ? AND created_at BETWEEN ? AND ?`,
          [userId, joinedAt, contest.start_time, contest.end_time]
        );
        myScore = userScoreRow ? parseFloat(userScoreRow.score || 0) : 0;

        const [[rankRow]] = await pool.query(
          `SELECT COUNT(*) + 1 as rankPosition
           FROM (
             SELECT cp.user_id, COALESCE(SUM(t.amount), 0) as scoreVal
             FROM contest_participants cp
             LEFT JOIN transactions t ON t.user_id = cp.user_id AND t.type = 'CREDIT' AND t.source IN ('OFFER', 'TASK', 'WATCH_VIDEO', 'VIDEO_AD', 'OFFER_COMPLETION') AND t.created_at > cp.joined_at AND t.created_at BETWEEN ? AND ?
             WHERE cp.contest_id = ?
             GROUP BY cp.user_id
           ) as standings
           WHERE scoreVal > ?`,
          [contest.start_time, contest.end_time, contestId, myScore]
        );
        myRank = rankRow ? parseInt(rankRow.rankPosition || 1) : 1;
      }
    } else {
      // standard lucky draw tickets
      const [[ticketCountRow]] = await pool.query(
        'SELECT SUM(entries_count) as score FROM contest_entries WHERE user_id = ? AND contest_id = ?',
        [userId, contestId]
      );
      myScore = ticketCountRow ? parseInt(ticketCountRow.score || 0) : 0;

      const [[rankRow]] = await pool.query(
        `SELECT COUNT(*) + 1 as rankPosition
         FROM (
           SELECT user_id, SUM(entries_count) as scoreVal
           FROM contest_entries
           WHERE contest_id = ?
           GROUP BY user_id
         ) as standings
         WHERE scoreVal > ?`,
        [contestId, myScore]
      );
      myRank = rankRow ? parseInt(rankRow.rankPosition || 1) : 1;
    }

    return res.json({
      success: true,
      leaderboard: leaderboard,
      myStanding: {
        rank: hasJoined || contest.type === 'LUCKY_DRAW' ? myRank : 0,
        score: contest.type === 'REFERRAL_CONTEST' ? `${myScore} Referrals` :
               contest.type === 'EARNINGS_CONTEST' ? `${myScore.toFixed(0)} Coins` :
               `${myScore} Tickets`
      }
    });
  } catch (error) {
    console.error('User Get Leaderboard Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};


