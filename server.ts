import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import fs from "fs";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // API for GitHub Sync
  app.post("/api/github/sync", async (req, res) => {
    try {
      const { githubToken, repo, branch, commitMessage } = req.body;
      if (!githubToken || !repo) {
        return res.status(400).json({ error: "Thiếu GitHub Token hoặc thông tin Kho lưu trữ (Repository)." });
      }

      const targetBranch = branch || "main";
      const msg = commitMessage || "Cập nhật ứng dụng từ AI Studio";

      // Parse repository owner and name
      let cleanRepo = repo.trim();
      // Remove https://github.com/ or github.com/ if present
      cleanRepo = cleanRepo.replace(/^https?:\/\/(www\.)?github\.com\//i, "");
      cleanRepo = cleanRepo.replace(/\/$/, ""); // Remove trailing slash if present

      const parts = cleanRepo.split("/");
      if (parts.length < 2) {
        return res.status(400).json({ error: "Định dạng Kho lưu trữ không hợp lệ. Vui lòng nhập dưới dạng 'owner/repo-name' hoặc URL GitHub đầy đủ." });
      }
      const owner = parts[0];
      const repoName = parts[1];

      // Read workspace files
      const workspaceRoot = process.cwd();
      const files = getFilesRecursively(workspaceRoot);

      const headers = {
        "Authorization": `Bearer ${githubToken}`,
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "AI-Studio-Sync-App",
        "Content-Type": "application/json"
      };

      // 1. Check if repo exists
      const repoCheckRes = await fetch(`https://api.github.com/repos/${owner}/${repoName}`, { headers });
      if (!repoCheckRes.ok) {
        if (repoCheckRes.status === 404) {
          return res.status(404).json({ error: `Không tìm thấy Kho lưu trữ '${owner}/${repoName}' trên GitHub. Vui lòng đảm bảo bạn đã tạo kho lưu trữ này và Token của bạn có quyền truy cập.` });
        }
        const errText = await repoCheckRes.text();
        return res.status(repoCheckRes.status).json({ error: `Lỗi kết nối GitHub: ${errText}` });
      }

      // 2. Get latest commit SHA of the branch
      let parentCommitSha = "";
      let baseTreeSha = "";
      let isBrandNewRepo = false;

      const refRes = await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/ref/heads/${targetBranch}`, { headers });
      if (refRes.ok) {
        const refData: any = await refRes.json();
        parentCommitSha = refData.object.sha;

        // Get tree SHA of the parent commit
        const commitRes = await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/commits/${parentCommitSha}`, { headers });
        if (commitRes.ok) {
          const commitData: any = await commitRes.json();
          baseTreeSha = commitData.tree.sha;
        } else {
          isBrandNewRepo = true;
        }
      } else {
        isBrandNewRepo = true;
      }

      // If brand new or empty repo, we initialize it by creating a README.md
      if (isBrandNewRepo) {
        const initRes = await fetch(`https://api.github.com/repos/${owner}/${repoName}/contents/README.md`, {
          method: "PUT",
          headers,
          body: JSON.stringify({
            message: "Khởi tạo kho lưu trữ",
            content: Buffer.from("# " + repoName + "\n\nHệ thống quản lý được đồng bộ từ Google AI Studio.").toString("base64"),
            branch: targetBranch
          })
        });

        if (!initRes.ok) {
          const errText = await initRes.text();
          return res.status(500).json({ error: `Không thể tự động khởi tạo kho lưu trữ trống: ${errText}` });
        }

        // Wait a small moment and fetch the ref again
        await new Promise(resolve => setTimeout(resolve, 1500));
        const refResRetry = await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/ref/heads/${targetBranch}`, { headers });
        if (refResRetry.ok) {
          const refData: any = await refResRetry.json();
          parentCommitSha = refData.object.sha;

          const commitRes = await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/commits/${parentCommitSha}`, { headers });
          if (commitRes.ok) {
            const commitData: any = await commitRes.json();
            baseTreeSha = commitData.tree.sha;
          }
        } else {
          return res.status(500).json({ error: "Không thể lấy tham chiếu nhánh sau khi khởi tạo." });
        }
      }

      // 3. Create a new Tree
      const treeElements = files.map(file => {
        return {
          path: file.path,
          mode: "100644",
          type: "blob",
          content: file.content
        };
      });

      const createTreeRes = await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/trees`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          base_tree: baseTreeSha,
          tree: treeElements
        })
      });

      if (!createTreeRes.ok) {
        const errText = await createTreeRes.text();
        return res.status(createTreeRes.status).json({ error: `Lỗi tạo cây thư mục Git trên GitHub: ${errText}` });
      }

      const treeData: any = await createTreeRes.json();
      const newTreeSha = treeData.sha;

      // 4. Create a new Commit
      const createCommitRes = await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/commits`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          message: msg,
          tree: newTreeSha,
          parents: [parentCommitSha]
        })
      });

      if (!createCommitRes.ok) {
        const errText = await createCommitRes.text();
        return res.status(createCommitRes.status).json({ error: `Lỗi tạo commit: ${errText}` });
      }

      const commitData: any = await createCommitRes.json();
      const newCommitSha = commitData.sha;

      // 5. Update Ref
      const updateRefRes = await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/refs/heads/${targetBranch}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          sha: newCommitSha,
          force: true
        })
      });

      if (!updateRefRes.ok) {
        const errText = await updateRefRes.text();
        return res.status(updateRefRes.status).json({ error: `Lỗi cập nhật nhánh: ${errText}` });
      }

      res.json({
        success: true,
        message: "Đồng bộ lên GitHub thành công!",
        commitSha: newCommitSha,
        repoUrl: `https://github.com/${owner}/${repoName}/tree/${targetBranch}`
      });

    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message || "Lỗi đồng bộ GitHub không xác định." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

function getFilesRecursively(dir: string, baseDir: string = dir): { path: string; content: string }[] {
  const results: { path: string; content: string }[] = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, "/");
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      if (
        file === "node_modules" ||
        file === "dist" ||
        file === ".git" ||
        file === ".github" ||
        file === "assets"
      ) {
        continue;
      }
      results.push(...getFilesRecursively(fullPath, baseDir));
    } else {
      if (
        file === "package-lock.json" ||
        file === ".env" ||
        file.endsWith(".log") ||
        file === "firebase-blueprint.json" ||
        file === "firestore.rules"
      ) {
        continue;
      }
      try {
        const content = fs.readFileSync(fullPath, "utf-8");
        results.push({ path: relativePath, content });
      } catch (e) {
        console.error(`Error reading file ${fullPath}:`, e);
      }
    }
  }
  return results;
}

startServer();
