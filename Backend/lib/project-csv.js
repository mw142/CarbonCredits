const { parse } = require('csv-parse/sync');

const REQUIRED_HEADERS = [
  'Project Name',
  'Project ID',
  'Project Proponent',
  'Method',
  'Method Type',
  'Project Description',
  'Date Project Registered',
  'Crediting period start date',
  'Crediting period end date',
  'Project location',
  'ACCUs Total units issued',
  'KACCUs Total units issued',
  'NKACCUs Total units issued',
  'Total Number of KACCUs units relinquished',
  'Total Number of NKACCUs units relinquished',
];

const FIELD = {
  proponent: 'Project Proponent',
  agent: 'Agent',
  involved: 'Significantly Involved Person(s), Description of involvement',
  name: 'Project Name',
  id: 'Project ID',
  method: 'Method',
  methodUrl: 'Method URL',
  methodType: 'Method Type',
  approach: 'Estimation or measurement approach or model',
  description: 'Project Description',
  activities: 'Project activities',
  suppressors: 'Project suppressors, if applicable',
  registered: 'Date Project Registered',
  creditingStart: 'Crediting period start date',
  creditingEnd: 'Crediting period end date',
  location: 'Project location',
  postcode: 'Project location (postcode)',
  area: 'Project Area(s), where the project is an area based offsets project',
  mapping: 'Project Mapping File URL',
  ceaMapping: 'Carbon Estimation Area mapping file URL',
  supplementary: 'Supplementary project information',
  modelStart: 'Model start date(s)',
  regionalPlan: 'If the area-based project is covered by a regional natural resource management plan, is it consistent with that plan?',
  jointImplementation: 'Joint Implementation project',
  maintenance: 'Is the project area or project areas subject to a Carbon Maintenance Obligation (CMO)?',
  approvals: 'Conditional upon all regulatory approvals being obtained',
  interests: 'Conditional upon the written consent of relevant interest holders',
  permanence: 'Nominated Permanence Period, if applicable',
  permanenceStart: 'Start date of permanence period, if applicable',
  permanenceEnd: 'Finish date of permanence period, if applicable',
  contractedOn: 'Contracted on',
  contractId: 'Contract ID',
  accus: 'ACCUs Total units issued',
  kaccus: 'KACCUs Total units issued',
  kaccuRecipient: 'Name of person/s to whom the KACCUs issued',
  kaccuRelinquished: 'Total Number of KACCUs units relinquished',
  nkaccus: 'NKACCUs Total units issued',
  nkaccuRecipient: 'Name of person/s to whom the NKACCUs issued',
  nkaccuRelinquished: 'Total Number of NKACCUs units relinquished',
  undertakingsUrl: 'Enforceable undertaking URLs related to this project',
  undertakings: 'Enforceable undertakings related to this project',
  notes: 'Notes',
  revoked: 'Project revoked',
};

function text(value) {
  const valueText = String(value ?? '').trim();
  return !valueText || /^n\/a$/i.test(valueText) ? null : valueText;
}

function integer(value, fieldName) {
  const valueText = text(value);
  if (valueText == null) return 0;
  const number = Number(valueText.replace(/,/g, ''));
  if (!Number.isInteger(number) || number < 0) throw new Error(`${fieldName} must be a non-negative whole number.`);
  return number;
}

function date(value) {
  const valueText = text(value);
  if (valueText == null) return null;
  const match = valueText.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) throw new Error(`Date "${valueText}" is not in d/m/YYYY format.`);
  const [, day, month, year] = match;
  const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (parsed.getUTCFullYear() !== Number(year) || parsed.getUTCMonth() !== Number(month) - 1 || parsed.getUTCDate() !== Number(day)) {
    throw new Error(`Date "${valueText}" is invalid.`);
  }
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function yesNo(value, fieldName) {
  const valueText = text(value);
  if (valueText == null) return 0;
  if (valueText === 'Yes') return 1;
  if (valueText === 'No') return 0;
  throw new Error(`${fieldName} must be Yes or No.`);
}

function urls(value) {
  return (text(value)?.match(/https?:\/\/[^\s,;]+/g) || []).map((url) => url.replace(/[.)]+$/, ''));
}

function mapRow(row, rowNumber) {
  const projectReference = text(row[FIELD.id]);
  const name = text(row[FIELD.name]);
  if (!projectReference || !name) throw new Error('Project ID and Project Name are required.');

  const projectRevoked = yesNo(row[FIELD.revoked], FIELD.revoked);
  const totalAccusIssued = integer(row[FIELD.accus], FIELD.accus);
  const kaccusIssued = integer(row[FIELD.kaccus], FIELD.kaccus);
  const nkaccusIssued = integer(row[FIELD.nkaccus], FIELD.nkaccus);
  const kaccusRelinquished = integer(row[FIELD.kaccuRelinquished], FIELD.kaccuRelinquished);
  const nkaccusRelinquished = integer(row[FIELD.nkaccuRelinquished], FIELD.nkaccuRelinquished);
  const totalRelinquished = kaccusRelinquished + nkaccusRelinquished;

  if (totalRelinquished > totalAccusIssued) throw new Error('Total relinquished ACCUs cannot exceed total issued ACCUs.');
  if (totalAccusIssued !== kaccusIssued + nkaccusIssued) throw new Error('ACCU total does not equal KACCU plus NKACCU totals.');

  const links = [
    ['method', urls(row[FIELD.methodUrl])],
    ['project_mapping', urls(row[FIELD.mapping])],
    ['carbon_estimation_area_mapping', urls(row[FIELD.ceaMapping])],
    ['enforceable_undertaking', urls(row[FIELD.undertakingsUrl])],
  ].flatMap(([linkType, values]) => values.map((url) => ({ link_type: linkType, url })));

  const issuances = [];
  for (const [key, value] of Object.entries(row)) {
    const match = key.match(/^(KACCUs|NKACCUs) Units Issued in Financial Year (\d{4}\/\d{2})$/);
    if (match) issuances.push({ unit_type: match[1].replace(/s$/, ''), financial_year: match[2], units_issued: integer(value, key) });
  }

  return {
    row_number: rowNumber,
    project: {
      project_reference: projectReference,
      project_type: text(row[FIELD.methodType]),
      name,
      project_proponent: text(row[FIELD.proponent]),
      description: text(row[FIELD.description]),
      methodology: text(row[FIELD.method]),
      project_status: projectRevoked ? 'revoked' : 'registered',
      project_registered_at: date(row[FIELD.registered]),
      crediting_period_start: date(row[FIELD.creditingStart]),
      crediting_period_end: date(row[FIELD.creditingEnd]),
      total_accus_issued: totalAccusIssued,
      total_accus_relinquished: totalRelinquished,
    },
    location: text(row[FIELD.location]) ? {
      location_name: text(row[FIELD.location]),
      state_or_territory: text(row[FIELD.location]),
      region: null,
      precision_level: 'state',
    } : null,
    details: {
      agent: text(row[FIELD.agent]),
      significantly_involved_persons: text(row[FIELD.involved]),
      method_url: text(row[FIELD.methodUrl]),
      method_type: text(row[FIELD.methodType]),
      estimation_approach: text(row[FIELD.approach]),
      project_activities: text(row[FIELD.activities]),
      project_suppressors: text(row[FIELD.suppressors]),
      location_postcode: text(row[FIELD.postcode]),
      project_area: text(row[FIELD.area]),
      supplementary_information: text(row[FIELD.supplementary]),
      model_start_dates: text(row[FIELD.modelStart]),
      regional_plan_consistency: text(row[FIELD.regionalPlan]),
      joint_implementation: text(row[FIELD.jointImplementation]),
      carbon_maintenance_obligation: text(row[FIELD.maintenance]),
      regulatory_approvals_condition: text(row[FIELD.approvals]),
      relevant_interest_holders_consent: text(row[FIELD.interests]),
      nominated_permanence_period: text(row[FIELD.permanence]),
      permanence_start_date: date(row[FIELD.permanenceStart]),
      permanence_end_date: date(row[FIELD.permanenceEnd]),
      contracted_on: text(row[FIELD.contractedOn]),
      contract_id: text(row[FIELD.contractId]),
      kaccu_recipient_name: text(row[FIELD.kaccuRecipient]),
      nkaccu_recipient_name: text(row[FIELD.nkaccuRecipient]),
      enforceable_undertakings: text(row[FIELD.undertakings]),
      notes: text(row[FIELD.notes]),
      project_revoked: projectRevoked,
    },
    unitTotals: [
      { unit_type: 'ACCU', total_units_issued: totalAccusIssued, total_units_relinquished: totalRelinquished, recipient_name: null },
      { unit_type: 'KACCU', total_units_issued: kaccusIssued, total_units_relinquished: kaccusRelinquished, recipient_name: text(row[FIELD.kaccuRecipient]) },
      { unit_type: 'NKACCU', total_units_issued: nkaccusIssued, total_units_relinquished: nkaccusRelinquished, recipient_name: text(row[FIELD.nkaccuRecipient]) },
    ],
    issuances,
    links,
  };
}

function parseProjectCsv(buffer) {
  let headers = [];
  const rows = parse(buffer, {
    bom: true,
    columns: (header) => { headers = header; return header; },
    skip_empty_lines: true,
    relax_column_count: false,
  });
  const missing = REQUIRED_HEADERS.filter((header) => !headers.includes(header));
  if (missing.length) throw new Error(`The CSV is missing required columns: ${missing.join(', ')}`);
  if (!rows.length) throw new Error('The CSV contains no project records.');

  const seen = new Set();
  const records = [];
  const errors = [];
  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    try {
      const mapped = mapRow(row, rowNumber);
      if (seen.has(mapped.project.project_reference)) throw new Error('Duplicate Project ID in the CSV.');
      seen.add(mapped.project.project_reference);
      records.push(mapped);
    } catch (error) {
      errors.push({ row_number: rowNumber, project_reference: text(row[FIELD.id]), error: error.message });
    }
  });
  return { records, errors, headers };
}

module.exports = { parseProjectCsv, REQUIRED_HEADERS };
