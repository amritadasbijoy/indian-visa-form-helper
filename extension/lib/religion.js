// Religion is not printed on Bangladesh passports (only in the BGD e-passport file). This suggests one from the
// names of the applicant, father, mother and spouse. It is only a suggestion: the profile marks it as guessed
// until the applicant confirms it, and it stays empty when the names do not point clearly to one religion.
// Names used by more than one community (SARKAR, BISWAS, MONDAL, CHOWDHURY, ROY, MAJUMDER …) are not listed.

// word → weight (2 = a clear sign, 1 = a hint)
const WORDS = {
  ISLAM: {
    2: 'MD MOHAMMAD MOHAMMED MOHAMMOD MUHAMMAD MUHAMMED MOHD ABDUL ABDUR ABU UDDIN UDDIN ULLAH HOSSAIN HOSSEN HOSEN HUSSAIN HUSAIN RAHMAN RAHIM KARIM HAQUE HAQ HOQUE ISLAM ALAM AHMED AHMAD MAHMUD MAHMUDUL BEGUM KHATUN KHATOON AKTER AKTAR AKHTER AKTHER NESSA NESA NESSA BIBI SULTANA PARVIN PARVEEN NAHAR FATEMA FATIMA AYESHA AYSHA JANNAT MOLLA MOLLAH MIAH MIA SYED SAYED KAZI QAZI BHUIYAN BHUIYA NOOR NUR SHEIKH SK RASHID HASAN HASSAN HABIB IQBAL KABIR JAHAN JAHANARA SHAHANA SHIRIN RUKSANA YASMIN TASLIMA NASRIN',
    1: 'ALI KHAN',
  },
  HINDU: {
    2: 'CHANDRA KUMAR BALA DEVI DAS DEY DEB DUTTA DATTA GHOSH BOSE BASU SAHA NATH DEBNATH CHAKRABORTY CHAKRABARTY CHAKRABORTI CHOKROBORTY BHATTACHARJEE BHATTACHARYA BHATTACHARJYA BANERJEE MUKHERJEE CHATTERJEE GANGULY SEN SENGUPTA GUPTA MALAKAR KARMAKAR SUTRADHAR SHIL SHEEL PODDER PODDAR BANIK ACHARJEE ACHARYA GOSWAMI DHAR PRASAD PROSAD SHARMA MITRA KUNDU NANDI GOPE BHOWMIK BHOUMIK',
    1: 'RANI PAL HALDER HALDAR LAL KRISHNA GOPAL',
  },
  BUDDHISM: {
    2: 'BARUA BARUAH CHAKMA MARMA TANCHANGYA MUTSUDDI MUTSUDDY BHIKKHU',
    1: '',
  },
  CHRISTIAN: {
    2: 'GOMES GOMEZ ROZARIO ROSARIO COSTA DCOSTA CORRAYA COREYA CORRAIA GONSALVES GONSALVEZ PEREIRA PERERA PALMA CRUZ DCRUZ RIBEIRO JOSEPH FRANCIS ANTHONY MICHAEL PETER JOHN STEPHEN PHILIP',
    1: 'PAUL MARY MARIA DAVID THOMAS SIMON SANGMA MRONG CHISIM RICHIL',
  },
};

const TABLE = new Map();
for (const [religion, byWeight] of Object.entries(WORDS)) {
  for (const [w, list] of Object.entries(byWeight)) for (const word of list.split(/\s+/).filter(Boolean)) TABLE.set(word, [religion, +w]);
}

// "MD. ABDUL", "D'COSTA" → MD, ABDUL, DCOSTA
const words = s => String(s || '').toUpperCase().replace(/['’.]/g, '').split(/[^A-Z]+/).filter(Boolean);

// Returns 'ISLAM' | 'HINDU' | 'BUDDHISM' | 'CHRISTIAN' (the visa site's values), or '' when unsure.
export function guessReligion(p = {}) {
  const score = { ISLAM: 0, HINDU: 0, BUDDHISM: 0, CHRISTIAN: 0 };
  const names = [[p.surname, p.givenName].join(' '), p.fatherName, p.motherName, p.spouseName];
  for (const name of names) {
    // Each person counts once per religion (their strongest word), so one long name cannot outvote the family.
    const best = {};
    for (const w of words(name)) {
      const hit = TABLE.get(w);
      if (hit) best[hit[0]] = Math.max(best[hit[0]] || 0, hit[1]);
    }
    for (const [r, v] of Object.entries(best)) score[r] += v;
  }
  const [[top, a], [, b]] = Object.entries(score).sort((x, y) => y[1] - x[1]);
  return a >= 2 && a >= 2 * b ? top : '';
}
