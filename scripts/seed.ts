import { db } from "../src/db";
import { resetAndSeed } from "../src/db/seed";

resetAndSeed(db).then(() => db.$client.end());
