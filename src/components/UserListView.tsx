/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import {
  Users,
  Search,
  ExternalLink,
  ShieldAlert,
  UserCog,
  CheckCircle,
  Clock,
  Sparkles,
  RefreshCw,
  X,
  FileSpreadsheet,
  Trash2,
} from "lucide-react";
import { UserProfile } from "../googleSheets";

interface UserListViewProps {
  users: UserProfile[];
  activeProfile: UserProfile;
  spreadsheetId: string | null;
  onSaveUserProfile: (profile: UserProfile, originalEmail?: string) => Promise<void>;
  onDeleteUserProfile: (email: string) => Promise<void>;
  onRefreshData: () => Promise<void>;
}

export default function UserListView({
  users,
  activeProfile,
  spreadsheetId,
  onSaveUserProfile,
  onDeleteUserProfile,
  onRefreshData,
}: UserListViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [originalEmail, setOriginalEmail] = useState<string>("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Filter and sort users
  const filteredUsers = React.useMemo(() => {
    let result = users;

    // Leader and Employee can only see members of their own department, except Admin / Director / Deputy Director who can see all
    const role = activeProfile.role;
    const dept = activeProfile.department;

    if (role === "Lãnh đạo phòng" || role === "Nhân viên") {
      result = result.filter((u) => u.department === dept);
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (u) =>
          u.name.toLowerCase().includes(term) ||
          u.email.toLowerCase().includes(term) ||
          u.department.toLowerCase().includes(term) ||
          u.role.toLowerCase().includes(term)
      );
    }

    // Sort by department, then by role (highest to lowest), then by name
    const rolePriority: Record<string, number> = {
      admin: 5,
      "Giám đốc": 4,
      "Phó Giám đốc": 3,
      "Lãnh đạo phòng": 2,
      "Nhân viên": 1,
    };

    return [...result].sort((a, b) => {
      const deptCompare = (a.department || "").localeCompare(b.department || "");
      if (deptCompare !== 0) return deptCompare;

      const pA = rolePriority[a.role] || 0;
      const pB = rolePriority[b.role] || 0;
      if (pB !== pA) return pB - pA;

      return (a.name || "").localeCompare(b.name || "");
    });
  }, [users, activeProfile, searchTerm]);

  // Update user role handler
  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    if (!editingUser.name.trim()) {
      alert("Họ và tên không được để trống!");
      return;
    }
    if (!editingUser.email.trim()) {
      alert("Email không được để trống!");
      return;
    }

    setIsUpdating(true);
    try {
      await onSaveUserProfile(editingUser, originalEmail);
      setEditingUser(null);
    } catch (err) {
      console.error(err);
      alert("Đã xảy ra lỗi khi cập nhật thông tin thành viên.");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!editingUser) return;

    setIsDeleting(true);
    try {
      await onDeleteUserProfile(originalEmail);
      setEditingUser(null);
      setShowDeleteConfirm(false);
    } catch (err) {
      console.error(err);
      alert("Đã xảy ra lỗi khi xóa thành viên.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefreshData();
    } catch (err) {
      console.error(err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const roles: UserProfile["role"][] = ["admin", "Giám đốc", "Phó Giám đốc", "Lãnh đạo phòng", "Nhân viên"];
  const departments = ["Ban Giám đốc", "Phòng CTXH&CSND", "Phòng TH-HC-KT", "Phòng Y tế - PHCN"];

  const stats = React.useMemo(() => {
    const total = filteredUsers.length;
    const active = filteredUsers.filter((u) => u.status !== "Chờ duyệt").length;
    const pending = filteredUsers.filter((u) => u.status === "Chờ duyệt").length;
    const managers = filteredUsers.filter((u) => u.role !== "Nhân viên").length;
    return { total, active, pending, managers };
  }, [filteredUsers]);

  return (
    <div className="space-y-6 user-bg-grid pb-12">
      {/* EMBEDDED HIGH-TECH USER PANEL STYLES */}
      <style>{`
        .user-bg-grid {
          background-size: 32px 32px;
          background-image: 
            linear-gradient(to right, rgba(99, 102, 241, 0.015) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(99, 102, 241, 0.015) 1px, transparent 1px);
        }
        .cyber-row-active {
          transition: all 0.3s ease;
          position: relative;
        }
        .cyber-row-active:hover {
          background: rgba(99, 102, 241, 0.035) !important;
          box-shadow: inset 3px 0 0 #6366f1;
        }
        .cyber-panel-sc {
          position: relative;
          background: rgba(255, 255, 255, 0.85);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(226, 232, 240, 0.8);
        }
        .cyber-panel-sc:hover {
          border-color: rgba(99, 102, 241, 0.3);
        }
        .cyber-decor-sc {
          position: absolute;
          width: 8px;
          height: 8px;
          border-color: rgba(99, 102, 241, 0.25);
          pointer-events: none;
        }
        .decor-tl-sc { top: -1px; left: -1px; border-top: 2px solid; border-left: 2px solid; }
        .decor-tr-sc { top: -1px; right: -1px; border-top: 2px solid; border-right: 2px solid; }
        .decor-bl-sc { bottom: -1px; left: -1px; border-bottom: 2px solid; border-left: 2px solid; }
        .decor-br-sc { bottom: -1px; right: -1px; border-bottom: 2px solid; border-right: 2px solid; }
      `}</style>

      {/* Header */}
      <div className="relative overflow-hidden bg-slate-900 text-white rounded-2xl p-6 border border-slate-800 shadow-xl shadow-slate-950/20">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none" />
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
        
        <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-[9px] font-mono font-bold text-emerald-400 uppercase tracking-widest">
                STAFF_SECURE_NODE_V2.1
              </span>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              Quản Trị Nhân Sự & Phân Quyền
              <span className="text-[10px] font-mono font-normal text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700">
                ACTIVE_USERS: {stats.active}/{stats.total}
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              {activeProfile.role === "admin"
                ? "Quản lý vai trò, cấu trúc phòng ban, mật khẩu truy cập và cấp phát quyền tài khoản."
                : "Giám sát thông tin, vai trò và trạng thái công tác của thành viên thuộc phòng ban."}
            </p>
          </div>

          {activeProfile.role === "admin" && (
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto shrink-0">
              <button
                onClick={handleManualRefresh}
                disabled={isRefreshing}
                className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-slate-800 bg-slate-950 text-slate-300 hover:bg-slate-800 hover:text-white text-xs font-semibold cursor-pointer transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
                Đồng bộ Sheets
              </button>

              {spreadsheetId && (
                <a
                  href={`https://docs.google.com/spreadsheets/d/${spreadsheetId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-600/20 cursor-pointer transition-all hover:scale-[1.02]"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  Mở Google Sheets
                  <ExternalLink className="w-3 h-3 ml-0.5" />
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Cyber Telemetry Counters */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Users */}
        <div className="cyber-panel-sc rounded-2xl p-4.5 shadow-sm overflow-hidden group">
          <div className="cyber-decor-sc decor-tl-sc" />
          <div className="cyber-decor-sc decor-tr-sc" />
          <div className="cyber-decor-sc decor-bl-sc" />
          <div className="cyber-decor-sc decor-br-sc" />
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">
              TỔNG SỐ NHÂN SỰ
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-bold font-mono text-slate-800">{stats.total}</span>
            <span className="text-[10px] font-mono text-indigo-500 font-semibold uppercase">members</span>
          </div>
          <div className="w-full bg-slate-150 h-1 rounded-full mt-3 overflow-hidden">
            <div className="bg-indigo-500 h-full rounded-full" style={{ width: "100%" }} />
          </div>
        </div>

        {/* Active Users */}
        <div className="cyber-panel-sc rounded-2xl p-4.5 shadow-sm overflow-hidden group">
          <div className="cyber-decor-sc decor-tl-sc" />
          <div className="cyber-decor-sc decor-tr-sc" />
          <div className="cyber-decor-sc decor-bl-sc" />
          <div className="cyber-decor-sc decor-br-sc" />
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">
              ĐANG HOẠT ĐỘNG
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-bold font-mono text-emerald-600">{stats.active}</span>
            <span className="text-[10px] font-mono text-emerald-500 font-semibold uppercase">online</span>
          </div>
          <div className="w-full bg-slate-150 h-1 rounded-full mt-3 overflow-hidden">
            <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${(stats.active / (stats.total || 1)) * 100}%` }} />
          </div>
        </div>

        {/* Pending Approval */}
        <div className="cyber-panel-sc rounded-2xl p-4.5 shadow-sm overflow-hidden group">
          <div className="cyber-decor-sc decor-tl-sc" />
          <div className="cyber-decor-sc decor-tr-sc" />
          <div className="cyber-decor-sc decor-bl-sc" />
          <div className="cyber-decor-sc decor-br-sc" />
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">
              YÊU CẦU DUYỆT
            </span>
            <span className={`w-1.5 h-1.5 rounded-full ${stats.pending > 0 ? "bg-amber-500 animate-ping" : "bg-slate-300"}`} />
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className={`text-2xl font-bold font-mono ${stats.pending > 0 ? "text-amber-500" : "text-slate-600"}`}>
              {stats.pending}
            </span>
            <span className="text-[10px] font-mono text-amber-500 font-semibold uppercase">pending</span>
          </div>
          <div className="w-full bg-slate-150 h-1 rounded-full mt-3 overflow-hidden">
            <div className="bg-amber-500 h-full rounded-full animate-pulse" style={{ width: `${(stats.pending / (stats.total || 1)) * 100}%` }} />
          </div>
        </div>

        {/* Managers */}
        <div className="cyber-panel-sc rounded-2xl p-4.5 shadow-sm overflow-hidden group">
          <div className="cyber-decor-sc decor-tl-sc" />
          <div className="cyber-decor-sc decor-tr-sc" />
          <div className="cyber-decor-sc decor-bl-sc" />
          <div className="cyber-decor-sc decor-br-sc" />
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">
              BAN LÃNH ĐẠO & QL
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-bold font-mono text-indigo-600">{stats.managers}</span>
            <span className="text-[10px] font-mono text-indigo-500 font-semibold uppercase">officers</span>
          </div>
          <div className="w-full bg-slate-150 h-1 rounded-full mt-3 overflow-hidden">
            <div className="bg-indigo-600 h-full rounded-full" style={{ width: `${(stats.managers / (stats.total || 1)) * 100}%` }} />
          </div>
        </div>
      </div>

      {/* Sync State Card */}
      {activeProfile.role === "admin" && (
        <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 to-indigo-950 border border-slate-800 rounded-2xl p-5 shadow-lg shadow-indigo-950/10 text-white">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none" />
          <div className="flex items-start gap-4">
            <div className="bg-indigo-500/10 text-indigo-400 p-3 rounded-xl border border-indigo-500/20 shrink-0">
              <FileSpreadsheet className="w-6 h-6 animate-pulse" />
            </div>
            <div className="space-y-1.5">
              <h4 className="font-bold text-slate-100 text-sm flex items-center gap-2">
                Đồng bộ hóa đám mây Google Sheets hoạt động tốt
                <span className="inline-flex items-center gap-1 text-[8px] bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-1.5 py-0.2 rounded font-mono uppercase tracking-widest animate-pulse">
                  ● REALTIME
                </span>
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed max-w-4xl">
                Cơ sở dữ liệu nhân sự, vai trò phòng ban và phân quyền đã được đồng bộ hóa tức thời trên hệ thống. Mọi sửa đổi sẽ tự động áp dụng khi cán bộ đăng nhập bằng mật khẩu tương ứng.
              </p>
              <div className="text-[10px] text-slate-500 font-mono select-all">
                Spreadsheet ID: {spreadsheetId || "CONFIG_NOT_LOADED"}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main List */}
      <div className="cyber-panel-sc rounded-2xl border border-slate-200/80 shadow-md overflow-hidden">
        <div className="cyber-decor-sc decor-tl-sc" />
        <div className="cyber-decor-sc decor-tr-sc" />
        <div className="cyber-decor-sc decor-bl-sc" />
        <div className="cyber-decor-sc decor-br-sc" />

        {/* Search tool */}
        <div className="p-4 border-b border-slate-150/50 bg-slate-50/50 flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Nhập tên, email, vai trò hoặc bộ phận cần tìm..."
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-250 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none bg-white placeholder-slate-400 shadow-inner"
            />
          </div>
        </div>

        {/* Table/List View */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100/80 text-slate-500 text-[10px] font-bold uppercase tracking-wider border-b border-slate-200 font-mono">
                <th className="py-3 px-5">Nhân viên</th>
                <th className="py-3 px-5">Email</th>
                <th className="py-3 px-5">Mật khẩu</th>
                <th className="py-3 px-5">Vai trò</th>
                <th className="py-3 px-5">Phòng ban</th>
                <th className="py-3 px-5 text-center">Trạng thái</th>
                {activeProfile.role === "admin" && (
                  <th className="py-3 px-5 text-right">Thao tác</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-150/50 text-xs text-slate-700 bg-white/50">
              {filteredUsers.map((user) => (
                <tr key={user.email} className="cyber-row-active hover:bg-slate-50/50 transition-colors">
                  <td className="py-3 px-5 font-semibold text-slate-800">{user.name}</td>
                  <td className="py-3 px-5 text-slate-500 font-mono text-[11px] select-all">{user.email}</td>
                  <td className="py-3 px-5 text-slate-500 font-mono text-[11px]">{user.password || "123456"}</td>
                  <td className="py-3 px-5">
                    <span
                      className={`px-2.5 py-0.5 rounded text-[10px] font-bold border ${
                        user.role === "admin"
                          ? "bg-purple-50 border-purple-200 text-purple-700"
                          : user.role === "Giám đốc"
                          ? "bg-rose-50 border-rose-200 text-rose-700"
                          : user.role === "Phó Giám đốc"
                          ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                          : user.role === "Lãnh đạo phòng"
                          ? "bg-amber-50 border-amber-200 text-amber-700"
                          : "bg-slate-50 border-slate-200 text-slate-600"
                      }`}
                    >
                      {user.role}
                    </span>
                  </td>
                  <td className="py-3 px-5 font-medium text-slate-600">{user.department}</td>
                  <td className="py-3 px-5 text-center">
                    {user.status === "Chờ duyệt" ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-600 border border-amber-200/60 animate-pulse">
                        <Clock className="w-3 h-3" />
                        Chờ duyệt
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-600 border border-emerald-200/60">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                        Hoạt động
                      </span>
                    )}
                  </td>
                  {activeProfile.role === "admin" && (
                    <td className="py-3 px-5 text-right">
                      <button
                        onClick={() => {
                          setEditingUser(user);
                          setOriginalEmail(user.email);
                          setShowDeleteConfirm(false);
                        }}
                        className="p-1.5 rounded-lg border border-slate-250 bg-white text-slate-600 hover:border-indigo-400 hover:text-indigo-600 cursor-pointer inline-flex items-center gap-1 text-[10px] font-bold transition-all hover:shadow-sm"
                      >
                        <UserCog className="w-3.5 h-3.5 text-indigo-500" />
                        Cấp quyền
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* USER EDIT DIALOG/MODAL (ADMIN ONLY) */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl border border-slate-100 mx-4 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-4">
              <h3 className="font-bold text-slate-800 text-base">Phân Quyền Thành Viên</h3>
              <button
                onClick={() => setEditingUser(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Họ và Tên Nhân Viên *
                </label>
                <input
                  type="text"
                  value={editingUser.name}
                  onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Email Nhân Viên *
                </label>
                <input
                  type="email"
                  value={editingUser.email}
                  onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Mật khẩu Tài khoản *
                </label>
                <input
                  type="text"
                  value={editingUser.password || ""}
                  onChange={(e) => setEditingUser({ ...editingUser, password: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="Nhập mật khẩu (Mặc định nếu trống: 123456)"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Vai Trò *
                </label>
                <select
                  value={editingUser.role}
                  onChange={(e) =>
                    setEditingUser({ ...editingUser, role: e.target.value as UserProfile["role"] })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {roles.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Phòng Ban Phụ Trách *
                </label>
                <select
                  value={editingUser.department}
                  onChange={(e) => setEditingUser({ ...editingUser, department: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {departments.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Trạng Thái Tài Khoản
                </label>
                <select
                  value={editingUser.status}
                  onChange={(e) =>
                    setEditingUser({
                      ...editingUser,
                      status: e.target.value as UserProfile["status"],
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="Hoạt động">Hoạt động (Được truy cập)</option>
                  <option value="Chờ duyệt">Chờ duyệt</option>
                </select>
              </div>

              {!showDeleteConfirm ? (
                <div className="flex justify-between items-center border-t border-slate-100 pt-4 mt-6">
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="px-3.5 py-2 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-semibold cursor-pointer inline-flex items-center gap-1.5 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                    Xóa thành viên
                  </button>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingUser(null)}
                      className="px-4 py-2 border border-slate-200 rounded-xl text-slate-500 text-xs font-medium hover:bg-slate-50 cursor-pointer"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      disabled={isUpdating}
                      className="px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 text-xs font-semibold cursor-pointer"
                    >
                      {isUpdating ? "Đang lưu..." : "Lưu thay đổi"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 mt-6 space-y-3">
                  <p className="text-xs text-rose-700 font-medium leading-relaxed">
                    Bạn có chắc chắn muốn xóa thành viên này khỏi hệ thống? Thao tác này sẽ xóa vĩnh viễn quyền truy cập của họ và không thể hoàn tác.
                  </p>
                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(false)}
                      className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-600 text-[11px] font-semibold hover:bg-slate-50 cursor-pointer"
                    >
                      Hủy bỏ
                    </button>
                    <button
                      type="button"
                      disabled={isDeleting}
                      onClick={handleDeleteUser}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[11px] font-semibold cursor-pointer flex items-center gap-1.5 animate-pulse"
                    >
                      {isDeleting ? "Đang xóa..." : "Xác nhận Xóa"}
                    </button>
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
