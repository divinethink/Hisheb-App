// ক্রয় তালিকার নাম-সাজেশনের স্ট্যাটিক তালিকা (হেলথ অ্যাপের ওষুধ-তালিকা থেকে নেওয়া; দুই অ্যাপ আলাদা বলে লাইভ লিংক নেই)।
// নতুন নাম লাগলে শুধু এখানে যোগ করুন। ব্যবহারকারীর আগে লেখা নামও সাজেশনে আসে (lib/medPurchaseCalc)।
export const MED_NAMES: readonly string[] = [
  'Paracetamol', 'Napa', 'Napa Extra', 'Ace', 'Fast', 'Reset', 'নাপা', 'প্যারাসিটামল',
  'Ibuprofen', 'Brufen', 'Diclofenac', 'Voltaren', 'Aspirin', 'Ecosprin',
  'Esomeprazole', 'Sergel', 'Maxpro', 'Omeprazole', 'Seclo', 'Losectil', 'Pantoprazole', 'Pantonix',
  'Domperidone', 'Motigut', 'Ondansetron', 'Emistat', 'Antacid', 'Alu-mag',
  'Cetirizine', 'Alatrol', 'Fexofenadine', 'Fexo', 'Telfast', 'Montelukast', 'Montair', 'Salbutamol', 'Ventolin', 'Windel',
  'Azithromycin', 'Zimax', 'Azithrocin', 'Amoxicillin', 'Moxacil', 'Amoxil', 'Cefixime', 'Cef-3',
  'Ciprofloxacin', 'Ciprocin', 'Metronidazole', 'Flagyl', 'Filmet',
  'Vitamin D3', 'Vitamin C', 'Calcium', 'Ostocal', 'Iron + Folic Acid', 'Vitamin B Complex', 'Neuro-B', 'Zinc Sulfate',
  'ORS', 'ORSaline-N', 'Metformin', 'Comet', 'Glucophage', 'Insulin', 'Amlodipine', 'Norvasc', 'Amlo',
  'Losartan', 'Angilock', 'Atorvastatin', 'Atova', 'Lipitor', 'Levothyroxine', 'Thyrox',
  'Isabgol (Psyllium Husk)', 'Loperamide', 'Imodium', 'Lactulose',
];

export const LAB_NAMES: readonly string[] = [
  'CBC', 'Blood Sugar (FBS)', 'Blood Sugar (2hrs ABF)', 'HbA1c', 'Lipid Profile', 'Serum Creatinine', 'Urine R/E',
  'SGPT (ALT)', 'SGOT (AST)', 'TSH', 'Vitamin D', 'Uric Acid', 'ECG', 'Echocardiogram', 'X-Ray', 'Ultrasonography (USG)',
  'CT Scan', 'MRI', 'Dengue NS1', 'Stool R/E', 'ESR', 'CRP',
];
