// 일회성 마이그레이션: users 문서의 menuPermissions·confirmDepartments 를
// 보호 컬렉션 userAccess/{email} 로 복사한다. (보안 이슈 #4)
//
// 안전성: 추가(additive)만 수행 — users 문서는 건드리지 않는다.
//   따라서 언제 실행해도 앱 동작에 영향이 없고, 새 보안 규칙 배포 "이전"에
//   먼저 실행해야 개별 메뉴권한/확정부서 권한을 쓰는 사용자가 끊기지 않는다.
//
// 실행:
//   FIREBASE_SERVICE_ACCOUNT_KEY='{...}' node scripts/migrate-userAccess.mjs
//   또는 ADC 로그인 후:  node scripts/migrate-userAccess.mjs
//
// 옵션:
//   --dry   실제 쓰기 없이 대상만 출력
//   --cleanup   (별도 실행) users 문서에서 menuPermissions·confirmDepartments 필드 제거
//               → 반드시 새 규칙 배포 및 정상 동작 확인 이후에만 사용

import admin from "firebase-admin";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const FIRESTORE_DB_ID =
  process.env.FIRESTORE_DATABASE_ID || "ai-studio-18524f69-b203-4864-b4ba-255a91501a7c";

const DRY = process.argv.includes("--dry");
const CLEANUP = process.argv.includes("--cleanup");

function initAdmin() {
  const key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (key) {
    admin.initializeApp({ credential: admin.credential.cert(JSON.parse(key)) });
  } else {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: "gen-lang-client-0327374539",
    });
  }
  return getFirestore(admin.app(), FIRESTORE_DB_ID);
}

async function main() {
  const db = initAdmin();
  const snap = await db.collection("users").get();
  console.log(`총 사용자 ${snap.size}명 스캔${DRY ? " (DRY RUN)" : ""}${CLEANUP ? " [CLEANUP 모드]" : ""}`);

  let migrated = 0;
  let cleaned = 0;

  for (const doc of snap.docs) {
    const email = doc.id;
    const d = doc.data();
    const hasMenu = d.menuPermissions && Object.keys(d.menuPermissions).length > 0;
    const hasConfirm = Array.isArray(d.confirmDepartments) && d.confirmDepartments.length > 0;

    if (!CLEANUP) {
      if (!hasMenu && !hasConfirm) continue;
      const accessData = { email, updatedAt: FieldValue.serverTimestamp() };
      if (hasMenu) accessData.menuPermissions = d.menuPermissions;
      if (hasConfirm) accessData.confirmDepartments = d.confirmDepartments;
      console.log(
        `  ${email}: menu=${hasMenu ? Object.keys(d.menuPermissions).length : 0}, confirm=${hasConfirm ? d.confirmDepartments.length : 0}`
      );
      if (!DRY) await db.collection("userAccess").doc(email).set(accessData, { merge: true });
      migrated++;
    } else {
      // CLEANUP: users 문서에서 민감 필드 제거 (규칙 배포 후에만!)
      if (!hasMenu && !hasConfirm && !("menuPermissions" in d) && !("confirmDepartments" in d)) continue;
      console.log(`  cleanup ${email}: menuPermissions/confirmDepartments 필드 제거`);
      if (!DRY) {
        await doc.ref.update({
          menuPermissions: FieldValue.delete(),
          confirmDepartments: FieldValue.delete(),
        });
      }
      cleaned++;
    }
  }

  if (!CLEANUP) console.log(`\n완료: userAccess 문서 ${migrated}건 ${DRY ? "예정" : "생성/갱신"}`);
  else console.log(`\n완료: users 문서 ${cleaned}건 필드 ${DRY ? "제거 예정" : "제거"}`);
  process.exit(0);
}

main().catch((e) => {
  console.error("마이그레이션 실패:", e);
  process.exit(1);
});
