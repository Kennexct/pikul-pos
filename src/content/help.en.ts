import type { HelpContent } from './help';

/** English copy of the help centre. Screen names follow the English interface (see `i18n/en.ts`). */
export const HELP_EN: HelpContent = {
  intro: [
    { title: 'Sell in three taps', body: 'Tap an item, tap Pay, choose how the customer pays. Print the receipt or send it by WhatsApp.' },
    { title: 'Not paid yet? Save it', body: 'Table orders and customer tabs can be saved and paid later from the Orders menu.' },
    { title: 'Close the register every night', body: 'Count the cash in the drawer, type the amount, and the app tells you whether it is exact, short or over.' },
    { title: 'Your data lives on this device', body: 'The app keeps working without internet. Save a backup once a week so your data is safe if the device breaks.' },
  ],
  topics: {
    jual: {
      title: 'Selling and taking payment',
      summary: 'The Register screen records every sale. Everything is saved on the device straight away, with or without internet.',
      steps: [
        'Tap the item ordered. Tap again to add one more.',
        'Check the order on the right (on a phone: tap "View order"). Quantities and notes can be changed there.',
        'Tap Pay, then choose the payment method.',
        'For cash, tap "Exact amount" or the amount received. Change is calculated for you.',
        'Tap "Complete payment". The receipt appears, ready to print or send.',
      ],
      notes: ['The cart is not lost if the app closes by accident.', 'Entered something wrong after payment? See "History, void and refund".'],
      keywords: 'register cashier transaction pay cash change cart checkout',
    },
    varian: {
      title: 'Variants, add-ons and sales modes',
      summary: 'A variant is a kind of one item with its own price (Coffee: Latte, Americano, Espresso). Add-ons are extra choices for that item (ice, sugar, size, toppings). Sales modes set different prices for dine-in, takeaway or delivery apps.',
      steps: [
        'In Products, open the item and pick "Has variants" under Price. Enter each variant\'s name and price; its Takeaway and cost prices are under the variant\'s Details.',
        'Create add-on groups in Products, Add-ons tab (for example Ice: normal ice, less ice, no ice). Add an extra price if needed, for example Grande +Rp4.000.',
        'Attach the add-on groups to the item, in the Add-ons section of the product form.',
        'In the Register, tap the item: choose the variant first, then the add-ons, then "Add to order".',
        'Switch the mode (Dine In, Takeaway and others) above the item list. Prices in the cart follow.',
      ],
      notes: [
        'On receipts and reports an item with variants reads "Kopi – Latte", so each variant\'s sales show separately.',
        'A variant that runs out can be marked on its own in the sold-out list; the other variants stay on sale.',
        'Three ways to price a mode: same as the base price, a special price per product or variant, or a percentage markup.',
        'The register keeps the last mode used until you change it.',
      ],
      keywords: 'variant add-on addon modifier topping ice sugar size tall grande venti takeaway dine in gofood grab markup level',
    },
    diskon: {
      title: 'Discounts',
      summary: 'A reduction on one order, as a percentage or an amount.',
      steps: ['In the cart, tap "Add discount".', 'Choose a prepared discount, or type your own percentage or amount.', 'The total changes immediately. Remove the discount from the same place.'],
      notes: ['The owner can cap cashier discounts in Settings, Staff & PIN tab. Above the cap, the app asks for the owner PIN.'],
      keywords: 'promo percent reduction off',
    },
    simpan: {
      title: 'Saving an order (pay later or tab)',
      summary: 'For customers who eat first and pay after, or regulars who settle later.',
      steps: [
        'Fill the cart as usual, then tap Save.',
        'Give it a label such as "Table 3" or "Mrs Sari\'s tab". Choose a customer if it is a tab.',
        'When the customer pays, open Orders, tap the order, then Pay.',
      ],
      notes: [
        'The order counts as a sale on the day it is paid, not the day it was saved.',
        'A tab with a customer name appears in Customers, "Unpaid" tab.',
        'An order that falls through can be cancelled with a reason, and stays on record.',
      ],
      keywords: 'open bill table debt credit tab saved unpaid',
    },
    qris: {
      title: 'Static QRIS',
      summary: 'Upload your shop\'s QRIS image once, then show it to the customer for every QRIS payment.',
      steps: [
        'Open Settings, Payments tab, QRIS section, and upload a photo or image of your QRIS.',
        'When taking payment, choose QRIS. The code is shown large with the amount due.',
        'Once the money arrives in your bank or wallet app, tap "Paid".',
      ],
      notes: ['The app cannot tell whether the money has arrived. Always check the notification from your bank before tapping "Paid".', 'A reference number can be recorded if you need it for matching.'],
      keywords: 'qr scan barcode gopay ovo dana transfer code',
    },
    struk: {
      title: 'Receipts: print or send by WhatsApp',
      summary: 'Every sale has a receipt with a unique number.',
      steps: [
        'After payment the receipt appears automatically. Tap Print or WhatsApp.',
        'To send it again, open History, tap the sale, then choose Print or WhatsApp.',
        'Set the shop name, address, footer text and paper size (58 or 80 mm) in Settings, Shop & Receipt tab.',
      ],
      notes: ['If the order has a customer with a phone number, WhatsApp opens straight to that number.', 'Printing uses the printer set up on the device.'],
      keywords: 'bill invoice paper printer thermal send',
    },
    riwayat: {
      title: 'History, void and refund',
      summary: 'Every sale is in History. A void cancels a whole sale on the same day. A refund returns some or all of the items.',
      steps: [
        'Open History and choose a period. Search by receipt number, label or customer name.',
        'Tap a sale to see its details.',
        'Choose Void (same day, whole sale) or Refund (pick items and quantities), then choose a reason.',
      ],
      notes: [
        'A refund counts on the day the refund is made, not the day of the sale.',
        'Who may void and refund, and for how many days, is set by the owner in Settings, Staff & PIN tab.',
        'Sales are never deleted. Voids and refunds are recorded with who did them.',
      ],
      keywords: 'cancel mistake return money delete transaction',
    },
    laporan: {
      title: 'Reports, profit and export',
      summary: 'Reports show sales, busy hours, payment methods, best sellers and profit for the period you choose. Only the owner can open them.',
      steps: [
        'Open Reports and choose a period.',
        'Net sales is sales minus the refunds made in that period.',
        'The Profit section appears once you fill in product cost prices or record expenses.',
        'Tap Export to make an Excel, PDF or CSV file.',
      ],
      notes: [
        'With cost prices: profit = sales − cost of items sold − operating expenses. Ingredient purchases are not subtracted again because cost prices already include them.',
        'Without cost prices: what is shown is sales minus all expenses.',
        'Reports only include sales made on this device.',
      ],
      keywords: 'revenue turnover profit loss excel pdf csv daily monthly summary cogs margin',
    },
    kas: {
      title: 'Cash, expenses and closing the register',
      summary: 'The Cash screen answers "how much should be in the drawer?" and records money going out.',
      steps: [
        'Before the first sale, the register asks you to "Open register": count the change in the drawer and type the amount.',
        'Whenever money goes out (ingredients, gas, wages), tap "Record expense". Turn off "Paid from the drawer" if the money did not come from the drawer.',
        'At night, tap "Close register", count the cash in the drawer and type the amount.',
        'The app records the difference. The summary can be sent to the owner by WhatsApp.',
      ],
      notes: [
        'Expected cash = opening cash + cash sales − cash refunds − expenses paid from the drawer.',
        'A sale after closing? The owner can "Reopen" and close again.',
        'When closing, items marked Sold out can be made available again automatically for tomorrow.',
      ],
      keywords: 'drawer deposit difference short over closing shift cost shopping till open register float',
    },
    produk: {
      title: 'Products, cost price and sold out',
      summary: 'Manage items, photos, categories, prices per mode, and mark items that have run out.',
      steps: [
        'Open Products to add or change items, including photo and category.',
        'Fill in "Cost price" (what one portion costs to make) if you want to see profit in Reports.',
        'Item run out today? In the Register, tap the crossed-box button next to search and switch the item on.',
      ],
      notes: ['Category tab: add, rename, reorder or delete categories. Products of a deleted category move to No category.', 'Products with variants have an arrow button in the list to see each variant\'s prices.', 'A Sold out item stays visible in the register but cannot be sold. Cashiers may change it too.', 'Inactive products are hidden from the register but stay in history.', 'Changing a cost price does not change the profit of past sales.'],
      keywords: 'menu item photo category cogs sold out empty stock',
    },
    timbang: {
      title: 'Selling by weight and changing the price',
      summary: 'For market sellers: sell by the kilo, ons, litre or metre, and type today\'s price right in the register.',
      steps: [
        'Open Settings, Shop & Receipt tab, turn on "Turn on weight and measure units", then save.',
        'In Products, choose "Sold per" (for example kg) and enter the price per that unit.',
        'For goods whose price moves, open "More settings" and turn on "Price can be changed when selling".',
        'In the Register, tap the item, then type the weight (for example 0.75), or choose Amount and type the buyer\'s money (for example Rp10.000).',
        'If today\'s price is different, change the price in the same box, then "Add to order".',
      ],
      notes: [
        'Line total = price × weight, rounded to whole Rupiah. With Amount, the buyer pays exactly that amount.',
        'Each weighing is its own line. Change the weight or price with the button on the cart line.',
        'The normal price is still recorded. In History, sales with a changed price are marked, and the Items export has a Normal price column.',
        'Refunding a weighed item returns the whole line.',
        'The app is not connected to a digital scale yet. The weight is typed in.',
      ],
      keywords: 'weigh scale kilo kg ons gram litre liter metre meter market vegetables fish meat open price flexible bargain',
    },
    pelanggan: {
      title: 'Customers and who has not paid',
      summary: 'Keep the names and phone numbers of regulars, see how often they buy, and who still has a tab.',
      steps: [
        'In the cart, tap "Add customer" to choose or add a customer.',
        'Open Customers to see visits and total spend.',
        'The "Unpaid" tab lists customers with saved orders. Tap a name, then "Remind via WhatsApp".',
      ],
      notes: ['Only Indonesian mobile numbers (08… or +628…) are accepted.', 'Deleting a customer erases their phone number and note. The name stays on old receipts.'],
      keywords: 'regular debt receivable tab phone number contact',
    },
    staf: {
      title: 'Cashiers, owner PIN and permissions',
      summary: 'The owner PIN protects Reports, Products and Settings. Cashiers have their own PIN so every sale is recorded under the right name.',
      steps: [
        'Open Settings, Staff & PIN tab, and create the owner PIN. Write down the recovery code shown and keep it somewhere safe.',
        'Add cashiers and give each a PIN.',
        'Switch seller with the initials button at the bottom left (on a phone: the More menu).',
        'Set who may void, refund and give large discounts.',
      ],
      notes: [
        'Selling never needs the owner PIN. Only the owner areas are locked, and they lock again after 5 minutes without use.',
        'Forgot the owner PIN? Use the recovery code. If both are lost, the owner areas cannot be opened again.',
        'Several wrong PINs make the app wait before you can try again.',
      ],
      keywords: 'employee staff lock password access rights owner',
    },
    offline: {
      title: 'Offline, sync and several devices',
      summary: 'Pikul keeps everything on this device, so it still works when the signal drops. When online, shop data syncs to the Pikul server.',
      steps: [
        'Sell as usual. There is nothing to do when the internet is down; changes are sent by themselves once online.',
        'On a second device, just sign in with the same account. Menu, staff, customers and sales download automatically.',
        'See the status and the device list in Settings, Sync tab.',
      ],
      notes: [
        'Each device has its own cash drawer: open and close the register on each device. The owner sees them all in Cash, "All devices".',
        'Reports include sales from every device that has synced.',
        'If two devices change the same product while offline, the latest change is kept.',
        'Shop data on the server can only be opened with your account. Keep making backups regularly.',
      ],
      keywords: 'signal online sync wifi data lost internet',
    },
    cadangan: {
      title: 'Backup and moving to another device',
      summary: 'A backup is one file with all of the shop\'s data. Use it as a safety net or to move to a new device.',
      steps: [
        'Open Settings, Backup tab, and tap "Save backup". The file goes to the Downloads folder.',
        'Send that file to your own Google Drive or WhatsApp.',
        'On the new device: open the app, skip the introduction, open Settings, Backup tab, "Choose backup file", then confirm.',
      ],
      notes: [
        'Restoring a backup replaces all data on that device. Anything recorded after the backup was made is not included.',
        'The file contains customer phone numbers. Do not share it with anyone else.',
        'Do not use the same backup on two devices at once: receipt numbers can clash.',
      ],
      keywords: 'backup restore recover new phone tablet broken lost',
    },
    pasang: {
      title: 'Install on the home screen',
      summary: 'Pikul can be installed like a normal app so it opens full screen and faster.',
      steps: [
        'Android (Chrome): tap the three-dot menu, then "Add to Home screen" or "Install app".',
        'iPhone or iPad (Safari): tap the Share button, then "Add to Home Screen".',
        'Open Pikul from the icon on the home screen.',
      ],
      notes: ['Open the app once with internet after installing, so every part is stored for offline use.'],
      keywords: 'install pwa app icon homescreen',
    },
  },
};
