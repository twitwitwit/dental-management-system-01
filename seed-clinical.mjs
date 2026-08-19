// One-off seed: demo tooth conditions (status + plan layers) and periodontal
// probing records for demo patients so the dental & perio charts look alive.
import "dotenv/config";
import mysql from "mysql2/promise";

const url = process.env.DATABASE_URL;
const conn = await mysql.createConnection(url);

function cond(patientId, toothNumber, condition, mode, note) {
  return conn.execute(
    `INSERT INTO toothConditions (patientId, toothNumber, condition, mode, note)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE condition = VALUES(condition), note = VALUES(note)`,
    [patientId, toothNumber, condition, mode, note],
  );
}

function perio(patientId, toothNumber, pd, recession, mobility, bleeding, plaque) {
  return conn.execute(
    `INSERT INTO periodontalStatus (patientId, toothNumber, pd1, pd2, pd3, pd4, pd5, pd6, recession, mobility, bleeding, plaque)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE pd1=VALUES(pd1), pd2=VALUES(pd2), pd3=VALUES(pd3), pd4=VALUES(pd4), pd5=VALUES(pd5), pd6=VALUES(pd6),
       recession=VALUES(recession), mobility=VALUES(mobility), bleeding=VALUES(bleeding), plaque=VALUES(plaque)`,
    [patientId, toothNumber, ...pd, recession, mobility, bleeding ? 1 : 0, plaque ? 1 : 0],
  );
}

// Patient 1 (James Wilson): mostly healthy; a couple of fillings, crown on 36,
// plan-layer items: 26 planned filling, 46 planned crown.
await cond(1, "16", "filling", "status", "Composite on occlusal");
await cond(1, "24", "decay", "status", "Incipient occlusal decay");
await cond(1, "36", "crown", "status", "Zirconia crown, worn");
await cond(1, "26", "filling", "plan", "Planned class II composite");
await cond(1, "46", "crown", "plan", "Planned PFM crown after endo");
await cond(1, "37", "root_canal", "plan", "Planned RCT tooth 37");

// Patient 2 (Maria Santos): mixed restorative history + wisdom extraction plan
await cond(2, "14", "filling", "status", "Resin filling");
await cond(2, "25", "extraction", "plan", "Planned extraction of 25");
await cond(2, "36", "decay", "status", "Deep occlusal decay");
await cond(2, "47", "missing", "status", "Extracted 2019");
await cond(2, "18", "extraction", "plan", "Wisdom extraction upper right");
await cond(2, "28", "extraction", "plan", "Wisdom extraction upper left");
await cond(2, "12", "veneers", "plan", "Planned porcelain veneers 11-13");

// Patient 3 (Robert Kim): implant + bridge history
await cond(3, "26", "implant", "status", "Titanium implant crown");
await cond(3, "14", "bridge", "status", "3-unit bridge 13-14-15");
await cond(3, "35", "filling", "status", "MO composite");
await cond(3, "45", "decay", "plan", "Monitor distal decay");

// Patient 4 (Emily Chen): perio-focused demo patient with mild periodontitis
await cond(4, "16", "filling", "status", "O composite");
await cond(4, "26", "decay", "status", "Occlusal caries");
await cond(4, "36", "root_canal", "status", "RCT completed");
await cond(4, "46", "crown", "status", "Crown over RCT");

// Periodontal records: healthy ~1-2mm pockets; perio patient 4 has deeper pockets
// in lower molars (pd 5-7, mobility, bleeding).
async function seedPerio(patientId, teeth, basePd) {
  for (const t of teeth) {
    const vary = () => +(basePd + (Math.random() * 0.8 - 0.4)).toFixed(1);
    await perio(patientId, t, [vary(), vary(), vary(), vary(), vary(), vary()], "0.0", "0", true, false);
  }
}
const allExceptWisdom = [];
for (const q of [1, 2, 3, 4]) for (let p = 1; p <= 7; p++) allExceptWisdom.push(`${q}${p}`);

await seedPerio(1, allExceptWisdom, 1.5);
await seedPerio(2, allExceptWisdom, 2.0);
await seedPerio(3, allExceptWisdom, 1.8);

// Patient 4: mostly healthy, but 36/46/47 area shows periodontitis signs
await seedPerio(4, ["11","12","13","14","15","21","22","23","24","25","31","32","33","34","35","41","42","43","44","45"], 2.0);
for (const t of ["36", "37", "46", "47"]) {
  const vary = () => +(3.5 + Math.random() * 3.5).toFixed(1);
  await perio(4, t, [vary(), vary(), vary(), vary(), vary(), vary()], "1.5", "1", true, true);
}
for (const t of ["16", "17", "26", "27"]) {
  const vary = () => +(2.5 + Math.random() * 1.5).toFixed(1);
  await perio(4, t, [vary(), vary(), vary(), vary(), vary(), vary()], "0.5", "0", true, false);
}

console.log("Clinical seed done.");
await conn.end();
process.exit(0);
