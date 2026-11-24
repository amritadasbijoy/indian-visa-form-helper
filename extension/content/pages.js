// One fill plan per page of the visa site, keyed by the last part of the URL path.
// Each plan turns the applicant profile (p) and the session choices (s) into bridge operations.
// Field ids were mapped from the live site (Oct 2026).
(() => {
  const IVH = globalThis.IVH;
  const U = IVH.upper;
  const D = IVH.toSiteDate;
  // Name boxes for the hotel and references take letters and spaces only ("POLO FLOATEL - KOLKATA" is refused):
  // other marks become spaces.
  const lettersOnly = v => (v == null ? v : String(v).replace(/[^A-Za-z ]+/g, ' ').replace(/\s+/g, ' ').trim());
  const set = (id, value, extra) => ({ op: 'set', id, value: typeof value === 'string' ? U(value) : value, ...extra });
  const radio = id => ({ op: 'radio', id });
  const wait = ms => ({ op: 'wait', ms });
  const yn = (v, yesId, noId) => radio(v ? yesId : noId);

  IVH.PAGES = {
    // Page 1: registration. The applicant types the captcha and clicks Continue.
    Registration: {
      title: 'Registration',
      auto: false,
      plan: ({ p, s }) => [
        set('countryname_id', 'BGD'),
        set('missioncode_id', s.mission),
        set('nationality_id', 'BGD'),
        wait(600),
        set('dob_id', D(p.dob)),
        set('email_id', s.email || p.email),
        set('email_re_id', s.email || p.email),
        set('jouryney_id', D(s.journeyDate)),
        set('visaPurposeDropdown', s.purpose),
        { op: 'focus', id: 'captcha' },
      ],
      after: 'captcha',
    },

    // Resume screen: put in the Temporary ID of the current session; the applicant types the captcha.
    CompletePartially: {
      title: 'Resume application',
      auto: false,
      plan: ({ s }) => (s.tempId ? [set('tempFileNo', s.tempId), { op: 'focus', id: 'captcha' }] : [{ op: 'focus', id: 'tempFileNo' }]),
      after: 'captcha',
    },

    BasicDetails: {
      title: 'Applicant details',
      auto: true,
      plan: ({ p }) => [
        set('surname', p.surname),
        set('givenName', p.givenName),
        { op: 'check', id: 'changedSurnameCheck', value: !!p.changedName },
        ...(p.changedName ? [set('prev_surname', p.prevSurname), set('prev_given_name', p.prevGivenName)] : []),
        set('gender', p.gender),
        set('birth_place', p.birthPlace),
        set('country_birth', p.birthCountry || 'BGD'),
        set('nic_number', p.nationalId || 'NA'),
        set('religion', p.religion),
        ...(p.religion === 'OTHERS' ? [set('religion_other', p.religionOther)] : []),
        set('identity_marks', p.identMarks || 'NO'),
        set('education', p.education),
        set('nationality_by', p.nationalityBy || 'BY BIRTH'),
        ...(p.nationalityBy === 'NATURALIZATION' ? [set('prev_nationality', p.prevNationality)] : []),
        set('passport_no', p.passportNo),
        set('passport_issue_place', p.passportIssuePlace || 'DHAKA'),
        set('passport_issue_date', D(p.passportIssueDate)),
        set('passport_expiry_date', D(p.passportExpiry)),
        yn(p.otherPassport, 'other_ppt_1', 'other_ppt_2'),
        ...(p.otherPassport ? [
          set('other_ppt_country_issue', p.otherPptCountry),
          set('other_ppt_no', p.otherPptNo),
          set('other_ppt_issue_date', D(p.otherPptIssueDate)),
          set('other_ppt_issue_place', p.otherPptIssuePlace),
          set('other_ppt_nat', p.otherPptNat),
        ] : []),
      ],
    },

    FamilyDetails: {
      title: 'Address, family & occupation',
      auto: true,
      plan: ({ p }) => {
        const married = p.maritalStatus === 'MARRIED';
        const dependent = IVH.DEPENDENT_OCCUPATIONS.includes(p.occupation);
        return [
          set('pres_add1', p.presAdd1),
          set('pres_add2', p.presAdd2),
          set('pres_country', 'BGD'),
          wait(500),
          set('pres_add3', p.presDistrict),
          set('pincode', p.presPostal),
          set('pres_phone', p.phone),
          set('isd_code1', '880'),
          set('mobile', (p.mobile || p.phone || '').replace(/\D/g, '').replace(/^(880|0)/, '')),
          ...(p.permSame !== false
            ? [{ op: 'check', id: 'sameAddress_id', value: true }]
            : [set('perm_address1', p.permAdd1), set('perm_address2', p.permAdd2), set('perm_address3', p.permAdd3)]),
          set('fthrname', p.fatherName),
          set('father_nationality', p.fatherNationality || 'BGD'),
          set('father_previous_nationality', p.fatherPrevNationality || p.fatherNationality || 'BGD'),
          set('father_place_of_birth', p.fatherBirthPlace || p.birthPlace),
          set('father_country_of_birth', p.fatherBirthCountry || 'BGD'),
          set('mother_name', p.motherName),
          set('mother_nationality', p.motherNationality || 'BGD'),
          set('mother_previous_nationality', p.motherPrevNationality || p.motherNationality || 'BGD'),
          set('mother_place_of_birth', p.motherBirthPlace || p.birthPlace),
          set('mother_country_of_birth', p.motherBirthCountry || 'BGD'),
          set('marital_status', married ? '0' : '1'),
          ...(married ? [
            { op: 'waitVisible', id: 'spouse_name' },
            set('spouse_name', p.spouseName),
            set('spouse_nationality', p.spouseNationality || 'BGD'),
            set('spouse_previous_nationality', p.spousePrevNationality || p.spouseNationality || 'BGD'),
            // Usually the applicant's own place of birth (the owner's rule); used when the profile has none.
            set('spouse_place_of_birth', p.spouseBirthPlace || p.birthPlace),
            // This select's onchange opens a confirmation popup, so set it silently.
            set('spouse_country_of_birth', p.spouseBirthCountry || 'BGD', { events: false }),
          ] : []),
          yn(p.pakAncestry, 'grandparent_flag1', 'grandparent_flag2'),
          ...(p.pakAncestry ? [set('grandparent_details', p.pakDetails)] : []),
          set('occupation', p.occupation),
          ...(p.occupation === 'OTHERS' ? [set('occupationOther', p.occupationOther)] : []),
          ...(dependent ? [{ op: 'waitVisible', id: 'occ_flag', timeout: 2000 }, set('occ_flag', p.occOf || 'F')] : []),
          set('empname', p.empName || (dependent ? 'NA' : '')),
          set('empdesignation', p.empDesignation || (dependent ? 'NA' : '')),
          set('empaddress', p.empAddress || (dependent ? 'NA' : '')),
          set('empphone', p.empPhone || ''),
          ...(p.prevOccupation ? [set('previous_occupation', p.prevOccupation)] : []),
          ...(p.prevOccupation === 'OTHERS' ? [set('previous_occupation_details', p.prevOccupationDetails)] : []),
          yn(p.military, 'prev_org1', 'prev_org2'),
          ...(p.military ? [
            set('previous_organization', p.prevOrg),
            set('previous_designation', p.prevDesignation),
            set('previous_rank', p.prevRank),
            set('previous_posting', p.prevPosting),
          ] : []),
        ];
      },
    },

    VisaDetails: {
      title: 'Visa details & references',
      auto: true,
      plan: ({ p, s, refIndia, refBd, hospital, bdHospital }) => {
        const saarc = (p.saarcList || '').split('\n').map(l => l.trim().split(/\s+/)).filter(a => a[0]);
        return [
          // Medical: the invitation letter lookup fills the Indian hospital first; the rules then only fill gaps.
          ...(IVH.isMedical(s) ? [{ op: 'medicalLookup', value: s.medicalLetterNo }] : []),
          { op: 'serviceByLabel', rules: serviceRules({ p, s, hospital, bdHospital }) },
          set('duration', s.duration || '12'),
          set('visa_entry_id', s.entries || '2'),
          set('jouryney_id', D(s.journeyDate)),
          set('entrypoint', s.portIn),
          set('exitpointprc', s.portOut || s.portIn),
          yn(p.visitedBefore, 'old_visa_flag1', 'old_visa_flag2'),
          ...(p.visitedBefore ? [
            set('prv_visit_add1', p.prevAdd1),
            set('prv_visit_add2', p.prevAdd2),
            set('prv_visit_add3', p.prevAdd3),
            set('visited_city', p.prevCities),
            set('old_visa_no', p.prevVisaNo),
            set('old_visa_type_id', p.prevVisaType, { byText: true }),
            set('oldvisaissueplace', p.prevVisaPlace),
            set('oldvisaissuedate', D(p.prevVisaDate)),
          ] : []),
          yn(p.refused, 'refuse_flag1', 'refuse_flag2'),
          ...(p.refused ? [set('refuse_details', p.refusedDetails)] : []),
          set('country_visited', p.countriesVisited || ''),
          yn(p.saarcVisited && saarc.length, 'saarc_flag1', 'saarc_flag2'),
          ...(p.saarcVisited ? saarc.slice(0, 8).flatMap(([c, y, n], i) => [
            ...(i > 0 ? [{ op: 'call', fn: 'add_saarc_rows' }] : []),
            set('saarcCountry' + (i + 1), c),
            set('saarcYear' + (i + 1), y),
            set('saarcVisitNo' + (i + 1), n || '1'),
          ]) : []),
          set('nameofsponsor_ind', lettersOnly(refIndia?.name)),
          set('add1ofsponsor_ind', refIndia?.address1),
          set('add2ofsponsor_ind', refIndia?.address2 || refIndia?.address1),
          set('stateofsponsor_ind', refIndia?.state, { reloads: 'districtofsponsor_ind' }),
          set('districtofsponsor_ind', refIndia?.district, { byText: true, timeout: 12000 }),
          set('phoneofsponsor_ind', refIndia?.phone),
          set('nameofsponsor_msn', lettersOnly(refBd?.name)),
          set('add1ofsponsor_msn', refBd?.address1),
          set('add2ofsponsor_msn', refBd?.address2 || refBd?.address1),
          set('phoneofsponsor_msn', refBd?.phone),
        ];
      },
    },

    // Photo upload happens in three steps on the same URL: choose file, crop, confirm.
    // The stored photo is already 350×350, so the site's default crop box covers all of it.
    PhotoUpload: {
      title: 'Photo upload',
      auto: true,
      state: () =>
        document.getElementById('image_error_id') ? 'choose'
          : document.querySelector('input[type=submit][value="Crop and Save"]') ? 'crop'
            : document.querySelector('input[type=submit][value="Save and Continue"]') ? 'saved' : 'unknown',
      plan: ({ p, state }) => {
        if (state === 'choose') {
          if (!p.photo) return [{ op: 'fail', message: 'no photo in this applicant profile — add one, or choose the file by hand' }];
          return [{ op: 'upload', id: 'image_error_id', name: 'photo.jpg', type: 'image/jpeg', dataUrl: p.photo }];
        }
        return [];
      },
      next: ({ state }) => ({
        choose: { op: 'click', id: 'continue' },
        crop: { op: 'click', selector: 'input[type=submit][value="Crop and Save"]' },
        saved: { op: 'click', selector: 'input[type=submit][value="Save and Continue"]' },
      }[state]),
    },

    // One upload per page load: the next row whose document slot has a file in the applicant's profile.
    // Rows are matched to slots exactly (IVH.DOC_SLOTS); optional rows without a file are skipped.
    // The "verified" checkbox and Confirm are left for the applicant.
    DocumentUpload: {
      title: 'Document upload',
      auto: true,
      state: ({ p }) => {
        const next = nextUpload(p);
        if (next) return 'row' + next.row.serial;
        return missingRequired(p).length ? 'missing' : 'done';
      },
      plan: ({ p, state }) => {
        if (state === 'missing') return [{ op: 'fail', message: `${IVH.t('docMissing')} ${missingRequired(p).join(' · ')}` }];
        if (!state.startsWith('row')) return [];
        const { row, doc } = nextUpload(p);
        return [{ op: 'uploadRow', serial: row.serial, name: doc.name || 'document.pdf', type: 'application/pdf', dataUrl: doc.dataUrl }];
      },
      after: ({ state }) => (state === 'done' ? 'docsDone' : null),
      next: ({ state }) => (state.startsWith('row') ? { op: 'clickRow', serial: state.slice(3), value: 'Upload Document' } : null),
    },

    // Place(s) of stay in India, after the document page. Up to 4 rows; address boxes take 50 characters.
    BangladeshDetails: {
      title: 'Hotel / place of stay',
      auto: true,
      plan: ({ hotel, hotel2 }) => [hotel, hotel2].filter(Boolean).flatMap((h, i) => {
        const n = i + 1;
        return [
          ...(i > 0 ? [{ op: 'call', fn: 'add_place_of_stay_bgd' }, { op: 'waitVisible', id: 'place_of_stay' + n }] : []),
          set('place_of_stay' + n, lettersOnly(h.name)),
          set('pos_address' + n, [h.address1, h.address2].filter(Boolean).join(', ').slice(0, 50)),
          set('pos_state_id' + n, h.state, { reloads: 'pos_dist_id' + n }),
          set('pos_dist_id' + n, h.district, { byText: true, timeout: 12000 }),
          set('pos_email' + n, (h.email || '').toLowerCase()),
          set('pos_phone' + n, h.phone),
        ];
      }),
    },

    // Final review. "Verified and Continue" registers the application, so that click is always the applicant's.
    Verification: {
      title: 'Final review',
      auto: false,
      plan: () => [],
      after: 'final',
    },

    // Security questions: answers come from the profile. The declaration is ticked only when the applicant clicks
    // "I confirm" on the floating panel (content.js), which then clicks Save and Continue.
    AdditionalQuestions: {
      title: 'Additional questions',
      auto: false,
      plan: ({ p }) => Array.from({ length: IVH.SECURITY_QUESTIONS }, (_, i) => {
        const n = i + 1;
        return p['secQ' + n]
          ? [radio('question_yes_' + n), set('answer_' + n, p['secA' + n])]
          : [radio('question_no_' + n)];
      }).flat(),
      after: 'declaration',
    },
  };

  // Rows of the document table that still show an "Upload Document" button.
  function pendingRows() {
    return [...document.querySelectorAll('tr')]
      .filter(tr => tr.cells.length >= 4 && [...tr.querySelectorAll('input[type=file]')].some(f => f.offsetParent) && !tr.querySelector('input[value=View]'))
      .map(tr => ({ serial: tr.cells[0].innerText.trim(), text: tr.cells[1].innerText.replace(/\s+/g, ' ').trim().toUpperCase() }));
  }

  // The first not-yet-uploaded row that has a file in the profile's matching document slot.
  function nextUpload(p) {
    const docs = p.docs || [];
    for (const row of pendingRows()) {
      const slot = IVH.slotForRow(row.text);
      const doc = slot && docs.find(d => IVH.docSlot(d) === slot);
      if (doc) return { row, doc };
    }
    return null;
  }

  // Mandatory rows still waiting for a file that the profile doesn't have (named by their slot).
  function missingRequired(p) {
    const docs = p.docs || [];
    return pendingRows()
      .filter(row => /MANDATORY/.test(row.text))
      .filter(row => !docs.some(d => IVH.docSlot(d) === IVH.slotForRow(row.text)))
      .map(row => { const slot = IVH.DOC_SLOTS.find(d => d.key === IVH.slotForRow(row.text)); return slot ? IVH.tl(slot) : row.text.slice(0, 60); });
  }


  // Label → value rules for the visa-type specific inputs on VisaDetails, tried in order (labels mapped from
  // the live site: Tourist "Places to be Visited"; Medical "Medical Certificate No", "Hospital Name",
  // "Address", "Doctor Name", "Phone/Fax", "Email ID", "Residence …" and "Nature of Illness").
  // Values the invitation-letter lookup filled are kept (keepFilled). Every site box takes 50 characters.
  function serviceRules({ s, hospital, bdHospital }) {
    const h = hospital || {}, b = bdHospital || {};
    const addr = x => [x.address1, x.address2].filter(Boolean).join(', ').slice(0, 50);
    const up = v => (typeof v === 'string' ? v.toUpperCase() : v);
    return [
      { re: 'places? to be visited', value: s.places || 'KOLKATA' },
      { re: '^residence hospital', value: up(b.name) },
      { re: '^residence address', value: up(addr(b)) },
      { re: '^residence doctor', value: up(b.doctor) },
      { re: '^residence (phone|fax)', value: b.phone },
      { re: '^residence email', value: b.email },
      { re: '^medical certificate|invitation', value: s.medicalLetterNo, keepFilled: true },
      { re: '^hospital name', value: up(h.name), keepFilled: true },
      { re: '^address$', value: up(addr(h)), keepFilled: true },
      { re: '^doctor', value: up(h.doctor), keepFilled: true },
      { re: '^(phone|fax)', value: h.phone, keepFilled: true },
      { re: '^email', value: h.email, keepFilled: true },
      { re: '^nature of illness|illness', value: up(s.illness) },
      { re: 'patient.*name|name.*patient', value: up(s.patientName) },
      { re: 'patient.*passport|passport.*patient', value: up(s.patientPassport) },
      { re: 'patient.*visa|visa.*patient|application.*patient', value: up(s.patientApplicationId) || 'NA' },
      { re: 'relation', value: up(s.patientRelation) },
      { re: '^"*$|^""$', value: s.placesExtra || 'NA' },
    ].filter(r => r.value !== undefined && r.value !== '');
  }

})();
