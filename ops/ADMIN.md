Admin: Editing Training and Prerequisites

UI (recommended)
- Navigate to `/executives/training` (Admins only).
- Search for a user, click View.
- Toggle any of the following and it saves immediately:
  - Training: Safety, Driver, Truck Commander, Dispatcher, Check Ride
  - Prereqs: VMIS Registered, Volunteer Agreement, SADD SOP Read
- Timestamps are recorded on the server for training items; prerequisites are booleans.

API (for scripts)
- Get user details:
  - `GET /api/admin/users/{id}`
- Update training/prereqs (send only fields you want to change):
  - `PUT /api/admin/users/{id}` JSON body examples:
    - `{ "trainingDriver": true }` → sets `trainingDriverAt` to now
    - `{ "trainingDriver": false }` → clears `trainingDriverAt`
    - `{ "vmisRegistered": true, "volunteerAgreement": true }`
- Auth: include the `sadd_token` cookie for an Admin session.

Audit trail
- The server records `user_training_update` and `user_prereq_update` audit events with changed keys.

