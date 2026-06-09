import express from "express";
import path from "path";
import admin from "firebase-admin";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";


async function startServer() {
  try {
    console.log("Starting server process...");
    console.log("NODE_ENV=", process.env.NODE_ENV);
    console.log("PORT env var:", process.env.PORT);

    const app = express();
    const PORT = parseInt(process.env.PORT || "8080", 10);

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

    // 호출자의 Firebase ID 토큰을 검증하고 admin 역할 여부를 확인
    async function verifyAdminToken(req: express.Request, res: express.Response): Promise<string | null> {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) {
        res.status(401).json({ error: "인증 토큰이 없습니다." });
        return null;
      }
      const idToken = authHeader.split("Bearer ")[1];
      try {
        const pbAdmin = getFirebaseAdmin();
        const decoded = await pbAdmin.auth().verifyIdToken(idToken);
        const callerEmail = decoded.email;
        if (!callerEmail) {
          res.status(403).json({ error: "인증된 이메일이 없습니다." });
          return null;
        }
        const callerDoc = await pbAdmin.firestore().collection("users").doc(callerEmail.toLowerCase()).get();
        if (!callerDoc.exists || callerDoc.data()?.role !== "admin") {
          res.status(403).json({ error: "관리자 권한이 필요합니다." });
          return null;
        }
        return callerEmail;
      } catch (err: any) {
        res.status(401).json({ error: "유효하지 않은 토큰입니다." });
        return null;
      }
    }

    const isProd = process.env.NODE_ENV === "production";

    // 허용 출처: APP_URL 환경변수 또는 개발 환경의 localhost
    const allowedOrigin = process.env.APP_URL || "http://localhost:8080";
    app.use(cors({ origin: isProd ? allowedOrigin : true }));
    app.use(helmet({
      // 개발환경: CSP 비활성화 (Vite HMR 인라인 스크립트·iframe 허용)
      // 프로덕션: 엄격한 CSP 적용
      contentSecurityPolicy: isProd ? {
        directives: {
          defaultSrc: ["'self'"],
          connectSrc: [
            "'self'",
            "https://*.firebaseio.com",
            "https://*.googleapis.com",
            "https://identitytoolkit.googleapis.com",
            "https://securetoken.googleapis.com",
            "wss://*.firebaseio.com",
          ],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
          imgSrc: ["'self'", "data:", "https:"],
          fontSrc: ["'self'", "data:", "https://cdn.jsdelivr.net"],
          frameSrc: ["'none'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
        },
      } : false,
      frameguard: isProd ? undefined : false,
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: isProd ? undefined : false,
      crossOriginOpenerPolicy: isProd ? undefined : false,
    }));
    app.use(express.json({ limit: '10kb' }));

    // 전체 서버: IP당 15분에 300회 제한 (DoS 방어)
    const globalLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 300,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." }
    });
    app.use(globalLimiter);

    // 관리자 API: IP당 15분에 10회 제한
    const adminLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 10,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." }
    });

    // API Route: Update user password
    app.post("/api/admin/update-password", adminLimiter, async (req, res) => {
      const caller = await verifyAdminToken(req, res);
      if (!caller) return;

      try {
        const { email, newPassword } = req.body;
        if (!email || !newPassword) {
           return res.status(400).json({ error: "Missing email or newPassword" });
        }
        if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          return res.status(400).json({ error: "유효하지 않은 이메일 형식입니다." });
        }
        if (typeof newPassword !== "string" || newPassword.length < 8 || !/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
          return res.status(400).json({ error: "비밀번호는 8자 이상이며 영문자와 숫자를 포함해야 합니다." });
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
        res.status(500).json({ error: "비밀번호 변경 중 오류가 발생했습니다." });
      }
    });

    // API Route: Delete user completely
    app.post("/api/admin/delete-user", adminLimiter, async (req, res) => {
      const caller = await verifyAdminToken(req, res);
      if (!caller) return;

      try {
        const { email } = req.body;
        if (!email) {
           return res.status(400).json({ error: "Missing email" });
        }
        if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          return res.status(400).json({ error: "유효하지 않은 이메일 형식입니다." });
        }

        const pbAdmin = getFirebaseAdmin();
        const db = pbAdmin.firestore();

        // 1. Delete from Auth
        try {
          const userRecord = await pbAdmin.auth().getUserByEmail(email);
          await pbAdmin.auth().deleteUser(userRecord.uid);
          console.log("Deleted user from Auth.");
        } catch (authErr: any) {
          console.log("Auth user not found or already removed.");
        }

        if (req.body.authOnly) {
           return res.json({ success: true, message: "User deleted from Auth" });
        }

        // 2. Delete from users collection
        await db.collection("users").doc(email).delete();

        // 3. Delete related assignments and their results (evaluator)
        const deleteRelatedAsEvaluator = async (collectionName: string, resultsCollection: string) => {
          const snap = await db.collection(collectionName).where("evaluatorId", "==", email).get();
          for (const doc of snap.docs) {
            await db.collection(resultsCollection).doc(doc.id).delete();
            await doc.ref.delete();
          }
        };
        await deleteRelatedAsEvaluator("assignments", "results");
        await deleteRelatedAsEvaluator("exec_assignments", "exec_results");

        // 4. Delete related assignments and their results (evaluatee)
        const deleteRelatedAsEvaluatee = async (collectionName: string, resultsCollection: string) => {
          const snap = await db.collection(collectionName).where("evaluateeId", "==", email).get();
          for (const doc of snap.docs) {
            await db.collection(resultsCollection).doc(doc.id).delete();
            await doc.ref.delete();
          }
        };
        await deleteRelatedAsEvaluatee("assignments", "results");
        await deleteRelatedAsEvaluatee("exec_assignments", "exec_results");

        // 5. Delete final scores
        const deleteFinalScores = async (collectionName: string) => {
          const snap = await db.collection(collectionName).where("evaluateeId", "==", email).get();
          for (const doc of snap.docs) {
            await doc.ref.delete();
          }
        };
        await deleteFinalScores("finalScores");
        await deleteFinalScores("exec_finalScores");

        res.json({ success: true, message: "사용자 및 모든 관련 데이터가 성공적으로 삭제되었습니다." });
      } catch (error: any) {
        console.error("Error deleting user:", error);
        if (error.message.includes("FIREBASE_SERVICE_ACCOUNT_KEY") || error.message.includes("설정이 필요합니다")) {
           return res.status(500).json({ error: "앱 설정 메뉴에 접속해 [FIREBASE_SERVICE_ACCOUNT_KEY] 환경 변수(비공개 키)를 수동 등록해야 이 기능을 사용할 수 있습니다." });
        }
        res.status(500).json({ error: "사용자 삭제 중 오류가 발생했습니다." });
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
      app.get("*", (_req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    }

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error("FATAL ERROR IN STARTUP:", err);
    process.exit(1);
  }
}

startServer();
