module.exports = {
  async up(queryInterface) {
    await queryInterface.addIndex("sales", ["status"], {
      name: "sales_status_idx",
    });
    await queryInterface.addIndex("sales", ["createdAt"], {
      name: "sales_created_at_idx",
    });
    await queryInterface.addIndex("sales", ["customerId"], {
      name: "sales_customer_id_idx",
    });
    await queryInterface.addIndex("sale_items", ["saleId"], {
      name: "sale_items_sale_id_idx",
    });
    await queryInterface.addIndex("payment_receipts", ["saleId"], {
      name: "payment_receipts_sale_id_idx",
    });
    await queryInterface.addIndex("receivables", ["saleId"], {
      name: "receivables_sale_id_idx",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex("sales", "sales_status_idx");
    await queryInterface.removeIndex("sales", "sales_created_at_idx");
    await queryInterface.removeIndex("sales", "sales_customer_id_idx");
    await queryInterface.removeIndex("sale_items", "sale_items_sale_id_idx");
    await queryInterface.removeIndex("payment_receipts", "payment_receipts_sale_id_idx");
    await queryInterface.removeIndex("receivables", "receivables_sale_id_idx");
  },
};
