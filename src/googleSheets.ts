/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface SubTask {
  id: string;
  title: string;
  completed: boolean;
  durationDays?: number;
  description?: string;
}

export interface TaskFolder {
  id: string;
  name: string;
  createdByEmail: string;
  subTasks: {
    id: string;
    title: string;
    durationDays: number;
    description?: string;
  }[];
  createdAt: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  assigneeEmail: string;
  assigneeName: string;
  department: string;
  createdByEmail: string;
  createdByName: string;
  deadline: string; // YYYY-MM-DD
  progress: number; // 0 to 100
  status: "Chưa bắt đầu" | "Đang thực hiện" | "Đã hoàn thành" | "Trễ hạn" | "Cần đánh giá";
  selfAssessment: string;
  managerAssessment: string;
  managerComment: string;
  createdAt: string;
  updatedAt: string;
  priority?: "Gấp" | "Bình thường";
  taskType?: "Đột xuất" | "Thường xuyên";
  isRecurring?: boolean;
  recurrenceInterval?: "hàng tháng" | "hàng quý" | "hàng năm" | "tự chọn";
  recurrenceCustomDate?: string;
  folderId?: string;
  folderName?: string;
  subTasks?: SubTask[];
  parentRecurringId?: string;
  recurrenceCycleKey?: string;
  startDate?: string; // YYYY-MM-DD
}

export interface UserProfile {
  email: string;
  name: string;
  role: "admin" | "Giám đốc" | "Phó Giám đốc" | "Lãnh đạo phòng" | "Nhân viên";
  department: string;
  status: "Hoạt động" | "Chờ duyệt";
  password?: string;
}

const SPREADSHEET_NAME = "Task Tracker App - Management";

// Helper to make fetch calls to Google APIs
async function googleFetch(url: string, token: string, options: RequestInit = {}) {
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    ...options.headers,
  };

  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error?.message || `Google API Error: ${response.status} ${response.statusText}`
    );
  }
  return response.json();
}

/**
 * Find the Spreadsheet ID by name in the user's Drive.
 */
export async function findSpreadsheet(token: string): Promise<string | null> {
  const query = encodeURIComponent(
    `name = '${SPREADSHEET_NAME}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`
  );
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)`;
  const data = await googleFetch(url, token);
  if (data.files && data.files.length > 0) {
    return data.files[0].id;
  }
  return null;
}

/**
 * Create a new spreadsheet and initialize it with "Tasks" and "Users" sheets
 */
export async function createSpreadsheet(token: string): Promise<string> {
  // Create spreadsheet
  const createUrl = "https://sheets.googleapis.com/v4/spreadsheets";
  const body = {
    properties: {
      title: SPREADSHEET_NAME,
    },
    sheets: [
      { properties: { title: "Tasks" } },
      { properties: { title: "Users" } },
    ],
  };

  const sheetData = await googleFetch(createUrl, token, {
    method: "POST",
    body: JSON.stringify(body),
  });

  const spreadsheetId = sheetData.spreadsheetId;

  // Now, populate the headers and sample mock data
  await initializeSheetsData(spreadsheetId, token);

  return spreadsheetId;
}

/**
 * Initialize Headers and Mock Data in newly created Spreadsheet
 */
async function initializeSheetsData(spreadsheetId: string, token: string) {
  // 1. Headers for Tasks
  const taskHeaders = [
    "Task ID",
    "Title",
    "Description",
    "Assignee Email",
    "Assignee Name",
    "Department",
    "Created By Email",
    "Created By Name",
    "Deadline",
    "Progress",
    "Status",
    "Self Assessment",
    "Manager Assessment",
    "Manager Comment",
    "Created At",
    "Updated At",
    "Priority",
    "Task Type",
    "Is Recurring",
    "Recurrence Interval",
    "Recurrence Custom Date",
    "Folder ID",
    "Folder Name",
    "Sub Tasks",
    "Parent Recurring ID",
    "Recurrence Cycle Key",
    "Start Date",
  ];

  // 2. Headers for Users
  const userHeaders = ["Email", "Name", "Role", "Department", "Status", "Password"];

  // 3. Demo Users
  const demoUsers = [
    ["phanthanhan.btxh@gmail.com", "Phan Thanh An (Admin)", "admin", "Ban Giám đốc", "Hoạt động", "123456"],
    ["nguyenvana.tech@gmail.com", "Nguyễn Văn Kỹ (Hành chính)", "Nhân viên", "Phòng TH-HC-KT", "Hoạt động", "123456"],
    ["lethib.plan@gmail.com", "Lê Thị Kế Hoạch (CTXH)", "Nhân viên", "Phòng CTXH&CSND", "Hoạt động", "123456"],
    ["tranvanc.admin@gmail.com", "Trần Văn Hành Chính", "Nhân viên", "Phòng TH-HC-KT", "Hoạt động", "123456"],
    ["phamvand.lead@gmail.com", "Phạm Văn Trưởng Phòng", "Lãnh đạo phòng", "Phòng CTXH&CSND", "Hoạt động", "123456"],
    ["hoangthee.deputy@gmail.com", "Hoàng Thế Phó Giám Đốc", "Phó Giám đốc", "Phòng Y tế - PHCN", "Hoạt động", "123456"],
    ["nguyenvanf.director@gmail.com", "Nguyễn Văn Giám Đốc", "Giám đốc", "Ban Giám đốc", "Hoạt động", "123456"],
  ];

  // 4. Demo Tasks
  const today = new Date();
  const formatDate = (daysOffset: number) => {
    const d = new Date(today);
    d.setDate(today.getDate() + daysOffset);
    return d.toISOString().split("T")[0];
  };

  const demoTasks = [
    [
      "demo-task-1",
      "Thiết lập hệ thống hạ tầng server đám mây",
      "Triển khai Docker hóa toàn bộ ứng dụng và đưa lên môi trường test cloud.",
      "nguyenvana.tech@gmail.com",
      "Nguyễn Văn Kỹ (Hành chính)",
      "Phòng TH-HC-KT",
      "phamvand.lead@gmail.com",
      "Phạm Văn Trưởng Phòng",
      formatDate(2), // 2 days in future
      "60",
      "Đang thực hiện",
      "Đang chạy tốt, cần test tải.",
      "",
      "",
      formatDate(-5),
      formatDate(-1),
    ],
    [
      "demo-task-2",
      "Lập báo cáo dự toán ngân sách quý 3",
      "Xây dựng ngân sách hoạt động chi tiết cho các phòng ban, trình Hội đồng phê duyệt.",
      "lethib.plan@gmail.com",
      "Lê Thị Kế Hoạch (CTXH)",
      "Phòng CTXH&CSND",
      "hoangthee.deputy@gmail.com",
      "Hoàng Thế Phó Giám Đốc",
      formatDate(-1), // Overdue!
      "30",
      "Trễ hạn",
      "Còn vướng số liệu bên Hành chính chưa gửi kịp.",
      "",
      "",
      formatDate(-10),
      formatDate(-2),
    ],
    [
      "demo-task-3",
      "Soạn thảo quy chế chi tiêu nội bộ năm 2026",
      "Cập nhật các định mức chi tiêu phòng họp, xăng xe và công tác phí theo thông tư mới.",
      "tranvanc.admin@gmail.com",
      "Trần Văn Hành Chính",
      "Phòng TH-HC-KT",
      "nguyenvanf.director@gmail.com",
      "Nguyễn Văn Giám Đốc",
      formatDate(5),
      "100",
      "Đã hoàn thành",
      "Đã nộp bản thảo hoàn chỉnh.",
      "Đạt",
      "Quy chế đầy đủ, chi tiết, áp dụng ngay.",
      formatDate(-4),
      formatDate(0),
    ],
    [
      "demo-task-4",
      "Nâng cấp giao diện website Trung tâm",
      "Tối ưu trải nghiệm mobile, nâng cấp lên Tailwind CSS v4, tối ưu SEO.",
      "nguyenvana.tech@gmail.com",
      "Nguyễn Văn Kỹ (Hành chính)",
      "Phòng TH-HC-KT",
      "phamvand.lead@gmail.com",
      "Phạm Văn Trưởng Phòng",
      formatDate(3), // 3 days left
      "95",
      "Cần đánh giá",
      "Đã sửa xong toàn bộ lỗi giao diện, kính mong sếp đánh giá.",
      "",
      "",
      formatDate(-8),
      formatDate(-1),
    ],
    [
      "demo-task-5",
      "Xây dựng quy trình báo cáo tuần của phòng",
      "Thiết lập biểu mẫu báo cáo tiến độ tuần tự động hóa.",
      "lethib.plan@gmail.com",
      "Lê Thị Kế Hoạch (CTXH)",
      "Phòng CTXH&CSND",
      "lethib.plan@gmail.com",
      "Lê Thị Kế Hoạch (CTXH)",
      formatDate(2), // 2 days left
      "40",
      "Đang thực hiện",
      "Đã hoàn thành 40% khung biểu mẫu.",
      "",
      "",
      formatDate(-2),
      formatDate(0),
    ],
  ];

  // Write headers + data
  const writeUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`;
  const body = {
    valueInputOption: "USER_ENTERED",
    data: [
      {
        range: "Tasks!A1:AA",
        values: [taskHeaders, ...demoTasks],
      },
      {
        range: "Users!A1:F",
        values: [userHeaders, ...demoUsers],
      },
    ],
  };

  await googleFetch(writeUrl, token, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/**
 * Fetch all tasks from Google Sheets
 */
export async function fetchTasks(spreadsheetId: string, token: string): Promise<Task[]> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Tasks!A2:AA1000`;
  const data = await googleFetch(url, token);
  
  if (!data.values) return [];

  return data.values.map((row: any) => {
    let subTasksParsed: SubTask[] = [];
    try {
      if (row[23]) {
        subTasksParsed = JSON.parse(row[23]);
      }
    } catch (e) {
      console.warn("Lỗi phân tích cú pháp subTasks từ Google Sheets", e);
    }

    return {
      id: row[0] || "",
      title: row[1] || "",
      description: row[2] || "",
      assigneeEmail: row[3] || "",
      assigneeName: row[4] || "",
      department: row[5] || "",
      createdByEmail: row[6] || "",
      createdByName: row[7] || "",
      deadline: row[8] || "",
      progress: parseInt(row[9] || "0", 10),
      status: (row[10] || "Chưa bắt đầu") as Task["status"],
      selfAssessment: row[11] || "",
      managerAssessment: row[12] || "",
      managerComment: row[13] || "",
      createdAt: row[14] || "",
      updatedAt: row[15] || "",
      priority: (row[16] || "Bình thường") as Task["priority"],
      taskType: (row[17] || "Thường xuyên") as Task["taskType"],
      isRecurring: row[18] === "TRUE" || row[18] === "true",
      recurrenceInterval: (row[19] || undefined) as Task["recurrenceInterval"],
      recurrenceCustomDate: row[20] || undefined,
      folderId: row[21] || undefined,
      folderName: row[22] || undefined,
      subTasks: subTasksParsed,
      parentRecurringId: row[24] || undefined,
      recurrenceCycleKey: row[25] || undefined,
      startDate: row[26] || undefined,
    };
  });
}

/**
 * Fetch all users from Google Sheets
 */
export async function fetchUsers(spreadsheetId: string, token: string): Promise<UserProfile[]> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Users!A2:F1000`;
  const data = await googleFetch(url, token);
  
  if (!data.values) return [];

  return data.values.map((row: any) => ({
    email: row[0] || "",
    name: row[1] || "",
    role: (row[2] || "Nhân viên") as UserProfile["role"],
    department: row[3] || "Phòng CTXH&CSND",
    status: (row[4] || "Chờ duyệt") as UserProfile["status"],
    password: row[5] || "",
  }));
}

/**
 * Save / Update a user profile in Google Sheets
 */
export async function saveUserProfile(
  spreadsheetId: string,
  token: string,
  profile: UserProfile
): Promise<void> {
  // First, fetch all users to find if they exist
  const users = await fetchUsers(spreadsheetId, token);
  const rowIndex = users.findIndex((u) => u.email.toLowerCase() === profile.email.toLowerCase());

  const rowData = [
    profile.email,
    profile.name,
    profile.role,
    profile.department,
    profile.status,
    profile.password || "",
  ];

  if (rowIndex >= 0) {
    // Update existing row (index 0 maps to row 2)
    const range = `Users!A${rowIndex + 2}:F${rowIndex + 2}`;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`;
    await googleFetch(url, token, {
      method: "PUT",
      body: JSON.stringify({ values: [rowData] }),
    });
  } else {
    // Append new row
    const range = "Users!A2:F";
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED`;
    await googleFetch(url, token, {
      method: "POST",
      body: JSON.stringify({ values: [rowData] }),
    });
  }
}

/**
 * Save / Update a single task in Google Sheets
 */
export async function saveTask(spreadsheetId: string, token: string, task: Task): Promise<void> {
  const tasks = await fetchTasks(spreadsheetId, token);
  const rowIndex = tasks.findIndex((t) => t.id === task.id);

  const rowData = [
    task.id,
    task.title,
    task.description,
    task.assigneeEmail,
    task.assigneeName,
    task.department,
    task.createdByEmail,
    task.createdByName,
    task.deadline,
    task.progress.toString(),
    task.status,
    task.selfAssessment,
    task.managerAssessment,
    task.managerComment,
    task.createdAt,
    task.updatedAt,
    task.priority || "Bình thường",
    task.taskType || "Thường xuyên",
    task.isRecurring ? "TRUE" : "FALSE",
    task.recurrenceInterval || "",
    task.recurrenceCustomDate || "",
    task.folderId || "",
    task.folderName || "",
    task.subTasks ? JSON.stringify(task.subTasks) : "[]",
    task.parentRecurringId || "",
    task.recurrenceCycleKey || "",
    task.startDate || "",
  ];

  if (rowIndex >= 0) {
    // Update existing row (Columns A to AA)
    const range = `Tasks!A${rowIndex + 2}:AA${rowIndex + 2}`;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`;
    await googleFetch(url, token, {
      method: "PUT",
      body: JSON.stringify({ values: [rowData] }),
    });
  } else {
    // Append new row (Columns A to AA)
    const range = "Tasks!A2:AA";
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED`;
    await googleFetch(url, token, {
      method: "POST",
      body: JSON.stringify({ values: [rowData] }),
    });
  }
}

/**
 * Delete a task in Google Sheets
 */
export async function deleteTask(spreadsheetId: string, token: string, taskId: string): Promise<void> {
  const tasks = await fetchTasks(spreadsheetId, token);
  const rowIndex = tasks.findIndex((t) => t.id === taskId);
  if (rowIndex < 0) return;

  const filteredTasks = tasks.filter((t) => t.id !== taskId);

  // Clear sheet data (from A2 down to column AA)
  const clearUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Tasks!A2:AA1000:clear`;
  await googleFetch(clearUrl, token, { method: "POST" });

  if (filteredTasks.length > 0) {
    const values = filteredTasks.map((t) => [
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

    const writeUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Tasks!A2?valueInputOption=USER_ENTERED`;
    await googleFetch(writeUrl, token, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ values }),
    });
  }
}

/**
 * Delete a user profile in Google Sheets
 */
export async function deleteUserProfile(spreadsheetId: string, token: string, email: string): Promise<void> {
  const users = await fetchUsers(spreadsheetId, token);
  const rowIndex = users.findIndex((u) => u.email.toLowerCase() === email.toLowerCase());
  if (rowIndex < 0) return;

  const filteredUsers = users.filter((u) => u.email.toLowerCase() !== email.toLowerCase());

  // Clear Users sheet data (from A2 down to column F)
  const clearUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Users!A2:F1000:clear`;
  await googleFetch(clearUrl, token, { method: "POST" });

  if (filteredUsers.length > 0) {
    const values = filteredUsers.map((u) => [
      u.email,
      u.name,
      u.role,
      u.department,
      u.status,
      u.password || "",
    ]);

    const writeUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Users!A2?valueInputOption=USER_ENTERED`;
    await googleFetch(writeUrl, token, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ values }),
    });
  }
}

