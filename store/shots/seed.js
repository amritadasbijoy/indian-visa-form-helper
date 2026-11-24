// Made-up example data for the store screenshots (no real people). Loaded before the panel harness reads storage.
(() => {
  const face = (bg, skin, hair) => 'data:image/svg+xml;utf8,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 150"><rect width="120" height="150" fill="${bg}"/>` +
    `<ellipse cx="60" cy="150" rx="52" ry="40" fill="#5b6b8a"/><circle cx="60" cy="66" r="30" fill="${skin}"/>` +
    `<path d="M30 62c0-22 14-34 30-34s30 12 30 34c-6-10-16-14-30-14s-24 4-30 14z" fill="${hair}"/></svg>`);
  const base = {
    nationalityBy: 'BIRTH', birthCountry: 'BANGLADESH', religion: 'HINDU', education: 'GRADUATE', identMarks: 'MOLE ON LEFT CHEEK',
    passportIssuePlace: 'DHAKA', presDistrict: 'COMILLA', presPostal: '3500', permSame: true, visitedBefore: 'NO', refused: 'NO',
    fatherNationality: 'BANGLADESH', motherNationality: 'BANGLADESH', occupation: 'SERVICE', pakAncestry: 'NO',
  };
  const doc = { label: 'COPY OF PASSPORT PAGE', slot: 'passport', name: 'passport.pdf', size: 214000, type: 'application/pdf' };
  const profiles = [
    { ...base, id: 'p1', visaType: 'tourist', surname: 'DAS', givenName: 'RINA', gender: 'F', dob: '1990-03-14', birthPlace: 'COMILLA',
      nationalId: '1990123456789', passportNo: 'A12345679', passportIssueDate: '2022-05-10', passportExpiry: '2032-05-09',
      presAdd1: 'HOUSE 12, ROAD 4', presAdd2: 'KANDIRPAR', mobile: '01712345678', email: 'rina.das@example.com',
      fatherName: 'SUBHASH DAS', fatherBirthPlace: 'COMILLA', motherName: 'MALATI DAS', motherBirthPlace: 'COMILLA',
      maritalStatus: 'MARRIED', spouseName: 'AMIT DAS', spouseNationality: 'BANGLADESH', spouseBirthPlace: 'COMILLA',
      photo: face('#e9eef6', '#c99a76', '#2a1d16'), docs: [doc], updatedAt: Date.now() - 3600e3 },
    { ...base, id: 'p2', visaType: 'medical', religion: 'ISLAM', surname: 'AHMED', givenName: 'KARIM', gender: 'M', dob: '1968-11-02', birthPlace: 'SYLHET',
      nationalId: '6812345678', passportNo: 'B98765432', passportIssueDate: '2021-01-20', passportExpiry: '2031-01-19',
      presAdd1: 'FLAT 3B, ZINDABAZAR', presAdd2: 'SYLHET SADAR', presDistrict: 'SYLHET', mobile: '01811223344', email: 'karim.ahmed@example.com',
      fatherName: 'RAHIM AHMED', fatherBirthPlace: 'SYLHET', motherName: 'AMENA KHATUN', motherBirthPlace: 'SYLHET', maritalStatus: 'MARRIED',
      spouseName: 'NASRIN AKTER', spouseNationality: 'BANGLADESH', spouseBirthPlace: 'SYLHET',
      photo: face('#eef3ea', '#b98563', '#3b3b3b'), docs: [doc], updatedAt: Date.now() - 86400e3 },
    { ...base, id: 'p3', visaType: 'tourist', religion: 'ISLAM', surname: 'BEGUM', givenName: 'FATEMA', gender: 'F', dob: '1995-07-21', birthPlace: 'KHULNA',
      nationalId: '9512345678', passportNo: 'C11223344', passportIssueDate: '2023-08-01', passportExpiry: '2033-07-31',
      presAdd1: 'HOLDING 45, KDA AVENUE', presAdd2: 'SONADANGA', presDistrict: 'KHULNA', mobile: '01911556677', email: 'fatema.begum@example.com',
      fatherName: 'ABDUL KADER', fatherBirthPlace: 'KHULNA', motherName: 'ROKEYA BEGUM', motherBirthPlace: 'KHULNA', maritalStatus: 'SINGLE',
      photo: face('#f6efe9', '#d2a382', '#1c1410'), docs: [doc], updatedAt: Date.now() - 2 * 86400e3 },
  ];
  const hotels = [
    { id: 'h1', name: 'HOTEL EXAMPLE PARK', address1: '12 SAMPLE STREET', address2: 'PARK STREET AREA', state: 'WEST BENGAL', district: 'KOLKATA', phone: '03300000000', email: 'stay@example.com' },
  ];
  const hospitals = [
    { id: 'm1', name: 'EXAMPLE CARE HOSPITAL', address1: '1 HEALTH ROAD', state: 'TAMIL NADU', district: 'CHENNAI', phone: '04400000000', email: 'care@example.com', doctor: 'DR. A. KUMAR', country: 'IN' },
  ];
  const day = 86400e3, iso = d => new Date(d).toISOString().slice(0, 10);
  const applications = [
    { id: 'BGDD12A3B4C5', mission: 'BGDD', profileId: 'p1', name: 'RINA DAS', passportNo: 'A12345679', visaType: 'tourist',
      tempId: 'SIMTEST00000001', submittedAt: Date.now() - 6 * day,
      status: { at: Date.now() - day, text: 'Application under process' },
      pdf: { name: 'RINA_DAS_A12345679_SIMTEST00000001.pdf', size: 186000, dataUrl: 'data:application/pdf;base64,' } },
    { id: 'BGDS9Z8Y7X6W', mission: 'BGDS', profileId: 'p2', name: 'KARIM AHMED', passportNo: 'B98765432', visaType: 'medical',
      tempId: 'SIMTEST00000002', submittedAt: Date.now() - 12 * day,
      status: { at: Date.now() - 2 * day, text: 'Visa granted' } },
  ];
  const data = {
    profiles, hotels, hospitals, contacts: [], applications,
    tempIds: [{ id: 'SIMTEST00000003', profileId: 'p3', name: 'FATEMA BEGUM', at: Date.now() - 3600e3, lastPage: 'Applicant details' }],
    settings: { lang: new URLSearchParams(location.search).get('lang') === 'bn' ? 'bn' : 'en', autoAdvance: true },
    startDraft: { profileId: 'p1', mission: 'BGDD', purpose: '544', journeyDate: iso(Date.now() + 30 * day), email: 'rina.das@example.com',
      hotelId: 'h1', refIndia: 'hotel', refBd: 'spouse', places: 'KOLKATA, DARJEELING', portIn: 'BY AIR/ HARIDASPUR', portOut: 'BY AIR/ HARIDASPUR' },
  };
  localStorage.setItem('ivh-mock', JSON.stringify(data));
})();
