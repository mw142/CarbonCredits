const TABLES = {
  buyer: 'user_buyer',
  seller: 'user_seller',
  admin: 'user_admin',
};

function tableForRole(role) {
  const table = TABLES[role];
  if (!table) throw new Error(`Unknown role: ${role}`);
  return table;
}

function publicUser(row, role) {
  return {
    id: row.id,
    role,
    name: row.name,
    email: row.email,
    phone_number: row.phone_number ?? null,
    organisation_name: row.organisation_name ?? null,
    organisation_type: row.organisation_type ?? null,
    country: row.country,
    account_status: row.account_status,
    created_at: row.created_at,
  };
}

module.exports = { TABLES, tableForRole, publicUser };
