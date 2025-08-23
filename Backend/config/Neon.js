import { neon } from "@neondatabase/serverless";

const sql = neon(`${process.env.DB_URL}`);

export default sql;
