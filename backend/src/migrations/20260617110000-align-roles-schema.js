'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const rolesTable = await queryInterface.describeTable('roles');

    if (rolesTable.idRole) {
      await queryInterface.renameColumn('roles', 'idRole', 'id');
    }

    if (rolesTable.name) {
      await queryInterface.renameColumn('roles', 'name', 'desc');
    }

    await queryInterface.changeColumn('roles', 'desc', {
      type: Sequelize.STRING(50),
      allowNull: false,
      unique: true,
    });

    const usersForeignKeys = await queryInterface.getForeignKeyReferencesForTable('users');
    const roleForeignKeys = usersForeignKeys.filter(
      (foreignKey) =>
        foreignKey.columnName === 'roleId' &&
        foreignKey.referencedTableName === 'roles'
    );

    for (const foreignKey of roleForeignKeys) {
      if (foreignKey.constraintName) {
        await queryInterface.removeConstraint('users', foreignKey.constraintName);
      }
    }

    await queryInterface.addConstraint('users', {
      fields: ['roleId'],
      type: 'foreign key',
      name: 'users_roleId_roles_fk',
      references: {
        table: 'roles',
        field: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    });
  },

  async down(queryInterface, Sequelize) {
    const usersForeignKeys = await queryInterface.getForeignKeyReferencesForTable('users');
    const roleForeignKey = usersForeignKeys.find(
      (foreignKey) => foreignKey.constraintName === 'users_roleId_roles_fk'
    );

    if (roleForeignKey?.constraintName) {
      await queryInterface.removeConstraint('users', roleForeignKey.constraintName);
    }

    const rolesTable = await queryInterface.describeTable('roles');

    if (rolesTable.desc) {
      await queryInterface.renameColumn('roles', 'desc', 'name');
    }

    if (rolesTable.id) {
      await queryInterface.renameColumn('roles', 'id', 'idRole');
    }

    await queryInterface.changeColumn('roles', 'name', {
      type: Sequelize.STRING(30),
      allowNull: false,
      unique: true,
    });

    await queryInterface.addConstraint('users', {
      fields: ['roleId'],
      type: 'foreign key',
      name: 'users_roleId_roles_fk',
      references: {
        table: 'roles',
        field: 'idRole',
      },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    });
  },
};
