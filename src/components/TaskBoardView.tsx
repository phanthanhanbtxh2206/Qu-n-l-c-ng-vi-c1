/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from "react";
import {
  Plus,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Clock,
  Edit2,
  Trash2,
  CheckSquare,
  FileText,
  User,
  Calendar as CalendarIcon,
  ChevronsUp,
  Sliders,
  X,
  MessageSquare,
  Folder,
  Repeat,
  ListTodo,
  PlusCircle,
  Settings2,
  Layers,
  Sparkles,
  Info,
  Trash,
} from "lucide-react";
import { Task, UserProfile, SubTask, TaskFolder } from "../googleSheets";

// Helper function to calculate sub-task step due date, overdue, and near due status
export function getStepStatus(createdAtStr: string | undefined, durationDays?: number) {
  if (!durationDays) return null;
  // Fallback to today if createdAt is not available
  const baseStr = createdAtStr ? createdAtStr.split("T")[0] : new Date().toISOString().split("T")[0];
  const created = new Date(baseStr);
  created.setDate(created.getDate() + durationDays);
  
  const targetYear = created.getFullYear();
  const targetMonth = String(created.getMonth() + 1).padStart(2, "0");
  const targetDay = String(created.getDate()).padStart(2, "0");
  const formattedDate = `${targetDay}/${targetMonth}/${targetYear}`;
  
  // Create Date object representing today (at midnight)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Target deadline date (at midnight)
  const due = new Date(created.getFullYear(), created.getMonth(), created.getDate());
  
  const diffTime = due.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  const isOverdue = diffDays < 0;
  const isNearDue = diffDays >= 0 && diffDays <= 1; // today or tomorrow
  
  return {
    formattedDate,
    isOverdue,
    isNearDue,
    diffDays
  };
}

interface TaskBoardViewProps {
  tasks: Task[];
  activeProfile: UserProfile;
  allUsers: UserProfile[];
  onSaveTask: (task: Task) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
}

export default function TaskBoardView({
  tasks,
  activeProfile,
  allUsers,
  onSaveTask,
  onDeleteTask,
}: TaskBoardViewProps) {
  // Search and Filter State
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deptFilter, setDeptFilter] = useState<string>("all");

  // Dialog State
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);

  // New Task Form State
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newAssigneeEmail, setNewAssigneeEmail] = useState("");
  const [newStartDate, setNewStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [newDeadline, setNewDeadline] = useState("");
  const [newDept, setNewDept] = useState(activeProfile.department || "Phòng CTXH&CSND");
  const [newPriority, setNewPriority] = useState<"Gấp" | "Bình thường">("Bình thường");
  const [newTaskType, setNewTaskType] = useState<"Đột xuất" | "Thường xuyên">("Thường xuyên");

  // --- RECURRING & DIRECTORIES STATES ---
  const [folders, setFolders] = useState<TaskFolder[]>(() => {
    const saved = localStorage.getItem("task_tracker_folders");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    const defaults: TaskFolder[] = [
      {
        id: "folder-1",
        name: "Hồ sơ chính sách CTXH",
        createdByEmail: "system",
        createdAt: "2026-01-01",
        subTasks: [
          { id: "sub-1-1", title: "Thu thập hồ sơ đối tượng", durationDays: 3, description: "Liên hệ và thu thập hồ sơ đầy đủ" },
          { id: "sub-1-2", title: "Thẩm định điều kiện thụ hưởng", durationDays: 5, description: "Kiểm tra chéo và thẩm định thực tế" },
          { id: "sub-1-3", title: "Trình ký phê duyệt", durationDays: 2, description: "Hoàn thiện tờ trình và trình ký Lãnh đạo" },
        ]
      },
      {
        id: "folder-2",
        name: "Kiểm kê vật tư y tế",
        createdByEmail: "system",
        createdAt: "2026-01-01",
        subTasks: [
          { id: "sub-2-1", title: "Lập danh mục thiết bị kiểm kê", durationDays: 1, description: "Trích xuất danh mục từ hệ thống" },
          { id: "sub-2-2", title: "Kiểm đếm thực tế tại các khoa", durationDays: 3, description: "Ghi nhận số lượng thực tế và đối chiếu" },
          { id: "sub-2-3", title: "Lập biên bản chênh lệch", durationDays: 2, description: "Giải trình chênh lệch nếu có" },
        ]
      }
    ];
    localStorage.setItem("task_tracker_folders", JSON.stringify(defaults));
    return defaults;
  });

  // Folder modal
  const [isFolderMgrOpen, setIsFolderMgrOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderSteps, setNewFolderSteps] = useState<{ id: string; title: string; durationDays: number; description?: string }[]>([]);
  const [tempStepTitle, setTempStepTitle] = useState("");
  const [tempStepDuration, setTempStepDuration] = useState(2);
  const [tempStepDesc, setTempStepDesc] = useState("");

  // Folder feedback states
  const [folderSuccessMsg, setFolderSuccessMsg] = useState("");
  const [folderErrorMsg, setFolderErrorMsg] = useState("");
  const [deletingFolderId, setDeletingFolderId] = useState<string | null>(null);
  
  // Custom delete confirmation modal for tasks
  const [taskToDelete, setTaskToDelete] = useState<{ id: string; title: string } | null>(null);

  // Recurrence / folder choices on task create
  const [newFolderId, setNewFolderId] = useState("");
  const [newIsRecurring, setNewIsRecurring] = useState(false);
  const [newRecurInterval, setNewRecurInterval] = useState<"hàng tháng" | "hàng quý" | "hàng năm" | "tự chọn">("hàng tháng");
  const [newRecurCustomDate, setNewRecurCustomDate] = useState("");
  const [recurMonthlyDay, setRecurMonthlyDay] = useState("15");
  const [recurQuarterlyMonth, setRecurQuarterlyMonth] = useState("tháng đầu tiên");
  const [recurQuarterlyDay, setRecurQuarterlyDay] = useState("15");
  const [recurYearlyMonth, setRecurYearlyMonth] = useState("1");
  const [recurYearlyDay, setRecurYearlyDay] = useState("15");
  const [customSubTasks, setCustomSubTasks] = useState<SubTask[]>([]);
  
  // Custom quick subtask inputs on the new task modal
  const [quickSubtaskTitle, setQuickSubtaskTitle] = useState("");
  const [quickSubtaskDuration, setQuickSubtaskDuration] = useState(2);
  const [quickSubtaskDesc, setQuickSubtaskDesc] = useState("");

  // Filter Folder state for main task filter
  const [folderFilter, setFolderFilter] = useState<string>("all");

  // Loader state for async saving
  const [isSaving, setIsSaving] = useState(false);

  // Filter users that are in the same department for assignment based on hierarchy rules
  const assignableUsers = useMemo(() => {
    const role = activeProfile.role;
    const dept = activeProfile.department;
    const email = activeProfile.email.toLowerCase();

    if (role === "admin" || role === "Giám đốc") {
      // Admin and Director can assign tasks to anyone
      return allUsers;
    }

    if (role === "Phó Giám đốc") {
      // Deputy Director can assign to:
      // - Themselves
      // - "Lãnh đạo phòng" of their department
      // - "Nhân viên" of their department
      return allUsers.filter((u) => {
        if (u.email.toLowerCase() === email) return true;
        return u.department === dept && (u.role === "Lãnh đạo phòng" || u.role === "Nhân viên");
      });
    }

    if (role === "Lãnh đạo phòng") {
      // Department Head can assign to:
      // - Themselves
      // - "Nhân viên" of their department
      return allUsers.filter((u) => {
        if (u.email.toLowerCase() === email) return true;
        return u.department === dept && u.role === "Nhân viên";
      });
    }

    // Employees can only assign to themselves
    return allUsers.filter((u) => u.email.toLowerCase() === email);
  }, [allUsers, activeProfile]);

  // Handle setting default assignee on modal open
  React.useEffect(() => {
    if (isNewTaskOpen) {
      if (activeProfile.role === "Nhân viên") {
        setNewAssigneeEmail(activeProfile.email);
        setNewDept(activeProfile.department);
      } else if (assignableUsers.length > 0) {
        setNewAssigneeEmail(assignableUsers[0].email);
        setNewDept(activeProfile.department);
      }
    }
  }, [isNewTaskOpen, activeProfile, assignableUsers]);

  // Visibility filtering based on RBAC rules
  const filteredTasks = useMemo(() => {
    let result = tasks;

    // 1. Phân quyền xem nhiệm vụ
    const role = activeProfile.role;
    const dept = activeProfile.department;
    const email = activeProfile.email;

    if (role === "admin" || role === "Giám đốc" || role === "Phó Giám đốc") {
      // Admin, Giám đốc, Phó Giám đốc can see all tasks
      // (Phó giám đốc can see tasks of other departments too: "Theo dõi và xem các nhiệm vụ của nhân viên phòng khác")
    } else if (role === "Lãnh đạo phòng") {
      // Only view department tasks
      result = result.filter((t) => t.department === dept);
    } else {
      // Employee: only see own tasks
      result = result.filter((t) => t.assigneeEmail.toLowerCase() === email.toLowerCase());
    }

    // 2. Search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(term) ||
          t.description.toLowerCase().includes(term) ||
          t.assigneeName.toLowerCase().includes(term) ||
          t.assigneeEmail.toLowerCase().includes(term)
      );
    }

    // 3. Status filter
    if (statusFilter !== "all") {
      result = result.filter((t) => t.status === statusFilter);
    }

    // 4. Department filter
    if (deptFilter !== "all") {
      result = result.filter((t) => t.department === deptFilter);
    }

    // 5. Folder filter
    if (folderFilter !== "all") {
      result = result.filter((t) => t.folderId === folderFilter);
    }

    // Sort tasks according to the priority of their statuses:
    // Trễ hạn, sắp đến hạn, đang thực hiện, cần đánh giá, chưa bắt đầu, đã hoàn thành
    const getTaskScore = (t: Task) => {
      if (t.status === "Đã hoàn thành") return 6;
      
      let isOverdue = false;
      let isNearDue = false;
      
      if (t.deadline) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const due = new Date(t.deadline);
        due.setHours(0, 0, 0, 0);
        const diffTime = due.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        isOverdue = diffDays < 0 || t.status === "Trễ hạn";
        isNearDue = diffDays >= 0 && diffDays <= 1;
      } else if (t.status === "Trễ hạn") {
        isOverdue = true;
      }

      if (isOverdue) return 1;
      if (isNearDue) return 2;
      if (t.status === "Đang thực hiện") return 3;
      if (t.status === "Cần đánh giá") return 4;
      if (t.status === "Chưa bắt đầu") return 5;
      return 3.5;
    };

    return [...result].sort((a, b) => getTaskScore(a) - getTaskScore(b));
  }, [tasks, activeProfile, searchTerm, statusFilter, deptFilter, folderFilter]);

  // Create task handler
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newAssigneeEmail) return;

    setIsSaving(true);
    const selectedUser = allUsers.find((u) => u.email === newAssigneeEmail);
    const assigneeName = selectedUser ? selectedUser.name : newAssigneeEmail;
    // Determine the department of the task - use the assignee's department if available
    const taskDept = selectedUser ? selectedUser.department : (activeProfile.role === "admin" ? newDept : activeProfile.department);
    const selectedFolder = folders.find((f) => f.id === newFolderId);

    let customRecurDesc = undefined;
    if (newIsRecurring) {
      if (newRecurInterval === "hàng tháng") {
        customRecurDesc = `Ngày ${recurMonthlyDay === "cuối cùng" ? "cuối cùng" : recurMonthlyDay} hàng tháng`;
      } else if (newRecurInterval === "hàng quý") {
        customRecurDesc = `Ngày ${recurQuarterlyDay === "cuối cùng" ? "cuối cùng" : recurQuarterlyDay} của ${recurQuarterlyMonth} trong quý`;
      } else if (newRecurInterval === "hàng năm") {
        customRecurDesc = `Ngày ${recurYearlyDay} tháng ${recurYearlyMonth} hàng năm`;
      } else if (newRecurInterval === "tự chọn") {
        customRecurDesc = newRecurCustomDate;
      }
    }

    const newTask: Task = {
      id: "task-" + Date.now(),
      title: newTitle,
      description: newDesc,
      assigneeEmail: newAssigneeEmail,
      assigneeName: assigneeName,
      department: taskDept,
      createdByEmail: activeProfile.email,
      createdByName: activeProfile.name,
      startDate: newStartDate || new Date().toISOString().split("T")[0],
      deadline: newDeadline || new Date().toISOString().split("T")[0],
      progress: 0,
      status: "Chưa bắt đầu",
      selfAssessment: "",
      managerAssessment: "",
      managerComment: "",
      createdAt: new Date().toISOString().split("T")[0],
      updatedAt: new Date().toISOString().split("T")[0],
      priority: newPriority,
      taskType: newTaskType,
      isRecurring: newIsRecurring,
      recurrenceInterval: newIsRecurring ? newRecurInterval : undefined,
      recurrenceCustomDate: customRecurDesc,
      folderId: newFolderId || undefined,
      folderName: selectedFolder ? selectedFolder.name : undefined,
      subTasks: customSubTasks,
    };

    try {
      await onSaveTask(newTask);
      // Reset
      setNewTitle("");
      setNewDesc("");
      setNewStartDate(new Date().toISOString().split("T")[0]);
      setNewDeadline("");
      setNewPriority("Bình thường");
      setNewTaskType("Thường xuyên");
      setNewFolderId("");
      setNewIsRecurring(false);
      setNewRecurInterval("hàng tháng");
      setNewRecurCustomDate("");
      setCustomSubTasks([]);
      setIsNewTaskOpen(false);
    } catch (err) {
      console.error(err);
      alert("Đã xảy ra lỗi khi tạo nhiệm vụ. Vui lòng thử lại!");
    } finally {
      setIsSaving(false);
    }
  };

  // Handle folder change - auto import steps
  const handleFolderChange = (folderId: string) => {
    setNewFolderId(folderId);
    if (!folderId) {
      setCustomSubTasks([]);
      return;
    }
    const folder = folders.find((f) => f.id === folderId);
    if (folder && folder.subTasks) {
      // Map folder steps to new task sub-tasks structure
      const imported: SubTask[] = folder.subTasks.map((step) => ({
        id: "sub-" + Date.now() + Math.random().toString(36).substr(2, 5),
        title: step.title,
        completed: false,
        durationDays: step.durationDays,
        description: step.description,
      }));
      setCustomSubTasks(imported);
    } else {
      setCustomSubTasks([]);
    }
  };

  // Edit / Evaluate task handler
  const handleUpdateTask = async (updated: Task) => {
    setIsSaving(true);
    try {
      await onSaveTask(updated);
      setEditingTask(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  // Delete task with safe custom modal
  const handleDeleteClick = (taskId: string, title: string) => {
    setTaskToDelete({ id: taskId, title });
  };

  const handleConfirmDeleteTask = async () => {
    if (!taskToDelete) return;
    setIsSaving(true);
    try {
      await onDeleteTask(taskToDelete.id);
      setTaskToDelete(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  // Check if a user can edit/delete/assign details of a task
  const canModifyTaskMeta = (task: Task) => {
    const role = activeProfile.role;
    const dept = activeProfile.department;

    if (role === "admin") return true;
    if (role === "Giám đốc") return true; // Director can modify all tasks they assign or oversee
    if (role === "Phó Giám đốc" && dept === task.department) return true;
    if (role === "Lãnh đạo phòng" && dept === task.department) return true;
    if (role === "Nhân viên" && task.createdByEmail === activeProfile.email) return true;

    return false;
  };

  // Check if a user can evaluate/assess a task (Manager action)
  const canEvaluateTask = (task: Task) => {
    const role = activeProfile.role;
    const dept = activeProfile.department;

    if (role === "admin") return true;
    if (role === "Giám đốc") return true; // Director can evaluate center-wide
    if (role === "Phó Giám đốc" && dept === task.department) return true;
    if (role === "Lãnh đạo phòng" && dept === task.department) return true;

    return false;
  };

  // Check if a user can update their own progress and self assessment
  const canSelfAssess = (task: Task) => {
    return task.assigneeEmail.toLowerCase() === activeProfile.email.toLowerCase();
  };

  return (
    <div className="space-y-6 tech-bg-grid pb-12">
      {/* EMBEDDED HIGH-TECH STYLES */}
      <style>{`
        @keyframes techBlink {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
        @keyframes scanningLine {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100%); }
        }
        .tech-bg-grid {
          background-size: 32px 32px;
          background-image: 
            linear-gradient(to right, rgba(99, 102, 241, 0.02) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(99, 102, 241, 0.02) 1px, transparent 1px);
        }
        .tech-card-sc {
          position: relative;
          transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          border: 1px solid rgba(226, 232, 240, 0.8);
          background: rgba(255, 255, 255, 0.85);
          backdrop-filter: blur(12px);
        }
        .tech-card-sc:hover {
          transform: translateY(-5px);
          border-color: rgba(99, 102, 241, 0.45);
          box-shadow: 0 15px 30px rgba(99, 102, 241, 0.08), 0 0 15px rgba(99, 102, 241, 0.1);
        }
        .tech-card-overdue:hover {
          border-color: rgba(239, 68, 68, 0.45);
          box-shadow: 0 15px 30px rgba(239, 68, 68, 0.08), 0 0 15px rgba(239, 68, 68, 0.1);
        }
        .tech-card-neardue:hover {
          border-color: rgba(245, 158, 11, 0.45);
          box-shadow: 0 15px 30px rgba(245, 158, 11, 0.08), 0 0 15px rgba(245, 158, 11, 0.1);
        }
        .tech-card-completed:hover {
          border-color: rgba(16, 185, 129, 0.45);
          box-shadow: 0 15px 30px rgba(16, 185, 129, 0.08), 0 0 15px rgba(16, 185, 129, 0.1);
        }
        .cyber-corner-sc {
          position: absolute;
          width: 8px;
          height: 8px;
          border-color: rgba(99, 102, 241, 0.35);
          pointer-events: none;
          transition: all 0.3s ease;
        }
        .tech-card-sc:hover .cyber-corner-sc {
          border-color: rgba(99, 102, 241, 0.85);
          width: 12px;
          height: 12px;
        }
        .tech-card-overdue:hover .cyber-corner-sc {
          border-color: rgba(239, 68, 68, 0.85);
        }
        .tech-card-neardue:hover .cyber-corner-sc {
          border-color: rgba(245, 158, 11, 0.85);
        }
        .tech-card-completed:hover .cyber-corner-sc {
          border-color: rgba(16, 185, 129, 0.85);
        }
        .corner-tl-sc { top: -1px; left: -1px; border-top: 2px solid; border-left: 2px solid; }
        .corner-tr-sc { top: -1px; right: -1px; border-top: 2px solid; border-right: 2px solid; }
        .corner-bl-sc { bottom: -1px; left: -1px; border-bottom: 2px solid; border-left: 2px solid; }
        .corner-br-sc { bottom: -1px; right: -1px; border-bottom: 2px solid; border-right: 2px solid; }
        
        .glowing-bar {
          background: linear-gradient(90deg, #6366f1, #06b6d4, #6366f1);
          background-size: 200% auto;
          animation: glowRun 3s linear infinite;
        }
        @keyframes glowRun {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>

      {/* Header and Add Task bar */}
      <div className="relative overflow-hidden bg-slate-900 text-white rounded-2xl p-6 border border-slate-800 shadow-xl shadow-slate-950/20">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none" />
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
        
        <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
              <span className="text-[9px] font-mono font-bold text-indigo-400 uppercase tracking-widest">
                TASK_DISPATCHER_PRO_V1.2
              </span>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              Quản Lý & Phân Phối Nhiệm Vụ
              <span className="text-[10px] font-mono font-normal text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700">
                ACTIVE_TASKS: {filteredTasks.length}
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Phát khởi tạo, kiểm duyệt và phân phối tiến trình công việc của toàn đơn vị.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto shrink-0">
            <button
              onClick={() => setIsFolderMgrOpen(true)}
              className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl border border-slate-800 bg-slate-950 text-slate-300 hover:bg-slate-800 hover:text-white text-xs font-semibold cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Folder className="w-4 h-4 text-indigo-400" />
              Thư mục quy trình
            </button>

            <button
              onClick={() => setIsNewTaskOpen(true)}
              className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Plus className="w-4 h-4 animate-bounce" />
              Tạo nhiệm vụ mới
            </button>
          </div>
        </div>
      </div>

      {/* Filter and Search controls */}
      <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm space-y-3.5">
        <div className="flex flex-col md:flex-row gap-3.5">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm kiếm theo tiêu đề, người thực hiện, mô tả..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none placeholder-slate-400"
            />
          </div>

          {/* Folder Filter */}
          <div className="flex items-center gap-2">
            <Folder className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
            <select
              value={folderFilter}
              onChange={(e) => setFolderFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="all">Tất cả Thư mục</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="all">Tất cả Trạng thái</option>
              <option value="Chưa bắt đầu">Chưa bắt đầu</option>
              <option value="Đang thực hiện">Đang thực hiện</option>
              <option value="Cần đánh giá">Cần đánh giá</option>
              <option value="Đã hoàn thành">Đã hoàn thành</option>
              <option value="Trễ hạn">Trễ hạn</option>
            </select>
          </div>

          {/* Department Filter (Visible to Admin, Director, Deputy Director) */}
          {(activeProfile.role === "admin" ||
            activeProfile.role === "Giám đốc" ||
            activeProfile.role === "Phó Giám đốc") && (
            <div className="flex items-center gap-2">
              <Sliders className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="all">Tất cả Phòng ban</option>
                <option value="Phòng CTXH&CSND">Phòng CTXH&CSND</option>
                <option value="Phòng TH-HC-KT">Phòng TH-HC-KT</option>
                <option value="Phòng Y tế - PHCN">Phòng Y tế - PHCN</option>
                <option value="Ban Giám đốc">Ban Giám đốc</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Task cards Grid */}
      {filteredTasks.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-100 shadow-sm flex flex-col items-center justify-center">
          <CheckSquare className="w-12 h-12 text-slate-300 mb-3" />
          <h3 className="font-semibold text-slate-700 text-sm mb-1">Không tìm thấy nhiệm vụ nào</h3>
          <p className="text-xs text-slate-400 max-w-sm">
            Không tìm thấy kết quả phù hợp với các tiêu chí tìm kiếm hoặc tài khoản của bạn chưa được giao việc.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredTasks.map((task) => {
            const todayMidnight = new Date();
            todayMidnight.setHours(0, 0, 0, 0);

            let isOverdue = false;
            let isNearDue = false;

            if (task.status !== "Đã hoàn thành" && task.deadline) {
              const due = new Date(task.deadline);
              due.setHours(0, 0, 0, 0);
              const diffTime = due.getTime() - todayMidnight.getTime();
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              isOverdue = diffDays < 0 || task.status === "Trễ hạn";
              isNearDue = diffDays >= 0 && diffDays <= 1;
            } else if (task.status === "Trễ hạn") {
              isOverdue = true;
            }

            return (
              <div
                key={task.id}
                className={`tech-card-sc p-5 rounded-2xl flex flex-col justify-between overflow-hidden group/card ${
                  isOverdue 
                    ? "tech-card-overdue border-red-200/60 bg-red-50/5" 
                    : isNearDue 
                    ? "tech-card-neardue border-amber-200/60 bg-amber-50/5" 
                    : task.status === "Đã hoàn thành"
                    ? "tech-card-completed border-emerald-200/60 bg-emerald-50/5"
                    : "border-slate-100"
                }`}
              >
                {/* Cyber Corner Ornaments */}
                <div className="cyber-corner-sc corner-tl-sc" />
                <div className="cyber-corner-sc corner-tr-sc" />
                <div className="cyber-corner-sc corner-bl-sc" />
                <div className="cyber-corner-sc corner-br-sc" />

                {/* Header & Status */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="text-[10px] font-bold text-slate-500 bg-slate-50 border border-slate-100/80 px-2.5 py-1 rounded-md uppercase tracking-wider font-mono">
                      {task.department}
                    </span>

                    <span
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-md border font-mono ${
                        task.status === "Đã hoàn thành"
                          ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                          : task.status === "Cần đánh giá"
                          ? "bg-amber-50 border-amber-200 text-amber-700 animate-pulse font-extrabold"
                          : isOverdue
                          ? "bg-red-50 border-red-200 text-red-700 font-extrabold"
                          : isNearDue
                          ? "bg-orange-50 border-orange-200 text-orange-700 font-bold"
                          : task.status === "Đang thực hiện"
                          ? "bg-blue-50 border-blue-200 text-blue-700"
                          : "bg-slate-50 border-slate-200 text-slate-600"
                      }`}
                    >
                      {isOverdue ? "TRỄ HẠN" : isNearDue ? "CẬN HẠN" : task.status.toUpperCase()}
                    </span>
                  </div>

                  <h3 className="font-bold text-slate-800 text-sm mb-1.5 line-clamp-1 group-hover/card:text-indigo-600 transition-colors" title={task.title}>
                    {task.title}
                  </h3>

                  {/* Priority & Type Badges */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    <span
                      className={`text-[9px] font-extrabold px-2 py-0.5 rounded-md ${
                        task.priority === "Gấp"
                          ? "bg-rose-50 text-rose-600 border border-rose-150 animate-pulse"
                          : "bg-slate-50 text-slate-500 border border-slate-100"
                      }`}
                    >
                      Mức độ: {task.priority || "Bình thường"}
                    </span>
                    <span className="text-[9px] font-semibold px-2 py-0.5 rounded-md bg-indigo-50/50 text-indigo-600 border border-indigo-100/40">
                      Loại: {task.taskType || "Thường xuyên"}
                    </span>
                  </div>

                  {/* Folder & Recurrence Badges */}
                  {(task.folderName || task.isRecurring) && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {task.folderName && (
                        <span className="flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100">
                          <Folder className="w-2.5 h-2.5 shrink-0" />
                          {task.folderName}
                        </span>
                      )}
                      {task.isRecurring && (
                        <span className="flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-100">
                          <Repeat className="w-2.5 h-2.5 shrink-0 animate-spin" style={{ animationDuration: "12s" }} />
                          Lặp lại: {task.recurrenceInterval === "tự chọn" ? (task.recurrenceCustomDate || "Tự chọn") : task.recurrenceInterval}
                        </span>
                      )}
                    </div>
                  )}

                  <p className="text-xs text-slate-400 line-clamp-3 mb-4 leading-relaxed">
                    {task.description || "Không có mô tả chi tiết."}
                  </p>

                  {/* Sub-tasks checklist progress */}
                  {task.subTasks && task.subTasks.length > 0 && (
                    <div className="mb-4 bg-slate-50/70 p-2.5 rounded-xl border border-slate-150/50 backdrop-blur-sm">
                      <div className="flex justify-between items-center text-[9px] font-extrabold text-slate-500 uppercase tracking-wide mb-1.5">
                        <span className="flex items-center gap-1 text-slate-600">
                          <ListTodo className="w-3 h-3 text-indigo-500 animate-pulse" />
                          Các bước ({task.subTasks.filter((s) => s.completed).length}/{task.subTasks.length})
                        </span>
                        <span className="text-[8px] text-slate-400 font-normal normal-case font-mono">
                          (Tính từ: {task.createdAt ? task.createdAt.split("-").reverse().join("/") : ""})
                        </span>
                        <span className="font-mono text-indigo-600">
                          {Math.round((task.subTasks.filter((s) => s.completed).length / task.subTasks.length) * 100)}%
                        </span>
                      </div>
                      <div className="space-y-1.5 max-h-[110px] overflow-y-auto pr-1">
                        {task.subTasks.map((st) => {
                          const dateInfo = getStepStatus(task.createdAt, st.durationDays);
                          return (
                            <div key={st.id} className="flex items-start gap-2 text-[11px] text-slate-600 hover:text-slate-950 transition-colors">
                              <input
                                type="checkbox"
                                checked={st.completed}
                                disabled={!canSelfAssess(task) && !canModifyTaskMeta(task)}
                                onChange={async (e) => {
                                  const updatedSubTasks = task.subTasks!.map((s) =>
                                    s.id === st.id ? { ...s, completed: e.target.checked } : s
                                  );
                                  const completedCount = updatedSubTasks.filter((s) => s.completed).length;
                                  const newProgress = Math.round((completedCount / updatedSubTasks.length) * 100);

                                  const updatedTask: Task = {
                                    ...task,
                                    subTasks: updatedSubTasks,
                                    progress: newProgress,
                                    status: newProgress === 100 ? "Cần đánh giá" : "Đang thực hiện",
                                    updatedAt: new Date().toISOString().split("T")[0],
                                  };
                                  await onSaveTask(updatedTask);
                                }}
                                className="mt-0.5 w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 shrink-0 cursor-pointer"
                              />
                              <div className="flex-1 min-w-0">
                                <span
                                  className={`text-[10px] block font-medium ${
                                    st.completed ? "line-through text-slate-400" : "text-slate-700"
                                  }`}
                                >
                                  {st.title} {st.durationDays ? `(${st.durationDays} ngày)` : ""}
                                </span>
                                
                                {dateInfo && (
                                  <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                    {st.completed ? (
                                      <span className="text-[8px] px-1 py-0.2 bg-emerald-50 text-emerald-600 border border-emerald-100/60 rounded font-mono">
                                        Đã xong (Hạn: {dateInfo.formattedDate})
                                      </span>
                                    ) : dateInfo.isOverdue ? (
                                      <span className="text-[8px] font-bold px-1 py-0.2 bg-rose-50 text-rose-600 border border-rose-100 rounded animate-pulse font-mono">
                                        ⚠️ Trễ hạn ({dateInfo.formattedDate})
                                      </span>
                                    ) : dateInfo.isNearDue ? (
                                      <span className="text-[8px] font-bold px-1 py-0.2 bg-amber-50 text-amber-700 border border-amber-150 rounded animate-pulse font-mono">
                                        ⏳ Sắp đến hạn ({dateInfo.formattedDate})
                                      </span>
                                    ) : (
                                      <span className="text-[8px] px-1 py-0.2 bg-slate-50 text-slate-500 border border-slate-100 rounded font-mono">
                                        Hạn: {dateInfo.formattedDate}
                                      </span>
                                    )}
                                  </div>
                                )}

                                {st.description && !st.completed && (
                                  <span className="text-[9px] text-slate-400 block truncate leading-tight mt-0.5">
                                    {st.description}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Meta details & Progress */}
                <div>
                  {/* Progress slider / bar */}
                  <div className="mb-4 space-y-1.5">
                    <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 font-mono">
                      <span>Tiến trình hoàn thành</span>
                      <span className="text-indigo-600">{task.progress}%</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden relative">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          task.status === "Đã hoàn thành" ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" : "glowing-bar shadow-[0_0_8px_rgba(99,102,241,0.4)]"
                        }`}
                        style={{ width: `${task.progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Date & Assignee */}
                  <div className="grid grid-cols-3 gap-2 border-t border-slate-50 pt-3.5 mb-4 text-[10px] text-slate-500">
                    <div className="flex items-center gap-1.5 col-span-1 min-w-0">
                      <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <div className="truncate">
                        <span className="block text-[8px] text-slate-400 uppercase">Thực hiện</span>
                        <span className="font-semibold text-slate-700 truncate block">{task.assigneeName}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 col-span-1 min-w-0">
                      <CalendarIcon className="w-3.5 h-3.5 text-slate-400 shrink-0 text-indigo-500" />
                      <div className="truncate">
                        <span className="block text-[8px] text-slate-400 uppercase">Bắt đầu</span>
                        <span className="font-semibold text-slate-700 truncate block">
                          {task.startDate ? task.startDate.split("-").reverse().join("/") : (task.createdAt ? task.createdAt.split("-").reverse().join("/") : "")}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 col-span-1 min-w-0">
                      <CalendarIcon className="w-3.5 h-3.5 text-slate-400 shrink-0 text-amber-500" />
                      <div className="truncate">
                        <span className="block text-[8px] text-slate-400 uppercase">Hạn chót</span>
                        <span
                          className={`font-semibold truncate block ${
                            isOverdue ? "text-red-500 font-bold" : "text-slate-700"
                          }`}
                        >
                          {task.deadline ? task.deadline.split("-").reverse().join("/") : ""}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Display Assessments if present */}
                  {(task.selfAssessment || task.managerAssessment) && (
                    <div className="bg-slate-50 rounded-xl p-3 mb-4 space-y-2 text-[11px] border border-slate-100">
                      {task.selfAssessment && (
                        <div>
                          <span className="text-slate-400 font-semibold block text-[9px] uppercase">
                            Cá nhân tự đánh giá:
                          </span>
                          <span className="text-slate-600 font-medium italic">
                            "{task.selfAssessment}"
                          </span>
                        </div>
                      )}
                      {task.managerAssessment && (
                        <div className="border-t border-slate-100 pt-1.5">
                          <span className="text-indigo-600 font-semibold block text-[9px] uppercase">
                            Quản lý đánh giá: {task.managerAssessment}
                          </span>
                          {task.managerComment && (
                            <span className="text-slate-500 italic block mt-0.5">
                              "{task.managerComment}"
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Actions buttons */}
                  <div className="flex gap-2 justify-end">
                    {/* Self updates for Employee */}
                    {canSelfAssess(task) && (
                      <button
                        onClick={() => setEditingTask(task)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-indigo-200 text-indigo-600 hover:bg-indigo-50 text-[10px] font-semibold cursor-pointer transition-all"
                      >
                        <Sliders className="w-3 h-3" />
                        Tự cập nhật & Đánh giá
                      </button>
                    )}

                    {/* Manage updates for managers */}
                    {canEvaluateTask(task) && !canSelfAssess(task) && (
                      <button
                        onClick={() => setEditingTask(task)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-amber-200 text-amber-600 hover:bg-amber-50 text-[10px] font-semibold cursor-pointer transition-all"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        Sếp đánh giá
                      </button>
                    )}

                    {/* Full update/Delete for creators/admins */}
                    {canModifyTaskMeta(task) && (
                      <>
                        <button
                          onClick={() => setEditingTask(task)}
                          className="flex items-center justify-center p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 cursor-pointer"
                          title="Chỉnh sửa nhiệm vụ"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(task.id, task.title)}
                          className="flex items-center justify-center p-1.5 rounded-lg border border-red-100 text-red-500 hover:bg-red-50 cursor-pointer"
                          title="Xóa nhiệm vụ"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* NEW TASK DIALOG/MODAL */}
      {isNewTaskOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl border border-slate-100 mx-4 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-4">
              <h3 className="font-bold text-slate-800 text-base">Thêm Nhiệm Vụ Mới</h3>
              <button
                onClick={() => setIsNewTaskOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Tiêu đề nhiệm vụ *
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Ví dụ: Thiết kế báo cáo tuần, lập kế hoạch họp..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Mô tả chi tiết
                </label>
                <textarea
                  rows={3}
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Nhập yêu cầu, kỳ vọng công việc..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Giao cho nhân viên *
                </label>
                {activeProfile.role === "Nhân viên" ? (
                  <input
                    type="text"
                    readOnly
                    value={activeProfile.name}
                    className="w-full px-3 py-2 rounded-xl border border-slate-100 bg-slate-50 text-slate-500 text-xs focus:outline-none"
                  />
                ) : (
                  <select
                    value={newAssigneeEmail}
                    onChange={(e) => setNewAssigneeEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white text-slate-600 focus:outline-none"
                  >
                    {assignableUsers.map((u) => (
                      <option key={u.email} value={u.email}>
                        {u.name} ({u.department})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Ngày bắt đầu *
                  </label>
                  <input
                    type="date"
                    required
                    value={newStartDate}
                    onChange={(e) => setNewStartDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Hạn chót *
                  </label>
                  <input
                    type="date"
                    required
                    value={newDeadline}
                    onChange={(e) => setNewDeadline(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Priority & Type Selection */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Mức độ nhiệm vụ *
                  </label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as "Gấp" | "Bình thường")}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="Bình thường">Bình thường</option>
                    <option value="Gấp">Gấp</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Loại nhiệm vụ *
                  </label>
                  <select
                    value={newTaskType}
                    onChange={(e) => setNewTaskType(e.target.value as "Đột xuất" | "Thường xuyên")}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="Thường xuyên">Thường xuyên</option>
                    <option value="Đột xuất">Đột xuất</option>
                  </select>
                </div>
              </div>

              {/* --- FOLDER / DIRECTORY SELECTION --- */}
              <div className="bg-slate-50/50 p-4.5 rounded-2xl border border-slate-100 space-y-3.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Folder className="w-4 h-4 text-indigo-500" />
                    <span className="text-xs font-bold text-slate-700">Thư mục quy trình & Phân nhóm</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsFolderMgrOpen(true);
                      setIsNewTaskOpen(false); // Close task modal to open folder modal
                    }}
                    className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-0.5 cursor-pointer"
                  >
                    + Tạo thư mục mới
                  </button>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                    Chọn thư mục nhiệm vụ
                  </label>
                  <select
                    value={newFolderId}
                    onChange={(e) => handleFolderChange(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="">-- Không thuộc thư mục nào --</option>
                    {folders.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name} ({f.subTasks.length} bước mẫu)
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-400 mt-1">
                    (Khi chọn thư mục, các bước quy trình mẫu sẽ tự động được thêm vào danh sách kiểm tra dưới đây)
                  </p>
                </div>

                {/* Checklist steps builder */}
                <div className="border-t border-slate-100 pt-3.5 space-y-2.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                    <ListTodo className="w-3.5 h-3.5 text-indigo-500" />
                    Các bước cần thực hiện ({customSubTasks.length})
                  </span>

                  {customSubTasks.length > 0 ? (
                    <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                      {customSubTasks.map((st, sIdx) => (
                        <div
                          key={st.id}
                          className="flex items-center justify-between gap-2 p-2 bg-white rounded-lg border border-slate-150 text-xs text-slate-700"
                        >
                          <div className="min-w-0 flex-1">
                            <span className="font-semibold text-[11px] block truncate text-slate-800">
                              Bước {sIdx + 1}: {st.title}
                            </span>
                            {st.durationDays ? (
                              <span className="text-[9px] text-indigo-600 font-medium block">
                                Thời hạn hoàn thành: {st.durationDays} ngày
                              </span>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            onClick={() => setCustomSubTasks(customSubTasks.filter((s) => s.id !== st.id))}
                            className="text-red-500 hover:text-red-700 p-1 cursor-pointer shrink-0"
                            title="Xóa bước này"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[10px] italic text-slate-400">
                      Nhiệm vụ này hiện chưa có bước thực hiện cụ thể. Bạn có thể thêm các bước thực hiện bên dưới.
                    </p>
                  )}

                  {/* Add manual step fields */}
                  <div className="bg-white p-2.5 rounded-xl border border-slate-150 space-y-2">
                    <span className="text-[9px] font-extrabold text-slate-500 uppercase">Thêm bước thực hiện nhanh</span>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-2">
                        <input
                          type="text"
                          value={quickSubtaskTitle}
                          onChange={(e) => setQuickSubtaskTitle(e.target.value)}
                          placeholder="Tên bước thực hiện..."
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <input
                          type="number"
                          min="1"
                          value={quickSubtaskDuration}
                          onChange={(e) => setQuickSubtaskDuration(parseInt(e.target.value, 10) || 1)}
                          placeholder="Số ngày..."
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          title="Số ngày hoàn thành dự kiến cho bước này"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={quickSubtaskDesc}
                        onChange={(e) => setQuickSubtaskDesc(e.target.value)}
                        placeholder="Mô tả công việc chi tiết (không bắt buộc)..."
                        className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-[10px] focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (!quickSubtaskTitle.trim()) return;
                          const newStep: SubTask = {
                            id: "sub-" + Date.now() + Math.random().toString(36).substr(2, 5),
                            title: quickSubtaskTitle,
                            completed: false,
                            durationDays: quickSubtaskDuration,
                            description: quickSubtaskDesc || undefined,
                          };
                          setCustomSubTasks([...customSubTasks, newStep]);
                          setQuickSubtaskTitle("");
                          setQuickSubtaskDuration(2);
                          setQuickSubtaskDesc("");
                        }}
                        className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg text-[10px] shrink-0 transition-all cursor-pointer"
                      >
                        + Thêm bước
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* --- RECURRING / LẶP LẠI NHIỆM VỤ --- */}
              <div className="bg-amber-50/20 p-4.5 rounded-2xl border border-amber-100/50 space-y-3">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isRecurringCheckbox"
                    checked={newIsRecurring}
                    onChange={(e) => setNewIsRecurring(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <label
                    htmlFor="isRecurringCheckbox"
                    className="text-xs font-bold text-slate-700 flex items-center gap-1.5 cursor-pointer select-none"
                  >
                    <Repeat className="w-4 h-4 text-amber-500" />
                    Nhiệm vụ lặp lại tự động định kỳ?
                  </label>
                </div>

                {newIsRecurring && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pl-6 pt-1 animate-in slide-in-from-top-2 duration-200">
                    <div className="sm:col-span-1">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                        Chu kỳ lặp lại
                      </label>
                      <select
                        value={newRecurInterval}
                        onChange={(e) =>
                          setNewRecurInterval(e.target.value as Task["recurrenceInterval"])
                        }
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="hàng tháng">Hàng tháng</option>
                        <option value="hàng quý">Hàng quý</option>
                        <option value="hàng năm">Hàng năm</option>
                        <option value="tự chọn">Tự chọn thời gian cụ thể</option>
                      </select>
                    </div>

                    {newRecurInterval === "tự chọn" && (
                      <div className="sm:col-span-1 animate-in fade-in duration-150">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                          Thời gian lặp lại cụ thể
                        </label>
                        <input
                          type="text"
                          required
                          value={newRecurCustomDate}
                          onChange={(e) => setNewRecurCustomDate(e.target.value)}
                          placeholder="Ví dụ: Mỗi thứ Hai, Ngày 15 hàng tháng..."
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                        />
                      </div>
                    )}

                    {newRecurInterval === "hàng tháng" && (
                      <div className="sm:col-span-2 bg-slate-50 p-3.5 rounded-xl border border-slate-150 space-y-1.5 animate-in fade-in duration-150">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                          Chọn ngày lặp lại hàng tháng
                        </label>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-600">Lặp lại vào ngày</span>
                          <select
                            value={recurMonthlyDay}
                            onChange={(e) => setRecurMonthlyDay(e.target.value)}
                            className="px-2.5 py-1 border border-slate-250 rounded-lg text-xs bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                          >
                            {Array.from({ length: 31 }, (_, i) => String(i + 1)).map((d) => (
                              <option key={d} value={d}>Ngày {d}</option>
                            ))}
                            <option value="cuối cùng">Ngày cuối cùng của tháng</option>
                          </select>
                          <span className="text-xs text-slate-600">mỗi tháng.</span>
                        </div>
                        <p className="text-[10px] text-indigo-600 font-medium">
                          → Hệ thống sẽ ghi nhận: <strong>Ngày {recurMonthlyDay === "cuối cùng" ? "cuối cùng" : recurMonthlyDay} hàng tháng</strong>.
                        </p>
                      </div>
                    )}

                    {newRecurInterval === "hàng quý" && (
                      <div className="sm:col-span-2 bg-slate-50 p-3.5 rounded-xl border border-slate-150 space-y-2.5 animate-in fade-in duration-150">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                          Chọn ngày lặp lại hàng quý
                        </label>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs text-slate-600">Lặp lại vào ngày</span>
                          <select
                            value={recurQuarterlyDay}
                            onChange={(e) => setRecurQuarterlyDay(e.target.value)}
                            className="px-2.5 py-1 border border-slate-250 rounded-lg text-xs bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                          >
                            {Array.from({ length: 31 }, (_, i) => String(i + 1)).map((d) => (
                              <option key={d} value={d}>Ngày {d}</option>
                            ))}
                            <option value="cuối cùng">Ngày cuối cùng của tháng</option>
                          </select>
                          <span className="text-xs text-slate-600">của</span>
                          <select
                            value={recurQuarterlyMonth}
                            onChange={(e) => setRecurQuarterlyMonth(e.target.value)}
                            className="px-2.5 py-1 border border-slate-250 rounded-lg text-xs bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                          >
                            <option value="tháng đầu tiên">tháng đầu tiên (Tháng 1, 4, 7, 10)</option>
                            <option value="tháng thứ hai">tháng thứ hai (Tháng 2, 5, 8, 11)</option>
                            <option value="tháng thứ ba">tháng thứ ba (Tháng 3, 6, 9, 12)</option>
                          </select>
                          <span className="text-xs text-slate-600">trong quý.</span>
                        </div>
                        <p className="text-[10px] text-indigo-600 font-medium">
                          → Hệ thống sẽ ghi nhận: <strong>Ngày {recurQuarterlyDay === "cuối cùng" ? "cuối cùng" : recurQuarterlyDay} của {recurQuarterlyMonth} trong quý</strong>.
                        </p>
                      </div>
                    )}

                    {newRecurInterval === "hàng năm" && (
                      <div className="sm:col-span-2 bg-slate-50 p-3.5 rounded-xl border border-slate-150 space-y-2.5 animate-in fade-in duration-150">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                          Chọn ngày lặp lại hàng năm
                        </label>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-600">Lặp lại vào ngày</span>
                          <select
                            value={recurYearlyDay}
                            onChange={(e) => setRecurYearlyDay(e.target.value)}
                            className="px-2.5 py-1 border border-slate-250 rounded-lg text-xs bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                          >
                            {Array.from({ length: 31 }, (_, i) => String(i + 1)).map((d) => (
                              <option key={d} value={d}>Ngày {d}</option>
                            ))}
                          </select>
                          <span className="text-xs text-slate-600">tháng</span>
                          <select
                            value={recurYearlyMonth}
                            onChange={(e) => setRecurYearlyMonth(e.target.value)}
                            className="px-2.5 py-1 border border-slate-250 rounded-lg text-xs bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                          >
                            {Array.from({ length: 12 }, (_, i) => String(i + 1)).map((m) => (
                              <option key={m} value={m}>Tháng {m}</option>
                            ))}
                          </select>
                          <span className="text-xs text-slate-600">hàng năm.</span>
                        </div>
                        <p className="text-[10px] text-indigo-600 font-medium">
                          → Hệ thống sẽ ghi nhận: <strong>Ngày {recurYearlyDay} tháng {recurYearlyMonth} hàng năm</strong>.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {activeProfile.role === "admin" && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Phòng Ban *
                  </label>
                  <select
                    value={newDept}
                    onChange={(e) => setNewDept(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white text-slate-600 focus:outline-none"
                  >
                    <option value="Phòng CTXH&CSND">Phòng CTXH&CSND</option>
                    <option value="Phòng TH-HC-KT">Phòng TH-HC-KT</option>
                    <option value="Phòng Y tế - PHCN">Phòng Y tế - PHCN</option>
                    <option value="Ban Giám đốc">Ban Giám đốc</option>
                  </select>
                </div>
              )}

              <div className="flex gap-3 justify-end border-t border-slate-100 pt-4 mt-6">
                <button
                  type="button"
                  onClick={() => setIsNewTaskOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-slate-500 text-xs font-medium hover:bg-slate-50 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 text-xs font-semibold cursor-pointer"
                >
                  {isSaving ? "Đang lưu..." : "Lưu nhiệm vụ"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT / EVALUATE TASK DIALOG/MODAL */}
      {editingTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl border border-slate-100 mx-4 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-4">
              <h3 className="font-bold text-slate-800 text-base">Cập Nhật Nhiệm Vụ</h3>
              <button
                onClick={() => setEditingTask(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-5">
              {/* Header Info */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-[11px] text-slate-500 space-y-1">
                <div>
                  <span className="font-bold">Nhiệm vụ:</span> {editingTask.title}
                </div>
                <div>
                  <span className="font-bold">Người phụ trách:</span> {editingTask.assigneeName} ({editingTask.assigneeEmail})
                </div>
                <div>
                  <span className="font-bold">Phòng ban:</span> {editingTask.department}
                </div>
              </div>

              {/* Form elements for self assess / progress */}
              {canSelfAssess(editingTask) && (
                <div className="space-y-4">
                  <h4 className="font-bold text-indigo-600 text-xs uppercase tracking-wider">
                    Cập nhật cá nhân thực hiện
                  </h4>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Cập nhật tiến độ: {editingTask.progress}%
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={editingTask.progress}
                      onChange={(e) =>
                        setEditingTask({
                          ...editingTask,
                          progress: parseInt(e.target.value, 10),
                          // Automatically set status to "Đã hoàn thành" if progress is 100
                          status:
                            parseInt(e.target.value, 10) === 100
                              ? "Cần đánh giá"
                              : "Đang thực hiện",
                        })
                      }
                      className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">
                      (Kéo thanh trượt để điều chỉnh tiến độ từ 0% đến 100%)
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Trạng thái nhiệm vụ
                    </label>
                    <select
                      value={editingTask.status}
                      onChange={(e) =>
                        setEditingTask({
                          ...editingTask,
                          status: e.target.value as Task["status"],
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white text-slate-600 focus:outline-none"
                    >
                      <option value="Chưa bắt đầu">Chưa bắt đầu</option>
                      <option value="Đang thực hiện">Đang thực hiện</option>
                      <option value="Cần đánh giá">Cần đánh giá (Đợi sếp duyệt)</option>
                      <option value="Đã hoàn thành">Đã hoàn thành</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Cá nhân tự đánh giá, báo cáo chi tiết
                    </label>
                    <textarea
                      rows={2.5}
                      value={editingTask.selfAssessment}
                      onChange={(e) =>
                        setEditingTask({ ...editingTask, selfAssessment: e.target.value })
                      }
                      placeholder="Báo cáo tiến độ hiện tại, khó khăn, thuận lợi..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Form elements for manager assessment */}
              {canEvaluateTask(editingTask) && (
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <h4 className="font-bold text-amber-500 text-xs uppercase tracking-wider">
                    Đánh giá của Lãnh đạo / Quản lý
                  </h4>

                  <div className="grid grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Kết quả đánh giá
                      </label>
                      <select
                        value={editingTask.managerAssessment}
                        onChange={(e) =>
                          setEditingTask({
                            ...editingTask,
                            managerAssessment: e.target.value,
                            // If marked as pass, automatically set status to Complete
                            status:
                              e.target.value === "Đạt" || e.target.value === "Xuất sắc"
                                ? "Đã hoàn thành"
                                : editingTask.status,
                          })
                        }
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white text-slate-600 focus:outline-none"
                      >
                        <option value="">Chưa đánh giá</option>
                        <option value="Xuất sắc">Xuất sắc</option>
                        <option value="Đạt">Đạt</option>
                        <option value="Cần cố gắng">Cần cố gắng</option>
                        <option value="Chưa đạt">Chưa đạt</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Cập nhật trạng thái
                      </label>
                      <select
                        value={editingTask.status}
                        onChange={(e) =>
                          setEditingTask({
                            ...editingTask,
                            status: e.target.value as Task["status"],
                          })
                        }
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white text-slate-600 focus:outline-none"
                      >
                        <option value="Chưa bắt đầu">Chưa bắt đầu</option>
                        <option value="Đang thực hiện">Đang thực hiện</option>
                        <option value="Cần đánh giá">Cần đánh giá</option>
                        <option value="Đã hoàn thành">Đã hoàn thành</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Ý kiến chỉ đạo / Nhận xét của Lãnh đạo
                    </label>
                    <textarea
                      rows={2.5}
                      value={editingTask.managerComment}
                      onChange={(e) =>
                        setEditingTask({ ...editingTask, managerComment: e.target.value })
                      }
                      placeholder="Cho ý kiến chỉ đạo, yêu cầu bổ sung hoặc phê duyệt công việc..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Full edit option for creator / Admin */}
              {canModifyTaskMeta(editingTask) && (
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <h4 className="font-bold text-slate-600 text-xs uppercase tracking-wider">
                    Chỉnh sửa thông tin cốt lõi
                  </h4>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Sửa tiêu đề nhiệm vụ
                    </label>
                    <input
                      type="text"
                      value={editingTask.title}
                      onChange={(e) =>
                        setEditingTask({ ...editingTask, title: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Sửa mô tả
                    </label>
                    <textarea
                      rows={2}
                      value={editingTask.description}
                      onChange={(e) =>
                        setEditingTask({ ...editingTask, description: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Sửa ngày bắt đầu
                      </label>
                      <input
                        type="date"
                        value={editingTask.startDate || editingTask.createdAt || ""}
                        onChange={(e) =>
                          setEditingTask({ ...editingTask, startDate: e.target.value })
                        }
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Sửa hạn chót
                      </label>
                      <input
                        type="date"
                        value={editingTask.deadline}
                        onChange={(e) =>
                          setEditingTask({ ...editingTask, deadline: e.target.value })
                        }
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Sửa mức độ
                      </label>
                      <select
                        value={editingTask.priority || "Bình thường"}
                        onChange={(e) =>
                          setEditingTask({
                            ...editingTask,
                            priority: e.target.value as "Gấp" | "Bình thường",
                          })
                        }
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white text-slate-600 focus:outline-none"
                      >
                        <option value="Bình thường">Bình thường</option>
                        <option value="Gấp">Gấp</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Sửa loại nhiệm vụ
                      </label>
                      <select
                        value={editingTask.taskType || "Thường xuyên"}
                        onChange={(e) =>
                          setEditingTask({
                            ...editingTask,
                            taskType: e.target.value as "Đột xuất" | "Thường xuyên",
                          })
                        }
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white text-slate-600 focus:outline-none"
                      >
                        <option value="Thường xuyên">Thường xuyên</option>
                        <option value="Đột xuất">Đột xuất</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3 justify-end border-t border-slate-100 pt-4 mt-6">
                <button
                  type="button"
                  onClick={() => setEditingTask(null)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-slate-500 text-xs font-medium hover:bg-slate-50 cursor-pointer"
                >
                  Đóng
                </button>
                <button
                  onClick={() => handleUpdateTask(editingTask)}
                  disabled={isSaving}
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 text-xs font-semibold cursor-pointer"
                >
                  {isSaving ? "Đang lưu..." : "Cập nhật thay đổi"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- WORKFLOW / PROCESS FOLDER MANAGEMENT MODAL --- */}
      {isFolderMgrOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-2xl p-6 shadow-2xl border border-slate-100 mx-4 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-5">
              <div className="flex items-center gap-2">
                <Folder className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-800 text-base">Quản Lý Thư Mục Quy Trình</h3>
              </div>
              <button
                onClick={() => {
                  setIsFolderMgrOpen(false);
                  setIsNewTaskOpen(true); // Return to task modal if that's where they came from
                }}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column: Existing Folders list */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Danh sách thư mục mẫu ({folders.length})
                </h4>

                {folders.length === 0 ? (
                  <div className="bg-slate-50 rounded-xl p-6 text-center border border-dashed border-slate-200">
                    <Folder className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs text-slate-400 italic">Chưa có thư mục quy trình nào được tạo.</p>
                  </div>
                ) : (
                  <div className="space-y-3.5 max-h-[400px] overflow-y-auto pr-1">
                    {folders.map((f) => (
                      <div
                        key={f.id}
                        className="bg-slate-50/50 hover:bg-slate-50 p-3.5 rounded-xl border border-slate-150 transition-all space-y-2"
                      >
                        {deletingFolderId === f.id ? (
                          <div className="bg-red-50 p-2.5 rounded-lg border border-red-100 space-y-2 animate-in slide-in-from-top-1">
                            <p className="text-[10px] text-red-700 font-bold">Bạn chắc chắn muốn xóa thư mục này?</p>
                            <div className="flex gap-2 justify-end">
                              <button
                                type="button"
                                onClick={() => setDeletingFolderId(null)}
                                className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 rounded text-[9px] font-bold cursor-pointer"
                              >
                                Hủy
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = folders.filter((x) => x.id !== f.id);
                                  setFolders(updated);
                                  localStorage.setItem("task_tracker_folders", JSON.stringify(updated));
                                  setDeletingFolderId(null);
                                  setFolderSuccessMsg(`Đã xóa thư mục "${f.name}".`);
                                  setFolderErrorMsg("");
                                  setTimeout(() => setFolderSuccessMsg(""), 3500);
                                }}
                                className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-[9px] font-bold cursor-pointer"
                              >
                                Xác nhận xóa
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-bold text-slate-800 text-xs">{f.name}</span>
                            <button
                              type="button"
                              onClick={() => setDeletingFolderId(f.id)}
                              className="text-red-500 hover:text-red-700 p-0.5 cursor-pointer"
                              title="Xóa thư mục"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}

                        {/* List steps overview */}
                        <div className="space-y-1 pl-1 border-l-2 border-indigo-200">
                          {f.subTasks && f.subTasks.length > 0 ? (
                            f.subTasks.map((step, sIdx) => (
                              <div key={step.id} className="text-[10px] text-slate-600 truncate">
                                <span className="font-semibold">{sIdx + 1}. {step.title}</span>{" "}
                                {step.durationDays ? `(${step.durationDays} ngày)` : ""}
                              </div>
                            ))
                          ) : (
                            <span className="text-[9px] text-slate-400 italic">Không có bước quy trình</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Right Column: Create / Design Folder form */}
              <div className="space-y-4 bg-slate-50/30 p-4.5 rounded-2xl border border-slate-100">
                <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-wider">
                  Thiết kế thư mục quy trình mới
                </h4>

                {/* Inline messages */}
                {folderErrorMsg && (
                  <div className="bg-red-50 border border-red-100 text-red-700 px-3 py-2 rounded-xl text-[11px] font-medium flex items-center gap-1.5 animate-in slide-in-from-top-1">
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0 animate-pulse" />
                    <span>{folderErrorMsg}</span>
                  </div>
                )}
                {folderSuccessMsg && (
                  <div className="bg-green-50 border border-green-100 text-green-800 px-3 py-2 rounded-xl text-[11px] font-medium flex items-center gap-1.5 animate-in slide-in-from-top-1">
                    <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                    <span>{folderSuccessMsg}</span>
                  </div>
                )}

                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                      Tên thư mục quy trình *
                    </label>
                    <input
                      type="text"
                      value={newFolderName}
                      onChange={(e) => {
                        setNewFolderName(e.target.value);
                        if (folderErrorMsg) setFolderErrorMsg("");
                      }}
                      placeholder="Ví dụ: Kiểm toán tài chính, Tiếp nhận bệnh nhân..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  {/* Add steps to folder draft */}
                  <div className="border-t border-slate-150 pt-3.5 space-y-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">
                      Các bước quy trình chuẩn của thư mục ({newFolderSteps.length})
                    </span>

                    {newFolderSteps.length > 0 && (
                      <div className="space-y-1.5 max-h-[120px] overflow-y-auto pr-1">
                        {newFolderSteps.map((step, idx) => (
                          <div
                            key={step.id}
                            className="flex items-center justify-between gap-1.5 p-2 bg-white rounded-lg border border-slate-150 text-[10px]"
                          >
                            <span className="font-semibold text-slate-700 truncate">
                              Bước {idx + 1}: {step.title} ({step.durationDays} ngày)
                            </span>
                            <button
                              type="button"
                              onClick={() => setNewFolderSteps(newFolderSteps.filter((s) => s.id !== step.id))}
                              className="text-red-500 hover:text-red-700 p-0.5 cursor-pointer shrink-0"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Step Builder Sub-Form */}
                    <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-3">
                      <div className="flex items-center gap-1.5 border-b border-slate-100 pb-1.5">
                        <PlusCircle className="w-3.5 h-3.5 text-indigo-500" />
                        <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                          Thêm bước thực hiện chuẩn mới
                        </span>
                      </div>

                      <div className="space-y-2.5">
                        <div>
                          <label className="block text-[9px] font-extrabold text-slate-500 uppercase tracking-wide mb-1">
                            Tên bước chuẩn *
                          </label>
                          <input
                            type="text"
                            value={tempStepTitle}
                            onChange={(e) => {
                              setTempStepTitle(e.target.value);
                              if (folderErrorMsg) setFolderErrorMsg("");
                            }}
                            placeholder="Ví dụ: Khảo sát thực tế, Lập biên bản..."
                            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2.5">
                          <div>
                            <label className="block text-[9px] font-extrabold text-slate-500 uppercase tracking-wide mb-1">
                              Thời gian hoàn thành *
                            </label>
                            <div className="relative">
                              <input
                                type="number"
                                min="1"
                                value={tempStepDuration}
                                onChange={(e) => setTempStepDuration(parseInt(e.target.value, 10) || 1)}
                                className="w-full pl-2.5 pr-10 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              />
                              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 pointer-events-none">
                                ngày
                              </span>
                            </div>
                          </div>

                          <div className="flex items-end">
                            <button
                              type="button"
                              onClick={() => {
                                if (!tempStepTitle.trim()) {
                                  setFolderErrorMsg("Vui lòng nhập tên bước chuẩn.");
                                  return;
                                }
                                const newS = {
                                  id: "step-" + Date.now() + Math.random().toString(36).substr(2, 5),
                                  title: tempStepTitle,
                                  durationDays: tempStepDuration,
                                  description: tempStepDesc || undefined,
                                };
                                setNewFolderSteps([...newFolderSteps, newS]);
                                setTempStepTitle("");
                                setTempStepDuration(2);
                                setTempStepDesc("");
                                setFolderErrorMsg("");
                              }}
                              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs transition-all cursor-pointer py-1.5 flex items-center justify-center gap-1 shadow-sm shadow-indigo-600/10"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              Thêm bước này
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[9px] font-extrabold text-slate-500 uppercase tracking-wide mb-1">
                            Mô tả công việc (không bắt buộc)
                          </label>
                          <input
                            type="text"
                            value={tempStepDesc}
                            onChange={(e) => setTempStepDesc(e.target.value)}
                            placeholder="Nhập hướng dẫn ngắn gọn cho nhân viên..."
                            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-[10px] focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (!newFolderName.trim()) {
                        setFolderErrorMsg("Vui lòng nhập tên thư mục quy trình.");
                        setFolderSuccessMsg("");
                        return;
                      }
                      if (newFolderSteps.length === 0) {
                        setFolderErrorMsg("Vui lòng thiết lập ít nhất 1 bước chuẩn cho thư mục này.");
                        setFolderSuccessMsg("");
                        return;
                      }

                      const newFolder: TaskFolder = {
                        id: "folder-" + Date.now(),
                        name: newFolderName,
                        createdByEmail: activeProfile.email,
                        createdAt: new Date().toISOString().split("T")[0],
                        subTasks: newFolderSteps,
                      };

                      const updated = [...folders, newFolder];
                      setFolders(updated);
                      localStorage.setItem("task_tracker_folders", JSON.stringify(updated));

                      // Reset design draft
                      setNewFolderName("");
                      setNewFolderSteps([]);
                      setFolderErrorMsg("");
                      setFolderSuccessMsg(`Đã lưu thành công thư mục quy trình "${newFolder.name}". Bây giờ bạn đã có thể chọn thư mục này khi tạo nhiệm vụ mới!`);
                      
                      // Auto-clear success message after 5 seconds
                      setTimeout(() => setFolderSuccessMsg(""), 6000);
                    }}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <PlusCircle className="w-4 h-4" />
                    Lưu thư mục quy trình
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end border-t border-slate-100 pt-4 mt-6">
              <button
                type="button"
                onClick={() => {
                  setIsFolderMgrOpen(false);
                  setIsNewTaskOpen(true); // Return to task modal
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold cursor-pointer transition-all"
              >
                Hoàn tất & Quay lại
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- CUSTOM TASK DELETION CONFIRMATION MODAL --- */}
      {taskToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl border border-slate-100 mx-4 animate-in zoom-in-95 duration-200">
            <div className="text-center space-y-4">
              <div className="w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="space-y-1.5">
                <h3 className="font-bold text-slate-800 text-sm">Xác nhận xóa nhiệm vụ</h3>
                <p className="text-xs text-slate-500">
                  Bạn có chắc chắn muốn xóa nhiệm vụ <span className="font-bold text-slate-700">"{taskToDelete.title}"</span> không? Hành động này sẽ được đồng bộ ngay lên Google Sheets.
                </p>
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setTaskToDelete(null)}
                  className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold rounded-xl text-xs cursor-pointer transition-all"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteTask}
                  className="w-full py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl text-xs cursor-pointer transition-all shadow-sm shadow-red-600/10"
                >
                  Xác nhận xóa
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
