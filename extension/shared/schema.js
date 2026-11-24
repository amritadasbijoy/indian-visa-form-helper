// Field definitions that drive the editors in the side panel (labels in English and Bangla).
// `show` hides a field unless the predicate on the record is true; `def` is the default for new records.
(() => {
  const IVH = (globalThis.IVH = globalThis.IVH || {});
  const C = IVH;
  const yes = k => r => !!r[k];
  const opts = list => list.map(v => (Array.isArray(v) ? v : [v, v]));
  const country = { type: 'select', options: () => opts(C.COUNTRIES), def: 'BGD' };

  IVH.PROFILE_SCHEMA = [
    { group: 'visa', en: 'Visa type', bn: 'ভিসার ধরন', fields: [
      // Decides which documents the profile asks for and the visa type the Start screen picks.
      { k: 'visaType', en: 'This applicant applies for', bn: 'এই আবেদনকারী যে ভিসার জন্য', type: 'select', options: () => IVH.PROFILE_VISA_TYPES.map(([v, en, bn]) => [v, IVH.lang() === 'bn' ? bn : en]), def: 'tourist', req: true },
    ]},
    { group: 'personal', en: 'Personal details', bn: 'ব্যক্তিগত তথ্য', fields: [
      { k: 'surname', en: 'Surname (as in passport)', bn: 'নামের শেষাংশ (পাসপোর্ট অনুযায়ী)', req: true },
      { k: 'givenName', en: 'Given name(s)', bn: 'নামের প্রথমাংশ', req: true },
      { k: 'changedName', en: 'Ever changed name?', bn: 'কখনো নাম পরিবর্তন করেছেন?', type: 'bool' },
      { k: 'prevSurname', en: 'Previous surname', bn: 'পূর্বের নামের শেষাংশ', show: yes('changedName') },
      { k: 'prevGivenName', en: 'Previous given name', bn: 'পূর্বের নামের প্রথমাংশ', show: yes('changedName') },
      { k: 'gender', en: 'Gender', bn: 'লিঙ্গ', type: 'select', options: () => [['M', 'MALE'], ['F', 'FEMALE'], ['X', 'TRANSGENDER']], req: true },
      { k: 'dob', en: 'Date of birth', bn: 'জন্ম তারিখ', type: 'date', req: true },
      { k: 'birthPlace', en: 'Town/City of birth', bn: 'জন্মস্থান (শহর/জেলা)', req: true },
      { k: 'birthCountry', en: 'Country of birth', bn: 'জন্মের দেশ', ...country },
      { k: 'nationalId', en: 'National ID / Birth reg. no. (NA if none)', bn: 'জাতীয় পরিচয়পত্র / জন্ম নিবন্ধন নং', def: 'NA' },
      { k: 'religion', en: 'Religion', bn: 'ধর্ম', type: 'select', options: () => opts(C.RELIGIONS), req: true },
      { k: 'religionOther', en: 'Religion (other)', bn: 'অন্যান্য ধর্ম', show: r => r.religion === 'OTHERS' },
      { k: 'identMarks', en: 'Visible identification marks', bn: 'দৃশ্যমান শনাক্তকরণ চিহ্ন', def: 'NO' },
      { k: 'education', en: 'Educational qualification', bn: 'শিক্ষাগত যোগ্যতা', type: 'select', options: () => opts(C.EDUCATION), req: true },
      { k: 'nationalityBy', en: 'Nationality by', bn: 'নাগরিকত্ব', type: 'select', options: () => [['BY BIRTH', 'By Birth'], ['NATURALIZATION', 'Naturalization']], def: 'BY BIRTH' },
      { k: 'prevNationality', en: 'Previous nationality', bn: 'পূর্বের নাগরিকত্ব', ...country, show: r => r.nationalityBy === 'NATURALIZATION' },
    ]},
    { group: 'passport', en: 'Passport', bn: 'পাসপোর্ট', fields: [
      { k: 'passportNo', en: 'Passport number', bn: 'পাসপোর্ট নম্বর', req: true },
      { k: 'passportIssuePlace', en: 'Place of issue', bn: 'ইস্যুর স্থান', def: 'DHAKA', req: true },
      { k: 'passportIssueDate', en: 'Date of issue', bn: 'ইস্যুর তারিখ', type: 'date', req: true },
      { k: 'passportExpiry', en: 'Date of expiry', bn: 'মেয়াদ শেষের তারিখ', type: 'date', req: true },
      { k: 'otherPassport', en: 'Any other passport/IC held?', bn: 'অন্য কোনো পাসপোর্ট আছে?', type: 'bool' },
      { k: 'otherPptCountry', en: 'Other passport – country', bn: 'অন্য পাসপোর্ট – দেশ', ...country, show: yes('otherPassport') },
      { k: 'otherPptNo', en: 'Other passport – number', bn: 'অন্য পাসপোর্ট – নম্বর', show: yes('otherPassport') },
      { k: 'otherPptIssueDate', en: 'Other passport – issue date', bn: 'অন্য পাসপোর্ট – ইস্যুর তারিখ', type: 'date', show: yes('otherPassport') },
      { k: 'otherPptIssuePlace', en: 'Other passport – place of issue', bn: 'অন্য পাসপোর্ট – ইস্যুর স্থান', show: yes('otherPassport') },
      { k: 'otherPptNat', en: 'Other passport – nationality', bn: 'অন্য পাসপোর্ট – নাগরিকত্ব', ...country, show: yes('otherPassport') },
    ]},
    { group: 'contact', en: 'Address & contact', bn: 'ঠিকানা ও যোগাযোগ', fields: [
      { k: 'presAdd1', en: 'House no./Street (max 35)', bn: 'বাড়ি/রাস্তা (সর্বোচ্চ ৩৫ অক্ষর)', max: 35, req: true },
      { k: 'presAdd2', en: 'Village/Town/City', bn: 'গ্রাম/শহর', max: 35, req: true },
      { k: 'presDistrict', en: 'District', bn: 'জেলা', req: true },
      { k: 'presPostal', en: 'Postal code', bn: 'পোস্ট কোড' },
      { k: 'phone', en: 'Phone no.', bn: 'ফোন নম্বর', req: true },
      { k: 'mobile', en: 'Mobile (without 880)', bn: 'মোবাইল (৮৮০ ছাড়া)' },
      { k: 'email', en: 'Email', bn: 'ইমেইল' },
      { k: 'permSame', en: 'Permanent address same as present', bn: 'স্থায়ী ঠিকানা বর্তমানের মতো', type: 'bool', def: true },
      { k: 'permAdd1', en: 'Permanent – House/Street', bn: 'স্থায়ী – বাড়ি/রাস্তা', max: 35, show: r => !r.permSame },
      { k: 'permAdd2', en: 'Permanent – Village/Town', bn: 'স্থায়ী – গ্রাম/শহর', max: 35, show: r => !r.permSame },
      { k: 'permAdd3', en: 'Permanent – District', bn: 'স্থায়ী – জেলা', show: r => !r.permSame },
    ]},
    { group: 'family', en: 'Family', bn: 'পরিবার', fields: [
      { k: 'fatherName', en: "Father's name", bn: 'পিতার নাম', req: true },
      { k: 'fatherNationality', en: "Father's nationality", bn: 'পিতার নাগরিকত্ব', ...country },
      { k: 'fatherPrevNationality', en: "Father's previous nationality", bn: 'পিতার পূর্বের নাগরিকত্ব', ...country },
      { k: 'fatherBirthPlace', en: "Father's place of birth", bn: 'পিতার জন্মস্থান' },
      { k: 'fatherBirthCountry', en: "Father's country of birth", bn: 'পিতার জন্মের দেশ', ...country },
      { k: 'motherName', en: "Mother's name", bn: 'মাতার নাম', req: true },
      { k: 'motherNationality', en: "Mother's nationality", bn: 'মাতার নাগরিকত্ব', ...country },
      { k: 'motherPrevNationality', en: "Mother's previous nationality", bn: 'মাতার পূর্বের নাগরিকত্ব', ...country },
      { k: 'motherBirthPlace', en: "Mother's place of birth", bn: 'মাতার জন্মস্থান' },
      { k: 'motherBirthCountry', en: "Mother's country of birth", bn: 'মাতার জন্মের দেশ', ...country },
      { k: 'maritalStatus', en: 'Marital status', bn: 'বৈবাহিক অবস্থা', type: 'select', options: () => [['SINGLE', 'SINGLE'], ['MARRIED', 'MARRIED']], def: 'SINGLE' },
      { k: 'spouseName', en: "Spouse's name", bn: 'স্বামী/স্ত্রীর নাম', show: r => r.maritalStatus === 'MARRIED' },
      { k: 'spouseNationality', en: "Spouse's nationality", bn: 'স্বামী/স্ত্রীর নাগরিকত্ব', ...country, show: r => r.maritalStatus === 'MARRIED' },
      { k: 'spousePrevNationality', en: "Spouse's previous nationality", bn: 'স্বামী/স্ত্রীর পূর্বের নাগরিকত্ব', ...country, show: r => r.maritalStatus === 'MARRIED' },
      { k: 'spouseBirthPlace', en: "Spouse's place of birth", bn: 'স্বামী/স্ত্রীর জন্মস্থান', show: r => r.maritalStatus === 'MARRIED' },
      { k: 'spouseBirthCountry', en: "Spouse's country of birth", bn: 'স্বামী/স্ত্রীর জন্মের দেশ', ...country, show: r => r.maritalStatus === 'MARRIED' },
      { k: 'pakAncestry', en: 'Grandparents Pakistani nationals?', bn: 'দাদা-দাদি/নানা-নানি পাকিস্তানি ছিলেন?', type: 'bool' },
      { k: 'pakDetails', en: 'If yes, details', bn: 'হ্যাঁ হলে বিস্তারিত', show: yes('pakAncestry') },
    ]},
    { group: 'occupation', en: 'Occupation', bn: 'পেশা', fields: [
      { k: 'occupation', en: 'Present occupation', bn: 'বর্তমান পেশা', type: 'select', options: () => opts(C.OCCUPATIONS), req: true },
      { k: 'occupationOther', en: 'Occupation (other)', bn: 'অন্যান্য পেশা', show: r => r.occupation === 'OTHERS' },
      { k: 'occOf', en: 'Employment details are of', bn: 'চাকরির তথ্য কার', type: 'select', options: () => [['F', 'Father'], ['M', 'Mother'], ['S', 'Spouse']], def: 'F', show: r => C.DEPENDENT_OCCUPATIONS.includes(r.occupation) },
      { k: 'empName', en: 'Employer name / business', bn: 'প্রতিষ্ঠান / ব্যবসার নাম' },
      { k: 'empDesignation', en: 'Designation', bn: 'পদবি' },
      { k: 'empAddress', en: 'Employer address', bn: 'প্রতিষ্ঠানের ঠিকানা' },
      { k: 'empPhone', en: 'Employer phone', bn: 'প্রতিষ্ঠানের ফোন' },
      { k: 'prevOccupation', en: 'Past occupation (optional)', bn: 'পূর্বের পেশা (ঐচ্ছিক)', type: 'select', options: () => [['', '—'], ...opts(C.OCCUPATIONS)] },
      { k: 'prevOccupationDetails', en: 'Past occupation details', bn: 'পূর্বের পেশার বিবরণ', show: r => r.prevOccupation === 'OTHERS' },
      { k: 'military', en: 'In military/police/security org.?', bn: 'সামরিক/পুলিশ/নিরাপত্তা বাহিনীতে ছিলেন?', type: 'bool' },
      { k: 'prevOrg', en: 'Organization', bn: 'সংস্থা', show: yes('military') },
      { k: 'prevDesignation', en: 'Designation', bn: 'পদবি', show: yes('military') },
      { k: 'prevRank', en: 'Rank', bn: 'র‍্যাংক', show: yes('military') },
      { k: 'prevPosting', en: 'Place of posting', bn: 'কর্মস্থল', show: yes('military') },
    ]},
    { group: 'history', en: 'Previous visits', bn: 'পূর্বের ভ্রমণ', fields: [
      { k: 'visitedBefore', en: 'Visited India before?', bn: 'আগে ভারতে গিয়েছেন?', type: 'bool' },
      { k: 'prevAdd1', en: 'Address stayed (line 1)', bn: 'যেখানে ছিলেন (লাইন ১)', show: yes('visitedBefore') },
      { k: 'prevAdd2', en: 'Address stayed (line 2)', bn: 'যেখানে ছিলেন (লাইন ২)', show: yes('visitedBefore') },
      { k: 'prevAdd3', en: 'Address stayed (line 3)', bn: 'যেখানে ছিলেন (লাইন ৩)', show: yes('visitedBefore') },
      { k: 'prevCities', en: 'Cities visited (comma separated)', bn: 'যে শহরগুলোতে গিয়েছেন', show: yes('visitedBefore') },
      { k: 'prevVisaNo', en: 'Last Indian visa no.', bn: 'সর্বশেষ ভিসা নম্বর', show: yes('visitedBefore') },
      { k: 'prevVisaType', en: 'Last visa type', bn: 'সর্বশেষ ভিসার ধরন', type: 'select', options: () => opts(C.OLD_VISA_TYPES), show: yes('visitedBefore') },
      { k: 'prevVisaPlace', en: 'Last visa place of issue', bn: 'সর্বশেষ ভিসা ইস্যুর স্থান', show: yes('visitedBefore') },
      { k: 'prevVisaDate', en: 'Last visa date of issue', bn: 'সর্বশেষ ভিসা ইস্যুর তারিখ', type: 'date', show: yes('visitedBefore') },
      { k: 'refused', en: 'Ever refused an Indian visa/extension?', bn: 'কখনো ভিসা প্রত্যাখ্যাত হয়েছে?', type: 'bool' },
      { k: 'refusedDetails', en: 'If so, when and by whom', bn: 'হলে কবে ও কে', show: yes('refused') },
      { k: 'countriesVisited', en: 'Countries visited in last 10 years', bn: 'গত ১০ বছরে ভ্রমণকৃত দেশ', type: 'textarea' },
      { k: 'saarcVisited', en: 'Visited SAARC countries in last 3 years?', bn: 'গত ৩ বছরে সার্ক দেশে গিয়েছেন?', type: 'bool' },
      { k: 'saarcList', en: 'SAARC visits – one per line: CODE YEAR TIMES (e.g. NPL 2025 1)', bn: 'সার্ক ভ্রমণ – প্রতি লাইনে: কোড বছর বার (যেমন NPL 2025 1)', type: 'textarea', show: yes('saarcVisited') },
    ]},
    { group: 'security', en: 'Additional questions', bn: 'অতিরিক্ত প্রশ্ন', fields: [
      ...[
        ['Arrested/prosecuted/convicted?', 'গ্রেফতার/মামলা/দণ্ডিত হয়েছেন?'],
        ['Refused entry/deported by any country?', 'কোনো দেশে প্রবেশে বাধা/বহিষ্কৃত হয়েছেন?'],
        ['Trafficking/abuse/fraud involvement?', 'পাচার/নির্যাতন/প্রতারণায় জড়িত?'],
        ['Cyber crime/terrorism/espionage?', 'সাইবার অপরাধ/সন্ত্রাস/গুপ্তচরবৃত্তি?'],
        ['Expressed views justifying terrorism?', 'সন্ত্রাসকে সমর্থন করে মত প্রকাশ?'],
        ['Sought asylum in any country?', 'কোনো দেশে আশ্রয় চেয়েছেন?'],
      ].flatMap(([en, bn], i) => [
        { k: 'secQ' + (i + 1), en: `${i + 1}. ${en}`, bn: `${i + 1}. ${bn}`, type: 'bool' },
        { k: 'secA' + (i + 1), en: 'Details', bn: 'বিস্তারিত', show: yes('secQ' + (i + 1)) },
      ]),
    ]},
  ];

  const place = [
    { k: 'name', en: 'Name', bn: 'নাম', req: true },
    { k: 'address1', en: 'Address line 1', bn: 'ঠিকানা লাইন ১', req: true },
    { k: 'address2', en: 'Address line 2', bn: 'ঠিকানা লাইন ২' },
    { k: 'state', en: 'State', bn: 'রাজ্য', type: 'select', options: () => opts(C.INDIA_STATES), def: 'WEST BENGAL' },
    { k: 'district', en: 'District', bn: 'জেলা', def: 'KOLKATA', list: r => C.COMMON_DISTRICTS[r.state] || [] },
    { k: 'phone', en: 'Phone', bn: 'ফোন', req: true },
  ];

  IVH.HOTEL_SCHEMA = [{ group: 'hotel', en: 'Hotel / place of stay', bn: 'হোটেল / থাকার স্থান', fields: [
    ...place,
    { k: 'email', en: 'Email (optional)', bn: 'ইমেইল (ঐচ্ছিক)' },
  ]}];

  // Hospitals in India (treatment; also usable as the India reference) and in Bangladesh (the applicant's own
  // doctor, asked for as "Residence hospital" on medical visas). State/district only apply in India.
  const inIndia = r => (r.country || 'IN') === 'IN';
  IVH.HOSPITAL_SCHEMA = [{ group: 'hospital', en: 'Hospital', bn: 'হাসপাতাল', fields: [
    { k: 'country', en: 'Hospital in', bn: 'হাসপাতাল কোথায়', type: 'select', options: () => [['IN', 'India (treatment)'], ['BD', "Bangladesh (applicant's doctor)"]], def: 'IN' },
    ...place.map(f => (f.k === 'state' || f.k === 'district' ? { ...f, show: inIndia } : f)),
    { k: 'email', en: 'Email', bn: 'ইমেইল', req: true },
    { k: 'doctor', en: 'Doctor name', bn: 'ডাক্তারের নাম', req: true },
    { k: 'treatment', en: 'Type of treatment', bn: 'চিকিৎসার ধরন', def: 'MEDICAL TREATMENT', show: inIndia },
  ]}];

  IVH.CONTACT_SCHEMA = [{ group: 'contact', en: 'Reference person', bn: 'রেফারেন্স ব্যক্তি', fields: [
    { k: 'country', en: 'Reference in', bn: 'রেফারেন্স কোথায়', type: 'select', options: () => [['BD', 'Bangladesh'], ['IN', 'India']], def: 'BD' },
    { k: 'name', en: 'Name', bn: 'নাম', req: true },
    { k: 'address1', en: 'Address line 1', bn: 'ঠিকানা লাইন ১', req: true },
    { k: 'address2', en: 'Address line 2', bn: 'ঠিকানা লাইন ২' },
    { k: 'state', en: 'State (India only)', bn: 'রাজ্য (শুধু ভারত)', type: 'select', options: () => opts(C.INDIA_STATES), def: 'WEST BENGAL', show: r => r.country === 'IN' },
    { k: 'district', en: 'District (India only)', bn: 'জেলা (শুধু ভারত)', show: r => r.country === 'IN', list: r => C.COMMON_DISTRICTS[r.state] || [] },
    { k: 'phone', en: 'Phone', bn: 'ফোন', req: true },
  ]}];

  IVH.defaultsFor = schema => {
    const r = {};
    for (const g of schema) for (const f of g.fields) if (f.def !== undefined) r[f.k] = f.def;
    return r;
  };
})();
