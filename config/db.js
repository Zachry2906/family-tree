import { Sequelize } from "sequelize";

const db = new Sequelize("js", "root", "", {
    host: "localhost",
    dialect: "mysql",
});

export default db;