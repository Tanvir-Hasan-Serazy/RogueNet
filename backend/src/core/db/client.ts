import { db } from "../../../prisma/db";

export { db };
export default db;

export type DbClient = typeof db;
