// Made-up names only. Run: node tools/test-religion.mjs
import { guessReligion } from '../extension/lib/religion.js';
const cases = [
  [{ surname: 'DAS', givenName: 'RINA', fatherName: 'SUBHASH CHANDRA DAS', motherName: 'GITA RANI DAS' }, 'HINDU'],
  [{ surname: 'RAHMAN', givenName: 'MD. KARIM', fatherName: 'ABDUL HAQUE', motherName: 'MST. RAHIMA KHATUN' }, 'ISLAM'],
  [{ surname: 'AKTER', givenName: 'NASRIN', fatherName: 'MD. ALI', motherName: 'FATEMA BEGUM', spouseName: 'MD. JAMAL UDDIN' }, 'ISLAM'],
  [{ surname: 'BARUA', givenName: 'SUMON', fatherName: 'RATAN BARUA', motherName: 'SHILPI BARUA' }, 'BUDDHISM'],
  [{ surname: 'CHAKMA', givenName: 'JOYA', fatherName: 'BIMAL CHAKMA', motherName: 'MALA CHAKMA' }, 'BUDDHISM'],
  [{ surname: 'GOMES', givenName: 'PETER', fatherName: 'JOHN GOMES', motherName: "MARY D'COSTA" }, 'CHRISTIAN'],
  [{ surname: 'ROZARIO', givenName: 'ANNA', fatherName: 'FRANCIS ROZARIO', motherName: 'RITA CORRAYA' }, 'CHRISTIAN'],
  // shared surnames only → unsure
  [{ surname: 'SARKAR', givenName: 'RONY', fatherName: 'TAPAN SARKAR', motherName: 'MITA SARKAR' }, ''],
  [{ surname: 'BISWAS', givenName: 'SUMI', fatherName: 'ROBIN BISWAS', motherName: 'LIPI BISWAS' }, ''],
  // mixed signals → unsure
  [{ surname: 'ROY', givenName: 'RANI', fatherName: 'MD. ALI', motherName: 'GITA RANI' }, ''],
  [{ surname: 'SARKAR', givenName: 'TAPOSH KUMAR', fatherName: 'NIKHIL CHANDRA SARKAR', motherName: 'ANJALI RANI SARKAR' }, 'HINDU'],
  [{ surname: 'KHAN', givenName: 'RAFI', fatherName: 'MOHAMMAD HASAN KHAN', motherName: 'SHIRIN AKTER' }, 'ISLAM'],
  [{}, ''],
];
let bad = 0;
for (const [p, want] of cases) {
  const got = guessReligion(p);
  if (got !== want) { bad++; console.log('FAIL', JSON.stringify(p), 'want', want || '(blank)', 'got', got || '(blank)'); }
}
console.log(`${cases.length - bad}/${cases.length} ok`);
process.exit(bad ? 1 : 0);
