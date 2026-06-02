# Security Spec

## Data Invariants
- A user can only read their own profile unless they are `admin` or `hr`.
- Global settings can only be written by `admin`.
- Years and Groups can only be written by `admin` or `hr`.
- Evaluation items can only be written by `admin` or `hr`.
- Evaluation assignments can only be written by `admin` or `hr`.
- An evaluator can only read assignments where `evaluatorId == request.auth.uid`, plus admins/hr.
- An evaluator can write to `results` ONLY IF they own the corresponding assignment (`assignments/{assignmentId}`).
- Final scores can be read by the evaluatee or admin/hr. Only admin/hr can write.

## Dirty Dozen Payloads
1. User profile update by non-owner.
2. User profile update with role change (escalation).
3. Settings update by non-admin.
4. Settings update missing required fields.
5. Create assignment for an invalid user.
6. Submit result for an assignment not belonging to user.
7. Submit result with non-matching types in scores map.
8. Submit result updating `status` on assignment by non-owner.
9. Final score update by non-admin/hr.
10. Assignment update by evaluator changing evaluateeId.
11. PII enumeration (listing all users by standard user).
12. Creating a year with a massive ID to cause Denial of Wallet.
