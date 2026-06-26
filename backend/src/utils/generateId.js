const { sequelize } = require("../models");

async function generateId(tableName) {
  if (!tableName) {
    throw new Error("tableName é obrigatório para gerar id");
  }

  const dialect = sequelize.getDialect();
  let rows;

  if (dialect === "mssql") {
    const [result] = await sequelize.query(
      "exec SeqID @tableName = :tableName",
      {
        replacements: { tableName },
      },
    );
    rows = result;
  } else {
    // Postgres/MySQL: ajuste a procedure/função conforme seu banco.
    // Exemplo esperado no retorno: coluna SeqId
    const [result] = await sequelize.query(
      'SELECT * FROM "SeqID"(:tableName)',
      {
        replacements: { tableName },
      },
    );
    rows = result;
  }

  if (!rows || !rows[0] || rows[0].SeqId === undefined) {
    throw new Error("Procedure SeqID não retornou campo SeqId");
  }

  return rows[0].SeqId;
}

module.exports = {
  generateId,
};
