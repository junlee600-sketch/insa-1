import express from "express";
import path from "path";
import admin from "firebase-admin";
import cors from "cors";
import fs from "fs";


async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || "3000", 10);

  let adminInitialized = false;

  function getFirebaseAdmin() {
    if (adminInitialized) return admin;

    const serviceAccountStr = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (!serviceAccountStr) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY 설정이 필요합니다.");
    }

    try {
      const serviceAccount = JSON.parse(serviceAccountStr);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      adminInitialized = true;
      return admin;
    } catch (err: any) {
      throw new Error("JSON 파싱 서버 오류: " + err.message);
    }
  }

  app.use(cors());
  app.use(express.json());

  // API Route: Update user password
  app.post("/api/admin/update-password", async (req, res) => {
    try {
      const { email, newPassword } = req.body;
      if (!email || !newPassword) {
         return res.status(400).json({ error: "Missing email or newPassword" });
      }
      
      const pbAdmin = getFirebaseAdmin();
      const userRecord = await pbAdmin.auth().getUserByEmail(email);
      
      await pbAdmin.auth().updateUser(userRecord.uid, {
        password: newPassword
      });
      
      res.json({ success: true, message: "비밀번호가 성공적으로 변경되었습니다." });
    } catch (error: any) {
      console.error("Error updating password:", error);
      if (error.message.includes("FIREBASE_SERVICE_ACCOUNT_KEY")) {
         return res.status(500).json({ error: "앱 설정 메뉴에 접속해 [FIREBASE_SERVICE_ACCOUNT_KEY] 환경 변수(비공개 키)를 수동 등록해야 이 기능을 사용할 수 있습니다." });
      }
      res.status(500).json({ error: error.message || "Failed to update password" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
