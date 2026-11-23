# PM — admin-click-to-edit (2026-11-23)
**Problem:** Konten landing and Paket harga show every field as an open input; Kenny (sole admin) can change live text or a plan by a stray tap or typo.
**Users:** Kenny / future admin staff, mostly on tablet and laptop, sometimes phone.
**Stories:**
- As admin I see landing content as text and open only the item I want to change.
- As admin I see how my edit will look on the landing page while I type.
- As admin I edit a plan in a focused pop-up that only accepts valid values.
**Scope decision:** UI only. Save model: one Simpan for the whole landing page (Kenny chose). Plans save per plan from the pop-up.
**Success:** no visible input on either tab until a row/plan is opened; invalid plan values cannot be submitted; e2e v17 passes phone + tablet.
