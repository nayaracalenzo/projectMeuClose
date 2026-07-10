module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("categories", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        allowNull: false,
        autoIncrement: true,
      },
      desc: {
        type: Sequelize.STRING(60),
        allowNull: false,
        unique: true,
      },
    });

    await queryInterface.bulkInsert("categories", [
      { id: 1, desc: "Roupas" },
      { id: 3, desc: "Serviços" },
      { id: 4, desc: "Acessórios" },
      { id: 5, desc: "Diversos" },
    ]);

    await queryInterface.addColumn("products", "categoryId", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: "categories",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });

    await queryInterface.sequelize.query(`
      UPDATE products
      SET "categoryId" = 1
      WHERE "categoryId" IS NULL
    `);
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("products", "categoryId");
    await queryInterface.dropTable("categories");
  },
};
