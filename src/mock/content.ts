// Demo content for the seeded requirement library: forms, courses and policies.
import type { FormField, FormSchema, PolicyContent, TrainingContent } from '@/lib/types';

export const HINTS = {
  COI: 'General liability, minimum $2M per occurrence. Riverside Energy must be named as additional insured.',
  WC: "Current workers' compensation certificate covering everyone you'll bring on site.",
  SAFEPROG: 'Your written health and safety program or manual, as a PDF.',
  FORKLIFT: 'Operator card or certificate showing the class of lift truck and the expiry date.',
  CRANE: 'Operator certification (for example NCCCO) for the crane type, showing the expiry date.',
  SPILL: 'Site-specific spill response plan, including spill kit locations and reporting contacts.',
  LICENSE: 'Current business or trade licence for the state you work in.',
};

export const PREQ_FORM: FormSchema = {
  sections: [
    {
      id: 'company',
      title: 'Company details',
      fields: [
        { id: 'years_in_business', label: 'Years in business', type: 'number', required: true },
        { id: 'employees', label: 'Number of employees', type: 'number', required: true },
        { id: 'safety_contact', label: 'Safety contact name', type: 'text', required: true },
        { id: 'safety_contact_phone', label: 'Safety contact phone', type: 'text' },
      ],
    },
    {
      id: 'performance',
      title: 'Safety performance',
      fields: [
        {
          id: 'emr',
          label: 'EMR and incident rates for the last 3 years',
          type: 'table',
          required: true,
          min_rows: 3,
          help: 'Experience modification rate (EMR), total recordable incident rate (TRIR) and DART rate, one row per year.',
          columns: [
            { id: 'year', label: 'Year', type: 'text' },
            { id: 'emr', label: 'EMR', type: 'number' },
            { id: 'trir', label: 'TRIR', type: 'number' },
            { id: 'dart', label: 'DART', type: 'number' },
          ],
        },
        { id: 'fatalities', label: 'Work-related fatalities in the last 3 years', type: 'number', required: true },
        { id: 'citations', label: 'Any OSHA citations in the last 3 years?', type: 'yesno', required: true },
        { id: 'citations_detail', label: 'If yes, describe the citations and what you changed', type: 'textarea' },
      ],
    },
    {
      id: 'programs',
      title: 'Safety programs',
      fields: [
        { id: 'written_program', label: 'Do you have a written safety program?', type: 'yesno', required: true },
        { id: 'drug_testing', label: 'Do you run a drug and alcohol testing program?', type: 'yesno', required: true },
        {
          id: 'training_records',
          label: 'How do you keep training records?',
          type: 'select',
          required: true,
          options: ['Digital training system', 'Paper records', 'No formal records'],
        },
        {
          id: 'incidents',
          label: 'Recordable incidents in the last 12 months',
          type: 'table',
          help: 'Leave empty if there were none.',
          columns: [
            { id: 'date', label: 'Date', type: 'date' },
            { id: 'what', label: 'What happened', type: 'text' },
            { id: 'action', label: 'Corrective action', type: 'text' },
          ],
        },
      ],
    },
    {
      id: 'declaration',
      title: 'Declaration',
      fields: [
        { id: 'declare', label: 'I confirm the information above is accurate and complete.', type: 'checkbox', required: true },
      ],
    },
  ],
};

export const QSA_FORM: FormSchema = {
  sections: [
    {
      id: 'quarter',
      title: 'This quarter',
      fields: [
        { id: 'quarter', label: 'Quarter', type: 'select', required: true, options: ['Q1', 'Q2', 'Q3', 'Q4'] },
        { id: 'hours', label: 'Hours worked on Riverside Energy sites', type: 'number', required: true },
        { id: 'recordables', label: 'Recordable injuries', type: 'number', required: true },
        { id: 'near_misses', label: 'Near misses reported', type: 'number', required: true },
        { id: 'toolbox', label: 'Toolbox talks held', type: 'number' },
        { id: 'improvements', label: 'Safety improvements made this quarter', type: 'textarea' },
      ],
    },
  ],
};

export const ORIENTATION: TrainingContent = {
  duration_min: 20,
  pass_mark: 75,
  slides: [
    {
      id: 's1',
      title: 'Everyone can stop work',
      body: "Every person on a Riverside Energy site has stop-work authority. If something looks unsafe, stop and tell your supervisor or the site EHS team. You won't be penalised for stopping work in good faith.",
    },
    {
      id: 's2',
      title: 'Report every hazard and near miss',
      body: 'Report hazards, near misses and injuries the same shift, using the EZForm app or a paper card at the gatehouse. Near-miss reports are how we prevent the next injury.',
    },
    {
      id: 's3',
      title: 'Minimum PPE past the gate',
      body: 'Hard hat, safety glasses, high-visibility vest, safety-toe boots and gloves suited to the task. Task-specific PPE such as hearing protection, face shields and harnesses is listed on your permit.',
    },
    {
      id: 's4',
      title: 'Permits and isolation',
      body: "Hot work, confined space entry, work at height, excavation and electrical work need a permit to work. Never work on equipment that hasn't been isolated, locked and tagged by an authorised person.",
    },
    {
      id: 's5',
      title: 'In an emergency',
      body: 'A continuous siren means evacuate to your muster point. Know the nearest muster point before you start work, and report to your supervisor so everyone can be counted.',
    },
  ],
  quiz: [
    { id: 'q1', prompt: 'Who has the authority to stop unsafe work?', options: ['Only site supervisors', 'Only the EHS team', 'Everyone on site', 'Only Riverside employees'], answer: 2 },
    { id: 'q2', prompt: 'When should a near miss be reported?', options: ['The same shift', 'At the end of the week', 'Only if someone was hurt', 'Never'], answer: 0 },
    { id: 'q3', prompt: 'Which of these always needs a permit to work?', options: ['Sweeping a walkway', 'Hot work such as welding', 'Walking to the canteen', 'Using a hand truck'], answer: 1 },
    { id: 'q4', prompt: 'A continuous siren means…', options: ['Lunch break', 'An alarm test, so keep working', 'Evacuate to your muster point', 'Shift change'], answer: 2 },
  ],
};

export const HEIGHTS: TrainingContent = {
  duration_min: 45,
  pass_mark: 80,
  slides: [
    { id: 's1', title: 'When fall protection is required', body: 'Fall protection is required whenever you could fall 1.8 m (6 ft) or more, at any unprotected edge, and near any opening you could fall through.' },
    { id: 's2', title: 'Hierarchy of control', body: "First avoid working at height. If you can't, use collective protection such as guardrails and scaffolds. Personal fall arrest is the last line of defence." },
    { id: 's3', title: 'Inspect your harness', body: 'Before every use, check webbing for cuts and burns, stitching for pulled threads, and hardware for cracks or distortion. Remove any harness that has arrested a fall.' },
    { id: 's4', title: 'Have a rescue plan', body: 'Suspension trauma can start within minutes. A written rescue plan must be in place before anyone works in a harness.' },
  ],
  quiz: [
    { id: 'q1', prompt: 'At what fall height is fall protection required?', options: ['1.8 m (6 ft)', '3 m (10 ft)', 'Only above 5 m', 'Only on roofs'], answer: 0 },
    { id: 'q2', prompt: 'Which control should you consider first?', options: ['A harness', 'Avoiding work at height', 'A ladder', 'A hard hat'], answer: 1 },
    { id: 'q3', prompt: 'A harness has arrested a fall. What now?', options: ['Keep using it', 'Wash it', 'Remove it from service', 'Lend it to a colleague'], answer: 2 },
  ],
};

export const CONFINED: TrainingContent = {
  duration_min: 30,
  pass_mark: 80,
  slides: [
    { id: 's1', title: 'What counts as a confined space', body: 'Large enough to enter, limited ways in or out, and not designed for continuous occupancy: tanks, vessels, pits, silos and some trenches.' },
    { id: 's2', title: 'Atmospheric hazards', body: "Oxygen deficiency, toxic gases and flammable atmospheres can't be seen or reliably smelled. The atmosphere is tested before entry and monitored throughout." },
    { id: 's3', title: 'Entry permit and attendant', body: 'No one enters without a signed entry permit and a trained attendant outside, who never goes in to attempt a rescue.' },
    { id: 's4', title: 'Rescue', body: 'Most confined space deaths are would-be rescuers. Rescue is done by the trained rescue team with retrieval equipment.' },
  ],
  quiz: [
    { id: 'q1', prompt: 'Who may go in to rescue a collapsed entrant?', options: ['The attendant', 'Anyone nearby', 'Only the trained rescue team', 'The supervisor'], answer: 2 },
    { id: 'q2', prompt: 'When is the atmosphere tested?', options: ['After entry', 'Before entry and throughout the work', 'Once a week', 'Only if it smells'], answer: 1 },
    { id: 'q3', prompt: 'What is required before entry?', options: ['A verbal OK', 'A signed entry permit', 'Nothing if under 10 minutes', 'A photo of the space'], answer: 1 },
  ],
};

export const HARBOR: TrainingContent = {
  duration_min: 15,
  pass_mark: 66,
  slides: [
    { id: 's1', title: 'Pier 4 access', body: 'All access is through Gate H2. Badge in every day. The gate checks your compliance status automatically.' },
    { id: 's2', title: 'Vessel movements and exclusion zones', body: 'Stay outside the yellow exclusion zones during mooring and crane operations. Listen for the three-blast horn signal.' },
    { id: 's3', title: 'Marine emergencies', body: 'Life rings are every 30 m along the quay. If someone is in the water: shout, throw a ring, call 555-0199. Never jump in.' },
  ],
  quiz: [
    { id: 'q1', prompt: 'Where do you enter the Harbor Terminal?', options: ['Any gate', 'Gate H2', 'Through the vessel', 'Gate A1'], answer: 1 },
    { id: 'q2', prompt: 'Someone falls in the water. You should…', options: ['Jump in', 'Shout, throw a ring, call 555-0199', 'Wait for the end of the shift', 'Call their employer'], answer: 1 },
    { id: 'q3', prompt: 'During crane operations you must…', options: ['Stand under the load', 'Stay outside the yellow exclusion zone', 'Guide the load by hand', 'Take photos'], answer: 1 },
  ],
};

export const NFPA: TrainingContent = {
  duration_min: 60,
  pass_mark: 80,
  slides: [
    { id: 's1', title: 'The arc flash boundary', body: 'The arc flash boundary is where incident energy reaches 1.2 cal/cm². Anyone inside it needs arc-rated PPE.' },
    { id: 's2', title: 'Make it electrically safe', body: 'Identify every source, disconnect, lock and tag, test for absence of voltage with a verified tester, then ground if required.' },
    { id: 's3', title: 'PPE categories', body: 'PPE categories 1 to 4 set minimum arc ratings from 4 to 40 cal/cm². The category comes from the equipment label or the task table.' },
  ],
  quiz: [
    { id: 'q1', prompt: 'Arc-rated PPE is required inside…', options: ['The limited approach boundary only', 'The arc flash boundary', 'The building', 'The substation fence'], answer: 1 },
    { id: 'q2', prompt: 'Before touching conductors you must…', options: ['Test for absence of voltage', 'Wear gloves only', 'Ask a colleague', 'Switch off the lights'], answer: 0 },
    { id: 'q3', prompt: 'PPE category 2 needs a minimum arc rating of…', options: ['4 cal/cm²', '8 cal/cm²', '25 cal/cm²', '40 cal/cm²'], answer: 1 },
  ],
};

export const SITE_RULES: PolicyContent = {
  confirm_text: 'I have read and understood the Site Safety Rules and will make sure everyone in my crew follows them.',
  body: `Riverside Energy — Site Safety Rules (rev. 2026)

These rules apply to every contractor, subcontractor and visitor on Riverside Energy sites. Breaking them can mean removal from site.

1. Badge in at the gate every day. The gate checks that you and your company are compliant.
2. Complete the site induction before starting work. Carry your badge at all times.
3. Wear the minimum PPE past the gate: hard hat, safety glasses, high-visibility vest, safety-toe boots and task-appropriate gloves.
4. Work under a valid permit to work wherever one is required: hot work, confined space, work at height, excavation, electrical and line breaking.
5. Never remove, bypass or defeat a guard, interlock, lock or tag.
6. Report every injury, near miss, spill and hazard the same shift.
7. Keep walkways, exits and fire equipment clear. Clean up as you go.
8. No smoking or vaping outside designated areas. No open flames without a hot work permit.
9. Don't use a mobile phone while operating equipment or walking through process areas.
10. The speed limit on site roads is 15 km/h. Pedestrians have right of way on marked walkways.
11. Alcohol, cannabis and illegal drugs are prohibited. See the Drug & Alcohol Policy.
12. Everyone has stop-work authority. Use it.`,
};

export const DRUG_POLICY: PolicyContent = {
  confirm_text: 'I accept this policy on behalf of my company and confirm we run a testing program that meets it.',
  body: `Riverside Energy — Drug & Alcohol Policy

No one may work on a Riverside Energy site while impaired by alcohol, cannabis, illegal drugs or misused prescription medication.

• Contractors must run their own testing program covering pre-access, post-incident and reasonable-cause testing.
• Riverside Energy may require a test after any incident, or any near miss with serious potential.
• Anyone who refuses a test or tests positive is removed from site immediately.
• Tell your supervisor about any prescription medication that could affect your ability to work safely.

Breaches can cost a company its approved-contractor status.`,
};

/** The same policy, course or hint worded for another company's program. */
export function rebrand<T>(content: T, name: string): T {
  return JSON.parse(JSON.stringify(content).replace(/Riverside Energy/g, name).replace(/Riverside employees/g, `${name} employees`)) as T;
}

export const WELD_CERT_HINT = 'Welder qualification record (for example AWS D1.1 or ASME IX) for the processes and positions the welder will use, showing the continuity date.';

export const HOT_WORK: TrainingContent = {
  duration_min: 15,
  pass_mark: 75,
  slides: [
    {
      id: 's1',
      title: 'Hot work needs a permit, every time',
      body: 'Welding, cutting, grinding and brazing all need a hot work permit signed before the first spark. The permit names the area, the fire watch and the time it ends.',
    },
    {
      id: 's2',
      title: 'Clear 11 metres around the work',
      body: 'Move combustibles at least 11 metres away, or cover them with fire-resistant blankets. Seal floor and wall openings that sparks could fall through.',
    },
    {
      id: 's3',
      title: 'Fire watch during and after',
      body: 'A trained fire watch with an extinguisher stays for the whole job and for at least 60 minutes after the hot work ends, then does a final check of the area.',
    },
  ],
  quiz: [
    { id: 'q1', prompt: 'When is a hot work permit needed?', options: ['Only for welding', 'Welding, cutting, grinding and brazing', 'Only indoors', 'Only on weekends'], answer: 1 },
    { id: 'q2', prompt: 'How far should combustibles be moved from hot work?', options: ['1 metre', '3 metres', '11 metres', 'They can stay'], answer: 2 },
    { id: 'q3', prompt: 'How long does the fire watch stay after the work ends?', options: ['No time', '10 minutes', 'At least 60 minutes', 'Until lunch'], answer: 2 },
  ],
};

// ---------------------------------------------------------------------------
// Sample answers for seeded form submissions
// ---------------------------------------------------------------------------

type Sampler = (rnd: () => number, contact: string, employees: number) => unknown;

const year = new Date().getFullYear();

const SAMPLE: Record<string, Sampler> = {
  years_in_business: (r) => String(6 + Math.floor(r() * 25)),
  employees: (_r, _c, n) => String(n),
  safety_contact: (_r, c) => c,
  safety_contact_phone: (r) => `(555) 01${10 + Math.floor(r() * 89)}-${1000 + Math.floor(r() * 8999)}`,
  emr: (r) =>
    [3, 2, 1].map((back) => ({
      year: String(year - back),
      emr: (0.72 + r() * 0.25).toFixed(2),
      trir: (0.8 + r() * 1.6).toFixed(1),
      dart: (0.3 + r() * 0.9).toFixed(1),
    })),
  fatalities: () => '0',
  citations: (r) => (r() > 0.85 ? 'Yes' : 'No'),
  citations_detail: () => '',
  written_program: () => 'Yes',
  drug_testing: () => 'Yes',
  training_records: (r) => (r() > 0.3 ? 'Digital training system' : 'Paper records'),
  incidents: (r) =>
    r() > 0.5
      ? [{ date: `${year}-03-14`, what: 'Laceration to hand while handling sheet metal', action: 'Cut-resistant gloves made mandatory for the task' }]
      : [],
  declare: () => true,
  quarter: () => `Q${Math.floor(new Date().getMonth() / 3) + 1}`,
  hours: (r) => String(1200 + Math.floor(r() * 3000)),
  recordables: () => '0',
  near_misses: (r) => String(1 + Math.floor(r() * 6)),
  toolbox: (r) => String(8 + Math.floor(r() * 10)),
  improvements: () => 'Added a second spotter for reversing vehicles and replaced worn harness lanyards.',
};

function generic(f: FormField): unknown {
  switch (f.type) {
    case 'checkbox':
      return true;
    case 'yesno':
      return 'Yes';
    case 'number':
      return '1';
    case 'select':
      return f.options?.[0] ?? '';
    case 'table':
      return [];
    default:
      return 'See attached';
  }
}

export function sampleAnswers(schema: FormSchema, contact: string, rnd: () => number, employees = 12): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const section of schema.sections) {
    for (const field of section.fields) {
      const sampler = SAMPLE[field.id];
      out[field.id] = sampler ? sampler(rnd, contact, employees) : generic(field);
    }
  }
  return out;
}
