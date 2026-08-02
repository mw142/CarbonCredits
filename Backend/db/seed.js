// Populates the local SQLite database with a demo admin account, a couple
// of sellers with verified listings, and a demo buyer — so the marketplace
// isn't empty the first time the app is run. Safe to re-run: it checks for
// existing rows before inserting anything.
const bcrypt = require('bcryptjs');
const { db } = require('./index');

function hash(pw) {
  return bcrypt.hashSync(pw, 10);
}

function userExists(email) {
  return db.prepare('SELECT id FROM users WHERE email = ?').get(email);
}

function insertUser({ role, name, email, password, phone_number, organisation_name, organisation_type, country }) {
  const existing = userExists(email);
  if (existing) return existing.id;
  const info = db
    .prepare(
      `INSERT INTO users (role, name, email, password_hash, phone_number, organisation_name, organisation_type, country, account_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')`
    )
    .run(role, name, email, hash(password), phone_number || null, organisation_name || null, organisation_type || null, country);
  return Number(info.lastInsertRowid);
}

function seed() {
  console.log('Seeding demo data (idempotent)...');

  const adminId = insertUser({
    role: 'admin',
    name: 'Alex Reviewer',
    email: 'admin@carboncredit.local',
    password: 'Admin123!',
    country: 'Australia',
  });

  const seller1Id = insertUser({
    role: 'seller',
    name: 'Mia Chen',
    email: 'seller1@carboncredit.local',
    password: 'Seller123!',
    organisation_name: 'Southern Cross Reforestation Co-op',
    organisation_type: 'co-operative',
    country: 'Australia',
  });

  const seller2Id = insertUser({
    role: 'seller',
    name: 'Tom Whitfield',
    email: 'seller2@carboncredit.local',
    password: 'Seller123!',
    organisation_name: 'Outback Soil Carbon Pty Ltd',
    organisation_type: 'project developer',
    country: 'Australia',
  });

  const buyerId = insertUser({
    role: 'buyer',
    name: 'Jordan Blake',
    email: 'buyer1@carboncredit.local',
    password: 'Buyer123!',
    organisation_name: 'Northbridge Logistics',
    organisation_type: 'business',
    country: 'Australia',
  });

  if (!db.prepare('SELECT user_id FROM buyer_profiles WHERE user_id = ?').get(buyerId)) {
    db.prepare(
      `INSERT INTO buyer_profiles (user_id, total_emissions, annual_offset_goal, carbon_credit_balance)
       VALUES (?, ?, ?, ?)`
    ).run(buyerId, 1250, 500, 0);
  }

  const projectCount = db.prepare('SELECT COUNT(*) AS n FROM projects').get().n;
  if (projectCount === 0) {
    const insertProject = db.prepare(`
      INSERT INTO projects
        (seller_id, name, location, project_type, image_url, description, methodology,
         estimated_emission_reductions, accu_category, vintage, price_per_credit,
         total_credits, available_credits, review_status, is_verified, is_listed, review_notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved', 1, 1, 'Meets ACCU evidence requirements.')
    `);

    const p1 = insertProject.run(
      seller1Id,
      'Murray Basin Reforestation Project',
      'Riverina, New South Wales',
      'reforestation',
      null,
      'Large-scale native reforestation across former grazing land in the Riverina, restoring biodiversity corridors while sequestering carbon over a 25-year crediting period.',
      'Environmental Plantings — Human-Induced Regeneration',
      18500,
      'KACCU',
      '2025',
      24.5,
      6000,
      4200
    );

    const p2 = insertProject.run(
      seller2Id,
      'Flinders Rangeland Soil Carbon Project',
      'Flinders Ranges, South Australia',
      'soil carbon',
      null,
      'Regenerative grazing management across 12,000 hectares of semi-arid rangeland, increasing soil organic carbon while maintaining pastoral productivity.',
      'Estimating Soil Organic Carbon Sequestration using Measurement',
      9800,
      'NKACCU',
      '2024',
      19.9,
      3200,
      1450
    );

    const p3 = insertProject.run(
      seller1Id,
      'Coastal Blue Carbon Wetland Restoration',
      'Shoalhaven, New South Wales',
      'blue carbon',
      null,
      'Tidal reconnection and mangrove/saltmarsh restoration along a degraded coastal wetland, rebuilding a high-density blue carbon sink and fish habitat.',
      'Blue Carbon — Tidal Restoration of Blue Carbon Ecosystems',
      5200,
      'KACCU',
      '2025',
      31.0,
      1800,
      1800
    );

    // A pending, not-yet-verified submission so the admin verification
    // queue and seller "unverified" state both have something to show.
    db.prepare(`
      INSERT INTO projects
        (seller_id, name, location, project_type, image_url, description, methodology,
         estimated_emission_reductions, accu_category, vintage, price_per_credit,
         total_credits, available_credits, review_status, is_verified, is_listed)
      VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, 'waiting_review', 0, 0)
    `).run(
      seller2Id,
      'Wheatbelt Methane Capture Facility',
      'Wheatbelt, Western Australia',
      'methane capture',
      'Piggery effluent methane capture and flaring/power generation facility reducing fugitive emissions from waste ponds.',
      'Destruction of Methane from Piggeries',
      7300,
      'NKACCU',
      '2026',
      21.0,
      2600,
      2600
    );

    [
      { id: p1.lastInsertRowid, type: 'ownership_evidence', name: 'landholder_title_extract.pdf' },
      { id: p1.lastInsertRowid, type: 'accu_certificate', name: 'accu_certificate_2025.pdf' },
      { id: p2.lastInsertRowid, type: 'registry_export', name: 'anreu_holdings_export.pdf' },
      { id: p3.lastInsertRowid, type: 'accu_certificate', name: 'blue_carbon_verification_report.pdf' },
    ].forEach((doc) => {
      db.prepare(
        `INSERT INTO project_documents (project_id, uploaded_by_user_id, document_type, file_name) VALUES (?, ?, ?, ?)`
      ).run(doc.id, seller1Id, doc.type, doc.name);
    });

    [p1, p2, p3].forEach((res) => {
      db.prepare(
        `INSERT INTO verification_audit_log (project_id, verifier_user_id, action, notes) VALUES (?, ?, 'submitted', 'Initial submission')`
      ).run(res.lastInsertRowid, seller1Id);
      db.prepare(
        `INSERT INTO verification_audit_log (project_id, verifier_user_id, action, notes) VALUES (?, ?, 'approved', 'Evidence verified against ACCU requirements')`
      ).run(res.lastInsertRowid, adminId);
    });

    // A sample purchase so the buyer dashboard has activity to show.
    db.prepare(
      `INSERT INTO purchases (buyer_id, project_id, credits_purchased, price_per_credit, total_price) VALUES (?, ?, ?, ?, ?)`
    ).run(buyerId, p1.lastInsertRowid, 150, 24.5, 150 * 24.5);
    db.prepare(`UPDATE buyer_profiles SET carbon_credit_balance = carbon_credit_balance + 150 WHERE user_id = ?`).run(buyerId);

    db.prepare(
      `INSERT INTO saved_projects (buyer_id, project_id) VALUES (?, ?)`
    ).run(buyerId, p3.lastInsertRowid);
  }

  console.log('Seed complete.');
  console.log('Demo accounts:');
  console.log('  Admin  -> admin@carboncredit.local   / Admin123!');
  console.log('  Seller -> seller1@carboncredit.local / Seller123!');
  console.log('  Seller -> seller2@carboncredit.local / Seller123!');
  console.log('  Buyer  -> buyer1@carboncredit.local  / Buyer123!');
}

seed();
