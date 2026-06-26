'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkUpdate(
      'employees',
      { email: null },
      {
        email: {
          [Sequelize.Op.not]: null,
          [Sequelize.Op.notLike]: '%@%',
        },
      }
    );
  },

  async down() {
    return Promise.resolve();
  },
};
