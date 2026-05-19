import admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();

async function main() {
  const email = "aaa1@han-guk.co.kr";
  const userRef = db.collection('users').doc(email);
  await userRef.update({ name: "주몽" });
  console.log("Success");
}

main().catch(console.error);
