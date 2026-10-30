// xlsx-js-style = SheetJS-এর style-সাপোর্ট ফর্ক; API একই, তাই `xlsx`-এর টাইপই পুনর্ব্যবহার (শুধু cell `.s` স্টাইল বাড়তি)।
declare module 'xlsx-js-style' {
  export * from 'xlsx';
}
