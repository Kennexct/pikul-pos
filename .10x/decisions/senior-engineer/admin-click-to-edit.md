# Senior Engineer — admin-click-to-edit (2026-11-23)
- ContentRows keeps `{index, copy}` of the open row; Selesai writes copy into items; Batal on a never-saved new row removes it (`isNew` flag on open state). Opening another row while dirty: confirm inline ("Buang perubahan?") rather than `window.confirm` (no browser dialogs).
- Preview gets the live open-row copy merged into the draft so it updates while typing.
- PlanSheet: draft days as `{choice: 30|90|180|365|'other', custom: string}`; features as string[]; code auto = slugify(name) until "Ubah kode" toggled; existing plans: code locked.
- Reorder: sort plans by `sort`, swap values with neighbour; if equal, set to i*10 spacing first.
- Tricky: Sheet unmounts after exit — reset sheet state from props on open (key by plan id + open counter).
