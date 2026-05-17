import { Sequelize, Model, DataTypes } from "sequelize";

const sequelize = new Sequelize("sqlite::memory:");

class User extends Model {}
User.init({ name: DataTypes.STRING }, { sequelize, modelName: "user" });

// SEQ-SYNC-004: force-recreate on every boot.
sequelize.sync({ force: true });

export async function nPlusOne(ids: number[]) {
  // SEQ-N1-001: findByPk in for-of.
  const out = [];
  for (const id of ids) {
    out.push(await User.findByPk(id));
  }
  return out;
}

export async function saveLoop(users: User[]) {
  // SEQ-SAVE-003: instance.save() in loop.
  for (const u of users) {
    await u.save();
  }
}

export async function rawUnsafe(name: string) {
  // SEQ-RAW-002: template interpolation in sequelize.query.
  return sequelize.query(`SELECT * FROM user WHERE name = '${name}'`);
}

export async function cleanBulk(ids: number[]) {
  // Negative: bulk findAll — no findings.
  return User.findAll({ where: { id: ids } });
}
