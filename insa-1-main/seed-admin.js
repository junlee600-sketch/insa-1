import fs from "fs";
import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, setDoc } from "firebase/firestore";

const config = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf8"));
const app = initializeApp(config);
const auth = getAuth(app);
const db = getFirestore(app, config.firestoreDatabaseId);

async function run() {
  try {
    let cred;
    try {
      cred = await createUserWithEmailAndPassword(auth, "admin@360.com", "admin1234");
    } catch (e) {
      if (e.code === 'auth/email-already-in-use') {
        cred = await signInWithEmailAndPassword(auth, "admin@360.com", "admin1234");
      } else {
        throw e;
      }
    }
    
    await setDoc(doc(db, "users", "admin@360.com"), {
      email: "admin@360.com",
      name: "System Admin",
      department: "Control",
      role: "admin",
      uid: cred.user.uid,
      createdAt: new Date()
    }, { merge: true });
    console.log("SUCCESS");
  } catch (e) {
    console.error(e.message);
  }
  process.exit(0);
}
run();
