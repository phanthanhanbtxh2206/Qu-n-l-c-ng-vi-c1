/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { User } from "firebase/auth";
import {
  googleSignIn,
  initAuth,
  logout,
  setAccessToken
} from "./firebase";
import {
  findSpreadsheet,
  createSpreadsheet,
  fetchTasks,
  fetchUsers,
  saveUserProfile,
  deleteUserProfile,
  saveTask,
  deleteTask,
  Task,
  UserProfile
} from "./googleSheets";
import DashboardView from "./components/DashboardView";
import TaskBoardView from "./components/TaskBoardView";
import UserListView from "./components/UserListView";
import {
  FileSpreadsheet,
  LogOut,
  User as UserIcon,
  LayoutDashboard,
  CheckSquare,
  Users,
  Loader,
  Sparkles,
  Building2,
  Lock,
  Key,
  Mail,
  Shield,
  ShieldCheck,
  ArrowRight,
  CheckCircle,
  Database,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
  Clock,
  Settings2,
  Terminal,
  Download,
  Upload,
  Trash2,
  Copy,
  Check,
} from "lucide-react";

// LocalStorage Keys
const LOCAL_USERS_KEY = "tasktracker_local_users_v2";
const LOCAL_TASKS_KEY = "tasktracker_local_tasks_v2";
const CURRENT_PROFILE_KEY = "tasktracker_current_profile_v2";
const SPREADSHEET_ID_KEY = "tasktracker_spreadsheet_id";

// Pre-seeded local users
const INITIAL_USERS: UserProfile[] = [
  { email: "phanthanhan.btxh@gmail.com", name: "Phan Thanh An (Admin)", role: "admin", department: "Ban Giám đốc", status: "Hoạt động", password: "123456" },
  { email: "nguyenvana.tech@gmail.com", name: "Nguyễn Văn Kỹ (Hành chính)", role: "Nhân viên", department: "Phòng TH-HC-KT", status: "Hoạt động", password: "123456" },
  { email: "lethib.plan@gmail.com", name: "Lê Thị Kế Hoạch (CTXH)", role: "Nhân viên", department: "Phòng CTXH&CSND", status: "Hoạt động", password: "123456" },
  { email: "tranvanc.admin@gmail.com", name: "Trần Văn Hành Chính", role: "Nhân viên", department: "Phòng TH-HC-KT", status: "Hoạt động", password: "123456" },
  { email: "phamvand.lead@gmail.com", name: "Phạm Văn Trưởng Phòng", role: "Lãnh đạo phòng", department: "Phòng CTXH&CSND", status: "Hoạt động", password: "123456" },
  { email: "hoangthee.deputy@gmail.com", name: "Hoàng Thế Phó Giám Đốc", role: "Phó Giám đốc", department: "Phòng Y tế - PHCN", status: "Hoạt động", password: "123456" },
  { email: "nguyenvanf.director@gmail.com", name: "Nguyễn Văn Giám Đốc", role: "Giám đốc", department: "Ban Giám đốc", status: "Hoạt động", password: "123456" },
];

export default function App() {
  // Auth & API States (Google Sheets Connection for Admin)
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(() => {
    return localStorage.getItem(SPREADSHEET_ID_KEY);
  });

  // Current logged in system user
  const [profile, setProfile] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem(CURRENT_PROFILE_KEY);
    return saved ? JSON.parse(saved) : null;
  });

  // Application Data States (Source of Truth is local, with Sheets backup for Admin)
  const [tasks, setTasks] = useState<Task[]>([]);
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);

  // Advanced Sync Settings for Admin
  const [autoSyncEnabled, setAutoSyncEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem("admin_auto_sync_enabled");
    return saved !== null ? saved === "true" : true;
  });
  const [syncScope, setSyncScope] = useState<"all" | "tasks" | "users">(() => {
    return (localStorage.getItem("admin_sync_scope") as "all" | "tasks" | "users") || "all";
  });
  const [conflictStrategy, setConflictStrategy] = useState<"client-wins" | "server-wins" | "merge-latest">(
    () => {
      return (
        (localStorage.getItem("admin_conflict_strategy") as
          | "client-wins"
          | "server-wins"
          | "merge-latest") || "client-wins"
      );
    }
  );
  const [syncLogs, setSyncLogs] = useState<string[]>(() => {
    const saved = localStorage.getItem("admin_sync_logs");
    return saved ? JSON.parse(saved) : [`[${new Date().toLocaleTimeString()}] Hệ thống đồng bộ sẵn sàng.`];
  });
  const [showAdvancedSync, setShowAdvancedSync] = useState(false);
  const [customSpreadsheetId, setCustomSpreadsheetId] = useState("");
  const [domainAuthError, setDomainAuthError] = useState(false);
  const [showSheetsGuide, setShowSheetsGuide] = useState(false);
  const [showScriptGuide, setShowScriptGuide] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [syncMethod, setSyncMethod] = useState<"oauth" | "appscript">(() => {
    return (localStorage.getItem("admin_sync_method") as "oauth" | "appscript") || "appscript";
  });
  const [webAppUrl, setWebAppUrl] = useState<string>(() => {
    return localStorage.getItem("google_apps_script_url") || "";
  });

  const addSyncLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const newLog = `[${timestamp}] ${message}`;
    setSyncLogs((prev) => {
      const updated = [newLog, ...prev].slice(0, 50); // limit to 50 logs
      localStorage.setItem("admin_sync_logs", JSON.stringify(updated));
      return updated;
    });
  };

  // Authentication mode: login vs register
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Register Form States
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regRole, setRegRole] = useState<UserProfile["role"]>("Nhân viên");
  const [regDept, setRegDept] = useState("Phòng CTXH&CSND");

  // Navigation tab state
  const [activeTab, setActiveTab] = useState<"dashboard" | "tasks" | "users">("dashboard");

  // Error/Success Alerts
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);

  // 1. Initial Data Seeding & Loading
  useEffect(() => {
    // Seed Users
    let localUsers = localStorage.getItem(LOCAL_USERS_KEY);
    if (!localUsers) {
      localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(INITIAL_USERS));
      localUsers = JSON.stringify(INITIAL_USERS);
    }
    const parsedUsers: UserProfile[] = JSON.parse(localUsers);
    setUsersList(parsedUsers);

    // Seed Tasks
    let localTasks = localStorage.getItem(LOCAL_TASKS_KEY);
    if (!localTasks) {
      const today = new Date();
      const formatDate = (daysOffset: number) => {
        const d = new Date(today);
        d.setDate(today.getDate() + daysOffset);
        return d.toISOString().split("T")[0];
      };

      const seedTasks: Task[] = [
        {
          id: "demo-task-1",
          title: "Thiết lập hệ thống hạ tầng server đám mây",
          description: "Triển khai Docker hóa toàn bộ ứng dụng và đưa lên môi trường test cloud.",
          assigneeEmail: "nguyenvana.tech@gmail.com",
          assigneeName: "Nguyễn Văn Kỹ (Hành chính)",
          department: "Phòng TH-HC-KT",
          createdByEmail: "phamvand.lead@gmail.com",
          createdByName: "Phạm Văn Trưởng Phòng",
          deadline: formatDate(2),
          progress: 60,
          status: "Đang thực hiện",
          selfAssessment: "Đang chạy tốt, cần test tải.",
          managerAssessment: "",
          managerComment: "",
          createdAt: formatDate(-5),
          updatedAt: formatDate(-1),
        },
        {
          id: "demo-task-2",
          title: "Lập báo cáo dự toán ngân sách quý 3",
          description: "Xây dựng ngân sách hoạt động chi tiết cho các phòng ban, trình Hội đồng phê duyệt.",
          assigneeEmail: "lethib.plan@gmail.com",
          assigneeName: "Lê Thị Kế Hoạch (CTXH)",
          department: "Phòng CTXH&CSND",
          createdByEmail: "hoangthee.deputy@gmail.com",
          createdByName: "Hoàng Thế Phó Giám Đốc",
          deadline: formatDate(-1),
          progress: 30,
          status: "Trễ hạn",
          selfAssessment: "Còn vướng số liệu bên Hành chính chưa gửi kịp.",
          managerAssessment: "",
          managerComment: "",
          createdAt: formatDate(-10),
          updatedAt: formatDate(-2),
        },
        {
          id: "demo-task-3",
          title: "Soạn thảo quy chế chi tiêu nội bộ năm 2026",
          description: "Cập nhật các định mức chi tiêu phòng họp, xăng xe và công tác phí theo thông tư mới.",
          assigneeEmail: "tranvanc.admin@gmail.com",
          assigneeName: "Trần Văn Hành Chính",
          department: "Phòng TH-HC-KT",
          createdByEmail: "nguyenvanf.director@gmail.com",
          createdByName: "Nguyễn Văn Giám Đốc",
          deadline: formatDate(5),
          progress: 100,
          status: "Đã hoàn thành",
          selfAssessment: "Đã nộp bản thảo hoàn chỉnh.",
          managerAssessment: "Đạt",
          managerComment: "Quy chế đầy đủ, chi tiết, áp dụng ngay.",
          createdAt: formatDate(-4),
          updatedAt: formatDate(0),
        },
        {
          id: "demo-task-4",
          title: "Nâng cấp giao diện website Trung tâm",
          description: "Tối ưu trải nghiệm mobile, nâng cấp lên Tailwind CSS v4, tối ưu SEO.",
          assigneeEmail: "nguyenvana.tech@gmail.com",
          assigneeName: "Nguyễn Văn Kỹ (Hành chính)",
          department: "Phòng TH-HC-KT",
          createdByEmail: "phamvand.lead@gmail.com",
          createdByName: "Phạm Văn Trưởng Phòng",
          deadline: formatDate(3),
          progress: 95,
          status: "Cần đánh giá",
          selfAssessment: "Đã sửa xong toàn bộ lỗi giao diện, kính mong sếp đánh giá.",
          managerAssessment: "",
          managerComment: "",
          createdAt: formatDate(-8),
          updatedAt: formatDate(-1),
        },
      ];
      localStorage.setItem(LOCAL_TASKS_KEY, JSON.stringify(seedTasks));
      localTasks = JSON.stringify(seedTasks);
    }
    setTasks(JSON.parse(localTasks));

    // Try auto-init Google Auth for Admin only if they are logged in as admin and had a session
    const unsubscribe = initAuth(
      (currentUser, accessToken) => {
        setGoogleUser(currentUser);
        setGoogleToken(accessToken);
      },
      () => {
        // No active google session or token cleared
      }
    );
    return () => unsubscribe();
  }, []);

  // Update profile in storage whenever state changes
  const saveProfileToLocalStorage = (updated: UserProfile | null) => {
    setProfile(updated);
    if (updated) {
      localStorage.setItem(CURRENT_PROFILE_KEY, JSON.stringify(updated));
    } else {
      localStorage.removeItem(CURRENT_PROFILE_KEY);
    }
  };

  // Auto-generate recurring tasks based on their scheduled interval
  useEffect(() => {
    if (tasks.length > 0) {
      const currentTasks = [...tasks];
      let hasNewTasks = false;
      const today = new Date();
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth() + 1; // 1-12
      const currentQuarter = Math.floor((currentMonth - 1) / 3) + 1; // 1-4

      const newGeneratedTasks: Task[] = [];

      currentTasks.forEach((t) => {
        if (t.isRecurring && !t.parentRecurringId) {
          let cycleKey = "";
          let scheduledDate: Date | null = null;

          if (t.recurrenceInterval === "hàng tháng") {
            const match = (t.recurrenceCustomDate || "").match(/Ngày (\d+|cuối cùng) hàng tháng/);
            if (match) {
              const dStr = match[1];
              if (dStr === "cuối cùng") {
                scheduledDate = new Date(currentYear, currentMonth, 0);
              } else {
                scheduledDate = new Date(currentYear, currentMonth - 1, parseInt(dStr, 10));
              }
              cycleKey = `${currentYear}-${String(currentMonth).padStart(2, "0")}`;
            }
          } else if (t.recurrenceInterval === "hàng quý") {
            const match = (t.recurrenceCustomDate || "").match(/Ngày (\d+|cuối cùng) của (tháng đầu tiên|tháng thứ hai|tháng thứ ba) trong quý/);
            if (match) {
              const dStr = match[1];
              const mType = match[2];

              let targetMonthOffset = 0;
              if (mType === "tháng thứ hai") targetMonthOffset = 1;
              else if (mType === "tháng thứ ba") targetMonthOffset = 2;

              const targetMonth = (currentQuarter - 1) * 3 + 1 + targetMonthOffset;

              if (dStr === "cuối cùng") {
                scheduledDate = new Date(currentYear, targetMonth, 0);
              } else {
                scheduledDate = new Date(currentYear, targetMonth - 1, parseInt(dStr, 10));
              }
              cycleKey = `${currentYear}-Q${currentQuarter}`;
            }
          } else if (t.recurrenceInterval === "hàng năm") {
            const match = (t.recurrenceCustomDate || "").match(/Ngày (\d+) tháng (\d+) hàng năm/);
            if (match) {
              const dVal = parseInt(match[1], 10);
              const mVal = parseInt(match[2], 10);

              scheduledDate = new Date(currentYear, mVal - 1, dVal);
              cycleKey = `${currentYear}-${String(mVal).padStart(2, "0")}`;
            }
          } else if (t.recurrenceInterval === "tự chọn") {
            const match = (t.recurrenceCustomDate || "").match(/(\d{4}-\d{2}-\d{2})/);
            if (match) {
              const dateStr = match[1];
              scheduledDate = new Date(dateStr);
              cycleKey = dateStr;
            }
          }

          if (scheduledDate && today >= scheduledDate) {
            const alreadyExists = currentTasks.some(
              (ct) => ct.parentRecurringId === t.id && ct.recurrenceCycleKey === cycleKey
            ) || newGeneratedTasks.some(
              (ct) => ct.parentRecurringId === t.id && ct.recurrenceCycleKey === cycleKey
            );

            if (!alreadyExists) {
              const parentCreated = t.createdAt ? new Date(t.createdAt) : new Date();
              const parentDeadline = t.deadline ? new Date(t.deadline) : new Date();
              const diffTime = Math.max(0, parentDeadline.getTime() - parentCreated.getTime());
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 5;

              const newCreatedDate = scheduledDate.toISOString().split("T")[0];
              const newDeadlineDate = new Date(scheduledDate);
              newDeadlineDate.setDate(newDeadlineDate.getDate() + diffDays);
              const formattedDeadline = newDeadlineDate.toISOString().split("T")[0];

              const resetSubTasks = t.subTasks ? t.subTasks.map((st) => ({ ...st, completed: false })) : [];

              const childTask: Task = {
                ...t,
                id: `recurring-task-${t.id}-${cycleKey}`,
                parentRecurringId: t.id,
                recurrenceCycleKey: cycleKey,
                isRecurring: false,
                status: "Chưa bắt đầu",
                progress: 0,
                selfAssessment: "",
                managerAssessment: "",
                managerComment: "",
                createdAt: newCreatedDate,
                startDate: newCreatedDate,
                deadline: formattedDeadline,
                updatedAt: new Date().toISOString().split("T")[0],
                subTasks: resetSubTasks,
              };

              newGeneratedTasks.push(childTask);
              hasNewTasks = true;
            }
          }
        }
      });

      if (hasNewTasks && newGeneratedTasks.length > 0) {
        const updatedList = [...tasks, ...newGeneratedTasks];
        localStorage.setItem(LOCAL_TASKS_KEY, JSON.stringify(updatedList));
        setTasks(updatedList);

        newGeneratedTasks.forEach(async (nt) => {
          if (autoSyncEnabled && (syncScope === "all" || syncScope === "tasks") && profile?.role === "admin" && googleToken && spreadsheetId) {
            try {
              await saveTask(spreadsheetId, googleToken, nt);
            } catch (err) {
              console.warn("Could not save auto-generated task in background:", err);
            }
          }
        });

        addSyncLog(`[Hệ thống] Tự động tạo ${newGeneratedTasks.length} nhiệm vụ lặp lại định kỳ.`);
      }
    }
  }, [tasks, googleToken, spreadsheetId, autoSyncEnabled, profile, syncScope]);

  // 2. Custom Register Handler
  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccess(null);

    const emailNorm = regEmail.trim().toLowerCase();
    if (!regName.trim() || !emailNorm || !regPassword) {
      setAuthError("Vui lòng điền đầy đủ các thông tin bắt buộc.");
      return;
    }

    // Check if email already exists
    const localUsers: UserProfile[] = JSON.parse(localStorage.getItem(LOCAL_USERS_KEY) || "[]");
    if (localUsers.some((u) => u.email.toLowerCase() === emailNorm)) {
      setAuthError("Email này đã được đăng ký trên hệ thống.");
      return;
    }

    // Create the new profile
    const newProfile: UserProfile = {
      email: emailNorm,
      name: regName.trim(),
      role: regRole,
      department: regRole === "admin" || regRole === "Giám đốc" ? "Ban Giám đốc" : regDept,
      status: "Chờ duyệt",
      password: regPassword,
    };

    // Save user
    const updatedUsers = [...localUsers, newProfile];
    localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(updatedUsers));
    setUsersList(updatedUsers);

    // Auto log in immediately
    saveProfileToLocalStorage(newProfile);
    setAuthSuccess("Đăng ký thành công! Đang chuyển vào hệ thống...");
  };

  // 3. Custom Login Handler
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccess(null);

    const emailNorm = loginEmail.trim().toLowerCase();
    if (!emailNorm) {
      setAuthError("Vui lòng nhập Email.");
      return;
    }

    if (!loginPassword) {
      setAuthError("Vui lòng nhập Mật khẩu.");
      return;
    }

    // Find user in local database
    const localUsers: UserProfile[] = JSON.parse(localStorage.getItem(LOCAL_USERS_KEY) || "[]");
    const matched = localUsers.find((u) => u.email.toLowerCase() === emailNorm);

    if (!matched) {
      setAuthError("Tài khoản chưa được đăng ký. Vui lòng chuyển qua tab Đăng ký.");
      return;
    }

    const expectedPassword = matched.password || "123456";
    if (loginPassword !== expectedPassword) {
      setAuthError("Mật khẩu không chính xác. Vui lòng thử lại.");
      return;
    }

    saveProfileToLocalStorage(matched);
    setAuthSuccess("Đăng nhập thành công!");
  };

  // Logout handler
  const handleSignOut = async () => {
    setIsLoadingData(true);
    try {
      if (googleToken) {
        await logout();
      }
      setGoogleUser(null);
      setGoogleToken(null);
      saveProfileToLocalStorage(null);
      setSyncStatusMsg(null);
      setLoginEmail("");
      setLoginPassword("");
      setAuthError(null);
      setAuthSuccess(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingData(false);
    }
  };

  // 4. Admin Google Sheets Sync System (Real synchronization)
  const handleConnectGoogle = async () => {
    setIsGoogleLoading(true);
    setDomainAuthError(false);
    try {
      const result = await googleSignIn();
      if (result) {
        setGoogleUser(result.user);
        setGoogleToken(result.accessToken);
        setSyncStatusMsg("Đã liên kết tài khoản Google thành công!");
        addSyncLog("Đã liên kết tài khoản Google thành công.");
        // Load initial spreadsheet metadata
        await loadSpreadsheetMetadata(result.accessToken);
      }
    } catch (err: any) {
      console.error(err);
      if (
        err.code === "auth/unauthorized-domain" ||
        err.message?.includes("unauthorized-domain") ||
        err.message?.includes("auth/unauthorized-domain")
      ) {
        setDomainAuthError(true);
        setSyncStatusMsg("Liên kết Google thất bại: Miền (domain) trang web chưa được ủy quyền trong Firebase.");
      } else {
        setSyncStatusMsg(`Liên kết Google thất bại: ${err.message}`);
      }
      addSyncLog(`Liên kết Google thất bại: ${err.message}`);
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const loadSpreadsheetMetadata = async (accessToken: string) => {
    try {
      let sheetId = await findSpreadsheet(accessToken);
      if (!sheetId) {
        sheetId = await createSpreadsheet(accessToken);
      }
      setSpreadsheetId(sheetId);
      localStorage.setItem(SPREADSHEET_ID_KEY, sheetId);
      addSyncLog(`Đang sử dụng tài liệu Google Sheets ID: ${sheetId}`);
    } catch (err: any) {
      console.error(err);
      addSyncLog(`Thất bại khi nạp thông tin tài liệu Sheets: ${err.message}`);
    }
  };

  // Push local storage source of truth to Google Sheets (Admin only)
  const handlePushToGoogleSheets = async () => {
    if (syncMethod === "appscript") {
      if (!webAppUrl) {
        setSyncStatusMsg("Vui lòng cấu hình URL Google Apps Script Web App trước.");
        return;
      }
      setIsLoadingData(true);
      setSyncStatusMsg("Đang đồng bộ dữ liệu lên Google Sheets qua Apps Script...");
      addSyncLog(`Bắt đầu đẩy dữ liệu qua Apps Script Web App (Phạm vi: ${syncScope === "all" ? "Tất cả" : syncScope === "tasks" ? "Nhiệm vụ" : "Nhân viên"})...`);

      try {
        const currentTasks: Task[] = JSON.parse(localStorage.getItem(LOCAL_TASKS_KEY) || "[]");
        const currentUsers: UserProfile[] = JSON.parse(localStorage.getItem(LOCAL_USERS_KEY) || "[]");

        const response = await fetch(webAppUrl, {
          method: "POST",
          mode: "cors",
          redirect: "follow",
          headers: {
            "Content-Type": "text/plain;charset=utf-8",
          },
          body: JSON.stringify({
            action: "push",
            tasks: syncScope === "all" || syncScope === "tasks" ? currentTasks : [],
            users: syncScope === "all" || syncScope === "users" ? currentUsers : [],
          }),
        });

        const resText = await response.text();
        let resJson;
        try {
          resJson = JSON.parse(resText);
        } catch (e) {
          throw new Error("Không thể phân tích phản hồi từ Web App. Hãy chắc chắn bạn đã Deploy cấu hình Web App ở quyền truy cập 'Anyone' (Bất kỳ ai).");
        }

        if (resJson.status === "success") {
          setSyncStatusMsg(resJson.message || "Đồng bộ thành công qua Apps Script!");
          addSyncLog(resJson.message || "Đồng bộ lên Google Sheets qua Apps Script thành công.");
        } else {
          throw new Error(resJson.message || "Lỗi không xác định từ Apps Script.");
        }
      } catch (err: any) {
        console.error(err);
        setSyncStatusMsg(`Đồng bộ Apps Script thất bại: ${err.message}`);
        addSyncLog(`Đồng bộ Apps Script thất bại: ${err.message}`);
      } finally {
        setIsLoadingData(false);
      }
      return;
    }

    if (!googleToken) {
      setSyncStatusMsg("Vui lòng click 'Kết nối Google' trước.");
      return;
    }
    setIsLoadingData(true);
    setSyncStatusMsg("Đang đồng bộ dữ liệu cục bộ lên Google Sheets...");
    addSyncLog(`Bắt đầu đẩy dữ liệu lên Google Sheets (Phạm vi: ${syncScope === "all" ? "Tất cả" : syncScope === "tasks" ? "Nhiệm vụ" : "Nhân viên"})...`);

    try {
      let sheetId = spreadsheetId;
      if (!sheetId) {
        sheetId = await findSpreadsheet(googleToken);
        if (!sheetId) {
          sheetId = await createSpreadsheet(googleToken);
        }
        setSpreadsheetId(sheetId);
        localStorage.setItem(SPREADSHEET_ID_KEY, sheetId);
      }

      const authHeaders = { Authorization: `Bearer ${googleToken}`, "Content-Type": "application/json" };

      // Helper to check response and throw if failed
      const safeFetch = async (url: string, init: RequestInit) => {
        const res = await fetch(url, init);
        if (!res.ok) {
          const errorMsg = await res.json().catch(() => ({})).then((data) => data.error?.message || `HTTP ${res.status}`);
          throw new Error(errorMsg);
        }
        return res;
      };

      // 1. Upload All local tasks (if scope is "all" or "tasks")
      if (syncScope === "all" || syncScope === "tasks") {
        const currentTasks: Task[] = JSON.parse(localStorage.getItem(LOCAL_TASKS_KEY) || "[]");
        // Clean sheet first
        const clearUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Tasks!A2:AA1000:clear`;
        await safeFetch(clearUrl, { method: "POST", headers: authHeaders });

        if (currentTasks.length > 0) {
          const values = currentTasks.map((t) => [
            t.id,
            t.title,
            t.description,
            t.assigneeEmail,
            t.assigneeName,
            t.department,
            t.createdByEmail,
            t.createdByName,
            t.deadline,
            t.progress.toString(),
            t.status,
            t.selfAssessment,
            t.managerAssessment,
            t.managerComment,
            t.createdAt,
            t.updatedAt,
            t.priority || "Bình thường",
            t.taskType || "Thường xuyên",
            t.isRecurring ? "TRUE" : "FALSE",
            t.recurrenceInterval || "",
            t.recurrenceCustomDate || "",
            t.folderId || "",
            t.folderName || "",
            t.subTasks ? JSON.stringify(t.subTasks) : "[]",
            t.parentRecurringId || "",
            t.recurrenceCycleKey || "",
            t.startDate || "",
          ]);
          const writeUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Tasks!A2?valueInputOption=USER_ENTERED`;
          await safeFetch(writeUrl, {
            method: "PUT",
            headers: authHeaders,
            body: JSON.stringify({ values }),
          });
        }
        addSyncLog(`Đã tải lên thành công ${currentTasks.length} nhiệm vụ lên Google Sheets.`);
      }

      // 2. Upload All local users (if scope is "all" or "users")
      if (syncScope === "all" || syncScope === "users") {
        const currentUsers: UserProfile[] = JSON.parse(localStorage.getItem(LOCAL_USERS_KEY) || "[]");
        const clearUsersUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Users!A2:F1000:clear`;
        await safeFetch(clearUsersUrl, { method: "POST", headers: authHeaders });

        if (currentUsers.length > 0) {
          const uValues = currentUsers.map((u) => [
            u.email,
            u.name,
            u.role,
            u.department,
            u.status,
            u.password || "123456",
          ]);
          const writeUsersUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Users!A2?valueInputOption=USER_ENTERED`;
          await safeFetch(writeUsersUrl, {
            method: "PUT",
            headers: authHeaders,
            body: JSON.stringify({ values: uValues }),
          });
        }
        addSyncLog(`Đã tải lên thành công ${currentUsers.length} tài khoản nhân sự lên Google Sheets.`);
      }

      setSyncStatusMsg("Đồng bộ thành công! Google Sheets đã được cập nhật bản mới nhất.");
      addSyncLog("Hoàn thành đồng bộ dữ liệu lên Google Sheets thành công.");
    } catch (err: any) {
      console.error(err);
      setSyncStatusMsg(`Đồng bộ thất bại: ${err.message}`);
      addSyncLog(`Đồng bộ thất bại: ${err.message}`);
    } finally {
      setIsLoadingData(false);
    }
  };

  // Pull tasks and users from Google Sheets and overwrite local storage (Admin only)
  const handlePullFromGoogleSheets = async () => {
    if (syncMethod === "appscript") {
      if (!webAppUrl) {
        setSyncStatusMsg("Vui lòng cấu hình URL Google Apps Script Web App trước.");
        return;
      }
      setIsLoadingData(true);
      setSyncStatusMsg("Đang tải dữ liệu từ Google Sheets về máy qua Apps Script...");
      addSyncLog(`Bắt đầu tải dữ liệu qua Apps Script (Chiến lược: ${
        conflictStrategy === "client-wins"
          ? "Ưu tiên máy khách (Client Wins)"
          : conflictStrategy === "server-wins"
          ? "Ưu tiên máy chủ (Server Wins)"
          : "Hợp nhất bản mới nhất (Merge Latest)"
      })...`);

      try {
        const response = await fetch(webAppUrl, {
          method: "POST",
          mode: "cors",
          redirect: "follow",
          headers: {
            "Content-Type": "text/plain;charset=utf-8",
          },
          body: JSON.stringify({
            action: "pull",
          }),
        });

        const resText = await response.text();
        let resJson;
        try {
          resJson = JSON.parse(resText);
        } catch (e) {
          throw new Error("Không thể phân tích phản hồi từ Web App. Hãy chắc chắn bạn đã Deploy cấu hình Web App ở quyền truy cập 'Anyone' (Bất kỳ ai).");
        }

        if (resJson.status !== "success") {
          throw new Error(resJson.message || "Lỗi phản hồi từ Google Apps Script.");
        }

        const fetchedTasks: Task[] = resJson.tasks || [];
        const fetchedUsers: UserProfile[] = resJson.users || [];

        if (conflictStrategy === "server-wins") {
          // Overwrite completely
          if (syncScope === "all" || syncScope === "tasks") {
            localStorage.setItem(LOCAL_TASKS_KEY, JSON.stringify(fetchedTasks));
            setTasks(fetchedTasks);
            addSyncLog(`[Ghi đè] Đã tải về thành công ${fetchedTasks.length} nhiệm vụ.`);
          }
          if (syncScope === "all" || syncScope === "users") {
            localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(fetchedUsers));
            setUsersList(fetchedUsers);
            addSyncLog(`[Ghi đè] Đã tải về thành công ${fetchedUsers.length} nhân sự.`);
          }
        } else if (conflictStrategy === "merge-latest") {
          // Merge based on updated time or existence
          if (syncScope === "all" || syncScope === "tasks") {
            const localTasks: Task[] = JSON.parse(localStorage.getItem(LOCAL_TASKS_KEY) || "[]");
            const mergedTasks = [...localTasks];

            fetchedTasks.forEach((ft) => {
              const matchedIdx = mergedTasks.findIndex((lt) => lt.id === ft.id);
              if (matchedIdx >= 0) {
                const localTime = new Date(mergedTasks[matchedIdx].updatedAt || 0).getTime();
                const remoteTime = new Date(ft.updatedAt || 0).getTime();
                if (remoteTime > localTime) {
                  mergedTasks[matchedIdx] = ft;
                }
              } else {
                mergedTasks.push(ft);
              }
            });

            localStorage.setItem(LOCAL_TASKS_KEY, JSON.stringify(mergedTasks));
            setTasks(mergedTasks);
            addSyncLog(`[Hợp nhất] Đồng bộ thành công ${mergedTasks.length} nhiệm vụ (Hợp nhất theo thời gian cập nhật).`);
          }

          if (syncScope === "all" || syncScope === "users") {
            const localUsers: UserProfile[] = JSON.parse(localStorage.getItem(LOCAL_USERS_KEY) || "[]");
            const mergedUsers = [...localUsers];

            fetchedUsers.forEach((fu) => {
              const matchedIdx = mergedUsers.findIndex((lu) => lu.email.toLowerCase() === fu.email.toLowerCase());
              if (matchedIdx >= 0) {
                mergedUsers[matchedIdx] = fu; // Keep the Google Sheets version as newer standard
              } else {
                mergedUsers.push(fu);
              }
            });

            localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(mergedUsers));
            setUsersList(mergedUsers);
            addSyncLog(`[Hợp nhất] Đồng bộ thành công ${mergedUsers.length} tài khoản nhân sự.`);
          }
        } else {
          // client-wins (When manually pulled, client-wins will still update empty local entries or load new ones, but avoids overwriting edited local items)
          if (syncScope === "all" || syncScope === "tasks") {
            const localTasks: Task[] = JSON.parse(localStorage.getItem(LOCAL_TASKS_KEY) || "[]");
            const mergedTasks = [...localTasks];

            fetchedTasks.forEach((ft) => {
              const exists = mergedTasks.some((lt) => lt.id === ft.id);
              if (!exists) {
                mergedTasks.push(ft);
              }
            });

            localStorage.setItem(LOCAL_TASKS_KEY, JSON.stringify(mergedTasks));
            setTasks(mergedTasks);
            addSyncLog(`[Cục bộ ưu tiên] Đã nạp thêm ${mergedTasks.length - localTasks.length} nhiệm vụ mới từ Google Sheets.`);
          }

          if (syncScope === "all" || syncScope === "users") {
            const localUsers: UserProfile[] = JSON.parse(localStorage.getItem(LOCAL_USERS_KEY) || "[]");
            const mergedUsers = [...localUsers];

            fetchedUsers.forEach((fu) => {
              const exists = mergedUsers.some((lu) => lu.email.toLowerCase() === fu.email.toLowerCase());
              if (!exists) {
                mergedUsers.push(fu);
              }
            });

            localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(mergedUsers));
            setUsersList(mergedUsers);
            addSyncLog(`[Cục bộ ưu tiên] Đã nạp thêm ${mergedUsers.length - localUsers.length} tài khoản mới từ Google Sheets.`);
          }
        }

        setSyncStatusMsg("Đã tải và xử lý đồng bộ dữ liệu thành công từ Google Sheets qua Apps Script.");
      } catch (err: any) {
        console.error(err);
        setSyncStatusMsg(`Không thể tải dữ liệu Apps Script: ${err.message}`);
        addSyncLog(`Thất bại khi tải dữ liệu từ Google Sheets qua Apps Script: ${err.message}`);
      } finally {
        setIsLoadingData(false);
      }
      return;
    }

    if (!googleToken || !spreadsheetId) {
      setSyncStatusMsg("Chưa kết nối hoặc chưa định cấu hình Google Sheets.");
      return;
    }
    setIsLoadingData(true);
    setSyncStatusMsg("Đang tải dữ liệu từ Google Sheets về máy...");
    addSyncLog(`Bắt đầu tải dữ liệu từ Sheets (Cấu hình giải quyết xung đột: ${
      conflictStrategy === "client-wins"
        ? "Ưu tiên máy khách (Client Wins)"
        : conflictStrategy === "server-wins"
        ? "Ưu tiên máy chủ (Server Wins)"
        : "Hợp nhất bản mới nhất (Merge Latest)"
    })...`);

    try {
      const [fetchedTasks, fetchedUsers] = await Promise.all([
        fetchTasks(spreadsheetId, googleToken),
        fetchUsers(spreadsheetId, googleToken),
      ]);

      if (conflictStrategy === "server-wins") {
        // Overwrite completely
        if (syncScope === "all" || syncScope === "tasks") {
          localStorage.setItem(LOCAL_TASKS_KEY, JSON.stringify(fetchedTasks));
          setTasks(fetchedTasks);
          addSyncLog(`[Ghi đè] Đã tải về thành công ${fetchedTasks.length} nhiệm vụ.`);
        }
        if (syncScope === "all" || syncScope === "users") {
          localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(fetchedUsers));
          setUsersList(fetchedUsers);
          addSyncLog(`[Ghi đè] Đã tải về thành công ${fetchedUsers.length} nhân sự.`);
        }
      } else if (conflictStrategy === "merge-latest") {
        // Merge based on updated time or existence
        if (syncScope === "all" || syncScope === "tasks") {
          const localTasks: Task[] = JSON.parse(localStorage.getItem(LOCAL_TASKS_KEY) || "[]");
          const mergedTasks = [...localTasks];

          fetchedTasks.forEach((ft) => {
            const matchedIdx = mergedTasks.findIndex((lt) => lt.id === ft.id);
            if (matchedIdx >= 0) {
              const localTime = new Date(mergedTasks[matchedIdx].updatedAt || 0).getTime();
              const remoteTime = new Date(ft.updatedAt || 0).getTime();
              if (remoteTime > localTime) {
                mergedTasks[matchedIdx] = ft;
              }
            } else {
              mergedTasks.push(ft);
            }
          });

          localStorage.setItem(LOCAL_TASKS_KEY, JSON.stringify(mergedTasks));
          setTasks(mergedTasks);
          addSyncLog(`[Hợp nhất] Đồng bộ thành công ${mergedTasks.length} nhiệm vụ (Hợp nhất theo thời gian cập nhật).`);
        }

        if (syncScope === "all" || syncScope === "users") {
          const localUsers: UserProfile[] = JSON.parse(localStorage.getItem(LOCAL_USERS_KEY) || "[]");
          const mergedUsers = [...localUsers];

          fetchedUsers.forEach((fu) => {
            const matchedIdx = mergedUsers.findIndex((lu) => lu.email.toLowerCase() === fu.email.toLowerCase());
            if (matchedIdx >= 0) {
              mergedUsers[matchedIdx] = fu; // Keep the Google Sheets version as newer standard
            } else {
              mergedUsers.push(fu);
            }
          });

          localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(mergedUsers));
          setUsersList(mergedUsers);
          addSyncLog(`[Hợp nhất] Đồng bộ thành công ${mergedUsers.length} tài khoản nhân sự.`);
        }
      } else {
        // client-wins (When manually pulled, client-wins will still update empty local entries or load new ones, but avoids overwriting edited local items)
        if (syncScope === "all" || syncScope === "tasks") {
          const localTasks: Task[] = JSON.parse(localStorage.getItem(LOCAL_TASKS_KEY) || "[]");
          const mergedTasks = [...localTasks];

          fetchedTasks.forEach((ft) => {
            const exists = mergedTasks.some((lt) => lt.id === ft.id);
            if (!exists) {
              mergedTasks.push(ft);
            }
          });

          localStorage.setItem(LOCAL_TASKS_KEY, JSON.stringify(mergedTasks));
          setTasks(mergedTasks);
          addSyncLog(`[Cục bộ ưu tiên] Đã nạp thêm ${mergedTasks.length - localTasks.length} nhiệm vụ mới từ Google Sheets.`);
        }

        if (syncScope === "all" || syncScope === "users") {
          const localUsers: UserProfile[] = JSON.parse(localStorage.getItem(LOCAL_USERS_KEY) || "[]");
          const mergedUsers = [...localUsers];

          fetchedUsers.forEach((fu) => {
            const exists = mergedUsers.some((lu) => lu.email.toLowerCase() === fu.email.toLowerCase());
            if (!exists) {
              mergedUsers.push(fu);
            }
          });

          localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(mergedUsers));
          setUsersList(mergedUsers);
          addSyncLog(`[Cục bộ ưu tiên] Đã nạp thêm ${mergedUsers.length - localUsers.length} tài khoản mới từ Google Sheets.`);
        }
      }

      setSyncStatusMsg("Đã tải và xử lý đồng bộ dữ liệu thành công từ Google Sheets.");
    } catch (err: any) {
      console.error(err);
      setSyncStatusMsg(`Không thể tải dữ liệu: ${err.message}`);
      addSyncLog(`Thất bại khi tải dữ liệu từ Google Sheets: ${err.message}`);
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleExportLocalData = () => {
    try {
      const dataToExport = {
        tasks: JSON.parse(localStorage.getItem(LOCAL_TASKS_KEY) || "[]"),
        users: JSON.parse(localStorage.getItem(LOCAL_USERS_KEY) || "[]"),
        exportedAt: new Date().toISOString(),
      };
      const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `task_tracker_backup_${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      addSyncLog("Đã xuất tệp sao lưu dữ liệu cục bộ JSON thành công.");
    } catch (err: any) {
      addSyncLog(`Lỗi khi xuất tệp sao lưu: ${err.message}`);
    }
  };

  const handleImportLocalData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed && (Array.isArray(parsed.tasks) || Array.isArray(parsed.users))) {
          if (Array.isArray(parsed.tasks)) {
            localStorage.setItem(LOCAL_TASKS_KEY, JSON.stringify(parsed.tasks));
            setTasks(parsed.tasks);
          }
          if (Array.isArray(parsed.users)) {
            localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(parsed.users));
            setUsersList(parsed.users);
          }
          addSyncLog("Đã nhập và khôi phục dữ liệu từ tệp sao lưu JSON thành công!");
          setSyncStatusMsg("Khôi phục dữ liệu từ tệp sao lưu thành công!");
        } else {
          addSyncLog("Tệp sao lưu không đúng định dạng chuẩn.");
          alert("Định dạng tệp không hợp lệ.");
        }
      } catch (err: any) {
        addSyncLog(`Lỗi khi khôi phục dữ liệu: ${err.message}`);
        alert("Khôi phục dữ liệu thất bại.");
      }
    };
    reader.readAsText(file);
  };

  // Handle task manipulation locally (synced with state & localStorage)
  const handleSaveTask = async (task: Task) => {
    const currentTasks: Task[] = JSON.parse(localStorage.getItem(LOCAL_TASKS_KEY) || "[]");
    const index = currentTasks.findIndex((t) => t.id === task.id);

    if (index >= 0) {
      currentTasks[index] = task;
    } else {
      currentTasks.push(task);
    }

    localStorage.setItem(LOCAL_TASKS_KEY, JSON.stringify(currentTasks));
    setTasks(currentTasks);

    // If active user is Admin and Google Sync is active, auto-backup in background to keep sheets hot!
    if (autoSyncEnabled && (syncScope === "all" || syncScope === "tasks") && profile?.role === "admin") {
      if (syncMethod === "appscript" && webAppUrl) {
        try {
          await fetch(webAppUrl, {
            method: "POST",
            mode: "cors",
            redirect: "follow",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "save_task", task }),
          });
          addSyncLog(`[Tự động] Đã lưu nhiệm vụ "${task.title}" lên Google Sheets.`);
        } catch (err: any) {
          console.warn("Background sheet backup failed:", err);
          addSyncLog(`[Lỗi tự động] Thất bại khi đồng bộ nhiệm vụ "${task.title}" qua Apps Script: ${err.message}`);
        }
      } else if (syncMethod === "oauth" && googleToken && spreadsheetId) {
        try {
          await saveTask(spreadsheetId, googleToken, task);
          addSyncLog(`[Tự động] Đã đồng bộ nhiệm vụ mới/cập nhật: "${task.title}".`);
        } catch (err: any) {
          console.warn("Background sheet backup failed:", err);
          addSyncLog(`[Lỗi tự động] Thất bại khi đồng bộ nhiệm vụ "${task.title}": ${err.message}`);
        }
      }
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    const currentTasks: Task[] = JSON.parse(localStorage.getItem(LOCAL_TASKS_KEY) || "[]");
    const filtered = currentTasks.filter((t) => t.id !== taskId);

    localStorage.setItem(LOCAL_TASKS_KEY, JSON.stringify(filtered));
    setTasks(filtered);

    // Backup to sheet if admin is synced
    if (autoSyncEnabled && (syncScope === "all" || syncScope === "tasks") && profile?.role === "admin") {
      if (syncMethod === "appscript" && webAppUrl) {
        try {
          await fetch(webAppUrl, {
            method: "POST",
            mode: "cors",
            redirect: "follow",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "delete_task", taskId }),
          });
          addSyncLog(`[Tự động] Đã xóa nhiệm vụ ID: "${taskId}" khỏi Google Sheets.`);
        } catch (err: any) {
          console.warn("Background sheet backup failed:", err);
          addSyncLog(`[Lỗi tự động] Thất bại khi xóa nhiệm vụ ID "${taskId}" qua Apps Script: ${err.message}`);
        }
      } else if (syncMethod === "oauth" && googleToken && spreadsheetId) {
        try {
          await deleteTask(spreadsheetId, googleToken, taskId);
          addSyncLog(`[Tự động] Đã xóa nhiệm vụ ID: "${taskId}" trên Sheets.`);
        } catch (err: any) {
          console.warn("Background sheet backup failed:", err);
          addSyncLog(`[Lỗi tự động] Thất bại khi xóa nhiệm vụ ID "${taskId}": ${err.message}`);
        }
      }
    }
  };

  const handleSaveUserProfile = async (updatedProfile: UserProfile, originalEmail?: string) => {
    const currentUsers: UserProfile[] = JSON.parse(localStorage.getItem(LOCAL_USERS_KEY) || "[]");
    const searchEmail = originalEmail || updatedProfile.email;
    const index = currentUsers.findIndex((u) => u.email.toLowerCase() === searchEmail.toLowerCase());

    if (index >= 0) {
      currentUsers[index] = updatedProfile;
    } else {
      currentUsers.push(updatedProfile);
    }

    localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(currentUsers));
    setUsersList(currentUsers);

    // Update active profile if self was updated
    if (profile && profile.email.toLowerCase() === searchEmail.toLowerCase()) {
      saveProfileToLocalStorage(updatedProfile);
    }

    // Sheet auto backup if admin is authenticated
    if (autoSyncEnabled && (syncScope === "all" || syncScope === "users") && profile?.role === "admin") {
      if (syncMethod === "appscript" && webAppUrl) {
        try {
          if (originalEmail && originalEmail.toLowerCase() !== updatedProfile.email.toLowerCase()) {
            await fetch(webAppUrl, {
              method: "POST",
              mode: "cors",
              redirect: "follow",
              headers: { "Content-Type": "text/plain;charset=utf-8" },
              body: JSON.stringify({ action: "delete_user", email: originalEmail }),
            });
          }
          await fetch(webAppUrl, {
            method: "POST",
            mode: "cors",
            redirect: "follow",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "save_user", user: updatedProfile }),
          });
          addSyncLog(`[Tự động] Đã đồng bộ nhân viên "${updatedProfile.name}" lên Google Sheets.`);
        } catch (err: any) {
          console.warn("Background sheet backup failed:", err);
          addSyncLog(`[Lỗi tự động] Thất bại khi đồng bộ nhân sự "${updatedProfile.name}" qua Apps Script: ${err.message}`);
        }
      } else if (syncMethod === "oauth" && googleToken && spreadsheetId) {
        try {
          if (originalEmail && originalEmail.toLowerCase() !== updatedProfile.email.toLowerCase()) {
            // Delete old email entry from Google Sheet
            await deleteUserProfile(spreadsheetId, googleToken, originalEmail);
          }
          await saveUserProfile(spreadsheetId, googleToken, updatedProfile);
          addSyncLog(`[Tự động] Đã đồng bộ nhân viên: "${updatedProfile.name}".`);
        } catch (err: any) {
          console.warn("Background sheet backup failed:", err);
          addSyncLog(`[Lỗi tự động] Thất bại khi đồng bộ nhân sự "${updatedProfile.name}": ${err.message}`);
        }
      }
    }
  };

  const handleDeleteUserProfile = async (email: string) => {
    const currentUsers: UserProfile[] = JSON.parse(localStorage.getItem(LOCAL_USERS_KEY) || "[]");
    const filteredUsers = currentUsers.filter((u) => u.email.toLowerCase() !== email.toLowerCase());

    localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(filteredUsers));
    setUsersList(filteredUsers);

    // If deleting current logged-in profile, sign them out
    if (profile && profile.email.toLowerCase() === email.toLowerCase()) {
      handleSignOut();
    }

    // Sheet auto backup if admin is authenticated
    if (autoSyncEnabled && (syncScope === "all" || syncScope === "users") && profile?.role === "admin") {
      if (syncMethod === "appscript" && webAppUrl) {
        try {
          await fetch(webAppUrl, {
            method: "POST",
            mode: "cors",
            redirect: "follow",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "delete_user", email }),
          });
          addSyncLog(`[Tự động] Đã xóa nhân viên "${email}" khỏi Google Sheets.`);
        } catch (err: any) {
          console.warn("Background sheet backup failed:", err);
          addSyncLog(`[Lỗi tự động] Thất bại khi xóa nhân sự "${email}" qua Apps Script: ${err.message}`);
        }
      } else if (syncMethod === "oauth" && googleToken && spreadsheetId) {
        try {
          await deleteUserProfile(spreadsheetId, googleToken, email);
          addSyncLog(`[Tự động] Đã xóa nhân viên: "${email}" trên Sheets.`);
        } catch (err: any) {
          console.warn("Background sheet backup failed:", err);
          addSyncLog(`[Lỗi tự động] Thất bại khi xóa nhân sự "${email}": ${err.message}`);
        }
      }
    }
  };

  const activeProfile = profile;

  // Render Login & Registration Screen
  if (!profile) {
    return (
      <div className="min-h-screen bg-gradient-to-tr from-slate-50 via-red-50/20 to-amber-50/30 flex flex-col justify-center items-center p-5 font-sans relative overflow-hidden select-none">
        {/* Custom CSS animations for dynamic national ascent & modern tech aura */}
        <style>{`
          @keyframes flowGlow1 {
            0% { transform: translate(0px, 0px) scale(1); opacity: 0.6; }
            33% { transform: translate(60px, -80px) scale(1.25); opacity: 0.8; }
            66% { transform: translate(-50px, 50px) scale(0.9); opacity: 0.7; }
            100% { transform: translate(0px, 0px) scale(1); opacity: 0.6; }
          }
          @keyframes flowGlow2 {
            0% { transform: translate(0px, 0px) scale(1); opacity: 0.5; }
            33% { transform: translate(-70px, 70px) scale(0.95); opacity: 0.7; }
            66% { transform: translate(60px, -60px) scale(1.2); opacity: 0.6; }
            100% { transform: translate(0px, 0px) scale(1); opacity: 0.5; }
          }
          @keyframes flowGlow3 {
            0% { transform: translate(0px, 0px) scale(1); opacity: 0.4; }
            50% { transform: translate(80px, 50px) scale(1.3); opacity: 0.65; }
            100% { transform: translate(0px, 0px) scale(1); opacity: 0.4; }
          }
          @keyframes gridScroll {
            0% { background-position: 0 0; }
            100% { background-position: 40px 40px; }
          }
          @keyframes floatParticle {
            0%, 100% { transform: translateY(0) translateX(0) scale(1); opacity: 0.3; }
            50% { transform: translateY(-50px) translateX(25px) scale(1.4); opacity: 0.9; }
          }
          .animate-flow-1 {
            animation: flowGlow1 14s infinite ease-in-out;
          }
          .animate-flow-2 {
            animation: flowGlow2 16s infinite ease-in-out;
          }
          .animate-flow-3 {
            animation: flowGlow3 20s infinite ease-in-out;
          }
          .animate-grid-scroll {
            animation: gridScroll 20s infinite linear;
          }
          .particle-1 { animation: floatParticle 8s infinite ease-in-out; }
          .particle-2 { animation: floatParticle 10s infinite ease-in-out 1.5s; }
          .particle-3 { animation: floatParticle 9s infinite ease-in-out 3s; }
          .particle-4 { animation: floatParticle 11s infinite ease-in-out 4.5s; }
          .particle-5 { animation: floatParticle 7s infinite ease-in-out 2s; }
          .login-card-container {
            position: relative;
            transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
            border-radius: 24px;
          }
          .login-card-container::before {
            content: '';
            position: absolute;
            inset: -2.5px;
            border-radius: 26.5px;
            background: linear-gradient(135deg, #ef4444, #f59e0b, #06b6d4, #ef4444);
            background-size: 300% 300%;
            z-index: -1;
            opacity: 0.12;
            transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
          }
          .login-card-container:hover {
            transform: translateY(-8px);
          }
          .login-card-container:hover::before {
            opacity: 1;
            animation: shimmerBorder 4s infinite linear;
            box-shadow: 0 15px 40px rgba(239, 68, 68, 0.2);
          }
          @keyframes shimmerBorder {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
          }
        `}</style>

        {/* Dynamic technology highway grid in warm golden-red representing our rising state */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ef444408_1px,transparent_1px),linear-gradient(to_bottom,#ef444408_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none animate-grid-scroll" />

        {/* Glowing background decor elements (Vibrant National Red, Sovereign Amber Gold, and Youthful Digital Cyan) formatted for a bright, clean look */}
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-red-500/10 rounded-full blur-[120px] pointer-events-none animate-flow-1" />
        <div className="absolute -bottom-20 -right-20 w-[550px] h-[550px] bg-amber-400/12 rounded-full blur-[110px] pointer-events-none animate-flow-2" />
        <div className="absolute top-1/4 right-1/4 w-[500px] h-[500px] bg-cyan-400/8 rounded-full blur-[100px] pointer-events-none animate-flow-3" />

        {/* Floating Sparks of Innovation */}
        <div className="absolute top-1/3 left-1/4 w-2 h-2 rounded-full bg-amber-500/60 blur-[0.5px] pointer-events-none particle-1" />
        <div className="absolute bottom-1/4 left-1/3 w-3 h-3 rounded-full bg-red-500/50 blur-[1px] pointer-events-none particle-2" />
        <div className="absolute top-1/4 right-1/3 w-2.5 h-2.5 rounded-full bg-yellow-500/60 blur-[0.5px] pointer-events-none particle-3" />
        <div className="absolute bottom-1/3 right-1/5 w-1.5 h-1.5 rounded-full bg-amber-400/60 blur-[0.5px] pointer-events-none particle-4" />
        <div className="absolute top-2/3 right-1/3 w-2 h-2 rounded-full bg-red-400/50 blur-[1px] pointer-events-none particle-5" />

        <div className="w-full max-w-xl relative z-10 login-card-container">
          <div className="w-full bg-white/95 backdrop-blur-xl rounded-[23px] overflow-hidden flex flex-col md:flex-row shadow-[0_0_60px_rgba(239,68,68,0.18)] border border-white/40">
          
          {/* Left panel: Info & Logo in National Era of Ascent Style */}
          <div className="w-full md:w-5/12 bg-gradient-to-b from-red-700 via-red-800 to-red-950 p-8 text-white flex flex-col justify-between shrink-0 relative overflow-hidden">
            {/* National rising aura background elements */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(251,191,36,0.18),transparent_50%)] pointer-events-none" />
            <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full bg-amber-500/10 blur-2xl pointer-events-none" />
            <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-red-500/20 blur-2xl pointer-events-none" />
            <div className="absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-amber-500/20 to-transparent pointer-events-none" />
            
            <div className="relative z-10">
              {/* Dynamic Rising Era Badge */}
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/35 text-amber-300 text-[8px] font-extrabold uppercase tracking-widest mb-5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                Kỷ Nguyên Vươn Mình
              </div>

              {/* Glowing National Star Logo */}
              <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-400 to-yellow-300 flex items-center justify-center mb-5 shadow-lg shadow-amber-500/35 transform hover:rotate-12 transition-transform duration-300">
                <svg className="w-9 h-9 text-red-700 drop-shadow-md" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                </svg>
              </div>

              <h1 className="text-lg font-black font-display tracking-tight leading-snug bg-gradient-to-r from-white via-amber-100 to-white bg-clip-text text-transparent">
                Hệ Thống Quản Lý &amp; Theo Dõi Tiến Độ
              </h1>
              <p className="text-amber-200/90 text-[10px] mt-1.5 font-bold tracking-wide uppercase">
                Trung tâm Bảo trợ xã hội Đà Nẵng
              </p>
            </div>

            {/* Production Information block representing development/service */}
            <div className="mt-8 border-t border-white/10 pt-5 relative z-10 space-y-2">
              <span className="text-[10px] text-red-100/85 font-medium block leading-relaxed italic">
                "Kiến tạo hiệu suất số, đồng lòng bứt phá vươn mình, tận tụy phụng sự xã hội."
              </span>
              <span className="text-[9px] text-amber-300/95 font-bold block tracking-wider uppercase">
                Sở Y tế thành phố Đà Nẵng
              </span>
            </div>
          </div>

          {/* Right panel: Tabbed Form */}
          <div className="flex-1 p-8 flex flex-col justify-between bg-white relative">
            <div>
              {/* Tab selector */}
              <div className="flex border-b border-slate-100 pb-3 mb-6">
                <button
                  onClick={() => {
                    setAuthMode("login");
                    setAuthError(null);
                    setAuthSuccess(null);
                  }}
                  className={`flex-1 text-center pb-2.5 text-xs font-black tracking-wider transition-all border-b-2 cursor-pointer ${
                    authMode === "login"
                      ? "border-red-600 text-red-600"
                      : "border-transparent text-slate-400 hover:text-slate-600"
                  }`}
                >
                  ĐĂNG NHẬP
                </button>
                <button
                  onClick={() => {
                    setAuthMode("register");
                    setAuthError(null);
                    setAuthSuccess(null);
                  }}
                  className={`flex-1 text-center pb-2.5 text-xs font-black tracking-wider transition-all border-b-2 cursor-pointer ${
                    authMode === "register"
                      ? "border-red-600 text-red-600"
                      : "border-transparent text-slate-400 hover:text-slate-600"
                  }`}
                >
                  ĐĂNG KÝ MỚI
                </button>
              </div>

              {/* Status Alert displays */}
              {authError && (
                <div className="mb-4 bg-rose-50 border border-rose-100 text-rose-700 rounded-xl p-3 text-[11px] font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                  <span>{authError}</span>
                </div>
              )}
              {authSuccess && (
                <div className="mb-4 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-xl p-3 text-[11px] font-semibold flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>{authSuccess}</span>
                </div>
              )}

              {/* LOGIN FORM */}
              {authMode === "login" ? (
                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                      Email Đăng nhập
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        required
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        placeholder="tenbancu@trungtam.com"
                        className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-red-500/20 focus:outline-none focus:border-red-500 bg-slate-50/50 transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                      Mật khẩu
                    </label>
                    <div className="relative">
                      <Key className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="password"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-red-500/20 focus:outline-none focus:border-red-500 bg-slate-50/50 transition-all"
                      />
                    </div>
                    <span className="text-[9px] text-slate-400 mt-1 block">
                      * Nhập bất kỳ mật khẩu nào để đăng nhập tài khoản test.
                    </span>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 mt-2 rounded-xl bg-gradient-to-r from-red-600 via-red-700 to-amber-600 hover:from-red-700 hover:to-amber-800 text-white text-xs font-bold cursor-pointer shadow-lg shadow-red-600/10 hover:shadow-red-700/30 transition-all transform hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2"
                  >
                    <span>Vào Hệ Thống</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              ) : (
                /* REGISTRATION FORM */
                <form onSubmit={handleRegister} className="space-y-3.5">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                      Họ và tên *
                    </label>
                    <input
                      type="text"
                      required
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      placeholder="Nguyễn Văn A"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-red-500/20 focus:outline-none focus:border-red-500 bg-slate-50/50 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                      Email liên kết *
                    </label>
                    <input
                      type="email"
                      required
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="nguyenvana@gmail.com"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-red-500/20 focus:outline-none focus:border-red-500 bg-slate-50/50 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                      Mật khẩu *
                    </label>
                    <input
                      type="password"
                      required
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="Đặt mật khẩu của bạn"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-red-500/20 focus:outline-none focus:border-red-500 bg-slate-50/50 transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                        Chức vụ / Vai trò *
                      </label>
                      <select
                        value={regRole}
                        onChange={(e) => setRegRole(e.target.value as UserProfile["role"])}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-all"
                      >
                        <option value="Nhân viên">Nhân viên</option>
                        <option value="Lãnh đạo phòng">Lãnh đạo phòng</option>
                        <option value="Phó Giám đốc">Phó Giám đốc</option>
                        <option value="Giám đốc">Giám đốc</option>
                        <option value="admin">Quản trị viên (Admin)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                        Phòng ban *
                      </label>
                      <select
                        value={regRole === "admin" || regRole === "Giám đốc" ? "Ban Giám đốc" : regDept}
                        disabled={regRole === "admin" || regRole === "Giám đốc"}
                        onChange={(e) => setRegDept(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white text-slate-700 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400 focus:ring-2 focus:ring-red-500/20 transition-all"
                      >
                        <option value="Phòng CTXH&CSND">Phòng CTXH&CSND</option>
                        <option value="Phòng TH-HC-KT">Phòng TH-HC-KT</option>
                        <option value="Phòng Y tế - PHCN">Phòng Y tế - PHCN</option>
                        <option value="Ban Giám đốc">Ban Giám đốc</option>
                      </select>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 mt-3 rounded-xl bg-gradient-to-r from-red-600 via-red-700 to-amber-600 hover:from-red-700 hover:to-amber-800 text-white text-xs font-bold cursor-pointer shadow-lg shadow-red-600/10 hover:shadow-red-700/30 transition-all transform hover:-translate-y-0.5 active:translate-y-0 text-center"
                  >
                    Đăng Ký &amp; Khởi Tạo Tài Khoản
                  </button>
                </form>
              )}
            </div>

            {/* Verification & Tech Badge */}
            <div className="mt-6 border-t border-slate-100 pt-4 flex items-center justify-center gap-1.5 text-[9px] text-slate-400 font-bold uppercase tracking-wider">
              <Lock className="w-3 h-3 text-red-600 animate-pulse" />
              Phiên bản hiện tại v2.5 • Hệ thống an toàn
            </div>
          </div>
          </div>
        </div>
      </div>
    );
  }

  // Render Pending Approval Screen if user is registered but not approved
  if (profile && profile.status === "Chờ duyệt") {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-5 font-sans animate-in fade-in duration-300">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden p-8 text-center space-y-6">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-500 shadow-md">
            <Clock className="w-8 h-8 animate-pulse" />
          </div>
          
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-slate-800 font-display">Tài khoản chưa được phê duyệt</h2>
            <p className="text-slate-500 text-xs leading-relaxed px-2">
              Xin chào <span className="font-semibold text-indigo-600">{profile.name}</span>. Tài khoản của bạn (<span className="font-mono text-[11px] text-slate-600">{profile.email}</span>) đã được đăng ký thành công nhưng đang ở trạng thái <strong className="text-amber-600">Chờ duyệt</strong>.
            </p>
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100/80 text-left space-y-2.5">
            <div className="flex items-start gap-2.5 text-xs text-slate-600">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
              <span><strong>Quyền hạn đăng ký:</strong> {profile.role}</span>
            </div>
            <div className="flex items-start gap-2.5 text-xs text-slate-600">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
              <span><strong>Phòng ban:</strong> {profile.department}</span>
            </div>
            <p className="text-[10px] text-slate-400 leading-normal border-t border-slate-100 pt-2.5 mt-1">
              * Quản trị viên (Admin) của hệ thống cần kiểm tra thông tin và phê duyệt tài khoản này trước khi bạn có thể truy cập các tính năng.
            </p>
          </div>

          <div className="pt-2 flex flex-col gap-2">
            <button
              onClick={handleSignOut}
              className="w-full py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-800 text-xs font-semibold cursor-pointer transition-all flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Đăng xuất tài khoản
            </button>
            
            <button
              onClick={async () => {
                // Refresh status by checking localStorage again
                setIsLoadingData(true);
                try {
                  const localUsers: UserProfile[] = JSON.parse(localStorage.getItem(LOCAL_USERS_KEY) || "[]");
                  const matched = localUsers.find((u) => u.email.toLowerCase() === profile.email.toLowerCase());
                  if (matched && matched.status === "Hoạt động") {
                    saveProfileToLocalStorage(matched);
                  }
                } finally {
                  setIsLoadingData(false);
                }
              }}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm cursor-pointer transition-all flex items-center justify-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingData ? 'animate-spin' : ''}`} />
              Kiểm tra lại trạng thái
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Active Main Dashboard UI
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans">
      
      {/* SIDEBAR NAVIGATION */}
      <aside className="w-full md:w-64 bg-slate-900 text-slate-300 flex flex-col justify-between shrink-0 border-r border-slate-800">
        <div>
          {/* Header Identity */}
          <div className="p-5 border-b border-slate-800 flex items-center gap-3 bg-slate-950/20">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-md shadow-indigo-600/15">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-extrabold text-white text-xs tracking-tight font-display leading-tight">
                Trung tâm Bảo trợ xã hội Đà Nẵng
              </h1>
              <span className="text-[9px] text-slate-500 font-semibold uppercase tracking-wider block">
                Sở Y tế thành phố Đà Nẵng.
              </span>
            </div>
          </div>

          {/* Logged user badge */}
          <div className="p-4 mx-3 my-4 bg-slate-950/40 rounded-2xl border border-slate-800/50 space-y-2 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center font-bold uppercase">
                {activeProfile?.name?.charAt(0) || "U"}
              </div>
              <div className="truncate">
                <span className="font-semibold text-slate-200 block truncate">{activeProfile?.name}</span>
                <span className="text-[9px] text-slate-500 block font-mono truncate">{activeProfile?.email}</span>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-slate-800/70 pt-2 text-[9px] font-bold">
              <span className="text-slate-400">VAI TRÒ:</span>
              <span className="text-indigo-400 uppercase tracking-wider">{activeProfile?.role}</span>
            </div>
            {activeProfile?.department && (
              <div className="flex items-center justify-between text-[9px] font-bold">
                <span className="text-slate-400">PHÒNG:</span>
                <span className="text-emerald-400 truncate max-w-[110px]" title={activeProfile?.department}>
                  {activeProfile?.department}
                </span>
              </div>
            )}
          </div>

          {/* Nav Tabs */}
          <nav className="px-3 space-y-1">
            <button
              onClick={() => setActiveTab("dashboard")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
                activeTab === "dashboard"
                  ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/10"
                  : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              }`}
            >
              <LayoutDashboard className="w-4 h-4 shrink-0" />
              Tổng quan & Thống kê
            </button>

            <button
              onClick={() => setActiveTab("tasks")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
                activeTab === "tasks"
                  ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/10"
                  : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              }`}
            >
              <CheckSquare className="w-4 h-4 shrink-0" />
              Nhiệm vụ công việc
            </button>

            <button
              onClick={() => setActiveTab("users")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
                activeTab === "users"
                  ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/10"
                  : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              }`}
            >
              <Users className="w-4 h-4 shrink-0" />
              Danh sách nhân viên
            </button>
          </nav>
        </div>

        {/* Sidebar Footer / Logout */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/20">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold border border-slate-800 hover:bg-red-500/10 hover:border-red-500/20 hover:text-red-400 cursor-pointer transition-all"
          >
            <LogOut className="w-4 h-4" />
            Đăng xuất
          </button>
        </div>
      </aside>

      {/* MAIN VIEW CONTENT AREA */}
      <main className="flex-1 flex flex-col overflow-hidden">
        
        {/* HEADER TOOLBAR */}
        <header className="bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between shadow-sm shrink-0">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <Building2 className="w-4 h-4 text-slate-400" />
            <span>Hệ thống Theo dõi Tiến độ CNTT</span>
            <span>/</span>
            <span className="text-slate-800 font-semibold uppercase">
              {activeTab === "dashboard"
                ? "Tổng quan & Thống kê"
                : activeTab === "tasks"
                ? "Bảng nhiệm vụ"
                : "Thành viên & Phân quyền"}
            </span>
          </div>

          <div className="flex items-center gap-4">

            {/* Direct Link to Spreadsheet (Available only for admins who have a spreadsheetId set) */}
            {profile?.role === "admin" && spreadsheetId && (
              <a
                href={`https://docs.google.com/spreadsheets/d/${spreadsheetId}`}
                target="_blank"
                rel="noreferrer"
                className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs font-medium cursor-pointer transition-all"
                title="Mở Google Sheets thời gian thực"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="truncate">Data Sheets (Admin)</span>
              </a>
            )}
          </div>
        </header>

        {/* SCROLLABLE INNER PAGE AREA */}
        <div className="flex-1 overflow-y-auto p-6 max-w-7xl w-full mx-auto">
          
          {/* SPECIAL ADMIN-ONLY SYNCHRONIZATION CONTROLLER */}
          {activeProfile?.role === "admin" && (
            <div className="bg-white rounded-2xl border border-indigo-100 shadow-sm p-5 mb-6">
              {/* Method Switcher Tabs */}
              <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-2">
                    CỔNG ĐỒNG BỘ GOOGLE SHEETS TRỰC TUYẾN
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Chọn phương thức tối ưu nhất để tự động hóa việc lưu trữ dữ liệu của trung tâm.
                  </p>
                </div>
                
                <div className="flex p-1 bg-slate-100 rounded-xl max-w-xs sm:max-w-md w-full sm:w-auto self-end sm:self-auto shrink-0">
                  <button
                    onClick={() => {
                      setSyncMethod("appscript");
                      localStorage.setItem("admin_sync_method", "appscript");
                      addSyncLog("Chuyển đổi phương thức sang Google Apps Script.");
                    }}
                    className={`flex-1 sm:flex-none px-4 py-1.5 text-center text-[11px] font-bold rounded-lg cursor-pointer transition-all ${
                      syncMethod === "appscript" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    Google Apps Script (Khuyên dùng)
                  </button>
                  <button
                    onClick={() => {
                      setSyncMethod("oauth");
                      localStorage.setItem("admin_sync_method", "oauth");
                      addSyncLog("Chuyển đổi phương thức sang OAuth liên kết.");
                    }}
                    className={`flex-1 sm:flex-none px-4 py-1.5 text-center text-[11px] font-bold rounded-lg cursor-pointer transition-all ${
                      syncMethod === "oauth" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    OAuth Firebase (Liên kết Popup)
                  </button>
                </div>
              </div>

              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                <div className="flex items-start gap-3 w-full">
                  <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600 shrink-0">
                    <FileSpreadsheet className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                        {syncMethod === "appscript" ? "ĐỒNG BỘ QUA GOOGLE APPS SCRIPT WEB APP" : "ĐỒNG BỘ QUA OAUTH POPUP WINDOW"}
                      </span>
                      {syncMethod === "appscript" ? (
                        webAppUrl ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[9px] font-bold border border-emerald-100 uppercase">
                            Đã cấu hình Web App
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 text-[9px] font-bold border border-amber-100 uppercase">
                            Chưa có URL Web App
                          </span>
                        )
                      ) : (
                        googleToken ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[9px] font-bold border border-emerald-100 uppercase">
                            Đã liên kết OAuth
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[9px] font-bold border border-slate-200 uppercase">
                            Chưa liên kết OAuth
                          </span>
                        )
                      )}
                    </div>

                    {syncMethod === "appscript" ? (
                      <div className="mt-2 space-y-2">
                        <p className="text-xs text-slate-500 leading-normal max-w-3xl">
                          Phương thức này không phụ thuộc vào Firebase, giúp loại bỏ hoàn toàn các lỗi chặn tên miền (unauthorized-domain). Bạn chỉ cần dán URL Web App đã phát hành từ Google Sheets vào đây.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-2 max-w-2xl">
                          <input
                            type="text"
                            value={webAppUrl}
                            onChange={(e) => {
                              const url = e.target.value.trim();
                              setWebAppUrl(url);
                              localStorage.setItem("google_apps_script_url", url);
                            }}
                            placeholder="Dán Google Apps Script Web App URL tại đây... (https://script.google.com/macros/s/.../exec)"
                            className="flex-1 px-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono text-[11px]"
                          />
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 mt-1 leading-normal max-w-2xl">
                        Liên kết trực tiếp với tài khoản Google Drive của bạn bằng cửa sổ Popup. Lưu ý phương pháp này yêu cầu phải cấu hình Authorized Domain trên bảng điều khiển Firebase trước khi chạy.
                      </p>
                    )}

                    {syncStatusMsg && (
                      <p className="text-[10px] text-indigo-600 font-semibold bg-indigo-50/50 px-2 py-1 rounded-lg mt-2 inline-block animate-pulse">
                        {syncStatusMsg}
                      </p>
                    )}
                  </div>
                </div>

                {/* Pull & Push Sync Buttons */}
                <div className="flex flex-wrap items-center gap-2 shrink-0 w-full lg:w-auto justify-end">
                  {syncMethod === "appscript" ? (
                    <>
                      <button
                        onClick={handlePullFromGoogleSheets}
                        disabled={isLoadingData || !webAppUrl}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-700 text-xs font-semibold cursor-pointer transition-all"
                        title="Tải từ Google Sheets về ghi đè bộ nhớ local"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isLoadingData ? "animate-spin" : ""}`} />
                        <span>Tải dữ liệu về</span>
                      </button>

                      <button
                        onClick={handlePushToGoogleSheets}
                        disabled={isLoadingData || !webAppUrl}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold cursor-pointer transition-all shadow-sm"
                        title="Đẩy dữ liệu local ghi đè lên Google Sheets"
                      >
                        <Database className="w-3.5 h-3.5" />
                        <span>Đồng bộ lên Sheets</span>
                      </button>
                    </>
                  ) : (
                    <>
                      {!googleToken ? (
                        <button
                          onClick={handleConnectGoogle}
                          disabled={isGoogleLoading}
                          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer shadow-sm transition-all"
                        >
                          {isGoogleLoading ? (
                            <Loader className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Lock className="w-3.5 h-3.5" />
                          )}
                          <span>Kết nối Google Sheets</span>
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={handlePullFromGoogleSheets}
                            disabled={isLoadingData}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer transition-all"
                            title="Tải từ Google Sheets về ghi đè bộ nhớ local"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingData ? "animate-spin" : ""}`} />
                            <span>Tải về từ Sheets</span>
                          </button>

                          <button
                            onClick={handlePushToGoogleSheets}
                            disabled={isLoadingData}
                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer transition-all shadow-sm"
                            title="Đẩy dữ liệu local ghi đè lên Google Sheets"
                          >
                            <Database className="w-3.5 h-3.5" />
                            <span>Đồng bộ lên Sheets</span>
                          </button>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Toggle advanced settings & guides buttons */}
              <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      setShowAdvancedSync(!showAdvancedSync);
                      if (spreadsheetId) {
                        setCustomSpreadsheetId(spreadsheetId);
                      }
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-800 hover:bg-slate-50 text-[11px] font-semibold transition-all cursor-pointer"
                  >
                    <Settings2 className="w-3.5 h-3.5 text-slate-500" />
                    <span>{showAdvancedSync ? "Ẩn cấu hình" : "Cấu hình nâng cao & Nhật ký"}</span>
                  </button>

                  {syncMethod === "appscript" ? (
                    <button
                      onClick={() => setShowScriptGuide(!showScriptGuide)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] font-semibold transition-all cursor-pointer ${
                        showScriptGuide
                          ? "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100"
                          : "border-slate-200 text-indigo-600 hover:text-indigo-800 hover:bg-slate-50"
                      }`}
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-500" />
                      <span>{showScriptGuide ? "Ẩn hướng dẫn cài đặt Script" : "Hướng dẫn tạo Script trên Google Sheets & Lấy URL"}</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => setShowSheetsGuide(!showSheetsGuide)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] font-semibold transition-all cursor-pointer ${
                        showSheetsGuide || domainAuthError
                          ? "bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
                          : "border-slate-200 text-indigo-600 hover:text-indigo-800 hover:bg-slate-50"
                      }`}
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      <span>{showSheetsGuide ? "Ẩn hướng dẫn liên kết" : "Hướng dẫn bật Google Sheets & Sửa lỗi"}</span>
                    </button>
                  )}
                </div>
                {syncMethod === "oauth" && spreadsheetId && (
                  <span className="text-[10px] text-slate-400 font-mono">
                    Spreadsheet ID: <span className="font-semibold text-slate-600 select-all">{spreadsheetId.slice(0, 10)}...{spreadsheetId.slice(-10)}</span>
                  </span>
                )}
              </div>

              {/* DYNAMIC GOOGLE SHEETS & FIREBASE AUTH TROUBLESHOOTING GUIDE */}
              {(showSheetsGuide || domainAuthError) && (
                <div className="mt-5 p-5 rounded-2xl bg-slate-50 border border-slate-200/80 text-slate-700 text-xs space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-red-100 rounded-lg text-red-600 shrink-0">
                        <AlertCircle className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-800 text-[13px] uppercase tracking-wide">
                          HƯỚNG DẪN CHI TIẾT BẬT KẾT NỐI GOOGLE SHEETS & SỬA LỖI DOMAIN
                        </h4>
                        <p className="text-[10px] text-slate-500">Giải quyết triệt để lỗi "Firebase: Error (auth/unauthorized-domain)"</p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setShowSheetsGuide(false);
                        setDomainAuthError(false);
                      }}
                      className="text-[10px] font-bold text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      Đóng hướng dẫn [X]
                    </button>
                  </div>

                  <div className="space-y-3">
                    <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl flex gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p className="font-bold text-amber-900 text-[11px]">Vì sao xảy ra lỗi này?</p>
                        <p className="text-[11px] text-amber-800 leading-normal">
                          Để bảo mật, Firebase Authentication yêu cầu bạn phải khai báo (ủy quyền) tất cả các tên miền chạy trang web của bạn trước khi cho phép đăng nhập Google Sheets qua cửa sổ Popup.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                        <ArrowRight className="w-3.5 h-3.5 text-indigo-500" />
                        Các bước thực hiện cấu hình trực tiếp trên Firebase Console:
                      </p>
                      
                      <div className="relative border-l border-indigo-100 ml-3 pl-4 space-y-4 text-slate-600">
                        {/* Step 1 */}
                        <div className="relative">
                          <span className="absolute -left-[25px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white">1</span>
                          <p className="font-semibold text-slate-800">Truy cập Firebase Console</p>
                          <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                            Mở trình duyệt và truy cập vào <a href="https://console.firebase.google.com/" target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline font-bold inline-flex items-center gap-0.5">Firebase Console (nhấp vào đây) <ArrowRight className="w-3 h-3 inline" /></a>. Nhấp chọn dự án của bạn (Tên dự án hiện tại là: <strong className="text-slate-800 font-mono">invertible-chord-8wjrd</strong>).
                          </p>
                        </div>

                        {/* Step 2 */}
                        <div className="relative">
                          <span className="absolute -left-[25px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white">2</span>
                          <p className="font-semibold text-slate-800">Vào mục Authentication</p>
                          <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                            Từ menu bên trái màn hình, tìm và chọn mục <strong>Build</strong> rồi click <strong>Authentication</strong>.
                          </p>
                        </div>

                        {/* Step 3 */}
                        <div className="relative">
                          <span className="absolute -left-[25px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white">3</span>
                          <p className="font-semibold text-slate-800">Mở phần Settings</p>
                          <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                            Tại màn hình Authentication, nhìn lên thanh menu ngang phía trên và chọn tab <strong>Settings</strong> (Cài đặt).
                          </p>
                        </div>

                        {/* Step 4 */}
                        <div className="relative">
                          <span className="absolute -left-[25px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white">4</span>
                          <p className="font-semibold text-slate-800">Thêm Tên miền trang web của bạn</p>
                          <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                            Ở danh sách menu dọc bên trái của phần Settings, nhấp chọn mục <strong>Authorized domains</strong> (Miền được ủy quyền). Sau đó nhấp vào nút <strong>Add domain</strong> (Thêm miền) ở góc bên phải.
                          </p>
                        </div>

                        {/* Step 5 */}
                        <div className="relative">
                          <span className="absolute -left-[25px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white">5</span>
                          <p className="font-semibold text-slate-800">Nhập thông tin tên miền ứng dụng</p>
                          <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                            Nhập chính xác tên miền trang web của bạn hiện tại vào ô trống rồi nhấn nút <strong>Add</strong>.
                          </p>
                          
                          <div className="mt-2 p-3 bg-white border border-slate-200 rounded-xl space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] text-slate-500">Tên miền trang web của bạn cần thêm:</span>
                              <span className="text-[10px] bg-red-50 text-red-600 border border-red-100 font-bold px-2 py-0.5 rounded uppercase">Cần thêm cái này</span>
                            </div>
                            <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 select-all font-mono text-xs text-indigo-600 font-bold">
                              <span>{typeof window !== "undefined" ? window.location.hostname : "phanthanhanbtxh2206.github.io"}</span>
                            </div>
                            <p className="text-[10px] text-slate-400 italic">
                              * Chú ý: Chỉ nhập tên miền gốc như trên, tuyệt đối KHÔNG nhập thêm tiền tố <code className="text-red-500">https://</code> hay hậu tố đường dẫn con như <code className="text-red-500">/Qu-n-l-c-ng-vi-c/</code>.
                            </p>
                          </div>
                        </div>

                        {/* Step 6 */}
                        <div className="relative">
                          <span className="absolute -left-[25px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white">6</span>
                          <p className="font-semibold text-slate-800">Hoàn thành & Thử lại</p>
                          <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                            Sau khi nhấn Add, tên miền sẽ xuất hiện trong danh sách ủy quyền. Bạn hãy quay lại trang web này, tải lại trang web (F5) rồi nhấp nút <strong>Kết nối Google Sheets</strong>. Lúc này cửa sổ đăng nhập Google sẽ hiển thị thành công!
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* GOOGLE APPS SCRIPT WEB APP STEP-BY-STEP SETUP GUIDE */}
              {showScriptGuide && (
                <div className="mt-5 p-5 rounded-2xl bg-slate-50 border border-slate-200/80 text-slate-700 text-xs space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-indigo-100 rounded-lg text-indigo-600 shrink-0">
                        <FileSpreadsheet className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-800 text-[13px] uppercase tracking-wide">
                          HƯỚNG DẪN THIẾT LẬP GOOGLE APPS SCRIPT CHO GOOGLE SHEETS
                        </h4>
                        <p className="text-[10px] text-slate-500">Giúp đồng bộ hóa dữ liệu thời gian thực không qua trung gian Firebase</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowScriptGuide(false)}
                      className="text-[10px] font-bold text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      Đóng hướng dẫn [X]
                    </button>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Left Steps */}
                    <div className="lg:col-span-5 space-y-3.5">
                      <p className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                        <ArrowRight className="w-3.5 h-3.5 text-indigo-500" />
                        Các bước triển khai chi tiết:
                      </p>

                      <div className="relative border-l border-indigo-100 ml-3 pl-4 space-y-4 text-slate-600">
                        <div className="relative">
                          <span className="absolute -left-[25px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white">1</span>
                          <p className="font-semibold text-slate-800">Mở Trang Google Sheets</p>
                          <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                            Mở một tệp Google Sheet mới tinh hoặc hiện có trong tài khoản của bạn.
                          </p>
                        </div>

                        <div className="relative">
                          <span className="absolute -left-[25px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white">2</span>
                          <p className="font-semibold text-slate-800">Mở Trình soạn thảo Apps Script</p>
                          <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                            Tại thanh menu của Google Sheets, nhấp chọn <strong>Extensions (Tiện ích mở rộng)</strong> rồi chọn <strong>Apps Script</strong>.
                          </p>
                        </div>

                        <div className="relative">
                          <span className="absolute -left-[25px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white">3</span>
                          <p className="font-semibold text-slate-800">Dán Mã nguồn & Lưu tệp</p>
                          <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                            Xóa toàn bộ mã nguồn mặc định có sẵn trong ô soạn thảo, dán toàn bộ đoạn mã nguồn ở khung bên phải vào, rồi nhấn biểu tượng <strong>Save (Đĩa mềm)</strong> ở trên đầu.
                          </p>
                        </div>

                        <div className="relative">
                          <span className="absolute -left-[25px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white">4</span>
                          <p className="font-semibold text-slate-800">Phát hành (Deploy) Web App</p>
                          <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                            Nhấp vào nút <strong>Deploy</strong> màu xanh ở phía trên góc phải, chọn <strong>New deployment</strong>. Nhấp biểu tượng bánh răng cài đặt, chọn loại hình là <strong>Web app</strong>.
                          </p>
                        </div>

                        <div className="relative">
                          <span className="absolute -left-[25px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white">5</span>
                          <p className="font-semibold text-slate-800">Cấu hình phân quyền truy cập</p>
                          <div className="text-[11px] text-slate-500 mt-0.5 leading-relaxed space-y-1 bg-amber-50/50 p-2.5 rounded-xl border border-amber-200/50">
                            <p>Thiết lập chính xác 2 thông số sau đây:</p>
                            <p>• <strong>Execute as (Chạy dưới dạng):</strong> Chọn <strong className="text-amber-900">Me (Tài khoản Google của tôi)</strong></p>
                            <p>• <strong>Who has access (Quyền truy cập):</strong> Chọn <strong className="text-amber-900">Anyone (Bất kỳ ai)</strong></p>
                          </div>
                        </div>

                        <div className="relative">
                          <span className="absolute -left-[25px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white">6</span>
                          <p className="font-semibold text-slate-800">Cấp quyền & Lấy URL Web App</p>
                          <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                            Nhấn nút <strong>Deploy</strong>. Google có thể yêu cầu bạn nhấn <strong>Authorize access</strong>, hãy nhấn xác nhận, chọn tài khoản của bạn, nhấn <strong>Advanced</strong> &rarr; chọn <strong>Go to ... (unsafe)</strong> rồi nhấn <strong>Allow</strong>.
                          </p>
                          <p className="text-[11px] text-emerald-600 font-bold mt-1.5 leading-relaxed">
                            Cuối cùng, sao chép chính xác dòng "Web app URL" (có đuôi là /exec) và dán vào ô nhập liệu ở hộp đồng bộ phía trên là hoàn tất!
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Right Code Block */}
                    <div className="lg:col-span-7 flex flex-col h-[480px]">
                      <div className="flex items-center justify-between bg-slate-900 text-slate-300 px-4 py-2.5 rounded-t-xl border-b border-slate-800">
                        <span className="font-mono text-[10px] uppercase font-bold tracking-wider text-slate-400">Code Apps Script (Dán vào Code.gs)</span>
                        <button
                          onClick={() => {
                            const code = `function doPost(e) {
  var response = { status: "error", message: "Unknown action" };
  try {
    var data = JSON.parse(e.postData.contents);
    var action = data.action;
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Tao sheet neu chua co
    var taskSheet = ss.getSheetByName("Nhiệm vụ") || ss.getSheetByName("Tasks");
    if (!taskSheet) {
      taskSheet = ss.insertSheet("Nhiệm vụ");
    }
    var userSheet = ss.getSheetByName("Nhân sự") || ss.getSheetByName("Users");
    if (!userSheet) {
      userSheet = ss.insertSheet("Nhân sự");
    }
    
    if (action === "push") {
      var tasks = data.tasks || [];
      var users = data.users || [];
      
      // 1. Ghi du lieu Nhiem vu
      taskSheet.clear();
      var taskHeaders = ["ID", "Tiêu đề", "Mô tả", "Ngày bắt đầu", "Hạn chót", "Trạng thái", "Tiến độ (%)", "Độ ưu tiên", "Người chịu trách nhiệm", "Email người chịu trách nhiệm", "Người kiểm duyệt", "Phòng ban", "Ngày tạo", "Cập nhật lúc"];
      taskSheet.appendRow(taskHeaders);
      taskSheet.getRange(1, 1, 1, taskHeaders.length).setFontWeight("bold").setBackground("#EEF2F6");
      
      if (tasks.length > 0) {
        var taskRows = tasks.map(function(t) {
          return [
            t.id || "",
            t.title || "",
            t.description || "",
            t.startDate || "",
            t.dueDate || "",
            t.status || "",
            t.progress || 0,
            t.priority || "",
            t.assignee || "",
            t.assigneeEmail || "",
            t.reviewer || "",
            t.department || "",
            t.createdAt || "",
            t.updatedAt || ""
          ];
        });
        taskSheet.getRange(2, 1, taskRows.length, taskHeaders.length).setValues(taskRows);
      }
      
      // 2. Ghi du lieu Nhan su
      userSheet.clear();
      var userHeaders = ["Họ và tên", "Email", "Mật khẩu", "Vai trò", "Phòng ban", "Ngày tạo"];
      userSheet.appendRow(userHeaders);
      userSheet.getRange(1, 1, 1, userHeaders.length).setFontWeight("bold").setBackground("#F0FDF4");
      
      if (users.length > 0) {
        var userRows = users.map(function(u) {
          return [
            u.name || "",
            u.email || "",
            u.password || "",
            u.role || "",
            u.department || "",
            u.createdAt || ""
          ];
        });
        userSheet.getRange(2, 1, userRows.length, userHeaders.length).setValues(userRows);
      }
      
      response = { status: "success", message: "Đồng bộ dữ liệu thành công!" };
      
    } else if (action === "pull") {
      var tasks = [];
      var users = [];
      
      // 1. Doc du lieu Nhiem vu
      if (taskSheet.getLastRow() > 1) {
        var taskValues = taskSheet.getRange(2, 1, taskSheet.getLastRow() - 1, 14).getValues();
        tasks = taskValues.map(function(row) {
          return {
            id: String(row[0]),
            title: String(row[1]),
            description: String(row[2]),
            startDate: row[3] ? new Date(row[3]).toISOString().slice(0, 10) : "",
            dueDate: row[4] ? new Date(row[4]).toISOString().slice(0, 10) : "",
            status: String(row[5]),
            progress: Number(row[6]) || 0,
            priority: String(row[7]),
            assignee: String(row[8]),
            assigneeEmail: String(row[9]),
            reviewer: String(row[10]),
            department: String(row[11]),
            createdAt: row[12] ? new Date(row[12]).toISOString() : "",
            updatedAt: row[13] ? new Date(row[13]).toISOString() : ""
          };
        });
      }
      
      // 2. Doc du lieu Nhan su
      if (userSheet.getLastRow() > 1) {
        var userValues = userSheet.getRange(2, 1, userSheet.getLastRow() - 1, 6).getValues();
        users = userValues.map(function(row) {
          return {
            name: String(row[0]),
            email: String(row[1]),
            password: String(row[2]),
            role: String(row[3]),
            department: String(row[4]),
            createdAt: row[5] ? new Date(row[5]).toISOString() : ""
          };
        });
      }
      
      response = { status: "success", tasks: tasks, users: users };
      
    } else if (action === "save_task") {
      var task = data.task;
      if (task) {
        var taskHeaders = ["ID", "Tiêu đề", "Mô tả", "Ngày bắt đầu", "Hạn chót", "Trạng thái", "Tiến độ (%)", "Độ ưu tiên", "Người chịu trách nhiệm", "Email người chịu trách nhiệm", "Người kiểm duyệt", "Phòng ban", "Ngày tạo", "Cập nhật lúc"];
        if (taskSheet.getLastRow() === 0) {
          taskSheet.appendRow(taskHeaders);
          taskSheet.getRange(1, 1, 1, taskHeaders.length).setFontWeight("bold").setBackground("#EEF2F6");
        }
        var foundRow = -1;
        if (taskSheet.getLastRow() > 1) {
          var ids = taskSheet.getRange(2, 1, taskSheet.getLastRow() - 1, 1).getValues();
          for (var i = 0; i < ids.length; i++) {
            if (String(ids[i][0]) === String(task.id)) {
              foundRow = i + 2;
              break;
            }
          }
        }
        var rowData = [
          task.id || "",
          task.title || "",
          task.description || "",
          task.startDate || "",
          task.dueDate || "",
          task.status || "",
          task.progress || 0,
          task.priority || "",
          task.assignee || "",
          task.assigneeEmail || "",
          task.reviewer || "",
          task.department || "",
          task.createdAt || "",
          task.updatedAt || ""
        ];
        if (foundRow > 0) {
          taskSheet.getRange(foundRow, 1, 1, rowData.length).setValues([rowData]);
        } else {
          taskSheet.appendRow(rowData);
        }
        response = { status: "success", message: "Task saved" };
      }
    } else if (action === "delete_task") {
      var taskId = data.taskId;
      if (taskId && taskSheet.getLastRow() > 1) {
        var ids = taskSheet.getRange(2, 1, taskSheet.getLastRow() - 1, 1).getValues();
        for (var i = 0; i < ids.length; i++) {
          if (String(ids[i][0]) === String(taskId)) {
            taskSheet.deleteRow(i + 2);
            break;
          }
        }
        response = { status: "success", message: "Task deleted" };
      }
    } else if (action === "save_user") {
      var user = data.user;
      if (user) {
        var userHeaders = ["Họ và tên", "Email", "Mật khẩu", "Vai trò", "Phòng ban", "Ngày tạo"];
        if (userSheet.getLastRow() === 0) {
          userSheet.appendRow(userHeaders);
          userSheet.getRange(1, 1, 1, userHeaders.length).setFontWeight("bold").setBackground("#F0FDF4");
        }
        var foundRow = -1;
        if (userSheet.getLastRow() > 1) {
          var emails = userSheet.getRange(2, 2, userSheet.getLastRow() - 1, 1).getValues();
          for (var i = 0; i < emails.length; i++) {
            if (String(emails[i][0]).toLowerCase() === String(user.email).toLowerCase()) {
              foundRow = i + 2;
              break;
            }
          }
        }
        var rowData = [
          user.name || "",
          user.email || "",
          user.password || "",
          user.role || "",
          user.department || "",
          user.createdAt || ""
        ];
        if (foundRow > 0) {
          userSheet.getRange(foundRow, 1, 1, rowData.length).setValues([rowData]);
        } else {
          userSheet.appendRow(rowData);
        }
        response = { status: "success", message: "User saved" };
      }
    } else if (action === "delete_user") {
      var email = data.email;
      if (email && userSheet.getLastRow() > 1) {
        var emails = userSheet.getRange(2, 2, userSheet.getLastRow() - 1, 1).getValues();
        for (var i = 0; i < emails.length; i++) {
          if (String(emails[i][0]).toLowerCase() === String(email).toLowerCase()) {
            userSheet.deleteRow(i + 2);
            break;
          }
        }
        response = { status: "success", message: "User deleted" };
      }
    }
  } catch (err) {
    response = { status: "error", message: err.toString() };
  }
  
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "Web App active" }))
    .setMimeType(ContentService.MimeType.JSON);
}`;
                            navigator.clipboard.writeText(code);
                            setIsCopied(true);
                            setTimeout(() => setIsCopied(false), 2000);
                          }}
                          className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold cursor-pointer transition-all shadow-sm"
                        >
                          {isCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          <span>{isCopied ? "Đã sao chép!" : "Sao chép toàn bộ mã"}</span>
                        </button>
                      </div>
                      <div className="flex-1 overflow-auto bg-slate-950 p-4 rounded-b-xl border border-t-0 border-slate-800 font-mono text-[10px] text-indigo-300 leading-relaxed select-all">
                        <pre>{`function doPost(e) {
  var response = { status: "error", message: "Unknown action" };
  try {
    var data = JSON.parse(e.postData.contents);
    var action = data.action;
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Tạo sheet nếu chưa có
    var taskSheet = ss.getSheetByName("Nhiệm vụ") || ss.getSheetByName("Tasks");
    if (!taskSheet) {
      taskSheet = ss.insertSheet("Nhiệm vụ");
    }
    var userSheet = ss.getSheetByName("Nhân sự") || ss.getSheetByName("Users");
    if (!userSheet) {
      userSheet = ss.insertSheet("Nhân sự");
    }
    
    if (action === "push") {
      var tasks = data.tasks || [];
      var users = data.users || [];
      
      // 1. Ghi dữ liệu Nhiệm vụ
      taskSheet.clear();
      var taskHeaders = ["ID", "Tiêu đề", "Mô tả", "Ngày bắt đầu", "Hạn chót", "Trạng thái", "Tiến độ (%)", "Độ ưu tiên", "Người chịu trách nhiệm", "Email người chịu trách nhiệm", "Người kiểm duyệt", "Phòng ban", "Ngày tạo", "Cập nhật lúc"];
      taskSheet.appendRow(taskHeaders);
      taskSheet.getRange(1, 1, 1, taskHeaders.length).setFontWeight("bold").setBackground("#EEF2F6");
      
      if (tasks.length > 0) {
        var taskRows = tasks.map(function(t) {
          return [
            t.id || "",
            t.title || "",
            t.description || "",
            t.startDate || "",
            t.dueDate || "",
            t.status || "",
            t.progress || 0,
            t.priority || "",
            t.assignee || "",
            t.assigneeEmail || "",
            t.reviewer || "",
            t.department || "",
            t.createdAt || "",
            t.updatedAt || ""
          ];
        });
        taskSheet.getRange(2, 1, taskRows.length, taskHeaders.length).setValues(taskRows);
      }
      
      // 2. Ghi dữ liệu Nhân sự
      userSheet.clear();
      var userHeaders = ["Họ và tên", "Email", "Mật khẩu", "Vai trò", "Phòng ban", "Ngày tạo"];
      userSheet.appendRow(userHeaders);
      userSheet.getRange(1, 1, 1, userHeaders.length).setFontWeight("bold").setBackground("#F0FDF4");
      
      if (users.length > 0) {
        var userRows = users.map(function(u) {
          return [
            u.name || "",
            u.email || "",
            u.password || "",
            u.role || "",
            u.department || "",
            u.createdAt || ""
          ];
        });
        userSheet.getRange(2, 1, userRows.length, userHeaders.length).setValues(userRows);
      }
      
      response = { status: "success", message: "Đồng bộ dữ liệu thành công!" };
      
    } else if (action === "pull") {
      var tasks = [];
      var users = [];
      
      // 1. Đọc dữ liệu Nhiệm vụ
      if (taskSheet.getLastRow() > 1) {
        var taskValues = taskSheet.getRange(2, 1, taskSheet.getLastRow() - 1, 14).getValues();
        tasks = taskValues.map(function(row) {
          return {
            id: String(row[0]),
            title: String(row[1]),
            description: String(row[2]),
            startDate: row[3] ? new Date(row[3]).toISOString().slice(0, 10) : "",
            dueDate: row[4] ? new Date(row[4]).toISOString().slice(0, 10) : "",
            status: String(row[5]),
            progress: Number(row[6]) || 0,
            priority: String(row[7]),
            assignee: String(row[8]),
            assigneeEmail: String(row[9]),
            reviewer: String(row[10]),
            department: String(row[11]),
            createdAt: row[12] ? new Date(row[12]).toISOString() : "",
            updatedAt: row[13] ? new Date(row[13]).toISOString() : ""
          };
        });
      }
      
      // 2. Đọc dữ liệu Nhân sự
      if (userSheet.getLastRow() > 1) {
        var userValues = userSheet.getRange(2, 1, userSheet.getLastRow() - 1, 6).getValues();
        users = userValues.map(function(row) {
          return {
            name: String(row[0]),
            email: String(row[1]),
            password: String(row[2]),
            role: String(row[3]),
            department: String(row[4]),
            createdAt: row[5] ? new Date(row[5]).toISOString() : ""
          };
        });
      }
      
      response = { status: "success", tasks: tasks, users: users };
      
    } else if (action === "save_task") {
      var task = data.task;
      if (task) {
        var taskHeaders = ["ID", "Tiêu đề", "Mô tả", "Ngày bắt đầu", "Hạn chót", "Trạng thái", "Tiến độ (%)", "Độ ưu tiên", "Người chịu trách nhiệm", "Email người chịu trách nhiệm", "Người kiểm duyệt", "Phòng ban", "Ngày tạo", "Cập nhật lúc"];
        if (taskSheet.getLastRow() === 0) {
          taskSheet.appendRow(taskHeaders);
          taskSheet.getRange(1, 1, 1, taskHeaders.length).setFontWeight("bold").setBackground("#EEF2F6");
        }
        var foundRow = -1;
        if (taskSheet.getLastRow() > 1) {
          var ids = taskSheet.getRange(2, 1, taskSheet.getLastRow() - 1, 1).getValues();
          for (var i = 0; i < ids.length; i++) {
            if (String(ids[i][0]) === String(task.id)) {
              foundRow = i + 2;
              break;
            }
          }
        }
        var rowData = [
          task.id || "",
          task.title || "",
          task.description || "",
          task.startDate || "",
          task.dueDate || "",
          task.status || "",
          task.progress || 0,
          task.priority || "",
          task.assignee || "",
          task.assigneeEmail || "",
          task.reviewer || "",
          task.department || "",
          task.createdAt || "",
          task.updatedAt || ""
        ];
        if (foundRow > 0) {
          taskSheet.getRange(foundRow, 1, 1, rowData.length).setValues([rowData]);
        } else {
          taskSheet.appendRow(rowData);
        }
        response = { status: "success", message: "Task saved" };
      }
    } else if (action === "delete_task") {
      var taskId = data.taskId;
      if (taskId && taskSheet.getLastRow() > 1) {
        var ids = taskSheet.getRange(2, 1, taskSheet.getLastRow() - 1, 1).getValues();
        for (var i = 0; i < ids.length; i++) {
          if (String(ids[i][0]) === String(taskId)) {
            taskSheet.deleteRow(i + 2);
            break;
          }
        }
        response = { status: "success", message: "Task deleted" };
      }
    } else if (action === "save_user") {
      var user = data.user;
      if (user) {
        var userHeaders = ["Họ và tên", "Email", "Mật khẩu", "Vai trò", "Phòng ban", "Ngày tạo"];
        if (userSheet.getLastRow() === 0) {
          userSheet.appendRow(userHeaders);
          userSheet.getRange(1, 1, 1, userHeaders.length).setFontWeight("bold").setBackground("#F0FDF4");
        }
        var foundRow = -1;
        if (userSheet.getLastRow() > 1) {
          var emails = userSheet.getRange(2, 2, userSheet.getLastRow() - 1, 1).getValues();
          for (var i = 0; i < emails.length; i++) {
            if (String(emails[i][0]).toLowerCase() === String(user.email).toLowerCase()) {
              foundRow = i + 2;
              break;
            }
          }
        }
        var rowData = [
          user.name || "",
          user.email || "",
          user.password || "",
          user.role || "",
          user.department || "",
          user.createdAt || ""
        ];
        if (foundRow > 0) {
          userSheet.getRange(foundRow, 1, 1, rowData.length).setValues([rowData]);
        } else {
          userSheet.appendRow(rowData);
        }
        response = { status: "success", message: "User saved" };
      }
    } else if (action === "delete_user") {
      var email = data.email;
      if (email && userSheet.getLastRow() > 1) {
        var emails = userSheet.getRange(2, 2, userSheet.getLastRow() - 1, 1).getValues();
        for (var i = 0; i < emails.length; i++) {
          if (String(emails[i][0]).toLowerCase() === String(email).toLowerCase()) {
            userSheet.deleteRow(i + 2);
            break;
          }
        }
        response = { status: "success", message: "User deleted" };
      }
    }
  } catch (err) {
    response = { status: "error", message: err.toString() };
  }
  
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "Web App active" }))
    .setMimeType(ContentService.MimeType.JSON);
}`}</pre>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ADVANCED SYNC SETTINGS PANEL */}
              {showAdvancedSync && (
                <div className="mt-5 pt-5 border-t border-slate-100 grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in duration-200">
                  
                  {/* LEFT COLUMN: CONFIGURATION CONTROLS */}
                  <div className="lg:col-span-7 space-y-5">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Settings2 className="w-3.5 h-3.5 text-indigo-500" />
                      Cấu hình đồng bộ hóa nâng cao
                    </h4>

                    {/* Auto Sync Toggle */}
                    <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 flex items-start gap-3">
                      <input
                        type="checkbox"
                        id="auto_sync"
                        checked={autoSyncEnabled}
                        onChange={(e) => {
                          setAutoSyncEnabled(e.target.checked);
                          localStorage.setItem("admin_auto_sync_enabled", String(e.target.checked));
                          addSyncLog(e.target.checked ? "Đã BẬT tự động đồng bộ khi cập nhật hệ thống." : "Đã TẮT tự động đồng bộ khi cập nhật hệ thống.");
                        }}
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                      <div>
                        <label htmlFor="auto_sync" className="block text-xs font-bold text-slate-700 cursor-pointer">
                          Tự động đồng bộ thời gian thực (Auto-Backup)
                        </label>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          Tất cả các thay đổi về Nhiệm vụ và Nhân viên sẽ lập tức được ghi vào Google Sheets ở chế độ chạy nền.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Sync Scope Selection */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-slate-700">Phạm vi dữ liệu đồng bộ</label>
                        <select
                          value={syncScope}
                          onChange={(e) => {
                            const val = e.target.value as "all" | "tasks" | "users";
                            setSyncScope(val);
                            localStorage.setItem("admin_sync_scope", val);
                            addSyncLog(`Thay đổi phạm vi đồng bộ dữ liệu sang: ${val === "all" ? "Tất cả" : val === "tasks" ? "Nhiệm vụ" : "Nhân sự"}`);
                          }}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:ring-1 focus:ring-indigo-500"
                        >
                          <option value="all">Nhiệm vụ & Nhân viên</option>
                          <option value="tasks">Chỉ đồng bộ Nhiệm vụ</option>
                          <option value="users">Chỉ đồng bộ Nhân viên</option>
                        </select>
                        <p className="text-[9px] text-slate-400 leading-normal">
                          Chỉ dữ liệu nằm trong phạm vi đã chọn mới tham gia đồng bộ hóa trực tuyến.
                        </p>
                      </div>

                      {/* Conflict Strategy Selection */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-slate-700">Giải quyết xung đột dữ liệu</label>
                        <select
                          value={conflictStrategy}
                          onChange={(e) => {
                            const val = e.target.value as "client-wins" | "server-wins" | "merge-latest";
                            setConflictStrategy(val);
                            localStorage.setItem("admin_conflict_strategy", val);
                            addSyncLog(`Chiến lược xung đột: ${val === "client-wins" ? "Ưu tiên máy khách" : val === "server-wins" ? "Ưu tiên máy chủ" : "Hợp nhất thông minh"}`);
                          }}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:ring-1 focus:ring-indigo-500"
                        >
                          <option value="client-wins">Ưu tiên máy khách (Client Wins)</option>
                          <option value="server-wins">Ưu tiên máy chủ (Server Wins)</option>
                          <option value="merge-latest">Hợp nhất bản mới nhất (Merge Latest)</option>
                        </select>
                        <p className="text-[9px] text-slate-400 leading-normal">
                          Lựa chọn ưu tiên dữ liệu khi kéo dữ liệu từ Google Sheets về máy của bạn.
                        </p>
                      </div>
                    </div>

                    {/* Change Spreadsheet ID manually */}
                    <div className="space-y-1.5 bg-slate-50 p-4 rounded-xl border border-slate-100">
                      <label className="block text-xs font-bold text-slate-700">Thay đổi mã Spreadsheet ID thủ công</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={customSpreadsheetId}
                          onChange={(e) => setCustomSpreadsheetId(e.target.value)}
                          placeholder="Nhập Google Spreadsheet ID mới..."
                          className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono text-[11px]"
                        />
                        <button
                          onClick={() => {
                            if (!customSpreadsheetId.trim()) return;
                            setSpreadsheetId(customSpreadsheetId.trim());
                            localStorage.setItem(SPREADSHEET_ID_KEY, customSpreadsheetId.trim());
                            addSyncLog(`Đã ghi đè mã Spreadsheet ID sang: ${customSpreadsheetId.trim()}`);
                            setSyncStatusMsg("Ghi đè Spreadsheet ID thành công!");
                          }}
                          className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all cursor-pointer shrink-0"
                        >
                          Cập nhật ID
                        </button>
                      </div>
                      <p className="text-[9px] text-slate-400 leading-normal">
                        Kết nối ngay tới một tệp Google Sheet sẵn có bằng cách dán Spreadsheet ID từ URL của trình duyệt.
                      </p>
                    </div>

                    {/* Local Backup Import / Export */}
                    <div className="p-4 rounded-xl border border-dashed border-slate-200 space-y-3 bg-white">
                      <h5 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <Database className="w-3.5 h-3.5 text-slate-500" />
                        Sao lưu & khôi phục offline (JSON)
                      </h5>
                      <p className="text-[10px] text-slate-400">
                        Xuất file dữ liệu dự phòng cục bộ hoặc khôi phục trực tiếp nhanh chóng mà không cần kết nối mạng.
                      </p>
                      <div className="flex flex-wrap gap-2 pt-1">
                        <button
                          onClick={handleExportLocalData}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold transition-all cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Xuất sao lưu (.JSON)</span>
                        </button>
                        
                        <label className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold transition-all cursor-pointer">
                          <Upload className="w-3.5 h-3.5" />
                          <span>Khôi phục sao lưu (.JSON)</span>
                          <input
                            type="file"
                            accept=".json"
                            onChange={handleImportLocalData}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* RIGHT COLUMN: REAL-TIME TERMINAL LOG */}
                  <div className="lg:col-span-5 flex flex-col h-full min-h-[300px]">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <Terminal className="w-3.5 h-3.5 text-slate-500" />
                        Nhật ký hoạt động thời gian thực
                      </h4>
                      <button
                        onClick={() => {
                          const initialLog = [`[${new Date().toLocaleTimeString()}] Nhật ký đã được dọn sạch.`];
                          setSyncLogs(initialLog);
                          localStorage.setItem("admin_sync_logs", JSON.stringify(initialLog));
                        }}
                        className="text-[10px] font-bold text-red-500 hover:text-red-600 transition-colors cursor-pointer"
                        title="Xóa tất cả log trong bộ nhớ"
                      >
                        Xóa nhật ký
                      </button>
                    </div>

                    <div className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl p-4 font-mono text-[10px] text-emerald-400 overflow-y-auto max-h-[350px] shadow-inner space-y-1.5 select-all">
                      {syncLogs.length === 0 ? (
                        <div className="text-slate-500 italic">Chưa phát sinh hoạt động nào.</div>
                      ) : (
                        syncLogs.map((log, index) => (
                          <div key={index} className="leading-relaxed border-b border-slate-800/30 pb-1 last:border-0 last:pb-0">
                            {log}
                          </div>
                        ))
                      )}
                    </div>
                    <p className="text-[9px] text-slate-400 mt-2 italic">
                      * Các tiến trình nạp, xuất, sao lưu, thay đổi ID hoặc cảnh báo kết nối mạng sẽ được cập nhật ở trên.
                    </p>
                  </div>

                </div>
              )}
            </div>
          )}

          {isLoadingData && (
            <div className="bg-white/80 rounded-xl p-3 mb-6 border border-indigo-50 flex items-center justify-center gap-2 text-xs font-medium text-indigo-600 animate-pulse">
              <Loader className="w-4 h-4 animate-spin text-indigo-600" />
              <span>Đang đồng bộ dữ liệu thời gian thực...</span>
            </div>
          )}

          {activeTab === "dashboard" && activeProfile && (
            <DashboardView tasks={tasks} activeProfile={activeProfile} />
          )}

          {activeTab === "tasks" && activeProfile && (
            <TaskBoardView
              tasks={tasks}
              activeProfile={activeProfile}
              allUsers={usersList}
              onSaveTask={handleSaveTask}
              onDeleteTask={handleDeleteTask}
            />
          )}

          {activeTab === "users" && activeProfile && (
            <UserListView
              users={usersList}
              activeProfile={activeProfile}
              spreadsheetId={spreadsheetId}
              onSaveUserProfile={handleSaveUserProfile}
              onDeleteUserProfile={handleDeleteUserProfile}
              onRefreshData={handlePullFromGoogleSheets}
            />
          )}
        </div>
      </main>
    </div>
  );
}
