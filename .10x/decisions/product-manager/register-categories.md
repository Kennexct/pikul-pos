# PM — register-categories (v0.16)
- Problem: first sale happens without a counted float; categories only creatable inside the product form; variants hidden in one truncated line.
- Stories: as a seller I am asked to open the register (count the drawer) before my first sale; as a seller I count by note/coin at open and close; as an owner I manage categories in a Kategori tab; as an owner I expand a product row to see variant prices.
- Success: no day starts without an opening record (or legacy sale); close shows expected vs counted vs difference; category CRUD + order; variant lines with prices and status.
- Scope out: multiple shifts, per-cashier drawers, blind close.
- Readings chosen without Kenny (reversible): gate at first tap/Bayar/Simpan, dismissable but re-asks; Rp0 allowed; closed day warns, never blocks.
