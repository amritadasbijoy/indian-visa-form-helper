// Option values exactly as the visa site uses them (scraped from indianvisa-bangladesh.nic.in, Oct 2026).
// Shared by the side panel and the content scripts through globalThis.IVH.
(() => {
  const IVH = (globalThis.IVH = globalThis.IVH || {});

  IVH.SITE = 'https://indianvisa-bangladesh.nic.in/visa/';
  // Official pages often needed around the visa (Start screen → Useful links). Links only: no extra permissions.
  IVH.USEFUL_LINKS = [
    { key: 'linkStatus', url: IVH.SITE + 'StatusEnquiry' },
    { key: 'linkPrint', url: IVH.SITE + 'PrintApplication' },
    { key: 'linkEarrival', note: 'linkEarrivalNote', url: 'https://indianvisaonline.gov.in/earrival/' },
    { key: 'linkTravelTax', note: 'linkTravelTaxNote', url: 'https://www.achallan.gov.bd/' },
    { key: 'linkPortFee', note: 'linkPortFeeNote', url: 'https://passenger.blpa.gov.bd/' },
  ];

  IVH.MISSIONS = [
    ['BGDD', 'Dhaka'],
    ['BGDC', 'Chittagong'],
    ['BGDR', 'Rajshahi'],
    ['BGDS', 'Sylhet'],
    ['BGDK', 'Khulna'],
  ];

  // Purpose codes from the "Visiting India for" dropdown on the Registration page.
  IVH.PURPOSES = [
    ['544', 'Tourist (T1)', 'tourist'],
    ['545', 'Medical (M1) – patient', 'medical'],
    ['546', 'Medical Attendant (M2)', 'attendant'],
    ['530', 'Medical AYUSH (M3)', 'medical'],
    ['531', 'AYUSH Attendant (M4)', 'attendant'],
  ];

  IVH.isMedical = s => ['545', '530'].includes(s?.purpose);
  IVH.isAttendant = s => ['546', '531'].includes(s?.purpose);

  IVH.ENTRIES =[['1', 'SINGLE'], ['3', 'DOUBLE'], ['4', 'TRIPLE'], ['2', 'MULTIPLE']];

  IVH.RELIGIONS = ['HINDU', 'ISLAM', 'BUDDHISM', 'CHRISTIAN', 'BAHAI', 'JAINISM', 'JUDAISM', 'PARSI', 'SIKH', 'ZOROASTRIAN', 'OTHERS'];

  IVH.EDUCATION = ['BELOW MATRICULATION', 'MATRICULATION', 'HIGHER SECONDARY', 'GRADUATE', 'POST GRADUATE', 'PROFESSIONAL', 'NA BEING MINOR', 'ILLITERATE', 'OTHERS'];

  IVH.OCCUPATIONS = ['AIR FORCE', 'BUSINESS PERSON', 'CAMERAMAN', 'CHARITY/SOCIAL WORKER', 'CHARTERED ACCOUNTANT', 'COLLEGE/UNIVERSITY TEACHER', 'DIPLOMAT', 'DOCTOR', 'ENGINEER', 'FILM PRODUCER', 'GOVERNMENT SERVICE', 'HOUSE WIFE', 'JOURNALIST', 'LABOUR', 'LAWYER', 'MEDIA', 'MILITARY', 'MISSIONARY', 'NAVY', 'NEWS BROADCASTER', 'OFFICIAL', 'OTHERS', 'POLICE', 'PRESS', 'PRIVATE SERVICE', 'PUBLISHER', 'REPORTER', 'RESEARCHER', 'RETIRED', 'SEA MAN', 'SELF EMPLOYED/ FREELANCER', 'STUDENT', 'TRADER', 'TV PRODUCER', 'UN-EMPLOYED', 'UN OFFICIAL', 'WORKER', 'WRITER'];

  // Occupations where the site asks whose employment details follow (Father / Mother / Spouse).
  IVH.DEPENDENT_OCCUPATIONS = ['STUDENT', 'HOUSE WIFE', 'UN-EMPLOYED', 'RETIRED'];

  // Previous-visa types; the filler picks the site option whose text matches.
  IVH.OLD_VISA_TYPES = ['TOURIST VISA', 'MEDICAL VISA', 'MEDICAL ATTENDANT VISA', 'BUSINESS VISA', 'DOUBLE ENTRY', 'STUDENT VISA', 'ENTRY VISA', 'EMPLOYMENT VISA', 'CONFERENCE VISA', 'TRANSIT VISA', 'JOURNALIST VISA', 'PILGRIMES VISA'];

  IVH.PORTS = ['BY AIR', 'BY AIR/ HARIDASPUR', 'BY RAIL CHITPUR', 'BY RAIL GEDE', 'BY RAIL GEDE/BY AIR', 'BY RAIL GEDE/BYROAD HARIDASPUR', 'BY RAIL NEW JALPAIGURI', 'BY RAIL NISCHINTPUR', 'BY RAIL PETRAPOLE', 'BY ROAD AGARTALA', 'BY ROAD BAGHMARA', 'BY ROAD BELONIA', 'BY ROAD BHOLAGONJ', 'BY ROAD CHANGRABANDHA', 'BY ROAD CHANGRABANDHA/JAYGAON', 'BY ROAD CHANGRABANDHA/RANIGANJ', 'BY ROAD DALU', 'BY ROAD DAWKI', 'BY ROAD DHALIGHAT', 'BY ROAD DHUBRI', 'BY ROAD GEDE', 'BY ROAD GHOJADANGA', 'BY ROAD GOLAKGANJ', 'BY ROAD HALDIBARI', 'BY ROAD HARIDASPUR', 'BY ROAD HILI', 'BY ROAD JAIGAON', 'BY ROAD JAIGAON/PHULBARI', 'BY ROAD KAILASHAHAR', 'BY ROAD KARIMGANJ', 'BY ROAD KHOWAI', 'BY ROAD LALGOLAGHAT', 'BY ROAD MAHADIPUR', 'BY ROAD MANKARCHAR', 'BY ROAD MUHURIGHAT', 'BY ROAD PHULBARI', 'BY ROAD PHULBARI/JAIGAON', 'BY ROAD PHULBARI/RANIGANJ', 'BY ROAD RADHIKAPUR', 'BY ROAD RANIGANJ', 'BY ROAD RANIGANJ/PHULBARI', 'BY ROAD SABROOM', 'BY ROAD SONAHAT', 'BY ROAD SRIMANTPUR', 'BY ROAD SUTERKANDI'];

  IVH.INDIA_STATES = ['WEST BENGAL', 'ASSAM', 'TRIPURA', 'MEGHALAYA', 'DELHI', 'TAMIL NADU', 'KARNATAKA', 'MAHARASHTRA', 'TELANGANA', 'KERALA', 'UTTAR PRADESH', 'ANDHRA PRADESH', 'ARUNACHAL PRADESH', 'BIHAR', 'CHANDIGARH', 'CHHATTISGARH', 'GOA', 'GUJARAT', 'HARYANA', 'HIMACHAL PRADESH', 'JAMMU AND KASHMIR', 'JHARKHAND', 'LADAKH', 'MADHYA PRADESH', 'MANIPUR', 'MIZORAM', 'NAGALAND', 'ORISSA', 'PONDICHERRY', 'PUNJAB', 'RAJASTHAN', 'SIKKIM', 'UTTARAKHAND', 'ANDAMAN AND NICOBAR ISLANDS', 'LAKSHADWEEP', 'DADRA NAGAR HAVELI AND DAMAN AND DIU'];

  // Common districts so the editor can suggest them; the filler accepts any district the site lists.
  IVH.COMMON_DISTRICTS = {
    'WEST BENGAL': ['KOLKATA', 'NORTH 24 PARGANAS', 'SOUTH 24 PARGANAS', 'HAWRAH', 'HOOGHLY', 'NADIA', 'DARJILING', 'JALPAIGURI', 'MALDA', 'MURSHIDABAD'],
    'TAMIL NADU': ['CHENNAI', 'VELLORE', 'COIMBATORE', 'MADURAI'],
    'KARNATAKA': ['BANGALORE', 'BANGALORE RURAL', 'MYSORE'],
    'DELHI': ['DELHI', 'NEW DELHI'], // the visa site lists only these (and NOT KNOWN)
    'TELANGANA': ['HYDERABAD', 'RANGAREDDY'],
    'MAHARASHTRA': ['MUMBAI', 'MUMBAI SUBURBAN', 'PUNE'],
    'ASSAM': ['KAMRUP METROPOLITAN', 'KAMRUP', 'CACHAR'],
    'TRIPURA': ['WEST TRIPURA'],
  };

  IVH.COUNTRIES = [['BGD', 'BANGLADESH'], ['IND', 'INDIA'], ['NPL', 'NEPAL'], ['BTN', 'BHUTAN'], ['PAK', 'PAKISTAN'], ['LKA', 'SRI LANKA'], ['MDV', 'MALDIVES'], ['AFG', 'AFGHANISTAN'], ['MMR', 'MYANMAR'], ['CHN', 'CHINA-CHINA'], ['THA', 'THAILAND'], ['MYS', 'MALAYSIA'], ['SGP', 'SINGAPORE'], ['IDN', 'INDONESIA'], ['ARE', 'UNITED ARAB EMIRATES'], ['SAU', 'SAUDI ARABIA'], ['QAT', 'QATAR'], ['KWT', 'KUWAIT'], ['OMN', 'OMAN'], ['BHR', 'BAHRAIN'], ['JOR', 'JORDAN'], ['LBN', 'LEBANON'], ['TUR', 'TURKEY'], ['GBR', 'UNITED KINGDOM'], ['USA', 'UNITED STATES OF AMERICA'], ['CAN', 'CANADA'], ['AUS', 'AUSTRALIA'], ['NZL', 'NEW ZEALAND'], ['ITA', 'ITALY'], ['FRA', 'FRANCE'], ['DEU', 'GERMANY'], ['ESP', 'SPAIN'], ['PRT', 'PORTUGAL'], ['GRC', 'GREECE'], ['SWE', 'SWEDEN'], ['NLD', 'NETHERLANDS'], ['JPN', 'JAPAN'], ['KOR', 'REPUBLIC OF KOREA'], ['HKG', 'CHINA- SAR HONGKONG'], ['RUS', 'RUSSIAN FEDERATION'], ['ZAF', 'SOUTH AFRICA'], ['EGY', 'EGYPT'], ['IRQ', 'IRAQ'], ['IRN', 'IRAN'], ['LBY', 'LIBYA'], ['MUS', 'MAURITIUS'], ['BRN', 'BRUNEI']];

  IVH.SAARC = [['AFG', 'AFGHANISTAN'], ['BTN', 'BHUTAN'], ['PAK', 'PAKISTAN'], ['MDV', 'MALDIVES'], ['LKA', 'SRI LANKA'], ['NPL', 'NEPAL']];

  IVH.SECURITY_QUESTIONS = 6;

  // Document slots, one per row of the site's Document Upload table (rows mapped from the live site, Nov 2026).
  // `row` matches the row description; the first matching slot wins, so specific rows come before the passport.
  // `required`: visa kinds where the site marks the row Mandatory. `for`: kinds whose table shows the row.
  const MED = ['medical', 'attendant'];
  IVH.DOC_SLOTS = [
    { key: 'hospitalLetter', en: 'Hospital letter (India): signed & stamped, on letterhead, addressed to the Mission', bn: 'হাসপাতালের চিঠি (ভারত): স্বাক্ষর ও সিলসহ, প্যাডে, মিশন বরাবর', row: 'SIGNED AND STAMPED FROM THE HOSPITAL', for: MED, required: MED },
    { key: 'medUndertaking', en: 'Medical Visa Undertaking (filled)', bn: 'মেডিকেল ভিসা আন্ডারটেকিং (পূরণকৃত)', row: 'MEDICAL VISA UNDERTAKING', for: MED, required: MED },
    { key: 'addressProof', en: 'Address proof', bn: 'ঠিকানার প্রমাণ', row: '^ADDRESS PROOF', for: MED },
    { key: 'tickets', en: 'Confirmed to-and-fro travel tickets', bn: 'যাওয়া-আসার নিশ্চিত টিকেট', row: 'TRAVEL TICKETS', for: MED },
    { key: 'nidCopy', en: 'National ID card copy (or equivalent)', bn: 'জাতীয় পরিচয়পত্রের কপি (বা সমতুল্য)', row: 'NATIONAL ID CARD', for: MED },
    { key: 'indianOrigin', en: 'Indian origin: Surrender Certificate / cancelled Indian passport', bn: 'ভারতীয় বংশোদ্ভূত: সারেন্ডার সার্টিফিকেট / বাতিল ভারতীয় পাসপোর্ট', row: 'SURRENDER CERTIFICATE|INDIAN ORIGIN', for: MED },
    { key: 'nationalityCert', en: 'Nationality Certificate', bn: 'নাগরিকত্ব সনদ', row: 'NATIONALITY CERTIFICATE', for: MED },
    { key: 'otherPassport', en: 'Other nationality passport (double nationality)', bn: 'অন্য দেশের পাসপোর্ট (দ্বৈত নাগরিকত্ব)', row: 'OTHER NATIONALITY PASSPORT', for: MED },
    { key: 'residenceProof', en: 'Utility bill or bank statement (proof of residence)', bn: 'ইউটিলিটি বিল বা ব্যাংক স্টেটমেন্ট (বসবাসের প্রমাণ)', row: 'UTILITY BILL|BANK STATEMENT', for: MED },
    { key: 'funds', en: 'Proof of funds / salary certificate / sponsorship letter', bn: 'অর্থের প্রমাণ / বেতন সনদ / স্পনসরশিপ চিঠি', row: 'SUFFICIENT FUNDS|SALARY CERTIFICATE|SPONSORSHIP', for: MED },
    { key: 'attendantLetter', en: 'Doctor/hospital letter: attendant needed (Medical Attendant)', bn: 'ডাক্তার/হাসপাতালের চিঠি: অ্যাটেনডেন্ট প্রয়োজন (মেডিকেল অ্যাটেনডেন্ট)', row: 'REQUIREMENT OF AN ATTENDANT', for: MED },
    { key: 'patientTreatment', en: "Patient's treatment documents (Medical Attendant)", bn: 'রোগীর চিকিৎসার কাগজ (মেডিকেল অ্যাটেনডেন্ট)', row: 'MEDICAL TREATMENT OF PATIENT', for: MED },
    { key: 'prevMedical', en: 'Previous medical records of patient', bn: 'রোগীর আগের মেডিকেল রেকর্ড', row: 'PREVIOUS MEDICAL RECORDS', for: MED },
    { key: 'passport', en: 'Passport copy (photo page)', bn: 'পাসপোর্টের কপি (ছবির পাতা)', row: '^COPY OF PASSPORT PAGE', for: ['tourist', ...MED], required: ['tourist', ...MED] },
  ];
  // Applicant profile types (Medical Attendant comes later). Value, English, Bangla, Start-screen purpose code.
  IVH.PROFILE_VISA_TYPES = [
    ['tourist', 'Tourist (T1)', 'ট্যুরিস্ট (T1)', '544'],
    ['medical', 'Medical (M1)', 'মেডিকেল (M1)', '545'],
  ];
  IVH.profileVisaType = p => (p?.visaType === 'medical' ? 'medical' : 'tourist');
  IVH.visaKind = s => (IVH.isAttendant(s) ? 'attendant' : IVH.isMedical(s) ? 'medical' : 'tourist');
  // Which slot a site row belongs to (row text uppercased), or null for rows the extension doesn't know.
  IVH.slotForRow = text => IVH.DOC_SLOTS.find(d => new RegExp(d.row, 'i').test(text))?.key || null;
  // Documents saved before slots existed: the one labelled as the passport copy counts as the passport slot.
  IVH.docSlot = doc => doc.slot || (/PASSPORT/i.test(doc.label || '') ? 'passport' : null);

  // Models offered for the optional AI passport scan (Settings).
  IVH.AI_MODELS = [
    ['claude-opus-5-5', 'Claude Opus 5.5 — most accurate (~2–3 US cents per scan)'],
    ['claude-haiku-5-5', 'Claude Haiku 5.5 — cheapest (under 1 cent per scan)'],
  ];
  IVH.DEFAULT_AI_MODEL = 'claude-opus-5-5';
})();
