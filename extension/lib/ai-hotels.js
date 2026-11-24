// "Find hotels": asks the AI service for a few real hotels in a city, in the shape the Hotels list and
// the visa form need (name, address split for the form, state/district as the site lists them, phone).
// Claude searches the web live; OpenAI-compatible models answer from memory, so their results are flagged.
import { aiJson } from './ai-client.js';

const IVH = globalThis.IVH;
const str = description => ({ type: 'string', description });

const schema = () => ({
  type: 'object',
  additionalProperties: false,
  required: ['hotels'],
  properties: {
    hotels: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'address', 'state', 'district', 'pincode', 'phone', 'email', 'source'],
        properties: {
          name: str('Hotel name, uppercase'),
          address: str('Street address without the hotel name, city, state or PIN code, uppercase'),
          state: { type: 'string', enum: [...IVH.INDIA_STATES, ''] },
          district: str('District as named by the Government of India, uppercase (e.g. KOLKATA, DARJILING for Siliguri, CHENNAI, VELLORE, BANGALORE)'),
          pincode: str('6-digit PIN code, or ""'),
          phone: str('Hotel phone with +91 country code, or "" if not known for certain'),
          email: str('Hotel email, or ""'),
          source: str('Web page the details came from, or "" when answering from memory'),
        },
      },
    },
  },
});

const SYSTEM = `You help a Bangladeshi visa applicant choose a place of stay in India for an Indian visa form.
Suggest only real hotels that are operating now and are easy to verify (well-known, listed on booking sites or
their own website), mid-range and suitable for tourists or patients. Never invent a hotel, address or phone number:
leave a field "" when you are not certain of it. Use uppercase. The address must not repeat the hotel name, city,
state or PIN code. "state" must be one of the listed values; "district" is the government district name.`;

export async function findHotels(city, settings, count = 4) {
  const place = String(city || '').trim();
  if (!place) throw new Error('no-city');
  const webSearch = !['openai', 'helper'].includes(settings.aiProvider);
  const { data, searched } = await aiJson(settings, {
    system: SYSTEM,
    text: `City: ${place}, India. Suggest ${count} hotels there${webSearch ? ' — search the web and use the hotels\' own details' : ''}.`,
    schema: schema(),
    name: 'hotels',
    webSearch,
  });
  return (data.hotels || []).slice(0, count).map(h => toHotel(h, place, searched));
}

// District as the visa site lists it. Maps and AI give area names ("CENTRAL DELHI", "SOUTH WEST DELHI"); the site
// lists Delhi only as DELHI / NEW DELHI, and never adds the word "DISTRICT".
function siteDistrict(state, district) {
  const d = district.replace(/\s+(DISTRICT|DIST\.?)$/, '');
  if (state === 'DELHI') return /\bNEW DELHI\b/.test(d) ? 'NEW DELHI' : 'DELHI';
  return d;
}

// Form-ready hotel record: two address lines of at most 35 characters (city and PIN added at the end).
// Also used for the free hotel search (sidepanel.js).
export function toHotel(h, city, verified) {
  const up = s => String(s || '').replace(/\s+/g, ' ').trim().toUpperCase();
  const cityUp = up(city);
  const full = [up(h.address), cityUp && !up(h.address).includes(cityUp) ? cityUp : '', up(h.pincode)].filter(Boolean).join(', ');
  const [line1, ...rest] = IVH.splitLines(full, 35, 2);
  // The split can leave a comma at the end of line 1 or the start of line 2.
  const address1 = String(line1 || '').replace(/[,\s]+$/, '');
  const address2 = rest.join(' ').replace(/^[,\s]+/, '');
  const state = IVH.INDIA_STATES.includes(up(h.state)) ? up(h.state) : '';
  return {
    // The visa site's hotel name box takes letters and spaces only.
    name: up(h.name).replace(/[^A-Z ]+/g, ' ').replace(/\s+/g, ' ').trim(),
    address1,
    address2,
    state: state || 'WEST BENGAL',
    district: siteDistrict(state || 'WEST BENGAL', up(h.district) || cityUp),
    phone: String(h.phone || '').replace(/[^\d+]/g, ''),
    email: String(h.email || '').trim().toLowerCase(),
    aiSource: String(h.source || '').trim(),
    aiVerified: !!verified && !!h.source,
  };
}
