// server.ts
import express from "express";
import path from "path";
import admin from "firebase-admin";
import cors from "cors";
async function startServer() {
  try {
    let getFirebaseAdmin = function() {
      if (adminInitialized) return admin;
      const serviceAccountStr = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
      if (!serviceAccountStr) {
        throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY \uC124\uC815\uC774 \uD544\uC694\uD569\uB2C8\uB2E4.");
      }
      try {
        const serviceAccount = JSON.parse(serviceAccountStr);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount)
        });
        adminInitialized = true;
        return admin;
      } catch (err) {
        throw new Error("JSON \uD30C\uC2F1 \uC11C\uBC84 \uC624\uB958: " + err.message);
      }
    };
    console.log("Starting server process...");
    console.log("NODE_ENV=", process.env.NODE_ENV);
    console.log("PORT env var:", process.env.PORT);
    const app = express();
    const PORT = parseInt(process.env.PORT || "8080", 10);
    let adminInitialized = false;
    app.use(cors());
    app.use(express.json());
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
        res.json({ success: true, message: "\uBE44\uBC00\uBC88\uD638\uAC00 \uC131\uACF5\uC801\uC73C\uB85C \uBCC0\uACBD\uB418\uC5C8\uC2B5\uB2C8\uB2E4." });
      } catch (error) {
        console.error("Error updating password:", error);
        if (error.message.includes("FIREBASE_SERVICE_ACCOUNT_KEY")) {
          return res.status(500).json({ error: "\uC571 \uC124\uC815 \uBA54\uB274\uC5D0 \uC811\uC18D\uD574 [FIREBASE_SERVICE_ACCOUNT_KEY] \uD658\uACBD \uBCC0\uC218(\uBE44\uACF5\uAC1C \uD0A4)\uB97C \uC218\uB3D9 \uB4F1\uB85D\uD574\uC57C \uC774 \uAE30\uB2A5\uC744 \uC0AC\uC6A9\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4." });
        }
        res.status(500).json({ error: error.message || "Failed to update password" });
      }
    });
    if (process.env.NODE_ENV !== "production") {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa"
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path.join(process.cwd(), "dist");
      app.use(express.static(distPath));
      app.get("*", (req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    }
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error("FATAL ERROR IN STARTUP:", err);
    process.exit(1);
  }
}
startServer();
