import React, { useState, useEffect } from 'react';
import { API_BASE } from '../config';

// Import Admin Subcomponents
import AdminTickets from '../components/admin/AdminTickets';
import AdminNotifications from '../components/admin/AdminNotifications';
import AdminBanners from '../components/admin/AdminBanners';
import AdminConfigs from '../components/admin/AdminConfigs';
import AdminPayouts from '../components/admin/AdminPayouts';
import AdminReferrals from '../components/admin/AdminReferrals';
import AdminLifafas from '../components/admin/AdminLifafas';
import AdminReports from '../components/admin/AdminReports';
import AdminContests from '../components/admin/AdminContests';
import AdminOtherApps from '../components/admin/AdminOtherApps';

export default function AdminPortal() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  
  // Navigation (Aligned exactly with legacy PHP pages)
  const [activeTab, setActiveTab] = useState('overview'); // overview, users, offers, referrals, erasures, banners, push, lifafas, withdrawals, payouts, reports, proofs, tickets, configs, other_apps
  const [isCreatingOffer, setIsCreatingOffer] = useState(false);

  // Admin Data states
  const [stats, setStats] = useState({
    total_users: 0,
    banned_users: 0,
    new_users_today: 0,
    active_offers: 0,
    pending_withdrawals: 0,
    pending_withdrawals_value: 0,
    settled_payouts_value: 0,
    total_coins_issued: 0,
    total_completions: 0,
    open_tickets: 0,
    pending_erasures: 0,
    pending_proofs: 0
  });

  const [usersList, setUsersList] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [usersPage, setUsersPage] = useState(1);
  const [usersLimit, setUsersLimit] = useState(15);
  const [usersTotal, setUsersTotal] = useState(0);
  const [usersPages, setUsersPages] = useState(1);
  const [usersStatus, setUsersStatus] = useState('ALL'); // ALL, ACTIVE, BANNED
  
  const [selectedUser, setSelectedUser] = useState(null);
  const [userTransactions, setUserTransactions] = useState([]);
  const [adjustBalanceModal, setAdjustBalanceModal] = useState(false);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustType, setAdjustType] = useState('CREDIT');
  const [adjustDesc, setAdjustDesc] = useState('');
  
  const [editUserModal, setEditUserModal] = useState(false);
  const [isDeletingFingerprints, setIsDeletingFingerprints] = useState(false);
  const [editUserForm, setEditUserForm] = useState({
    name: '',
    email: '',
    phone_number: '',
    location: '',
    referral_code: '',
    balance: ''
  });

  const [editFingerprintModal, setEditFingerprintModal] = useState(false);
  const [editFingerprintForm, setEditFingerprintForm] = useState({
    android_id: '',
    device_model: '',
    os_version: '',
    app_version: '',
    ip_address: '',
    is_emulator: false
  });

  // Offer manager states
  const [offersList, setOffersList] = useState([]);
  const [editingOffer, setEditingOffer] = useState(null);
  const [offerForm, setOfferForm] = useState({
    title: '',
    external_id: '',
    description: '',
    category: 'Top Offers',
    icon_url: '',
    tracking_url: '',
    total_reward: 0,
    actual_price: 0,
    is_active: true,
    type: 'online',
    reward_type: 'Multi Reward',
    estimated_time: '5 mins',
    difficulty: 'Medium',
    is_hot: false,
    extra_label: '',
    input_type: '',
    input_instruction: [],
    tiers: [],
    daily_completion_cap: 0,
    country_targeting: 'IN'
  });

  // Visit and Earn states
  const [visitTasksList, setVisitTasksList] = useState([]);
  const [editingVisitTask, setEditingVisitTask] = useState(null);
  const [visitTaskForm, setVisitTaskForm] = useState({
    title: '',
    coins: 0,
    visit_url: '',
    timer_seconds: 30,
    is_ad: false,
    is_active: true
  });

  // Withdrawals states
  const [withdrawalsList, setWithdrawalsList] = useState([]);
  const [withdrawalStatus, setWithdrawalStatus] = useState('PENDING'); // PENDING, APPROVED, REJECTED, ALL
  const [selectedWithdrawal, setSelectedWithdrawal] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectModal, setRejectModal] = useState(false);
  
  const [providerPerformance, setProviderPerformance] = useState([]);
  const [withdrawalSearch, setWithdrawalSearch] = useState('');
  const [debouncedWithdrawalSearch, setDebouncedWithdrawalSearch] = useState('');
  const [withdrawalPage, setWithdrawalPage] = useState(1);
  const [withdrawalLimit, setWithdrawalLimit] = useState(15);
  const [withdrawalTotal, setWithdrawalTotal] = useState(0);

  // Erasures states
  const [erasuresList, setErasuresList] = useState([]);

  // Global Transactions states
  const [globalTransactionsList, setGlobalTransactionsList] = useState([]);
  const [globalTransactionsSearch, setGlobalTransactionsSearch] = useState('');
  const [debouncedGlobalTransactionsSearch, setDebouncedGlobalTransactionsSearch] = useState('');
  const [globalTransactionsPage, setGlobalTransactionsPage] = useState(1);
  const [globalTransactionsTotal, setGlobalTransactionsTotal] = useState(0);
  const [globalTransactionsPages, setGlobalTransactionsPages] = useState(1);
  const [globalTransactionsType, setGlobalTransactionsType] = useState('ALL');
  const [globalTransactionsSource, setGlobalTransactionsSource] = useState('ALL');
  const globalTransactionsLimit = 50;

  // Offline task manual proof verification states
  const [proofsList, setProofsList] = useState([]);
  const [rejectProofClickId, setRejectProofClickId] = useState(null);
  const [rejectProofReason, setRejectProofReason] = useState('');
  const [rejectProofModal, setRejectProofModal] = useState(false);

  // FCM states
  const [fcmTargetUserId, setFcmTargetUserId] = useState('');
  const [fcmTitle, setFcmTitle] = useState('');
  const [fcmBody, setFcmBody] = useState('');
  const [fcmStatus, setFcmStatus] = useState(null);

  // Global Loader/Notice
  const [actionNotice, setActionNotice] = useState(null);

  // Dynamic Theme Load and Cleanup (Same as AdminLTE 3 / Bootstrap 4 Template)
  useEffect(() => {
    // Add AdminLTE CSS
    const linkLte = document.createElement('link');
    linkLte.rel = 'stylesheet';
    linkLte.href = 'https://cdn.jsdelivr.net/npm/admin-lte@3.2/dist/css/adminlte.min.css';
    linkLte.id = 'adminlte-css';
    document.head.appendChild(linkLte);

    // Add FontAwesome Icons
    const linkFa = document.createElement('link');
    linkFa.rel = 'stylesheet';
    linkFa.href = 'https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.2/css/all.min.css';
    linkFa.id = 'font-awesome-css';
    document.head.appendChild(linkFa);

    // Add Source Sans Pro Font
    const linkFont = document.createElement('link');
    linkFont.rel = 'stylesheet';
    linkFont.href = 'https://fonts.googleapis.com/css?family=Source+Sans+Pro:300,400,400i,700&display=fallback';
    linkFont.id = 'source-sans-font';
    document.head.appendChild(linkFont);

    // Set body classes for AdminLTE
    document.body.className = 'hold-transition sidebar-mini layout-fixed';
    document.body.style.backgroundColor = '#f4f6f9';
    document.body.style.color = '#212529';
    document.body.style.fontFamily = '"Source Sans Pro", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

    return () => {
      // Cleanup links on unmount
      document.getElementById('adminlte-css')?.remove();
      document.getElementById('font-awesome-css')?.remove();
      document.getElementById('source-sans-font')?.remove();
      
      // Restore body classes
      document.body.className = '';
      document.body.style.backgroundColor = '';
      document.body.style.color = '';
      document.body.style.fontFamily = '';
    };
  }, []);

  // Debounce user search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(userSearch);
      setUsersPage(1); // Reset page on search
    }, 400);
    return () => clearTimeout(timer);
  }, [userSearch]);

  // Debounce withdrawal search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedWithdrawalSearch(withdrawalSearch);
      setWithdrawalPage(1); // Reset page on search
    }, 400);
    return () => clearTimeout(timer);
  }, [withdrawalSearch]);

  // Check auth on load
  useEffect(() => {
    const token = localStorage.getItem('rewardverse_admin_token');
    if (token) {
      setIsAuthenticated(true);
      fetchDashboardData(token);
    }
  }, []);

  const getHeaders = () => {
    const token = localStorage.getItem('rewardverse_admin_token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password })
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem('rewardverse_admin_token', data.token);
        setIsAuthenticated(true);
        fetchDashboardData(data.token);
      } else {
        setLoginError(data.message || 'Invalid admin credentials');
      }
    } catch (err) {
      setLoginError('Connection failure. Check if backend is running.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('rewardverse_admin_token');
    setIsAuthenticated(false);
  };

  const showNotice = (type, message) => {
    setActionNotice({ type, message });
    setTimeout(() => setActionNotice(null), 5000);
  };

  // Helper check for 401
  const checkResponseStatus = (res) => {
    if (res.status === 401) {
      handleLogout();
      showNotice('error', 'Session expired. Please log in again.');
      return false;
    }
    return true;
  };

  const fetchDashboardData = async (tokenOverride) => {
    const headers = tokenOverride 
      ? { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenOverride}` }
      : getHeaders();
      
    try {
      // 1. Stats
      const statsRes = await fetch(`${API_BASE}/api/admin/stats`, { headers });
      if (!checkResponseStatus(statsRes)) return;
      const statsData = await statsRes.json();
      if (statsData.success) {
        setStats(statsData.stats);
        setProviderPerformance(statsData.providerPerformance || []);
      }

      // 2. Offers (Admin list includes completion counts)
      const offersRes = await fetch(`${API_BASE}/api/admin/offers`, { headers });
      if (!checkResponseStatus(offersRes)) return;
      const offersData = await offersRes.json();
      if (offersData.success) setOffersList(offersData.offers || []);

      // 3. Erasures
      const erasureRes = await fetch(`${API_BASE}/api/admin/erasures`, { headers });
      if (!checkResponseStatus(erasureRes)) return;
      const erasureData = await erasureRes.json();
      if (erasureData.success) setErasuresList(erasureData.requests || []);

    } catch (err) {
      console.error("Error fetching admin data:", err);
    }
  };

  const fetchUsers = async () => {
    try {
      const headers = getHeaders();
      const statusParam = usersStatus !== 'ALL' ? `&status=${usersStatus.toLowerCase()}` : '';
      const res = await fetch(`${API_BASE}/api/admin/users?search=${debouncedSearch}&page=${usersPage}&limit=${usersLimit}${statusParam}`, { headers });
      if (!checkResponseStatus(res)) return;
      const data = await res.json();
      if (data.success) {
        setUsersList(data.users || []);
        if (data.pagination) {
          setUsersTotal(data.pagination.total);
          setUsersPages(data.pagination.pages);
        }
      }
    } catch (err) {
      console.error("Error fetching users:", err);
    }
  };

  // Fetch users when query, page or status changes
  useEffect(() => {
    if (isAuthenticated) {
      fetchUsers();
    }
  }, [debouncedSearch, usersPage, usersStatus, isAuthenticated]);

  const fetchWithdrawals = async () => {
    try {
      const statusParam = withdrawalStatus !== 'ALL' ? `status=${withdrawalStatus}` : '';
      const searchParam = debouncedWithdrawalSearch ? `&search=${encodeURIComponent(debouncedWithdrawalSearch)}` : '';
      const pageParam = `&page=${withdrawalPage}&limit=${withdrawalLimit}`;
      const queryParams = [statusParam, searchParam, pageParam].filter(Boolean).join('&');
      const prefix = queryParams ? `?${queryParams}` : '';
      
      const res = await fetch(`${API_BASE}/api/admin/withdrawals${prefix}`, { headers: getHeaders() });
      if (!checkResponseStatus(res)) return;
      const data = await res.json();
      if (data.success) {
        setWithdrawalsList(data.withdrawals || []);
        setWithdrawalTotal(data.total || 0);
      }
    } catch (err) {
      console.error("Error fetching withdrawals:", err);
    }
  };

  // Fetch withdrawals when status tab, search or page changes
  useEffect(() => {
    if (isAuthenticated && activeTab === 'withdrawals') {
      fetchWithdrawals();
    }
  }, [withdrawalStatus, debouncedWithdrawalSearch, withdrawalPage, withdrawalLimit, activeTab, isAuthenticated]);

  // Debounce global transactions search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedGlobalTransactionsSearch(globalTransactionsSearch);
      setGlobalTransactionsPage(1); // Reset page on search
    }, 400);
    return () => clearTimeout(timer);
  }, [globalTransactionsSearch]);

  const fetchGlobalTransactions = async () => {
    try {
      const typeParam = globalTransactionsType !== 'ALL' ? `&type=${globalTransactionsType}` : '';
      const sourceParam = globalTransactionsSource !== 'ALL' ? `&source=${globalTransactionsSource}` : '';
      const searchParam = debouncedGlobalTransactionsSearch ? `&search=${debouncedGlobalTransactionsSearch}` : '';
      
      const res = await fetch(
        `${API_BASE}/api/admin/transactions?page=${globalTransactionsPage}&limit=${globalTransactionsLimit}${searchParam}${typeParam}${sourceParam}`, 
        { headers: getHeaders() }
      );
      if (!checkResponseStatus(res)) return;
      const data = await res.json();
      if (data.success) {
        setGlobalTransactionsList(data.transactions || []);
        if (data.pagination) {
          setGlobalTransactionsTotal(data.total || 0);
          setGlobalTransactionsPages(data.pagination.totalPages || 1);
        }
      }
    } catch (err) {
      console.error("Error fetching global transactions:", err);
    }
  };

  // Fetch global transactions when query, page or filters change
  useEffect(() => {
    if (isAuthenticated && activeTab === 'transactions') {
      fetchGlobalTransactions();
    }
  }, [debouncedGlobalTransactionsSearch, globalTransactionsPage, globalTransactionsType, globalTransactionsSource, activeTab, isAuthenticated]);

  const fetchProofs = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/proofs`, { headers: getHeaders() });
      if (!checkResponseStatus(res)) return;
      const data = await res.json();
      if (data.success) setProofsList(data.proofs || []);
    } catch (err) {
      console.error("Error fetching proofs:", err);
    }
  };

  // Fetch proofs when tab is proofs
  useEffect(() => {
    if (isAuthenticated && activeTab === 'proofs') {
      fetchProofs();
    }
  }, [activeTab, isAuthenticated]);

  const fetchVisitTasks = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/visit-earn`, { headers: getHeaders() });
      if (!checkResponseStatus(res)) return;
      const data = await res.json();
      if (data.success) setVisitTasksList(data.tasks || []);
    } catch (err) {
      console.error("Error fetching visit tasks:", err);
    }
  };

  // Fetch visit tasks when tab is visit-earn
  useEffect(() => {
    if (isAuthenticated && activeTab === 'visit-earn') {
      fetchVisitTasks();
    }
  }, [activeTab, isAuthenticated]);

  const resetVisitTaskForm = () => {
    setEditingVisitTask(null);
    setVisitTaskForm({
      title: '',
      coins: 0,
      visit_url: '',
      timer_seconds: 30,
      is_ad: false,
      is_active: true
    });
  };

  const handleVisitTaskSubmit = async (e) => {
    e.preventDefault();
    if (!visitTaskForm.title || !visitTaskForm.visit_url) return;
    try {
      const url = editingVisitTask 
        ? `${API_BASE}/api/admin/visit-earn/${editingVisitTask.id}` 
        : `${API_BASE}/api/admin/visit-earn`;
      const method = editingVisitTask ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: getHeaders(),
        body: JSON.stringify(visitTaskForm)
      });
      const data = await res.json();
      if (data.success) {
        showNotice('success', editingVisitTask ? 'Visit task updated successfully' : 'Visit task created successfully');
        resetVisitTaskForm();
        fetchVisitTasks();
      } else {
        showNotice('error', data.message);
      }
    } catch (err) {
      showNotice('error', 'Failed to save visit task');
    }
  };

  const handleEditVisitTaskClick = (task) => {
    setEditingVisitTask(task);
    setVisitTaskForm({
      title: task.title || '',
      coins: task.coins || 0,
      visit_url: task.visit_url || '',
      timer_seconds: task.timer_seconds || 30,
      is_ad: task.is_ad ? true : false,
      is_active: task.is_active ? true : false
    });
  };

  const handleDeleteVisitTask = async (id) => {
    if (!window.confirm("Are you sure you want to delete this Visit & Earn task?")) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/visit-earn/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      const data = await res.json();
      if (data.success) {
        showNotice('success', 'Visit task deleted successfully');
        fetchVisitTasks();
      } else {
        showNotice('error', data.message);
      }
    } catch (err) {
      showNotice('error', 'Failed to delete visit task');
    }
  };

  const viewUserLedger = async (user) => {
    setSelectedUser(user);
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/${user.id}/transactions`, { headers: getHeaders() });
      if (!checkResponseStatus(res)) return;
      const data = await res.json();
      if (data.success) {
        setUserTransactions(data.transactions || []);
        if (data.user) {
          setSelectedUser({
            ...data.user,
            device_fingerprint: data.device_fingerprint || null
          });
        } else {
          setSelectedUser({
            ...user,
            device_fingerprint: data.device_fingerprint || null
          });
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleBanUser = async (userId) => {
    const reason = window.prompt("Enter reason for banning this user:");
    if (reason === null) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/${userId}/ban`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ reason })
      });
      if (!checkResponseStatus(res)) return;
      const data = await res.json();
      if (data.success) {
        showNotice('success', 'User banned successfully');
        fetchUsers();
        if (selectedUser && selectedUser.id === userId) {
          setSelectedUser({ ...selectedUser, is_banned: 1, ban_reason: reason });
        }
      } else {
        showNotice('error', data.message);
      }
    } catch (err) {
      showNotice('error', 'Failed to ban user');
    }
  };

  const handleUnbanUser = async (userId) => {
    if (!window.confirm("Are you sure you want to unban this user?")) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/${userId}/unban`, {
        method: 'POST',
        headers: getHeaders()
      });
      if (!checkResponseStatus(res)) return;
      const data = await res.json();
      if (data.success) {
        showNotice('success', 'User unbanned successfully');
        fetchUsers();
        if (selectedUser && selectedUser.id === userId) {
          setSelectedUser({ ...selectedUser, is_banned: 0, ban_reason: null });
        }
      } else {
        showNotice('error', data.message);
      }
    } catch (err) {
      showNotice('error', 'Failed to unban user');
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm("CRITICAL WARNING: This will permanently delete the user's account, balance, transactions, withdrawals, tickets, referrals, and progress. This action is irreversible. Are you sure you want to proceed?")) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      if (!checkResponseStatus(res)) return;
      const data = await res.json();
      if (data.success) {
        showNotice('success', 'User permanently deleted');
        setSelectedUser(null);
        fetchUsers();
        fetchDashboardData();
      } else {
        showNotice('error', data.message);
      }
    } catch (err) {
      showNotice('error', 'Failed to delete user');
    }
  };

  const handleAdjustBalance = async (e) => {
    e.preventDefault();
    if (!selectedUser || !adjustAmount) return;
    
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/${selectedUser.id}/balance`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ amount: adjustAmount, type: adjustType, description: adjustDesc })
      });
      const data = await res.json();
      if (data.success) {
        showNotice('success', 'User balance modified successfully');
        setAdjustBalanceModal(false);
        setAdjustAmount('');
        setAdjustDesc('');
        
        // Refresh selected user and ledger
        const [updatedUserRes] = await Promise.all([
          fetch(`${API_BASE}/api/admin/users?search=${selectedUser.email}`, { headers: getHeaders() }),
          viewUserLedger(selectedUser)
        ]);
        const updatedUserData = await updatedUserRes.json();
        if (updatedUserData.success && updatedUserData.users.length > 0) {
          setSelectedUser(updatedUserData.users[0]);
        }
        
        // Refresh stats
        fetchDashboardData();
      } else {
        showNotice('error', data.message);
      }
    } catch (err) {
      showNotice('error', 'Failed to adjust balance');
    }
  };

  const triggerEditUser = (user) => {
    setEditUserForm({
      name: user.name || '',
      email: user.email || '',
      phone_number: user.phone_number || '',
      location: user.location || '',
      referral_code: user.referral_code || '',
      balance: user.balance || 0,
      android_id: user.android_id || '',
      fcm_token: user.fcm_token || '',
      daily_spins_count: user.daily_spins_count || 0,
      current_streak: user.current_streak || 0,
      referred_by: user.referred_by || '',
      user_id: user.user_id || '',
      uid: user.uid || '',
      device_model: user.device_fingerprint?.device_model || '',
      os_version: user.device_fingerprint?.os_version || '',
      app_version: user.device_fingerprint?.app_version || '',
      ip_address: user.device_fingerprint?.ip_address || '',
      is_emulator: user.device_fingerprint?.is_emulator ? true : false
    });
    setEditUserModal(true);
  };

  const handleEditUserSubmit = async (e) => {
    e.preventDefault();
    if (!selectedUser) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/${selectedUser.id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(editUserForm)
      });
      const data = await res.json();
      if (data.success) {
        showNotice('success', 'User information updated successfully');
        setEditUserModal(false);
        const updatedUser = { 
          ...selectedUser, 
          ...editUserForm, 
          balance: parseFloat(editUserForm.balance),
          device_fingerprint: {
            ...selectedUser.device_fingerprint,
            device_model: editUserForm.device_model,
            os_version: editUserForm.os_version,
            app_version: editUserForm.app_version,
            ip_address: editUserForm.ip_address,
            is_emulator: editUserForm.is_emulator ? 1 : 0
          }
        };
        setSelectedUser(updatedUser);
        fetchUsers();
        fetchDashboardData();
      } else {
        showNotice('error', data.message);
      }
    } catch (err) {
      showNotice('error', 'Failed to update user info');
    }
  };

  const handleDeleteFingerprints = async () => {
    if (!selectedUser) return;
    if (!window.confirm(`Are you sure you want to completely clear the device fingerprints and Android ID for ${selectedUser.name}? This allows them to register or login on a new device.`)) {
      return;
    }
    setIsDeletingFingerprints(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/${selectedUser.id}/fingerprints`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      const data = await res.json();
      if (data.success) {
        showNotice('success', 'User device fingerprints cleared successfully');
        setSelectedUser({
          ...selectedUser,
          android_id: null,
          device_fingerprint: null
        });
        fetchUsers();
      } else {
        showNotice('error', data.message || 'Failed to clear fingerprints');
      }
    } catch (err) {
      showNotice('error', 'Network error while clearing fingerprints');
    } finally {
      setIsDeletingFingerprints(false);
    }
  };
  const triggerEditFingerprint = (user) => {
    setEditFingerprintForm({
      android_id: user.android_id || '',
      device_model: user.device_fingerprint?.device_model || '',
      os_version: user.device_fingerprint?.os_version || '',
      app_version: user.device_fingerprint?.app_version || '',
      ip_address: user.device_fingerprint?.ip_address || '',
      is_emulator: user.device_fingerprint?.is_emulator ? true : false
    });
    setEditFingerprintModal(true);
  };

  const handleEditFingerprintSubmit = async (e) => {
    e.preventDefault();
    if (!selectedUser) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/${selectedUser.id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(editFingerprintForm)
      });
      const data = await res.json();
      if (data.success) {
        showNotice('success', 'Device fingerprint updated successfully');
        setEditFingerprintModal(false);
        await viewUserLedger(selectedUser);
        fetchUsers();
      } else {
        showNotice('error', data.message);
      }
    } catch (err) {
      showNotice('error', 'Failed to update device fingerprint');
    }
  };

  // Offers Manager methods
  const resetOfferForm = () => {
    setEditingOffer(null);
    setIsCreatingOffer(false);
    setOfferForm({
      title: '',
      external_id: '',
      description: '',
      category: 'Top Offers',
      icon_url: '',
      tracking_url: '',
      total_reward: 0,
      actual_price: 0,
      is_active: true,
      type: 'online',
      reward_type: 'Multi Reward',
      estimated_time: '5 mins',
      difficulty: 'Medium',
      is_hot: false,
      extra_label: '',
      input_type: '',
      input_instruction: [],
      tiers: [],
      daily_completion_cap: 0,
      country_targeting: 'IN'
    });
  };

  const addTierToForm = () => {
    const nextSeq = offerForm.tiers.length + 1;
    setOfferForm({
      ...offerForm,
      tiers: [
        ...offerForm.tiers,
        { title: `Tier ${nextSeq}`, backend_title: `tier_${nextSeq}`, reward: 10, steps: ['Click link', 'Submit proof'], sequence: nextSeq }
      ]
    });
  };

  const removeTierFromForm = (index) => {
    const updated = offerForm.tiers.filter((_, i) => i !== index);
    // Renumber sequences
    const renumbered = updated.map((t, idx) => ({ ...t, sequence: idx + 1 }));
    setOfferForm({ ...offerForm, tiers: renumbered });
  };

  const updateTierField = (index, field, value) => {
    const updated = [...offerForm.tiers];
    updated[index][field] = value;
    setOfferForm({ ...offerForm, tiers: updated });
  };

  const handleOfferSubmit = async (e) => {
    e.preventDefault();
    if (!offerForm.title) return;

    try {
      const url = editingOffer ? `${API_BASE}/api/admin/offers/${editingOffer.id}` : `${API_BASE}/api/admin/offers`;
      const method = editingOffer ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: getHeaders(),
        body: JSON.stringify(offerForm)
      });
      const data = await res.json();
      
      if (data.success) {
        showNotice('success', editingOffer ? 'Offer updated successfully' : 'Offer created successfully');
        resetOfferForm();
        fetchDashboardData();
      } else {
        showNotice('error', data.message);
      }
    } catch (err) {
      showNotice('error', 'Failed to save offer');
    }
  };

  const handleEditOfferClick = (offer) => {
    setEditingOffer(offer);
    
    // Fetch offer details to populate tiers
    fetch(`${API_BASE}/api/offers/${offer.id}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          const fetched = data.offer;
          // Maps tiers
          const loadedTiers = fetched.tiers ? fetched.tiers.map(t => ({
            title: t.title || '',
            backend_title: t.backend_title || '',
            reward: parseFloat(t.reward || 0),
            steps: typeof t.steps === 'string' ? JSON.parse(t.steps) : (t.steps || []),
            sequence: parseInt(t.sequence || 1)
          })) : [];

          // Safe parsing of input_instruction
          const inputInstructionVal = fetched.input_instruction || fetched.inputInstruction;
          let loadedInstructions = [];
          if (inputInstructionVal) {
            try {
              loadedInstructions = typeof inputInstructionVal === 'string' 
                ? JSON.parse(inputInstructionVal) 
                : inputInstructionVal;
              if (!Array.isArray(loadedInstructions)) loadedInstructions = [];
            } catch (e) {
              console.error("Error parsing input_instruction:", e);
            }
          }

          setOfferForm({
            title: fetched.title || '',
            external_id: fetched.external_id || '',
            description: fetched.description || '',
            category: fetched.category || 'Top Offers',
            icon_url: fetched.icon_url || fetched.iconUrl || '',
            tracking_url: fetched.tracking_url || fetched.trackingUrl || '',
            total_reward: parseFloat(fetched.total_reward !== undefined ? fetched.total_reward : (fetched.totalReward !== undefined ? fetched.totalReward : 0)),
            actual_price: parseFloat(fetched.actual_price !== undefined ? fetched.actual_price : (fetched.actualPrice !== undefined ? fetched.actualPrice : 0)),
            is_active: (fetched.is_active !== undefined ? fetched.is_active : (fetched.isActive !== undefined ? fetched.isActive : true)) ? true : false,
            type: fetched.type || 'online',
            reward_type: fetched.reward_type || fetched.rewardType || 'Multi Reward',
            estimated_time: fetched.estimated_time || fetched.estimatedTime || '5 mins',
            difficulty: fetched.difficulty || 'Medium',
            is_hot: (fetched.is_hot !== undefined ? fetched.is_hot : (fetched.isHot !== undefined ? fetched.isHot : false)) ? true : false,
            extra_label: fetched.extra_label || fetched.extraLabel || '',
            input_type: fetched.input_type || fetched.inputType || '',
            input_instruction: loadedInstructions,
            tiers: loadedTiers,
            daily_completion_cap: parseInt(fetched.daily_completion_cap !== undefined ? fetched.daily_completion_cap : (fetched.dailyCompletionCap !== undefined ? fetched.dailyCompletionCap : 0)),
            country_targeting: fetched.country_targeting || fetched.countryTargeting || 'IN'
          });
        }
      });
  };

  const handleDeleteOffer = async (id) => {
    if (!window.confirm("Are you sure you want to archive this offer?")) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/offers/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      const data = await res.json();
      if (data.success) {
        showNotice('success', 'Offer archived successfully');
        fetchDashboardData();
      }
    } catch (err) {
      showNotice('error', 'Failed to archive offer');
    }
  };

  // Withdrawals approvals
  const handleApproveWithdrawal = async (w) => {
    let redeem_code = null;
    if (w.requires_redeem_code) {
      const enteredCode = window.prompt(`Enter the redeem voucher code for ${w.method}:`);
      if (enteredCode === null) {
        return; // User cancelled
      }
      if (!enteredCode.trim()) {
        alert('A redeem code is required to approve this payout method.');
        return;
      }
      redeem_code = enteredCode.trim();
    }
    try {
      const res = await fetch(`${API_BASE}/api/admin/withdrawals/${w.id}/approve`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ redeem_code })
      });
      const data = await res.json();
      if (data.success) {
        showNotice('success', 'Withdrawal payout marked settled');
        fetchDashboardData();
      } else {
        showNotice('error', data.message || 'Failed to approve withdrawal');
      }
    } catch (err) {
      showNotice('error', 'Failed to approve withdrawal');
    }
  };

  const triggerRejectWithdrawal = (withdrawal) => {
    setSelectedWithdrawal(withdrawal);
    setRejectReason('');
    setRejectModal(true);
  };

  const handleRejectWithdrawalSubmit = async (e) => {
    e.preventDefault();
    if (!selectedWithdrawal) return;
    
    try {
      const res = await fetch(`${API_BASE}/api/admin/withdrawals/${selectedWithdrawal.id}/reject`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ reason: rejectReason })
      });
      const data = await res.json();
      if (data.success) {
        showNotice('success', 'Withdrawal rejected and balance refunded');
        setRejectModal(false);
        setSelectedWithdrawal(null);
        fetchDashboardData();
      }
    } catch (err) {
      showNotice('error', 'Failed to reject withdrawal');
    }
  };

  // Account erasure methods
  const handleApproveErasure = async (id) => {
    if (!window.confirm("CRITICAL PURGE: This will hard-delete the user's entire account, transactions, and files permanently. Proceed?")) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/erasures/${id}/approve`, {
        method: 'POST',
        headers: getHeaders()
      });
      const data = await res.json();
      if (data.success) {
        showNotice('success', 'User permanently deleted from system');
        fetchDashboardData();
      }
    } catch (err) {
      showNotice('error', 'Failed to process purge');
    }
  };

  const handleRejectErasure = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/erasures/${id}/reject`, {
        method: 'POST',
        headers: getHeaders()
      });
      const data = await res.json();
      if (data.success) {
        showNotice('success', 'Deletion request dismissed');
        fetchDashboardData();
      }
    } catch (err) {
      showNotice('error', 'Failed to dismiss request');
    }
  };

  const handleApproveProof = async (clickId) => {
    if (!window.confirm("Are you sure you want to approve this proof submission and credit the user's balance?")) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/proofs/${clickId}/approve`, {
        method: 'POST',
        headers: getHeaders()
      });
      const data = await res.json();
      if (data.success) {
        showNotice('success', data.message || 'Proof submission approved and coins credited');
        fetchProofs();
        fetchDashboardData();
      } else {
        showNotice('error', data.message);
      }
    } catch (err) {
      showNotice('error', 'Failed to approve proof submission');
    }
  };

  const triggerRejectProof = (clickId) => {
    setRejectProofClickId(clickId);
    setRejectProofReason('');
    setRejectProofModal(true);
  };

  const handleRejectProofSubmit = async (e) => {
    e.preventDefault();
    if (!rejectProofClickId) return;

    try {
      const res = await fetch(`${API_BASE}/api/admin/proofs/${rejectProofClickId}/reject`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ reason: rejectProofReason })
      });
      const data = await res.json();
      if (data.success) {
        showNotice('success', 'Proof submission rejected and user notified');
        setRejectProofModal(false);
        setRejectProofClickId(null);
        setRejectProofReason('');
        fetchProofs();
        fetchDashboardData();
      } else {
        showNotice('error', data.message);
      }
    } catch (err) {
      showNotice('error', 'Failed to reject proof submission');
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="login-page bg-light" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="login-box" style={{ width: '400px' }}>
          <div className="card card-outline card-primary shadow-lg rounded-lg border-0">
            <div className="card-header text-center bg-transparent border-0 pt-4">
              <h1 className="h1 font-weight-bold mb-0">Rewardverse <b>Admin</b></h1>
              <span className="text-muted text-xs">Master Administration Console</span>
            </div>
            <div className="card-body">
              <p className="login-box-msg text-secondary">Authenticate admin session credentials</p>

              {loginError && (
                <div className="alert alert-danger p-2 text-sm text-left">
                  <i className="fas fa-ban mr-2"></i> {loginError}
                </div>
              )}

              <form onSubmit={handleLogin}>
                <div className="form-group">
                  <label className="text-muted text-xs uppercase font-weight-bold mb-1">Master Password</label>
                  <div className="input-group">
                    <input 
                      type="password" 
                      className="form-control rounded-left" 
                      placeholder="••••••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required 
                    />
                    <div className="input-group-append">
                      <div className="input-group-text"><span className="fas fa-lock text-muted"></span></div>
                    </div>
                  </div>
                </div>
                <button type="submit" className="btn btn-primary btn-block rounded-pill py-2 font-weight-bold mt-4 shadow-sm">
                  Authenticate Master Session
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="wrapper">
      {/* Header / Navbar */}
      <nav className="main-header navbar navbar-expand navbar-white navbar-light border-bottom-0 shadow-xs">
        <ul className="navbar-nav">
          <li className="nav-item">
            <a className="nav-link" data-widget="pushmenu" href="#" role="button"><i className="fas fa-bars"></i></a>
          </li>
          <li className="nav-item d-none d-sm-inline-block">
            <a href="#" onClick={() => { resetOfferForm(); setSelectedUser(null); setActiveTab('overview'); }} className="nav-link font-weight-bold text-dark">Home</a>
          </li>
        </ul>
        <ul className="navbar-nav ml-auto">
          <li className="nav-item">
            <span className="nav-link text-secondary font-weight-bold text-sm">
              Active Database: <strong className="text-success"><i className="fas fa-database mr-1"></i>AppDatabase</strong>
            </span>
          </li>
        </ul>
      </nav>

      {/* Sidebar (Same Menu Names & Hierarchy as sidebar.php) */}
      <aside className="main-sidebar sidebar-dark-primary elevation-4">
        <a href="#" onClick={() => { resetOfferForm(); setSelectedUser(null); setActiveTab('overview'); }} className="brand-link border-bottom-0 text-center py-3">
          <img src="https://ui-avatars.com/api/?name=S&background=007bff&color=fff" className="brand-image img-circle elevation-3" style={{ opacity: .8 }} />
          <span className="brand-text font-weight-bold ml-2">Rewardverse Admin</span>
        </a>
        <div className="sidebar">
          <nav className="mt-3">
            <ul className="nav nav-pills nav-sidebar flex-column nav-flat nav-child-indent" data-widget="treeview" role="menu">
              
              <li className="nav-item">
                <a href="#" onClick={() => { resetOfferForm(); setSelectedUser(null); setActiveTab('overview'); }} className={`nav-link ${activeTab === 'overview' ? 'active' : ''}`}>
                  <i className="nav-icon fas fa-th-large mr-2"></i>
                  <p>Dashboard</p>
                </a>
              </li>
              
              <li className="nav-header font-weight-bold text-xs text-muted uppercase">Users & Growth</li>
              <li className="nav-item">
                <a href="#" onClick={() => { resetOfferForm(); setSelectedUser(null); setActiveTab('users'); }} className={`nav-link ${activeTab === 'users' ? 'active' : ''}`}>
                  <i className="nav-icon fas fa-users mr-2"></i>
                  <p>User Database</p>
                </a>
              </li>
              <li className="nav-item">
                <a href="#" onClick={() => { resetOfferForm(); setSelectedUser(null); setActiveTab('referrals'); }} className={`nav-link ${activeTab === 'referrals' ? 'active' : ''}`}>
                  <i className="nav-icon fas fa-share-alt mr-2"></i>
                  <p>Referral Config</p>
                </a>
              </li>
              <li className="nav-item">
                <a href="#" onClick={() => { resetOfferForm(); setSelectedUser(null); setActiveTab('erasures'); }} className={`nav-link ${activeTab === 'erasures' ? 'active' : ''}`}>
                  <i className="nav-icon fas fa-user-times mr-2"></i>
                  <p>Deletion Requests</p>
                </a>
              </li>

              <li className="nav-header font-weight-bold text-xs text-muted uppercase">Promotion</li>
              <li className="nav-item">
                <a href="#" onClick={() => { resetOfferForm(); setSelectedUser(null); setActiveTab('banners'); }} className={`nav-link ${activeTab === 'banners' ? 'active' : ''}`}>
                  <i className="nav-icon fas fa-image mr-2"></i>
                  <p>App Banners</p>
                </a>
              </li>
              <li className="nav-item">
                <a href="#" onClick={() => { resetOfferForm(); setSelectedUser(null); setActiveTab('push'); }} className={`nav-link ${activeTab === 'push' ? 'active' : ''}`}>
                  <i className="nav-icon fas fa-bell mr-2"></i>
                  <p>Push Notifications</p>
                </a>
              </li>
              <li className="nav-item">
                <a href="#" onClick={() => { resetOfferForm(); setSelectedUser(null); setActiveTab('lifafas'); }} className={`nav-link ${activeTab === 'lifafas' ? 'active' : ''}`}>
                  <i className="nav-icon fas fa-envelope-open-text mr-2"></i>
                  <p>Lifafa (Redeem)</p>
                </a>
              </li>
              <li className="nav-item">
                <a href="#" onClick={() => { resetOfferForm(); setSelectedUser(null); setActiveTab('other_apps'); }} className={`nav-link ${activeTab === 'other_apps' ? 'active' : ''}`}>
                  <i className="nav-icon fas fa-mobile-alt mr-2"></i>
                  <p>Other Apps</p>
                </a>
              </li>

              <li className="nav-header font-weight-bold text-xs text-muted uppercase">Inventory</li>
              <li className="nav-item">
                <a href="#" onClick={() => { resetOfferForm(); setSelectedUser(null); setActiveTab('offers'); }} className={`nav-link ${activeTab === 'offers' ? 'active' : ''}`}>
                  <i className="nav-icon fas fa-tasks mr-2"></i>
                  <p>Manage Offers</p>
                </a>
              </li>
              <li className="nav-item">
                <a href="#" onClick={() => { resetOfferForm(); setSelectedUser(null); setActiveTab('visit-earn'); }} className={`nav-link ${activeTab === 'visit-earn' ? 'active' : ''}`}>
                  <i className="nav-icon fas fa-coins mr-2"></i>
                  <p>Visit & Earn</p>
                </a>
              </li>
              <li className="nav-item">
                <a href="#" onClick={() => { resetOfferForm(); setSelectedUser(null); setActiveTab('contests'); }} className={`nav-link ${activeTab === 'contests' ? 'active' : ''}`}>
                  <i className="nav-icon fas fa-trophy mr-2 text-warning"></i>
                  <p>Contests & Giveaways</p>
                </a>
              </li>

              <li className="nav-header font-weight-bold text-xs text-muted uppercase">Financials</li>
              <li className="nav-item">
                <a href="#" onClick={() => { resetOfferForm(); setSelectedUser(null); setActiveTab('withdrawals'); }} className={`nav-link ${activeTab === 'withdrawals' ? 'active' : ''}`}>
                  <i className="nav-icon fas fa-money-bill-wave mr-2"></i>
                  <p>Withdrawal Queue</p>
                  {stats.pending_withdrawals > 0 && (
                    <span className="badge badge-warning float-right px-2">{stats.pending_withdrawals}</span>
                  )}
                </a>
              </li>
              <li className="nav-item">
                <a href="#" onClick={() => { resetOfferForm(); setSelectedUser(null); setActiveTab('payouts'); }} className={`nav-link ${activeTab === 'payouts' ? 'active' : ''}`}>
                  <i className="nav-icon fas fa-university mr-2"></i>
                  <p>Payout Methods</p>
                </a>
              </li>

              <li className="nav-header font-weight-bold text-xs text-muted uppercase">Audit & Compliance</li>
              <li className="nav-item">
                <a href="#" onClick={() => { resetOfferForm(); setSelectedUser(null); setActiveTab('reports'); }} className={`nav-link ${activeTab === 'reports' ? 'active' : ''}`}>
                  <i className="nav-icon fas fa-chart-line mr-2"></i>
                  <p>Business Stats</p>
                </a>
              </li>
              <li className="nav-item">
                <a href="#" onClick={() => { resetOfferForm(); setSelectedUser(null); setActiveTab('proofs'); }} className={`nav-link ${activeTab === 'proofs' ? 'active' : ''}`}>
                  <i className="nav-icon fas fa-images mr-2"></i>
                  <p>Proof Gallery</p>
                  {stats.pending_proofs > 0 && (
                    <span className="badge badge-primary float-right px-2">{stats.pending_proofs}</span>
                  )}
                </a>
              </li>
              <li className="nav-item">
                <a href="#" onClick={() => { resetOfferForm(); setSelectedUser(null); setActiveTab('tickets'); }} className={`nav-link ${activeTab === 'tickets' ? 'active' : ''}`}>
                  <i className="nav-icon fas fa-comments mr-2"></i>
                  <p>Support Tickets</p>
                  {stats.open_tickets > 0 && (
                    <span className="badge badge-info float-right px-2">{stats.open_tickets}</span>
                  )}
                </a>
              </li>
              <li className="nav-item">
                <a href="#" onClick={() => { resetOfferForm(); setSelectedUser(null); setActiveTab('transactions'); }} className={`nav-link ${activeTab === 'transactions' ? 'active' : ''}`}>
                  <i className="nav-icon fas fa-history mr-2"></i>
                  <p>Global Ledger</p>
                </a>
              </li>

              <li className="nav-header font-weight-bold text-xs text-muted uppercase">Infrastructure</li>
              <li className="nav-item">
                <a href="#" onClick={() => { resetOfferForm(); setSelectedUser(null); setActiveTab('configs'); }} className={`nav-link ${activeTab === 'configs' ? 'active' : ''}`}>
                  <i className="nav-icon fas fa-tools mr-2"></i>
                  <p>System Config</p>
                </a>
              </li>

              <li className="nav-header font-weight-bold text-xs text-muted uppercase">Session</li>
              <li className="nav-item">
                <a href="#" onClick={handleLogout} className="nav-link">
                  <i className="nav-icon fas fa-power-off text-danger mr-2"></i>
                  <p>Sign Out</p>
                </a>
              </li>

            </ul>
          </nav>
        </div>
      </aside>

      {/* Content Body */}
      <div className="content-wrapper bg-light">
        
        {/* Dynamic Action Alerts */}
        {actionNotice && (
          <div className={`alert alert-${actionNotice.type === 'success' ? 'success' : 'danger'} alert-dismissible shadow`} style={{ position: 'fixed', top: '80px', right: '40px', zIndex: 10000, minWidth: '320px', borderRadius: '12px' }}>
            <button type="button" className="close" onClick={() => setActionNotice(null)}>&times;</button>
            <h5><i className={`icon fas ${actionNotice.type === 'success' ? 'fa-check' : 'fa-ban'}`}></i> Alert</h5>
            {actionNotice.message}
          </div>
        )}

        {/* Dynamic Header matching PHP pages */}
        <div className="content-header pt-4">
          <div className="container-fluid">
            <div className="row mb-2 align-items-center">
              <div className="col-sm-6">
                <h1 className="m-0 font-weight-bold text-dark text-capitalize">
                  {isCreatingOffer ? 'Launch New Offer' :
                   editingOffer ? 'Edit Offer Data' :
                   activeTab === 'overview' ? 'Dashboard' : 
                   activeTab === 'users' ? 'User Database' : 
                   activeTab === 'offers' ? 'Offer Inventory' : 
                   activeTab === 'referrals' ? 'Referral Engine Configuration' : 
                   activeTab === 'erasures' ? 'Deletion Requests' : 
                   activeTab === 'banners' ? 'App Banners' : 
                   activeTab === 'push' ? 'Push Notifications' : 
                   activeTab === 'lifafas' ? 'Lifafa (Redeem)' : 
                   activeTab === 'withdrawals' ? 'Payout Management' : 
                   activeTab === 'payouts' ? 'Payout Methods' : 
                   activeTab === 'reports' ? 'Business Stats' : 
                   activeTab === 'proofs' ? 'Proofs Auditing Gallery' : 
                   activeTab === 'tickets' ? 'Support Tickets' : 
                   activeTab === 'configs' ? 'System Config' : activeTab}
                </h1>
              </div>
              <div className="col-sm-6 text-right">
                {activeTab === 'offers' && !isCreatingOffer && !editingOffer && (
                  <button className="btn btn-primary elevation-1 font-weight-bold px-4 rounded-pill" onClick={() => { resetOfferForm(); setIsCreatingOffer(true); }}>
                    <i className="fas fa-plus mr-1"></i> Create Offer
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic Panels */}
        <section className="content">
          <div className="container-fluid">
            
            {/* TAB 1: DASHBOARD (index.php) */}
            {activeTab === 'overview' && (
              <div>
                <div className="row">
                  
                  <div className="col-lg-3 col-6">
                    <div className="small-box bg-primary elevation-1 rounded-lg">
                      <div className="inner">
                        <h3>{stats.total_users}</h3>
                        <p>Register Users</p>
                      </div>
                      <div className="icon"><i className="fas fa-user-plus"></i></div>
                      <a href="#" onClick={() => setActiveTab('users')} className="small-box-footer">More Info <i className="fas fa-arrow-circle-right"></i></a>
                    </div>
                  </div>

                  <div className="col-lg-3 col-6">
                    <div className="small-box bg-success elevation-1 rounded-lg">
                      <div className="inner">
                        <h3>{stats.active_offers}</h3>
                        <p>Active Offers</p>
                      </div>
                      <div className="icon"><i className="fas fa-gift"></i></div>
                      <a href="#" onClick={() => setActiveTab('offers')} className="small-box-footer">More Info <i className="fas fa-arrow-circle-right"></i></a>
                    </div>
                  </div>

                  <div className="col-lg-3 col-6">
                    <div className="small-box bg-warning elevation-1 rounded-lg">
                      <div className="inner">
                        <h3 className="text-white">{stats.pending_withdrawals}</h3>
                        <p className="text-white">Pending Payouts</p>
                      </div>
                      <div className="icon"><i className="fas fa-hourglass-half text-white-50"></i></div>
                      <a href="#" onClick={() => setActiveTab('withdrawals')} className="small-box-footer text-white-50">More Info <i className="fas fa-arrow-circle-right text-white-50"></i></a>
                    </div>
                  </div>

                  <div className="col-lg-3 col-6">
                    <div className="small-box bg-danger elevation-1 rounded-lg">
                      <div className="inner">
                        <h3>₹{stats.settled_payouts_value.toFixed(2)}</h3>
                        <p>Total Disbursed</p>
                      </div>
                      <div className="icon"><i className="fas fa-money-check-alt"></i></div>
                      <a href="#" onClick={() => setActiveTab('withdrawals')} className="small-box-footer">More Info <i className="fas fa-arrow-circle-right"></i></a>
                    </div>
                  </div>

                </div>

                {/* Provider Performance Cards */}
                <h4 className="mt-4 mb-3 font-weight-bold text-dark">Provider Performance</h4>
                <div className="row">
                  {providerPerformance.map(p => (
                    <div key={p.key} className="col-12 col-sm-6 col-md-3 mb-3">
                      <div className="info-box shadow-none border rounded-lg h-100 mb-0">
                        <span className={`info-box-icon bg-${p.color} elevation-1`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '60px' }}>
                          <img src={p.icon} style={{ width: '30px', height: '30px', objectFit: 'contain' }} alt={p.label} onError={(e) => { e.target.src = 'https://iili.io/qKAmR5J.png'; }} />
                        </span>
                        <div className="info-box-content">
                          <span className="info-box-text font-weight-bold text-muted text-xs uppercase">{p.label}</span>
                          <span className="info-box-number text-lg font-weight-black mt-1">
                            {p.today.toLocaleString()} <span className="text-xs font-normal text-muted">coins today</span>
                          </span>
                          <div className="progress my-2" style={{ height: '2px' }}>
                            <div className={`progress-bar bg-${p.color}`} style={{ width: '100%' }}></div>
                          </div>
                          <span className="progress-description text-xs text-secondary">
                            Weekly: <strong>{p.weekly.toLocaleString()}</strong>
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="card card-white shadow-none border rounded-lg mt-4">
                  <div className="card-body p-4">
                    <h5 className="font-weight-bold text-dark"><i className="fas fa-server mr-2 text-primary"></i> Active Database Host Credentials</h5>
                    <p className="text-secondary text-sm mb-0 mt-2 leading-relaxed">
                      You are actively connected to the fresh <strong>AppDatabase</strong> on external node <code>72.61.254.236:3320</code>. This is fully isolated from the legacy PHP schema, preserving all production data. All updates you execute here will be made directly to the fresh client environment.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: USER DATABASE (users.php) */}
            {activeTab === 'users' && (
              <div>
                <div className="card card-white shadow-none border rounded-lg">
                  <div className="card-header border-0 bg-transparent">
                    <h3 className="card-title font-weight-bold">Member Directory</h3>
                    <div className="card-tools">
                      <div className="input-group input-group-sm" style={{ width: '250px' }}>
                        <input 
                          type="text" 
                          className="form-control rounded-left" 
                          placeholder="Search users..." 
                          value={userSearch}
                          onChange={(e) => setUserSearch(e.target.value)}
                        />
                        <div className="input-group-append">
                          <span className="input-group-text rounded-right bg-transparent border-left-0"><i className="fas fa-search"></i></span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="card-body table-responsive p-0">
                    <table className="table table-hover align-middle mb-0">
                      <thead>
                        <tr className="text-xs text-muted uppercase">
                          <th style={{ width: '10px' }}>ID</th>
                          <th>User Profile</th>
                          <th>Contact Info</th>
                          <th className="text-center">Balance</th>
                          <th>Registered</th>
                          <th className="text-right pr-4">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {usersList.map(u => (
                          <tr key={u.id} className="text-sm">
                            <td>
                              <span className="font-mono text-xs text-muted" title={`Internal UUID: ${u.id}\nGoogle UID: ${u.uid || 'N/A'}`} style={{ cursor: 'pointer' }}>
                                {u.user_id || 'N/A'}
                              </span>
                            </td>
                            <td>
                              <div className="d-flex align-items-center">
                                <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(u.name || 'Admin')}&background=007bff&color=fff&size=30`} className="img-circle mr-2" style={{ width: '30px', height: '30px', objectFit: 'cover' }} />
                                <span className="font-weight-bold">{u.name || 'Anonymous'}</span>
                              </div>
                            </td>
                            <td>
                              <div className="text-xs text-muted">{u.email}</div>
                              <div className="text-xs font-weight-bold">{u.phone_number || 'N/A'}</div>
                            </td>
                            <td className="text-center">
                              <span className="badge badge-success px-2 py-1">₹{parseFloat(u.balance || 0).toFixed(2)}</span>
                            </td>
                            <td className="text-muted text-xs">{new Date(u.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                            <td className="text-right pr-4">
                              <div className="btn-group">
                                <button className="btn btn-outline-primary btn-xs font-weight-bold px-3 rounded-pill mr-2" onClick={() => viewUserLedger(u)}>
                                  View Profile
                                </button>
                                <button className="btn btn-outline-danger btn-xs font-weight-bold px-3 rounded-pill" onClick={(e) => { e.stopPropagation(); handleDeleteUser(u.id); }}>
                                  <i className="fas fa-trash-alt mr-1"></i> Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {usersList.length === 0 && (
                          <tr>
                            <td colSpan={6} className="text-center text-muted p-4">No users matching search criteria.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {usersPages > 1 && (
                    <div className="card-footer bg-transparent border-0 d-flex justify-content-between align-items-center">
                      <span className="text-muted text-xs">Page <strong>{usersPage}</strong> of <strong>{usersPages}</strong> ({usersTotal} users)</span>
                      <div className="btn-group">
                        <button className="btn btn-outline-secondary btn-sm" disabled={usersPage === 1} onClick={() => setUsersPage(prev => Math.max(prev - 1, 1))}>Previous</button>
                        <button className="btn btn-outline-secondary btn-sm" disabled={usersPage === usersPages} onClick={() => setUsersPage(prev => Math.min(prev + 1, usersPages))}>Next</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: MANAGE OFFERS (offers.php, add_offer.php, edit_offer.php) */}
            {activeTab === 'offers' && (
              <div>
                {(!isCreatingOffer && !editingOffer) ? (
                  /* Main inventory view without duplicate card header titles */
                  <div className="card card-white shadow-none border rounded-lg">
                    <div className="card-body p-0 table-responsive">
                      <table className="table table-hover align-middle mb-0">
                        <thead>
                          <tr className="text-xs text-muted uppercase">
                            <th style={{ width: '50px' }} className="pl-4">Icon</th>
                            <th>Offer Title & Details</th>
                            <th className="text-center">Category</th>
                            <th className="text-center">Reward</th>
                            <th className="text-center">Status</th>
                            <th className="text-right pr-4">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {offersList.map(o => (
                            <tr key={o.id} className="text-sm">
                              <td className="pl-4">
                                {o.icon_url ? (
                                  <img src={o.icon_url} alt="" className="rounded shadow-sm" style={{ width: '40px', height: '40px', objectFit: 'cover' }} />
                                ) : (
                                  <div style={{ width: '40px', height: '40px' }} className="bg-light border rounded d-flex align-items-center justify-content-center">
                                    <i className="fas fa-gift text-muted"></i>
                                  </div>
                                )}
                              </td>
                              <td>
                                <div className="font-weight-bold">{o.title}</div>
                                <div className="text-xs text-muted text-truncate" style={{ maxWidth: '250px' }}>{o.description ? o.description.substring(0, 80) : ''}...</div>
                              </td>
                              <td className="text-center">
                                <span className="badge badge-info px-2 py-1">{o.category || 'General'}</span>
                              </td>
                              <td className="text-center">
                                <span className="font-weight-bold text-success">₹{parseFloat(o.total_reward || 0).toFixed(2)}</span>
                              </td>
                              <td className="text-center">
                                <span className={`badge badge-${o.is_active ? 'success' : 'secondary'} px-2 py-1 rounded-pill`}>
                                  {o.is_active ? 'Active' : 'Disabled'}
                                </span>
                              </td>
                              <td className="text-right pr-4">
                                <div className="btn-group shadow-sm">
                                  <button className="btn btn-default btn-sm" onClick={() => handleEditOfferClick(o)}>
                                    <i className="fas fa-edit text-primary"></i>
                                  </button>
                                  <button className="btn btn-default btn-sm" onClick={() => handleDeleteOffer(o.id)}>
                                    <i className="fas fa-trash text-danger"></i>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  /* Two-column create/edit form matching add_offer.php and edit_offer.php */
                  <form onSubmit={handleOfferSubmit}>
                    <div className="row">
                      <div className="col-md-8">
                        {/* Primary Info */}
                        <div className="card card-white shadow-none border rounded-lg">
                          <div className="card-body">
                            <div className="form-group mb-3">
                              <label className="text-sm font-weight-bold">Offer Primary Title</label>
                              <input 
                                type="text" 
                                className="form-control" 
                                placeholder="e.g. Install & Open Application" 
                                value={offerForm.title} 
                                onChange={e => setOfferForm({ ...offerForm, title: e.target.value })} 
                                required 
                              />
                            </div>
                            <div className="form-group mb-3">
                              <label className="text-sm font-weight-bold">Detailed Instruction</label>
                              <textarea 
                                className="form-control" 
                                rows={4} 
                                placeholder="Briefly describe what the user needs to do..." 
                                value={offerForm.description} 
                                onChange={e => setOfferForm({ ...offerForm, description: e.target.value })} 
                              />
                            </div>
                            <div className="row">
                              <div className="col-md-6 form-group mb-3">
                                <label className="text-sm font-weight-bold">Icon URL / Asset Link</label>
                                <input 
                                  type="text" 
                                  className="form-control" 
                                  placeholder="HTTPS direct link" 
                                  value={offerForm.icon_url} 
                                  onChange={e => setOfferForm({ ...offerForm, icon_url: e.target.value })} 
                                  required 
                              />
                              </div>
                              <div className="col-md-6 form-group mb-3">
                                <label className="text-sm font-weight-bold">Deep Link / Tracking URL</label>
                                <input 
                                  type="text" 
                                  className="form-control" 
                                  placeholder="Attribution or Affiliate link" 
                                  value={offerForm.tracking_url} 
                                  onChange={e => setOfferForm({ ...offerForm, tracking_url: e.target.value })} 
                                  required 
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Milestone Tiers */}
                        <div className="card card-white shadow-none border rounded-lg">
                          <div className="card-header border-bottom-0 d-flex justify-content-between align-items-center bg-transparent">
                            <h3 className="card-title font-weight-bold text-primary">Reward Milestone Tiers</h3>
                            <button type="button" className="btn btn-primary btn-sm rounded-pill font-weight-bold" onClick={addTierToForm}>+ Add Step</button>
                          </div>
                          <div className="card-body">
                            {offerForm.tiers.map((tier, idx) => (
                              <div key={idx} className="p-3 border rounded-lg mb-3 bg-light" style={{ position: 'relative' }}>
                                <button type="button" className="close text-danger" style={{ position: 'absolute', top: '10px', right: '15px' }} onClick={() => removeTierFromForm(idx)}>&times;</button>
                                <div className="row">
                                  <div className="col-md-5 form-group mb-2">
                                    <label className="text-xs text-muted font-weight-bold">Backend Event</label>
                                    <input 
                                      type="text" 
                                      className="form-control form-control-sm" 
                                      placeholder="e.g. registration_complete" 
                                      value={tier.backend_title} 
                                      onChange={e => updateTierField(idx, 'backend_title', e.target.value)} 
                                    />
                                  </div>
                                  <div className="col-md-4 form-group mb-2">
                                    <label className="text-xs text-muted font-weight-bold">App Title</label>
                                    <input 
                                      type="text" 
                                      className="form-control form-control-sm" 
                                      value={tier.title} 
                                      onChange={e => updateTierField(idx, 'title', e.target.value)} 
                                    />
                                  </div>
                                  <div className="col-md-3 form-group mb-2">
                                    <label className="text-xs text-muted font-weight-bold">Reward (₹)</label>
                                    <input 
                                      type="number" 
                                      step="0.01" 
                                      className="form-control form-control-sm font-weight-bold text-success" 
                                      value={tier.reward} 
                                      onChange={e => updateTierField(idx, 'reward', parseFloat(e.target.value || 0))} 
                                    />
                                  </div>
                                </div>
                                <div className="form-group mt-2 mb-0">
                                  <label className="text-xs text-muted font-weight-bold">Step Info (One per line)</label>
                                  <textarea 
                                    className="form-control form-control-sm" 
                                    rows={2} 
                                    placeholder="Tell users exactly what to do for this tier..." 
                                    value={Array.isArray(tier.steps) ? tier.steps.join('\n') : tier.steps} 
                                    onChange={e => updateTierField(idx, 'steps', e.target.value.split('\n'))} 
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="col-md-4">
                        {/* Economic Config */}
                        <div className="card card-white shadow-none border rounded-lg">
                          <div className="card-header border-bottom-0"><h3 className="card-title font-weight-bold text-dark">Economic Config</h3></div>
                          <div className="card-body">
                            <div className="form-group mb-3">
                              <label className="text-sm font-weight-bold">Total User Reward (₹)</label>
                              <input 
                                type="number" 
                                step="0.01" 
                                className="form-control font-weight-bold text-success" 
                                value={offerForm.total_reward} 
                                onChange={e => setOfferForm({ ...offerForm, total_reward: parseFloat(e.target.value || 0) })} 
                              />
                            </div>
                            <div className="form-group mb-3">
                              <label className="text-sm font-weight-bold">Internal Budget Price (₹)</label>
                              <input 
                                type="number" 
                                step="0.01" 
                                className="form-control" 
                                value={offerForm.actual_price} 
                                onChange={e => setOfferForm({ ...offerForm, actual_price: parseFloat(e.target.value || 0) })} 
                              />
                            </div>
                            <div className="form-group mb-3">
                              <label className="text-sm font-weight-bold">App Category</label>
                              <select 
                                className="form-control" 
                                value={offerForm.category} 
                                onChange={e => setOfferForm({ ...offerForm, category: e.target.value })}
                              >
                                <option value="Top Offers">Top Offers</option>
                                <option value="New Apps">New Apps</option>
                                <option value="Install & Earn">Install & Earn</option>
                                <option value="Surveys">Surveys</option>
                                <option value="General">General</option>
                              </select>
                            </div>
                            <div className="form-group mt-3">
                              <div className="custom-control custom-switch">
                                <input 
                                  type="checkbox" 
                                  className="custom-control-input" 
                                  id="is_active_form" 
                                  checked={offerForm.is_active} 
                                  onChange={e => setOfferForm({ ...offerForm, is_active: e.target.checked })} 
                                />
                                <label className="custom-control-label text-sm" htmlFor="is_active_form">Live Status (Active)</label>
                              </div>
                            </div>
                            <div className="form-group mt-2">
                              <div className="custom-control custom-switch">
                                <input 
                                  type="checkbox" 
                                  className="custom-control-input" 
                                  id="is_hot_form" 
                                  checked={offerForm.is_hot} 
                                  onChange={e => setOfferForm({ ...offerForm, is_hot: e.target.checked })} 
                                />
                                <label className="custom-control-label text-sm text-warning font-weight-bold" htmlFor="is_hot_form">Premium Hot Banner</label>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Validation Type */}
                        <div className="card card-white shadow-none border rounded-lg">
                          <div className="card-header border-bottom-0"><h3 className="card-title font-weight-bold text-dark">Validation Type</h3></div>
                          <div className="card-body">
                            <div className="form-group mb-3">
                              <label className="text-sm font-weight-bold">Integration Mode</label>
                              <select 
                                className="form-control" 
                                value={offerForm.type} 
                                onChange={e => setOfferForm({ ...offerForm, type: e.target.value })}
                              >
                                <option value="online">Server Postback</option>
                                <option value="offline">Manual Proof Review</option>
                              </select>
                            </div>
                            <div className="form-group mb-3">
                              <label className="text-sm font-weight-bold">Difficulty</label>
                              <select 
                                className="form-control" 
                                value={offerForm.difficulty} 
                                onChange={e => setOfferForm({ ...offerForm, difficulty: e.target.value })}
                              >
                                <option value="Easy">Easy</option>
                                <option value="Medium">Medium</option>
                                <option value="Hard">Hard</option>
                              </select>
                            </div>
                            <div className="form-group mb-3">
                              <label className="text-sm font-weight-bold">Estimated Completion</label>
                              <input 
                                type="text" 
                                className="form-control" 
                                placeholder="e.g. 5 Mins" 
                                value={offerForm.estimated_time} 
                                onChange={e => setOfferForm({ ...offerForm, estimated_time: e.target.value })} 
                              />
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <button type="submit" className="btn btn-primary btn-block elevation-2 font-weight-bold py-3 text-lg rounded-lg mb-3">
                          {editingOffer ? "SAVE UPDATES" : "PUBLISH OFFER"}
                        </button>
                        <button type="button" className="btn btn-outline-secondary btn-block rounded-lg py-2" onClick={() => { resetOfferForm(); setIsCreatingOffer(false); }}>
                          Cancel & Return
                        </button>
                      </div>
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* TAB 4: VISIT & EARN */}
            {activeTab === 'visit-earn' && (
              <div className="row">
                <div className="col-lg-8">
                  <div className="card card-white shadow-none border rounded-lg">
                    <div className="card-header border-0 bg-transparent">
                      <h3 className="card-title font-weight-bold">Configure Visit & Earn</h3>
                    </div>
                    <div className="card-body table-responsive p-0">
                      <table className="table table-hover text-nowrap align-middle">
                        <thead>
                          <tr className="text-xs text-muted uppercase">
                            <th>Task Title</th>
                            <th className="text-center">Reward</th>
                            <th>Target URL</th>
                            <th className="text-center">Timer</th>
                            <th className="text-center">Ad Status</th>
                            <th className="text-center">State</th>
                            <th className="text-right pr-4">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visitTasksList.map(task => (
                            <tr key={task.id}>
                              <td><strong>{task.title}</strong></td>
                              <td className="text-center"><span className="badge badge-success px-2">₹{task.coins}</span></td>
                              <td><a href={task.visit_url} target="_blank" rel="noreferrer" className="text-indigo text-xs text-break">{task.visit_url}</a></td>
                              <td className="text-center">{task.timer_seconds}s</td>
                              <td className="text-center">
                                <span className={`badge badge-${task.is_ad ? 'warning' : 'secondary'} px-2`}>{task.is_ad ? 'Ad Required' : 'No Ad'}</span>
                              </td>
                              <td className="text-center">
                                <span className={`badge badge-${task.is_active ? 'success' : 'secondary'} px-2`}>{task.is_active ? 'Live' : 'Paused'}</span>
                              </td>
                              <td className="text-right pr-4">
                                <button className="btn btn-outline-primary btn-xs font-weight-bold mr-2 px-3 rounded-pill" onClick={() => handleEditVisitTaskClick(task)}>Edit</button>
                                <button className="btn btn-outline-danger btn-xs font-weight-bold px-3 rounded-pill" onClick={() => handleDeleteVisitTask(task.id)}>Delete</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <div className="col-lg-4">
                  <div className="card card-white shadow-none border rounded-lg">
                    <div className="card-header border-bottom-0 bg-transparent">
                      <h3 className="card-title font-weight-bold">{editingVisitTask ? "✏️ Edit Task" : "＋ Create Task"}</h3>
                      {editingVisitTask && <button className="close" onClick={resetVisitTaskForm}>&times;</button>}
                    </div>
                    <div className="card-body">
                      <form onSubmit={handleVisitTaskSubmit}>
                        <div className="form-group mb-3">
                          <label className="text-muted text-xs font-weight-bold mb-1">Task Title</label>
                          <input type="text" className="form-control" placeholder="e.g. Visit Blog" value={visitTaskForm.title} onChange={e => setVisitTaskForm({ ...visitTaskForm, title: e.target.value })} required />
                        </div>
                        <div className="form-group mb-3">
                          <label className="text-muted text-xs font-weight-bold mb-1">Visit URL</label>
                          <input type="url" className="form-control" placeholder="https://example.com" value={visitTaskForm.visit_url} onChange={e => setVisitTaskForm({ ...visitTaskForm, visit_url: e.target.value })} required />
                        </div>
                        <div className="row">
                          <div className="col-6 form-group mb-3">
                            <label className="text-muted text-xs font-weight-bold mb-1">Coins Reward</label>
                            <input type="number" className="form-control" value={visitTaskForm.coins} onChange={e => setVisitTaskForm({ ...visitTaskForm, coins: parseInt(e.target.value || 0) })} required />
                          </div>
                          <div className="col-6 form-group mb-3">
                            <label className="text-muted text-xs font-weight-bold mb-1">Timer (seconds)</label>
                            <input type="number" className="form-control" value={visitTaskForm.timer_seconds} onChange={e => setVisitTaskForm({ ...visitTaskForm, timer_seconds: parseInt(e.target.value || 30) })} required />
                          </div>
                        </div>
                        <div className="form-group mb-3">
                          <label className="text-muted text-xs font-weight-bold mb-1">Ad Intercept Trigger</label>
                          <select className="form-control" value={visitTaskForm.is_ad ? 'yes' : 'no'} onChange={e => setVisitTaskForm({ ...visitTaskForm, is_ad: e.target.value === 'yes' })}>
                            <option value="no">No - Direct Visit</option>
                            <option value="yes">Yes - Interstitial Ad first</option>
                          </select>
                        </div>
                        <div className="custom-control custom-switch mb-3">
                          <input type="checkbox" className="custom-control-input" id="isTaskActive" checked={visitTaskForm.is_active} onChange={e => setVisitTaskForm({ ...visitTaskForm, is_active: e.target.checked })} />
                          <label className="custom-control-label text-xs uppercase" htmlFor="isTaskActive">Task is Live</label>
                        </div>
                        <button type="submit" className="btn btn-primary btn-block rounded-pill">Publish task</button>
                      </form>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: WITHDRAWAL QUEUE (withdrawals.php) */}
            {activeTab === 'withdrawals' && (
              <div>
                {/* Info Boxes */}
                <div className="row">
                  <div className="col-md-3 col-6">
                    <div className="info-box shadow-none border">
                      <span className="info-box-icon bg-light"><i className="fas fa-hourglass-half text-warning"></i></span>
                      <div className="info-box-content">
                        <span className="text-xs font-weight-bold text-secondary uppercase">Filtered Pending</span>
                        <span className="info-box-number text-lg font-weight-black">₹{stats.pending_withdrawals_value.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-3 col-6">
                    <div className="info-box shadow-none border">
                      <span className="info-box-icon bg-light"><i className="fas fa-check-circle text-success"></i></span>
                      <div className="info-box-content">
                        <span className="text-xs font-weight-bold text-secondary uppercase">Filtered Settled</span>
                        <span className="info-box-number text-lg font-weight-black">₹{stats.settled_payouts_value.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-3 col-6">
                    <div className="info-box shadow-none border">
                      <span className="info-box-icon bg-light"><i className="fas fa-times-circle text-danger"></i></span>
                      <div className="info-box-content">
                        <span className="text-xs font-weight-bold text-secondary uppercase">Filtered Rejected</span>
                        <span className="info-box-number text-lg font-weight-black">₹0.00</span>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-3 col-6">
                    <div className="info-box shadow-none border bg-light">
                      <span className="info-box-icon border bg-white"><i className="fas fa-calculator text-primary"></i></span>
                      <div className="info-box-content">
                        <span className="text-xs font-weight-bold text-secondary uppercase">Total Net</span>
                        <span className="info-box-number text-lg font-weight-black">₹{(stats.pending_withdrawals_value + stats.settled_payouts_value).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Main Queue Card */}
                <div className="card card-warning card-outline shadow-none border rounded-lg mb-4 mt-3">
                  <div className="card-header border-0 bg-transparent pb-0">
                    <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center">
                      <h3 className="card-title font-weight-bold text-warning mb-3 mb-md-0"><i className="fas fa-clock mr-2"></i>Awaiting Disbursements</h3>
                      <div className="d-flex flex-wrap align-items-center" style={{ gap: '10px' }}>
                        <input
                          type="text"
                          className="form-control form-control-sm rounded-pill px-3"
                          placeholder="Search beneficiary, method, details..."
                          style={{ width: '220px' }}
                          value={withdrawalSearch}
                          onChange={e => setWithdrawalSearch(e.target.value)}
                        />
                        <div className="btn-group">
                          <button className={`btn btn-xs ${withdrawalStatus === 'PENDING' ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => { setWithdrawalStatus('PENDING'); setWithdrawalPage(1); }}>Pending</button>
                          <button className={`btn btn-xs ${withdrawalStatus === 'APPROVED' ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => { setWithdrawalStatus('APPROVED'); setWithdrawalPage(1); }}>Approved</button>
                          <button className={`btn btn-xs ${withdrawalStatus === 'REJECTED' ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => { setWithdrawalStatus('REJECTED'); setWithdrawalPage(1); }}>Rejected</button>
                          <button className={`btn btn-xs ${withdrawalStatus === 'ALL' ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => { setWithdrawalStatus('ALL'); setWithdrawalPage(1); }}>All</button>
                        </div>
                        <button className="btn btn-sm btn-outline-secondary rounded-pill" onClick={fetchWithdrawals}><i className="fas fa-sync-alt"></i></button>
                      </div>
                    </div>
                  </div>
                  <div className="card-body p-0 table-responsive">
                    <table className="table table-hover align-middle mb-0">
                      <thead className="bg-light">
                        <tr className="text-xs text-muted uppercase">
                          <th className="pl-4">Beneficiary</th>
                          <th className="text-center">Coins</th>
                          <th className="text-center">Net Amount</th>
                          <th>Payment Method</th>
                          <th className="text-center">Queued Date</th>
                          <th className="text-right pr-4">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {withdrawalsList.map(w => (
                          <tr key={w.id} className="text-sm">
                            <td className="pl-4">
                              <div className="font-weight-bold text-dark">{w.user_name}</div>
                              <div className="text-xs text-muted">{w.user_email}</div>
                            </td>
                            <td className="text-center">
                              <div className="badge badge-light border font-weight-bold p-2">{parseFloat(w.amount_coins || w.amount).toFixed(0)} <span className="text-xs font-normal">Coins</span></div>
                            </td>
                            <td className="text-center">
                              <h5 className="mb-0 font-weight-bold text-primary">₹{parseFloat(w.amount_currency || (w.amount * 0.01)).toFixed(2)}</h5>
                            </td>
                            <td>
                              <div className="font-weight-bold">
                                {w.method}
                                {w.requires_redeem_code === 1 || w.requires_redeem_code === true ? (
                                  <span className="badge badge-success ml-2 text-xs" style={{ fontSize: '0.65rem' }}>VOUCHER</span>
                                ) : null}
                              </div>
                              <code className="text-xs text-danger">{w.details}</code>
                              {w.redeem_code && (
                                <div className="text-xs text-success font-weight-bold mt-1">
                                  <i className="fas fa-key mr-1"></i> Code: <code>{w.redeem_code}</code>
                                </div>
                              )}
                            </td>
                            <td className="text-center text-xs text-info">
                              <i className="far fa-calendar-alt mr-1"></i> {new Date(w.created_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="text-right pr-4">
                              {w.status === 'PENDING' ? (
                                <div className="btn-group shadow-sm">
                                  <button className="btn btn-success btn-xs px-3 font-weight-bold py-1" onClick={() => handleApproveWithdrawal(w)}>Approve</button>
                                  <button className="btn btn-danger btn-xs px-3 font-weight-bold py-1" onClick={() => triggerRejectWithdrawal(w)}>Reject</button>
                                </div>
                              ) : <span className="text-xs text-muted">{w.status}</span>}
                            </td>
                          </tr>
                        ))}
                        {withdrawalsList.length === 0 && (
                          <tr>
                            <td colSpan={6} className="text-center text-muted p-4">No payout requests found in queue.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="card-footer clearfix bg-white border-top-0 d-flex justify-content-between align-items-center">
                    <span className="text-xs text-muted">Showing {withdrawalsList.length} of {withdrawalTotal} entries</span>
                    {withdrawalTotal > withdrawalLimit && (
                      <ul className="pagination pagination-sm m-0 float-right">
                        <li className={`page-item ${withdrawalPage === 1 ? 'disabled' : ''}`}>
                          <button className="page-link" onClick={() => setWithdrawalPage(prev => Math.max(1, prev - 1))}>«</button>
                        </li>
                        {Array.from({ length: Math.ceil(withdrawalTotal / withdrawalLimit) }, (_, i) => i + 1).map(p => (
                          <li key={p} className={`page-item ${withdrawalPage === p ? 'active' : ''}`}>
                            <button className="page-link" onClick={() => setWithdrawalPage(p)}>{p}</button>
                          </li>
                        ))}
                        <li className={`page-item ${withdrawalPage === Math.ceil(withdrawalTotal / withdrawalLimit) ? 'disabled' : ''}`}>
                          <button className="page-link" onClick={() => setWithdrawalPage(prev => Math.min(Math.ceil(withdrawalTotal / withdrawalLimit), prev + 1))}>»</button>
                        </li>
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 14: PROOF GALLERY (reports.php) */}
            {activeTab === 'proofs' && (
              <div className="card card-white shadow-none border rounded-lg">
                <div className="card-header border-0 bg-transparent d-flex justify-content-between align-items-center">
                  <div>
                    <h3 className="card-title font-weight-bold">Proofs Auditing Gallery</h3>
                  </div>
                  <button className="btn btn-sm btn-outline-secondary rounded-pill" onClick={fetchProofs}><i className="fas fa-sync-alt mr-1"></i> Refresh Queue</button>
                </div>
                <div className="card-body table-responsive p-0">
                  <table className="table table-hover align-middle mb-0">
                    <thead>
                      <tr className="text-xs text-muted uppercase">
                        <th>Candidate</th>
                        <th>Target Campaign</th>
                        <th>Evidence / Inputs</th>
                        <th>Compensation</th>
                        <th>Submitted On</th>
                        <th className="text-right pr-4">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {proofsList.map(p => {
                        let inputs = [];
                        if (p.user_input) {
                          try { inputs = typeof p.user_input === 'string' ? JSON.parse(p.user_input) : p.user_input; }
                          catch(e) {}
                        }
                        return (
                          <tr key={p.id} className="text-sm">
                            <td><strong>{p.user_name || 'Anonymous'}</strong><br /><span className="text-xs text-muted">ID: {p.user_public_id}</span></td>
                            <td><strong>{p.offer_title}</strong></td>
                            <td>
                              <div style={{ maxWidth: '320px', whiteSpace: 'normal' }}>
                                {Array.isArray(inputs) ? inputs.map((inp, idx) => {
                                  if (inp.type === 'file') {
                                    const fileUrl = inp.value.startsWith('http') ? inp.value : `${API_BASE}${inp.value}`;
                                    return (
                                      <div key={idx} className="mt-1">
                                        <a href={fileUrl} target="_blank" rel="noreferrer" className="btn btn-xs btn-outline-info rounded-pill px-2"><i className="fas fa-image mr-1"></i> View Screen</a>
                                      </div>
                                    );
                                  }
                                  return (
                                    <div key={idx} className="text-xs">
                                      <span className="text-muted font-weight-bold">{inp.label}:</span> <code>{inp.value}</code>
                                    </div>
                                  );
                                }) : <code>{p.user_input}</code>}
                              </div>
                            </td>
                            <td><strong className="text-success">₹{parseFloat(p.offer_reward || 0).toFixed(2)}</strong></td>
                            <td className="text-sm">{new Date(p.last_updated).toLocaleString()}</td>
                            <td className="text-right pr-4">
                              <div className="btn-group">
                                <button className="btn btn-xs btn-success rounded-pill px-3 mr-2" onClick={() => handleApproveProof(p.click_id)}>Pass</button>
                                <button className="btn btn-xs btn-danger rounded-pill px-3" onClick={() => triggerRejectProof(p.click_id)}>Fail</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {proofsList.length === 0 && (
                        <tr>
                          <td colSpan={6} className="text-center text-muted p-4">No pending campaign proofs to audit.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 5: DELETION REQUESTS (deletion_requests.php) */}
            {activeTab === 'erasures' && (
              <div className="card card-white shadow-none border rounded-lg">
                <div className="card-header border-0 bg-transparent">
                  <h3 className="card-title font-weight-bold">gdpr deletion requests</h3>
                </div>
                <div className="card-body table-responsive p-0">
                  <table className="table table-hover align-middle mb-0">
                    <thead>
                      <tr className="text-xs text-muted uppercase">
                        <th>Email</th>
                        <th>User Reason</th>
                        <th>Submitted On</th>
                        <th>Request Status</th>
                        <th className="text-right pr-4">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {erasuresList.map(e => (
                        <tr key={e.id} className="text-sm">
                          <td><strong>{e.email}</strong></td>
                          <td style={{ whiteSpace: 'normal', maxWidth: '300px' }}>{e.reason || 'None provided.'}</td>
                          <td className="text-sm">{new Date(e.created_at).toLocaleString()}</td>
                          <td><span className={`badge badge-${e.status === 'PENDING' ? 'warning' : 'success'} px-2`}>{e.status}</span></td>
                          <td className="text-right pr-4">
                            {e.status === 'PENDING' ? (
                              <div className="btn-group">
                                <button className="btn btn-xs btn-danger rounded-pill px-3 mr-2" onClick={() => handleApproveErasure(e.id)}>Purge DB</button>
                                <button className="btn btn-xs btn-outline-secondary rounded-pill px-3" onClick={() => handleRejectErasure(e.id)}>Dismiss</button>
                              </div>
                            ) : <span className="text-xs text-muted">Cleared</span>}
                          </td>
                        </tr>
                      ))}
                      {erasuresList.length === 0 && (
                        <tr>
                          <td colSpan={5} className="text-center text-muted p-4">No deletion logs found.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 6: PUSH NOTIFICATIONS */}
            {activeTab === 'push' && (
              <div className="card card-white shadow-none border rounded-lg">
                <div className="card-body">
                  <AdminNotifications getHeaders={getHeaders} showNotice={showNotice} API_BASE={API_BASE} />
                </div>
              </div>
            )}

            {/* TAB 7: SYSTEM CONFIG */}
            {activeTab === 'configs' && (
              <div className="card card-white shadow-none border rounded-lg">
                <div className="card-body">
                  <AdminConfigs getHeaders={getHeaders} showNotice={showNotice} API_BASE={API_BASE} />
                </div>
              </div>
            )}

            {/* TAB 8: APP BANNERS */}
            {activeTab === 'banners' && (
              <div className="card card-white shadow-none border rounded-lg">
                <div className="card-body">
                  <AdminBanners getHeaders={getHeaders} showNotice={showNotice} API_BASE={API_BASE} />
                </div>
              </div>
            )}

            {/* TAB 9: PAYOUT METHODS */}
            {activeTab === 'payouts' && (
              <div className="card card-white shadow-none border rounded-lg">
                <div className="card-body">
                  <AdminPayouts getHeaders={getHeaders} showNotice={showNotice} API_BASE={API_BASE} />
                </div>
              </div>
            )}

            {/* TAB 10: REFERRAL CONFIG */}
            {activeTab === 'referrals' && (
              <div className="card card-white shadow-none border rounded-lg">
                <div className="card-body">
                  <AdminReferrals getHeaders={getHeaders} showNotice={showNotice} API_BASE={API_BASE} />
                </div>
              </div>
            )}

            {/* TAB 11: LIFAFA (REDEEM) */}
            {activeTab === 'lifafas' && (
              <div className="card card-white shadow-none border rounded-lg">
                <div className="card-body">
                  <AdminLifafas getHeaders={getHeaders} showNotice={showNotice} API_BASE={API_BASE} />
                </div>
              </div>
            )}

            {/* TAB 11.5: OTHER APPS PROMOTION */}
            {activeTab === 'other_apps' && (
              <div className="card card-white shadow-none border rounded-lg">
                <div className="card-body">
                  <AdminOtherApps getHeaders={getHeaders} showNotice={showNotice} API_BASE={API_BASE} />
                </div>
              </div>
            )}

            {/* TAB 12: SUPPORT TICKETS */}
            {activeTab === 'tickets' && (
              <div className="card card-white shadow-none border rounded-lg">
                <div className="card-body">
                  <AdminTickets getHeaders={getHeaders} showNotice={showNotice} API_BASE={API_BASE} />
                </div>
              </div>
            )}

            {/* TAB 13: BUSINESS STATS */}
            {activeTab === 'reports' && (
              <div className="card card-white shadow-none border rounded-lg">
                <div className="card-body">
                  <AdminReports getHeaders={getHeaders} showNotice={showNotice} API_BASE={API_BASE} />
                </div>
              </div>
            )}

            {/* TAB 15: GLOBAL TRANSACTIONS AUDIT */}
            {activeTab === 'transactions' && (
              <div className="card card-white shadow-none border rounded-lg">
                <div className="card-header border-0 bg-transparent pb-0">
                  <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center">
                    <h3 className="card-title font-weight-bold mb-3 mb-md-0"><i className="fas fa-history mr-2 text-indigo"></i>Global Ledger & User Transactions</h3>
                    <div className="d-flex flex-wrap align-items-center" style={{ gap: '10px' }}>
                      <input
                        type="text"
                        className="form-control form-control-sm rounded-pill px-3"
                        placeholder="Search name, email, description..."
                        style={{ width: '220px' }}
                        value={globalTransactionsSearch}
                        onChange={e => setGlobalTransactionsSearch(e.target.value)}
                      />
                      <select
                        className="form-control form-control-sm rounded-pill"
                        style={{ width: '130px' }}
                        value={globalTransactionsType}
                        onChange={e => { setGlobalTransactionsType(e.target.value); setGlobalTransactionsPage(1); }}
                      >
                        <option value="ALL">All Types</option>
                        <option value="CREDIT">Credits (+)</option>
                        <option value="DEBIT">Debits (-)</option>
                      </select>
                      <select
                        className="form-control form-control-sm rounded-pill"
                        style={{ width: '160px' }}
                        value={globalTransactionsSource}
                        onChange={e => { setGlobalTransactionsSource(e.target.value); setGlobalTransactionsPage(1); }}
                      >
                        <option value="ALL">All Sources</option>
                        <option value="OFFER">Offers</option>
                        <option value="DAILY_BONUS">Daily Checkin</option>
                        <option value="STREAK_REWARD">Streak Reward</option>
                        <option value="LUCKY_SPIN">Lucky Spin</option>
                        <option value="SCRATCH_CARD">Scratch Card</option>
                        <option value="WATCH_VIDEO">Video Ads</option>
                        <option value="REFERRAL">Referrals</option>
                        <option value="REFERRAL_BONUS">Referral Bonus</option>
                        <option value="COMMISSION">Commission</option>
                        <option value="LIFAFA_BONUS">Lifafa</option>
                        <option value="WITHDRAWAL">Withdrawals</option>
                        <option value="MANUAL_ADJUSTMENT">Admin Manual</option>
                      </select>
                      <button className="btn btn-sm btn-outline-secondary rounded-pill" onClick={fetchGlobalTransactions}><i className="fas fa-sync-alt"></i></button>
                    </div>
                  </div>
                </div>
                <div className="card-body p-0 table-responsive mt-3">
                  <table className="table table-hover align-middle mb-0">
                    <thead className="bg-light">
                      <tr className="text-xs text-muted uppercase">
                        <th className="pl-4">User Details</th>
                        <th>Type</th>
                        <th>Source</th>
                        <th>Amount (Coins)</th>
                        <th>Description</th>
                        <th>Date & Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {globalTransactionsList.map(t => (
                        <tr key={t.id} className="text-sm">
                          <td className="pl-4">
                            <strong>{t.user_name || 'N/A'}</strong><br />
                            <span className="text-xs text-muted">{t.user_email || 'N/A'}</span>
                          </td>
                          <td>
                            <span className={`badge badge-${t.type === 'CREDIT' ? 'success' : 'danger'} px-2 py-1 rounded-pill`}>
                              {t.type}
                            </span>
                          </td>
                          <td>
                            <span className="badge badge-light border px-2 py-1">{t.source}</span>
                          </td>
                          <td>
                            <strong className={t.type === 'CREDIT' ? 'text-success' : 'text-danger'}>
                              {t.type === 'CREDIT' ? '+' : '-'}{parseFloat(t.amount).toFixed(0)} Coins
                            </strong>
                          </td>
                          <td style={{ whiteSpace: 'normal', maxWidth: '300px' }}>
                            {t.description || '-'}
                          </td>
                          <td className="text-xs text-muted">
                            {new Date(t.created_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </td>
                        </tr>
                      ))}
                      {globalTransactionsList.length === 0 && (
                        <tr>
                          <td colSpan={6} className="text-center text-muted p-4">No matching ledger transactions found.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {/* Pagination Controls */}
                {globalTransactionsPages > 1 && (
                  <div className="card-footer bg-transparent d-flex justify-content-between align-items-center border-top">
                    <span className="text-xs text-muted">Showing {globalTransactionsList.length} of {globalTransactionsTotal} entries</span>
                    <div className="btn-group">
                      <button
                        className="btn btn-sm btn-outline-secondary"
                        disabled={globalTransactionsPage === 1}
                        onClick={() => setGlobalTransactionsPage(p => Math.max(1, p - 1))}
                      >
                        Previous
                      </button>
                      <span className="btn btn-sm btn-light disabled font-weight-bold">
                        Page {globalTransactionsPage} of {globalTransactionsPages}
                      </span>
                      <button
                        className="btn btn-sm btn-outline-secondary"
                        disabled={globalTransactionsPage === globalTransactionsPages}
                        onClick={() => setGlobalTransactionsPage(p => Math.min(globalTransactionsPages, p + 1))}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 16: CONTESTS MANAGEMENT */}
            {activeTab === 'contests' && (
              <div className="card card-white shadow-none border rounded-lg">
                <div className="card-body">
                  <AdminContests getHeaders={getHeaders} showNotice={showNotice} API_BASE={API_BASE} />
                </div>
              </div>
            )}

          </div>
        </section>
      </div>

      {/* FOOTER */}
      <footer className="main-footer bg-white border-top-0 text-sm py-3 text-center text-md-left">
        <strong>Copyright &copy; 2026 Rewardverse Admin.</strong> All rights reserved.
      </footer>

      {/* User Detail Statistics Modal (Matching users.php Modal style exactly) */}
      {selectedUser && (
        <div className="modal fade show" style={{ display: 'block', background: 'rgba(0,0,0,0.5)', zIndex: 10000 }} role="dialog">
          <div className="modal-dialog modal-dialog-centered modal-lg" role="document">
            <div className="modal-content rounded-lg border-0 shadow" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
              <div className="modal-header border-bottom-0 pb-0">
                <h5 className="modal-title font-weight-bold">Detailed User Statistics</h5>
                <button type="button" className="close" onClick={() => setSelectedUser(null)}>&times;</button>
              </div>
              <div className="modal-body pt-4">
                <div className="row">
                  {/* Left info box */}
                  <div className="col-md-4 text-center mb-4">
                    <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(selectedUser.name || 'Admin')}&background=007bff&color=fff&size=128`} className="img-circle elevation-2 shadow mb-3" style={{ width: '120px', height: '120px', objectFit: 'cover' }} />
                    <h4 className="font-weight-black">{selectedUser.name || 'Anonymous'}</h4>
                    <p className="text-muted text-sm badge badge-light border">{selectedUser.email}</p>
                    
                    <div className="mt-4 d-flex flex-column">
                      <button className="btn btn-outline-primary btn-sm rounded-pill font-weight-bold py-2 mb-2" onClick={() => triggerEditUser(selectedUser)}>
                        <i className="fas fa-edit mr-1"></i> Edit Profile Details
                      </button>
                      <button className="btn btn-danger btn-sm rounded-pill font-weight-bold py-2 mb-2 shadow-sm text-white" onClick={() => handleDeleteUser(selectedUser.id)}>
                        <i className="fas fa-trash mr-1"></i> Delete User Row
                      </button>
                      {selectedUser.is_banned ? (
                        <button className="btn btn-success btn-sm rounded-pill font-weight-bold py-2 mb-2" onClick={() => handleUnbanUser(selectedUser.id)}>
                          <i className="fas fa-check-circle mr-1"></i> Unban Member
                        </button>
                      ) : (
                        <button className="btn btn-danger btn-sm rounded-pill font-weight-bold py-2 mb-2" onClick={() => handleBanUser(selectedUser.id)}>
                          <i className="fas fa-ban mr-1"></i> Ban Member Row
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {/* Right stats */}
                  <div className="col-md-8">
                    <div className="row bg-light rounded p-3 border mb-3">
                      <div className="col-md-6 mb-3">
                        <label className="text-muted text-xs uppercase mb-1">Available Balance</label>
                        <h4 className="text-success font-weight-black mb-0">₹{parseFloat(selectedUser.balance || 0).toFixed(2)}</h4>
                      </div>
                      <div className="col-md-6 mb-3">
                        <label className="text-muted text-xs uppercase mb-1">Public Hex ID</label>
                        <h5 className="text-dark font-weight-bold mb-0 font-mono">{selectedUser.user_id || 'N/A'}</h5>
                      </div>
                      
                      <div className="col-md-6 mb-3">
                        <label className="text-muted text-xs uppercase mb-1">Phone Number</label>
                        <h5 className="text-dark font-weight-bold mb-0">{selectedUser.phone_number || 'N/A'}</h5>
                      </div>
                      <div className="col-md-6 mb-3">
                        <label className="text-muted text-xs uppercase mb-1">Location</label>
                        <h5 className="text-dark font-weight-bold mb-0">{selectedUser.location || 'N/A'}</h5>
                      </div>

                      <div className="col-md-6 mb-3">
                        <label className="text-muted text-xs uppercase mb-1">Referral Code</label>
                        <h5 className="text-indigo font-weight-bold mb-0 font-mono">{selectedUser.referral_code || 'None'}</h5>
                      </div>
                      <div className="col-md-6 mb-3">
                        <label className="text-muted text-xs uppercase mb-1">Users Referred</label>
                        <h5 className="text-dark font-weight-bold mb-0">{selectedUser.referral_count || 0} Members</h5>
                      </div>

                      <div className="col-md-6 mb-3">
                        <label className="text-muted text-xs uppercase mb-1">Check-in Streak</label>
                        <h5 className="text-warning font-weight-bold mb-0"><i className="fas fa-fire mr-1"></i> {selectedUser.current_streak || 0} Days</h5>
                      </div>
                      <div className="col-md-6 mb-3">
                        <label className="text-muted text-xs uppercase mb-1">Spins Claimed Today</label>
                        <h5 className="text-primary font-weight-bold mb-0"><i className="fas fa-redo mr-1"></i> {selectedUser.daily_spins_count || 0} Spins</h5>
                      </div>

                      <div className="col-md-6 mb-3">
                        <label className="text-muted text-xs uppercase mb-1">Referred By User ID</label>
                        <h5 className="text-secondary font-weight-bold mb-0 font-mono">{selectedUser.referred_by || 'Organic'}</h5>
                      </div>
                      <div className="col-md-6 mb-3">
                        <label className="text-muted text-xs uppercase mb-1">Google UID</label>
                        <code className="text-xs text-muted text-break">{selectedUser.uid || 'N/A'}</code>
                      </div>
                      
                      <div className="col-md-12 mb-0">
                        <label className="text-muted text-xs uppercase mb-1">Internal Database UUID</label>
                        <code className="text-xs text-muted text-break">{selectedUser.id}</code>
                      </div>
                    </div>

                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <h6 className="font-weight-bold mb-0"><i className="fas fa-sliders-h text-primary mr-1"></i> Adjust User Balance</h6>
                      <button className="btn btn-xs btn-primary px-3 rounded-pill" onClick={() => setAdjustBalanceModal(true)}>Trigger adjustment</button>
                    </div>

                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <h6 className="font-weight-bold mb-0"><i className="fas fa-microchip text-warning mr-1"></i> Device & Compliance Metadata</h6>
                      <div>
                        <button 
                          className="btn btn-xs btn-outline-primary px-3 rounded-pill mr-2" 
                          onClick={() => triggerEditFingerprint(selectedUser)}
                        >
                          <i className="fas fa-edit mr-1"></i> Edit Fingerprint
                        </button>
                        <button 
                          className="btn btn-xs btn-danger px-3 rounded-pill" 
                          onClick={handleDeleteFingerprints}
                          disabled={isDeletingFingerprints}
                        >
                          <i className="fas fa-trash-alt mr-1"></i> {isDeletingFingerprints ? 'Clearing...' : 'Clear Device Fingerprints'}
                        </button>
                      </div>
                    </div>
                    <div className="p-3 bg-light rounded-lg border mb-4">
                      <div className="row">
                        <div className="col-md-6 mb-2">
                          <span className="text-xs text-muted font-weight-bold">Android Device Identifier:</span><br />
                          <code className="text-xs text-danger text-break">{selectedUser.android_id || 'REDACTED'}</code>
                        </div>
                        <div className="col-md-6 mb-2">
                          <span className="text-xs text-muted font-weight-bold">Device Model:</span><br />
                          <strong className="text-sm text-dark">{selectedUser.device_fingerprint?.device_model || 'N/A'}</strong>
                        </div>
                        <div className="col-md-6 mb-2">
                          <span className="text-xs text-muted font-weight-bold">OS Version:</span><br />
                          <strong className="text-sm text-dark">{selectedUser.device_fingerprint?.os_version || 'N/A'}</strong>
                        </div>
                        <div className="col-md-6 mb-2">
                          <span className="text-xs text-muted font-weight-bold">App Client Version:</span><br />
                          <strong className="text-sm text-dark">{selectedUser.device_fingerprint?.app_version || 'N/A'}</strong>
                        </div>
                        <div className="col-md-6 mb-2">
                          <span className="text-xs text-muted font-weight-bold">Last Known IP Address:</span><br />
                          <code className="text-xs text-primary font-mono">{selectedUser.device_fingerprint?.ip_address || 'N/A'}</code>
                        </div>
                        <div className="col-md-6 mb-2">
                          <span className="text-xs text-muted font-weight-bold">Environment Type:</span><br />
                          <span className={`badge badge-${selectedUser.device_fingerprint?.is_emulator ? 'danger' : 'success'}`}>
                            {selectedUser.device_fingerprint?.is_emulator ? '🚫 Emulator Detected' : '📱 Physical Device'}
                          </span>
                        </div>
                        <div className="col-md-12 mb-2">
                          <span className="text-xs text-muted font-weight-bold">FCM Push Token:</span><br />
                          <code className="text-xs text-dark text-break" style={{ maxHeight: '60px', display: 'block', overflowY: 'auto' }}>{selectedUser.fcm_token || 'N/A'}</code>
                        </div>
                        <div className="col-md-12 mt-1">
                          {selectedUser.is_banned ? (
                            <div className="mb-0">
                              <span className="text-xs text-danger font-weight-bold">Compliance Status: Banned Member</span><br />
                              <span className="text-xs text-muted font-weight-bold">Reason: </span>
                              <span className="text-xs text-danger italic">{selectedUser.ban_reason || 'No violation log provided.'}</span>
                            </div>
                          ) : (
                            <div className="mb-0">
                              <span className="text-xs text-success font-weight-bold">Compliance Status: Active / Good Standing</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <h6 className="font-weight-bold mb-3"><i className="fas fa-history mr-2 text-primary"></i> Ledger History</h6>
                    <div style={{ maxHeight: '200px', overflowY: 'auto' }} className="pr-1">
                      {userTransactions.map(t => (
                        <div key={t.id} className="p-2 border rounded mb-2 bg-light d-flex justify-content-between align-items-center text-sm">
                          <div>
                            <p className="font-weight-bold mb-0 text-dark">{t.description || t.source}</p>
                            <span className="text-xs text-muted">{new Date(t.created_at).toLocaleDateString()}</span>
                          </div>
                          <strong className={t.type === 'CREDIT' ? "text-success" : "text-danger"}>
                            {t.type === 'CREDIT' ? '+' : '-'}{parseFloat(t.amount).toFixed(2)}
                          </strong>
                        </div>
                      ))}
                      {userTransactions.length === 0 && (
                        <p className="text-muted text-xs text-center p-3">No ledger records.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer border-0">
                <button type="button" className="btn btn-secondary btn-sm px-4 rounded-pill" onClick={() => setSelectedUser(null)}>Close Window</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Adjust User Balance Modal */}
      {adjustBalanceModal && selectedUser && (
        <div className="modal fade show" style={{ display: 'block', background: 'rgba(0,0,0,0.5)', zIndex: 10001 }} role="dialog">
          <div className="modal-dialog modal-dialog-centered" role="document">
            <div className="modal-content rounded-lg border-0 shadow">
              <div className="modal-header border-bottom-0">
                <h5 className="modal-title font-weight-bold">Adjust Wallet Balance</h5>
                <button type="button" className="close" onClick={() => setAdjustBalanceModal(false)}>&times;</button>
              </div>
              <div className="modal-body pt-0">
                <p className="text-secondary text-xs">Modifying coins balance for: <strong>{selectedUser.name}</strong></p>
                <form onSubmit={handleAdjustBalance}>
                  <div className="btn-group btn-group-toggle w-100 mb-3" data-toggle="buttons">
                    <label className={`btn flex-fill ${adjustType === 'CREDIT' ? 'btn-success' : 'btn-outline-secondary'}`} onClick={() => setAdjustType('CREDIT')}>
                      <i className="fas fa-plus mr-1"></i> Credit (Add)
                    </label>
                    <label className={`btn flex-fill ${adjustType === 'DEBIT' ? 'btn-danger' : 'btn-outline-secondary'}`} onClick={() => setAdjustType('DEBIT')}>
                      <i className="fas fa-minus mr-1"></i> Debit (Deduct)
                    </label>
                  </div>
                  <div className="form-group mb-3">
                    <label className="text-muted text-xs font-weight-bold mb-1">Coin Quantity</label>
                    <input type="number" className="form-control" placeholder="0.00" value={adjustAmount} onChange={e => setAdjustAmount(e.target.value)} step="0.01" required />
                  </div>
                  <div className="form-group mb-3">
                    <label className="text-muted text-xs font-weight-bold mb-1">Ledger Description</label>
                    <input type="text" className="form-control" placeholder="Manual adjustments details" value={adjustDesc} onChange={e => setAdjustDesc(e.target.value)} />
                  </div>
                  <div className="d-flex mt-4">
                    <button type="submit" className="btn btn-primary flex-fill rounded-pill py-2 mr-2">Apply Ledger Entry</button>
                    <button type="button" className="btn btn-outline-secondary flex-fill rounded-pill py-2" onClick={() => setAdjustBalanceModal(false)}>Cancel</button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Info Modal */}
      {editUserModal && selectedUser && (
        <div className="modal fade show" style={{ display: 'block', background: 'rgba(0,0,0,0.5)', zIndex: 10001 }} role="dialog">
          <div className="modal-dialog modal-dialog-centered modal-lg" role="document">
            <div className="modal-content rounded-lg border-0 shadow" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
              <div className="modal-header border-bottom-0">
                <h5 className="modal-title font-weight-bold">Edit Candidate Profile</h5>
                <button type="button" className="close" onClick={() => setEditUserModal(false)}>&times;</button>
              </div>
              <div className="modal-body pt-0">
                <form onSubmit={handleEditUserSubmit}>
                  <div className="row">
                    <div className="col-md-6 form-group mb-3">
                      <label className="text-muted text-xs font-weight-bold mb-1">Full Name</label>
                      <input type="text" className="form-control" value={editUserForm.name} onChange={e => setEditUserForm({ ...editUserForm, name: e.target.value })} required />
                    </div>
                    <div className="col-md-6 form-group mb-3">
                      <label className="text-muted text-xs font-weight-bold mb-1">Email Address</label>
                      <input type="email" className="form-control" value={editUserForm.email} onChange={e => setEditUserForm({ ...editUserForm, email: e.target.value })} required />
                    </div>
                    <div className="col-md-6 form-group mb-3">
                      <label className="text-muted text-xs font-weight-bold mb-1">Phone Number</label>
                      <input type="text" className="form-control" value={editUserForm.phone_number} onChange={e => setEditUserForm({ ...editUserForm, phone_number: e.target.value })} />
                    </div>
                    <div className="col-md-6 form-group mb-3">
                      <label className="text-muted text-xs font-weight-bold mb-1">Location</label>
                      <input type="text" className="form-control" value={editUserForm.location} onChange={e => setEditUserForm({ ...editUserForm, location: e.target.value })} />
                    </div>
                    <div className="col-md-6 form-group mb-3">
                      <label className="text-muted text-xs font-weight-bold mb-1">Referral Code</label>
                      <input type="text" className="form-control" value={editUserForm.referral_code} onChange={e => setEditUserForm({ ...editUserForm, referral_code: e.target.value })} />
                    </div>
                    <div className="col-md-6 form-group mb-3">
                      <label className="text-muted text-xs font-weight-bold mb-1">Balance</label>
                      <input type="number" className="form-control" step="0.01" value={editUserForm.balance} onChange={e => setEditUserForm({ ...editUserForm, balance: e.target.value })} required />
                    </div>
                    <div className="col-md-6 form-group mb-3">
                      <label className="text-muted text-xs font-weight-bold mb-1">Public Hex ID (10-char)</label>
                      <input type="text" className="form-control font-mono" value={editUserForm.user_id} onChange={e => setEditUserForm({ ...editUserForm, user_id: e.target.value })} />
                    </div>
                    <div className="col-md-6 form-group mb-3">
                      <label className="text-muted text-xs font-weight-bold mb-1">Google UID</label>
                      <input type="text" className="form-control" value={editUserForm.uid} onChange={e => setEditUserForm({ ...editUserForm, uid: e.target.value })} />
                    </div>
                    <div className="col-md-6 form-group mb-3">
                      <label className="text-muted text-xs font-weight-bold mb-1">Android Device ID</label>
                      <input type="text" className="form-control" value={editUserForm.android_id} onChange={e => setEditUserForm({ ...editUserForm, android_id: e.target.value })} />
                    </div>
                    <div className="col-md-6 form-group mb-3">
                      <label className="text-muted text-xs font-weight-bold mb-1">Referred By (User ID/Code)</label>
                      <input type="text" className="form-control font-mono" value={editUserForm.referred_by} onChange={e => setEditUserForm({ ...editUserForm, referred_by: e.target.value })} />
                    </div>
                    <div className="col-md-6 form-group mb-3">
                      <label className="text-muted text-xs font-weight-bold mb-1">Check-in Streak (Days)</label>
                      <input type="number" className="form-control" value={editUserForm.current_streak} onChange={e => setEditUserForm({ ...editUserForm, current_streak: e.target.value })} />
                    </div>
                    <div className="col-md-6 form-group mb-3">
                      <label className="text-muted text-xs font-weight-bold mb-1">Lucky Spins Claimed (Today)</label>
                      <input type="number" className="form-control" value={editUserForm.daily_spins_count} onChange={e => setEditUserForm({ ...editUserForm, daily_spins_count: e.target.value })} />
                    </div>
                    <div className="col-md-6 form-group mb-3">
                      <label className="text-muted text-xs font-weight-bold mb-1">Device Model</label>
                      <input type="text" className="form-control" value={editUserForm.device_model} onChange={e => setEditUserForm({ ...editUserForm, device_model: e.target.value })} />
                    </div>
                    <div className="col-md-6 form-group mb-3">
                      <label className="text-muted text-xs font-weight-bold mb-1">OS Version</label>
                      <input type="text" className="form-control" value={editUserForm.os_version} onChange={e => setEditUserForm({ ...editUserForm, os_version: e.target.value })} />
                    </div>
                    <div className="col-md-6 form-group mb-3">
                      <label className="text-muted text-xs font-weight-bold mb-1">App Client Version</label>
                      <input type="text" className="form-control" value={editUserForm.app_version} onChange={e => setEditUserForm({ ...editUserForm, app_version: e.target.value })} />
                    </div>
                    <div className="col-md-6 form-group mb-3">
                      <label className="text-muted text-xs font-weight-bold mb-1">Last IP Address</label>
                      <input type="text" className="form-control font-mono" value={editUserForm.ip_address} onChange={e => setEditUserForm({ ...editUserForm, ip_address: e.target.value })} />
                    </div>
                    <div className="col-md-12 form-group mb-3">
                      <div className="custom-control custom-checkbox mt-2">
                        <input 
                          type="checkbox" 
                          className="custom-control-input" 
                          id="edit_is_emulator" 
                          checked={editUserForm.is_emulator} 
                          onChange={e => setEditUserForm({ ...editUserForm, is_emulator: e.target.checked })} 
                        />
                        <label className="custom-control-label text-xs font-weight-bold" htmlFor="edit_is_emulator">Mark Environment as Virtual/Emulator Environment (Compliance Flag)</label>
                      </div>
                    </div>
                    <div className="col-md-12 form-group mb-3">
                      <label className="text-muted text-xs font-weight-bold mb-1">FCM Push Token</label>
                      <textarea className="form-control font-mono" rows={3} value={editUserForm.fcm_token || ''} onChange={e => setEditUserForm({ ...editUserForm, fcm_token: e.target.value })} />
                    </div>
                  </div>
                  <div className="d-flex mt-4 pb-3">
                    <button type="submit" className="btn btn-primary flex-fill rounded-pill py-2 mr-2">Save Changes</button>
                    <button type="button" className="btn btn-outline-secondary flex-fill rounded-pill py-2" onClick={() => setEditUserModal(false)}>Cancel</button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject Withdrawal Modal */}
      {rejectModal && selectedWithdrawal && (
        <div className="modal fade show" style={{ display: 'block', background: 'rgba(0,0,0,0.5)', zIndex: 10001 }} role="dialog">
          <div className="modal-dialog modal-dialog-centered" role="document">
            <div className="modal-content rounded-lg border-0 shadow">
              <div className="modal-header border-bottom-0">
                <h5 className="modal-title font-weight-bold">Reject Payout Request</h5>
                <button type="button" className="close" onClick={() => { setRejectModal(false); setSelectedWithdrawal(null); }}>&times;</button>
              </div>
              <div className="modal-body pt-0">
                <form onSubmit={handleRejectWithdrawalSubmit}>
                  <div className="form-group mb-3">
                    <label className="text-muted text-xs font-weight-bold mb-1">Reason for Rejection (visible to candidate)</label>
                    <textarea className="form-control" rows={4} placeholder="e.g. Invalid identifier or metadata verification failure." value={rejectReason} onChange={e => setRejectReason(e.target.value)} required />
                  </div>
                  <div className="d-flex mt-4">
                    <button type="submit" className="btn btn-danger flex-fill rounded-pill py-2 mr-2">Reject & Refund Payout</button>
                    <button type="button" className="btn btn-outline-secondary flex-fill rounded-pill py-2" onClick={() => { setRejectModal(false); setSelectedWithdrawal(null); }}>Cancel</button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject Proof Modal */}
      {rejectProofModal && rejectProofClickId && (
        <div className="modal fade show" style={{ display: 'block', background: 'rgba(0,0,0,0.5)', zIndex: 10001 }} role="dialog">
          <div className="modal-dialog modal-dialog-centered" role="document">
            <div className="modal-content rounded-lg border-0 shadow">
              <div className="modal-header border-bottom-0">
                <h5 className="modal-title font-weight-bold">Reject Campaign Proof</h5>
                <button type="button" className="close" onClick={() => { setRejectProofModal(false); setRejectProofClickId(null); setRejectProofReason(''); }}>&times;</button>
              </div>
              <div className="modal-body pt-0">
                <form onSubmit={handleRejectProofSubmit}>
                  <div className="form-group mb-3">
                    <label className="text-muted text-xs font-weight-bold mb-1">Reason for Rejection (visible to candidate)</label>
                    <textarea className="form-control" rows={4} placeholder="e.g. Evidence image does not verify campaign actions." value={rejectProofReason} onChange={e => setRejectProofReason(e.target.value)} required />
                  </div>
                  <div className="d-flex mt-4">
                    <button type="submit" className="btn btn-danger flex-fill rounded-pill py-2 mr-2">Confirm Reject</button>
                    <button type="button" className="btn btn-outline-secondary flex-fill rounded-pill py-2" onClick={() => { setRejectProofModal(false); setRejectProofClickId(null); setRejectProofReason(''); }}>Cancel</button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Device Fingerprint Modal */}
      {editFingerprintModal && selectedUser && (
        <div className="modal fade show" style={{ display: 'block', background: 'rgba(0,0,0,0.5)', zIndex: 10001 }} role="dialog">
          <div className="modal-dialog modal-dialog-centered modal-md" role="document">
            <div className="modal-content rounded-lg border-0 shadow">
              <div className="modal-header border-bottom-0">
                <h5 className="modal-title font-weight-bold">Edit Device Fingerprint</h5>
                <button type="button" className="close" onClick={() => setEditFingerprintModal(false)}>&times;</button>
              </div>
              <div className="modal-body pt-0">
                <form onSubmit={handleEditFingerprintSubmit}>
                  <div className="form-group mb-3">
                    <label className="text-muted text-xs font-weight-bold mb-1">Android Device ID</label>
                    <input 
                      type="text" 
                      className="form-control font-mono" 
                      value={editFingerprintForm.android_id} 
                      onChange={e => setEditFingerprintForm({ ...editFingerprintForm, android_id: e.target.value })} 
                      placeholder="e.g. 3bb9a18dd5"
                    />
                  </div>
                  <div className="form-group mb-3">
                    <label className="text-muted text-xs font-weight-bold mb-1">Device Model</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={editFingerprintForm.device_model} 
                      onChange={e => setEditFingerprintForm({ ...editFingerprintForm, device_model: e.target.value })} 
                      placeholder="e.g. Pixel 6 Pro"
                    />
                  </div>
                  <div className="form-group mb-3">
                    <label className="text-muted text-xs font-weight-bold mb-1">OS Version</label>
                    <input 
                      type="text" 
                      className="form-control font-mono" 
                      value={editFingerprintForm.os_version} 
                      onChange={e => setEditFingerprintForm({ ...editFingerprintForm, os_version: e.target.value })} 
                      placeholder="e.g. Android 13 (API 33)"
                    />
                  </div>
                  <div className="form-group mb-3">
                    <label className="text-muted text-xs font-weight-bold mb-1">App Client Version</label>
                    <input 
                      type="text" 
                      className="form-control font-mono" 
                      value={editFingerprintForm.app_version} 
                      onChange={e => setEditFingerprintForm({ ...editFingerprintForm, app_version: e.target.value })} 
                      placeholder="e.g. 1.0.4"
                    />
                  </div>
                  <div className="form-group mb-3">
                    <label className="text-muted text-xs font-weight-bold mb-1">Last IP Address</label>
                    <input 
                      type="text" 
                      className="form-control font-mono" 
                      value={editFingerprintForm.ip_address} 
                      onChange={e => setEditFingerprintForm({ ...editFingerprintForm, ip_address: e.target.value })} 
                      placeholder="e.g. 192.168.1.1"
                    />
                  </div>
                  <div className="form-group mb-3">
                    <div className="custom-control custom-checkbox mt-2">
                      <input 
                        type="checkbox" 
                        className="custom-control-input" 
                        id="edit_fp_is_emulator" 
                        checked={editFingerprintForm.is_emulator} 
                        onChange={e => setEditFingerprintForm({ ...editFingerprintForm, is_emulator: e.target.checked })} 
                      />
                      <label className="custom-control-label text-xs font-weight-bold" htmlFor="edit_fp_is_emulator">Mark Environment as Virtual/Emulator Environment</label>
                    </div>
                  </div>
                  <div className="d-flex mt-4">
                    <button type="submit" className="btn btn-primary flex-fill rounded-pill py-2 mr-2">Save Fingerprint</button>
                    <button type="button" className="btn btn-outline-secondary flex-fill rounded-pill py-2" onClick={() => setEditFingerprintModal(false)}>Cancel</button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
