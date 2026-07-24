'use strict';

const { LEGACY_MEASUREMENT_DEFINITIONS } = require("../utils/measurementDefinitions");

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("measurement_definitions", {
      idMeasurementDefinition: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      key: {
        type: Sequelize.STRING(120),
        allowNull: false,
        unique: true,
      },
      label: {
        type: Sequelize.STRING(160),
        allowNull: false,
      },
      active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      sortOrder: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    await queryInterface.createTable("customer_measurement_values", {
      idCustomerMeasurementValue: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      customerId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "customers",
          key: "idCustomer",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      saleId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "sales",
          key: "idSale",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      measurementDefinitionId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "measurement_definitions",
          key: "idMeasurementDefinition",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      value: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    await queryInterface.addConstraint("customer_measurement_values", {
      type: "unique",
      name: "customer_measurement_values_sale_measurement_unique",
      fields: ["saleId", "measurementDefinitionId"],
    });

    const now = new Date();

    await queryInterface.bulkInsert(
      "measurement_definitions",
      LEGACY_MEASUREMENT_DEFINITIONS.map((item) => ({
        key: item.key,
        label: item.label,
        active: true,
        sortOrder: item.sortOrder,
        createdAt: now,
        updatedAt: now,
      })),
    );

    const [definitions] = await queryInterface.sequelize.query(
      `SELECT "idMeasurementDefinition", "key" FROM "measurement_definitions";`,
    );
    const definitionIdByKey = new Map(
      definitions.map((item) => [String(item.key), Number(item.idMeasurementDefinition)]),
    );

    const [legacyRows] = await queryInterface.sequelize.query(
      `SELECT * FROM "customer_measurements" ORDER BY "idMeasurement" ASC;`,
    );

    const valueRows = [];

    for (const row of legacyRows) {
      for (const definition of LEGACY_MEASUREMENT_DEFINITIONS) {
        const rawValue = row[definition.key];
        if (rawValue === null || rawValue === undefined || rawValue === "") {
          continue;
        }

        valueRows.push({
          customerId: Number(row.customerId),
          saleId: Number(row.saleId),
          measurementDefinitionId: definitionIdByKey.get(definition.key),
          value: rawValue,
          createdAt: row.createdAt || now,
          updatedAt: row.updatedAt || now,
        });
      }
    }

    if (valueRows.length) {
      const dedupedRows = [];
      const latestRowByKey = new Map();

      for (const row of valueRows) {
        latestRowByKey.set(
          `${row.saleId}:${row.measurementDefinitionId}`,
          row,
        );
      }

      for (const row of latestRowByKey.values()) {
        dedupedRows.push(row);
      }

      await queryInterface.bulkInsert("customer_measurement_values", dedupedRows);
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable("customer_measurement_values");
    await queryInterface.dropTable("measurement_definitions");
  },
};
