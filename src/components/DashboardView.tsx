/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from "react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import {
  Calendar,
  CheckCircle,
  Clock,
  AlertTriangle,
  User,
  Users,
  Building2,
  TrendingUp,
  Filter,
  SlidersHorizontal,
  Sparkles,
  Zap,
  Activity,
  Cpu,
  Radio,
  Terminal,
  ChevronRight,
  Gauge,
} from "lucide-react";
import { Task, UserProfile } from "../googleSheets";

interface DashboardViewProps {
  tasks: Task[];
  activeProfile: UserProfile;
}

export default function DashboardView({ tasks, activeProfile }: DashboardViewProps) {
  // Filter tasks based on role and permissions
  const visibleTasks = useMemo(() => {
    const role = activeProfile.role;
    const dept = activeProfile.department;
    const email = activeProfile.email;

    if (role === "admin" || role === "Giám đốc") {
      return tasks;
    } else if (role === "Phó Giám đốc") {
      // "Theo dõi và xem các nhiệm vụ của nhân viên phòng khác" -> can see all tasks!
      return tasks;
    } else if (role === "Lãnh đạo phòng") {
      // Only view and manage department tasks
      return tasks.filter((t) => t.department === dept);
    } else {
      // Employee: only see own tasks
      return tasks.filter((t) => t.assigneeEmail.toLowerCase() === email.toLowerCase());
    }
  }, [tasks, activeProfile]);

  // States for filtering
  const [selectedDept, setSelectedDept] = useState("Tất cả");
  const [selectedAssignee, setSelectedAssignee] = useState("Tất cả");

  // Dynamic filter lists based on visible tasks
  const departmentsList = useMemo(() => {
    const depts = new Set(visibleTasks.map((t) => t.department).filter(Boolean));
    return ["Tất cả", ...Array.from(depts)];
  }, [visibleTasks]);

  const assigneesList = useMemo(() => {
    const names = new Set(visibleTasks.map((t) => t.assigneeName).filter(Boolean));
    return ["Tất cả", ...Array.from(names)];
  }, [visibleTasks]);

  // Final filtered tasks list for the charts and statistics
  const filteredTasks = useMemo(() => {
    return visibleTasks.filter((t) => {
      const matchDept = selectedDept === "Tất cả" || t.department === selectedDept;
      const matchAssignee = selectedAssignee === "Tất cả" || t.assigneeName === selectedAssignee;
      return matchDept && matchAssignee;
    });
  }, [visibleTasks, selectedDept, selectedAssignee]);

  // Calculations for Deadline Warning (3 days)
  const today = new Date();
  const warningTasks = useMemo(() => {
    return filteredTasks.filter((task) => {
      if (task.status === "Đã hoàn thành") return false;
      if (!task.deadline) return false;

      const deadlineDate = new Date(task.deadline);
      // Diff in ms, then convert to days
      const diffTime = deadlineDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      // Warning if overdue (diffDays < 0) or ending within 3 days (0 <= diffDays <= 3)
      return diffDays <= 3;
    });
  }, [filteredTasks, today]);

  // Overall Statistics
  const stats = useMemo(() => {
    const total = filteredTasks.length;
    if (total === 0) {
      return { total: 0, completed: 0, inProgress: 0, pending: 0, overdue: 0, completedRate: 0 };
    }

    const completed = filteredTasks.filter((t) => t.status === "Đã hoàn thành").length;
    const inProgress = filteredTasks.filter((t) => t.status === "Đang thực hiện").length;
    const pending = filteredTasks.filter((t) => t.status === "Cần đánh giá").length;
    const overdue = filteredTasks.filter((t) => {
      if (t.status === "Đã hoàn thành") return false;
      if (!t.deadline) return false;
      const d = new Date(t.deadline);
      return d < today && t.status !== "Đã hoàn thành";
    }).length;

    const completedRate = Math.round((completed / total) * 100);

    return { total, completed, inProgress, pending, overdue, completedRate };
  }, [filteredTasks, today]);

  // Recharts: Data by Status
  const statusChartData = useMemo(() => {
    const counts: Record<string, number> = {
      "Chưa bắt đầu": 0,
      "Đang thực hiện": 0,
      "Đã hoàn thành": 0,
      "Cần đánh giá": 0,
      "Trễ hạn": 0,
    };

    filteredTasks.forEach((t) => {
      // Check if actually overdue and not completed
      if (t.status !== "Đã hoàn thành" && t.deadline) {
        const d = new Date(t.deadline);
        if (d < today) {
          counts["Trễ hạn"] += 1;
          return;
        }
      }
      counts[t.status] = (counts[t.status] || 0) + 1;
    });

    return Object.keys(counts).map((key) => ({
      name: key,
      value: counts[key],
    })).filter(item => item.value > 0);
  }, [filteredTasks, today]);

  const COLORS = {
    "Chưa bắt đầu": "#94a3b8", // slate-400
    "Đang thực hiện": "#3b82f6", // blue-500
    "Đã hoàn thành": "#10b981", // emerald-500
    "Cần đánh giá": "#f59e0b", // amber-500
    "Trễ hạn": "#ef4444", // red-500
  };

  // Recharts: Department wise progress / task count
  const departmentChartData = useMemo(() => {
    const depts: Record<string, { total: number; completed: number }> = {};

    filteredTasks.forEach((t) => {
      const d = t.department || "Khác";
      if (!depts[d]) {
        depts[d] = { total: 0, completed: 0 };
      }
      depts[d].total += 1;
      if (t.status === "Đã hoàn thành") {
        depts[d].completed += 1;
      }
    });

    return Object.keys(depts).map((key) => ({
      name: key,
      "Tổng số nhiệm vụ": depts[key].total,
      "Đã hoàn thành": depts[key].completed,
      "Tỷ lệ %": Math.round((depts[key].completed / depts[key].total) * 100),
    }));
  }, [filteredTasks]);

  // Recharts: Personal progress
  const staffChartData = useMemo(() => {
    const staff: Record<string, { total: number; completed: number }> = {};

    filteredTasks.forEach((t) => {
      const name = t.assigneeName || t.assigneeEmail;
      if (!staff[name]) {
        staff[name] = { total: 0, completed: 0 };
      }
      staff[name].total += 1;
      if (t.status === "Đã hoàn thành") {
        staff[name].completed += 1;
      }
    });

    return Object.keys(staff)
      .map((key) => ({
        name: key,
        "Tổng số": staff[key].total,
        "Hoàn thành": staff[key].completed,
      }))
      .slice(0, 8); // Keep top 8 for UI layout
  }, [filteredTasks]);

  return (
    <div className="space-y-6 tech-bg-grid pb-10">
      {/* EMBEDDED HIGH-TECH STYLES */}
      <style>{`
        @keyframes techPulse {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 0.9; transform: scale(1.2); }
        }
        @keyframes techPulseSlow {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.8; }
        }
        @keyframes cyberRadar {
          0% { transform: scale(0.9) translate(-50%, -50%); opacity: 0.9; }
          100% { transform: scale(2.4) translate(-50%, -50%); opacity: 0; }
        }
        @keyframes scanlineMove {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100%); }
        }
        @keyframes borderGlowRun {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes cyberSpin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        .tech-bg-grid {
          background-size: 24px 24px;
          background-image: 
            linear-gradient(to right, rgba(99, 102, 241, 0.02) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(99, 102, 241, 0.02) 1px, transparent 1px);
        }
        
        .tech-card {
          position: relative;
          transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          border: 1px solid rgba(226, 232, 240, 0.8);
          background: rgba(255, 255, 255, 0.85);
          backdrop-filter: blur(12px);
        }
        
        .tech-card:hover {
          transform: translateY(-5px);
          border-color: rgba(99, 102, 241, 0.4);
          box-shadow: 0 15px 30px rgba(99, 102, 241, 0.08), 0 0 1px rgba(99, 102, 241, 0.2);
        }

        .tech-card-glow-indigo:hover {
          border-color: rgba(99, 102, 241, 0.45);
          box-shadow: 0 15px 30px rgba(99, 102, 241, 0.1), 0 0 15px rgba(99, 102, 241, 0.15);
        }

        .tech-card-glow-emerald:hover {
          border-color: rgba(16, 185, 129, 0.45);
          box-shadow: 0 15px 30px rgba(16, 185, 129, 0.1), 0 0 15px rgba(16, 185, 129, 0.15);
        }

        .tech-card-glow-blue:hover {
          border-color: rgba(59, 130, 246, 0.45);
          box-shadow: 0 15px 30px rgba(59, 130, 246, 0.1), 0 0 15px rgba(59, 130, 246, 0.15);
        }

        .tech-card-glow-red:hover {
          border-color: rgba(239, 68, 68, 0.45);
          box-shadow: 0 15px 30px rgba(239, 68, 68, 0.1), 0 0 15px rgba(239, 68, 68, 0.15);
        }

        .cyber-corner {
          position: absolute;
          width: 8px;
          height: 8px;
          border-color: rgba(99, 102, 241, 0.35);
          pointer-events: none;
          transition: all 0.3s ease;
        }
        
        .tech-card:hover .cyber-corner {
          border-color: rgba(99, 102, 241, 0.8);
          width: 12px;
          height: 12px;
        }

        .tech-card-glow-emerald:hover .cyber-corner {
          border-color: rgba(16, 185, 129, 0.8);
        }
        .tech-card-glow-blue:hover .cyber-corner {
          border-color: rgba(59, 130, 246, 0.8);
        }
        .tech-card-glow-red:hover .cyber-corner {
          border-color: rgba(239, 68, 68, 0.8);
        }
        
        .corner-tl { top: -1px; left: -1px; border-top: 2px solid; border-left: 2px solid; }
        .corner-tr { top: -1px; right: -1px; border-top: 2px solid; border-right: 2px solid; }
        .corner-bl { bottom: -1px; left: -1px; border-bottom: 2px solid; border-left: 2px solid; }
        .corner-br { bottom: -1px; right: -1px; border-bottom: 2px solid; border-right: 2px solid; }
        
        .glow-line-active {
          background: linear-gradient(90deg, transparent, rgba(99, 102, 241, 0.5), transparent);
          background-size: 200% 100%;
          animation: borderGlowRun 3s infinite linear;
        }

        .radar-signal {
          position: absolute;
          width: 14px;
          height: 14px;
          background: rgba(239, 68, 68, 0.2);
          border: 1.5px solid rgba(239, 68, 68, 0.8);
          border-radius: 50%;
        }

        .radar-wave {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 24px;
          height: 24px;
          border: 1.5px solid rgba(239, 68, 68, 0.6);
          border-radius: 50%;
          animation: cyberRadar 2s infinite cubic-bezier(0.21, 1.02, 0.73, 1);
          transform-origin: 0 0;
        }

        .cyber-spin-decor {
          animation: cyberSpin 20s infinite linear;
          transform-origin: center;
        }
      `}</style>

      {/* FILTER BAR / COMMAND HEADER */}
      <div className="relative overflow-hidden bg-slate-900 text-white rounded-2xl p-5 border border-slate-800 shadow-xl shadow-slate-950/20">
        {/* Decorative Grid Overlay inside header */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        
        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Cpu className="w-4 h-4 text-cyan-400 animate-pulse" />
              <span className="text-[10px] font-mono font-semibold text-cyan-400 tracking-widest uppercase">
                Hệ thống Quản trị & Điều hành
              </span>
              <div className="flex items-center gap-1.5 ml-3 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2 py-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-[9px] font-mono text-emerald-400 font-bold tracking-wide">ONLINE_ACTIVE</span>
              </div>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              Bảng Chỉ Huy Nghiệp Vụ Số
              <span className="text-xs font-mono font-normal text-slate-400 bg-slate-800 px-2 py-0.5 rounded-md border border-slate-700">
                v1.2.0
              </span>
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-4 bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/60 backdrop-blur-md">
            {/* Department Filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider font-semibold">Bộ phận:</span>
              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className="px-3 py-1 rounded-lg border border-slate-700 text-xs bg-slate-900 text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium cursor-pointer"
              >
                {departmentsList.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>

            <div className="h-4 w-px bg-slate-700 hidden sm:block" />

            {/* Assignee Filter */}
            <div className="flex items-center gap-2">
              <User className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider font-semibold">Nhân sự:</span>
              <select
                value={selectedAssignee}
                onChange={(e) => setSelectedAssignee(e.target.value)}
                className="px-3 py-1 rounded-lg border border-slate-700 text-xs bg-slate-900 text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium cursor-pointer"
              >
                {assigneesList.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            {/* Reset button */}
            {(selectedDept !== "Tất cả" || selectedAssignee !== "Tất cả") && (
              <button
                onClick={() => {
                  setSelectedDept("Tất cả");
                  setSelectedAssignee("Tất cả");
                }}
                className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white transition-all text-xs font-bold rounded-lg shadow-sm shadow-indigo-600/20 hover:scale-105 active:scale-95 shrink-0"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Upper KPIs Banner */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* KPI: Total Tasks */}
        <div className="tech-card tech-card-glow-indigo rounded-2xl p-5 shadow-sm overflow-hidden group">
          {/* Futuristic corner decors */}
          <div className="cyber-corner corner-tl" />
          <div className="cyber-corner corner-tr" />
          <div className="cyber-corner corner-bl" />
          <div className="cyber-corner corner-br" />
          <div className="absolute top-0 right-10 h-[2px] w-12 bg-indigo-500/40 group-hover:w-20 group-hover:bg-indigo-500 transition-all duration-300" />
          
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">
                Tổng Số Nhiệm Vụ
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-4xl font-extrabold text-slate-800 tracking-tight">{stats.total}</span>
                <span className="text-[10px] font-mono text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded">TASKS</span>
              </div>
            </div>
            <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 text-indigo-600 p-3 rounded-xl transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3 shadow-inner">
              <Activity className="w-5 h-5 text-indigo-600" />
            </div>
          </div>
          
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
              Giám sát tổng thể
            </span>
            <span className="font-mono text-slate-300 text-[9px]">ID: STATS_TOTAL</span>
          </div>
        </div>

        {/* KPI: Completed Tasks */}
        <div className="tech-card tech-card-glow-emerald rounded-2xl p-5 shadow-sm overflow-hidden group">
          <div className="cyber-corner corner-tl" />
          <div className="cyber-corner corner-tr" />
          <div className="cyber-corner corner-bl" />
          <div className="cyber-corner corner-br" />
          <div className="absolute top-0 right-10 h-[2px] w-12 bg-emerald-500/40 group-hover:w-20 group-hover:bg-emerald-500 transition-all duration-300" />

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">
                Đã Hoàn Thành
              </span>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-extrabold text-emerald-600 tracking-tight">{stats.completed}</span>
                <span className="text-xs text-slate-400 font-bold bg-emerald-50 px-1.5 py-0.5 rounded-md text-emerald-600">
                  {stats.completedRate}%
                </span>
              </div>
            </div>
            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 text-emerald-600 p-3 rounded-xl transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3 shadow-inner">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mr-3">
              <div className="bg-emerald-500 h-full rounded-full transition-all duration-700" style={{ width: `${stats.completedRate}%` }} />
            </div>
            <span className="font-mono text-slate-300 text-[9px] shrink-0">COMP_OK</span>
          </div>
        </div>

        {/* KPI: In Progress Tasks */}
        <div className="tech-card tech-card-glow-blue rounded-2xl p-5 shadow-sm overflow-hidden group">
          <div className="cyber-corner corner-tl" />
          <div className="cyber-corner corner-tr" />
          <div className="cyber-corner corner-bl" />
          <div className="cyber-corner corner-br" />
          <div className="absolute top-0 right-10 h-[2px] w-12 bg-blue-500/40 group-hover:w-20 group-hover:bg-blue-500 transition-all duration-300" />

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">
                Đang Thực Hiện
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-4xl font-extrabold text-blue-600 tracking-tight">{stats.inProgress}</span>
                <span className="text-[10px] font-mono text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded">EXEC</span>
              </div>
            </div>
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 text-blue-600 p-3 rounded-xl transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3 shadow-inner">
              <Clock className="w-5 h-5 text-blue-600" />
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1 text-slate-500 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping" />
              Đang hoạt động tích cực
            </span>
            <span className="font-mono text-slate-300 text-[9px]">RUN_LOOP</span>
          </div>
        </div>

        {/* KPI: Overdue Tasks */}
        <div className="tech-card tech-card-glow-red rounded-2xl p-5 shadow-sm overflow-hidden group">
          <div className="cyber-corner corner-tl" />
          <div className="cyber-corner corner-tr" />
          <div className="cyber-corner corner-bl" />
          <div className="cyber-corner corner-br" />
          <div className="absolute top-0 right-10 h-[2px] w-12 bg-red-500/40 group-hover:w-20 group-hover:bg-red-500 transition-all duration-300" />

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">
                Nhiệm Vụ Trễ Hạn
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-4xl font-extrabold text-red-500 tracking-tight">{stats.overdue}</span>
                <span className="text-[10px] font-mono text-red-500 bg-red-50 px-1.5 py-0.5 rounded font-bold animate-pulse">WARN</span>
              </div>
            </div>
            <div className="bg-gradient-to-br from-red-50 to-red-100 text-red-500 p-3 rounded-xl transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3 shadow-inner">
              <AlertTriangle className="w-5 h-5 text-red-500" />
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5 text-red-500 font-semibold">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
              Cần rà soát xử lý gấp
            </span>
            <span className="font-mono text-slate-300 text-[9px]">OVER_WARN</span>
          </div>
        </div>
      </div>

      {/* 3 Days Deadline Glowing Warnings Panel */}
      {warningTasks.length > 0 && (
        <div className="relative overflow-hidden bg-gradient-to-br from-amber-500/10 to-red-500/15 border border-red-300/40 rounded-2xl p-5 shadow-md">
          {/* Subtle Alarm Radar effect */}
          <div className="absolute top-6 left-6 pointer-events-none">
            <div className="radar-signal" />
            <div className="radar-wave" />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-red-800 font-bold text-sm mb-4 pl-7 relative">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-red-600 animate-bounce" />
              <span>CẢNH BÁO TIẾN ĐỘ KHẨN CẤP (QUÁ HẠN HOẶC CẬN DEADLINE)</span>
            </div>
            <span className="bg-red-600 text-white text-[10px] px-2.5 py-1 rounded-md font-mono tracking-wider font-bold shrink-0 shadow-sm animate-pulse">
              {warningTasks.length} THIẾT BỊ/CÔNG VIỆC CHÚ Ý
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {warningTasks.slice(0, 6).map((task) => {
              const dl = new Date(task.deadline);
              const diffDays = Math.ceil((dl.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

              return (
                <div
                  key={task.id}
                  className="tech-card group rounded-xl p-4 border border-red-200/50 hover:border-red-400 shadow-sm transition-all"
                >
                  <div className="cyber-corner corner-tl" />
                  <div className="cyber-corner corner-tr" />
                  <div className="cyber-corner corner-bl" />
                  <div className="cyber-corner corner-br" />

                  <div className="flex justify-between items-start gap-3 mb-1.5">
                    <h5 className="font-bold text-slate-800 text-xs line-clamp-1 group-hover:text-red-700 transition-colors">
                      {task.title}
                    </h5>
                    <span
                      className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full shrink-0 ${
                        diffDays < 0
                          ? "bg-red-100 text-red-600 border border-red-200"
                          : "bg-amber-100 text-amber-700 border border-amber-200"
                      }`}
                    >
                      {diffDays < 0 ? "OVERDUE" : `${diffDays} DAYS LEFT`}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-500 line-clamp-2 mb-3 leading-relaxed">
                    {task.description || "Không có chi tiết kỹ thuật cho công việc này."}
                  </p>

                  <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-[10px] text-slate-400 font-medium">
                    <span className="flex items-center gap-1 text-slate-600 font-semibold">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      {task.assigneeName}
                    </span>
                    <span className="flex items-center gap-1 text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-100 font-mono">
                      <Building2 className="w-3 h-3 text-slate-400" />
                      {task.department}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Progress donut chart */}
        <div className="tech-card rounded-2xl p-5 shadow-sm flex flex-col justify-between group">
          <div className="cyber-corner corner-tl" />
          <div className="cyber-corner corner-tr" />
          <div className="cyber-corner corner-bl" />
          <div className="cyber-corner corner-br" />

          <div>
            <div className="flex items-center justify-between mb-1">
              <h4 className="font-bold text-slate-800 text-sm">Cơ Cấu Trạng Thái</h4>
              <span className="text-[9px] font-mono text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                CHART_01
              </span>
            </div>
            <p className="text-xs text-slate-500 mb-4">Phân bổ trạng thái công việc thời gian thực</p>
          </div>

          <div className="h-60 flex items-center justify-center relative my-2">
            {statusChartData.length > 0 ? (
              <div className="relative w-full h-full flex items-center justify-center">
                {/* Embedded Spinning Tech Border Decor around Pie */}
                <svg className="cyber-spin-decor absolute w-[210px] h-[210px] pointer-events-none opacity-40 group-hover:opacity-75 transition-opacity" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="46" stroke="#6366f1" strokeWidth="0.75" strokeDasharray="3, 5" fill="none" />
                  <circle cx="50" cy="50" r="42" stroke="#06b6d4" strokeWidth="0.5" strokeDasharray="15, 45" fill="none" />
                </svg>

                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={62}
                      outerRadius={84}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {statusChartData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[entry.name as keyof typeof COLORS] || "#ddd"}
                          className="hover:opacity-90 cursor-pointer transition-opacity"
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "rgba(15, 23, 42, 0.95)",
                        border: "1px solid rgba(99, 102, 241, 0.2)",
                        borderRadius: "10px",
                        boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
                        color: "#fff",
                        fontSize: "11px",
                      }}
                      itemStyle={{ color: "#fff" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="text-slate-400 text-xs flex flex-col items-center gap-2">
                <Terminal className="w-5 h-5 text-slate-300" />
                Không có dữ liệu nhiệm vụ
              </div>
            )}
            
            {/* Center Summary Numbers */}
            <div className="absolute text-center flex flex-col justify-center items-center">
              <span className="text-3xl font-extrabold text-slate-800 tracking-tight group-hover:scale-105 transition-transform duration-300">
                {stats.total}
              </span>
              <p className="text-[9px] uppercase text-slate-400 font-bold tracking-widest">
                NHIỆM VỤ
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs pt-4 border-t border-slate-100 bg-slate-50/50 p-3 rounded-xl">
            {Object.keys(COLORS).map((status) => {
              const matched = statusChartData.find((item) => item.name === status);
              const count = matched ? matched.value : 0;
              return (
                <div key={status} className="flex items-center gap-1.5 py-0.5">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: COLORS[status as keyof typeof COLORS] }}
                  />
                  <span className="text-slate-600 truncate text-[11px]">{status}</span>
                  <span className="text-slate-500 font-bold ml-auto text-[11px] font-mono">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Department performance chart */}
        <div className="tech-card rounded-2xl p-5 shadow-sm lg:col-span-2 flex flex-col justify-between group">
          <div className="cyber-corner corner-tl" />
          <div className="cyber-corner corner-tr" />
          <div className="cyber-corner corner-bl" />
          <div className="cyber-corner corner-br" />

          <div>
            <div className="flex items-center justify-between mb-1">
              <h4 className="font-bold text-slate-800 text-sm">Phân Tích Hiệu Suất Bộ Phận</h4>
              <span className="text-[9px] font-mono text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                CHART_02
              </span>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Thống kê khối lượng hoàn thành và tổng số nhiệm vụ được giao
            </p>
          </div>

          <div className="h-64 w-full my-2">
            {departmentChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={departmentChartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{
                      background: "rgba(15, 23, 42, 0.95)",
                      border: "1px solid rgba(99, 102, 241, 0.2)",
                      borderRadius: "10px",
                      color: "#fff",
                      fontSize: "11px",
                    }}
                    itemStyle={{ color: "#fff" }}
                  />
                  <Legend verticalAlign="top" height={36} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  <Bar
                    dataKey="Tổng số nhiệm vụ"
                    fill="#3b82f6"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={30}
                    className="cursor-pointer hover:opacity-90 transition-opacity"
                  />
                  <Bar
                    dataKey="Đã hoàn thành"
                    fill="#10b981"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={30}
                    className="cursor-pointer hover:opacity-90 transition-opacity"
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 text-xs gap-2">
                <Terminal className="w-5 h-5 text-slate-300" />
                Không có dữ liệu phòng ban để lập biểu đồ
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 pt-4 border-t border-slate-100 text-xs text-slate-500">
            <TrendingUp className="w-4 h-4 text-emerald-500 shrink-0" />
            <span className="truncate">
              {departmentChartData.length > 0
                ? "Dữ liệu được cập nhật tức thì theo cơ sở dữ liệu tích hợp Google Sheets."
                : "Hệ thống đang đồng bộ dữ liệu phòng ban..."}
            </span>
          </div>
        </div>
      </div>

      {/* Staff Loading workload list & Cyber Tips Panel */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Workload list */}
        <div className="tech-card rounded-2xl p-5 shadow-sm">
          <div className="cyber-corner corner-tl" />
          <div className="cyber-corner corner-tr" />
          <div className="cyber-corner corner-bl" />
          <div className="cyber-corner corner-br" />

          <div className="flex items-center justify-between mb-1">
            <h4 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
              <Gauge className="w-4 h-4 text-indigo-500" />
              Khối Lượng Tải Nhân Sự
            </h4>
            <span className="text-[10px] font-mono text-slate-400 bg-slate-50 px-2 py-0.5 rounded border">
              LOAD_INDEX
            </span>
          </div>
          <p className="text-xs text-slate-500 mb-5">Danh sách các cán bộ xử lý nhiều nhiệm vụ nhất</p>

          <div className="space-y-4">
            {staffChartData.length > 0 ? (
              staffChartData.map((staff, idx) => {
                const percent = Math.round((staff["Hoàn thành"] / staff["Tổng số"]) * 100) || 0;
                return (
                  <div key={staff.name} className="flex flex-col gap-1.5 group/item">
                    <div className="flex justify-between items-center text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-md bg-indigo-50 text-indigo-600 border border-indigo-100 text-[10px] font-mono font-bold flex items-center justify-center group-hover/item:bg-indigo-600 group-hover/item:text-white group-hover/item:border-indigo-600 transition-all duration-300">
                          {idx + 1}
                        </span>
                        <span className="font-bold text-slate-700 group-hover/item:text-indigo-600 transition-colors">
                          {staff.name}
                        </span>
                      </div>
                      <span className="text-slate-500 text-[11px] font-mono">
                        {staff["Hoàn thành"]}/{staff["Tổng số"]} (<strong>{percent}%</strong>)
                      </span>
                    </div>
                    {/* Glowing Tech Progress Bar */}
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden relative">
                      <div
                        className="bg-gradient-to-r from-indigo-500 to-cyan-400 h-full rounded-full transition-all duration-700 ease-out shadow-[0_0_10px_rgba(99,102,241,0.3)]"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-slate-400 text-xs py-8 text-center flex flex-col items-center justify-center gap-2">
                <User className="w-6 h-6 text-slate-300" />
                Chưa có thông tin phân bổ nhiệm vụ cán bộ
              </div>
            )}
          </div>
        </div>

        {/* Dynamic tips and information panel (Cyber Control Hub Theme) */}
        <div className="relative overflow-hidden bg-slate-950 text-white rounded-2xl p-6 flex flex-col justify-between shadow-xl border border-indigo-500/30">
          {/* Holographic glowing grids backgrounds */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(99,102,241,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(99,102,241,0.03)_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none" />
          <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-cyan-400" />
                <span className="text-[10px] font-mono text-cyan-400 font-bold tracking-widest uppercase">
                  TRỢ LÝ CHỈ HUY SỐ_
                </span>
              </div>
              <span className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-[9px] font-mono px-2 py-0.5 rounded-md font-bold tracking-wider">
                READY_
              </span>
            </div>

            <h4 className="font-bold text-lg mb-3 text-white flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-yellow-400" />
              Tối Ưu Hóa Năng Suất Đơn Vị
            </h4>

            <div className="space-y-3.5 text-xs text-slate-300 leading-relaxed font-sans">
              <p>
                Xin chào Quý Lãnh đạo! Để quản lý và giám sát cơ sở dữ liệu hiệu quả:
              </p>
              
              <div className="flex items-start gap-2.5 bg-slate-900/60 p-3 rounded-xl border border-slate-800/80 hover:border-indigo-500/30 transition-all group">
                <span className="w-5 h-5 rounded-md bg-red-500/10 text-red-400 border border-red-500/20 text-[10px] font-mono flex items-center justify-center shrink-0 font-bold group-hover:bg-red-500 group-hover:text-white transition-all">
                  01
                </span>
                <p className="text-[11px] text-slate-300">
                  <strong className="text-red-400">Rà soát khẩn cấp:</strong> Đốc thúc các nhiệm vụ cận hoặc quá hạn màu đỏ ở bảng trên để đảm bảo đúng tiến độ đề ra.
                </p>
              </div>

              <div className="flex items-start gap-2.5 bg-slate-900/60 p-3 rounded-xl border border-slate-800/80 hover:border-cyan-500/30 transition-all group">
                <span className="w-5 h-5 rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-[10px] font-mono flex items-center justify-center shrink-0 font-bold group-hover:bg-cyan-500 group-hover:text-white transition-all">
                  02
                </span>
                <p className="text-[11px] text-slate-300">
                  <strong className="text-cyan-400">Phê duyệt nhanh:</strong> Tìm và đánh giá các đầu việc có trạng thái <em>"Cần đánh giá"</em> để cán bộ chính thức kết thúc nhiệm vụ.
                </p>
              </div>

              <div className="flex items-start gap-2.5 bg-slate-900/60 p-3 rounded-xl border border-slate-800/80 hover:border-emerald-500/30 transition-all group">
                <span className="w-5 h-5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-mono flex items-center justify-center shrink-0 font-bold group-hover:bg-emerald-500 group-hover:text-white transition-all">
                  03
                </span>
                <p className="text-[11px] text-slate-300">
                  <strong className="text-emerald-400">Đồng bộ hai chiều:</strong> Mọi thay đổi về chỉ số và tác vụ được lưu trữ an toàn, tức thì lên Google Sheets.
                </p>
              </div>
            </div>
          </div>

          <div className="relative border-t border-slate-800 pt-4 mt-5 flex items-center justify-between text-[10px] text-slate-400 font-mono">
            <span className="flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-slate-500" />
              Trung tâm Bảo trợ xã hội Đà Nẵng
            </span>
            <span className="text-indigo-400 font-bold bg-indigo-500/5 px-2 py-0.5 rounded border border-indigo-500/10">
              SYS_STABLE_ONLINE
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
