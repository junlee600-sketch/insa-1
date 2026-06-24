import express from "express";
import path from "path";
import admin from "firebase-admin";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";


async function startServer() {
  try {
    console.log("Starting server process...");
    if (process.env.NODE_ENV !== "production") {
      console.log("NODE_ENV=", process.env.NODE_ENV);
      console.log("PORT env var:", process.env.PORT);
    }

    const app = express();
    const PORT = parseInt(process.env.PORT || "8080", 10);

    let adminInitialized = false;

    const FIRESTORE_DB_ID = process.env.FIRESTORE_DATABASE_ID || "ai-studio-18524f69-b203-4864-b4ba-255a91501a7c";

    function getFirebaseAdmin() {
      if (adminInitialized) return admin;

      try {
        const serviceAccountStr = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
        if (serviceAccountStr) {
          // 서비스 계정 키가 있으면 사용 (로컬 개발 등)
          const serviceAccount = JSON.parse(serviceAccountStr);
          admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
        } else {
          // Cloud Run 환경에서는 ADC(Application Default Credentials) 사용
          const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || "gen-lang-client-0327374539";
          admin.initializeApp({
            credential: admin.credential.applicationDefault(),
            projectId,
          });
        }
        (admin.firestore() as any).settings({ databaseId: FIRESTORE_DB_ID });
        adminInitialized = true;
        return admin;
      } catch (err: any) {
        throw new Error("Firebase Admin 초기화 오류: " + err.message);
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

      // Step 1: JWT 서명 검증 (Admin SDK의 verifyIdToken은 Firebase 공개키 사용 - 별도 인증 불필요)
      let callerEmail: string;
      try {
        const pbAdmin = getFirebaseAdmin();
        const decoded = await pbAdmin.auth().verifyIdToken(idToken);
        if (!decoded.email) {
          res.status(403).json({ error: "인증된 이메일이 없습니다." });
          return null;
        }
        callerEmail = decoded.email.toLowerCase();
      } catch (err: any) {
        console.error("[verifyAdminToken] verifyIdToken 실패:", err?.code, err?.message);
        res.status(401).json({ error: "유효하지 않은 토큰입니다." });
        return null;
      }

      // Step 2: Firestore REST API로 admin 역할 확인 (클라이언트 토큰 사용 - Admin SDK 인증 불필요)
      try {
        const firestoreUrl = `https://firestore.googleapis.com/v1/projects/gen-lang-client-0327374539/databases/${FIRESTORE_DB_ID}/documents/users/${callerEmail}`;
        const firestoreRes = await fetch(firestoreUrl, {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        if (!firestoreRes.ok) {
          console.error("[verifyAdminToken] Firestore 조회 실패:", firestoreRes.status);
          res.status(403).json({ error: "관리자 권한이 필요합니다." });
          return null;
        }
        const docData = await firestoreRes.json() as any;
        const role = docData?.fields?.role?.stringValue;
        if (role !== "admin") {
          res.status(403).json({ error: "관리자 권한이 필요합니다." });
          return null;
        }
        return callerEmail;
      } catch (err: any) {
        console.error("[verifyAdminToken] Firestore 오류:", err?.code, err?.message);
        res.status(500).json({ error: "권한 확인 중 오류가 발생했습니다." });
        return null;
      }
    }

    const isProd = process.env.NODE_ENV === "production";

    // Cloud Run / 리버스 프록시 환경에서 실제 클라이언트 IP를 rate limiter에 전달
    app.set('trust proxy', 1);

    // 허용 출처: APP_URL 환경변수 또는 개발 환경의 localhost
    const allowedOrigin = process.env.APP_URL || "http://localhost:8080";
    const devOrigins = ['http://localhost:8080', 'http://localhost:3000', 'http://localhost:5173'];
    app.use(cors({ origin: isProd ? allowedOrigin : devOrigins }));
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
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          imgSrc: ["'self'", "data:", "https:"],
          fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
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
        if (typeof newPassword !== "string" || newPassword.length < 6) {
          return res.status(400).json({ error: "비밀번호는 최소 6자 이상이어야 합니다." });
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

    // API Route: Enable / disable Firebase Auth account (재직 ↔ 퇴직)
    app.post("/api/admin/set-user-status", adminLimiter, async (req, res) => {
      const caller = await verifyAdminToken(req, res);
      if (!caller) return;

      try {
        const { email, disabled } = req.body;
        if (!email || typeof disabled !== "boolean") {
          return res.status(400).json({ error: "이메일과 disabled 값이 필요합니다." });
        }
        if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          return res.status(400).json({ error: "유효하지 않은 이메일 형식입니다." });
        }

        const pbAdmin = getFirebaseAdmin();
        try {
          const userRecord = await pbAdmin.auth().getUserByEmail(email);
          await pbAdmin.auth().updateUser(userRecord.uid, { disabled });
        } catch (authErr: any) {
          if (authErr.code !== "auth/user-not-found") throw authErr;
          // Auth 계정이 없어도 Firestore 상태만 변경한 것으로 성공 처리
        }

        res.json({ success: true });
      } catch (error: any) {
        console.error("Error setting user status:", error);
        if (error.message?.includes("FIREBASE_SERVICE_ACCOUNT_KEY")) {
          return res.status(500).json({ error: "앱 설정 메뉴에 접속해 [FIREBASE_SERVICE_ACCOUNT_KEY] 환경 변수(비공개 키)를 수동 등록해야 이 기능을 사용할 수 있습니다." });
        }
        res.status(500).json({ error: "사용자 상태 변경 중 오류가 발생했습니다." });
      }
    });

    // API Route: Delete user + all related Firestore data (Admin SDK bypasses security rules)
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

        // 1. Firebase Auth 계정 삭제
        try {
          const userRecord = await pbAdmin.auth().getUserByEmail(email);
          await pbAdmin.auth().deleteUser(userRecord.uid);
        } catch (authErr: any) {
          // Auth 계정이 없어도 Firestore 삭제는 계속 진행
        }

        // 2. 연관 Firestore 문서 수집
        const queryByField = async (col: string, field: string) => {
          const snap = await db.collection(col).where(field, "==", email).get();
          return snap.docs;
        };

        const [
          asEvaluator, execAsEvaluator,
          asEvaluatee, execAsEvaluatee,
          finalScores, execFinalScores,
        ] = await Promise.all([
          queryByField("assignments", "evaluatorId"),
          queryByField("exec_assignments", "evaluatorId"),
          queryByField("assignments", "evaluateeId"),
          queryByField("exec_assignments", "evaluateeId"),
          queryByField("finalScores", "evaluateeId"),
          queryByField("exec_finalScores", "evaluateeId"),
        ]);

        // 중복 없이 삭제할 경로 수집
        const seen = new Set<string>();
        const refs: FirebaseFirestore.DocumentReference[] = [];
        const add = (ref: FirebaseFirestore.DocumentReference) => {
          if (!seen.has(ref.path)) { seen.add(ref.path); refs.push(ref); }
        };

        add(db.collection("users").doc(email));
        for (const d of asEvaluator)     { add(db.collection("results").doc(d.id)); add(d.ref); }
        for (const d of execAsEvaluator) { add(db.collection("exec_results").doc(d.id)); add(d.ref); }
        for (const d of asEvaluatee)     { add(db.collection("results").doc(d.id)); add(d.ref); }
        for (const d of execAsEvaluatee) { add(db.collection("exec_results").doc(d.id)); add(d.ref); }
        for (const d of finalScores)     add(d.ref);
        for (const d of execFinalScores) add(d.ref);

        // 500건 단위로 배치 커밋 (Admin SDK 한도)
        for (let i = 0; i < refs.length; i += 500) {
          const batch = db.batch();
          refs.slice(i, i + 500).forEach(r => batch.delete(r));
          await batch.commit();
        }

        res.json({ success: true, message: "사용자 및 모든 관련 데이터가 삭제되었습니다." });
      } catch (error: any) {
        console.error("Error deleting user:", error);
        if (error.message?.includes("FIREBASE_SERVICE_ACCOUNT_KEY") || error.message?.includes("설정이 필요합니다")) {
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
