# PM — device-sync (v0.19)
Kenny's problem: same account on a second device shows store setup and an empty store.
Kenny chose: sync everything both ways; ask which store to keep when a device already has another; each device has its own cash register.
## Stories
1. As an owner signing in on a new phone, I land on my PIN/cashier screen with my menu, staff and sales.
2. As an owner with two phones, a price change on one shows on the other within ~15 s.
3. As a cashier, I can sell offline; my sales reach the other phone when I'm back online.
4. As an owner, I close each phone's drawer and see all phones' closings plus a store total.
5. As an owner whose second phone already made a store, I choose which store to keep and never lose the other (backup file).
6. As a new account on any device, setup is prefilled with my sign-up store name.
## Success criteria
Second-device sign-in → cashier in < 30 s for a store with 200 products / 2,000 orders on 4G; zero lost sales in the e2e offline test; admin daily totals equal the sum of all devices.
