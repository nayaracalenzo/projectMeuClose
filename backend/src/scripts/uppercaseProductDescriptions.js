require("dotenv").config();

const productsRepository = require("../repositories/productsRepository");

async function uppercaseProductDescriptions() {
  return productsRepository.sequelize.transaction((transaction) =>
    productsRepository.uppercaseProductDescriptions(transaction),
  );
}

async function main() {
  try {
    console.log("Convertendo descrições dos produtos para letras maiúsculas...");

    const updatedCount = await uppercaseProductDescriptions();

    console.log(
      `Concluído: ${updatedCount} registro(s) da tabela products atualizado(s).`,
    );
  } finally {
    await productsRepository.sequelize.close();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error("Falha ao converter as descrições dos produtos:", error);
    process.exitCode = 1;
  });
}

module.exports = {
  uppercaseProductDescriptions,
};
